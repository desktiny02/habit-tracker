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

  /* ── Priority left-border accent ── */
  const borderAccentColor = isEvent
    ? 'rgba(90,110,240,0.4)'
    : task.priority === 'high'
    ? 'rgba(240,82,110,0.45)'
    : task.priority === 'low'
    ? 'rgba(46,204,142,0.35)'
    : 'rgba(124,110,245,0.35)';

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200 group"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderAccentColor}`,
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      }}
    >
      <div className="p-4 flex items-center justify-between gap-3">
        {/* Left: info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {isEvent ? (
              <span
                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(90,110,240,0.1)', color: '#7b8ef5', border: '1px solid rgba(90,110,240,0.2)' }}
              >
                <Calendar style={{ width: 9, height: 9 }} aria-hidden="true" /> Event
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
                style={{ backgroundColor: 'rgba(124,110,245,0.1)', color: 'var(--accent)', border: '1px solid rgba(124,110,245,0.2)' }}
              >
                <Star style={{ width: 9, height: 9 }} aria-hidden="true" /> Required
              </span>
            )}

            {!isEvent && task.repeatType === 'daily' && (task.currentStreak || 0) > 0 && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(245,166,35,0.1)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.2)' }}
              >
                🔥 {task.currentStreak}-day streak
              </span>
            )}

            {task.time && (
              <span
                className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(124,110,245,0.08)', color: 'var(--accent)' }}
              >
                ⏰ {task.time}
              </span>
            )}
          </div>

          <h3 className="font-semibold text-sm leading-snug" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {task.name}
          </h3>

          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            {!isEvent && (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pri?.color }} aria-hidden="true" />
                {task.points} pt{task.points !== 1 ? 's' : ''}
              </>
            )}

            {!isEvent && task.repeatType === 'daily' && (
              <span style={{ color: 'var(--text-muted)' }}>· Every day</span>
            )}
            {!isEvent && task.repeatType === 'weekly' && (
              <span style={{ color: 'var(--text-muted)' }}>
                · {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  .filter((_, i) => task.repeatDays?.includes(i)).join(', ')}
              </span>
            )}
            {task.repeatType === 'once' && (
              <span style={{ color: 'var(--text-muted)' }}>· Due Today</span>
            )}
          </p>

          {task.description && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="flex items-center gap-1 text-[11px] mt-1.5 cursor-pointer transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              {expanded
                ? <ChevronUp style={{ width: 11, height: 11 }} />
                : <ChevronDown style={{ width: 11, height: 11 }} />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {showDelete ? (
            <>
              <button
                onClick={() => setShowDelete(false)}
                aria-label="Cancel delete"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
              <button
                onClick={() => onDelete(task.id)}
                aria-label="Confirm delete"
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </>
          ) : (
            <>
              <a
                href={`/${isEvent ? 'events' : 'tasks'}/${task.id}/edit`}
                aria-label={`Edit ${task.name}`}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </a>

              <button
                onClick={() => setShowDelete(true)}
                disabled={isLoading}
                aria-label={`Delete ${task.name}`}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>

              {!hideActions && (
                <>
                  {!isEvent && (
                    <button
                      onClick={() => onAction(task.id, task.name, 'skipped', task)}
                      disabled={isLoading}
                      aria-label={`Skip ${task.name}`}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                      style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                    >
                      <SkipForward style={{ width: 14, height: 14 }} />
                    </button>
                  )}

                  <button
                    onClick={() => onAction(task.id, task.name, 'missed', task)}
                    disabled={isLoading}
                    aria-label={`Miss ${task.name}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
                    style={{ backgroundColor: 'rgba(240,82,110,0.1)', color: 'var(--danger)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(240,82,110,0.18)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(240,82,110,0.1)'; }}
                  >
                    <X style={{ width: 15, height: 15 }} />
                  </button>

                  <button
                    onClick={() => onAction(task.id, task.name, 'done', task)}
                    disabled={isLoading}
                    aria-label={`Mark ${task.name} as done`}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40 shadow-md"
                    style={{
                      background: 'linear-gradient(135deg, #7c6ef5, #5a6ef0)',
                      color: '#fff',
                      boxShadow: '0 2px 10px rgba(124,110,245,0.35)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(124,110,245,0.55)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(124,110,245,0.35)'; }}
                  >
                    <Check style={{ width: 16, height: 16 }} />
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
            className="text-xs rounded-xl p-3 whitespace-pre-wrap leading-relaxed"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {task.description}
          </div>
        </div>
      )}
    </div>
  );
}
