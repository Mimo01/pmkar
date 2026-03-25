interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const lower = status.toLowerCase();

  let colorClass = 'bg-brand-surface-hover text-brand-text-secondary border border-brand-border';
  if (lower.includes('progress') || lower.includes('review'))
    colorClass =
      'bg-blue-50/60 text-blue-600 border border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/20';
  if (lower.includes('done') || lower.includes('resolved') || lower.includes('closed'))
    colorClass =
      'bg-green-50/60 text-green-600 border border-green-200/60 dark:bg-green-500/10 dark:text-green-400 dark:border-green-400/20';
  if (lower.includes('blocked'))
    colorClass =
      'bg-red-50/60 text-red-600 border border-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:border-red-400/20';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {status}
    </span>
  );
}
