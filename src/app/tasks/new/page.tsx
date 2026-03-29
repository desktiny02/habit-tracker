'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/firebase/auth';
import { createTask } from '@/lib/firebase/firestore';
import { Priority, PRIORITY_CONFIG } from '@/types';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function NewTaskPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [required, setRequired] = useState(true);
  const [loading, setLoading] = useState(false);

  const [repeatType, setRepeatType] = useState<'today' | 'once' | 'weekly' | 'daily'>('today');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>(''); // Optional time

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
    if (pts > 1000) return void toast.error('Points cannot exceed 1000');
    if (repeatType === 'weekly' && repeatDays.length === 0) {
      return void toast.error('Select at least one day');
    }
    if (repeatType === 'once' && !targetDate) {
      return void toast.error('Select a date');
    }

    const finalRepeatType = repeatType === 'today' ? 'once' : repeatType;
    const finalTargetDate = repeatType === 'today' ? format(new Date(), 'yyyy-MM-dd') : targetDate;

    setLoading(true);
    try {
      await createTask({
        userId: user.uid,
        itemType: 'task',
        name,
        description,
        points: pts,
        priority,
        required,
        repeatType: finalRepeatType,
        time: time || undefined,
        ...(finalRepeatType === 'weekly' ? { repeatDays } : {}),
        ...(finalRepeatType === 'once' ? { targetDate: finalTargetDate } : {}),
      });
      toast.success('Task created!');
      router.push('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
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
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
              placeholder="Details about this task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Priority
            </label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const selected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
                    style={{
                      backgroundColor: selected ? cfg.bg : 'var(--bg-raised)',
                      color: selected ? cfg.color : 'var(--text-muted)',
                      border: selected ? `1.5px solid ${cfg.color}` : '1.5px solid transparent',
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Higher priority → bigger penalty if missed.
            </p>
          </div>

          {/* Required toggle */}
          <div
            className="flex items-center justify-between rounded-xl p-3"
            style={{ backgroundColor: 'var(--bg-raised)' }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Required task</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Missing a required task incurs 50% extra point penalty
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRequired(!required)}
              className="w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0"
              style={{
                backgroundColor: required ? 'var(--accent)' : 'var(--bg-surface)',
                border: required ? 'none' : '1px solid var(--border-strong)',
                position: 'relative',
              }}
            >
              <span
                className="block w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
                style={{
                  transform: required ? 'translateX(22px)' : 'translateX(2px)',
                  marginTop: 2,
                }}
              />
            </button>
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

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Frequency
            </label>
            <div className="flex gap-4 mb-3 flex-wrap">
              {[
                { value: 'today' as const, label: 'Today' },
                { value: 'once' as const, label: 'Once' },
                { value: 'weekly' as const, label: 'Specific Days' },
                { value: 'daily' as const, label: 'Everyday' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={repeatType === opt.value}
                    onChange={() => setRepeatType(opt.value)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
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
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            )}
          </div>

          {/* Points */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
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
              1–1000 pts per completion.
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
