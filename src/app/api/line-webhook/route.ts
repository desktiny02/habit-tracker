import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbAdmin } from '@/lib/firebase/admin';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// Validate LINE signature
function validateSignature(body: string, signature: string) {
  const hash = crypto
    .createHmac('sha256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

async function replyMessage(replyToken: string, text: string) {
  return fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-line-signature') || '';

    const { events } = JSON.parse(rawBody || '{}');

    const isVerifyPing = Array.isArray(events) && events.length === 0;

    if (!isVerifyPing && !validateSignature(rawBody, signature)) {
      console.error('[LINE Webhook] Invalid signature');
      return new Response('Unauthorized', { status: 401 });
    }

    if (isVerifyPing) {
      return NextResponse.json({ success: true });
    }

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const textMessage = event.message.text;
        const replyToken = event.replyToken;
        const userId = event.source.userId;

        // LINKAGE PIN TRIGGER: "Link XXXXXX"
        if (textMessage.trim().toUpperCase().startsWith('LINK ')) {
          const pin = textMessage.trim().split(' ')[1];
          if (!pin) {
             await replyMessage(replyToken, '❌ Please provide a PIN after "Link"! (e.g., Link 123456)');
             continue;
          }

          const snap = await dbAdmin.collection('users').where('linePin', '==', pin).get();

          if (!snap.empty) {
             const userDoc = snap.docs[0];
             await userDoc.ref.update({
                lineUserId: userId,
             });

             await replyMessage(replyToken, '✅ Your LINE account has been successfully connected to your Habit Tracker dashboard! AI natural task insertion is now active 🤖');
          } else {
             await replyMessage(replyToken, '❌ Invalid link PIN. Check your dashboard top card for the exact 6-digit number!');
          }
          continue;
        }

        // ── AI TASK PARSER FOR LINKED USERS ─────────────────────────
        const userSnap = await dbAdmin.collection('users').where('lineUserId', '==', userId).get();

        if (!userSnap.empty) {
           const userDoc = userSnap.docs[0];

           try {
              const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
              
              const prompt = `You are an AI task extractor. Parse this message: "${textMessage}". 
Today is ${new Date().toISOString().split('T')[0]}.
Return a JSON object: { "itemType": "task"|"event", "name": "...", "description": "...", "points": number, "priority": "high"|"medium"|"low", "required": boolean, "repeatType": "daily"|"weekly"|"once", "repeatDays": number[] (0-6 Sun-Sat, only if weekly), "targetDate": "YYYY-MM-DD" (only if once) }`;

              const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

              const aiRes = await fetch(aiUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generation_config: { temperature: 0.1 }
                 })
              });

              const resJson = await aiRes.json();
              if (resJson.error) {
                 await replyMessage(replyToken, `⚠️ Gemini 3 Error: ${resJson.error.message}`);
                 continue;
              }

              const textContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (!textContent) {
                 throw new Error('AI Candidate text is empty. Check your prompt or context limits.');
              }

              // Strip down markdown backticks like ```json if Gemini included them
              const cleanJson = textContent.replace(/```json|```/g, '').trim();
              const taskConfig = JSON.parse(cleanJson);

              if (!taskConfig.name) {
                 throw new Error(`Name missing. AI response was: ${cleanJson.slice(0, 100)}`);
              }

              const taskRef = dbAdmin.collection('tasks').doc();

              await taskRef.set({
                 id: taskRef.id,
                 userId: userDoc.id,
                 itemType: taskConfig.itemType || 'task',
                 name: taskConfig.name,
                 description: taskConfig.description || '',
                 points: taskConfig.points ?? (taskConfig.itemType === 'event' ? 0 : 5),
                 priority: taskConfig.priority || 'medium',
                 required: taskConfig.required ?? false,
                 repeatType: taskConfig.repeatType || 'once',
                 repeatDays: taskConfig.repeatDays || [],
                 targetDate: taskConfig.targetDate || '',
                 createdAt: Date.now()
              });

              await replyMessage(replyToken, `✅ Added task: "${taskConfig.name}" (${taskConfig.repeatType}) successfully to your dashboard!`);
              continue;
           } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : 'Unknown error';
              await replyMessage(replyToken, `⚠️ Received: "${textMessage}". AI parsing failed: ${errMsg}`);
              continue;
           }
        }

        await replyMessage(replyToken, `Received: "${textMessage}". Your LINE account is not connected yet. Type "Link [Dashboard_PIN]" to link it!`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown total crash';
    console.error('[LINE Webhook] Error:', err);
    return new Response(`Error: ${errMsg}`, { status: 500 });
  }
}
