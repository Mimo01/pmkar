import { useState, useMemo } from 'react';
import type { JiraTicket, TriageState } from './types';
import { TriageIndicator } from './TriageIndicator';

type SortColumn = 'key' | 'summary' | 'status' | 'priority' | 'assignee' | 'updated';
type SortDirection = 'asc' | 'desc';

interface SortState {
  col: SortColumn;
  dir: SortDirection;
}

interface TicketTableProps {
  tickets: JiraTicket[];
  triageMap: Record<string, TriageState>;
  selectedKey: string | null;
  onSelectTicket: (key: string) => void;
}

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

function ChevronIcon({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline ml-1"
      aria-hidden="true"
    >
      {direction === 'asc' ? (
        <polyline points="18 15 12 9 6 15" />
      ) : (
        <polyline points="6 9 12 15 18 9" />
      )}
    </svg>
  );
}

const COLUMNS: { key: SortColumn; label: string; width: string; align?: string }[] = [
  { key: 'key', label: 'Key', width: 'w-24' },
  { key: 'summary', label: 'Summary', width: 'flex-1' },
  { key: 'status', label: 'Status', width: 'w-24' },
  { key: 'priority', label: 'Priority', width: 'w-18' },
  { key: 'assignee', label: 'Assignee', width: 'w-30' },
  { key: 'updated', label: 'Updated', width: 'w-24', align: 'text-right' },
];

function getColumnValue(ticket: JiraTicket, col: SortColumn): string {
  switch (col) {
    case 'key':
      return ticket.key;
    case 'summary':
      return ticket.fields.summary;
    case 'status':
      return ticket.fields.status.name;
    case 'priority':
      return ticket.fields.priority.name;
    case 'assignee':
      return ticket.fields.assignee?.displayName ?? '';
    case 'updated':
      return ticket.fields.updated;
  }
}

function compareTickets(a: JiraTicket, b: JiraTicket, sort: SortState): number {
  const aVal = getColumnValue(a, sort.col);
  const bVal = getColumnValue(b, sort.col);

  let result: number;
  if (sort.col === 'updated') {
    result = new Date(aVal).getTime() - new Date(bVal).getTime();
  } else {
    result = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
  }

  return sort.dir === 'asc' ? result : -result;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-800/40" aria-hidden="true">
          <td className="px-4 py-3"><div className="animate-pulse bg-slate-800/60 rounded h-3 w-3" /></td>
          <td className="px-4 py-3"><div className="animate-pulse bg-slate-800/60 rounded h-3 w-16" /></td>
          <td className="px-4 py-3"><div className="animate-pulse bg-slate-800/60 rounded h-3 w-full" /></td>
          <td className="px-4 py-3"><div className="animate-pulse bg-slate-800/60 rounded h-3 w-14" /></td>
          <td className="px-4 py-3"><div className="animate-pulse bg-slate-800/60 rounded h-3 w-12" /></td>
          <td className="px-4 py-3"><div className="animate-pulse bg-slate-800/60 rounded h-3 w-20" /></td>
          <td className="px-4 py-3"><div className="animate-pulse bg-slate-800/60 rounded h-3 w-16" /></td>
        </tr>
      ))}
    </>
  );
}

export function TicketTable({ tickets, triageMap, selectedKey, onSelectTicket }: TicketTableProps) {
  const [sort, setSort] = useState<SortState>({ col: 'updated', dir: 'desc' });

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => compareTickets(a, b, sort)),
    [tickets, sort],
  );

  function handleSort(col: SortColumn) {
    setSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
  }

  function ariaSortValue(col: SortColumn): 'ascending' | 'descending' | 'none' {
    if (sort.col !== col) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  const isLoading = tickets.length === 0;

  return (
    <div className="overflow-y-auto flex-1" role="table" aria-label="Ticket list">
      <table className="w-full table-fixed">
        <thead className="bg-slate-900/40 border-b border-slate-800 sticky top-0 z-10">
          <tr>
            {/* Triage dot column */}
            <th className="w-6 px-2 py-2" aria-label="Triage status">
              <span className="sr-only">Triage</span>
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                role="columnheader"
                aria-sort={ariaSortValue(c.key)}
                aria-label={`Sort ${c.label} ${ariaSortValue(c.key) === 'ascending' ? 'descending' : 'ascending'}`}
                className={`${c.width === 'flex-1' ? '' : c.width} text-xs font-semibold ${
                  sort.col === c.key ? 'text-slate-300' : 'text-slate-500'
                } px-4 py-2 cursor-pointer select-none hover:text-slate-300 transition-colors duration-150 ${
                  c.align ?? 'text-left'
                }`}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                {sort.col === c.key && <ChevronIcon direction={sort.dir} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <SkeletonRows />
          ) : (
            sortedTickets.map((ticket) => {
              const isSelected = ticket.key === selectedKey;
              return (
                <tr
                  key={ticket.key}
                  role="row"
                  aria-selected={isSelected}
                  className={`border-b border-slate-800/40 hover:bg-slate-800/30 cursor-pointer transition-colors duration-150 border-l-2 ${
                    isSelected ? 'bg-slate-800/60 border-l-blue-500' : 'border-l-transparent'
                  }`}
                  onClick={() => onSelectTicket(ticket.key)}
                >
                  <td className="w-6 px-2 py-3 text-center">
                    <TriageIndicator state={triageMap[ticket.key]} />
                  </td>
                  <td className="w-24 px-4 py-3 text-xs font-semibold text-slate-400">
                    {ticket.key}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-200 truncate">
                    {ticket.fields.summary}
                  </td>
                  <td className="w-24 px-4 py-3 text-xs text-slate-300">
                    {ticket.fields.status.name}
                  </td>
                  <td className="w-18 px-4 py-3 text-xs text-slate-400">
                    {ticket.fields.priority.name}
                  </td>
                  <td className="w-30 px-4 py-3 text-xs text-slate-400 truncate">
                    {ticket.fields.assignee?.displayName ?? ''}
                  </td>
                  <td className="w-24 px-4 py-3 text-right text-xs text-slate-500">
                    {relativeTime(ticket.fields.updated)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
