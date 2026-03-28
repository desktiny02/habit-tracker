import React, { useState } from 'react';
import { Task, LogStatus, PRIORITY_CONFIG } from '@/types';
import { Check, X, SkipForward, Trash2, ChevronDown, ChevronUp, Star, Calendar } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onAction: (taskId: string, taskName: string, status: LogStatus, task: Task) => void;
  onDelete: (taskId: string) => void;
  isLoading: boolean;
  hideActions?: boolean;
}

export function TaskCard({ task, onAction, onDelete, isLoading, hideActions }: TaskCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isEvent = task.itemType === 'event';
  const pri = isEvent ? null : PRIORITY_CONFIG[task.priority || 'medium'];

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: task.required && !isEvent
          ? `1.5px solid ${pri?.color}40`
          : '1px solid var(--border)',
      }}
    >
      <div className="p-4 flex items-center justify-between gap-3">
        {/* Left: info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {isEvent ? (
              <span
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
              >
                <Calendar style={{ width: 10, height: 10 }} aria-hidden="true" /> Event
              </span>
            ) : (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: pri?.bg, color: pri?.color }}
              >
                {pri?.label}
              </span>
            )}

            {!isEvent && task.required && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
              >
                <Star style={{ width: 10, height: 10 }} aria-hidden="true" /> Required
              </span>
            )}

            {!isEvent && task.repeatType === 'daily' && (task.currentStreak || 0) > 0 && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}
              >
                🔥 {task.currentStreak} Day Streak
              </span>
            )}
          </div>

          <h3 className="font-semibold text-base leading-snug truncate mt-1" style={{ color: 'var(--text-primary)' }}>
            {task.name}
          </h3>

          <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            {!isEvent && (
              <>
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: pri?.color }} aria-hidden="true" />
                {task.points} pts
              </>
            )}

            {!isEvent && task.repeatType === 'weekly' && (
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
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide task details' : 'Show task details'}
              className="flex items-center gap-1 text-xs mt-1 cursor-pointer transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              {expanded
                ? <ChevronUp style={{ width: 12, height: 12 }} aria-hidden="true" />
                : <ChevronDown style={{ width: 12, height: 12 }} aria-hidden="true" />}
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
                aria-label="Cancel delete"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
              >
                <X style={{ width: 16, height: 16 }} aria-hidden="true" />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                aria-label="Confirm delete task"
                className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 shadow-md"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
              >
                <Trash2 style={{ width: 16, height: 16 }} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              {/* Edit button */}
              <a
                href={`/${isEvent ? 'events' : 'tasks'}/${task.id}/edit`}
                aria-label={`Edit ${task.name}`}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </a>

              <button
                onClick={() => setShowDelete(true)}
                disabled={isLoading}
                aria-label={`Delete ${task.name}`}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 style={{ width: 14, height: 14 }} aria-hidden="true" />
              </button>

              {!hideActions && (
                <>
                  {/* Skip is only for tasks */}
                  {!isEvent && (
                    <button
                      onClick={() => onAction(task.id, task.name, 'skipped', task)}
                      disabled={isLoading}
                      aria-label={`Skip ${task.name}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-30 relative"
                      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                    >
                      <SkipForward style={{ width: 16, height: 16 }} aria-hidden="true" />
                    </button>
                  )}

                  {/* Miss / Cross */}
                  <button
                    onClick={() => onAction(task.id, task.name, 'missed', task)}
                    disabled={isLoading}
                    aria-label={isEvent ? `Mark ${task.name} as not done` : `Mark ${task.name} as missed`}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
                    style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: 'var(--danger)' }}
                  >
                    <X style={{ width: 16, height: 16 }} aria-hidden="true" />
                  </button>

                  {/* Done / Tick */}
                  <button
                    onClick={() => onAction(task.id, task.name, 'done', task)}
                    disabled={isLoading}
                    aria-label={`Mark ${task.name} as done`}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40 shadow-md"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    <Check style={{ width: 18, height: 18 }} aria-hidden="true" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded description */}
      {expanded && task.description && (
        <div className="px-4 pb-4 pt-0">
          <div
            className="text-sm rounded-lg p-3 whitespace-pre-wrap"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
          >
            {task.description}
          </div>
        </div>
      )}
    </div>
  );
}
