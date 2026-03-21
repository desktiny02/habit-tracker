'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { DailyLog } from '@/types';
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

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  useEffect(() => {
    if (!user) return;
    const loadLogs = async () => {
      try {
        const q = query(collection(db, 'logs'), where('userId', '==', user.uid));
        const snaps = await getDocs(q);
        setLogs(snaps.docs.map((d) => d.data() as DailyLog));
      } catch {
        toast.error('Failed to load calendar logs');
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [user]);

  const getLogsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return logs.filter((l) => l.date === dateStr);
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
                const dayLogs = getLogsForDay(day);
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
                      {dayLogs.map((log) => {
                        const color =
                          log.status === 'done'   ? 'var(--success)' :
                          log.status === 'missed' ? 'var(--danger)'  :
                          'var(--text-muted)';
                        return (
                          <span
                            key={log.id}
                            style={{
                              display: 'inline-block',
                              width: 6, height: 6,
                              borderRadius: '99px',
                              backgroundColor: color,
                            }}
                          />
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Details */}
            {selectedDay && (
              <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                  {format(selectedDay, 'EEEE, MMMM d')}
                </h3>
                {getLogsForDay(selectedDay).length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tasks logged on this day.</p>
                ) : (
                  <div className="space-y-3">
                    {getLogsForDay(selectedDay).map(log => {
                      const isPositive = log.status === 'done';
                      const isMissed = log.status === 'missed';
                      
                      let badgeColor = 'var(--text-muted)';
                      let badgeText = 'Skipped';
                      let points = 0;
                      
                      if (isPositive) { badgeColor = 'var(--success)'; badgeText = 'Done'; points = log.pointsAwarded; }
                      else if (isMissed) { badgeColor = 'var(--danger)'; badgeText = 'Missed'; points = log.pointsAwarded; }

                      return (
                        <div key={log.id} className="flex justify-between items-center bg-[var(--bg-raised)] p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: badgeColor }} />
                             <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{log.taskName || 'Legacy Task'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <span className="text-xs font-bold px-2 py-1 rounded border" style={{ color: badgeColor, borderColor: badgeColor }}>{badgeText}</span>
                             <span className="text-sm font-bold" style={{ color: isMissed ? 'var(--danger)' : isPositive ? 'var(--success)' : 'var(--text-muted)' }}>
                               {points > 0 ? `+${points}` : points} pts
                             </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {[
                { label: 'Done',    color: 'var(--success)' },
                { label: 'Missed',  color: 'var(--danger)'  },
                { label: 'Skipped', color: 'var(--text-muted)' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '99px', backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
