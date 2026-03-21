'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { DailyLog, Redemption } from '@/types';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type ActivityItem = 
  | { type: 'log'; data: DailyLog; timestamp: number }
  | { type: 'redemption'; data: Redemption; timestamp: number };

export default function HistoryPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      try {
        const qLogs = query(collection(db, 'logs'), where('userId', '==', user.uid));
        const qRedemptions = query(collection(db, 'redemptions'), where('userId', '==', user.uid));
        
        const [logSnaps, redSnaps] = await Promise.all([getDocs(qLogs), getDocs(qRedemptions)]);
        
        const logs: ActivityItem[] = logSnaps.docs.map(d => {
          const data = d.data() as DailyLog;
          // logs use YYYY-MM-DD for date, which doesn't have time.
          // To make it sortable, we can parse it, or rely on another timestamp if we had one.
          // Let's use the date string to create a timestamp.
          return { type: 'log', data, timestamp: new Date(data.date).getTime() };
        });

        const redemptions: ActivityItem[] = redSnaps.docs.map(d => {
          const data = d.data() as Redemption;
          // redemptions use ISO string `date`
          return { type: 'redemption', data, timestamp: new Date(data.date).getTime() };
        });

        const combined = [...logs, ...redemptions].sort((a, b) => b.timestamp - a.timestamp);
        setActivities(combined);
      } catch (err) {
        toast.error('Failed to load history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user]);

  const renderActivity = (item: ActivityItem) => {
    if (item.type === 'log') {
      const { status, pointsAwarded, taskName } = item.data;
      const isPositive = status === 'done';
      const isMissed = status === 'missed';
      
      let badgeColor = 'var(--text-muted)';
      let badgeText = 'Skipped';
      let pointsText = '0 pts';
      let pointsColor = 'var(--text-muted)';
      
      if (isPositive) {
        badgeColor = 'var(--success)';
        badgeText = 'Done';
        pointsText = `+${pointsAwarded} pts`;
        pointsColor = 'var(--success)';
      } else if (isMissed) {
        badgeColor = 'var(--danger)';
        badgeText = 'Missed';
        pointsText = `${pointsAwarded} pts`;
        pointsColor = 'var(--danger)';
      }

      return (
        <div className="flex items-center justify-between p-4 rounded-xl border mb-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}>
                Task {badgeText}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {taskName || 'Legacy Task'}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {format(item.timestamp, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="font-bold whitespace-nowrap" style={{ color: pointsColor }}>
            {pointsText}
          </div>
        </div>
      );
    } else {
      const { rewardName, pointsSpent, status } = item.data;
      const isUsed = status === 'used';

      return (
        <div className="flex items-center justify-between p-4 rounded-xl border mb-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                {isUsed ? 'Coupon Used' : 'Reward Redeemed'}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {rewardName || 'Legacy Reward'}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {format(item.timestamp, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="font-bold whitespace-nowrap" style={{ color: 'var(--danger)' }}>
            -{pointsSpent} pts
          </div>
        </div>
      );
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Activity History
        </h1>

        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-8 h-8 rounded-full border-[3px] animate-spin"
              style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            No activity found yet.
          </div>
        ) : (
          <div>
            {activities.map((item, idx) => (
              <div key={idx}>
                {renderActivity(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
