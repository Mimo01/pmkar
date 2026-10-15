---
phase: 37-consistency-accessibility-and-uat
plan: 04
subsystem: tickets-a11y
tags: [accessibility, keyboard, focus, triage]
requirements: [RQA-03]
key-files:
  created:
    - src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/groups/GroupViewPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
metrics:
  tasks: 2
  completed: 2026-10-15
---

# Phase 37 Plan 04: Triage keyboard and focus audit Summary

Keyboard audit test for the Phase 36 triage buttons (page and panel, plus Not mine rows) with fixes for in-flight focus loss and missing focus rings; the Phase 36 focus-target logic is unchanged.

## Audit findings (cases that failed before fixes)

- In-flight Link/primary button (page and panel): used `disabled`, so no `aria-disabled` and focus is at risk. Fixed with `aria-disabled={linkBusy}` plus a guarded onClick.
- Missing `focus-visible:ring-2` on all raw panel buttons (Deny, Dismiss, Restore, Restore link / Copy primary).
- Missing ring on Not mine row Restore buttons in GroupViewPage and IgnoredTicketsPage.

All other cases passed unchanged: Tab reaches Deny, Restore link, Restore and Dismiss; Enter and Space activate them; focus lands on Restore link / Linked badge / Dismiss as in Phase 36; accessible name equals visible label; no tabindex -1 or aria-hidden ancestors; axe clean on page and panel.

## Commits

- dc96ee9 test(37-04): keyboard/focus audit test
- 11df26b fix(37-04): aria-disabled in-flight and focus rings

## Deviations from Plan

- **[Rule 3 - Blocking] Test and fix commit order.** The pre-commit hook runs the full frontend suite and refuses a RED commit (no `--no-verify`). I observed RED (9 failures: 2 in-flight, 5 panel ring, 2 Not mine ring) in the working tree, then applied the fixes before committing, so the test commit precedes the fix commit but was verified green by the hook against the working tree.
- Static audit asserts `type="button"` only for raw panel buttons; the shadcn Button omits `type` (inert outside a form), so on the page I assert it is not `submit`.
- Dev setup: the worktree had no node_modules, so a local symlink to the main repo's node_modules was used (untracked, not committed).

## Notes

- D-07: no Undo shortcut added, toast duration unchanged. `useTriageDetailActions.ts` untouched.
- `npx vitest run src/features/tickets src/features/groups`: 76 files, 1240 tests pass. tsc clean.

## Self-Check: PASSED
