import { useTranslation } from 'react-i18next';

export type BadgeStatus = 'healthy' | 'loading' | 'error';

interface StatusBadgeProps {
  label: string;
  status: BadgeStatus;
  detail?: string;
}

const statusDotClass: Record<BadgeStatus, string> = {
  healthy: 'bg-emerald-400',
  loading: 'bg-slate-600 animate-pulse',
  error: 'bg-red-400',
};

export function StatusBadge({ label, status, detail }: StatusBadgeProps) {
  const { t } = useTranslation();

  const statusText: Record<BadgeStatus, string> = {
    healthy: 'Running',
    loading: t('common.loading'),
    error: 'Unreachable',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-brand-surface-hover transition-colors duration-200"
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass[status]}`}
      />
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <span className="text-xs text-brand-muted">{detail || statusText[status]}</span>
    </div>
  );
}
