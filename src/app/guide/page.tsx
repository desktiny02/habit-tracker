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

        {/* LINE Integration Widget */}
        {userData && !userData.lineUserId && (
          <div className="rounded-3xl p-6 shadow-md mb-8 relative overflow-hidden transition-all duration-300 border border-transparent"
             style={{
               backgroundColor: 'var(--bg-surface)',
               border: '1px solid var(--border-strong)'
             }}
          >
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                   <h3 className="text-lg font-extrabold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                      Connect LINE Bot 🤖
                   </h3>
                   <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      Text <span className="font-bold text-emerald-400 px-1.5 py-0.5 bg-raised rounded">Link {userData.linePin || '...'}</span> directly to your LINE Official Account to enable natural AI logging!
                   </p>
                </div>
                <div className="shrink-0">
                   <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-4 py-2.5 rounded-xl text-white font-bold text-sm text-center shadow-lg shadow-green-500/20">
                      Waiting for linking...
                   </div>
                </div>
             </div>
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
