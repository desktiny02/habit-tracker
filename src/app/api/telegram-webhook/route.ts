import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format } from 'date-fns';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
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
    
    // 1. Handle Callback Queries (Button Clicks)
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data; // e.g. "done:TASK_ID"

      if (data.startsWith('done:')) {
        const taskId = data.split(':')[1];
        const userSnap = await dbAdmin.collection('users').where('telegramChatId', '==', String(chatId)).get();
        
        if (userSnap.empty) {
          await answerCallbackQuery(cb.id, "Account not linked!");
          return NextResponse.json({ success: true });
        }

        const userDoc = userSnap.docs[0];
        const userId = userDoc.id;
        const taskSnap = await dbAdmin.collection('tasks').doc(taskId).get();
        const task = taskSnap.data();
        if (!taskSnap.exists || !task) {
          await answerCallbackQuery(cb.id, "Task not found!");
          return NextResponse.json({ success: true });
        }
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const logId = `${userId}_${taskId}_${todayStr}`;
        const logRef = dbAdmin.collection('logs').doc(logId);
        const logSnap = await logRef.get();

        if (logSnap.exists) {
          await answerCallbackQuery(cb.id, "Already completed today!");
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

          await answerCallbackQuery(cb.id, `✅ "${task.name}" completed! +${pointsAwarded} pts`);
          await sendTelegramMessage(chatId, `🎉 <b>Great job!</b> You completed <b>${task.name}</b> and earned <b>${pointsAwarded}</b> points!`);
        }
      }
      return NextResponse.json({ success: true });
    }

    // 2. Handle Messages
    if (body.message && body.message.text) {
      const msg = body.message;
      const text = msg.text.trim();
      const chatId = msg.chat.id;

      // START
      if (text.startsWith('/start')) {
        await sendTelegramMessage(chatId, "👋 <b>Welcome to Habit Tracker!</b>\n\nI can help you track your habits directly from Telegram.\n\nCommands:\n/tasks - See today's tasks\n/status - Check your progress\n/link [PIN] - Link your account");
        return NextResponse.json({ success: true });
      }

      // LINK
      if (text.startsWith('/link')) {
        const pin = text.split(' ')[1];
        if (!pin) {
          await sendTelegramMessage(chatId, "❌ Please provide a PIN from your dashboard. Example: <code>/link 123456</code>");
          return NextResponse.json({ success: true });
        }
        const snap = await dbAdmin.collection('users').where('linePin', '==', pin).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({ telegramChatId: String(chatId) });
          await sendTelegramMessage(chatId, "✅ <b>Success!</b> Your Telegram is now linked to your Habit Tracker account.");
        } else {
          await sendTelegramMessage(chatId, "❌ <b>Invalid PIN.</b> Please check the top of your dashboard for the correct 6-digit code.");
        }
        return NextResponse.json({ success: true });
      }

      // TASKS
      if (text.startsWith('/tasks')) {
        const userSnap = await dbAdmin.collection('users').where('telegramChatId', '==', String(chatId)).get();
        if (userSnap.empty) {
          await sendTelegramMessage(chatId, "⚠️ <b>Not Linked.</b> Please use <code>/link PIN</code> first.");
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
          await sendTelegramMessage(chatId, "🙌 <b>All done!</b> No pending tasks for today.");
        } else {
          const buttons = pending.map(p => ([{
            text: `✅ ${p.name}`,
            callback_data: `done:${p.id}`
          }]));

          await sendTelegramMessage(chatId, "📝 <b>Today's Pending Items:</b>\nClick a button to mark as completed!", {
            inline_keyboard: buttons
          });
        }
        return NextResponse.json({ success: true });
      }

      // AI EXTRACTOR (If no command)
      try {
        const userSnap = await dbAdmin.collection('users').where('telegramChatId', '==', String(chatId)).get();
        if (!userSnap.empty) {
          const userDoc = userSnap.docs[0];
          const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
          
          const prompt = `You are an AI task extractor. Extract from: "${text}". Today is ${format(new Date(), 'yyyy-MM-dd')}. 
Return JSON: {"itemType":"task"|"event", "name":"...", "description":"...", "points":number, "priority":"high"|"medium"|"low", "required":boolean, "repeatType":"daily"|"weekly"|"once", "repeatDays":[0-6], "targetDate":"YYYY-MM-DD"}`;
          
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
          });
          const resJson = await aiRes.json();
          const textContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!textContent) throw new Error('AI returned empty response');
          
          const cleanJson = textContent.replace(/```json|```/g, '').trim();
          const config = JSON.parse(cleanJson);

          if (!config || !config.name) throw new Error('AI failed to extract task name');

          const taskRef = dbAdmin.collection('tasks').doc();
          await taskRef.set({
            ...config,
            id: taskRef.id,
            userId: userDoc.id,
            createdAt: Date.now()
          });
          await sendTelegramMessage(chatId, `✅ <b>Added:</b> "${config.name}" to your list!`);
        }
      } catch (e: any) {
        console.error('AI error:', e);
        await sendTelegramMessage(chatId, `⚠️ AI Parsing failed: ${e.message}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Telegram Webhook Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
