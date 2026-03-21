import React from 'react';
import { Task, LogStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Check, X, SkipForward } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onAction: (taskId: string, taskName: string, status: LogStatus, points: number) => void;
  isLoading: boolean;
}

export function TaskCard({ task, onAction, isLoading }: TaskCardProps) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center justify-between gap-4 transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="min-w-0">
        <h3
          className="font-semibold text-base leading-snug truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {task.name}
        </h3>
        <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--warning)' }}
          />
          {task.points} pts
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Skip */}
        <button
          onClick={() => onAction(task.id, task.name, 'skipped', task.points)}
          disabled={isLoading}
          title="Skip"
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          <SkipForward style={{ width: 16, height: 16 }} />
        </button>

        {/* Miss */}
        <button
          onClick={() => onAction(task.id, task.name, 'missed', task.points)}
          disabled={isLoading}
          title="Mark as missed"
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: 'var(--danger)' }}
        >
          <X style={{ width: 16, height: 16 }} />
        </button>

        {/* Done */}
        <button
          onClick={() => onAction(task.id, task.name, 'done', task.points)}
          disabled={isLoading}
          title="Mark as done"
          className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40 shadow-md"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          <Check style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}
