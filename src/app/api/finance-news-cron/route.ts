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
    console.error(`[Finance News] Telegram Send Failed:`, errorData);
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
  const isAllowedToRun = isVercelCron || isManualTrigger || (process.env.NODE_ENV !== 'production') || !cronSecret;

  if (!isAllowedToRun) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // 2. Analyze Financial Markets via Gemini 3.1 Flash Lite
    const prompt = `Act as an expert Global Macro and Crypto Analyst. SEARCH the internet for the most significant financial news from the last 24 hours (today is ${format(new Date(), 'yyyy-MM-dd')}).
    
Focus specifically on:
- Commodities (Gold, Oil, Gas)
- Global Stocks (US Market, etc.)
- Thai Stocks (SET Index major movers)
- Cryptocurrency (BTC, ETH, and trending Altcoins)

Objective: Identify the TOP 5 assets that are currently "trending" due to high volume, significant price action, or major breaking narratives.

For EACH of the top 5 assets, provide:
1. Asset Name & Ticker (Bold)
2. Category (e.g., Crypto, Commodity, Tech Stock)
3. Current Sentiment (Bullish/Bearish/Neutral)
4. The "Why": A concise 2-sentence explanation of the "alpha" - why it is interesting or popular today.
5. Source/Narrative: One sentence on whether this is driven by hype, institutional news, or macro shifts (e.g., Fed rumors).

Tone: Professional, objective, alpha-focused. No generic advice.

Formatting for Telegram HTML:
- Use <b>Asset Name (TICKER)</b> for the header.
- Use <i>Italic</i> for the 'Why' section.
- Use <code>Code</code> tags for the Category/Sentiment labels.
- Separate each asset with a double newline and a divider.
- NO markdown bullet points. Use newline separation only.`;

    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;
    
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
      console.error('[Finance News] Gemini API Error:', resJson.error);
      return NextResponse.json({ error: resJson.error.message }, { status: 500 });
    }

    const financeContentRaw = extractGeminiText(resJson);
    if (!financeContentRaw) {
      return NextResponse.json({ error: 'No financial content generated' }, { status: 500 });
    }

    // Sanitize common tags for Telegram HTML
    const financeContent = financeContentRaw
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
        return sendTelegramMessage(userData.telegramChatId, `💰 <b>Alpha Asset Intelligence</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n${financeContent}\n\n<i>Powered by HabitOS Intelligence</i>`);
      }
    });

    await Promise.all(sendTasks);

    return NextResponse.json({ success: true, message: 'Financial intelligence sent to all users.' });
  } catch (err: any) {
    console.error('[Finance News Cron Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
