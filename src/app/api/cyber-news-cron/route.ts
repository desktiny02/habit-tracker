import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format } from 'date-fns';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    }),
  });
}

export async function GET(req: Request) {
  // 1. Verify Authorization (optional but recommended)
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. Fetch Latest Cybersecurity News via Gemini 2.5 Flash (Stable)
    const prompt = `Act as a Cybersecurity Expert. Find 3-5 major cybersecurity news stories from the last 24 hours (today is ${format(new Date(), 'yyyy-MM-dd')}). 
Provide a concise, user-friendly summary of each, including the potential impact.
Format the output as a beautiful HTML-formatted message for Telegram. 
Include emojis and bold titles.`;

    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        tools: [{
          googleSearchRetrieval: {} // Enable Google Search grounding
        }]
      })
    });

    const resJson = await aiRes.json();
    
    if (resJson.error) {
      console.error('[Cyber News] Gemini Error:', resJson.error);
      return NextResponse.json({ error: resJson.error.message }, { status: 500 });
    }

    const newsContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!newsContent) {
      return NextResponse.json({ error: 'No news content generated' }, { status: 500 });
    }

    // 3. Send to all linked Telegram users
    const usersSnap = await dbAdmin.collection('users').where('telegramChatId', '!=', '').get();
    const sendTasks = usersSnap.docs.map(async (doc) => {
      const userData = doc.data();
      if (userData.telegramChatId) {
        return sendTelegramMessage(userData.telegramChatId, `🛡️ <b>Daily Cybersecurity Digest</b>\n\n${newsContent}`);
      }
    });

    await Promise.all(sendTasks);

    return NextResponse.json({ success: true, message: 'Cybersecurity news sent to all users.' });
  } catch (err: any) {
    console.error('[Cyber News Cron Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
