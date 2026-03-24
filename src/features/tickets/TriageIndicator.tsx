import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { TriageState } from './types';

interface TriageIndicatorProps {
  state: TriageState | undefined;
  copiedKey?: string | null;
  cloudBaseUrl?: string;
}

export function TriageIndicator({ state, copiedKey, cloudBaseUrl }: TriageIndicatorProps) {
  const { t } = useTranslation();

  if (state === 'new') {
    return (
      <span className="inline-flex items-center">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true" />
        <span className="sr-only">New</span>
      </span>
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
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {copiedKey && (
          <button
            type="button"
            className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer truncate max-w-[5rem] bg-transparent border-none p-0"
            onClick={(e) => {
              e.stopPropagation();
              invoke('open_external_url', { url: `${cloudBaseUrl}/browse/${copiedKey}` });
            }}
            title={copiedKey}
            aria-label={`Open linked ticket ${copiedKey}`}
          >
            {copiedKey}
          </button>
        )}
      </span>
    );
  }

  if (state === 'ignored') {
    return (
      <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded-full bg-brand-surface-hover">
        <span className="text-[11px] font-medium text-brand-muted">{t('detail.ignore')}</span>
      </span>
    );
  }

  // 'seen' or undefined — no indicator, render empty space for alignment
  return <span className="inline-block w-4 h-4" aria-hidden="true" />;
}
