'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/firebase/auth';
import { updateTask } from '@/lib/firebase/firestore';
import { Task } from '@/types';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function EditEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [loadingTask, setLoadingTask] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>(''); // Optional time

  useEffect(() => {
    if (!user || !id) return;
    const fetchEvent = async () => {
      try {
        const snap = await getDoc(doc(db, 'tasks', id));
        if (!snap.exists()) {
          toast.error('Event not found');
          router.push('/');
          return;
        }
        const data = snap.data() as Task;
        if (data.userId !== user.uid || data.itemType !== 'event') {
          router.push('/');
          return;
        }
        
        setName(data.name || '');
        setDescription(data.description || '');
        setTargetDate(data.targetDate || format(new Date(), 'yyyy-MM-dd'));
        setTime(data.time || '');
      } catch (err) {
        toast.error('Error loading event');
      } finally {
        setLoadingTask(false);
      }
    };
    fetchEvent();
  }, [user, id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!targetDate) return void toast.error('Select a date');

    setLoading(true);
    try {
      await updateTask(id, {
        name,
        description,
        targetDate,
        time: time || '',
      });
      toast.success('Event updated!');
      router.back();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setLoading(false);
    }
  };

  if (loadingTask) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <div
            className="w-8 h-8 rounded-full border-[3px] animate-spin"
            style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Back
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-7" style={{ color: 'var(--text-primary)' }}>
          Edit Event
        </h1>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Event Title
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. Doctor appointment"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              className="flex w-full rounded-xl px-3 py-2 text-sm transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 resize-none"
              style={{
                backgroundColor: 'var(--bg-raised)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-strong)',
                minHeight: 80,
              }}
              placeholder="Details about this event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Date
            </label>
            <Input
              type="date"
              required
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          {/* Time Picker */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Scheduled Time <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Select time"
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Set a time to enable LINE OA reminders.
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
