'use client';

import AppLayout from '@/components/layout/AppLayout';
import { CheckCircle, Calendar, Gift, Clock, History, BarChart3, Zap, AlertTriangle } from 'lucide-react';

const sections = [
  {
    icon: CheckCircle,
    title: 'Tasks',
    color: 'var(--success)',
    items: [
      'Tasks are daily habits you want to build or track.',
      'Each task awards points when completed.',
      'You can set priority (High / Medium / Low) — higher priority means a bigger penalty if you miss it.',
      'Required tasks carry an extra 50% penalty when missed.',
      'Tasks can repeat daily, on specific weekdays, or be one-time.',
    ],
  },
  {
    icon: Calendar,
    title: 'Events',
    color: 'var(--accent)',
    items: [
      'Events are calendar-style notes for a specific date.',
      'They do NOT give or deduct points.',
      'Mark them done ✓ or not done ✗ for your own tracking.',
      'Events appear only on their scheduled date.',
    ],
  },
  {
    icon: Zap,
    title: 'Points',
    color: '#f59e0b',
    items: [
      'Completing a task earns you its point value.',
      'Missing a task deducts points based on priority.',
      'Events never affect your point balance.',
      'Your total points are shown on the Dashboard.',
    ],
  },
  {
    icon: Gift,
    title: 'Rewards',
    color: '#ec4899',
    items: [
      'Create custom rewards with a point cost.',
      'Redeem rewards when you have enough points.',
      'Redeemed rewards become coupons you can use later.',
      'Each coupon can be used once — confirm before using.',
    ],
  },
  {
    icon: Clock,
    title: 'Upcoming',
    color: 'var(--accent)',
    items: [
      'Shows all your future tasks, events, and recurring items.',
      'Delete items here to remove them from all views.',
      'Deleting a recurring task stops it from appearing.',
    ],
  },
  {
    icon: History,
    title: 'History',
    color: 'var(--text-secondary)',
    items: [
      'Shows your 15 most recent activities.',
      'Includes task completions, missed tasks, and reward redemptions.',
      'Click "Load More" to see older activity.',
    ],
  },
  {
    icon: BarChart3,
    title: 'Weekly Summary',
    color: 'var(--success)',
    items: [
      'Shows your completion rate for the current week.',
      'Tracks points earned vs points lost.',
      'Helps you see how consistent you are.',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Missed Tasks',
    color: 'var(--danger)',
    items: [
      'If you don\'t complete a task by end of day, it auto-marks as missed.',
      'Penalty depends on priority: High = 100%, Medium = 50%, Low = 30% of the task\'s points.',
      'Required tasks get an additional 50% penalty on top.',
      'Events are never auto-missed.',
    ],
  },
];

export default function GuidePage() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          How It Works
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Everything you need to know about using Habit Tracker.
        </p>

        <div className="space-y-5">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-2xl p-5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${section.color}18` }}
                >
                  <section.icon style={{ width: 18, height: 18, color: section.color }} />
                </div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {section.title}
                </h2>
              </div>
              <ul className="space-y-2.5 pl-1">
                {section.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
