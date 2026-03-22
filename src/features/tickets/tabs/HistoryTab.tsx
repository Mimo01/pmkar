import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ChangelogEntry } from '../types';

interface HistoryTabProps {
  issueKey: string;
  baseUrl: string;
}

function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function HistoryTab({ issueKey, baseUrl }: HistoryTabProps) {
  const [histories, setHistories] = useState<ChangelogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchChangelog() {
      try {
        const result = await invoke<{ histories: ChangelogEntry[] }>(
          'fetch_changelog',
          { baseUrl, issueKey },
        );
        if (!cancelled) {
          setHistories(result.histories);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load history',
          );
        }
      }
    }

    fetchChangelog();
    return () => {
      cancelled = true;
    };
  }, [issueKey, baseUrl]);

  // Loading state
  if (histories === null && error === null) {
    return (
      <div className="px-5 py-4" aria-busy="true" aria-live="polite">
        <p className="text-xs text-brand-muted mb-3">Loading history...</p>
        <div className="space-y-2" aria-hidden="true">
          <div className="animate-pulse bg-brand-surface-hover rounded h-3" />
          <div className="animate-pulse bg-brand-surface-hover rounded h-3" />
          <div className="animate-pulse bg-brand-surface-hover rounded h-3" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="px-5 py-4">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!histories || histories.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-brand-muted">No change history</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-brand-border-subtle px-5">
      {histories.map((entry) => (
        <div key={entry.id} className="py-3">
          <div className="flex items-center gap-2 pb-1">
            <span className="text-xs font-semibold text-brand-text-secondary">
              {entry.author.displayName}
            </span>
            <span className="text-xs text-brand-muted">
              {formatDate(entry.created)}
            </span>
          </div>
          <div className="space-y-1">
            {entry.items.map((item, idx) => (
              <div key={idx} className="text-xs text-brand-text-secondary">
                <span className="font-semibold">{item.field}</span>
                {': '}
                {item.fromString && (
                  <span className="text-brand-muted">{item.fromString}</span>
                )}
                {item.fromString && ' \u2192 '}
                {item.toString && (
                  <span className="text-brand-text-secondary">{item.toString}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
