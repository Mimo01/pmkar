import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTicketStore } from './ticketStore';
import { TicketCard } from './TicketCard';
import { Badge } from '@/components/ui/badge';
import type { JiraTicket } from './types';

export function LinkedTicketsPage() {
  const { t } = useTranslation();
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Empty state */}
      {copiedTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('linked.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('linked.empty.body')}</p>
        </div>
      )}

      {/* Card list */}
      {copiedTickets.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {sorted.map((ticket) => (
            <TicketCard
              key={ticket.key}
              ticket={ticket}
              triageEntry={triageMap[ticket.key]}
              onClick={() => handleSelectTicket(ticket.key)}
              actionSlot={
                triageMap[ticket.key]?.copiedKey ? (
                  <Badge variant="outline" className="text-xs font-mono">
                    {triageMap[ticket.key].copiedKey}
                  </Badge>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
