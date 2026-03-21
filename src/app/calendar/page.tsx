'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { DailyLog } from '@/types';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format,
  startOfWeek, endOfWeek, isToday,
} from 'date-fns';
import toast from 'react-hot-toast';

export default function CalendarPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const gridDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          History
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {format(today, 'MMMM yyyy')}
        </p>
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
                const isCurrentMonth = day.getMonth() === today.getMonth();
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className="aspect-square p-1 rounded-xl flex flex-col items-center justify-between transition-colors cursor-default"
                    style={{
                      backgroundColor: isCurrentMonth ? 'var(--bg-raised)' : 'transparent',
                      opacity: isCurrentMonth ? 1 : 0.35,
                      outline: isCurrentDay ? '2px solid var(--accent)' : 'none',
                      outlineOffset: '1px',
                    }}
                  >
                    <span
                      className="text-xs font-medium"
                      style={{ color: isCurrentDay ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {dayLogs.map((log) => {
                        const color =
                          log.status === 'done'   ? 'var(--success)' :
                          log.status === 'missed' ? 'var(--danger)'  :
                          'var(--text-muted)';
                        return (
                          <span
                            key={log.id}
                            title={log.status}
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
                  </div>
                );
              })}
            </div>

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
