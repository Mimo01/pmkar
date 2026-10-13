import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface ListSelection {
  selectMode: boolean;
  selected: ReadonlySet<string>;
  /** Selected keys in visible order. */
  selectedKeys: string[];
  isSelected(key: string): boolean;
  toggleSelectMode(): void;
  toggle(key: string, shift: boolean): void;
  /** Clears selection and anchor; mode stays on. */
  clear(): void;
  /** Mode off, selection cleared, anchor null. */
  exit(): void;
  selectToggleRef: React.RefObject<HTMLButtonElement | null>;
  focusSelectToggle(): void;
  /** Esc handler for the page wrapper. */
  handleKeyDown(e: React.KeyboardEvent): void;
}

function afterUnmount(fn: () => void) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
  else setTimeout(fn, 0);
}

const EMPTY: ReadonlySet<string> = new Set<string>();

/**
 * Per-page selection state (select mode, selected keys, shift-range anchor).
 * Local useState only: never global, so selection cannot leak across tabs.
 * Shift-toggle ADDS the contiguous range between the anchor and the clicked
 * key (never removes). There is intentionally no bulk "select everything" API.
 */
const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
]);

export function useListSelection(visibleKeys: readonly string[]): ListSelection {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(EMPTY);
  const [anchor, setAnchor] = useState<string | null>(null);
  const selectToggleRef = useRef<HTMLButtonElement | null>(null);

  // Prune keys that left the visible list. Compare by content to avoid loops.
  useEffect(() => {
    const visible = new Set(visibleKeys);
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const k of prev) if (visible.has(k)) next.add(k);
      return next.size === prev.size ? prev : next;
    });
    setAnchor((prev) => (prev !== null && !visible.has(prev) ? null : prev));
  }, [visibleKeys]);

  const selectedKeys = useMemo(
    () => visibleKeys.filter((k) => selected.has(k)),
    [visibleKeys, selected],
  );

  const isSelected = useCallback((key: string) => selected.has(key), [selected]);

  const exit = useCallback(() => {
    setSelectMode(false);
    setSelected(EMPTY);
    setAnchor(null);
  }, []);

  const clear = useCallback(() => {
    setSelected(EMPTY);
    setAnchor(null);
  }, []);

  const toggleSelectMode = useCallback(() => {
    if (selectMode) {
      exit();
    } else {
      setSelectMode(true);
    }
  }, [selectMode, exit]);

  const toggle = useCallback(
    (key: string, shift: boolean) => {
      const next = new Set(selected);
      const a = anchor !== null ? visibleKeys.indexOf(anchor) : -1;
      const b = visibleKeys.indexOf(key);
      if (shift && a !== -1 && b !== -1) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        for (let i = lo; i <= hi; i++) next.add(visibleKeys[i]);
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      setSelected(next);
      setAnchor(key);
    },
    [selected, anchor, visibleKeys],
  );

  const focusSelectToggle = useCallback(() => {
    afterUnmount(() => selectToggleRef.current?.focus());
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !selectMode) return;
      // Esc inside a text-entry field belongs to that field (clear/dismiss), never to select mode
      const target = e.target as HTMLElement | null;
      const isTextField =
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true ||
        (target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type));
      if (isTextField) return;
      e.preventDefault();
      exit();
      focusSelectToggle();
    },
    [selectMode, exit, focusSelectToggle],
  );

  return useMemo(
    () => ({
      selectMode,
      selected,
      selectedKeys,
      isSelected,
      toggleSelectMode,
      toggle,
      clear,
      exit,
      selectToggleRef,
      focusSelectToggle,
      handleKeyDown,
    }),
    [
      selectMode,
      selected,
      selectedKeys,
      isSelected,
      toggleSelectMode,
      toggle,
      clear,
      exit,
      focusSelectToggle,
      handleKeyDown,
    ],
  );
}
