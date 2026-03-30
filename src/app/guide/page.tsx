'use client';

import AppLayout from '@/components/layout/AppLayout';
import { CheckCircle, Calendar, Gift, Clock, History, BarChart3, Zap, AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';

const sections = [
  {
    icon: CheckCircle,
    title: 'What is a Task?',
    color: 'var(--success)',
    items: [
      'A habit or chore you track daily, weekly, or on a specific date.',
      'Earn points every time you complete them.',
      'Priorities (High/Medium/Low) determine the penalty size if missed.',
      'Required tasks have an extra penalty if you miss them.',
    ],
  },
  {
    icon: Calendar,
    title: 'What is an Event?',
    color: 'var(--accent)',
    items: [
      'A calendar note or appointment for a specific day.',
      'Events do NOT give or deduct any points.',
      'They appear on your Dashboard only on their scheduled date.',
      'No penalties. Mark them done or leave them as reminders.',
    ],
  },
  {
    icon: Zap,
    title: 'How Points Work',
    color: '#f59e0b',
    items: [
      'Complete Task = Earn its full point value.',
      'Missed Task = Lose a portion of points (High priority loses more).',
      'Required Missed = Extra 50% penalty on top.',
      'Undo = You can undo a completed task on the same day to revert points.',
    ],
  },
  {
    icon: Gift,
    title: 'How Rewards Work',
    color: '#ec4899',
    items: [
      'Create custom rewards with a point cost.',
      'Spend your points to redeem these rewards.',
      'Redeemed rewards turn into usable Coupons.',
      'Use the coupon whenever you actually claim the reward.',
    ],
  },
  {
    icon: Clock,
    title: 'What is Upcoming Page',
    color: 'var(--accent)',
    items: [
      'See all your future tasks, events, and recurring items in one place.',
      'Items are grouped neatly by schedule (Daily, Weekly, Specific Dates).',
      'Need to cancel a habit? Delete it here to stop it from appearing.',
    ],
  },
  {
    icon: History,
    title: 'How History Works',
    color: 'var(--text-secondary)',
    items: [
      'A timeline of your past actions (Logs and Redemptions).',
      'Grouped clearly by date, starting with the most recent.',
      'Items inside each day are sorted by Priority automatically.',
      'Scroll down and click "Load More" to see older activities.',
    ],
  },
];

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
        <h1 className="text-3xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
           Guide & Documentation
        </h1>
        <p className="text-sm font-medium mb-10" style={{ color: 'var(--text-muted)' }}>
           Quick, simple answers on how to get the most out of your tracker.
        </p>

        {/* Bot Integration Widget */}
        {userData && (
          <div className="space-y-6 mb-10">
            {/* Telegram ── */}
            {!userData.telegramChatId && (
              <div 
                className="rounded-[2rem] p-8 border border-[var(--border)] overflow-hidden relative shadow-xl"
                style={{ 
                  backgroundColor: 'var(--bg-surface)',
                  background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-raised) 100%)'
                }}
              >
                <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500 shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8">
                      <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      Connect your Telegram Bot
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Get unlimited free reminders and check off tasks directly from your chat!
                    </p>
                  </div>
                  <div className="flex flex-col items-center p-4 px-6 rounded-2xl bg-[var(--bg-base)] border border-[var(--border-strong)] shadow-inner">
                    <span className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-50">Your Link PIN</span>
                    <span className="text-3xl font-mono font-black tracking-tighter text-[var(--accent)]">
                      {userData.linePin || '------'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium relative z-10">
                  <span className="px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
                    1. Chat with <a href="https://t.me/MuHabitBot" target="_blank" className="text-sky-500 hover:underline">@MuHabitBot</a>
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
                    2. Type <code>/link {userData.linePin}</code>
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border)]">
                    3. Done! 🚀
                  </span>
                </div>
              </div>
            )}

          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-3xl p-6 transition-transform hover:-translate-y-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${section.color}18` }}
                >
                  <section.icon style={{ width: 20, height: 20, color: section.color }} />
                </div>
                <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {section.title}
                </h2>
              </div>
              <ul className="space-y-3 pl-1">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
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
      </div>
    </AppLayout>
  );
}
