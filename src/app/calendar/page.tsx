'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { DailyLog, Task } from '@/types';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  startOfWeek, endOfWeek, isToday, addMonths, subMonths, isSameDay
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CalendarPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => { setCurrentMonth(subMonths(currentMonth, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentMonth(addMonths(currentMonth, 1)); setSelectedDay(null); };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch logs and tasks scoped to current month
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const startStr = format(startOfWeek(monthStart), 'yyyy-MM-dd');
    const endStr = format(endOfWeek(monthEnd), 'yyyy-MM-dd');

    const loadData = async () => {
      try {
        const qLogs = query(collection(db, 'logs'), where('userId', '==', user.uid));
        const qTasks = query(collection(db, 'tasks'), where('userId', '==', user.uid));
        
        const [snapsLogs, snapsTasks] = await Promise.all([getDocs(qLogs), getDocs(qTasks)]);
        
        const allLogs = snapsLogs.docs.map((d) => d.data() as DailyLog);
        const allTasks = snapsTasks.docs.map((d) => {
          const t = d.data() as Task;
          t.id = d.id;
          return t;
        });
        
        // Filter logs client-side
        const filteredLogs = allLogs.filter(l => l.date >= startStr && l.date <= endStr);
        setLogs(filteredLogs);
        setTasks(allTasks);
      } catch {
        toast.error('Failed to load calendar data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentMonth]);

  type DayItem = { task: Task; log?: DailyLog };

  const getItemsForDay = (day: Date): DayItem[] => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOfWeek = day.getDay();
    const dayEnd = day.getTime() + 86400000;
    
    const scheduledTasks = tasks.filter(t => {
      if (t.createdAt > dayEnd) return false; // task was created after this day
      if (t.repeatType === 'daily') return true;
      if (t.repeatType === 'weekly' && t.repeatDays?.includes(dayOfWeek)) return true;
      if (t.repeatType === 'once' && t.targetDate === dateStr) return true;
      return false;
    });

    const items: DayItem[] = [];
    for (const task of scheduledTasks) {
      const log = logs.find(l => l.taskId === task.id && l.date === dateStr);
      // If past date and no log exists, assume it was cancelled or not applicable, we can skip it.
      // Unless it's an event, we still render past events. Let's render everything that was scheduled.
      if (dateStr < todayStr && !log && task.itemType !== 'event') {
        const cDate = format(new Date(task.createdAt), 'yyyy-MM-dd');
        // Only skip if there's genuinely no log and it's fully past
        if (dateStr >= cDate) {
           // We might include it as "Missed" implicitly if not logged, but let's just push it.
           items.push({ task });
        }
      } else {
        items.push({ task, log });
      }
    }
    return items;
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Calendar
          </h1>
          <p className="text-sm mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
            Track your habits daily
          </p>
        </div>
      </div>

      <div
        className="flex items-center justify-between mb-4 p-3 rounded-2xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <button onClick={prevMonth} className="p-2 hover:bg-[var(--bg-raised)] rounded-full transition-colors">
          <ChevronLeft style={{ width: 20, height: 20, color: 'var(--text-primary)' }} />
        </button>
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-[var(--bg-raised)] rounded-full transition-colors">
          <ChevronRight style={{ width: 20, height: 20, color: 'var(--text-primary)' }} />
        </button>
      </div>

      <div
        className="rounded-2xl p-5 sm:p-7"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
        }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="w-8 h-8 rounded-full border-[3px] animate-spin"
              style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        ) : (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {gridDays.map((day) => {
                const dayItems = getItemsForDay(day);
                const isCurrentMonthDay = day.getMonth() === currentMonth.getMonth();
                const isCurrentDay = isToday(day);
                const isSelected = selectedDay && isSameDay(day, selectedDay);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className="aspect-square p-1 rounded-xl flex flex-col items-center justify-between transition-colors cursor-pointer hover:opacity-80 relative"
                    style={{
                      backgroundColor: isCurrentMonthDay ? 'var(--bg-raised)' : 'transparent',
                      opacity: isCurrentMonthDay ? 1 : 0.35,
                      border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    {isCurrentDay && (
                      <span 
                        className="absolute inset-x-0 -top-1 mx-auto block w-1.5 h-1.5 rounded-full" 
                        style={{ backgroundColor: 'var(--accent)' }} 
                      />
                    )}
                    <span
                      className="text-xs font-medium mt-1"
                      style={{ color: isCurrentDay || isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-wrap gap-0.5 justify-center mt-auto mb-1 px-1">
                      {dayItems.length > 0 && (
                        <span 
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                             backgroundColor: 'var(--accent-subtle)',
                             color: 'var(--accent)'
                          }}
                        >
                          {dayItems.length} {dayItems.length === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Details */}
            {selectedDay && (() => {
               const dayItems = getItemsForDay(selectedDay);
               const tasksList = dayItems.filter(i => i.task.itemType !== 'event');
               const eventsList = dayItems.filter(i => i.task.itemType === 'event');

               return (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                    {format(selectedDay, 'EEEE, MMMM d')}
                  </h3>
                  
                  {dayItems.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No items scheduled for this day.</p>
                  ) : (
                    <div className="space-y-6">
                      {tasksList.length > 0 && (
                        <div>
                           <h4 className="text-xs font-bold uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-secondary)' }}>Tasks</h4>
                           <div className="space-y-3">
                             {tasksList.map(item => {
                               const log = item.log;
                               let badgeColor = 'var(--text-muted)';
                               let badgeText = 'Pending';
                               if (log) {
                                  if (log.status === 'done') { badgeColor = 'var(--success)'; badgeText = 'Done'; }
                                  else if (log.status === 'missed') { badgeColor = 'var(--danger)'; badgeText = 'Missed'; }
                                  else { badgeText = 'Skipped'; }
                               } else if (format(selectedDay, 'yyyy-MM-dd') < format(new Date(), 'yyyy-MM-dd')) {
                                  badgeColor = 'var(--danger)';
                                  badgeText = 'Missed (Unlogged)';
                               }

                               return (
                                 <div key={item.task.id} className="flex justify-between items-center bg-[var(--bg-raised)] p-3 rounded-lg border border-[var(--border)]">
                                    <div className="flex items-center gap-3 min-w-0">
                                       <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: badgeColor }} />
                                       <div className="min-w-0">
                                         <span className="font-medium text-sm block truncate" style={{ color: 'var(--text-primary)' }}>{item.task.name}</span>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                       <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}>{badgeText}</span>
                                       {log && (
                                         <span className="text-sm font-bold" style={{ color: log.status === 'done' ? 'var(--success)' : log.status === 'missed' ? 'var(--danger)' : 'var(--text-muted)' }}>
                                           {log.pointsAwarded > 0 ? `+${log.pointsAwarded}` : log.pointsAwarded} pts
                                         </span>
                                       )}
                                    </div>
                                 </div>
                               )
                             })}
                           </div>
                        </div>
                      )}

                      {eventsList.length > 0 && (
                        <div>
                           <h4 className="text-xs font-bold uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-secondary)' }}>Events</h4>
                           <div className="space-y-3">
                             {eventsList.map(item => {
                               const log = item.log;
                               let badgeColor = 'var(--accent)';
                               let badgeText = 'Scheduled';
                               if (log) {
                                  if (log.status === 'done') { badgeColor = 'var(--success)'; badgeText = 'Done'; }
                                  else if (log.status === 'missed') { badgeColor = 'var(--text-muted)'; badgeText = 'Missed'; }
                               } else if (format(selectedDay, 'yyyy-MM-dd') < format(new Date(), 'yyyy-MM-dd')) {
                                  badgeColor = 'var(--text-muted)';
                                  badgeText = 'Past';
                               }

                               return (
                                 <div key={item.task.id} className="flex justify-between items-center bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--accent)] border-opacity-30">
                                    <div className="flex items-center gap-3 min-w-0">
                                       <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: badgeColor }} />
                                       <div className="min-w-0">
                                         <span className="font-medium text-sm block truncate" style={{ color: 'var(--text-primary)' }}>{item.task.name}</span>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                       <span className="text-xs font-bold px-2 py-1 rounded" style={{ backgroundColor: `${badgeColor}15`, color: badgeColor }}>{badgeText}</span>
                                    </div>
                                 </div>
                               )
                             })}
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
               );
            })()}

          </>
        )}
      </div>
    </AppLayout>
  );
}
