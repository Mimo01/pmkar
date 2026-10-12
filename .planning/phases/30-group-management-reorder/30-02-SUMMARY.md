---
phase: 30-group-management-reorder
plan: 02
subsystem: groups
tags: [i18n, groups, helpers, a11y]
requires: []
provides:
  - EN/SK copy for all Phase 30 surfaces
  - canMove, positionOf, deleteFocusTarget helpers
  - focusCoreTab helper and data-tab-id on core nav buttons
affects: [phase-30 UI plans]
tech-stack:
  added: []
  patterns: [flat dotted i18n keys, separate empty-group key for Slovak (no zero plural)]
key-files:
  created:
    - src/features/groups/groupMoves.ts
    - src/features/groups/__tests__/groupMoves.test.ts
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/groups/groupTabs.ts
    - src/components/ui/AppShell.tsx
    - src/features/groups/__tests__/groupI18n.test.ts
    - src/features/groups/__tests__/groupTabs.test.ts
    - src/features/groups/__tests__/validation.test.ts
    - src/features/groups/__tests__/CreateGroupPopover.test.tsx
decisions:
  - "Empty-group delete body uses groups.delete.bodyEmpty; no _zero key"
  - "groups.create value renamed to Create group / Vytvoriť skupinu"
metrics:
  completed: 2026-10-12
---

# Phase 30 Plan 02: Shared foundations Summary

Complete EN/SK copy for group menu, rename, color, delete (Slovak _one/_few/_many/_other plus a separate empty key) and move announcement, plus pure move/delete-focus helpers, `focusCoreTab`, and `data-tab-id` on core nav tabs.

## Commits
- bc19092, 2a42f85: Task 1 (i18n copy, plural tests, Create CTA rename; second commit is a lint fix)
- 100b139: Task 2 (groupMoves, focusCoreTab, data-tab-id, validation tests)

## Deviations from Plan
- Worktree base was behind the expected commit; reset to cec4cd8 per the startup check, then ran `npm ci`.
- Lint fix (template literal) and format fix required by the pre-commit hook.

## Verification
`npx vitest run src/features/groups src/i18n src/components/ui` passes (234 tests); `npx tsc --noEmit` clean.

## Known Stubs
None.

## Self-Check: PASSED
