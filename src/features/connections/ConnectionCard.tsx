import type { ConnectionMeta } from './types';

interface ConnectionCardProps {
  label: string;
  connection: ConnectionMeta | null;
  onEdit: () => void;
}

function getStatusDotClass(connection: ConnectionMeta | null): string {
  if (connection === null) return 'bg-slate-600';
  switch (connection.status) {
    case 'ok':
      return 'bg-emerald-400';
    case 'error':
      return 'bg-red-400';
    case 'unconfigured':
    default:
      return 'bg-slate-600';
  }
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return `Last tested ${diffDays}d ago`;
  }
  if (diffHours >= 1) {
    return `Last tested ${diffHours}h ago`;
  }
  if (diffMins >= 1) {
    return `Last tested ${diffMins}m ago`;
  }
  return 'Last tested just now';
}

export function ConnectionCard({ label, connection, onEdit }: ConnectionCardProps) {
  const dotClass = getStatusDotClass(connection);
  const lastTestedText = connection?.lastTestedAt
    ? formatRelativeTime(connection.lastTestedAt)
    : 'Not yet tested';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 mb-3 hover:border-slate-700/80 transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
            <span className="text-sm font-medium text-slate-200">
              {label}
            </span>
          </div>
          {connection?.baseUrl && (
            <p className="text-xs text-slate-500 ml-4 truncate">
              {connection.baseUrl}
            </p>
          )}
          <p className="text-xs text-slate-600 ml-4 mt-0.5">
            {lastTestedText}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-slate-500 hover:text-blue-400 font-medium transition-colors duration-200 ml-4"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
