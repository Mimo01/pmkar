import { useConnectionStore } from './connectionStore';
import { ConnectionCard } from './ConnectionCard';
import type { ConnectionType } from './types';

interface SettingsPageProps {
  onClose: () => void;
  onEdit?: (connectionType: ConnectionType) => void;
}

export function SettingsPage({ onClose, onEdit }: SettingsPageProps) {
  const serverConn = useConnectionStore((s) => s.serverConnection);
  const cloudConn = useConnectionStore((s) => s.cloudConnection);

  function handleEdit(connectionType: ConnectionType) {
    if (onEdit) {
      onEdit(connectionType);
    }
  }

  const hasNoConnections = serverConn === null && cloudConn === null;

  return (
    <div className="max-w-[540px] mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-all duration-200"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold tracking-tight text-slate-200">Connections</h1>
      </div>

      {hasNoConnections ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm font-medium mb-1">
            No connections configured
          </p>
          <p className="text-slate-600 text-xs">
            Run setup to configure your Jira connections.
          </p>
        </div>
      ) : (
        <>
          <ConnectionCard
            label="Source (Customer Jira)"
            connection={serverConn}
            onEdit={() => handleEdit('server')}
          />
          <ConnectionCard
            label="Destination (Company Jira)"
            connection={cloudConn}
            onEdit={() => handleEdit('cloud')}
          />
        </>
      )}
    </div>
  );
}
