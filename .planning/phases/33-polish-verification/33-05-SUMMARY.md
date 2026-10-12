---
phase: 33-polish-verification
plan: 05
subsystem: ui
tags: [a11y, contrast, tailwind]
requires: [33-01, 33-02]
provides:
  - opacity-70 missing-state dimming matching contrast.test.ts
  - secondary-text card key/meta, checkbox boundary, destructive-text tokens
key-files:
  modified:
    - src/features/tickets/TicketCard.tsx
    - src/features/groups/GroupViewPage.tsx
    - src/features/groups/DeleteGroupDialog.tsx
    - src/components/ui/context-menu.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/features/tickets/__tests__/TicketCard.test.tsx
    - src/features/groups/__tests__/GroupViewPage.test.tsx
    - src/features/groups/__tests__/GroupMenuItems.test.tsx
    - src/components/ui/__tests__/menu-wrappers.test.tsx
decisions:
  - GroupMenuItems is the only consumer of the wrappers' destructive prop, so tokens changed in the wrappers.
requirements: [GQA-02]
completed: 2026-10-12
---

# Phase 33 Plan 05: Missing-state and card contrast Summary

Dimming moved to opacity-70, card/group-view text moved to secondary tokens, and destructive text uses text-destructive-text.

## Commits
- d3be1fc: TicketCard / GroupViewPage changes (opacity-70, text-brand-text-secondary, border-brand-text-secondary checkbox, focus-ring outline, destructive-text error row)
- f017eef: dropdown/context-menu destructive item and DeleteGroupDialog error use text-destructive-text

## Deviations from Plan
- Tests and implementation were committed together (pre-commit hook runs the full suite, so a RED-only commit is rejected). Added two new TicketCard tests (secondary key text, checkbox border).
- Ran biome format on touched files (formatting only).
- Worktree was reset to base 83f64a6 per the startup step; ran `npm ci`.

## Verification
`vitest run src/features src/components`: 110 files / 1474 tests passed. Lint has only pre-existing warnings.

## Known Stubs
None.

## Self-Check: PASSED
