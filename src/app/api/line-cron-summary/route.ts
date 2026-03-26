import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format } from 'date-fns';

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

// Simple Weather & AQI fetch for Bangkok
async function getBangkokContext() {
  try {
    const weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.75&longitude=100.50&current=temperature_2m,weather_code&timezone=Asia%2FBangkok');
    const aqiRes = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=13.75&longitude=100.50&current=us_aqi');
    
    const weatherData = await weatherRes.json();
    const aqiData = await aqiRes.json();

    const temp = Math.round(weatherData.current?.temperature_2m || 30);
    const aqi = aqiData.current?.us_aqi || 50;
    
    let aqiLabel = 'Good';
    if (aqi > 150) aqiLabel = 'Unhealthy';
    else if (aqi > 100) aqiLabel = 'Unhealthy for Sensitive Groups';
    else if (aqi > 50) aqiLabel = 'Moderate';

    return { temp, aqi, aqiLabel };
  } catch (err) {
    return { temp: 30, aqi: 'N/A', aqiLabel: 'Unknown' };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const manualKey = searchParams.get('key');
  const forcedType = searchParams.get('type');
  
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  const isVercelCron = (cronSecret && authHeader === `Bearer ${cronSecret}`);
  const isManualTrigger = (manualKey === 'HabitAppCronTest');
  
  if (process.env.NODE_ENV === 'production' && !isVercelCron && !isManualTrigger) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const currentDay = today.getDay();
    const currentHourUTC = today.getUTCHours();
    const fullDate = format(today, 'eee, dd MMMM yyyy'); // "Thu, 26 March 2026"
    
    const type: 'morning' | 'evening' = (forcedType === 'evening' || (currentHourUTC >= 12 && !forcedType)) 
      ? 'evening' 
      : 'morning';

    const { temp, aqi, aqiLabel } = await getBangkokContext();

    const usersSnap = await dbAdmin.collection('users').get();
    let pushCount = 0;

    for (const userDoc of usersSnap.docs) {
      const uData = userDoc.data();
      const lineUserId = uData.lineUserId;
      const username = uData.username || 'User';
      if (!lineUserId) continue;

      const tasksSnap = await dbAdmin.collection('tasks').where('userId', '==', userDoc.id).get();
      const logsSnap = await dbAdmin.collection('logs').where('userId', '==', userDoc.id).where('date', '==', todayStr).get();

      const logMap = new Map();
      logsSnap.forEach(l => logMap.set(l.data().taskId, l.data()));

      const morningEvents: string[] = [];
      const morningTasks: string[] = [];
      const eveningDone: string[] = [];
      const eveningPending: string[] = [];

      for (const tDoc of tasksSnap.docs) {
        const task = tDoc.data();
        let isToday = false;
        if (task.repeatType === 'daily') isToday = true;
        else if (task.repeatType === 'weekly' && task.repeatDays?.includes(currentDay)) isToday = true;
        else if (task.repeatType === 'once' && task.targetDate === todayStr) isToday = true;

        if (isToday) {
          const typeEmoji = task.itemType === 'event' ? '🗓️' : '✅';
          const label = `${typeEmoji} ${task.name}`;
          
          if (task.itemType === 'event') morningEvents.push(label);
          else morningTasks.push(label);

          if (logMap.has(task.id) && logMap.get(task.id).status === 'done') {
            eveningDone.push(label);
          } else {
            eveningPending.push(label);
          }
        }
      }

      const totalActive = morningEvents.length + morningTasks.length;
      if (totalActive === 0) continue;

      let messageText = '';
      if (type === 'morning') {
        messageText = `☀️ Good Morning, ${username}!\n` +
                      `Today is ${fullDate}\n\n` +
                      (morningEvents.length > 0 ? `Event for Today:\n${morningEvents.map((t, i) => `${i+1}. ${t}`).join('\n')}\n\n` : '') +
                      (morningTasks.length > 0 ? `Task for Today:\n${morningTasks.map((t, i) => `${i+1}. ${t}`).join('\n')}\n\n` : '') +
                      `📍 Bangkok: 🌡️${temp}°C | 🌬️AQI ${aqi} (${aqiLabel})\n\n` +
                      `Have a productive day! 🚀`;
      } else {
        const percent = Math.round((eveningDone.length / totalActive) * 100);
        messageText = `🌙 Daily Report for ${username}!\n` +
                      `Today is ${fullDate}\n` +
                      `-------------------\n` +
                      `📊 Progress: ${eveningDone.length}/${totalActive} (${percent}%)\n\n` +
                      (eveningDone.length > 0 ? `Done Today:\n${eveningDone.map(t => ` • ${t}`).join('\n')}\n\n` : '') +
                      (eveningPending.length > 0 ? `Pending:\n${eveningPending.map(t => ` • ${t}`).join('\n')}\n\n` : '') +
                      `📍 Bangkok now: 🌡️${temp}°C | 🌬️AQI ${aqi}\n\n` +
                      (percent === 100 ? `👑 PERFECT! You're unstoppable! 🔥` : `💪 Great effort! Rest up for tomorrow.`);
      }

      await pushMessage(lineUserId, messageText);
      pushCount++;
    }

    return NextResponse.json({ success: true, mode: type, usersPushed: pushCount });
  } catch (err: any) {
    console.error('[LINE Cron] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
