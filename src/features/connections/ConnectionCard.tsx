import type { ConnectionMeta } from './types';

interface ConnectionCardProps {
  label: string;
  connection: ConnectionMeta | null;
  onEdit: () => void;
}

function getStatusDotClass(connection: ConnectionMeta | null): string {
  if (connection === null) return 'bg-slate-400 dark:bg-slate-500';
  switch (connection.status) {
    case 'ok':
      return 'bg-green-600 dark:bg-green-400';
    case 'error':
      return 'bg-red-600 dark:bg-red-400';
    case 'unconfigured':
    default:
      return 'bg-slate-400 dark:bg-slate-500';
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
    return `Last tested: ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }
  if (diffHours >= 1) {
    return `Last tested: ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diffMins >= 1) {
    return `Last tested: ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }
  return 'Last tested: just now';
}

export function ConnectionCard({ label, connection, onEdit }: ConnectionCardProps) {
  const dotClass = getStatusDotClass(connection);
  const lastTestedText = connection?.lastTestedAt
    ? formatRelativeTime(connection.lastTestedAt)
    : 'Not yet tested';

  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-1">
            <span
              className={`w-2 h-2 rounded-full inline-block mr-2 flex-shrink-0 ${dotClass}`}
            />
            <span className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {label}
            </span>
          </div>
          {connection?.baseUrl && (
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-4 mb-1">
              {connection.baseUrl}
            </p>
          )}
          <p className="text-sm text-slate-400 dark:text-slate-500 ml-4">
            {lastTestedText}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 ml-4"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
