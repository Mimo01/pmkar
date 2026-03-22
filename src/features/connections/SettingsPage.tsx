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

const PRESET_OPTIONS: { value: JqlPreset; label: string; description: string }[] = [
  { value: 'assigned', label: 'Assigned to me', description: 'Tickets where you are the assignee' },
  { value: 'mentioned', label: 'Mentioned me', description: 'Tickets where you are mentioned' },
  { value: 'all_watched', label: 'All watched', description: 'Includes tickets from watched users' },
  { value: 'custom', label: 'Custom JQL', description: 'Write your own query' },
];

export function SettingsPage({ onClose, onEdit }: SettingsPageProps) {
  const serverConn = useConnectionStore((s) => s.serverConnection);
  const cloudConn = useConnectionStore((s) => s.cloudConnection);

  const jqlPreset = useTicketStore((s) => s.jqlPreset);
  const jqlCustom = useTicketStore((s) => s.jqlCustom);
  const watchedUsers = useTicketStore((s) => s.watchedUsers);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const safeWatchedUsers = Array.isArray(watchedUsers) ? watchedUsers : [];
  const [watchedUsersText, setWatchedUsersText] = useState(safeWatchedUsers.join('\n'));

  useEffect(() => {
    const safe = Array.isArray(watchedUsers) ? watchedUsers : [];
    setWatchedUsersText(safe.join('\n'));
  }, [watchedUsers]);

  function handlePresetChange(preset: JqlPreset) {
    useTicketStore.getState().setJqlPreset(preset);
    if (preset !== 'custom') {
      setShowAdvanced(false);
    }
    persistFetchConfig();
  }

  function handleJqlCustomChange(jql: string) {
    useTicketStore.getState().setJqlCustom(jql || null);
    persistFetchConfig();
  }

  function handleResetJql() {
    useTicketStore.getState().setJqlCustom(null);
    useTicketStore.getState().setJqlPreset('assigned');
    setShowAdvanced(false);
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
  const watchedCount = safeWatchedUsers.length;

  return (
    <div className="max-w-[540px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-all duration-200"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold tracking-tight text-slate-200">Settings</h1>
      </div>

      {hasNoConnections ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm font-semibold mb-1">
            No connections configured
          </p>
          <p className="text-slate-600 text-xs">
            Run setup to configure your Jira connections.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Connections Section */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Connections</h2>
            </div>
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
          </section>

          {/* Fetch Configuration Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Fetch Configuration</h2>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
              {/* JQL Preset */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-1.5 block">Query preset</label>
                <p className="text-xs text-slate-500 mb-2.5">Choose which tickets appear in your candidate list.</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handlePresetChange(opt.value)}
                      className={`text-left rounded-lg border px-3 py-2.5 transition-all duration-200 ${
                        jqlPreset === opt.value
                          ? 'border-blue-500/50 bg-blue-500/10 text-slate-200'
                          : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-sm font-semibold block">{opt.label}</span>
                      <span className="text-xs text-slate-500 block mt-0.5">{opt.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced JQL */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors duration-200"
                >
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform duration-200 ${showAdvanced || jqlPreset === 'custom' ? 'rotate-90' : ''}`}
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  {showAdvanced || jqlPreset === 'custom' ? 'Hide JQL editor' : 'Edit JQL manually'}
                </button>

                {(showAdvanced || jqlPreset === 'custom') && (
                  <div className="mt-2.5">
                    <textarea
                      value={jqlCustom ?? ''}
                      onChange={(e) => handleJqlCustomChange(e.target.value)}
                      className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-100 px-3 py-2.5 resize-none h-20 font-mono text-xs focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors duration-200"
                      placeholder="assignee = currentUser() ORDER BY updated DESC"
                    />
                    <button
                      type="button"
                      onClick={handleResetJql}
                      className="text-xs text-slate-500 hover:text-slate-300 mt-1.5 transition-colors duration-200"
                    >
                      Reset to default
                    </button>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-800/60" />

              {/* Watched Users */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-slate-300">Watched users</label>
                  {watchedCount > 0 && (
                    <span className="text-xs text-slate-500">{watchedCount} user{watchedCount !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-2.5">
                  One username per line. Tickets assigned to these users will be included in "All watched" results.
                </p>
                <textarea
                  value={watchedUsersText}
                  onChange={(e) => handleWatchedUsersChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-100 px-3 py-2.5 resize-none h-20 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors duration-200"
                  placeholder={"jdoe\ncsmith"}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
