'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getUserTasks, logDailyTask, deleteTask, autoMissPendingTasks, deleteDailyLog } from '@/lib/firebase/firestore';
import { Task, LogStatus, DailyLog } from '@/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Button } from '@/components/ui/button';
import { Plus, RotateCcw } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { doc, onSnapshot, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { sortTasksWithinDate } from '@/lib/sorting';

export default function DashboardPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayLogs, setTodayLogs] = useState<Map<string, DailyLog>>(new Map());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const pinGeneratedRef = useRef(false);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const yesterdayStr = useMemo(() => format(subDays(new Date(), 1), 'yyyy-MM-dd'), []);
  const currentDay = useMemo(() => new Date().getDay(), []);

  const loadData = useCallback(async (uid: string) => {
    try {
      const userTasks = await getUserTasks(uid);
      // Auto-miss yesterday silently
      autoMissPendingTasks(uid, userTasks, yesterdayStr).catch(() => {});

      // Load today's logs
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
    if (userData) setTotalPoints(userData.totalPoints);
  }, [userData]);




  useEffect(() => {
    if (!user) return;
    loadData(user.uid);
  }, [user, loadData]);

  // One-time point deduction for @mu (requested)
  useEffect(() => {
    const applyDeduction = async () => {
      // Check if user is the correct one and hasn't had the deduction yet
      if (user && userData && (userData.username === 'mu' || userData.email === 'napat-mu@hotmail.com') && !userData.deductionApplied) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            totalPoints: Math.max(0, (userData.totalPoints || 0) - 5),
            deductionApplied: true
          });
          toast.success('Deducted 5 points as requested by admin.');
        } catch {
          // silent fail
        }
      }
    };
    applyDeduction();
  }, [user, userData]);

  const handleAction = async (taskId: string, taskName: string, status: LogStatus, task: Task) => {
    if (!user) return;
    setActionLoading(taskId);
    try {
      const newLog = await logDailyTask(user.uid, taskId, taskName, status, task, todayStr);
      setTodayLogs((prev) => new Map(prev).set(taskId, newLog));

      if (task.itemType !== 'event') {
        if (status === 'done') toast.success(`+${task.points} pts — nice work!`);
        else if (status === 'missed') {
          // just error notification
          toast.error(`Task marked as missed.`);
        }
      } else {
        toast.success(`Event logged.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      if (!user) return;
      await deleteTask(taskId, user.uid);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Removed successfully');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(`Remove failed: ${err.message || 'Unknown error'}`);
    }
  };

  const [undoLoading, setUndoLoading] = useState<string | null>(null);
  const [confirmUndoId, setConfirmUndoId] = useState<string | null>(null);

  const handleUndoLog = async (taskId: string, logId: string) => {
    if (!user) return;
    if (confirmUndoId !== taskId) {
      setConfirmUndoId(taskId);
      return;
    }
    setUndoLoading(taskId);
    setConfirmUndoId(null);
    try {
      const logToUndo = todayLogs.get(taskId);
      const points = logToUndo?.pointsAwarded || 0;
      
      await deleteDailyLog(user.uid, logId);
      setTodayLogs((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
      setTotalPoints(p => Math.max(0, p - points));
      toast.success('Log reversed successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Undo failed');
    } finally {
      setUndoLoading(null);
    }
  };

  // ── Task bucketing & sorting ─────────────────────────────────
  const tasksForToday = tasks
    .filter((t) =>
      t.repeatType === 'daily' ||
      (t.repeatType === 'weekly' && t.repeatDays?.includes(currentDay)) ||
      (t.repeatType === 'once' && t.targetDate === todayStr)
    );

  // Sorting based on global rule: Priority -> Required -> Alphabetical
  const pendingTasks = tasksForToday
    .filter((t) => !todayLogs.has(t.id))
    .sort(sortTasksWithinDate);
  
  const actedTasksWithLogs = tasksForToday
    .filter(t => todayLogs.has(t.id))
    .map(t => ({ task: t, log: todayLogs.get(t.id)! }))
    .sort(sortTasksWithinDate);

  const statusMeta = (log: DailyLog) => {
    if (log.itemType === 'event') {
      if (log.status === 'done') return { icon: '✓', color: 'var(--success)' };
      if (log.status === 'missed') return { icon: '✗', color: 'var(--danger)' };
    } else {
      if (log.status === 'done') return { icon: '✓', color: 'var(--success)', sign: `+${log.pointsAwarded}` };
      if (log.status === 'missed') return { icon: '✗', color: 'var(--danger)', sign: `${log.pointsAwarded}` };
    }
    return { icon: '→', color: 'var(--text-muted)', sign: '0' };
  };

  const [repairCode, setRepairCode] = useState('');
  const [repairLoading, setRepairLoading] = useState(false);

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

  const handleRepairProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRepairLoading(true);
    try {
      const { createUserProfile } = await import('@/lib/firebase/firestore');
      // Use email as temporary username if we don't have one, or prompt?
      // For now, let's just use a simplified version or redirect to a repair page.
      // But let's try to do it here for better UX.
      const username = user.email?.split('@')[0] || 'User';
      await createUserProfile(user.uid, user.email || '', username, repairCode.trim());
      toast.success('Profile created successfully! Refreshing...');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Repair failed');
    } finally {
      setRepairLoading(false);
    }
  };


  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ── Profile Missing Warning ─────────────────── */}
        {!loading && user && !userData && (
          <div 
            className="rounded-2xl p-6 mb-4 border-2 border-dashed border-[var(--danger)] bg-[var(--danger)]/5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--danger)]/10 flex items-center justify-center text-[var(--danger)]">
                <Plus style={{ transform: 'rotate(45deg)' }} />
              </div>
              <div>
                <h3 className="font-bold text-[var(--danger)]">Profile Incomplete</h3>
                <p className="text-xs text-[var(--text-secondary)]">Your account was created but your profile document is missing. Enter a registration code to fix it.</p>
              </div>
            </div>
            <form onSubmit={handleRepairProfile} className="flex gap-2">
              <input 
                type="text" 
                placeholder="8-Digit Code"
                value={repairCode}
                maxLength={8}
                onChange={(e) => setRepairCode(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                required
              />
              <Button type="submit" disabled={repairLoading} size="sm">
                {repairLoading ? '...' : 'Fix Now'}
              </Button>
            </form>
          </div>
        )}


        <div className="space-y-6">
        {/* ── Stats Hero ─────────────────────────────────── */}
        <div className="w-full relative overflow-hidden rounded-[24px] p-7 md:p-8"
          style={{
            background: 'linear-gradient(135deg, #0e1120 0%, #12163a 50%, #0e1120 100%)',
            border: '1px solid rgba(124,110,245,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,110,245,0.08)',
          }}
        >
          {/* Decorative mesh */}
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl -mt-24 -mr-24 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,110,245,0.18) 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-3xl -mb-14 -ml-14 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(90,110,240,0.14) 0%, transparent 70%)' }} />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              {/* Label */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                  Account Rewards
                </span>
              </div>

              {/* Balance */}
              <div className="flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-white">
                  {totalPoints}
                </span>
                <span className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>pts</span>
              </div>

              <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Keep completing habits to grow your rewards!
              </p>
            </div>

            {/* Redeem CTA */}
            <button
              onClick={() => router.push('/rewards')}
              className="shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-200 hover:opacity-90 active:scale-[0.97] whitespace-nowrap"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                backdropFilter: 'blur(8px)',
              }}
            >
              Redeem Points
            </button>
          </div>
        </div>

        {/* ── Pending Tasks ────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Today&apos;s Items
            </h2>
            <div className="flex gap-2">
              <Button onClick={() => router.push('/tasks/new')} size="sm" variant="outline" className="gap-1">
                <Plus style={{ width: 14, height: 14 }} />
                Task
              </Button>
              <Button onClick={() => router.push('/events/new')} size="sm" variant="outline" className="gap-1 shadow-sm">
                <Plus style={{ width: 14, height: 14 }} />
                Event
              </Button>
            </div>
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
          ) : tasksForToday.length === 0 && tasks.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ backgroundColor: 'var(--bg-surface)', border: '2px dashed var(--border-strong)' }}
            >
              <div className="text-4xl mb-3">🚀</div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Get started!
              </h3>
              <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-secondary)' }}>
                Create your first task or event to begin tracking.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => router.push('/tasks/new')} size="sm" className="gap-1">
                  <Plus style={{ width: 14, height: 14 }} /> New Task
                </Button>
                <Button onClick={() => router.push('/events/new')} size="sm" variant="outline" className="gap-1">
                  <Plus style={{ width: 14, height: 14 }} /> New Event
                </Button>
              </div>
            </div>
          ) : actedTasksWithLogs.length > 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: 'var(--bg-surface)', border: '2px dashed var(--border-strong)' }}
            >
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                All done for today!
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Great job — all your items are logged.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ backgroundColor: 'var(--bg-surface)', border: '2px dashed var(--border-strong)' }}
            >
              <div className="text-4xl mb-3">☕</div>
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                Rest day!
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                No items scheduled today.
              </p>
            </div>
          )}
        </div>

        {/* ── Logged Today ────────────────────────────── */}
        {!loading && actedTasksWithLogs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Logged Today ({actedTasksWithLogs.length})
            </h3>
            <div className="space-y-2">
              {actedTasksWithLogs.map(({ task, log }) => {
                const meta = statusMeta(log);
                const isEvent = task.itemType === 'event';
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
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 text-xs font-bold"
                        style={{ backgroundColor: meta.color }}
                      >
                        {meta.icon}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block" style={{ color: 'var(--text-primary)' }}>
                          {task.name}
                        </span>
                        {!isEvent ? (
                          <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                            Task
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                            Event
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEvent && meta.sign && (
                         <span className="text-xs font-bold whitespace-nowrap" style={{ color: meta.color }}>
                           {meta.sign} pts
                         </span>
                      )}
                      
                      {confirmUndoId === task.id ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-1 duration-150">
                          <button
                            onClick={() => setConfirmUndoId(null)}
                            className="p-1 rounded-md text-[10px] font-bold uppercase transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUndoLog(task.id, log.id)}
                            disabled={undoLoading === task.id}
                            className="p-1 px-1.5 rounded-md text-[10px] font-bold uppercase bg-[var(--danger)] text-white shadow-sm"
                          >
                            {undoLoading === task.id ? '...' : 'Undo'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUndoLog(task.id, log.id)}
                          disabled={undoLoading === task.id}
                          className="p-1.5 rounded-full hover:bg-[var(--bg-raised)] transition-colors cursor-pointer group disabled:opacity-50"
                          title="Undo log"
                        >
                          <RotateCcw 
                            style={{ width: 14, height: 14, color: 'var(--text-muted)' }} 
                            className={`group-hover:text-[var(--text-primary)] transition-colors ${undoLoading === task.id ? 'animate-spin' : ''}`} 
                          />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>
    </AppLayout>
  );
}
