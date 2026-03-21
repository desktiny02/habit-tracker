import React, { useState } from 'react';
import { Task, LogStatus, PRIORITY_CONFIG } from '@/types';
import { Check, X, SkipForward, Trash2, ChevronDown, ChevronUp, Star } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onAction: (taskId: string, taskName: string, status: LogStatus, task: Task) => void;
  onDelete: (taskId: string) => void;
  isLoading: boolean;
  skipTokens: number;
}

export function TaskCard({ task, onAction, onDelete, isLoading, skipTokens }: TaskCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pri = PRIORITY_CONFIG[task.priority || 'medium'];

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: task.required
          ? `1.5px solid ${pri.color}40`
          : '1px solid var(--border)',
      }}
    >
      <div className="p-4 flex items-center justify-between gap-3">
        {/* Left: info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {/* Priority badge */}
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ backgroundColor: pri.bg, color: pri.color }}
            >
              {pri.label}
            </span>
            {task.required && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
              >
                <Star style={{ width: 10, height: 10 }} /> Required
              </span>
            )}
          </div>

          <h3 className="font-semibold text-base leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
            {task.name}
          </h3>

          <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pri.color }} />
            {task.points} pts
            {task.repeatType === 'weekly' && (
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                · {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  .filter((_, i) => task.repeatDays?.includes(i)).join(', ')}
              </span>
            )}
            {task.repeatType === 'once' && (
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>· One-time</span>
            )}
          </p>

          {/* Expand toggle for description */}
          {task.description && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs mt-1 cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              {expanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {showDelete ? (
            <>
              <button
                onClick={() => setShowDelete(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                title="Cancel"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 shadow-md"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
                title="Confirm delete"
              >
                <Trash2 style={{ width: 16, height: 16 }} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowDelete(true)}
                disabled={isLoading}
                title="Delete task"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>

              {/* Skip (shows token count) */}
              <button
                onClick={() => onAction(task.id, task.name, 'skipped', task)}
                disabled={isLoading || skipTokens <= 0}
                title={skipTokens > 0 ? `Skip (${skipTokens} tokens left)` : 'No skip tokens left'}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-30 relative"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
              >
                <SkipForward style={{ width: 16, height: 16 }} />
                {skipTokens > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    {skipTokens}
                  </span>
                )}
              </button>

              {/* Miss */}
              <button
                onClick={() => onAction(task.id, task.name, 'missed', task)}
                disabled={isLoading}
                title="Mark as missed"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: 'var(--danger)' }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>

              {/* Done */}
              <button
                onClick={() => onAction(task.id, task.name, 'done', task)}
                disabled={isLoading}
                title="Mark as done"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40 shadow-md"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                <Check style={{ width: 18, height: 18 }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded description */}
      {expanded && task.description && (
        <div className="px-4 pb-4 pt-0">
          <div
            className="text-sm rounded-lg p-3"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
          >
            {task.description}
          </div>
        </div>
      )}
    </div>
  );
}
