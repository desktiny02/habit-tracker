'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState, useMemo } from 'react';
import { getDocs, collection, query, where, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DailyLog, UserData } from '@/types';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

interface WeekStats {
  totalDone: number;
  totalMissed: number;
  totalScheduled: number;
  pointsEarned: number;
  pointsLost: number;
  completionRate: number;
}

export default function SummaryPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), []);
  const weekEnd = useMemo(() => format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), []);

  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data() as UserData;
        setTotalPoints(d.totalPoints || 0);
      }
    });

    const loadWeek = async () => {
      try {
        const q = query(
          collection(db, 'logs'),
          where('userId', '==', user.uid),
          where('date', '>=', weekStart),
          where('date', '<=', weekEnd)
        );
        const snaps = await getDocs(q);
        const logs = snaps.docs.map(d => d.data() as DailyLog);

        let totalDone = 0, totalMissed = 0;
        let pointsEarned = 0, pointsLost = 0;

        for (const log of logs) {
          if (log.itemType === 'event') continue; // exclude events from task breakdown
          
          if (log.status === 'done') { totalDone++; pointsEarned += log.pointsAwarded; }
          else if (log.status === 'missed') { totalMissed++; pointsLost += Math.abs(log.pointsAwarded); }
        }

        const totalScheduled = totalDone + totalMissed;
        const completionRate = totalScheduled > 0 ? Math.round((totalDone / totalScheduled) * 100) : 0;

        setStats({ totalDone, totalMissed, totalScheduled, pointsEarned, pointsLost, completionRate });
      } catch {
        // Silent fail — page still renders
      } finally {
        setLoading(false);
      }
    };
    loadWeek();

    return () => unsubUser();
  }, [user, weekStart, weekEnd]);

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Weekly Summary</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        {weekStart} — {weekEnd}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-[3px] animate-spin"
            style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Completion Rate */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Completion Rate</h2>
            <div className="flex items-end gap-4">
              <p
                className="text-6xl font-bold tracking-tight"
                style={{
                  color: stats.completionRate >= 80 ? 'var(--success)' : stats.completionRate >= 50 ? 'var(--warning)' : 'var(--danger)',
                }}
              >
                {stats.completionRate}%
              </p>
              <p className="text-sm pb-2" style={{ color: 'var(--text-muted)' }}>
                {stats.totalDone} of {stats.totalScheduled} tasks
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full h-3 rounded-full mt-4" style={{ backgroundColor: 'var(--bg-raised)' }}>
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${stats.completionRate}%`,
                  background: stats.completionRate >= 80
                    ? 'linear-gradient(90deg, var(--success), #10b981)'
                    : stats.completionRate >= 50
                    ? 'linear-gradient(90deg, var(--warning), #f59e0b)'
                    : 'linear-gradient(90deg, var(--danger), #ef4444)',
                }}
              />
            </div>
          </div>

          {/* Points breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Points Earned</p>
              <p className="text-3xl font-bold mt-1" style={{ color: 'var(--success)' }}>
                +{stats.pointsEarned}
              </p>
            </div>
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Points Lost</p>
              <p className="text-3xl font-bold mt-1" style={{ color: 'var(--danger)' }}>
                −{stats.pointsLost}
              </p>
            </div>
          </div>

          {/* Task breakdown */}
          <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>Task Breakdown</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold" style={{ color: 'var(--success)' }}>{stats.totalDone}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Done</p>
              </div>
              <div>
                <p className="text-3xl font-bold" style={{ color: 'var(--danger)' }}>{stats.totalMissed}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Missed</p>
              </div>
            </div>
          </div>

          {/* Points Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Points</p>
              <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                {totalPoints} 🌟
              </p>
            </div>
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Net Points</p>
              <p className="text-3xl font-bold mt-1" style={{
                color: stats.pointsEarned - stats.pointsLost >= 0 ? 'var(--success)' : 'var(--danger)'
              }}>
                {stats.pointsEarned - stats.pointsLost >= 0 ? '+' : ''}{stats.pointsEarned - stats.pointsLost}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '2px dashed var(--border-strong)' }}>
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>No data yet</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Complete some tasks to see your weekly summary.</p>
        </div>
      )}
    </AppLayout>
  );
}
