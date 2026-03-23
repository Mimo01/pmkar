import { useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTicketStore } from './ticketStore';
import type { JiraTicket } from './types';

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSeconds = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absDiff = Math.abs(diffSeconds);
  if (absDiff < 60) return rtf.format(diffSeconds, 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffSeconds / 86400), 'day');
}

function handleRestore(issueKey: string) {
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: { state: 'seen', copiedKey: null },
  });
}

export function IgnoredTicketsPage() {
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);

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

  return (
    <div className="flex flex-col h-[calc(100vh-113px)] overflow-hidden">
      {ignoredTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text-secondary mb-1">No ignored tickets</p>
          <p className="text-xs text-brand-muted">
            Tickets you mark as &quot;not mine&quot; will appear here.
          </p>
        </div>
      )}

      {ignoredTickets.length > 0 && (
        <div className="overflow-y-auto flex-1">
          <table className="w-full table-fixed">
            <thead className="bg-brand-surface border-b-2 border-brand-border sticky top-0 z-10">
              <tr>
                <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  Key
                </th>
                <th className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  Summary
                </th>
                <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  Status
                </th>
                <th className="w-18 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  Priority
                </th>
                <th className="w-30 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-left">
                  Assignee
                </th>
                <th className="w-24 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-muted px-4 py-2.5 text-right">
                  Updated
                </th>
                <th className="w-24 px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ticket) => (
                <tr
                  key={ticket.key}
                  className="border-b border-brand-border-subtle/50 hover:bg-brand-surface-hover transition-colors duration-100"
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
                    {relativeTime(ticket.fields.updated)}
                  </td>
                  <td className="w-24 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleRestore(ticket.key)}
                      className="text-xs font-semibold text-brand-muted border border-brand-border rounded px-2 py-1 hover:text-brand-text hover:border-brand-text transition-colors"
                    >
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
