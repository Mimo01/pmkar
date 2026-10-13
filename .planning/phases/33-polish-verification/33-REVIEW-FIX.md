---
phase: 33-polish-verification
fixed_at: 2026-10-13T07:55:00Z
review_path: .planning/phases/33-polish-verification/33-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 33: Code Review Fix Report

**Fixed at:** 2026-10-13T07:55:00Z
**Source review:** .planning/phases/33-polish-verification/33-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 1 (fix_scope: critical_warning; IN-01..IN-08 out of scope)
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: The arrow handoff opens the "Scroll tabs ..." tooltip without the user asking, including for mouse users on Chromium webviews

**Files modified:** `src/features/groups/GroupTabStrip.tsx`, `src/features/groups/__tests__/GroupTabStrip.test.tsx`
**Commit:** 7f5f380
**Status:** fixed: requires human verification (focus/modality logic; confirm on a Chromium webview, e.g. WebView2 on Windows)
**Applied fix:**
- Added a `pointerArrowRef` that records the arrow last activated by a pointer. The arrows' `onPointerDown` sets it; `onKeyDown` clears it, and so does `onBlur` when the blurred arrow is the recorded one. The ref is per element, so a blur from the previously focused arrow cannot clear a fresh pointerdown on the other arrow.
- In `updateOverflow`, all focus moves are now skipped when the disappearing focused arrow was pointer-activated. That covers the opposite-arrow handoff and the active-tab fallback. Focus simply drops when the arrow unmounts.
- I chose to drop focus rather than keep the old active-tab fallback for pointer users. `GroupTab` is also a Radix `TooltipTrigger`, so focusing the active tab would pop its name tooltip in the same unrequested way. Keyboard behaviour (handoff plus resize fallback) is unchanged.
- I used a ref rather than `:focus-visible`, because jsdom's `:focus-visible` support is unreliable.
- Added two tests:
  - A pointer click on the right arrow, followed by reaching the end, moves focus to neither the left arrow nor the active tab, and no `role="tooltip"` is rendered. This test fails on the pre-fix code.
  - After a pointer click, pressing Enter on the arrow restores keyboard handoff to the left arrow.
- Verification:
  - `GroupTabStrip.test.tsx`, `groupScale.test.tsx` and `a11y.keyboard.test.tsx` pass (70 tests).
  - `tsc --noEmit` and `biome check` are clean.
  - Pre-commit hooks (lint, cargo, tests) passed.

---

_Fixed: 2026-10-13T07:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
