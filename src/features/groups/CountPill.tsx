import type { ReactNode } from 'react';

/**
 * Neutral counter pill class. Only the text color differs between states so
 * a tab never changes width when it becomes active.
 */
export function countPillClass(active = false): string {
  return `inline-flex items-center justify-center h-4 min-w-4 px-1.5 rounded-full text-xs font-medium tabular-nums leading-none bg-brand-surface-hover ${
    active ? 'text-brand-text' : 'text-brand-text-secondary'
  }`;
}

/** Visual-only counter pill (the accessible name lives on the parent control). */
export function CountPill({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span aria-hidden="true" className={countPillClass(active)}>
      {children}
    </span>
  );
}
