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
        <p className="text-xs text-slate-500 mb-3">Loading history...</p>
        <div className="space-y-2" aria-hidden="true">
          <div className="animate-pulse bg-slate-800/60 rounded h-3" />
          <div className="animate-pulse bg-slate-800/60 rounded h-3" />
          <div className="animate-pulse bg-slate-800/60 rounded h-3" />
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
        <p className="text-xs text-slate-500">No change history</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-800/40 px-5">
      {histories.map((entry) => (
        <div key={entry.id} className="py-3">
          <div className="flex items-center gap-2 pb-1">
            <span className="text-xs font-semibold text-slate-300">
              {entry.author.displayName}
            </span>
            <span className="text-xs text-slate-500">
              {formatDate(entry.created)}
            </span>
          </div>
          <div className="space-y-1">
            {entry.items.map((item, idx) => (
              <div key={idx} className="text-xs text-slate-400">
                <span className="font-semibold">{item.field}</span>
                {': '}
                {item.fromString && (
                  <span className="text-slate-500">{item.fromString}</span>
                )}
                {item.fromString && ' \u2192 '}
                {item.toString && (
                  <span className="text-slate-300">{item.toString}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
