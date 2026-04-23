import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format } from 'date-fns';
import { extractGeminiText } from '@/lib/utils';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, error: 'No Token' };

  // Split text into chunks of max 4000 characters
  // We try to split by double newlines first to keep stories together
  const maxChars = 4000;
  const chunks: string[] = [];
  
  if (text.length <= maxChars) {
    chunks.push(text);
  } else {
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        chunks.push(remaining);
        break;
      }
      
      // Look for a nearby double newline to split cleanly
      let splitIndex = remaining.lastIndexOf('\n\n', maxChars);
      if (splitIndex === -1) splitIndex = maxChars; // Force split if no gap found
      
      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }
  }

  let finalRes: { ok: boolean; error?: any } = { ok: true };

  for (let i = 0; i < chunks.length; i++) {
    const chunkPrefix = chunks.length > 1 ? `[Part ${i+1}/${chunks.length}]\n` : '';
    const chunkText = chunkPrefix + chunks[i];

    // Try 1: HTML
    let res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunkText,
        parse_mode: 'HTML'
      }),
    });

    if (!res.ok) {
      // Try 2: Plain Text Fallback for this chunk
      const plainText = chunkText.replace(/<[^>]*>?/gm, ''); 
      res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText
        }),
      });
    }

    if (!res.ok) {
      const err = await res.json();
      finalRes = { ok: false, error: err };
    }
  }

  return finalRes;
}

import { validateCronAuth } from '@/lib/cron-auth';

export async function POST(req: Request) {
  // Verify Authorization and Method
  const authError = await validateCronAuth(req);
  if (authError) return authError;


  try {
    // 2. Analyze Financial Markets via Gemini 2.0 Flash (Expert Intelligence Educator)
    const prompt = `Act as a Senior Macro Strategist and Hedge Fund Alpha Researcher. You are teaching a masterclass to elite students.
    
SEARCH the internet for the most BREAKING, high-impact alpha events from the last 12-24 hours. Today is ${format(new Date(), 'eeee, MMMM do, yyyy')}.

Focus on:
- Global Macro shifts (Rates, Yield curves, Central Bank signals)
- Commodities (Geopolitical risk premiums, supply-chain bottlenecks)
- Advanced Crypto (On-chain signals, L2 scaling breakthroughs, Protocol upgrades)
- Regional Alpha (Specific SET Index movers with global correlation)

Requirements for each of the TOP 5 assets:
1. <b>Asset Name (TICKER)</b>
2. <b>The Narrative:</b> Explain the expert-level "Why". Do not explain fundamentals (e.g. don't explain what an ETF is). Instead, explain the second-order effects (e.g. how the ETF flow is impacting liquidity depth or arbitrage spreads).
3. <b>Expert Insight:</b> A deep technical takeaway. Teach something new—mechanics of a specific trade, a rare chart pattern appearing, or a complex macro correlation.

CRITICAL: Use LIVE search data only. Explain like a mentor to an advanced student. No fluff.

Formatting for Telegram HTML:
- Header: <code>[Expert Analysis]</code>
- Asset: <b>Asset Name (TICKER)</b>
- Divider: ━━━━━━━━━━━━━━━━━━━━━━
- Insight Section: <code>[Technical Learning Nugget]</code>
- No markdown bullets. Use newline separation only.`;

    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;
    
    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        tools: [{
          google_search: {} 
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
      .replace(/<li>/g, '• ').replace(/<\/li>/g, '\n')
      .replace(/<div[^>]*>/g, '').replace(/<\/div>/g, '\n')
      .replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '')
      .replace(/&nbsp;/g, ' ');

    // 3. Broadcast to Users
    const usersSnap = await dbAdmin.collection('users').where('telegramChatId', '!=', '').get();
    let sentCount = 0;
    let lastError: any = null;

    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      const chatId = userData.telegramChatId;
      if (chatId) {
        try {
          const result = await sendTelegramMessage(chatId, `💰 <b>Alpha Asset Intelligence</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n${financeContent}\n\n<i>Powered by HabitOS Intelligence</i>`);
          if (result.ok) {
            sentCount++;
          } else {
            lastError = result.error;
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }
    }

    return NextResponse.json({ 
      success: sentCount > 0, 
      processedUsers: usersSnap.docs.length,
      sentCount,
      lastError,
      envCheck: {
        hasToken: !!TELEGRAM_BOT_TOKEN,
        tokenLength: TELEGRAM_BOT_TOKEN.length,
        tokenPrefix: TELEGRAM_BOT_TOKEN.substring(0, 5)
      }
    });
  } catch (err: any) {
    console.error('[Finance News Cron Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
