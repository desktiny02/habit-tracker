import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

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

    // LINE "Verify" endpoint sends an empty events list to dry-run test
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
        const userId = event.source.userId; // LINE User ID

        // LINKAGE PIN TRIGGER: "Link XXXXXX"
        if (textMessage.trim().toUpperCase().startsWith('LINK ')) {
          const pin = textMessage.trim().split(' ')[1];
          if (!pin) {
             await replyMessage(replyToken, '❌ Please provide a PIN after "Link"! (e.g., Link 123456)');
             continue;
          }

          const q = query(collection(db, 'users'), where('linePin', '==', pin));
          const snap = await getDocs(q);

          if (!snap.empty) {
             const userDoc = snap.docs[0];
             await updateDoc(doc(db, 'users', userDoc.id), {
                lineUserId: userId,
             });

             await replyMessage(replyToken, '✅ Your LINE account has been successfully connected to your Habit Tracker dashboard! AI natural task insertion is now active 🤖');
          } else {
             await replyMessage(replyToken, '❌ Invalid link PIN. Check your dashboard top card for the exact 6-digit number!');
          }
          continue;
        }

        // ── AI TASK PARSER FOR LINKED USERS ─────────────────────────
        const userQ = query(collection(db, 'users'), where('lineUserId', '==', userId));
        const userSnap = await getDocs(userQ);

        if (!userSnap.empty) {
           const userDoc = userSnap.docs[0];
           const uData = userDoc.data();

           try {
              const GEMINI_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY; // can use Firebase Key if enabled Gemini
              
              const prompt = `You are an AI task extractor. Parse this message: "${textMessage}". 
Today is ${new Date().toISOString().split('T')[0]}.
Return a JSON object: { "itemType": "task"|"event", "name": "...", "description": "...", "points": number, "priority": "high"|"medium"|"low", "required": boolean, "repeatType": "daily"|"weekly"|"once", "repeatDays": number[] (0-6 Sun-Sat, only if weekly), "targetDate": "YYYY-MM-DD" (only if once) }`;

              const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
                 })
              });

              const resJson = await aiRes.json();
              const textContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              const taskConfig = JSON.parse(textContent);

              // Validate minimally
              if (!taskConfig.name) throw new Error('Could not resolve task name.');

              // Insert to Firestore
              const addDocRef = await import('firebase/firestore').then(f => f.addDoc);
              await addDocRef(collection(db, 'tasks'), {
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
           } catch (err) {
              await replyMessage(replyToken, `⚠️ Received: "${textMessage}". Adding it failed on parsing error. Log standard items manually if issue persists.`);
              continue;
           }
        }

        await replyMessage(replyToken, `Received: "${textMessage}". Your LINE account is not connected yet. Type "Link [Dashboard_PIN]" to link it!`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[LINE Webhook] Error:', err);
    return new Response('Error', { status: 500 });
  }
}
