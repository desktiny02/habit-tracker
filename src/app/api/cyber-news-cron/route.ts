import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase/admin';
import { format } from 'date-fns';
import { extractGeminiText } from '@/lib/utils';


const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, error: 'No Token' };

  // Split text into chunks of max 4000 characters
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
      let splitIndex = remaining.lastIndexOf('\n\n', maxChars);
      if (splitIndex === -1) splitIndex = maxChars;
      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trim();
    }
  }

  let finalRes: { ok: boolean; error?: any } = { ok: true };

  for (let i = 0; i < chunks.length; i++) {
    const chunkPrefix = chunks.length > 1 ? `[Part ${i+1}/${chunks.length}]\n` : '';
    const chunkText = chunkPrefix + chunks[i];

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
    // 2. Fetch Latest Cybersecurity News via Gemini 2.0 Flash (Expert Intelligence Educator)
    const prompt = `Act as a Lead Cybersecurity Architect and Incident Response Expert teaching a masterclass.
    
SEARCH the internet for the most BREAKING, high-impact or critical cybersecurity events from the last 12-24 hours. Today is ${format(new Date(), 'eeee, MMMM do, yyyy')}.

Requirements:
- News MUST be focused on CRITICAL, LIVE threats or major IT breakthroughs from today.
- Skip basics (e.g. don't explain what a Phishing attack is).
- Focus on technical specifics: Zero-day mechanics, CVE deep-dives, or architectural vulnerabilities.

For EACH story:
1. 🔴/🟠 <b>Headline (Hyperlinked Source)</b>: <a href="URL"><b>Headline</b></a>
2. <b>The Exploit Architecture:</b> Explain the technical "How" at an expert level. Focus on the attack vector or the engineering flaw.
3. <code>[Expert Learning Nugget]</code>: Teach a specialized technical concept related to this threat (e.g. the specifics of buffer overflow in this library, a new mitigation technique, or a niche protocol trick).

CRITICAL: Use LIVE search data only. Speak like an expert to an expert.
ONLY USE THESE TAGS: <b>, <i>, <code>, <pre>, <a>.`;


    const aiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`;
    
    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        tools: [{ google_search: {} }]
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
          const result = await sendTelegramMessage(chatId, `📰 <b>Morning Tech & Cyber Digest</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n${newsContent}\n\n<i>Powered by HabitOS Intelligence</i>`);
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
    console.error('[Cyber News Cron Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
