const PRIORITY_SCALAR = {
  high: 3,
  medium: 2,
  low: 1,
};

const getTaskPriorityValue = (p) => PRIORITY_SCALAR[p || 'medium'] || 2;

const sortTasksWithinDate = (a, b) => {
  const taskA = 'task' in a ? a.task : a;
  const taskB = 'task' in b ? b.task : b;

  const priorityA = getTaskPriorityValue(taskA.priority);
  const priorityB = getTaskPriorityValue(taskB.priority);

  if (priorityA !== priorityB) return priorityB - priorityA;

  const reqA = taskA.required ? 1 : 0;
  const reqB = taskB.required ? 1 : 0;
  if (reqA !== reqB) return reqB - reqA;

  return (taskA.name || '').localeCompare(taskB.name || '');
};

const tasks = [
  { name: 'E', priority: 'high', required: false },
  { name: 'D', priority: 'high', required: true },
  { name: 'C', priority: 'medium', required: false },
  { name: 'B', priority: 'low', required: true },
  { name: 'A', priority: 'high', required: true }
];

const sorted = [...tasks].sort(sortTasksWithinDate);
console.log('Sorted:', sorted.map(t => t.name).join(', '));
if (sorted.map(t => t.name).join(', ') === 'A, D, E, C, B') {
  console.log('SUCCESS');
  process.exit(0);
} else {
  console.log('FAILED');
  process.exit(1);
}
