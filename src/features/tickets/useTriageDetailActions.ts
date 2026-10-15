import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useTicketStore } from './ticketStore';
import { denyTicket, linkTicket, restoreTicket } from './triageActions';
import type { JiraTicketDetail, TriageEntry } from './types';

export interface TriageDetailActions {
  triageEntry: TriageEntry | undefined;
  /** state === 'copied' && copiedKey set */
  isLinked: boolean;
  /** state === 'ignored' */
  isDenied: boolean;
  /** copiedKey only when state === 'ignored', else null */
  rememberedKey: string | null;
  /** true while linkTicket is in flight */
  linking: boolean;
  denyRef: RefObject<HTMLButtonElement | null>;
  /** Denied-state primary (Restore link to KEY / Copy to ...) */
  primaryRef: RefObject<HTMLButtonElement | null>;
  /** Linked status badge (tabIndex -1) */
  badgeRef: RefObject<HTMLSpanElement | null>;
  /** New-state Dismiss button */
  dismissRef: RefObject<HTMLButtonElement | null>;
  handleDeny: () => Promise<void>;
  handleDismiss: () => Promise<void>;
  handleLink: () => Promise<void>;
  handleRestore: () => Promise<void>;
}

type FocusTarget = 'primary' | 'badge' | 'dismiss' | 'deny';

/**
 * Shared detail triage handlers + post-action focus (RTRI-01, RTRI-04). All writes go
 * through triageActions.ts. Focus only moves after an action this hook started.
 */
export function useTriageDetailActions(
  issueKey: string,
  detail: JiraTicketDetail | null,
  fallbackRef?: RefObject<HTMLElement | null>,
): TriageDetailActions {
  const triageEntry = useTicketStore((s) => s.triageMap[issueKey]);
  const state = triageEntry?.state;
  const isLinked = state === 'copied' && !!triageEntry?.copiedKey;
  const isDenied = state === 'ignored';
  const rememberedKey = isDenied ? (triageEntry?.copiedKey ?? null) : null;

  const denyRef = useRef<HTMLButtonElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const dismissRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [linking, setLinking] = useState(false);
  const linkingRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: state and focusTick are the triggers
  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending === null) return;
    let target: HTMLElement | null | undefined;
    if (pending === 'primary') target = primaryRef.current;
    else if (pending === 'badge') target = badgeRef.current ?? denyRef.current;
    else if (pending === 'dismiss') target = dismissRef.current ?? fallbackRef?.current;
    else target = denyRef.current;
    if (target?.isConnected) {
      target.focus();
      pendingFocus.current = null;
    }
  }, [state, focusTick, fallbackRef]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the ticket changes
  useEffect(() => {
    pendingFocus.current = null;
  }, [issueKey]);

  const requestFocus = useCallback((target: FocusTarget | null) => {
    pendingFocus.current = target;
    if (target !== null) setFocusTick((n) => n + 1);
  }, []);

  const handleDeny = useCallback(async () => {
    pendingFocus.current = 'primary';
    const ok = await denyTicket(issueKey);
    if (!ok) requestFocus('deny');
  }, [issueKey, requestFocus]);

  const handleDismiss = useCallback(async () => {
    pendingFocus.current = 'primary';
    const ok = await denyTicket(issueKey);
    if (!ok) requestFocus('dismiss');
  }, [issueKey, requestFocus]);

  const handleLink = useCallback(async () => {
    if (linkingRef.current) return;
    linkingRef.current = true;
    setLinking(true);
    pendingFocus.current = 'badge';
    try {
      const result = await linkTicket(issueKey, detail ?? undefined);
      if (result === 'needs-copy') pendingFocus.current = null;
      else if (result === 'failed') requestFocus('primary');
    } finally {
      linkingRef.current = false;
      setLinking(false);
    }
  }, [issueKey, detail, requestFocus]);

  const handleRestore = useCallback(async () => {
    pendingFocus.current = 'dismiss';
    const ok = await restoreTicket(issueKey);
    if (!ok) requestFocus('primary');
  }, [issueKey, requestFocus]);

  return {
    triageEntry,
    isLinked,
    isDenied,
    rememberedKey,
    linking,
    denyRef,
    primaryRef,
    badgeRef,
    dismissRef,
    handleDeny,
    handleDismiss,
    handleLink,
    handleRestore,
  };
}
