import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from './connectionStore';
import { ConnectionCard } from './ConnectionCard';
import { ConnectionForm } from './ConnectionForm';
import { useTicketStore } from '../tickets/ticketStore';
import { useThemeStore, type ThemeMode } from '../theme/themeStore';
import { useLanguageStore, type Language } from '../../i18n/languageStore';
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

type ActiveSection =
  | 'source'
  | 'destination'
  | 'jql-presets'
  | 'watched-users'
  | 'theme'
  | 'language';

export function SettingsPage({ onClose, onEdit: _onEdit }: SettingsPageProps) {
  const { t } = useTranslation();

  const [activeSection, setActiveSection] = useState<ActiveSection>('source');

  const PRESET_OPTIONS: { value: JqlPreset; label: string; jql: string }[] = [
    { value: 'assigned', label: t('settings.preset.assigned'), jql: 'assignee = currentUser() ORDER BY updated DESC' },
    { value: 'mentioned', label: t('settings.preset.mentioned'), jql: 'text ~ currentUser() ORDER BY updated DESC' },
    { value: 'all_watched', label: t('settings.preset.allWatched'), jql: 'assignee in (currentUser(), ...watched) ORDER BY updated DESC' },
    { value: 'custom', label: t('settings.preset.custom'), jql: 'You write the JQL' },
  ];

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  // Sidebar nav item component
  function NavItem({ section, label }: { section: ActiveSection; label: string }) {
    const isActive = activeSection === section;
    return (
      <button
        type="button"
        onClick={() => setActiveSection(section)}
        className={`w-full text-left text-[13px] rounded-md px-3 py-[7px] transition-all duration-200 ${
          isActive
            ? 'bg-brand/10 text-brand font-medium'
            : 'text-brand-muted hover:text-brand-text-secondary hover:bg-brand-surface-hover'
        }`}
      >
        {label}
      </button>
    );
  }

  // Content card wrapper
  function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div>
        <h2 className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-3">{title}</h2>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
          {children}
        </div>
      </div>
    );
  }

  function renderContent() {
    if (hasNoConnections) {
      return (
        <div className="text-center py-16">
          <p className="text-brand-text-secondary text-sm font-semibold mb-1">
            {t('settings.noConnections')}
          </p>
          <p className="text-brand-muted text-xs">
            {t('settings.noConnections.hint')}
          </p>
        </div>
      );
    }

    switch (activeSection) {
      case 'source':
        return (
          <SectionCard title={t('settings.section.source')}>
            {editingConnection === 'server' ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium text-brand-text">{t('settings.editSource')}</span>
                  <button
                    type="button"
                    onClick={() => setEditingConnection(null)}
                    className="text-[11px] text-brand-muted hover:text-brand-text transition-colors duration-200"
                  >
                    {t('settings.cancel')}
                  </button>
                </div>
                <ConnectionForm
                  connectionType="server"
                  initialValues={{ baseUrl: serverConn?.baseUrl, username: serverConn?.username }}
                  onTestSuccess={(result, creds) => handleEditTestSuccess('server', result, creds as unknown as { baseUrl: string; [key: string]: string })}
                  onTestInvalidated={() => {}}
                />
              </div>
            ) : (
              <ConnectionCard
                label={t('settings.sourceLabel')}
                connection={serverConn}
                onEdit={() => handleEdit('server')}
              />
            )}
          </SectionCard>
        );

      case 'destination':
        return (
          <SectionCard title={t('settings.section.destination')}>
            {editingConnection === 'cloud' ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium text-brand-text">{t('settings.editDestination')}</span>
                  <button
                    type="button"
                    onClick={() => setEditingConnection(null)}
                    className="text-[11px] text-brand-muted hover:text-brand-text transition-colors duration-200"
                  >
                    {t('settings.cancel')}
                  </button>
                </div>
                <ConnectionForm
                  connectionType="cloud"
                  initialValues={{ baseUrl: cloudConn?.baseUrl, username: cloudConn?.username }}
                  onTestSuccess={(result, creds) => handleEditTestSuccess('cloud', result, creds as unknown as { baseUrl: string; [key: string]: string })}
                  onTestInvalidated={() => {}}
                />
              </div>
            ) : (
              <ConnectionCard
                label={t('settings.destLabel')}
                connection={cloudConn}
                onEdit={() => handleEdit('cloud')}
              />
            )}
          </SectionCard>
        );

      case 'jql-presets':
        return (
          <SectionCard title={t('settings.section.jqlPresets')}>
            <div className="space-y-1.5">
              {PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handlePresetChange(opt.value)}
                  className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-150 ${
                    jqlPreset === opt.value
                      ? 'bg-brand/8 ring-1 ring-brand/20'
                      : 'hover:bg-brand-surface-hover'
                  }`}
                >
                  <span className={`flex-shrink-0 w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
                    jqlPreset === opt.value ? 'border-brand' : 'border-brand-border'
                  }`}>
                    {jqlPreset === opt.value && (
                      <span className="w-[7px] h-[7px] rounded-full bg-brand" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[13px] block ${
                      jqlPreset === opt.value ? 'text-brand-text font-medium' : 'text-brand-text-secondary'
                    }`}>{opt.label}</span>
                    <span className="text-[11px] text-brand-muted block truncate font-mono mt-0.5">{opt.jql}</span>
                  </div>
                </button>
              ))}
            </div>

            {jqlPreset === 'custom' && (
              <div className="mt-3 pt-3 border-t border-brand-border-subtle">
                <textarea
                  value={jqlCustom ?? ''}
                  onChange={(e) => handleJqlCustomChange(e.target.value)}
                  className="w-full rounded-lg border border-brand-border bg-brand-bg text-brand-text px-3 py-2.5 resize-none h-20 font-mono text-xs focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/15 transition-colors duration-200"
                  placeholder={t('settings.jql.placeholder')}
                  autoFocus
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={handleResetJql}
                    className="text-[11px] text-brand-muted hover:text-brand-text transition-colors duration-200"
                  >
                    {t('settings.jql.reset')}
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        );

      case 'watched-users':
        return (
          <SectionCard title={t('settings.section.watchedUsers')}>
            <p className="text-[12px] text-brand-muted mb-4">
              {t('settings.watchedUsers.hint')}
            </p>

            {/* Search input */}
            <div className="relative mb-4">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-brand-border bg-brand-bg focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/15 transition-all duration-200">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-muted flex-shrink-0" aria-hidden="true">
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
                  className="flex-1 bg-transparent text-[13px] text-brand-text placeholder-brand-muted focus:outline-none"
                  placeholder={t('settings.watchedUsers.searchPlaceholder')}
                />
              </div>

              {/* No results feedback */}
              {noResults && userQuery.trim() && !showSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 border border-brand-border rounded-lg bg-brand-surface shadow-lg px-3.5 py-2.5">
                  <p className="text-[11px] text-brand-muted">{t('settings.watchedUsers.noResults', { query: userQuery.trim() })}</p>
                </div>
              )}

              {/* Dropdown suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 border border-brand-border rounded-lg bg-brand-surface shadow-lg overflow-hidden">
                  {suggestions.map((user, i) => (
                    <button
                      key={user.name}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleAddUser(user.name); }}
                      className={`w-full text-left flex items-center gap-2.5 px-3.5 py-2 transition-colors duration-100 ${
                        i > 0 ? 'border-t border-brand-border-subtle' : ''
                      } ${i === selectedIdx ? 'bg-brand/10' : 'hover:bg-brand-surface-hover'}`}
                    >
                      <span className="w-6 h-6 rounded-full bg-brand/8 flex items-center justify-center text-[11px] font-semibold text-brand flex-shrink-0">
                        {user.displayName.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] text-brand-text block">{user.displayName}</span>
                        <span className="text-[11px] text-brand-muted block">{user.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User list */}
            {safeWatchedUsers.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[12px] text-brand-muted">{t('settings.watchedUsers.empty')}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {safeWatchedUsers.map((user) => (
                  <div
                    key={user}
                    className="flex items-center justify-between px-3 py-2 rounded-lg group hover:bg-brand-surface-hover transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-brand/8 flex items-center justify-center text-[11px] font-semibold text-brand">
                        {user.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[13px] text-brand-text-secondary">{user}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(user)}
                      className="text-brand-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-150"
                      aria-label={t('settings.watchedUsers.remove', { user })}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );

      case 'theme':
        return (
          <SectionCard title={t('settings.section.theme')}>
            <ThemeSection />
          </SectionCard>
        );

      case 'language':
        return (
          <SectionCard title={t('settings.section.language')}>
            <LanguageSection />
          </SectionCard>
        );
    }
  }

  return (
    <div className="flex h-full bg-brand-bg">
      {/* Left sidebar */}
      <div className="w-[200px] flex-shrink-0 border-r border-brand-border py-5 px-3 flex flex-col">
        {/* Back button + heading */}
        <div className="flex items-center gap-2 mb-6 px-1">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded-md transition-colors duration-200"
            aria-label={t('settings.back')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold tracking-tight text-brand-text">{t('settings.heading')}</h1>
        </div>

        {/* Connections group */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold text-brand-muted/70 uppercase tracking-widest mb-1.5 px-3">
            {t('settings.group.connections')}
          </p>
          <div className="space-y-0.5">
            <NavItem section="source" label={t('settings.nav.source')} />
            <NavItem section="destination" label={t('settings.nav.destination')} />
          </div>
        </div>

        {/* Fetching group */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold text-brand-muted/70 uppercase tracking-widest mb-1.5 px-3">
            {t('settings.group.fetching')}
          </p>
          <div className="space-y-0.5">
            <NavItem section="jql-presets" label={t('settings.nav.jqlPresets')} />
            <NavItem section="watched-users" label={t('settings.nav.watchedUsers')} />
          </div>
        </div>

        {/* Appearance group */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold text-brand-muted/70 uppercase tracking-widest mb-1.5 px-3">
            {t('settings.group.appearance')}
          </p>
          <div className="space-y-0.5">
            <NavItem section="theme" label={t('settings.nav.theme')} />
            <NavItem section="language" label={t('settings.nav.language')} />
          </div>
        </div>
      </div>

      {/* Right content panel */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        <div className="max-w-[560px]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function ThemeSection() {
  const { t } = useTranslation();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: t('settings.theme.light'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: t('settings.theme.dark'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: t('settings.theme.system'),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex gap-2">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setMode(opt.value)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] transition-all duration-200 ${
            mode === opt.value
              ? 'border-brand/30 bg-brand/8 text-brand-text font-medium ring-1 ring-brand/10'
              : 'border-brand-border text-brand-muted hover:text-brand-text-secondary hover:bg-brand-surface-hover'
          }`}
        >
          <span className={`transition-colors duration-200 ${mode === opt.value ? 'text-brand' : ''}`}>{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LanguageSection() {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const LANGUAGE_OPTIONS: { value: Language; label: string; flag: string }[] = [
    { value: 'en', label: t('settings.language.english'), flag: '🇬🇧' },
    { value: 'sk', label: t('settings.language.slovak'), flag: '🇸🇰' },
  ];

  return (
    <div className="flex gap-2">
      {LANGUAGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setLanguage(opt.value)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] transition-all duration-200 ${
            language === opt.value
              ? 'border-brand/30 bg-brand/8 text-brand-text font-medium ring-1 ring-brand/10'
              : 'border-brand-border text-brand-muted hover:text-brand-text-secondary hover:bg-brand-surface-hover'
          }`}
        >
          <span className="text-base">{opt.flag}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
