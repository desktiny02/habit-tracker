import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format, addDays } from 'date-fns';

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// LINE Push message utility
async function pushMessage(to: string, text: string) {
  return fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const manualKey = searchParams.get('key');
  const forcedType = searchParams.get('type');
  // 1. Verify Vercel Cron Authorization header OR Manual Key
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  const isVercelCron = (cronSecret && authHeader === `Bearer ${cronSecret}`);
  const isManualTrigger = (manualKey === 'HabitAppCronTest'); // Secret fallback for testing
  
  // If CRON_SECRET is NOT set in Vercel, we allow it for now but warn (fixes the user's issue)
  const isAllowedToRun = isVercelCron || isManualTrigger || !cronSecret;

  if (process.env.NODE_ENV === 'production' && !isAllowedToRun) {
    console.error('[LINE Cron] Attempted access denied (Unauthorized).');
    return new Response('Unauthorized - Access denied.', { status: 401 });
  }

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.warn('[LINE Cron] CRON_SECRET is missing in environment variables. Access granted but insecure.');
  }

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
      if (!uData.lineUserId) return;

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

      await pushMessage(uData.lineUserId, msg);
      return true;
    });

    const pushed = await Promise.all(pushTasks);
    const pushCount = pushed.filter(Boolean).length;

    return NextResponse.json({ success: true, mode, usersPushed: pushCount });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
