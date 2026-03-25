interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const lower = status.toLowerCase();

  let colorClass =
    'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'; // default: To Do / Open
  if (lower.includes('progress') || lower.includes('review'))
    colorClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  if (lower.includes('done') || lower.includes('resolved') || lower.includes('closed'))
    colorClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (lower.includes('blocked'))
    colorClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}
