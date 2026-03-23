import { useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../lib/format';
import { useTicketStore } from './ticketStore';
import { useConnectionStore } from '../connections/connectionStore';
import { TicketDetailPanel } from './TicketDetailPanel';
import type { JiraTicket } from './types';

function handleRestore(issueKey: string) {
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: { state: 'seen', copiedKey: null },
  });
}

export function IgnoredTicketsPage() {
  const { t } = useTranslation();
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const selectedTicketKey = useTicketStore((s) => s.selectedTicketKey);

  const ignoredTickets = useMemo(
    () => tickets.filter((t) => triageMap[t.key]?.state === 'ignored'),
    [tickets, triageMap],
  );

  const sorted = useMemo(
    () =>
      [...ignoredTickets].sort(
        (a: JiraTicket, b: JiraTicket) =>
          new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime(),
      ),
    [ignoredTickets],
  );

  function handleSelectTicket(key: string) {
    useTicketStore.getState().selectTicket(key);
  }

  // Only show detail panel if the selected ticket is in this tab's list
  const showDetail = selectedTicketKey && ignoredTickets.some((t) => t.key === selectedTicketKey);

  return (
    <div className="flex h-[calc(100vh-113px)] overflow-hidden">
      {/* Left pane: ticket list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {ignoredTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-16">
            <p className="text-sm font-semibold text-brand-text-secondary mb-1">{t('ignored.empty')}</p>
            <p className="text-xs text-brand-muted">
              {t('ignored.empty.hint')}
            </p>
          </div>
        )}

        {ignoredTickets.length > 0 && (
          <div className="overflow-y-auto flex-1">
            <table className="w-full table-fixed">
              <thead className="bg-brand-surface border-b-2 border-brand-border sticky top-0 z-10">
                <tr>
                  <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('ignored.col.key')}
                  </th>
                  <th className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('ignored.col.summary')}
                  </th>
                  <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('ignored.col.status')}
                  </th>
                  <th className="w-18 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('ignored.col.priority')}
                  </th>
                  <th className="w-30 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('ignored.col.assignee')}
                  </th>
                  <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                    {t('ignored.col.updated')}
                  </th>
                  <th className="w-24 px-4 py-2.5">
                    <span className="sr-only">{t('ignored.col.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((ticket) => (
                  <tr
                    key={ticket.key}
                    onClick={() => handleSelectTicket(ticket.key)}
                    className={`border-b border-brand-border-subtle/50 hover:bg-brand-surface-hover transition-colors duration-100 cursor-pointer ${
                      selectedTicketKey === ticket.key ? 'bg-brand-surface-hover' : ''
                    }`}
                  >
                    <td className="w-24 px-4 py-3 text-xs font-semibold text-brand-text-secondary">
                      {ticket.key}
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-text truncate">
                      {ticket.fields.summary}
                    </td>
                    <td className="w-24 px-4 py-3 text-xs text-brand-text-secondary">
                      {ticket.fields.status.name}
                    </td>
                    <td className="w-18 px-4 py-3 text-xs text-brand-text-secondary">
                      {ticket.fields.priority.name}
                    </td>
                    <td className="w-30 px-4 py-3 text-xs text-brand-text-secondary truncate">
                      {ticket.fields.assignee?.displayName ?? ''}
                    </td>
                    <td className="w-24 px-4 py-3 text-right text-xs text-brand-muted">
                      {formatRelativeTime(ticket.fields.updated)}
                    </td>
                    <td className="w-24 px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRestore(ticket.key); }}
                        className="text-xs font-semibold text-brand-muted border border-brand-border rounded px-2 py-1 hover:text-brand-text hover:border-brand-text transition-colors"
                      >
                        {t('ignored.restore')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right pane: detail panel */}
      {showDetail ? (
        <div className="w-[45%] border-l border-brand-border bg-brand-surface flex flex-col transition-all duration-200 ease-in-out">
          <TicketDetailPanel
            issueKey={selectedTicketKey}
            baseUrl={useConnectionStore.getState().serverConnection?.baseUrl ?? ''}
            onClose={() => useTicketStore.getState().selectTicket(null)}
          />
        </div>
      ) : (
        <div className="w-0 overflow-hidden transition-all duration-200 ease-in-out" />
      )}
    </div>
  );
}
