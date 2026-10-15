---
phase: 36-detail-and-group-ui
plan: 03
subsystem: ui
tags: [react, triage, deny, relink, focus]
requires: [36-01, 36-02]
provides:
  - Detail page Deny / Restore link / Restore actions and remembered-link hint
  - Group-view hand-off proof (RLNK-04)
affects: [group view detail hand-off]
key-files:
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/__tests__/TicketDetailPage.test.tsx
  created:
    - src/features/groups/__tests__/groupDetailTriage.test.tsx
key-decisions:
  - "Primary action in denied state always calls handleLink; only the label depends on the remembered key"
requirements-completed: [RTRI-01, RTRI-04, RLNK-03, RLNK-04]
duration: 15min
completed: 2026-10-15
---

# Phase 36 Plan 03: Detail page Deny / Restore link Summary

TicketDetailPage now uses useTriageDetailActions: Linked tickets get a labelled Deny button, denied tickets get "Restore link to KEY" (or "Copy to ...") plus "Restore" and a visible "Previously linked to KEY" hint, replacing the old "Ignored" toggle.

## Tasks
1. Wire TicketDetailPage (commit 82f4e0e): Deny with tooltip after Cloud-key link, badge/deny/primary/dismiss refs for post-action focus, back button as Dismiss focus fallback, RememberedLinkHint (detail variant); handleIgnore/handleUnignore removed. Tests updated plus new "Phase 36 deny / link" describe (7 tests: focus after Deny, failed Deny focus, remembered/never-linked denied UI, relink focus on badge, needs-copy handoff, Restore focuses Dismiss).
2. Group hand-off test (commit 2214999): group card click selects ticket, shared TicketDetailPage shows Deny (Linked) and Restore link + hint (Denied). No production changes.

## Deviations from Plan
- Worktree base was corrected via `git reset --hard d8d4087` per the startup check (merge-base differed).
- Hint assertion in the group test matches the paragraph textContent because the key is in a nested span (Trans).

## Verification
`vitest run src/features/groups src/features/tickets`: 75 files, 1197 tests passed; biome clean; pre-commit hooks passed.

## Known Stubs
None.

## Self-Check: PASSED
