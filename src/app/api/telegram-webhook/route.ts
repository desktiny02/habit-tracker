import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format } from 'date-fns';
import { extractGeminiText } from '@/lib/utils';


async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Telegram Webhook] CRITICAL: TELEGRAM_BOT_TOKEN is missing in Vercel env!');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    console.error(`[Telegram Webhook] Send Failed:`, errorData);
    if (errorData.description?.includes('can\'t parse entities')) {
      return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/<[^>]*>?/gm, ''), // Strip tags for safety
          reply_markup: replyMarkup
        }),
      });
    }
  }
  return res;
}


async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!TELEGRAM_BOT_TOKEN) return;
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Telegram Webhook] Received update:', JSON.stringify(body).slice(0, 200));
    
    // 1. Handle Callback Queries (Button Clicks)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data; // e.g. "done:TASK_ID"

      if (data.startsWith('done:')) {
        const taskId = data.split(':')[1];
        const userSnap = await dbAdmin.collection('users').where('telegramChatId', '==', String(chatId)).get();
        
        if (userSnap.empty) {
          await answerCallbackQuery(cb.id, "⚠️ Account not linked yet!");
          return NextResponse.json({ success: true });
        }

        const userDoc = userSnap.docs[0];
        const userId = userDoc.id;
        const taskSnap = await dbAdmin.collection('tasks').doc(taskId).get();
        const task = taskSnap.data();
        if (!taskSnap.exists || !task) {
          await answerCallbackQuery(cb.id, "⚠️ Task not found!");
          return NextResponse.json({ success: true });
        }

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const logId = `${userId}_${taskId}_${todayStr}`;
        const logRef = dbAdmin.collection('logs').doc(logId);
        const logSnap = await logRef.get();

        if (logSnap.exists) {
          await answerCallbackQuery(cb.id, "✅ Already completed today!");
        } else {
          // Calculate points (Simplified replication of logDailyTask)
          let pointsAwarded = 0;
          if (task.itemType !== 'event') {
            pointsAwarded = task.points || 5;
            if (task.repeatType === 'daily') {
              const streak = task.currentStreak || 0;
              const multiplier = Math.min(2, 1 + (streak * 0.05));
              pointsAwarded = Math.round(pointsAwarded * multiplier);
            }
          }

          await dbAdmin.runTransaction(async (tx) => {
            tx.set(logRef, {
              id: logId,
              userId,
              taskId,
              taskName: task.name,
              itemType: task.itemType,
              date: todayStr,
              status: 'done',
              pointsAwarded,
              createdAt: Date.now()
            });
            tx.update(userDoc.ref, {
              totalPoints: (userDoc.data().totalPoints || 0) + pointsAwarded
            });
          });

          await answerCallbackQuery(cb.id, `✅ "${task.name}" completed! (+${pointsAwarded} pts)`);
          await sendTelegramMessage(chatId, `🎉 <b>Great Job!</b>\n\n✅ <s>${task.name}</s> completed\n⭐ <b>+${pointsAwarded} Points</b> earned!`);
        }
      }
      return NextResponse.json({ success: true });
    }

    // 2. Handle Messages
    if (body.message && body.message.text) {
      const msg = body.message;
      const text = msg.text.trim();
      const chatId = msg.chat.id;

      // Check for Start
      if (text.startsWith('/start')) {
        await sendTelegramMessage(chatId, "👋 <b>Welcome to HabitOS!</b>\n\nI am your personal productivity assistant, ready to track your habits and daily goals out of your dashboard.\n\n<b>Commands:</b>\n📦 <code>/tasks</code> - View your pending tasks for today\n🔗 <code>/link [PIN]</code> - Link your Telegram account\n\n<i>Tip: Just type your task directly to me, and I'll use AI to schedule it for you!</i>");
        return NextResponse.json({ success: true });
      }

      // Check for Link
      if (text.startsWith('/link')) {
        const pin = text.split(' ')[1];
        const snap = await dbAdmin.collection('users').where('linePin', '==', pin).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({ telegramChatId: String(chatId) });
          await sendTelegramMessage(chatId, "✅ <b>Account Linked Successfully!</b>\n\nYou are securely connected. Send <code>/tasks</code> to get started.");
        } else {
          await sendTelegramMessage(chatId, "❌ <b>Invalid PIN</b>\n\nPlease check your dashboard setup card for the correct security code.");
        }
        return NextResponse.json({ success: true });
      }

      // Check for Tasks
      if (text.startsWith('/tasks')) {
        const userSnap = await dbAdmin.collection('users').where('telegramChatId', '==', String(chatId)).get();
        if (userSnap.empty) {
          await sendTelegramMessage(chatId, "⚠️ <b>Account Not Linked</b>\n\nPlease link your account first using the <code>/link [PIN]</code> command.");
          return NextResponse.json({ success: true });
        }
        
        const userId = userSnap.docs[0].id;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const dayOfWeek = new Date().getDay();

        const [tasksSnap, logsSnap] = await Promise.all([
          dbAdmin.collection('tasks').where('userId', '==', userId).get(),
          dbAdmin.collection('logs').where('userId', '==', userId).where('date', '==', todayStr).get()
        ]);

        const logMap = new Set();
        logsSnap.forEach(l => logMap.add(l.data().taskId));

        const pending = [];
        for (const tDoc of tasksSnap.docs) {
          const t = tDoc.data();
          const isToday = (t.repeatType === 'daily') || 
                          (t.repeatType === 'weekly' && t.repeatDays?.includes(dayOfWeek)) || 
                          (t.repeatType === 'once' && t.targetDate === todayStr);
          
          if (isToday && !logMap.has(tDoc.id)) {
            pending.push({ id: tDoc.id, name: t.name, type: t.itemType });
          }
        }

        if (pending.length === 0) {
          await sendTelegramMessage(chatId, "🙌 <b>You're all caught up!</b>\n\nThere are no pending tasks left for today. Enjoy the rest of your day!");
        } else {
          const buttons = pending.map(p => ([{
            text: `✅ ${p.name}`,
            callback_data: `done:${p.id}`
          }]));

          await sendTelegramMessage(chatId, "📋 <b>Today's Pending Tasks</b>\n\n<i>Tap a task below to mark it as complete and earn your points!</i>", {
            inline_keyboard: buttons
          });
        }
        return NextResponse.json({ success: true });
      }

      // AI EXTRACTOR (Self-Diagnostic Mode)
      try {
        const userSnap = await dbAdmin.collection('users').where('telegramChatId', '==', String(chatId)).get();
        if (!userSnap.empty) {
          const userDoc = userSnap.docs[0];
          const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
          
          if (!GEMINI_API_KEY) {
            await sendTelegramMessage(chatId, "⚠️ <b>Service Unavailable</b>\n\nThe AI ecosystem configuration is missing. Natural entries are currently disabled.");
            return NextResponse.json({ success: true });
          }

          const prompt = `You are an AI task extractor. Extract the following task/event from the user's message: "${text}". 
Current date is ${format(new Date(), 'yyyy-MM-dd')}. 
IMPORTANT: Your response MUST be a valid JSON object only.

Schema:
{
  "itemType": "task" | "event",
  "name": "string",
  "description": "string", 
  "points": number,
  "priority": "high" | "medium" | "low",
  "required": boolean,
  "repeatType": "daily" | "weekly" | "once",
  "repeatDays": number[] (0-6 Sun-Sat, only if weekly),
  "targetDate": "YYYY-MM-DD" (only if once)
}`;
          
          // Using Gemini Flash Latest
          const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
          
          const aiRes = await fetch(aiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                responseMimeType: "application/json"
              }
            })
          });
          
          const resJson = await aiRes.json();
          
          if (resJson.error) {
              await sendTelegramMessage(chatId, `⚠️ <b>AI Processing Error</b>\n\n<i>${resJson.error.message}</i>`);
              return NextResponse.json({ success: true });
          }

          const textContent = extractGeminiText(resJson);
          
          if (!textContent) {
              const debugResp = JSON.stringify(resJson.candidates).substring(0, 300);
              await sendTelegramMessage(chatId, `⚠️ <b>Extraction Failed</b>\n\nUnable to extract precise task details from your message.`);
              return NextResponse.json({ success: true });
          }

          
          const config = JSON.parse(textContent.trim());

          if (!config || !config.name) throw new Error('AI failed to extract task name.');

          const taskRef = dbAdmin.collection('tasks').doc();
          await taskRef.set({
            ...config,
            id: taskRef.id,
            userId: userDoc.id,
            createdAt: Date.now()
          });
          await sendTelegramMessage(chatId, `✨ <b>Task Automatically Scheduled</b>\n\n📌 <b>Task:</b> ${config.name}\n\n<i>Your daily queue has been updated.</i>`);
        } else {
           await sendTelegramMessage(chatId, "⚠️ <b>Account Not Linked</b>\n\nPlease securely link your account using <code>/link [PIN]</code> before sending natural language tasks.");
        }
      } catch (e: any) {
        console.error('[Telegram AI Parsing Error]:', e);
        await sendTelegramMessage(chatId, `⚠️ <b>Extraction Disrupted</b>\n\nCould not process your request accurately. Please try rephrasing your task.\n\n<i>Error Context: ${e.message}</i>`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
