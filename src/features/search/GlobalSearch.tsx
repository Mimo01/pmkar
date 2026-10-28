import { Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { announce } from '../../components/LiveAnnouncer';
import { SearchResultRow } from './SearchResultRow';
import { searchTickets } from './searchIndex';
import { useSearchStore } from './searchStore';
import { shortcutHint, useSearchShortcut } from './shortcut';
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS } from './types';
import { useSearchCorpus } from './useSearchCorpus';

interface GlobalSearchProps {
  /** Returns true when the host navigated to the ticket, false when it refused. */
  onOpenTicket: (key: string) => boolean;
}

export function GlobalSearch({ onOpenTicket }: GlobalSearchProps) {
  const { t } = useTranslation();
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clearQuery = useSearchStore((s) => s.clearQuery);

  const [debounced, setDebounced] = useState(query);
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  const id = useId();
  const listboxId = `${id}-listbox`;
  const optId = (i: number) => `${id}-opt-${i}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const announcedOnce = useRef(false);

  useSearchShortcut(inputRef);

  // Debounce the query that drives the search (D-16).
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { items, ready } = useSearchCorpus(activated);
  const result = useMemo(() => searchTickets(items, debounced), [items, debounced]);
  const panelVisible = open && ready && debounced.trim().length >= SEARCH_MIN_CHARS;
  const hasHits = panelVisible && result.hits.length > 0;

  // The active option is tracked by ticket key so corpus rebuilds (polls, triage)
  // do not move the highlight. It resets only when the debounced query changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: debounced is the trigger
  useEffect(() => {
    setActiveKey(null);
  }, [debounced]);
  const active = activeKey ? result.hits.findIndex((h) => h.item.ticket.key === activeKey) : -1;

  // Announce the count after each debounced search (not on mount, not on selection).
  // Only while the panel is open: a debounce that settles after Enter navigated away
  // must not overwrite the live region with a count for a closed panel (37.3 WR-01).
  const total = result.total;
  // biome-ignore lint/correctness/useExhaustiveDependencies: announce only when the debounced search settles; open is read but intentionally not a trigger
  useEffect(() => {
    if (!announcedOnce.current) {
      announcedOnce.current = true;
      return;
    }
    if (!open || !ready || debounced.trim().length < SEARCH_MIN_CHARS) return;
    announce(total === 0 ? t('search.live.none') : t('search.live.count', { count: total }));
  }, [debounced, ready, total]);

  // Keep the active option visible.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, id]);

  // Click outside closes the dropdown without clearing.
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setActivated(true);
    setActiveKey(null);
    setOpen(value.trim().length >= SEARCH_MIN_CHARS);
  }

  function handleFocus() {
    setActivated(true);
    if (query.trim().length >= SEARCH_MIN_CHARS) setOpen(true);
  }

  function openHit(index: number) {
    const hit = result.hits[index];
    if (!hit) return;
    if (onOpenTicket(hit.item.ticket.key)) {
      setOpen(false);
      setActiveKey(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const count = result.hits.length;
    switch (e.key) {
      // Arrows/Home/End while query !== debounced move through the stale result.
      // This is a brief flicker only: the [debounced] effect clears activeKey and
      // Enter on a pending query ignores activeKey (flushes against the live query).
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!panelVisible) {
          if (query.trim().length >= SEARCH_MIN_CHARS) {
            e.preventDefault();
            setActivated(true);
            setOpen(true);
          }
          return;
        }
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
          if (open && ready && query.trim().length >= SEARCH_MIN_CHARS) {
            const fresh = searchTickets(items, query).hits[0];
            if (fresh && onOpenTicket(fresh.item.ticket.key)) {
              // Navigated: do not flush debounced, so no count is announced (WR-01).
              setOpen(false);
              setActiveKey(null);
              return;
            }
          }
          // Staying in the dropdown: flush so it shows the live result.
          setDebounced(query);
          return;
        }
        if (!hasHits) return;
        e.preventDefault();
        openHit(active >= 0 ? active : 0);
        return;
      }
      case 'Escape': {
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActiveKey(null);
        } else if (query.length > 0) {
          e.preventDefault();
          clearQuery();
          setDebounced('');
        }
        return;
      }
      case 'Tab':
        setOpen(false);
        return;
      default:
    }
  }

  function handleClear() {
    clearQuery();
    setDebounced('');
    setOpen(false);
    setActiveKey(null);
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
        aria-expanded={hasHits}
        aria-controls={hasHits ? listboxId : undefined}
        aria-activedescendant={hasHits && active >= 0 ? optId(active) : undefined}
        aria-autocomplete="list"
        aria-keyshortcuts="Control+K Meta+K Control+F Meta+F"
        autoComplete="off"
        spellCheck={false}
        className="bg-brand-surface/50 text-sm text-brand-text rounded-md border border-brand-border px-3 py-1.5 pl-8 pr-16 h-8 w-full focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
        {query.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t('search.clear')}
            className="flex items-center justify-center w-6 h-6 rounded text-brand-text-secondary hover:text-brand-text transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-brand"
          >
            <X className="w-3.5 h-3.5 text-brand-muted" aria-hidden="true" />
          </button>
        ) : (
          <span
            aria-hidden="true"
            className="text-xs text-brand-text-secondary border border-brand-border rounded px-1"
          >
            {shortcutHint()}
          </span>
        )}
      </div>
      {panelVisible && (
        <div className="absolute left-0 top-full mt-1 w-[560px] max-w-[calc(100vw-32px)] max-h-[480px] overflow-y-auto z-50 rounded-md border border-brand-border bg-brand-surface shadow-lg">
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
