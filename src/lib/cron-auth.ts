import { NextResponse } from 'next/server';

/**
 * Shared utility to secure Vercel Cron API routes.
 * 
 * Requirements:
 * 1. Must be a POST request.
 * 2. Must have "Authorization: Bearer <CRON_SECRET>" header.
 */
export async function validateCronAuth(req: Request) {
  // 1. Method Restriction
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method Not Allowed. Use POST.' }, 
      { status: 405, headers: { 'Allow': 'POST' } }
    );
  }

  // 2. Token Validation
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Auth Error] CRON_SECRET is missing in environment variables.');
    return NextResponse.json(
      { error: 'Unauthorized - Auth Misconfigured' }, 
      { status: 401 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Auth Warning] Unauthorized cron trigger attempt blocked.');
    return NextResponse.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    );
  }

  return null; // Success, proceed to route logic
}
