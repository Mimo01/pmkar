export type BadgeStatus = 'healthy' | 'loading' | 'error';

interface StatusBadgeProps {
  label: string;
  status: BadgeStatus;
  detail?: string;
}

const statusConfig: Record<BadgeStatus, { dotClass: string; text: string }> = {
  healthy: { dotClass: 'bg-emerald-400', text: 'Running' },
  loading: { dotClass: 'bg-slate-600 animate-pulse', text: 'Checking...' },
  error: { dotClass: 'bg-red-400', text: 'Unreachable' },
};

export function StatusBadge({ label, status, detail }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/40 transition-colors duration-200"
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dotClass}`} />
      <span className="text-xs font-medium text-slate-300">
        {label}
      </span>
      <span className="text-xs text-slate-600">
        {detail || config.text}
      </span>
    </div>
  );
}
