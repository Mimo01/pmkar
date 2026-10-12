---
phase: 30-group-management-reorder
plan: 03
subsystem: ui
tags: [react, groups, popover, a11y, radiogroup]
requires:
  - phase: 30-02
    provides: i18n keys (groups.color.*, groups.error.notFound/rename), groups.create label
provides:
  - useGroupNameForm / GroupNameForm / groupNameErrorKey shared by Create and Rename
  - GroupColorSwatches roving-tabindex radiogroup
  - CreateGroupPopover with swatch row and triggerRef
affects: [30-06]
tech-stack:
  added: []
  patterns: [shared form hook with in-flight and openSeq stale guards, roving tabindex radiogroup]
key-files:
  created:
    - src/features/groups/GroupNameForm.tsx
    - src/features/groups/GroupColorSwatches.tsx
    - src/features/groups/__tests__/GroupNameForm.test.tsx
    - src/features/groups/__tests__/GroupColorSwatches.test.tsx
  modified:
    - src/features/groups/CreateGroupPopover.tsx
    - src/features/groups/__tests__/CreateGroupPopover.test.tsx
key-decisions:
  - "Hook also exposes an `action` field on UseGroupNameForm (additive to the contract)."
  - "Message is translated inside the hook (returns string), component only renders it."
requirements-completed: [GRP-02, GRP-03]
duration: 15min
completed: 2026-10-12
---

# Phase 30 Plan 03: Shared name form, color swatches, Create popover Summary

Shared `useGroupNameForm`/`GroupNameForm` (rename semantics D-07, stale guards kept), an 8-swatch roving-tabindex `GroupColorSwatches`, and a Create popover that preselects `pickDefaultColor` and sends the color to `createGroup`.

## Tasks

1. Shared name form extraction and CreateGroupPopover refactor: 512a834
2. GroupColorSwatches, Create swatch row, triggerRef: a6dc047

## Verification

- `npx vitest run src/features/groups`: 13 files, 211 tests pass
- `npx tsc --noEmit`: exit 0
- `npx biome check src/features/groups`: clean

## Deviations from Plan

- [Rule 3] The rename-mode test harness mounts the form after the prefill `reset()`, mirroring a popover that opens after reset, so select-on-focus selects the full name. No production change.
- The biome `useSemanticElements` suppression for `role="radio"` on a button is placed as a JSX comment before the `<button>`.
- Existing CreateGroupPopover tests were not edited in Task 1; new cases were appended in Task 2.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
