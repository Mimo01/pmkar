---
phase: quick-261015-lwy
plan: 01
subsystem: tickets/triage
tags: [tech-debt, triage, i18n, a11y]
requirements: [TECH-DEBT-v0.5.1]
key-files:
  created: [src/lib/focusRing.ts]
  modified:
    - src/features/tickets/triageActions.ts
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/groups/GroupViewPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/copyStore.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
completed: 2026-10-15
---

# Quick 261015-lwy: v0.5.1 Tech Debt Summary

Triage writes are serialized per key with rollback to the last persisted entry, stale Undo is guarded, and EN/SK wording plus the duplicate-copy refusal are consistent and localized.

## Commits
- 879a114: harden triage actions (Task 1)
- 5e9e143: detail UI correctness and shared focus ring (Task 2)
- 3f590f9: Dismissed wording and already-linked refusal (Task 3)

## Audit items
- 35 WR-01 (stale Undo, toast not dismissed): fixed
- 35 WR-02 (overlapping writes): fixed, per-key chain, rollback to persisted base
- 35 WR-03 (link without connection / startPreview rejection): fixed
- 37 IN-02 (UNDO_TOAST_MS): fixed
- W-1 (list markSeen via triageActions): fixed
- 36 WR-02 (copied without copiedKey): fixed via tri.isLinked / tri.isDenied
- 37 WR-03: hover pinning fixed; re-entry part already handled by linkingRef
- 37 IN-01 (FOCUS_RING): fixed
- 36 WR-03 (void restoreTicket), 36 WR-05 (panel Escape defaultPrevented): fixed
- 36 WR-01 (SK Deny vs Dismiss): fixed ("Odmietnuť")
- 37 WR-02 (wording): fixed in the reverse direction, toasts now say nav.notMine label
- W-2 (already linked refusal): fixed in copyStore via copy.alreadyLinked
- 37 WR-01: already fixed in 250881a. Out-of-scope items untouched.

## Deviations from Plan

- [Rule 3] Added `dismiss` to the sonner mocks in IgnoredTicketsPage.test.tsx and GroupViewPage.test.tsx, since restoreTicket now calls toast.dismiss.
- [Rule 1] Existing announcement test seeded state again before the second Undo, since the stale-Undo guard now blocks Undo once the entry is no longer 'ignored'.
- copy.alreadyLinked names the actual Link label (detail.restoreLink: "Restore link" / "Obnoviť prepojenie") rather than the generic "Link"/"Prepojiť", per plan instruction to check the SK label.
- Introduced `linkedKey` (copiedKey or '') in the detail page/panel to satisfy type narrowing after replacing isCopied with tri.isLinked.
- Local `node_modules` symlink to the main repo was used for running tests (untracked, not committed).

## Known Stubs
None.

## Self-Check: PASSED
Full vitest suite (1781 tests) and tsc are green; the pre-commit hooks passed on all three commits.
