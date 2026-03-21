'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { DailyLog } from '@/types';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, endOfWeek, isToday } from 'date-fns';
import toast from 'react-hot-toast';

export default function CalendarPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Use current month
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const gridDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    if (!user) return;

    const loadLogs = async () => {
      try {
        const startStr = format(monthStart, 'yyyy-MM-dd');
        const endStr = format(monthEnd, 'yyyy-MM-dd');

        // Fetch logs for the current user. Since we need to query by date range, 
        // we can fetch all logs for now or implement a broad range query.
        // For simplicity in this demo, let's fetch all user logs and filter locally if dataset isn't huge.
        const q = query(collection(db, 'logs'), where('userId', '==', user.uid));
        const snaps = await getDocs(q);
        const fetchedLogs = snaps.docs.map(doc => doc.data() as DailyLog);
        setLogs(fetchedLogs);
      } catch (err) {
        toast.error("Failed to load calendar logs");
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [user, monthStart, monthEnd]);

  const getLogsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return logs.filter(log => log.date === dateStr);
  };

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">History</h1>
        <p className="text-slate-500 mt-1 font-medium">{format(today, 'MMMM yyyy')}</p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin"></div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-7 gap-1 sm:gap-4 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-4">
              {gridDays.map(day => {
                const dayLogs = getLogsForDay(day);
                const isCurrentMonth = day.getMonth() === today.getMonth();
                const isCurrentDay = isToday(day);
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`aspect-square p-1 sm:p-2 rounded-xl border flex flex-col items-center justify-between transition-colors
                      ${isCurrentMonth ? 'bg-white border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-100'}
                      ${isCurrentDay ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                      hover:bg-slate-50 cursor-default
                    `}
                  >
                    <span className={`text-xs sm:text-sm font-medium ${isCurrentDay ? 'text-indigo-600' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-wrap gap-1 justify-center mt-1">
                      {dayLogs.map(log => {
                        let dotColor = 'bg-slate-200';
                        if (log.status === 'done') dotColor = 'bg-emerald-400';
                        if (log.status === 'missed') dotColor = 'bg-rose-400';
                        if (log.status === 'skipped') dotColor = 'bg-slate-300';
                        
                        return (
                          <div 
                            key={log.id} 
                            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${dotColor}`}
                            title={log.status}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400" /> Done
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" /> Missed
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-300" /> Skipped
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
