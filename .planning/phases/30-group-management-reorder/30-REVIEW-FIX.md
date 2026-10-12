---
phase: 30-group-management-reorder
fixed_at: 2026-10-12T00:00:00Z
review_path: .planning/phases/30-group-management-reorder/30-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-10-12
**Source review:** .planning/phases/30-group-management-reorder/30-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Warnings only; the 4 Info findings are out of scope for `critical_warning`)
- Fixed: 3
- Skipped: 0

Verification: the pre-commit hook passed on every commit (Biome, `tsc --noEmit`, the full Vitest suite, cargo fmt, clippy and cargo test). Vitest ended at 1235 passing tests.

## Fixed Issues

### WR-01: Focus is lost when a move fails

**Files modified:** `src/features/groups/GroupTabStrip.tsx`, `src/features/groups/__tests__/GroupTabStrip.test.tsx`
**Commit:** c740194
**Applied fix:** Moved `focusGroupTrigger(id)` from the success path into the `finally` of `handleMove`. Focus is now restored on success, on failure, and when the group is missing (it no-ops if the group is gone). The "generic toast" test now also checks that focus returns to the tab button. Without the fix, that assertion fails.

### WR-02: Rename popover probably does not select the existing name on open

**Files modified:** `src/features/groups/RenameGroupPopover.tsx`, `src/features/groups/__tests__/RenameGroupPopover.test.tsx`
**Commit:** 1448cc7
**Status:** fixed (hardening). Please confirm by hand.
**Applied fix:** First I added the regression tests the reviewer asked for. They passed against the unchanged code, so the bug does not happen today. Radix `Popover.Portal` remounts on every open and delays its children until a layout effect runs. React runs the parent's `reset(groupName)` effect before that re-render, so the input already has the name when it mounts. That correctness depended on an undocumented Radix timing detail. I replaced the `useEffect` reset with render-phase seeding: the component tracks `seededKey` and resets the name when the popover opens or switches group. The reset still happens only on open or group switch, not on each rename hydrate. Two new tests check that `select()` only ever sees the seeded name, and that a reopen after a different edit selects the whole name. Both tests fail if seeding happens late.

### WR-03: Failed delete with `not_found` leaves a stale tab

**Files modified:** `src/features/groups/groupStore.ts`, `src/features/groups/__tests__/groupStore.test.ts`
**Commit:** 1b339a8
**Status:** fixed. Please confirm by hand.
**Applied fix:** When the error code is `not_found`, `mutate`'s catch branch now awaits `get().hydrate()` before returning the failure. The review suggested `void`; I awaited instead so callers see an up-to-date store, matching the success path. `hydrate` never rejects. This covers delete, rename, color, move and membership commands. After the hydrate:
- The stale tab disappears.
- `resolveActiveTab` sends an active missing group to the New tab.
- The "pending group vanished" effect in `GroupTabStrip` can now close a pending rename or color popover.

Tests cover both cases: `not_found` re-hydrates and drops the group, and other error codes do not hydrate.

---

_Fixed: 2026-10-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
