import { invoke } from '@tauri-apps/api/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketCard } from './TicketCard';
import { useTicketStore } from './ticketStore';
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Empty state */}
      {ignoredTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('ignored.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('ignored.empty.body')}</p>
        </div>
      )}

      {/* Card list */}
      {ignoredTickets.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {sorted.map((ticket) => (
            <TicketCard
              key={ticket.key}
              ticket={ticket}
              triageEntry={triageMap[ticket.key]}
              onClick={() => handleSelectTicket(ticket.key)}
              actionSlot={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(ticket.key);
                  }}
                  className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150"
                >
                  {t('ignored.restore')}
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
