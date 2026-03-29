import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

async function sendLineMessage(to: string, text: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  
  return fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
    }),
  });
}

export async function GET(req: Request) {
  // Check auth header if cron secret is set
  const authHeader = req.headers.get('Authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const now = Date.now();
    const snapshot = await dbAdmin.collection('scheduled_notifications')
      .where('status', '==', 'pending')
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Filter by time in JS to avoid composite index requirement
    const pendingNotifs = snapshot.docs
      .map(d => ({ ref: d.ref, id: d.id, data: d.data() }))
      .filter(n => n.data.notifyAt <= now)
      .slice(0, 50);

    if (pendingNotifs.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const results: any[] = [];

    for (const notifInfo of pendingNotifs) {
      const { data: notif, ref, id } = notifInfo;
      const userSnap = await dbAdmin.collection('users').doc(notif.userId).get();
      const userData = userSnap.data();

      if (userData?.lineUserId) {
        try {
          const label = notif.itemType === 'event' ? 'Event' : 'Task';
          const message = `🔔 ${label} Reminder\n${notif.taskName}\n🕒 ${notif.scheduledTime}${notif.description ? `\n\n${notif.description}` : ''}`;
          
          const lineRes = await sendLineMessage(userData.lineUserId, message);
          const lineStatus = lineRes ? lineRes.status : 'unknown';
          
          await ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() });
          results.push({ id, task: notif.taskName, status: 'sent', lineStatus });
        } catch (err: any) {
          console.error(`[Dispatch Error for ${id}]:`, err);
          results.push({ id, task: notif.taskName, status: 'error', error: err.message });
        }
      } else {
        await ref.update({ status: 'failed', error: 'No LINE ID connected' });
        results.push({ id, task: notif.taskName, status: 'failed', error: 'No LINE ID' });
      }
    }

    return NextResponse.json({ success: true, count: pendingNotifs.length, results });
  } catch (err: any) {
    console.error('[Global Dispatch Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
