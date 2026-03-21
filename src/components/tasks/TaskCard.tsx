import React from 'react';
import { Task, LogStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Check, X, SkipForward } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onAction: (taskId: string, status: LogStatus, points: number) => void;
  isLoading: boolean;
}

export function TaskCard({ task, onAction, isLoading }: TaskCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between gap-4 transition-all hover:shadow-md">
      <div>
        <h3 className="font-semibold text-slate-800 text-lg">{task.name}</h3>
        <p className="text-slate-500 text-sm flex items-center gap-1 mt-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
          {task.points} pts
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => onAction(task.id, 'skipped', task.points)}
          disabled={isLoading}
          className="text-slate-500 hover:text-slate-700 h-10 w-10 p-0 rounded-full"
          title="Skip"
        >
          <SkipForward className="w-5 h-5" />
        </Button>
        <Button 
          variant="danger" 
          size="sm" 
          onClick={() => onAction(task.id, 'missed', task.points)}
          disabled={isLoading}
          className="h-10 w-10 p-0 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 border-none shadow-none"
          title="Miss"
        >
          <X className="w-5 h-5" />
        </Button>
        <Button 
          variant="primary" 
          size="sm" 
          onClick={() => onAction(task.id, 'done', task.points)}
          disabled={isLoading}
          className="h-12 w-12 p-0 rounded-full bg-indigo-500 hover:bg-indigo-600 shadow-indigo-200 shadow-lg"
          title="Complete"
        >
          <Check className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
