import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendLineMessage(to: string, text: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  return fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
}

export async function GET(req: Request) {
  const now = Date.now();
  try {
    const snapshot = await dbAdmin.collection('scheduled_notifications')
      .where('status', '==', 'pending')
      .get();

    if (snapshot.empty) return NextResponse.json({ success: true, count: 0 });

    const pendingNotifs = snapshot.docs
      .map(d => ({ ref: d.ref, id: d.id, data: d.data() }))
      .filter(n => n.data.notifyAt <= now)
      .slice(0, 50);

    if (pendingNotifs.length === 0) return NextResponse.json({ success: true, count: 0 });

    const results: any[] = [];
    for (const { data: notif, ref, id } of pendingNotifs) {
      const userSnap = await dbAdmin.collection('users').doc(notif.userId).get();
      const userData = userSnap.data();

      if (userData?.telegramChatId || userData?.lineUserId) {
        try {
          const label = notif.itemType === 'event' ? 'Event' : 'Task';
          const message = `🔔 ${label} Reminder\n${notif.taskName}\n🕒 ${notif.scheduledTime}${notif.description ? `\n\n${notif.description}` : ''}`;
          
          let res;
          let method = 'none';
          
          if (userData.telegramChatId) {
            res = await sendTelegramMessage(userData.telegramChatId, message);
            method = 'telegram';
          } else if (userData.lineUserId) {
            res = await sendLineMessage(userData.lineUserId, message);
            method = 'line';
          }
          
          const status = res?.ok ? 'sent' : 'failed';
          await ref.update({ status, sentAt: admin.firestore.FieldValue.serverTimestamp(), method });
          results.push({ id, task: notif.taskName, status, method });
        } catch (err: any) {
          console.error(`[Dispatch Error]:`, err);
          results.push({ id, task: notif.taskName, status: 'error', error: err.message });
        }
      } else {
        await ref.update({ status: 'failed', error: 'No notification target found' });
        results.push({ id, task: notif.taskName, status: 'failed', error: 'No target ID' });
      }
    }
    return NextResponse.json({ success: true, count: pendingNotifs.length, results });
  } catch (err: any) {
    console.error('[Global Dispatch Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
