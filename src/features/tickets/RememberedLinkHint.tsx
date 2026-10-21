import { Trans } from 'react-i18next';
import type { TriageEntry } from './types';

interface RememberedLinkHintProps {
  entry: TriageEntry | undefined;
  variant: 'detail' | 'row';
}

/**
 * Visible "Previously linked to KEY" hint. Shown only for dismissed or watched tickets that
 * remember a prior Jira link (seen/handled entries may keep a stale copiedKey).
 */
export function RememberedLinkHint({ entry, variant }: RememberedLinkHintProps) {
  if (!((entry?.state === 'ignored' || entry?.state === 'watched') && entry.copiedKey)) {
    return null;
  }

  const text = (
    <Trans
      i18nKey="detail.previouslyLinked"
      values={{ key: entry.copiedKey }}
      components={{ k: <span className="font-mono" /> }}
    />
  );

  if (variant === 'row') {
    return <span className="text-xs text-brand-text-secondary whitespace-nowrap">{text}</span>;
  }
  return <p className="text-xs text-brand-muted mt-1">{text}</p>;
}
