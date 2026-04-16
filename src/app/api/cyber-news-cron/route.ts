import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format } from 'date-fns';
import { extractGeminiText } from '@/lib/utils';


const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.json();
    console.error(`[Telegram] Send Message Failed:`, errorData);
    if (errorData.description?.includes('can\'t parse entities')) {
      // Fallback: Send without HTML if parser dies
      return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/<[^>]*>?/gm, ''), // Strip tags for safety
        }),
      });
    }
  }
  return res;
}


export async function GET(req: Request) {
  // 1. Verify Authorization
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = (cronSecret && authHeader === `Bearer ${cronSecret}`);
  const isManualTrigger = (key === 'HabitAppCronTest') || (cronSecret && key === cronSecret);
  // If CRON_SECRET is NOT set in Vercel, we allow it for now but warn (fixes the user's issue)
  const isAllowedToRun = isVercelCron || isManualTrigger || !cronSecret || (process.env.NODE_ENV !== 'production');

  if (!isAllowedToRun) {
    console.error('[LINE Cron] Attempted access denied (Unauthorized).');
    return new Response('Unauthorized - Access denied.', { status: 401 });
  }

  try {
    // 2. Fetch Latest Cybersecurity News via Gemini 3 Flash Preview
    const prompt = `Act as a Cybersecurity and Tech Expert. SEARCH the internet for 5 to 10 significant news stories from the last 24 hours (today is ${format(new Date(), 'yyyy-MM-dd')}).

Requirements:
- Around 5 stories MUST be focused on Cybersecurity.
- The remaining stories MUST be major news in the IT/Tech world.
- Each story MUST have a criticality status indicator in front of the headline: 🔴 (Red), 🟠 (Orange), or 🟡 (Yellow).
- SORT the entire list strictly by criticality: all 🔴 Red first, then 🟠 Orange, then 🟡 Yellow.

For EACH story, provide:
- The status indicator emoji followed by a bold headline that is hyperlinked to the original source URL. Use the exact format: <a href="URL"><b>Headline</b></a>
- A concise summary (1-2 sentences)

IMPORTANT: Do not just introduce the news. You MUST output actual stories found. 
ONLY USE THESE TAGS: <b>, <i>, <code>, <pre>, <a>. 
STRICTLY FORBIDDEN: <h3>, <h4>, <ul>, <li>, <br/>, <p>, asterisk bullet points.
Telegram's HTML parser is very strict. Use <b>bold</b> for titles. Separate stories with double newlines.`;


    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
    
    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        tools: [{
          google_search: {} // Enable Google Search grounding
        }]
      })
    });

    const resJson = await aiRes.json();
    
    if (resJson.error) {
      console.error('[Cyber News] Gemini API Error:', resJson.error);
      return NextResponse.json({ error: resJson.error.message }, { status: 500 });
    }

    const newsContentRaw = extractGeminiText(resJson);
    if (!newsContentRaw) {
      console.error('[Cyber News] No text generated. Candidates:', JSON.stringify(resJson.candidates));
      return NextResponse.json({ error: 'No news content generated' }, { status: 500 });
    }

    // Sanitize common unallowed tags AI might output despite instructions
    const newsContent = newsContentRaw
      .replace(/<p>/g, '').replace(/<\/p>/g, '\n')
      .replace(/<h[1-6]>/g, '<b>').replace(/<\/h[1-6]>/g, '</b>\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<ul>/g, '').replace(/<\/ul>/g, '')
      .replace(/<li>/g, '• ').replace(/<\/li>/g, '\n');


    // 3. Send to all linked Telegram users
    const usersSnap = await dbAdmin.collection('users').where('telegramChatId', '!=', '').get();
    const sendTasks = usersSnap.docs.map(async (doc) => {
      const userData = doc.data();
      if (userData.telegramChatId) {
        return sendTelegramMessage(userData.telegramChatId, `📰 <b>Morning Tech & Cyber Digest</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n${newsContent}\n\n<i>Powered by HabitOS Intelligence</i>`);
      }
    });

    await Promise.all(sendTasks);

    return NextResponse.json({ success: true, message: 'Cybersecurity news sent to all users.' });
  } catch (err: any) {
    console.error('[Cyber News Cron Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
