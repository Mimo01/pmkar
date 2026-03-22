import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from './connectionStore';
import { ConnectionCard } from './ConnectionCard';
import { useTicketStore } from '../tickets/ticketStore';
import type { ConnectionType } from './types';
import type { JqlPreset, FetchConfig } from '../tickets/types';

interface SettingsPageProps {
  onClose: () => void;
  onEdit?: (connectionType: ConnectionType) => void;
}

export function SettingsPage({ onClose, onEdit }: SettingsPageProps) {
  const serverConn = useConnectionStore((s) => s.serverConnection);
  const cloudConn = useConnectionStore((s) => s.cloudConnection);

  // Fetch config state from ticket store
  const jqlPreset = useTicketStore((s) => s.jqlPreset);
  const jqlCustom = useTicketStore((s) => s.jqlCustom);
  const watchedUsers = useTicketStore((s) => s.watchedUsers);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const safeWatchedUsers = Array.isArray(watchedUsers) ? watchedUsers : [];
  const [watchedUsersText, setWatchedUsersText] = useState(safeWatchedUsers.join('\n'));

  // Sync watchedUsersText when store changes
  useEffect(() => {
    const safe = Array.isArray(watchedUsers) ? watchedUsers : [];
    setWatchedUsersText(safe.join('\n'));
  }, [watchedUsers]);

  function handlePresetChange(preset: JqlPreset) {
    useTicketStore.getState().setJqlPreset(preset);
    persistFetchConfig();
  }

  function handleJqlCustomChange(jql: string) {
    useTicketStore.getState().setJqlCustom(jql || null);
    persistFetchConfig();
  }

  function handleResetJql() {
    useTicketStore.getState().setJqlCustom(null);
    useTicketStore.getState().setJqlPreset('assigned');
    persistFetchConfig();
  }

  function handleWatchedUsersChange(text: string) {
    setWatchedUsersText(text);
    const users = text.split('\n').map(u => u.trim()).filter(Boolean);
    useTicketStore.getState().setWatchedUsers(users);
    persistFetchConfig();
  }

  function persistFetchConfig() {
    const state = useTicketStore.getState();
    const config: FetchConfig = {
      jqlPreset: state.jqlPreset,
      jqlCustom: state.jqlCustom,
      watchedUsers: state.watchedUsers,
      lastFetchedAt: state.lastFetchedAt,
    };
    invoke('set_fetch_config', { config }).catch(() => {});
  }

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

          {/* Fetch Configuration Section */}
          <div className="border-t border-slate-800/60 mt-6 pt-6">
            <h2 className="text-base font-semibold text-slate-200 mb-4">Fetch Configuration</h2>

            {/* JQL Preset */}
            <label className="text-sm font-semibold text-slate-300 mb-2 block">JQL Preset</label>
            <select
              value={jqlPreset}
              onChange={(e) => handlePresetChange(e.target.value as JqlPreset)}
              className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-100 px-3 py-2 text-sm"
            >
              <option value="assigned">Assigned to me</option>
              <option value="mentioned">Mentioned me</option>
              <option value="all_watched">All watched</option>
              <option value="custom">Custom JQL</option>
            </select>

            {/* Advanced JQL toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer mt-2 inline-block"
            >
              {showAdvanced ? 'Hide JQL editor' : 'Edit JQL manually'}
            </button>

            {/* Advanced JQL textarea (shown when toggled or preset is 'custom') */}
            {(showAdvanced || jqlPreset === 'custom') && (
              <div className="mt-2">
                <textarea
                  value={jqlCustom ?? ''}
                  onChange={(e) => handleJqlCustomChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-100 px-3 py-2 resize-none h-20 font-mono text-xs"
                  placeholder="assignee = currentUser() ORDER BY updated DESC"
                />
                <button
                  type="button"
                  onClick={handleResetJql}
                  className="text-xs text-slate-500 hover:text-slate-300 mt-1 inline-block"
                >
                  Reset to default
                </button>
              </div>
            )}

            {/* Watched Users */}
            <label className="text-sm font-semibold text-slate-300 mb-1 mt-4 block">Watched users</label>
            <p className="text-xs text-slate-500 mb-2">
              One username per line. Tickets assigned to these users will be included in "All watched" results.
            </p>
            <textarea
              value={watchedUsersText}
              onChange={(e) => handleWatchedUsersChange(e.target.value)}
              className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-100 px-3 py-2 resize-none h-20 text-sm"
              placeholder={"jdoe\ncsmith"}
            />
          </div>
        </>
      )}
    </div>
  );
}
