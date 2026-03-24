import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../lib/format';
import type { ConnectionMeta } from './types';

interface ConnectionCardProps {
  label: string;
  connection: ConnectionMeta | null;
  onEdit: () => void;
}

function getStatusDotClass(connection: ConnectionMeta | null): string {
  if (connection === null) return 'bg-brand-muted';
  switch (connection.status) {
    case 'ok':
      return 'bg-emerald-400';
    case 'error':
      return 'bg-red-400';
    default:
      return 'bg-brand-muted';
  }
}

export function ConnectionCard({ label, connection, onEdit }: ConnectionCardProps) {
  const { t } = useTranslation();
  const dotClass = getStatusDotClass(connection);
  const lastTestedText = connection?.lastTestedAt
    ? formatRelativeTime(connection.lastTestedAt)
    : t('connection.notYetTested');

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4 mb-3 hover:border-brand-border/80 transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
            <span className="text-sm font-medium text-brand-text">{label}</span>
          </div>
          {connection?.baseUrl && (
            <p className="text-xs text-brand-muted ml-4 truncate">{connection.baseUrl}</p>
          )}
          <p className="text-xs text-brand-muted ml-4 mt-0.5">{lastTestedText}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-brand-muted hover:text-brand font-medium transition-colors duration-200 ml-4"
        >
          {t('connection.edit')}
        </button>
      </div>
    </div>
  );
}
