import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTicketStore } from '../ticketStore';

interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

/** Human-readable field labels for display. */
const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  summary: 'Summary',
  description: 'Description',
  labels: 'Labels',
  components: 'Components',
  fix_versions: 'Fix Versions',
  comment_count: 'Comments',
  attachment_count: 'Attachments',
  worklog_count: 'Work Log',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Long-text fields that should not show inline diffs (D-09). */
const LONG_TEXT_FIELDS = new Set(['description']);

interface ChangesTabProps {
  issueKey: string;
}

export function ChangesTab({ issueKey }: ChangesTabProps) {
  const { t } = useTranslation();
  const [changes, setChanges] = useState<FieldChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndClear() {
      try {
        const result = await invoke<FieldChange[]>('get_ticket_changes', { ticketKey: issueKey });
        if (!cancelled) {
          if (result.length > 0) {
            setChanges(result);
            await invoke('mark_changes_seen', { ticketKey: issueKey });
            useTicketStore.getState().clearUnseenChange(issueKey);
          } else {
            // DB has no pending_changes_json — fall back to store field names
            const fields = useTicketStore.getState().unseenChanges[issueKey];
            if (fields && fields.length > 0) {
              setChanges(fields.map((f) => ({ field: f, oldValue: null, newValue: null })));
              await invoke('mark_changes_seen', { ticketKey: issueKey });
              useTicketStore.getState().clearUnseenChange(issueKey);
            } else {
              setChanges([]);
            }
          }
        }
      } catch {
        if (!cancelled) {
          // On error, still try to show store field names
          const fields = useTicketStore.getState().unseenChanges[issueKey];
          if (fields && fields.length > 0) {
            setChanges(fields.map((f) => ({ field: f, oldValue: null, newValue: null })));
          } else {
            setError('Failed to load changes');
          }
        }
      }
    }

    fetchAndClear();
    return () => {
      cancelled = true;
    };
  }, [issueKey]);

  // Loading state — mirrors HistoryTab exactly
  if (changes === null && error === null) {
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
        <p className="text-xs text-red-400">{t('detail.changes.error')}</p>
      </div>
    );
  }

  // Empty state — matches HistoryTab empty state layout
  if (!changes || changes.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-xs text-brand-muted">{t('detail.tab.changes.empty')}</p>
      </div>
    );
  }

  // Diff table (D-07, D-08, D-09)
  return (
    <div className="px-5 py-4">
      <table className="w-full">
        <tbody className="divide-y divide-brand-border-subtle">
          {changes.map((change) => (
            <tr key={change.field}>
              <td className="py-2 pr-3 text-sm font-semibold text-brand-text-secondary whitespace-nowrap align-top">
                {fieldLabel(change.field)}
              </td>
              <td className="py-2 pr-2 text-sm text-brand-muted align-top">
                {LONG_TEXT_FIELDS.has(change.field)
                  ? t('detail.changes.noPreview')
                  : (change.oldValue ?? t('detail.changes.noPreview'))}
              </td>
              <td className="py-2 px-2 text-xs text-brand-muted text-center align-top">
                {'\u2192'}
              </td>
              <td className="py-2 pl-2 text-sm text-brand-text align-top">
                {LONG_TEXT_FIELDS.has(change.field)
                  ? t('detail.changes.descriptionChanged')
                  : (change.newValue ?? t('detail.changes.noPreview'))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
