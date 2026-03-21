'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { getUserTasks, logDailyTask, deleteTask, autoMissPendingTasks } from '@/lib/firebase/firestore';
import { Task, LogStatus, DailyLog } from '@/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { doc, onSnapshot, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);

  // Map of taskId → DailyLog (includes status & pointsAwarded for today)
  const [todayLogs, setTodayLogs] = useState<Map<string, DailyLog>>(new Map());

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [streak, setStreak] = useState(0);

  // Stable values — computed once per mount, not per render
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const currentDay = useMemo(() => new Date().getDay(), []);

  const loadData = useCallback(async (uid: string) => {
    try {
      const userTasks = await getUserTasks(uid);

      // ── Auto-miss yesterday's uncompleted tasks ───────────────
      // This fires silently in the background. The onSnapshot listener will
      // pick up the resulting point change automatically.
      autoMissPendingTasks(uid, userTasks, yesterdayStr).catch(() => {
        // Silent — non-critical. User will still see correct today state.
      });

      // ── Load today's logs ────────────────────────────────────
      const qLogs = query(
        collection(db, 'logs'),
        where('userId', '==', uid),
        where('date', '==', todayStr)
      );
      const logSnaps = await getDocs(qLogs);
      const logMap = new Map<string, DailyLog>();
      logSnaps.forEach((s) => {
        const log = s.data() as DailyLog;
        logMap.set(log.taskId, log);
      });

      setTasks(userTasks);
      setTodayLogs(logMap);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [todayStr, yesterdayStr]);

  useEffect(() => {
    if (!user) return;

    // Real-time points + streak listener
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTotalPoints(data.totalPoints || 0);
        setStreak(data.streakCount || 0);
      }
    });

    loadData(user.uid);
    return () => unsubscribeUser();
  }, [user, loadData]);

  const handleAction = async (taskId: string, taskName: string, status: LogStatus, points: number) => {
    if (!user) return;
    setActionLoading(taskId);
    try {
      const newLog = await logDailyTask(user.uid, taskId, taskName, status, points, todayStr);
      // Update local map with the returned log — no re-fetch needed
      setTodayLogs((prev) => new Map(prev).set(taskId, newLog));

      if (status === 'done')        toast.success(`+${points} pts — nice work!`);
      else if (status === 'missed') toast.error(`-${Math.floor(points / 2)} pts`);
      else                          toast(`Task skipped.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  // ── Task bucketing ────────────────────────────────────────────
  const tasksForToday = tasks.filter((t) =>
    t.repeatType === 'daily' ||
    (t.repeatType === 'weekly' && t.repeatDays?.includes(currentDay)) ||
    (t.repeatType === 'once' && t.targetDate === todayStr)
  );

  const pendingTasks  = tasksForToday.filter((t) => !todayLogs.has(t.id));
  const actedTasks    = tasksForToday.filter((t) => todayLogs.has(t.id));

  // ── Helpers to render the "acted today" section ───────────────
  const statusMeta = (log: DailyLog) => {
    if (log.status === 'done')    return { icon: '✓', color: 'var(--success)',     sign: `+${log.pointsAwarded}` };
    if (log.status === 'missed')  return { icon: '✗', color: 'var(--danger)',      sign: `${log.pointsAwarded}` };
    /*skipped*/                   return { icon: '→', color: 'var(--text-muted)',  sign: '0' };
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ── Stats ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className="rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Total Points</p>
            <p className="text-4xl font-bold mt-1 text-white tracking-tight">{totalPoints}</p>
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Streak</p>
            <p className="text-4xl font-bold mt-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {streak} <span className="text-2xl">🔥</span>
            </p>
          </div>
        </div>

        {/* ── Pending Tasks ────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Today&apos;s Tasks
            </h2>
            <Button onClick={() => router.push('/tasks/new')} size="sm" variant="outline" className="gap-1">
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
                  onDelete={handleDeleteTask}
                  isLoading={actionLoading === task.id}
                />
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ backgroundColor: 'var(--bg-surface)', border: '2px dashed var(--border-strong)' }}
            >
              <div className="text-4xl mb-3">
                {tasksForToday.length === 0 && tasks.length > 0 ? '☕' : '🎉'}
              </div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {tasksForToday.length === 0 && tasks.length > 0 ? 'Rest day!' : 'All done for today!'}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {tasksForToday.length === 0 && tasks.length > 0
                  ? 'No tasks scheduled for today.'
                  : 'No more pending tasks.'}
              </p>
              {tasks.length === 0 && (
                <Button onClick={() => router.push('/tasks/new')} className="mt-6">
                  Create Your First Task
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Acted Today (done / missed / skipped) ────────────── */}
        {!loading && actedTasks.length > 0 && (
          <div>
            <h3
              className="text-sm font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Logged Today ({actedTasks.length})
            </h3>
            <div className="space-y-2">
              {actedTasks.map((task) => {
                const log  = todayLogs.get(task.id)!;
                const meta = statusMeta(log);
                return (
                  <div
                    key={task.id}
                    className="rounded-xl p-3 flex items-center justify-between gap-3"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      opacity: 0.7,
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Status icon circle */}
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 text-xs font-bold"
                        style={{ backgroundColor: meta.color }}
                      >
                        {meta.icon}
                      </div>
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {task.name}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold whitespace-nowrap"
                      style={{ color: meta.color }}
                    >
                      {meta.sign} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
