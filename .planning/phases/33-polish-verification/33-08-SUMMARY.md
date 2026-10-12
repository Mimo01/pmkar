---
phase: 33-polish-verification
plan: 08
subsystem: testing
tags: [a11y, axe, vitest-axe, radix, aria]
requires: [33-05, 33-06, 33-07]
provides:
  - axe-core runner (vitest-axe) registered in test-setup
  - axe coverage of every D-01 group UI key state
affects: [src/features/groups]
tech-stack:
  added: [vitest-axe (devDependency, pulls axe-core)]
  patterns: [axe on document.body for Radix portals]
key-files:
  created:
    - src/features/groups/__tests__/a11y.axe.test.tsx
    - src/vitest-axe.d.ts
  modified:
    - package.json
    - package-lock.json
    - src/test-setup.ts
    - src/features/groups/GroupPicker.tsx
    - src/features/groups/CreateGroupPopover.tsx
    - src/features/groups/RenameGroupPopover.tsx
    - src/features/groups/ChangeColorPopover.tsx
    - src/features/groups/ConfirmRemovePopover.tsx
    - src/features/groups/SelectionBar.tsx
    - src/features/groups/DetailGroupsRow.tsx
requirements-completed: [GQA-02]
completed: 2026-10-12
---

# Phase 33 Plan 08: Axe accessibility verification Summary

vitest-axe runs over all 14 D-01 group UI key states plus selection-bar and color-not-sole-signal checks (18 tests, all green); the one real violation class (unnamed popover dialogs) was fixed in the components.

## Task 1 (checkpoint, resolved by orchestrator)

Package legitimacy gate: vitest-axe 0.1.0 (github.com/chaance/vitest-axe, ~1.7M weekly downloads, no install scripts), axe-core by Deque (~80M weekly, 4.14.0). Resume signal, verbatim: "approved vitest-axe". No code, no commit.

## Tasks

- Task 2: `npm install -D vitest-axe`, matcher registered in `src/test-setup.ts`, `src/vitest-axe.d.ts` added (tsc needed no extra typing but vitest 4 matcher augmentation kept for `toHaveNoViolations`), `a11y.axe.test.tsx` written. Commit 6c189ae.
- Task 3: component fixes. Commit 19b8b68 (committed first so the pre-commit full test run passed; the test file in 6c189ae depends on it).

## Violations found (first run)

| Rule id | Targets | Resolution |
|---|---|---|
| aria-dialog-name | rename popover, change-color popover, create popover, picker (checkbox and list modes), chip-remove confirm, selection-bar remove confirm, ConfirmRemovePopover (all `role="dialog"` Radix PopoverContent with no name) | Fixed: `aria-label` on each PopoverContent using existing i18n keys (`groups.rename.title`, `groups.color.title`, `groups.new`, `groups.picker.searchLabel`, `groups.chip.removeConfirm`, `groups.bar.removeConfirm`, confirm `question`). No new locale keys. |
| region | every state ("content not contained by landmarks") | Documented jsdom/fragment false positive, see below |

## Deviations / exemptions

- `color-contrast` disabled: jsdom cannot compute it; covered by contrast.test.ts token tests.
- `region` disabled (one documented false positive): whole-page landmark rule that fires on every isolated component mount with no app shell. Applied in the shared `AXE_OPTIONS` rather than per `it` because it applies to all states. App landmarks are out of GQA-02 scope. Deviation from the plan's per-`it` scoping guidance, flagged for review.
- The plan's "14 `it` blocks" is met (14 state tests plus a selection-bar live-region test and 3 color-not-sole-signal tests = 18).
- Pre-commit hook runs the full suite so a RED-only commit was not possible; violations were verified locally before fixing.
- No non-group violations found; deferred-items.md unchanged.

## Verification

`npx vitest run src/features/groups/__tests__/a11y.axe.test.tsx` 18/18 pass; `npx tsc --noEmit` clean; `npm run lint` exit 0 (pre-existing warnings only); pre-commit full checks passed for both commits.

## Known Stubs

None.

## Self-Check: PASSED
