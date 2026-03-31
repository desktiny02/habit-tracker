'use client';

import AppLayout from '@/components/layout/AppLayout';
import {
  CheckCircle, Calendar, Gift, Clock, History, BarChart3,
  Zap, Star, Bell, RotateCcw, Flame, LogIn, Ticket, HelpCircle,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';

// ── Section data ────────────────────────────────────────────────
const sections = [
  {
    icon: CheckCircle,
    title: 'Tasks',
    color: 'var(--success)',
    badge: 'Core',
    items: [
      'Habits or chores you track on a Daily, Weekly, or Specific Date schedule.',
      'Each task has a Point Value — earn those points every time you mark it done.',
      'Priority (High / Medium / Low) controls how many points you lose if you miss it.',
      '"Required" tasks carry an extra 50 % penalty on top of the normal deduction.',
      'You can mark a task Done ✓ or explicitly Missed ✗ right from the Dashboard.',
      'Edit or delete any task at any time from the Dashboard card or Upcoming page.',
    ],
  },
  {
    icon: Calendar,
    title: 'Events',
    color: 'var(--accent)',
    badge: 'Core',
    items: [
      'Calendar notes or one-off appointments for a specific date.',
      'Events appear on the Dashboard only on their scheduled day.',
      'No points are earned or deducted — they are purely informational.',
      'Mark them Done or leave them as a reminder. No penalty either way.',
    ],
  },
  {
    icon: Zap,
    title: 'How Points Work',
    color: '#f59e0b',
    badge: 'Points',
    items: [
      'Complete a Task → earn its full point value immediately.',
      'Miss a Task → lose a portion based on priority (High loses more than Low).',
      '"Required" tasks incur an extra 50 % on top of the base penalty if missed.',
      'Events never affect your points balance — only tasks do.',
      'All point changes are reflected on the Dashboard stats card in real time.',
    ],
  },
  {
    icon: Flame,
    title: 'Daily Login Bonus',
    color: '#f97316',
    badge: 'Bonus',
    items: [
      'Simply open the app each day to claim a free login bonus.',
      'The bonus is awarded automatically on your first visit of the day.',
      'It builds a small cushion of points to reward consistent app use.',
      'You will see a toast notification with the bonus amount when it is claimed.',
    ],
  },
  {
    icon: RotateCcw,
    title: 'Undo a Log',
    color: 'var(--text-secondary)',
    badge: 'Dashboard',
    items: [
      'Accidentally marked something done or missed? You can reverse it.',
      'On the Dashboard, logged items appear in the "Logged Today" section.',
      'Tap the rotate icon ↩ next to any log entry to trigger the Undo flow.',
      'A confirm step pops up — tap Undo again to reverse the action and restore your points.',
      'Undo is available the same day only.',
    ],
  },
  {
    icon: Gift,
    title: 'Rewards',
    color: '#ec4899',
    badge: 'Rewards',
    items: [
      'Create custom real-world rewards with a name, description and a point cost.',
      'Spend your earned points to redeem a reward. Your balance deducts instantly.',
      'A redeemed reward becomes a Coupon held in your wallet.',
      'When you actually enjoy the reward, tap "Use Coupon" — it is then marked as consumed.',
    ],
  },
  {
    icon: Ticket,
    title: 'Coupons',
    color: '#a855f7',
    badge: 'Rewards',
    items: [
      'Coupons are redeemed-but-not-yet-used rewards sitting in your Rewards wallet.',
      'They track how many times you have redeemed the same reward.',
      'Use the "Use Coupon" button when you actually claim the real-world reward.',
      'Used coupons stay in history so you can track your lifetime redemptions.',
    ],
  },
  {
    icon: Clock,
    title: 'Upcoming',
    color: '#38bdf8',
    badge: 'Planning',
    items: [
      'See every future task, event, and recurring item in a single timeline view.',
      'Items are grouped and labelled by schedule type: Daily, Weekly, or Specific Date.',
      'Upcoming also lists one-off events sorted by target date.',
      'Need to cancel a habit? Delete it here — it will stop appearing on your Dashboard.',
    ],
  },
  {
    icon: History,
    title: 'History',
    color: 'var(--text-secondary)',
    badge: 'Logs',
    items: [
      'A full chronological timeline of every action you have taken.',
      'Both Task/Event logs and Reward redemptions appear here together.',
      'Entries are grouped by date, most recent first, with priority sorting inside each day.',
      'Scroll down and tap "Load More" to reveal older activity.',
    ],
  },
  {
    icon: BarChart3,
    title: 'Summary',
    color: '#34d399',
    badge: 'Analytics',
    items: [
      'A high-level analytics view of your performance over time.',
      'See completion rates, total points earned, and missed task counts.',
      'Useful for spotting patterns — which habits are sticking, which are not.',
    ],
  },
  {
    icon: Calendar,
    title: 'Calendar View',
    color: '#fb923c',
    badge: 'Planning',
    items: [
      'A month-grid view of every task and event scheduled on specific dates.',
      'Click any day to see what is scheduled — great for planning ahead.',
      'Colour indicators mark days that have tasks, events, or both.',
    ],
  },
  {
    icon: Bell,
    title: 'Telegram Bot',
    color: '#38bdf8',
    badge: 'Integration',
    items: [
      'Link your Telegram account to receive a daily cybersecurity digest and task alerts.',
      'On the Guide page, find your 6-digit Link PIN in the connection card.',
      'Open @MuHabitBot on Telegram and type /link followed by your PIN.',
      'Once linked, type /tasks in Telegram to see today\'s pending items and mark them done.',
      'You can also type a task description naturally — the AI will add it to your Dashboard automatically.',
      'Daily cybersecurity news digests are pushed to all linked users each morning.',
    ],
  },
];

// ── Badge colours ────────────────────────────────────────────────
const badgeColor: Record<string, string> = {
  Core:        'rgba(99,102,241,0.15)',
  Points:      'rgba(245,158,11,0.15)',
  Bonus:       'rgba(249,115,22,0.15)',
  Dashboard:   'rgba(148,163,184,0.15)',
  Rewards:     'rgba(236,72,153,0.15)',
  Planning:    'rgba(56,189,248,0.15)',
  Logs:        'rgba(148,163,184,0.15)',
  Analytics:   'rgba(52,211,153,0.15)',
  Integration: 'rgba(56,189,248,0.15)',
};
const badgeText: Record<string, string> = {
  Core:        '#818cf8',
  Points:      '#fbbf24',
  Bonus:       '#fb923c',
  Dashboard:   '#94a3b8',
  Rewards:     '#f472b6',
  Planning:    '#38bdf8',
  Logs:        '#94a3b8',
  Analytics:   '#34d399',
  Integration: '#38bdf8',
};

export default function GuidePage() {
  const { user, userData } = useAuth();
  const pinGeneratedRef = useRef(false);

  useEffect(() => {
    if (user && userData && !userData.linePin && !pinGeneratedRef.current) {
      pinGeneratedRef.current = true;
      import('firebase/firestore').then(({ doc, updateDoc }) => {
         updateDoc(doc(db, 'users', user.uid), {
            linePin: Math.random().toString().split('.')[1].slice(0, 6)
         }).catch(console.error);
      });
    }
  }, [user, userData]);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">

        {/* ── Header ─────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              <HelpCircle style={{ width: 20, height: 20, color: '#818cf8' }} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Guide &amp; Documentation
              </h1>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Everything you need to know about HabitOS — all in one place.
              </p>
            </div>
          </div>
        </div>

        {/* ── Telegram Connect Widget ─────────────────── */}
        {userData && !userData.telegramChatId && (
          <div
            className="rounded-[2rem] p-8 border overflow-hidden relative shadow-xl mb-10"
            style={{
              background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(99,102,241,0.08) 100%)',
              borderColor: 'rgba(56,189,248,0.2)',
            }}
          >
            {/* Decorative glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -mt-10 -mr-10 pointer-events-none"
              style={{ background: 'rgba(56,189,248,0.08)' }} />

            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" className="w-7 h-7">
                  <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Connect Telegram Bot
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Get daily reminders, mark tasks done from chat, and receive the morning cybersecurity digest.
                </p>
              </div>
              <div
                className="flex flex-col items-center px-6 py-4 rounded-2xl shrink-0"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-strong)' }}
              >
                <span className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Link PIN</span>
                <span className="text-3xl font-mono font-black tracking-tighter" style={{ color: 'var(--accent)' }}>
                  {userData.linePin || '------'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium relative z-10">
              {[
                `1. Open @MuHabitBot on Telegram`,
                `2. Type /link ${userData.linePin || 'YOUR_PIN'}`,
                `3. Done! 🚀`,
              ].map((s, i) => (
                <span key={i} className="px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {i === 0 ? <><a href="https://t.me/MuHabitBot" target="_blank" className="text-sky-400 hover:underline">@MuHabitBot</a> on Telegram</> : s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Already connected badge */}
        {userData?.telegramChatId && (
          <div
            className="flex items-center gap-3 rounded-2xl p-4 mb-10"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <p className="text-sm font-medium" style={{ color: '#34d399' }}>
              Telegram is connected — you are all set for notifications and bot commands.
            </p>
          </div>
        )}

        {/* ── Feature Grid ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-3xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              {/* Card header */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${section.color}18` }}
                  >
                    <section.icon style={{ width: 20, height: 20, color: section.color }} />
                  </div>
                  <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {section.title}
                  </h2>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0"
                  style={{
                    background: badgeColor[section.badge] || 'rgba(99,102,241,0.15)',
                    color: badgeText[section.badge] || '#818cf8',
                  }}
                >
                  {section.badge}
                </span>
              </div>

              {/* Items */}
              <ul className="space-y-2.5 pl-1">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]"
                      style={{ backgroundColor: section.color }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Footer note ─────────────────────────────── */}
        <p className="text-xs text-center mt-10 pb-4" style={{ color: 'var(--text-muted)' }}>
          HabitOS · Build better habits, one day at a time.
        </p>

      </div>
    </AppLayout>
  );
}
