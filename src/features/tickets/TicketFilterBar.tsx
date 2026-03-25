import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TicketFilterBarProps {
  searchText: string;
  onSearchChange: (v: string) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
  resultCount: number;
}

export function TicketFilterBar({
  searchText,
  onSearchChange,
  sortDirection,
  onToggleSort,
  resultCount,
}: TicketFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-brand-border px-4 py-2 flex items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('tickets.filter.placeholder')}
          aria-label={t('tickets.filter.searchLabel')}
          className="bg-brand-surface text-sm text-brand-text rounded-md border border-brand-border px-3 py-1.5 pl-8 w-full focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {searchText && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label={t('tickets.filter.clearSearch')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Sort toggle */}
      <button
        type="button"
        onClick={onToggleSort}
        className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 shrink-0"
      >
        {sortDirection === 'desc' ? (
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
        ) : sortDirection === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {t('tickets.filter.sortUpdated')}
      </button>

      {/* Result count */}
      <span className="text-xs text-brand-muted shrink-0">
        {t('tickets.filter.showing', { count: resultCount })}
      </span>
    </div>
  );
}
