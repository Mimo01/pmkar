import { invoke } from '@tauri-apps/api/core';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../connections/connectionStore';
import type { JiraUser } from './types';
import { UserAvatar } from './UserAvatar';

interface TicketFilterBarProps {
  searchText: string;
  onSearchChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (v: string) => void;
  sortField: 'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee';
  onSortFieldChange: (
    f: 'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee',
  ) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
  resultCount: number;
}

export function TicketFilterBar({
  searchText,
  onSearchChange,
  assigneeFilter,
  onAssigneeChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onToggleSort,
  resultCount,
}: TicketFilterBarProps) {
  const { t } = useTranslation();
  const serverConn = useConnectionStore((s) => s.serverConnection);

  // Assignee autocomplete state
  const [userQuery, setUserQuery] = useState('');
  const [suggestions, setSuggestions] = useState<JiraUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [selectedUser, setSelectedUser] = useState<JiraUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click-outside closes dropdown
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function handleUserQueryChange(value: string) {
    setUserQuery(value);
    setSelectedIdx(-1);
    setNoResults(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!serverConn) return;
      try {
        const users = await invoke<JiraUser[]>('search_jira_users', {
          baseUrl: serverConn.baseUrl,
          query: value.trim(),
        });
        setSuggestions(users);
        setNoResults(users.length === 0);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
        setNoResults(false);
        setShowSuggestions(false);
      }
    }, 250);
  }

  function selectUser(user: JiraUser) {
    onAssigneeChange(user.displayName);
    setSelectedUser(user);
    setUserQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIdx(-1);
  }

  function handleAssigneeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
        selectUser(suggestions[selectedIdx]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIdx(-1);
    }
  }

  return (
    <div className="border-b border-brand-border px-4 py-1.5 flex items-center gap-2.5">
      {/* Key search input */}
      <div className="relative max-w-[200px] w-full">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('tickets.filter.keyPlaceholder')}
          aria-label={t('tickets.filter.searchLabel')}
          className="bg-brand-surface/50 text-sm text-brand-text rounded-md border border-brand-border px-3 py-1.5 pl-8 h-8 w-full focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {searchText && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('tickets.filter.clearSearch')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Assignee autocomplete */}
      <div className="relative max-w-[220px] w-full">
        {assigneeFilter ? (
          /* Selected assignee chip */
          <span className="inline-flex items-center gap-1 bg-brand/10 text-brand text-sm rounded-full px-2.5 py-0.5 h-8">
            <UserAvatar user={selectedUser} size="sm" />
            <span className="truncate max-w-[140px]">{assigneeFilter}</span>
            <button
              type="button"
              onClick={() => {
                onAssigneeChange('');
                setSelectedUser(null);
              }}
              aria-label={t('tickets.filter.clearAssignee')}
              className="shrink-0 text-brand/70 hover:text-brand transition-colors duration-150"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </span>
        ) : (
          /* Assignee search input */
          <>
            <input
              ref={inputRef}
              type="text"
              value={userQuery}
              onChange={(e) => handleUserQueryChange(e.target.value)}
              onKeyDown={handleAssigneeKeyDown}
              placeholder={t('tickets.filter.assigneePlaceholder')}
              aria-label={t('tickets.filter.assigneePlaceholder')}
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
              role="combobox"
              className="bg-brand-surface/50 text-sm text-brand-text rounded-md border border-brand-border px-3 py-1.5 h-8 w-full focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {/* Suggestions dropdown */}
            {showSuggestions && (
              <div
                ref={dropdownRef}
                role="listbox"
                className="absolute top-full left-0 right-0 mt-1 bg-brand-surface border border-brand-border shadow-lg rounded-md max-h-48 overflow-y-auto z-50"
              >
                {noResults ? (
                  <div className="px-3 py-2 text-sm text-brand-muted">
                    {t('tickets.filter.noUsersFound')}
                  </div>
                ) : (
                  suggestions.map((user, idx) => (
                    <button
                      key={user.accountId ?? user.name ?? user.displayName}
                      type="button"
                      role="option"
                      aria-selected={idx === selectedIdx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectUser(user);
                      }}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer transition-colors duration-100 flex items-center gap-1.5 ${
                        idx === selectedIdx ? 'bg-brand/10' : 'hover:bg-brand/10'
                      }`}
                    >
                      <UserAvatar user={user} size="sm" />
                      <span className="text-brand-text">{user.displayName}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-0.5 shrink-0">
        <select
          value={sortField}
          onChange={(e) =>
            onSortFieldChange(
              e.target.value as 'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee',
            )
          }
          aria-label={t('tickets.filter.sortBy')}
          className="bg-transparent text-sm text-brand-muted hover:text-brand-text border-none outline-none cursor-pointer appearance-none transition-colors duration-150"
        >
          <option value="updated">{t('tickets.filter.sortUpdated')}</option>
          <option value="created">{t('tickets.filter.sortCreated')}</option>
          <option value="key">{t('tickets.filter.sortKey')}</option>
          <option value="priority">{t('tickets.filter.sortPriority')}</option>
          <option value="status">{t('tickets.filter.sortStatus')}</option>
          <option value="assignee">{t('tickets.filter.sortAssignee')}</option>
        </select>
        <button
          type="button"
          onClick={onToggleSort}
          aria-label={
            sortDirection === 'desc' ? t('tickets.filter.sortAsc') : t('tickets.filter.sortDesc')
          }
          className="text-brand-muted hover:text-brand-text transition-colors duration-150"
        >
          {sortDirection === 'desc' ? (
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Result count */}
      <span className="text-xs text-brand-muted shrink-0 ml-auto">
        {t('tickets.filter.showing', { count: resultCount })}
      </span>
    </div>
  );
}
