import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

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

async function generateGeminiMessage(name: string, time: string, type: 'standard' | 'priority', priority?: string) {
  try {
    const prompt = `You are a helpful habit coach. Create a short, motivating LINE message for a notification. 
Task: "${name}"
Time: "${time}"
Notification Type: "${type}" (standard is 1h before, priority is 10m before)
Priority Level: "${priority || 'normal'}"

Rules:
- Keep it under 150 characters.
- If standard (1h before): Mention the task is upcoming.
- If priority (10m before): Sound more urgent, mention starting soon.
- Include the time explicitly.
- Add exactly one emoji.
- Output ONLY the message text.`;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generation_config: { temperature: 0.7, max_output_tokens: 100 }
      })
    });

    const resJson = await aiRes.json();
    const textContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (textContent) return textContent;
  } catch (err) {
    console.error('[AI Notification Error]:', err);
  }
  
  // Fallback
  return type === 'priority' 
    ? `🚨 Starting soon: "${name}" at ${time}. High priority!` 
    : `📅 Upcoming: "${name}" at ${time}. Stay on track!`;
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
      .where('notifyAt', '<=', now)
      .limit(50)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const tasks: Promise<any>[] = [];

    for (const doc of snapshot.docs) {
      const notif = doc.data();
      const userSnap = await dbAdmin.collection('users').doc(notif.userId).get();
      const userData = userSnap.data();

      if (userData?.lineUserId) {
        tasks.push((async () => {
          const message = await generateGeminiMessage(
            notif.taskName,
            notif.scheduledTime,
            notif.type,
            notif.priority
          );
          
          await sendLineMessage(userData.lineUserId, message);
          await doc.ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() });
        })());
      } else {
        // Mark as failed or skipped if no LINE ID
        tasks.push(doc.ref.update({ status: 'failed', error: 'No LINE ID connected' }));
      }
    }

    await Promise.all(tasks);
    return NextResponse.json({ success: true, count: snapshot.size });
  } catch (err: any) {
    console.error('[Dispatch Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
