'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { getUserTasks, logDailyTask } from '@/lib/firebase/firestore';
import { Task, LogStatus } from '@/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { doc, onSnapshot, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logsToday, setLogsToday] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTotalPoints(data.totalPoints || 0);
        setStreak(data.streakCount || 0);
      }
    });

    const loadData = async () => {
      try {
        const userTasks = await getUserTasks(user.uid);
        const qLogs = query(
          collection(db, 'logs'),
          where('userId', '==', user.uid),
          where('date', '==', todayStr)
        );
        const logSnaps = await getDocs(qLogs);
        const loggedTaskIds = new Set<string>();
        logSnaps.forEach((s) => loggedTaskIds.add(s.data().taskId));
        setTasks(userTasks);
        setLogsToday(loggedTaskIds);
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    return () => unsubscribeUser();
  }, [user]);

  const handleAction = async (taskId: string, taskName: string, status: LogStatus, points: number) => {
    if (!user) return;
    setActionLoading(taskId);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await logDailyTask(user.uid, taskId, taskName, status, points, todayStr);
      setLogsToday((prev) => new Set(prev).add(taskId));
      if (status === 'done')    toast.success(`+${points} pts — nice work!`);
      else if (status === 'missed') toast.error(`-${Math.floor(points / 2)} pts`);
      else toast(`Task skipped.`);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const currentDay = new Date().getDay();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const tasksForToday = tasks.filter(
    (t) => 
      t.repeatType === 'daily' || 
      (t.repeatType === 'weekly' && t.repeatDays?.includes(currentDay)) ||
      (t.repeatType === 'once' && t.targetDate === todayStr)
  );

  const pendingTasks = tasksForToday.filter(
    (t) => !logsToday.has(t.id)
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ── Stats ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Points */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)',
            }}
          >
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Total Points
            </p>
            <p className="text-4xl font-bold mt-1 text-white tracking-tight">{totalPoints}</p>
          </div>

          {/* Streak */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Streak
            </p>
            <p className="text-4xl font-bold mt-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {streak} <span className="text-2xl">🔥</span>
            </p>
          </div>
        </div>

        {/* ── Tasks ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Today&apos;s Tasks
            </h2>
            <Button
              onClick={() => router.push('/tasks/new')}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <Plus style={{ width: 15, height: 15 }} />
              New Task
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div
                className="w-8 h-8 rounded-full border-[3px] animate-spin"
                style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
              />
            </div>
          ) : pendingTasks.length > 0 ? (
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onAction={handleAction}
                  isLoading={actionLoading === task.id}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '2px dashed var(--border-strong)',
              }}
            >
              <div className="text-4xl mb-3">{tasksForToday.length === 0 && tasks.length > 0 ? '☕' : '🎉'}</div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {tasksForToday.length === 0 && tasks.length > 0 ? 'Rest day!' : 'All done for today!'}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {tasksForToday.length === 0 && tasks.length > 0 ? 'No tasks scheduled for today.' : 'No more pending tasks.'}
              </p>
              {tasks.length === 0 && (
                <Button onClick={() => router.push('/tasks/new')} className="mt-6">
                  Create Your First Task
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
