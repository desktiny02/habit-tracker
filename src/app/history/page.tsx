'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { DailyLog, Redemption } from '@/types';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

import { getTaskPriorityValue } from '@/lib/sorting';

type ActivityItem = 
  | { type: 'log'; data: DailyLog; timestamp: number; taskMeta?: { priority: string; required: boolean; name: string } }
  | { type: 'redemption'; data: Redemption; timestamp: number };

export default function HistoryPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const fetchLimit = page * 15;
        // since we combine 2 collections and sort locally, we fetch fetchLimit from both
        const qLogs = query(
          collection(db, 'logs'), 
          where('userId', '==', user.uid)
        );
        const qRedemptions = query(
          collection(db, 'redemptions'), 
          where('userId', '==', user.uid)
        );
        const qTasks = query(collection(db, 'tasks'), where('userId', '==', user.uid));
        
        const [logSnaps, redSnaps, taskSnaps] = await Promise.all([getDocs(qLogs), getDocs(qRedemptions), getDocs(qTasks)]);
        
        const tasksMap = new Map<string, any>(taskSnaps.docs.map(t => [t.id, t.data()]));

        const logs: ActivityItem[] = logSnaps.docs.map(d => {
          const data = d.data() as DailyLog;
          const task = tasksMap.get(data.taskId);
          return { 
            type: 'log', 
            data, 
            timestamp: data.createdAt || new Date(data.date).getTime(),
            taskMeta: task ? { priority: task.priority, required: task.required || false, name: task.name || '' } : undefined
          };
        });

        const redemptions: ActivityItem[] = redSnaps.docs.map(d => {
          const data = d.data() as Redemption;
          return { type: 'redemption', data, timestamp: new Date(data.date).getTime() };
        });

        const combined = [...logs, ...redemptions].sort((a, b) => b.timestamp - a.timestamp);
        
        setHasMore(combined.length > fetchLimit);
        setActivities(combined.slice(0, fetchLimit));
      } catch {
        toast.error('Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user, page]);

  const renderActivity = (item: ActivityItem) => {
    if (item.type === 'log') {
      const { status, pointsAwarded, taskName, itemType } = item.data;
      const isEvent = itemType === 'event';
      const isPositive = status === 'done';
      const isMissed = status === 'missed';
      
      let badgeColor = 'var(--text-muted)';
      let badgeText = isEvent ? 'Event Skipped' : 'Task Skipped';
      let pointsText = '0 pts';
      let pointsColor = 'var(--text-muted)';
      
      if (isPositive) {
        badgeColor = 'var(--success)';
        badgeText = isEvent ? 'Event Done' : 'Task Done';
        pointsText = `+${pointsAwarded} pts`;
        pointsColor = 'var(--success)';
      } else if (isMissed) {
        badgeColor = 'var(--danger)';
        badgeText = isEvent ? 'Event Missed' : 'Task Missed';
        pointsText = `${pointsAwarded} pts`;
        pointsColor = 'var(--danger)';
      }

      if (isEvent) {
        pointsText = '';
      }

      return (
        <div key={`${item.type}-${item.data.id}`} className="flex items-center justify-between p-4 rounded-xl border mb-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}>
                {badgeText}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {taskName || 'Legacy Task'}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {format(item.timestamp, 'MMM d, yyyy h:mm a')}
            </p>
          </div>
          {!isEvent && (
            <div className="font-bold whitespace-nowrap" style={{ color: pointsColor }}>
              {pointsText}
            </div>
          )}
        </div>
      );
    } else {
      const { rewardName, pointsSpent, status } = item.data;
      const isUsed = status === 'used';

      return (
        <div key={`${item.type}-${item.data.id}`} className="flex items-center justify-between p-4 rounded-xl border mb-3" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
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
              {format(item.timestamp, 'MMM d, yyyy h:mm a')}
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

        {loading && activities.length === 0 ? (
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
          <div className="space-y-6">
            {(() => {
              const grouped = activities.reduce((acc, item) => {
                const dateKey = format(item.timestamp, 'yyyy-MM-dd');
                if (!acc[dateKey]) acc[dateKey] = [];
                acc[dateKey].push(item);
                return acc;
              }, {} as Record<string, ActivityItem[]>);

              const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); 

              return sortedKeys.map(k => {
                grouped[k].sort((a, b) => {
                  const getPriority = (i: ActivityItem) => i.type === 'log' ? getTaskPriorityValue(i.taskMeta?.priority) : 4; 
                  const pA = getPriority(a);
                  const pB = getPriority(b);
                  if (pA !== pB) return pB - pA;
                  
                  const getReq = (i: ActivityItem) => i.type === 'log' ? (i.taskMeta?.required ? 1 : 0) : 0;
                  const rA = getReq(a);
                  const rB = getReq(b);
                  if (rA !== rB) return rB - rA;

                  const getName = (i: ActivityItem) => i.type === 'log' ? (i.taskMeta?.name || i.data.taskName || '') : (i.data.rewardName || '');
                  return getName(a).localeCompare(getName(b));
                });

                return (
                  <div key={k} className="space-y-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider mb-2 mt-2" style={{ color: 'var(--text-secondary)' }}>
                      {format(new Date(k + 'T12:00:00'), 'EEEE, MMMM d')}
                    </h2>
                    {grouped[k].map((item) => renderActivity(item))}
                  </div>
                );
              });
            })()}
            {hasMore ? (
              <div className="flex justify-center mt-6">
                <Button 
                  onClick={() => setPage(p => p + 1)} 
                  variant="secondary"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            ) : (
               <div className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                 No more activities.
               </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
