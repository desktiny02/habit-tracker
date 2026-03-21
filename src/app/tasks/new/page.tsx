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
  
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'once'>('daily');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const toggleDay = (dayIndex: number) => {
    setRepeatDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex) 
        : [...prev, dayIndex].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts <= 0) return void toast.error('Points must be a positive number');
    
    if (repeatType === 'weekly' && repeatDays.length === 0) {
      return void toast.error('Please select at least one day for the task');
    }
    if (repeatType === 'once' && !targetDate) {
      return void toast.error('Please select a date for the task');
    }

    setLoading(true);
    try {
      await createTask({ 
        userId: user.uid, 
        name, 
        points: pts, 
        repeatType,
        ...(repeatType === 'weekly' ? { repeatDays } : {}),
        ...(repeatType === 'once' ? { targetDate } : {})
      });
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
          New Task
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
              Frequency
            </label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={repeatType === 'daily'}
                  onChange={() => setRepeatType('daily')}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm">Everyday</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={repeatType === 'weekly'}
                  onChange={() => setRepeatType('weekly')}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm">Specific Days</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={repeatType === 'once'}
                  onChange={() => setRepeatType('once')}
                  className="accent-[var(--accent)]"
                />
                <span className="text-sm">Once</span>
              </label>
            </div>

            {repeatType === 'weekly' && (
              <div className="flex justify-between mt-3">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((letter, i) => {
                  const isSelected = repeatDays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-raised)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            )}
            
            {repeatType === 'once' && (
              <div className="mt-3">
                <Input
                  type="date"
                  required
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} // prevent past dates if desired
                />
              </div>
            )}
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
              max="1000"
              placeholder="e.g. 50"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              1–1000 pts per completion. Miss and lose half.
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
