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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const manualKey = searchParams.get('key');
  
  // 1. Verify Vercel Cron Authorization header OR Manual Key
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  const isVercelCron = (cronSecret && authHeader === `Bearer ${cronSecret}`);
  const isManualTrigger = (manualKey === 'HabitAppCronTest'); // Secret fallback for testing
  
  if (process.env.NODE_ENV === 'production' && !isVercelCron && !isManualTrigger) {
    console.error('[LINE Cron] Attempted access denied (Unauthorized). Headers present:', !!authHeader, 'ManualKey present:', !!manualKey);
    return new Response('Unauthorized - Access denied.', { status: 401 });
  }

  try {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const currentDay = today.getDay(); // 0-6 (Sun-Sat)

    // 2. Fetch all users (small set, so we can filter in memory)
    const usersSnap = await dbAdmin.collection('users').get();
    console.log(`[LINE Cron] Total users found: ${usersSnap.size}`);

    let pushCount = 0;

    for (const userDoc of usersSnap.docs) {
      const uData = userDoc.data();
      const lineUserId = uData.lineUserId;
      const username = uData.username || 'User';

      if (!lineUserId) {
        console.log(`[LINE Cron] User ${username} has no lineUserId, skipping.`);
        continue;
      }

      console.log(`[LINE Cron] Processing notifications for ${username} (${lineUserId})`);

      // 3. Fetch all tasks/events for this user
      const tasksSnap = await dbAdmin.collection('tasks')
        .where('userId', '==', userDoc.id)
        .get();

      const activeToday: string[] = [];

      for (const tDoc of tasksSnap.docs) {
        const task = tDoc.data();

        let isToday = false;
        if (task.repeatType === 'daily') {
          isToday = true;
        } else if (task.repeatType === 'weekly' && Array.isArray(task.repeatDays)) {
          isToday = task.repeatDays.includes(currentDay);
        } else if (task.repeatType === 'once' && task.targetDate === todayStr) {
          isToday = true;
        }

        if (isToday) {
          const typeEmoji = task.itemType === 'event' ? '🗓️' : '✅';
          const priorityLabel = task.priority ? `[${task.priority.toUpperCase()}]` : '';
          activeToday.push(`${typeEmoji} ${task.name} ${priorityLabel}`);
        }
      }

      // 4. SendPush Notification if there are items today
      if (activeToday.length > 0) {
        const messageText = `☀️ Good morning, ${username}!\nHere is your schedule for today (${format(today, 'dd MMM')}):\n\n` + 
                            activeToday.map((item, index) => `${index + 1}. ${item}`).join('\n') +
                            `\n\n Have a productive day! 🚀`;

        const res = await pushMessage(lineUserId, messageText);
        
        if (!res.ok) {
          const resBody = await res.text();
          console.error(`[LINE Cron] Failed to send push to ${username}:`, res.status, resBody);
        } else {
          console.log(`[LINE Cron] Successfully sent push to ${username}`);
          pushCount++;
        }
      } else {
        console.log(`[LINE Cron] No active items for ${username} today.`);
      }
    }

    return NextResponse.json({ success: true, usersPushed: pushCount });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown Cron Error';
    console.error('[LINE Cron] Failed:', err);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}
