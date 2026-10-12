---
phase: 33-polish-verification
plan: 04
subsystem: groups-a11y
tags: [contrast, wcag, tailwind-tokens]
requires: [33-02]
provides:
  - Group UI controls use focus-ring, destructive-text and text-secondary tokens
affects: [33-07]
key-files:
  modified:
    - src/features/groups/GroupTab.tsx
    - src/features/groups/GroupTabStrip.tsx
    - src/features/groups/CreateGroupPopover.tsx
    - src/components/ui/AppShell.tsx
    - src/features/groups/GroupPicker.tsx
    - src/features/groups/GroupNameForm.tsx
    - src/features/groups/GroupColorSwatches.tsx
    - src/features/groups/GroupChip.tsx
    - src/features/groups/GroupChips.tsx
    - src/features/groups/DetailGroupsRow.tsx
    - .planning/phases/33-polish-verification/deferred-items.md
decisions:
  - "TicketFilterBar.tsx unchanged: Select toggle uses shared Button ring, already fixed by 33-02 dark --color-ring."
metrics:
  completed: 2026-10-12
requirements: [GQA-02]
---

# Phase 33 Plan 04: Token adoption on group controls Summary

Class-only changes moved focus indicators to `focus-ring`, inactive tab and icon text to `text-brand-text-secondary`, inline errors to `text-destructive-text`, and unchecked picker checkboxes to a `border-brand-text-secondary` boundary. No behavior changes.

## Commits
- b948a5e: tab strip, core nav tabs, create trigger, deferred-items.md
- d97783d: picker, name form, swatches, chips, detail groups row

## Notes
- Disabled picker create row kept muted with a WCAG 1.4.3 exemption comment.
- Selected swatch `ring-brand-text` untouched.
- AppShell header gear/icon buttons and TicketFilterBar muted text/inputs left as is (D-03), logged in deferred-items.md.

## Deviations from Plan
- [Rule 3] Worktree base was wrong at start (c4d9cb4); reset to the expected base 83f64a6 as the startup check directs.
- [Rule 3] The disabled-row comment was placed inline after the ternary branch, since a comment between condition and `?` failed Biome format.

## Verification
`npx vitest run src/features/groups src/components src/features/tickets`: 1112 passed. Pre-commit hooks passed on both commits. `npm run lint` showed only pre-existing issues in unrelated files (CopyPreview*, AllFieldsSection, StaticValueWidget test).

## Self-Check: PASSED
