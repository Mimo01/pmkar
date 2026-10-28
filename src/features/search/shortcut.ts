import { useEffect, useRef } from 'react';

export const SHORTCUT_HINT_MAC = '⌘K';
export const SHORTCUT_HINT_OTHER = 'Ctrl K';

/** Marks the search palette so the shortcut guard does not treat it as a blocking modal. */
export const SEARCH_DIALOG_ATTR = 'data-search-dialog';

const MODAL_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [aria-modal="true"]';

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const source = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return ['Mac', 'iPhone', 'iPad'].some((p) => source.includes(p));
}

export function shortcutHint(): string {
  return isMacPlatform() ? SHORTCUT_HINT_MAC : SHORTCUT_HINT_OTHER;
}

/** True when a modal other than the search palette is open. */
export function isModalOpen(): boolean {
  return Array.from(document.querySelectorAll(MODAL_SELECTOR)).some(
    (el) => !el.closest(`[${SEARCH_DIALOG_ATTR}]`),
  );
}

/**
 * Ctrl/Cmd+K and Ctrl/Cmd+F activate search (D-03). Skipped while another modal
 * is open. The latest callback is always used; the listener is attached once.
 */
export function useSearchShortcut(onActivate: () => void): void {
  const callbackRef = useRef(onActivate);
  callbackRef.current = onActivate;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.defaultPrevented) return;
      const k = e.key.toLowerCase();
      if (k !== 'k' && k !== 'f') return;
      if (isModalOpen()) return;
      e.preventDefault();
      callbackRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
