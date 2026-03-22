import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from './connectionStore';
import { ConnectionCard } from './ConnectionCard';
import { ConnectionForm } from './ConnectionForm';
import { useTicketStore } from '../tickets/ticketStore';
import type { ConnectionType, ConnectionMeta, ConnectionTestResult } from './types';
import type { JqlPreset, FetchConfig } from '../tickets/types';

interface SettingsPageProps {
  onClose: () => void;
  onEdit?: (connectionType: ConnectionType) => void;
}

interface JiraUser {
  name: string;
  displayName: string;
  emailAddress?: string;
}

const PRESET_OPTIONS: { value: JqlPreset; label: string; jql: string }[] = [
  { value: 'assigned', label: 'Assigned to me', jql: 'assignee = currentUser() ORDER BY updated DESC' },
  { value: 'mentioned', label: 'Mentioned', jql: 'text ~ currentUser() ORDER BY updated DESC' },
  { value: 'all_watched', label: 'All watched users', jql: 'assignee in (currentUser(), ...watched) ORDER BY updated DESC' },
  { value: 'custom', label: 'Custom query', jql: 'You write the JQL' },
];

export function SettingsPage({ onClose, onEdit }: SettingsPageProps) {
  const serverConn = useConnectionStore((s) => s.serverConnection);
  const cloudConn = useConnectionStore((s) => s.cloudConnection);

  const jqlPreset = useTicketStore((s) => s.jqlPreset);
  const jqlCustom = useTicketStore((s) => s.jqlCustom);
  const watchedUsers = useTicketStore((s) => s.watchedUsers);
  const safeWatchedUsers = Array.isArray(watchedUsers) ? watchedUsers : [];
  const [editingConnection, setEditingConnection] = useState<ConnectionType | null>(null);

  const [userQuery, setUserQuery] = useState('');
  const [suggestions, setSuggestions] = useState<JiraUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userQuery.trim() || !serverConn) {
      setSuggestions([]);
      setShowSuggestions(false);
      setNoResults(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      invoke<JiraUser[]>('search_jira_users', {
        baseUrl: serverConn.baseUrl,
        query: userQuery.trim(),
      })
        .then((users) => {
          const filtered = users.filter(u => !safeWatchedUsers.includes(u.name));
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
          setNoResults(filtered.length === 0);
          setSelectedIdx(-1);
        })
        .catch(() => {
          setSuggestions([]);
          setShowSuggestions(false);
          setNoResults(true);
        });
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [userQuery, serverConn, safeWatchedUsers]);

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

  function handleAddUser(username: string) {
    if (!username || safeWatchedUsers.includes(username)) return;
    const updated = [...safeWatchedUsers, username];
    useTicketStore.getState().setWatchedUsers(updated);
    setUserQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setNoResults(false);
    inputRef.current?.focus();
    persistFetchConfigWith(updated);
  }

  function handleRemoveUser(username: string) {
    const updated = safeWatchedUsers.filter(u => u !== username);
    useTicketStore.getState().setWatchedUsers(updated);
    persistFetchConfigWith(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && suggestions[selectedIdx]) {
        handleAddUser(suggestions[selectedIdx].name);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  function persistFetchConfig() {
    const state = useTicketStore.getState();
    persistFetchConfigWith(state.watchedUsers);
  }

  function persistFetchConfigWith(users: string[]) {
    const state = useTicketStore.getState();
    const config: FetchConfig = {
      jqlPreset: state.jqlPreset,
      jqlCustom: state.jqlCustom,
      watchedUsers: Array.isArray(users) ? users : [],
      lastFetchedAt: state.lastFetchedAt,
    };
    invoke('set_fetch_config', { config }).catch(() => {});
  }

  function handleEdit(connectionType: ConnectionType) {
    setEditingConnection(connectionType);
  }

  function handleEditTestSuccess(
    connectionType: ConnectionType,
    result: ConnectionTestResult,
    credentials: { baseUrl: string; [key: string]: string },
  ) {
    const username = result.username ?? '';
    const serverVersion = result.serverVersion ?? '';
    const meta: ConnectionMeta = {
      baseUrl: credentials.baseUrl,
      username,
      serverVersion,
      lastTestedAt: new Date().toISOString(),
      status: 'ok',
    };

    if (connectionType === 'server') {
      useConnectionStore.getState().setServerConnection(meta);
      invoke('store_credential', {
        connectionType: 'jira-server',
        username,
        secret: credentials.pat ?? credentials.apiToken ?? '',
      }).catch(() => {});
    } else {
      useConnectionStore.getState().setCloudConnection(meta);
      invoke('store_credential', {
        connectionType: 'jira-cloud',
        username: credentials.email ?? username,
        secret: credentials.apiToken ?? '',
      }).catch(() => {});
    }

    invoke('set_connection_meta', {
      meta: { connectionType: connectionType === 'server' ? 'server' : 'cloud', baseUrl: credentials.baseUrl, username, serverVersion, lastTestedAt: meta.lastTestedAt, status: 'ok' },
    }).catch(() => {});

    setEditingConnection(null);
  }

  const hasNoConnections = serverConn === null && cloudConn === null;

  return (
    <div className="max-w-[540px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 text-brand-muted hover:text-brand-text hover:bg-brand-surface-hover rounded-lg transition-all duration-200"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold tracking-tight text-brand-text">Settings</h1>
      </div>

      {hasNoConnections ? (
        <div className="text-center py-16">
          <p className="text-brand-text-secondary text-sm font-semibold mb-1">
            No connections configured
          </p>
          <p className="text-brand-muted text-xs">
            Run setup to configure your Jira connections.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Connections Section */}
          <section>
            <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Connections</h2>
            {editingConnection === 'server' ? (
              <div className="rounded-xl border border-brand/30 bg-brand-surface p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-brand-text">Edit Source Connection</span>
                  <button
                    type="button"
                    onClick={() => setEditingConnection(null)}
                    className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
                <ConnectionForm
                  connectionType="server"
                  initialValues={{ baseUrl: serverConn?.baseUrl, username: serverConn?.username }}
                  onTestSuccess={(result, creds) => handleEditTestSuccess('server', result, creds as { baseUrl: string; [key: string]: string })}
                  onTestInvalidated={() => {}}
                />
              </div>
            ) : (
              <ConnectionCard
                label="Source (Customer Jira)"
                connection={serverConn}
                onEdit={() => handleEdit('server')}
              />
            )}
            {editingConnection === 'cloud' ? (
              <div className="rounded-xl border border-brand/30 bg-brand-surface p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-brand-text">Edit Destination Connection</span>
                  <button
                    type="button"
                    onClick={() => setEditingConnection(null)}
                    className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
                <ConnectionForm
                  connectionType="cloud"
                  initialValues={{ baseUrl: cloudConn?.baseUrl, username: cloudConn?.username }}
                  onTestSuccess={(result, creds) => handleEditTestSuccess('cloud', result, creds as { baseUrl: string; [key: string]: string })}
                  onTestInvalidated={() => {}}
                />
              </div>
            ) : (
              <ConnectionCard
                label="Destination (Company Jira)"
                connection={cloudConn}
                onEdit={() => handleEdit('cloud')}
              />
            )}
          </section>

          {/* What to Fetch Section */}
          <section>
            <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">What to fetch</h2>
            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
              {PRESET_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePresetChange(opt.value)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors duration-150 ${
                    i > 0 ? 'border-t border-brand-border-subtle' : ''
                  } ${
                    jqlPreset === opt.value
                      ? 'bg-brand/8'
                      : 'hover:bg-brand-surface-hover'
                  }`}
                >
                  <span className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
                    jqlPreset === opt.value ? 'border-brand' : 'border-brand-border'
                  }`}>
                    {jqlPreset === opt.value && (
                      <span className="w-2 h-2 rounded-full bg-brand" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm block ${
                      jqlPreset === opt.value ? 'text-brand-text font-semibold' : 'text-brand-text-secondary'
                    }`}>{opt.label}</span>
                    <span className="text-xs text-brand-muted block truncate font-mono">{opt.jql}</span>
                  </div>
                </button>
              ))}
            </div>

            {jqlPreset === 'custom' && (
              <div className="mt-3">
                <textarea
                  value={jqlCustom ?? ''}
                  onChange={(e) => handleJqlCustomChange(e.target.value)}
                  className="w-full rounded-lg border border-brand-border bg-brand-surface text-brand-text px-3 py-2.5 resize-none h-20 font-mono text-xs focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-colors duration-200"
                  placeholder="assignee = currentUser() ORDER BY updated DESC"
                  autoFocus
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={handleResetJql}
                    className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-200"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Watched Users Section */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-wider">Watched users</h2>
              {safeWatchedUsers.length > 0 && (
                <span className="text-xs text-brand-muted">{safeWatchedUsers.length}</span>
              )}
            </div>
            <p className="text-xs text-brand-muted mb-3">
              Tickets assigned to these users appear in "All watched users" results.
            </p>

            <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
              {/* Autocomplete input */}
              <div className="relative">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border-subtle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-muted flex-shrink-0" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-muted focus:outline-none"
                    placeholder="Search Jira users..."
                  />
                </div>

                {/* No results feedback */}
                {noResults && userQuery.trim() && !showSuggestions && (
                  <div className="absolute left-0 right-0 top-full z-10 border border-brand-border rounded-lg bg-brand-surface shadow-xl px-4 py-3">
                    <p className="text-xs text-brand-muted">No users found matching "{userQuery.trim()}"</p>
                  </div>
                )}

                {/* Dropdown suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 border border-brand-border rounded-lg bg-brand-surface shadow-xl overflow-hidden">
                    {suggestions.map((user, i) => (
                      <button
                        key={user.name}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleAddUser(user.name); }}
                        className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors duration-100 ${
                          i > 0 ? 'border-t border-brand-border-subtle' : ''
                        } ${i === selectedIdx ? 'bg-brand/15' : 'hover:bg-brand-surface-hover'}`}
                      >
                        <span className="w-7 h-7 rounded-full bg-brand-surface-hover flex items-center justify-center text-xs font-semibold text-brand-text-secondary flex-shrink-0">
                          {user.displayName.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-brand-text block">{user.displayName}</span>
                          <span className="text-xs text-brand-muted block">{user.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* User list */}
              {safeWatchedUsers.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-brand-muted">No watched users yet</p>
                </div>
              ) : (
                safeWatchedUsers.map((user, i) => (
                  <div
                    key={user}
                    className={`flex items-center justify-between px-4 py-2.5 group ${
                      i > 0 ? 'border-t border-brand-border-subtle' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-brand-surface-hover flex items-center justify-center text-xs font-semibold text-brand-text-secondary">
                        {user.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm text-brand-text-secondary">{user}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(user)}
                      className="text-brand-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150"
                      aria-label={`Remove ${user}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
