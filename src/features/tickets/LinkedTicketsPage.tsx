import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../../lib/format';
import { useTicketStore } from './ticketStore';
import { useConnectionStore } from '../connections/connectionStore';
import { TicketDetailPanel } from './TicketDetailPanel';
import type { JiraTicket } from './types';

export function LinkedTicketsPage() {
  const { t } = useTranslation();
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const selectedTicketKey = useTicketStore((s) => s.selectedTicketKey);

  const copiedTickets = useMemo(
    () => tickets.filter((t) => triageMap[t.key]?.state === 'copied'),
    [tickets, triageMap],
  );

  const sorted = useMemo(
    () =>
      [...copiedTickets].sort(
        (a: JiraTicket, b: JiraTicket) =>
          new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime(),
      ),
    [copiedTickets],
  );

  function handleSelectTicket(key: string) {
    useTicketStore.getState().selectTicket(key);
  }

  // Only show detail panel if the selected ticket is in this tab's list
  const showDetail = selectedTicketKey && copiedTickets.some((t) => t.key === selectedTicketKey);

  return (
    <div className="flex h-[calc(100vh-113px)] overflow-hidden">
      {/* Left pane: ticket list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {copiedTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-16">
            <p className="text-sm font-semibold text-brand-text-secondary mb-1">{t('linked.empty')}</p>
            <p className="text-xs text-brand-muted">
              {t('linked.empty.hint')}
            </p>
          </div>
        )}

        {copiedTickets.length > 0 && (
          <div className="overflow-y-auto flex-1">
            <table className="w-full table-fixed">
              <thead className="bg-brand-surface border-b-2 border-brand-border sticky top-0 z-10">
                <tr>
                  <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('linked.col.key')}
                  </th>
                  <th className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('linked.col.summary')}
                  </th>
                  <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('linked.col.status')}
                  </th>
                  <th className="w-18 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('linked.col.priority')}
                  </th>
                  <th className="w-30 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('linked.col.assignee')}
                  </th>
                  <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                    {t('linked.col.updated')}
                  </th>
                  <th className="w-28 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                    {t('linked.col.linkedKey')}
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
                    <td className="w-28 px-4 py-3">
                      {triageMap[ticket.key]?.copiedKey && (
                        <span className="text-xs font-semibold text-brand border border-brand/30 rounded px-2 py-1">
                          {triageMap[ticket.key].copiedKey}
                        </span>
                      )}
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
