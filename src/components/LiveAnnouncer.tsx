import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface AnnouncerState {
  message: string;
  nonce: number;
}

/** Gap between clearing and re-filling the region so identical repeats re-announce. */
const ANNOUNCE_DELAY_MS = 50;

export const useAnnouncerStore = create<AnnouncerState>(() => ({ message: '', nonce: 0 }));

/** Push a message to the app-level polite live region. */
export function announce(message: string): void {
  useAnnouncerStore.setState((s) => ({ message, nonce: s.nonce + 1 }));
}

/** Visually hidden polite live region. Never focusable; text is a React text node. */
export function LiveAnnouncer() {
  const message = useAnnouncerStore((s) => s.message);
  const nonce = useAnnouncerStore((s) => s.nonce);
  const [text, setText] = useState('');

  useEffect(() => {
    if (nonce === 0) return;
    setText('');
    const id = setTimeout(() => setText(message), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(id);
  }, [message, nonce]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  );
}
