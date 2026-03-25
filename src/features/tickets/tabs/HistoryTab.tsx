import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/format';
import type { ChangelogEntry } from '../types';
import { UserAvatar } from '../UserAvatar';

interface HistoryTabProps {
  issueKey: string;
  baseUrl: string;
}

export function HistoryTab({ issueKey, baseUrl }: HistoryTabProps) {
  const { t } = useTranslation();
  const [histories, setHistories] = useState<ChangelogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchChangelog() {
      try {
        const result = await invoke<{ histories: ChangelogEntry[] }>('fetch_changelog', {
          baseUrl,
          issueKey,
        });
        if (!cancelled) {
          setHistories(result.histories);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history');
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
        <p className="text-xs text-brand-muted mb-3">{t('detail.loading')}</p>
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
        <p className="text-xs text-brand-muted">{t('detail.tab.history')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-brand-border-subtle px-5">
      {histories.map((entry) => (
        <div key={entry.id} className="py-3">
          <div className="flex items-center gap-1.5 pb-1">
            <UserAvatar user={entry.author} size="sm" />
            <span className="text-xs font-semibold text-brand-text-secondary">
              {entry.author.displayName}
            </span>
            <span className="text-xs text-brand-muted">{formatDate(entry.created)}</span>
          </div>
          <div className="space-y-1">
            {entry.items.map((item, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: changelog items have no unique ID; index within a stable entry is safe
              <div key={`${entry.id}-${idx}`} className="text-xs text-brand-text-secondary">
                <span className="font-semibold">{item.field}</span>
                {': '}
                {item.fromString && <span className="text-brand-muted">{item.fromString}</span>}
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
