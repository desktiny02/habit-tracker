import { Task } from '@/types';

const PRIORITY_SCALAR: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const getTaskPriorityValue = (p: string | undefined) => PRIORITY_SCALAR[p || 'medium'] || 2;

// Sort by: Priority (High -> Medium -> Low) -> Required (true -> false) -> Alphabetical (A -> Z)
export const sortTasksWithinDate = (a: Task | { task: Task }, b: Task | { task: Task }) => {
  const taskA = 'task' in a ? (a as { task: Task }).task : (a as Task);
  const taskB = 'task' in b ? (b as { task: Task }).task : (b as Task);

  // Time-based sorting (Chronological first)
  const timeA = taskA.time || '99:99'; // items without time go to the relative bottom
  const timeB = taskB.time || '99:99';
  if (timeA !== timeB) return timeA.localeCompare(timeB);

  const priorityA = getTaskPriorityValue(taskA.priority);
  const priorityB = getTaskPriorityValue(taskB.priority);

  if (priorityA !== priorityB) return priorityB - priorityA;

  const reqA = taskA.required ? 1 : 0;
  const reqB = taskB.required ? 1 : 0;
  if (reqA !== reqB) return reqB - reqA;

  return (taskA.name || '').localeCompare(taskB.name || '');
};
