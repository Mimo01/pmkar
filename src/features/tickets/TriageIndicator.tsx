import { invoke } from '@tauri-apps/api/core';
import type { TriageState } from './types';

interface TriageIndicatorProps {
  state: TriageState | undefined;
  copiedKey?: string | null;
  cloudBaseUrl?: string;
}

export function TriageIndicator({ state, copiedKey, cloudBaseUrl }: TriageIndicatorProps) {
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
      <span className="inline-flex items-center whitespace-nowrap gap-1 px-1.5 py-0.5 rounded-full bg-emerald-400/10">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-400 shrink-0"
          aria-label="Copied"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {copiedKey && (
          <span
            className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer truncate max-w-[5rem]"
            onClick={(e) => {
              e.stopPropagation();
              invoke('open_external_url', { url: `${cloudBaseUrl}/browse/${copiedKey}` });
            }}
            title={copiedKey}
            role="link"
            aria-label={`Open ${copiedKey} in Company Jira`}
          >
            {copiedKey}
          </span>
        )}
      </span>
    );
  }

  if (state === 'ignored') {
    return (
      <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded-full bg-brand-surface-hover">
        <span className="text-[11px] font-medium text-brand-muted">Not mine</span>
      </span>
    );
  }

  // 'seen' or undefined — no indicator, render empty space for alignment
  return <span className="inline-block w-4 h-4" aria-hidden="true" />;
}
