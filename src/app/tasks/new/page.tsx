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

export default function NewTaskPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName]     = useState('');
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts <= 0) return void toast.error('Points must be a positive number');

    setLoading(true);
    try {
      await createTask({ userId: user.uid, name, points: pts, repeatType: 'daily' });
      toast.success('Task created!');
      router.push('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
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
          New Daily Task
        </h1>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Task Name
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. Read for 30 minutes"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Completion Points
            </label>
            <Input
              type="number"
              required
              min="1"
              placeholder="e.g. 50"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Earn these points daily. Miss and lose half.
            </p>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creating…' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
