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
    <div className="max-w-[640px] mx-auto px-6 py-8">
      <div className="flex items-center mb-6">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 mr-4"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50">Connections</h1>
      </div>

      {hasNoConnections ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400 text-base font-semibold mb-2">
            No connections configured
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
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
