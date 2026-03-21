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

    // Realtime points & streak listener
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setTotalPoints(data.totalPoints || 0);
        setStreak(data.streakCount || 0);
      }
    });

    const loadData = async () => {
      try {
        const userTasks = await getUserTasks(user.uid);
        
        // Fetch logs for today
        const qLogs = query(collection(db, 'logs'), where('userId', '==', user.uid), where('date', '==', todayStr));
        const logSnaps = await getDocs(qLogs);
        const loggedTaskIds = new Set<string>();
        logSnaps.forEach(snap => {
          loggedTaskIds.add(snap.data().taskId);
        });

        setTasks(userTasks);
        setLogsToday(loggedTaskIds);
      } catch (err) {
        toast.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => unsubscribeUser();
  }, [user]);

  const handleAction = async (taskId: string, status: LogStatus, points: number) => {
    if (!user) return;
    setActionLoading(taskId);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await logDailyTask(user.uid, taskId, status, points, todayStr);
      setLogsToday(prev => new Set(prev).add(taskId));
      if (status === 'done') toast.success(`Completed! +${points} points`);
      else if (status === 'missed') toast.error(`Missed task. -${Math.floor(points / 2)} points`);
      else toast.success(`Task skipped.`);
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingTasks = tasks.filter(t => !logsToday.has(t.id));

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
            <h2 className="text-indigo-100 font-medium mb-1">Total Points</h2>
            <p className="text-4xl font-bold tracking-tight">{totalPoints}</p>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h2 className="text-slate-500 font-medium mb-1">Current Streak</h2>
            <p className="text-4xl font-bold tracking-tight text-slate-800">{streak} <span className="text-2xl ml-1">🔥</span></p>
          </div>
        </div>

        {/* Tasks Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Today's Tasks</h2>
            <Button onClick={() => router.push('/tasks/new')} size="sm" className="rounded-full shadow-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
              <Plus className="w-4 h-4 mr-1" /> Add Task
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin"></div>
            </div>
          ) : pendingTasks.length > 0 ? (
            <div className="space-y-3">
              {pendingTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onAction={handleAction} 
                  isLoading={actionLoading === task.id} 
                />
              ))}
            </div>
          ) : (
            <div className="bg-slate-100 rounded-3xl p-10 text-center border border-slate-200 border-dashed">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-lg font-semibold text-slate-700">You're all done!</h3>
              <p className="text-slate-500 mt-1">No more pending tasks for today.</p>
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
