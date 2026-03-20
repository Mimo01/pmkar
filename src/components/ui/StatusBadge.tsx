import { type ReactNode } from 'react';

export type BadgeStatus = 'healthy' | 'loading' | 'error';

interface StatusBadgeProps {
  label: string;
  status: BadgeStatus;
  detail?: string;
}

const statusConfig: Record<BadgeStatus, { dotClass: string; text: string }> = {
  healthy: { dotClass: 'bg-blue-500 dark:bg-blue-400', text: 'Running' },
  loading: { dotClass: 'bg-slate-300 dark:bg-slate-600', text: 'Checking...' },
  error: { dotClass: 'bg-red-500 dark:bg-red-400', text: 'Unreachable' },
};

export function StatusBadge({ label, status, detail }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 p-2"
    >
      <span className={`inline-block w-2 h-2 rounded-full ${config.dotClass}`} />
      <span className="text-xs font-semibold leading-snug text-slate-950 dark:text-slate-50">
        {label}
      </span>
      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
        {detail || config.text}
      </span>
    </div>
  );
}
