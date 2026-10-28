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
  const [active, setActive] = useState(-1);
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

  // Reset active option whenever the result set changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: result is the trigger
  useEffect(() => {
    setActive(-1);
  }, [result]);

  // Announce the count after each debounced search (not on mount, not on selection).
  const total = result.total;
  // biome-ignore lint/correctness/useExhaustiveDependencies: announce only when the debounced search settles
  useEffect(() => {
    if (!announcedOnce.current) {
      announcedOnce.current = true;
      return;
    }
    if (!ready || debounced.trim().length < SEARCH_MIN_CHARS) return;
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
    setActive(-1);
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
      setActive(-1);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const count = result.hits.length;
    switch (e.key) {
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
        if (e.key === 'ArrowDown') {
          setActive((i) => (i + 1 >= count ? 0 : i + 1));
        } else {
          setActive((i) => (i <= 0 ? count - 1 : i - 1));
        }
        return;
      }
      case 'Home':
      case 'End': {
        if (!hasHits) return;
        e.preventDefault();
        setActive(e.key === 'Home' ? 0 : count - 1);
        return;
      }
      case 'Enter': {
        if (!hasHits) return;
        e.preventDefault();
        openHit(active >= 0 ? active : 0);
        return;
      }
      case 'Escape': {
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
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
    setActive(-1);
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
              <div id={listboxId} role="listbox" aria-label={t('search.listLabel')}>
                {result.hits.map((hit, i) => (
                  <SearchResultRow
                    key={hit.item.ticket.key}
                    hit={hit}
                    words={result.words}
                    id={optId(i)}
                    active={i === active}
                    onSelect={() => openHit(i)}
                    onHover={() => setActive(i)}
                  />
                ))}
              </div>
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
