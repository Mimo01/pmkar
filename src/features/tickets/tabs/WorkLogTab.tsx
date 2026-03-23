import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/format';
import type { JiraWorklog } from '../types';

interface WorkLogTabProps {
  issueKey: string;
  baseUrl: string;
}

export function WorkLogTab({ issueKey, baseUrl }: WorkLogTabProps) {
  const { t } = useTranslation();
  const [worklogs, setWorklogs] = useState<JiraWorklog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWorklogs() {
      try {
        const result = await invoke<{ worklogs: JiraWorklog[] }>(
          'fetch_worklog',
          { baseUrl, issueKey },
        );
        if (!cancelled) {
          setWorklogs(result.worklogs);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load work log',
          );
        }
      }
    }

    fetchWorklogs();
    return () => {
      cancelled = true;
    };
  }, [issueKey, baseUrl]);

  // Loading state
  if (worklogs === null && error === null) {
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
  if (!worklogs || worklogs.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-brand-muted">{t('detail.tab.worklog')}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-brand-border-subtle px-5">
      {worklogs.map((entry) => (
        <div key={entry.id} className="py-3">
          <div className="flex items-center gap-2 pb-1">
            <span className="text-xs font-semibold text-brand-text-secondary">
              {entry.author.displayName}
            </span>
            <span className="text-xs text-brand-muted">
              {formatDate(entry.started)}
            </span>
            <span className="text-xs font-semibold text-brand-text-secondary">
              {entry.timeSpent}
            </span>
          </div>
          {entry.comment && (
            <div className="text-sm text-brand-text-secondary pb-1">{entry.comment}</div>
          )}
        </div>
      ))}
    </div>
  );
}
