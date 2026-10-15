import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ConfirmTransitionDialogProps,
  ConfirmTransitionTarget,
} from './ConfirmTransitionDialog';
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
  /** Gated entry points (CONF-01/CONF-02): open the confirmation dialog instead of acting. */
  requestDeny: () => void;
  requestLink: () => void;
  /** Spread onto <ConfirmTransitionDialog />. */
  confirmDialog: ConfirmTransitionDialogProps;
}

type FocusTarget = 'primary' | 'badge' | 'dismiss' | 'deny';

/**
 * Shared detail triage handlers + post-action focus (RTRI-01, RTRI-04). All writes go
 * through triageActions.ts. Focus only moves after an action this hook started.
 * Linked -> Not mine (requestDeny) and Not mine -> Linked with a remembered key
 * (requestLink) require dialog confirmation (CONF-01, CONF-02).
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

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTransitionTarget | null>(null);
  const confirmTargetRef = useRef<ConfirmTransitionTarget | null>(null);
  const resolvedTargetRef = useRef<ConfirmTransitionTarget | null>(null);

  const openConfirm = useCallback((t: ConfirmTransitionTarget) => {
    confirmTargetRef.current = t;
    resolvedTargetRef.current = t;
    setConfirmTarget(t);
  }, []);

  const requestDeny = useCallback(() => {
    if (confirmTargetRef.current || !isLinked || !triageEntry?.copiedKey) return;
    openConfirm({ kind: 'deny', ticketKey: issueKey, cloudKey: triageEntry.copiedKey });
  }, [isLinked, triageEntry?.copiedKey, issueKey, openConfirm]);

  const requestLink = useCallback(() => {
    if (linkingRef.current || confirmTargetRef.current) return;
    if (rememberedKey) {
      openConfirm({ kind: 'link', ticketKey: issueKey, cloudKey: rememberedKey });
      return;
    }
    // Never-linked: the copy preview is the confirmation.
    void handleLink();
  }, [rememberedKey, issueKey, openConfirm, handleLink]);

  const onResolve = useCallback(
    (confirmed: boolean) => {
      const target = confirmTargetRef.current;
      confirmTargetRef.current = null;
      setConfirmTarget(null);
      // Run the confirmed action here, not in onClosed: it must not depend on the
      // Radix close-autofocus callback firing (WR-01).
      if (!confirmed || !target || target.ticketKey !== issueKey) return;
      const current = useTicketStore.getState().triageMap[issueKey];
      if (target.kind === 'deny') {
        if (current?.state !== 'copied') return;
        void handleDeny();
      } else {
        if (current?.state !== 'ignored' || current.copiedKey !== target.cloudKey) return;
        void handleLink();
      }
    },
    [issueKey, handleDeny, handleLink],
  );

  // Focus return only; the confirmed action already ran in onResolve.
  const onClosed = useCallback(
    (confirmed: boolean) => {
      const target = resolvedTargetRef.current;
      resolvedTargetRef.current = null;
      if (!target || target.ticketKey !== issueKey) return;
      const trigger = target.kind === 'deny' ? denyRef.current : primaryRef.current;
      if (trigger?.isConnected) trigger.focus();
      // A post-action focus move may have been swallowed by the dialog's focus trap.
      if (confirmed && pendingFocus.current !== null) setFocusTick((n) => n + 1);
    },
    [issueKey],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: close silently when the ticket changes
  useEffect(() => {
    confirmTargetRef.current = null;
    resolvedTargetRef.current = null;
    setConfirmTarget(null);
  }, [issueKey]);

  const confirmDialog = useMemo<ConfirmTransitionDialogProps>(
    () => ({ target: confirmTarget, onResolve, onClosed }),
    [confirmTarget, onResolve, onClosed],
  );

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
    requestDeny,
    requestLink,
    confirmDialog,
  };
}
