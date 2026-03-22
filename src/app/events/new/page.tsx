'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/firebase/auth';
import { createTask } from '@/lib/firebase/firestore';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function NewEventPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!targetDate) return void toast.error('Select a date');

    setLoading(true);
    try {
      await createTask({
        userId: user.uid,
        itemType: 'event',
        name,
        description,
        points: 0,
        priority: 'low', // dummy
        required: false, // dummy
        repeatType: 'once',
        targetDate,
      });
      toast.success('Event created!');
      router.push('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-7" style={{ color: 'var(--text-primary)' }}>
          New Event
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
              min={format(new Date(), 'yyyy-MM-dd')} // no past dates if you want
            />
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creating…' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
