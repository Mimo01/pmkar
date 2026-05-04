import { useVirtualizer } from '@tanstack/react-virtual';
import { Command } from 'cmdk';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface VirtualizedComboboxProps<T> {
  items: T[];
  value: T | null;
  onChange: (selected: T) => void;
  displayLabel: (item: T) => string;
  filterFn: (item: T, query: string) => boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  onSearch?: (q: string) => Promise<T[]>;
  initialQuery?: string;
  renderItem?: (item: T) => ReactNode;
  loading?: boolean;
  ariaLabel?: string;
  /** Which edge of the trigger to anchor the popup to. Default "start" (left). */
  align?: 'start' | 'end';
  /** Height per item in px for virtualizer. Default 36. Use a larger value for multi-line renderItem. */
  itemHeight?: number;
  /** Applied to the trigger Button so DynamicTargetForm's htmlFor label wires up correctly. */
  id?: string;
}

export function VirtualizedCombobox<T>({
  items,
  value,
  onChange,
  displayLabel,
  filterFn,
  placeholder,
  searchPlaceholder,
  disabled,
  onSearch,
  initialQuery,
  renderItem,
  loading,
  ariaLabel,
  align = 'start',
  itemHeight = 36,
  id,
}: VirtualizedComboboxProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [query, setQuery] = useState('');
  const [asyncItems, setAsyncItems] = useState<T[] | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestReqRef = useRef(0);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Pitfall 1 mitigation: shouldFilter={false} on Command + manual filtering here
  const filtered = useMemo(() => {
    // Async mode: render whatever the latest onSearch returned (or items as fallback)
    if (onSearch) {
      return asyncItems ?? items;
    }
    // Sync mode: apply filterFn over local items
    if (!query) return items;
    return items.filter((item) => filterFn(item, query));
  }, [items, query, filterFn, onSearch, asyncItems]);

  // Pitfall 2 + 3 + 4 mitigation: useFlushSync: false (React 19) + fixed estimateSize
  // + scroll element with explicit height
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
    useFlushSync: false,
  });

  // Flip popup upward if insufficient space below the trigger
  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popupHeight = Math.min(filtered.length * itemHeight, 280) + 52; // 52 = search bar + borders
      setOpenUpward(rect.bottom + popupHeight + 8 > window.innerHeight);
    }
  }, [open, filtered.length, itemHeight]);

  // Outside-click close (TicketFilterBar pattern)
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleMouseDown);
      return () => document.removeEventListener('mousedown', handleMouseDown);
    }
  }, [open]);

  // D-03: initialQuery auto-trigger — re-runs only when initialQuery changes.
  // onSearch is accessed via ref to avoid re-triggering on every parent re-render.
  useEffect(() => {
    if (initialQuery && onSearchRef.current) {
      onSearchRef
        .current(initialQuery)
        .then((result) => setAsyncItems(result))
        .catch(() => setAsyncItems([]));
    }
  }, [initialQuery]); // stable: onSearch accessed via ref

  // Async search debounce (300ms — matches TicketFilterBar pattern)
  function handleQueryChange(next: string) {
    setQuery(next);
    if (!onSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length === 0) {
      setAsyncItems(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const reqId = ++latestReqRef.current;
      onSearch(next.trim())
        .then((result) => {
          if (reqId === latestReqRef.current) setAsyncItems(result);
        })
        .catch(() => {
          if (reqId === latestReqRef.current) setAsyncItems([]);
        });
    }, 300);
  }

  const triggerLabel = value
    ? displayLabel(value)
    : (placeholder ?? t('fieldRenderer.placeholder.select'));
  const searchInputPlaceholder =
    searchPlaceholder ?? placeholder ?? t('fieldRenderer.placeholder.select');

  return (
    <div className="relative w-full">
      <Button
        id={id}
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-label={ariaLabel ?? triggerLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn('w-full justify-between min-h-11')}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{triggerLabel}</span>
        {loading ? (
          <Loader2 className="ml-2 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
        )}
      </Button>

      {open && (
        <div
          ref={popoverRef}
          className={cn(
            'absolute z-50 bg-popover border border-border rounded-md shadow-md',
            'min-w-full w-max max-w-[360px]',
            align === 'end' ? 'right-0' : 'left-0',
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          <Command shouldFilter={false} className="w-full">
            <div className="flex items-center border-b border-border px-3">
              <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
              <Command.Input
                value={query}
                onValueChange={handleQueryChange}
                placeholder={searchInputPlaceholder}
                className="flex h-9 w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <Command.List role="listbox">
              {filtered.length === 0 && (
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {t('fieldRenderer.noResults')}
                </Command.Empty>
              )}
              {filtered.length > 0 && (
                <div
                  ref={scrollRef}
                  // Pitfall 4 mitigation: explicit height on scroll element
                  style={{
                    height: `${Math.min(filtered.length * itemHeight, 280)}px`,
                    overflow: 'auto',
                  }}
                >
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const item = filtered[virtualRow.index];
                      const itemKey = `${virtualRow.index}-${displayLabel(item)}`;
                      return (
                        <Command.Item
                          key={itemKey}
                          value={String(virtualRow.index)}
                          onSelect={() => {
                            onChange(item);
                            setOpen(false);
                          }}
                          // Pitfall 3 mitigation: overflow:hidden + position:absolute (height set by inline style)
                          className="flex cursor-pointer select-none items-center px-3 text-sm aria-selected:bg-muted hover:bg-muted overflow-hidden"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {renderItem ? renderItem(item) : displayLabel(item)}
                        </Command.Item>
                      );
                    })}
                  </div>
                </div>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
