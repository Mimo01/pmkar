import type { TriageState } from './types';

interface TriageIndicatorProps {
  state: TriageState | undefined;
}

export function TriageIndicator({ state }: TriageIndicatorProps) {
  if (state === 'new') {
    return (
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-brand"
        aria-label="New ticket"
      />
    );
  }

  if (state === 'copied') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-400"
        aria-label="Copied"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }

  // 'seen', 'ignored', or undefined — no indicator, render empty space for alignment
  return <span className="inline-block w-4 h-4" aria-hidden="true" />;
}
