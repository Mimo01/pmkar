import { useEffect } from 'react';

export const SHORTCUT_HINT_MAC = '⌘K';
export const SHORTCUT_HINT_OTHER = 'Ctrl K';

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

export function isModalOpen(): boolean {
  return document.querySelector(MODAL_SELECTOR) !== null;
}

/** Ctrl/Cmd+K and Ctrl/Cmd+F focus + select the search input (D-03). */
export function useSearchShortcut(inputRef: React.RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.defaultPrevented) return;
      const k = e.key.toLowerCase();
      if (k !== 'k' && k !== 'f') return;
      if (isModalOpen()) return;
      const input = inputRef.current;
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.select();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inputRef]);
}
