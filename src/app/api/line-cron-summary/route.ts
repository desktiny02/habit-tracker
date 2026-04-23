import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format, addDays } from 'date-fns';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function pushTelegramMessage(to: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      chat_id: to, 
      text,
      parse_mode: 'HTML'
    }),
  });
}

// Advanced Weather/AQI fetch for Bangkok
async function getBangkokContext() {
  try {
    const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=13.75&longitude=100.50&daily=temperature_2m_max,precipitation_sum,weather_code&timezone=Asia%2FBangkok&forecast_days=2';
    const aqiUrl = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=13.75&longitude=100.50&hourly=us_aqi&forecast_days=2';
    
    const [wRes, aRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
    const wData = await wRes.json();
    const aData = await aRes.json();

    // Index 0 = Today, Index 1 = Tomorrow
    const todayW = {
      maxTemp: Math.round(wData.daily.temperature_2m_max[0]),
      rain: wData.daily.precipitation_sum[0] > 0.5,
      weatherCode: wData.daily.weather_code[0]
    };
    const tmrW = {
      maxTemp: Math.round(wData.daily.temperature_2m_max[1]),
      rain: wData.daily.precipitation_sum[1] > 0.5,
      weatherCode: wData.daily.weather_code[1]
    };

    // Calculation for AQI (average of day)
    const getAvgAQI = (start: number, end: number) => {
       const slice = aData.hourly.us_aqi.slice(start, end);
       return Math.round(slice.reduce((a: any, b: any) => a + b, 0) / slice.length);
    };
    const todayAQI = getAvgAQI(0, 24);
    const tmrAQI = getAvgAQI(24, 48);

    return { today: { ...todayW, aqi: todayAQI }, tmr: { ...tmrW, aqi: tmrAQI } };
  } catch (err) {
    console.error('Weather fetch error:', err);
    return null;
  }
}

function getAqiLabel(aqi: number) {
  if (aqi > 150) return 'Unhealthy';
  if (aqi > 100) return 'Unhealthy for Sensitive Groups';
  if (aqi > 50) return 'Moderate';
  return 'Good';
}

function getWeatherEmoji(code: number) {
  if (code >= 95) return '⛈️ Stormy';
  if (code >= 51 && code <= 67) return '🌦️ Rainy';
  if (code >= 1 && code <= 3) return '🌤️ Partly Cloudy';
  if (code === 0) return '☀️ Clear';
  return '☁️ Cloudy';
}

import { validateCronAuth } from '@/lib/cron-auth';

export async function POST(req: Request) {
  // 1. Verify Authorization and Method
  const authError = await validateCronAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const forcedType = searchParams.get('type');


  try {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const dayOfWeek = now.getDay();
    const utcHour = now.getUTCHours();
    const mode: 'morning' | 'evening' = (forcedType === 'evening' || (utcHour >= 12 && !forcedType)) ? 'evening' : 'morning';

    const weather = await getBangkokContext();
    const usersSnap = await dbAdmin.collection('users').get();
    
    const pushTasks = usersSnap.docs.map(async (userDoc) => {
      const uData = userDoc.data();
      if (!uData.telegramChatId) return;

      const [tasksSnap, logsSnap] = await Promise.all([
        dbAdmin.collection('tasks').where('userId', '==', userDoc.id).get(),
        dbAdmin.collection('logs').where('userId', '==', userDoc.id).where('date', '==', todayStr).get()
      ]);

      const logMap = new Map();
      logsSnap.forEach(l => logMap.set(l.data().taskId, l.data()));

      const events: string[] = [];
      const tasks: string[] = [];
      const completed: string[] = [];
      const pending: string[] = [];

      for (const tDoc of tasksSnap.docs) {
        const t = tDoc.data();
        let isToday = (t.repeatType==='daily') || (t.repeatType==='weekly' && t.repeatDays?.includes(dayOfWeek)) || (t.repeatType==='once' && t.targetDate===todayStr);
        if (isToday) {
          const emoji = t.itemType==='event' ? '🗓️' : '✅';
          const label = `${emoji} ${t.name}`;
          if (t.itemType==='event') events.push(label); else tasks.push(label);
          if (logMap.get(t.id)?.status === 'done') completed.push(label); else pending.push(label);
        }
      }

      if (events.length + tasks.length === 0) return;

      let msg = '';
      if (mode === 'morning') {
        const w = weather?.today;
        msg = `☀️ Good Morning, ${uData.username || 'mu'}!\n` +
              `Today is ${format(now, 'eee, dd MMMM yyyy')}\n\n` +
              (events.length > 0 ? `Event for Today:\n${events.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n` : '') +
              (tasks.length > 0 ? `Task for Today:\n${tasks.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n` : '') +
              `📍 Bangkok Today:\n` +
              `🌡️ Max ${w?.maxTemp || '??'}°C | ${getWeatherEmoji(w?.weatherCode || 0)}\n` +
              `🌬️ AQI ${w?.aqi || '??'} (${getAqiLabel(w?.aqi || 0)})\n` +
              (w?.rain ? `⛈️ *Caution: Rain expected today!*\n` : '') +
              (w?.aqi && w.aqi > 100 ? `😷 *High AQI: Wear a mask out there!*\n` : '') +
              `\nHave a productive day! 🚀`;
      } else {
        const tmr = addDays(now, 1);
        const w = weather?.tmr;
        const total = completed.length + pending.length;
        const percent = total > 0 ? Math.round((completed.length / total) * 100) : 0;

        msg = `🌙 Daily Report for ${uData.username || 'mu'}!\n` +
              `Tomorrow is ${format(tmr, 'eee, dd MMMM yyyy')}\n` +
              `-------------------\n` +
              `📊 Progress Today: ${completed.length}/${total} (${percent}%)\n\n` +
              (completed.length > 0 ? `Done Today:\n${completed.map(s => ` • ${s}`).join('\n')}\n\n` : '') +
              (pending.length > 0 ? `Pending:\n${pending.map(s => ` • ${s}`).join('\n')}\n\n` : '') +
              `📍 Bangkok Tomorrow:\n` +
              `🌡️ Max ${w?.maxTemp || '??'}°C | ${getWeatherEmoji(w?.weatherCode || 0)}\n` +
              `🌬️ AQI ${w?.aqi || '??'}\n` +
              (w?.rain ? `⛈️ *Forecast: Rain likely tomorrow.*\n` : '') +
              `\nRest up for tomorrow. 🛌`;
      }

      if (uData.telegramChatId) {
        await pushTelegramMessage(uData.telegramChatId, msg);
        return true;
      }
      return false;
    });

    const pushed = await Promise.all(pushTasks);
    const pushCount = pushed.filter(Boolean).length;

    return NextResponse.json({ success: true, mode, usersPushed: pushCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
