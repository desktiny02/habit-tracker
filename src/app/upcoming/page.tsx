'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState, useMemo } from 'react';
import { Task, PRIORITY_CONFIG } from '@/types';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';

import { Trash2, X, Calendar, Repeat, CalendarClock } from 'lucide-react';
import { sortTasksWithinDate } from '@/lib/sorting';
import { deleteTask } from '@/lib/firebase/firestore';

export default function UpcomingPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    if (!user) return;

    const fetchUpcoming = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const allItems = snap.docs.map(d => d.data() as Task);

        const upcomingItems = allItems.filter(item => {
          if (item.repeatType === 'daily' || item.repeatType === 'weekly') return true;
          if (item.repeatType === 'once' && item.targetDate && item.targetDate >= todayStr) return true;
          return false;
        });

        upcomingItems.sort((a, b) => b.createdAt - a.createdAt);
        setItems(upcomingItems);
      } catch {
        toast.error('Failed to load upcoming items');
      } finally {
        setLoading(false);
      }
    };

    fetchUpcoming();
  }, [user, todayStr]);

  const handleDelete = async (itemId: string) => {
    setDeletingId(itemId);
    try {
      if (user) {
        await deleteTask(itemId, user.uid);
      }
      setItems(prev => prev.filter(i => i.id !== itemId));
      setConfirmDeleteId(null);
      toast.success('Removed successfully');
    } catch {
      toast.error('Failed to remove item');
    } finally {
      setDeletingId(null);
    }
  };

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const scheduleLabel = (item: Task) => {
    if (item.repeatType === 'daily') return 'Every day';
    if (item.repeatType === 'weekly') {
      const days = (item.repeatDays || []).map(i => DAYS[i]).join(', ');
      return days || 'Weekly';
    }
    if (item.repeatType === 'once' && item.targetDate) {
      return format(new Date(item.targetDate + 'T12:00:00'), 'MMM d, yyyy');
    }
    return 'One-time';
  };

  const ScheduleIcon = (item: Task) => {
    if (item.repeatType === 'daily' || item.repeatType === 'weekly') return Repeat;
    return CalendarClock;
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Upcoming
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Manage your future tasks, events, and recurring items.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div
              className="w-8 h-8 rounded-full border-[3px] animate-spin"
              style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '2px dashed var(--border-strong)' }}
          >
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Nothing upcoming
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Create tasks or events from the Dashboard to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
          <div className="space-y-8">
            {(() => {
              const groups = Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(new Date(), i);
                const dStr = format(d, 'yyyy-MM-dd');
                const dayWeight = d.getDay();

                const dItems = items.filter(item => {
                  if (item.repeatType === 'daily') return true;
                  if (item.repeatType === 'weekly' && item.repeatDays?.includes(dayWeight)) return true;
                  if (item.repeatType === 'once' && item.targetDate === dStr) return true;
                  return false;
                });

                dItems.sort(sortTasksWithinDate);

                return {
                  dateStr: dStr,
                  title: format(d, 'EEEE, MMM d, yyyy'),
                  items: dItems
                };
              }).filter(g => g.items.length > 0);

              return groups.map(g => {
                return (
                  <div key={g.dateStr} className="space-y-3">
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                      {g.title}
                    </h2>
                    {g.items.map(item => {
                      const isEvent = item.itemType === 'event';
                      const pri = isEvent ? null : PRIORITY_CONFIG[item.priority || 'medium'];
                      const Icon = ScheduleIcon(item);
                      const isConfirming = confirmDeleteId === item.id;
        
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl p-4 transition-all"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            border: isEvent
                              ? '1px solid var(--border)'
                              : item.required
                              ? `1.5px solid ${pri?.color}40`
                              : '1px solid var(--border)',
                            opacity: deletingId === item.id ? 0.5 : 1,
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Left info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {isEvent ? (
                                  <span
                                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                                  >
                                    <Calendar style={{ width: 10, height: 10 }} /> Event
                                  </span>
                                ) : (
                                  <span
                                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: pri?.bg, color: pri?.color }}
                                  >
                                    {pri?.label}
                                  </span>
                                )}
                              </div>
        
                              <h3 className="font-semibold text-base leading-snug mt-1" style={{ color: 'var(--text-primary)' }}>
                                {item.name}
                              </h3>
        
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                                <Icon style={{ width: 12, height: 12 }} />
                                {scheduleLabel(item)}
                                {!isEvent && (
                                  <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>
                                    · {item.points} pts
                                  </span>
                                )}
                              </div>
        
                              {item.description && (
                                <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                                  {item.description}
                                </p>
                              )}
                            </div>
        
                            {/* Right actions */}
                            <div className="flex items-center gap-2 shrink-0 pt-1">
                              {isConfirming ? (
                                <>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                                    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                                    title="Cancel"
                                  >
                                    <X style={{ width: 16, height: 16 }} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deletingId === item.id}
                                    className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 shadow-md disabled:opacity-40"
                                    style={{ backgroundColor: '#ef4444', color: '#fff' }}
                                    title="Confirm delete"
                                  >
                                    <Trash2 style={{ width: 16, height: 16 }} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  disabled={deletingId === item.id}
                                  title="Delete item"
                                  className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <Trash2 style={{ width: 14, height: 14 }} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
