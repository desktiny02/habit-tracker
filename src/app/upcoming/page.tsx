'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState, useMemo } from 'react';
import { Task } from '@/types';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { TaskCard } from '@/components/tasks/TaskCard';

export default function UpcomingPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    if (!user) return;

    const fetchUpcoming = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const allItems = snap.docs.map(d => d.data() as Task);

        // Filter Upcoming:
        // Recurring tasks are inherently upcoming
        // One-time tasks/events are upcoming if targetDate >= today
        const upcomingItems = allItems.filter(item => {
          if (item.repeatType === 'daily' || item.repeatType === 'weekly') return true;
          if (item.repeatType === 'once' && item.targetDate && item.targetDate >= todayStr) return true;
          return false;
        });

        // Global sort rule: newest first (descending by date/time), mapped to createdAt
        upcomingItems.sort((a, b) => b.createdAt - a.createdAt);

        setItems(upcomingItems);
      } catch (err) {
        console.error(err);
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
      await deleteDoc(doc(db, 'tasks', itemId));
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Removed successfully');
    } catch {
      toast.error('Failed to remove item');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Upcoming
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Manage your future tasks, events, and recurring items here.
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
              You have no future items scheduled.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="relative">
                <TaskCard
                  task={item}
                  isLoading={deletingId === item.id}
                  onDelete={handleDelete}
                  onAction={() => {}} // Disabled for upcoming items in this view
                  hideActions
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
