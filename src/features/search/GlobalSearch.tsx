import { Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { announce } from '../../components/LiveAnnouncer';
import { SearchResultRow } from './SearchResultRow';
import { searchTickets } from './searchIndex';
import { useSearchStore } from './searchStore';
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS } from './types';
import { useSearchCorpus } from './useSearchCorpus';

interface GlobalSearchProps {
  /** Returns true when the host navigated to the ticket, false when it refused. */
  onOpenTicket: (key: string) => boolean;
  /** Optional external ref to the combobox input (the palette focuses + selects it). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Always-expanded combobox shown inside the search palette. Mounting means the
 * user opened search, so the corpus is enabled immediately and a stored query
 * shows its results right away. Closing (Escape, backdrop) is owned by the dialog.
 */
export function GlobalSearch({ onOpenTicket, inputRef: externalRef }: GlobalSearchProps) {
  const { t } = useTranslation();
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clearQuery = useSearchStore((s) => s.clearQuery);

  const [debounced, setDebounced] = useState(query);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const id = useId();
  const listboxId = `${id}-listbox`;
  const optId = (i: number) => `${id}-opt-${i}`;
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const announcedOnce = useRef(false);
  // Set once the host accepted a navigation; suppresses a late count announcement (37.3 WR-01).
  const navigatedRef = useRef(false);

  // Debounce the query that drives the search (D-16).
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { items, ready } = useSearchCorpus(true);
  const result = useMemo(() => searchTickets(items, debounced), [items, debounced]);
  const panelVisible = ready && debounced.trim().length >= SEARCH_MIN_CHARS;
  const hasHits = panelVisible && result.hits.length > 0;

  // The active option is tracked by ticket key so corpus rebuilds (polls, triage)
  // do not move the highlight. It resets only when the debounced query changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: debounced is the trigger
  useEffect(() => {
    setActiveKey(null);
  }, [debounced]);
  const active = activeKey ? result.hits.findIndex((h) => h.item.ticket.key === activeKey) : -1;

  // Announce the count after each debounced search (not on mount, not on selection).
  // A debounce that settles after Enter navigated away must not overwrite the live
  // region with a stale count (37.3 WR-01).
  const total = result.total;
  // biome-ignore lint/correctness/useExhaustiveDependencies: announce only when the debounced search settles
  useEffect(() => {
    if (!announcedOnce.current) {
      announcedOnce.current = true;
      return;
    }
    if (navigatedRef.current || !ready || debounced.trim().length < SEARCH_MIN_CHARS) return;
    announce(total === 0 ? t('search.live.none') : t('search.live.count', { count: total }));
  }, [debounced, ready, total]);

  // Keep the active option visible.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, id]);

  function handleChange(value: string) {
    navigatedRef.current = false;
    setQuery(value);
    setActiveKey(null);
  }

  function navigate(key: string): boolean {
    if (!onOpenTicket(key)) return false;
    navigatedRef.current = true;
    setActiveKey(null);
    return true;
  }

  function openHit(index: number) {
    const hit = result.hits[index];
    if (!hit) return;
    navigate(hit.item.ticket.key);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const count = result.hits.length;
    switch (e.key) {
      // Arrows/Home/End while query !== debounced move through the stale result.
      // This is a brief flicker only: the [debounced] effect clears activeKey and
      // Enter on a pending query ignores activeKey (flushes against the live query).
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!panelVisible) return;
        e.preventDefault();
        if (count === 0) return;
        {
          const next =
            e.key === 'ArrowDown'
              ? active + 1 >= count
                ? 0
                : active + 1
              : active <= 0
                ? count - 1
                : active - 1;
          setActiveKey(result.hits[next].item.ticket.key);
        }
        return;
      }
      case 'Home':
      case 'End': {
        if (!hasHits) return;
        e.preventDefault();
        setActiveKey(result.hits[e.key === 'Home' ? 0 : count - 1].item.ticket.key);
        return;
      }
      case 'Enter': {
        if (query !== debounced) {
          e.preventDefault();
          if (ready && query.trim().length >= SEARCH_MIN_CHARS) {
            const fresh = searchTickets(items, query).hits[0];
            // Navigated: do not flush debounced, so no count is announced (WR-01).
            if (fresh && navigate(fresh.item.ticket.key)) return;
          }
          // Staying in the palette: flush so it shows the live result.
          setDebounced(query);
          return;
        }
        if (!hasHits) return;
        e.preventDefault();
        openHit(active >= 0 ? active : 0);
        return;
      }
      default:
    }
  }

  function handleClear() {
    navigatedRef.current = false;
    clearQuery();
    setDebounced('');
    setActiveKey(null);
    inputRef.current?.focus();
  }

  return (
    <div className="w-full">
      <div className="relative border-b border-brand-border">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
          aria-expanded={hasHits}
          aria-controls={hasHits ? listboxId : undefined}
          aria-activedescendant={hasHits && active >= 0 ? optId(active) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full bg-transparent border-0 pl-10 pr-10 text-base text-brand-text focus:outline-none"
        />
        {query.length > 0 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            <button
              type="button"
              onClick={handleClear}
              aria-label={t('search.clear')}
              className="flex items-center justify-center w-6 h-6 rounded text-brand-text-secondary hover:text-brand-text transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand"
            >
              <X className="w-3.5 h-3.5 text-brand-muted" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {query.trim().length < SEARCH_MIN_CHARS && (
        <p className="px-3 py-2 text-xs text-brand-text-secondary">
          {t('search.hint.minChars', { min: SEARCH_MIN_CHARS })}
        </p>
      )}
      {panelVisible && (
        <div className="max-h-[480px] overflow-y-auto">
          {result.hits.length > 0 ? (
            <>
              <ul
                id={listboxId}
                // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: ul role=listbox with li role=option children per ARIA combobox pattern
                role="listbox"
                aria-label={t('search.listLabel')}
                className="list-none m-0 p-0"
              >
                {result.hits.map((hit, i) => (
                  <SearchResultRow
                    key={hit.item.ticket.key}
                    hit={hit}
                    words={result.words}
                    id={optId(i)}
                    active={i === active}
                    onSelect={() => openHit(i)}
                    onHover={() => setActiveKey(hit.item.ticket.key)}
                  />
                ))}
              </ul>
              {result.total > result.hits.length && (
                <div className="px-4 py-2 border-t border-brand-border text-xs text-brand-text-secondary">
                  {t('search.footer.truncated', {
                    shown: result.hits.length,
                    total: result.total,
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="py-6 px-4 text-center">
              <p className="text-base font-semibold text-brand-text">{t('search.empty.title')}</p>
              <p className="text-sm text-brand-text-secondary">{t('search.empty.hint')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
