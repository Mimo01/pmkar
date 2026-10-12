---
phase: 30-group-management-reorder
verified: 2026-10-12T16:25:00Z
status: human_needed
score: 4/4 roadmap truths verified (automated); 4/4 plan 30-08 truths verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  gaps_closed:
    - "UAT Test 1: light-theme teal/green/orange/pink group colors rendered transparent (closed by 30-08)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Light theme: open Create group and Change color popovers; create/recolor groups with teal, green, orange, pink"
    expected: "All 8 swatches and the tab dots show visible colors in light theme; dark theme unchanged"
    why_human: "Rendered color is visual. CSS emission and cascade are verified, but UAT Test 1 was a visual finding and should be re-confirmed."
  - test: "VoiceOver: Move left / Move right from a tab menu"
    expected: "Announces new position (N of M) and focus returns to the moved tab. Skipped in UAT."
    why_human: "Screen reader output cannot be tested in jsdom."
---

# Phase 30: Group Management & Reorder Verification Report

**Goal:** Users can fully manage existing groups: rename, recolor, delete safely, and reorder tabs via Move left/right menu actions.
**Re-verification:** Yes, after gap-closure plan 30-08.
**Status:** human_needed. There are no automated gaps.

## Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Rename from the menu, same validation as create (GRP-02) | VERIFIED | Regression check passed. `RenameGroupPopover` shares the name form with create. `rename_group` is registered in Rust. UAT Test 6 passed. |
| 2 | Fixed palette; new group defaults to the next unused color (GRP-03) | VERIFIED | `pickDefaultColor` is in `colors.ts`. `ChangeColorPopover` and `GroupColorSwatches` are in place. The 30-08 fix is verified below. UAT Test 7 passed. |
| 3 | Delete confirmation with issue count and "issues not affected"; falls back to a core tab if the deleted group was active (GRP-04) | VERIFIED | `DeleteGroupDialog` and the `onDeleted` fallback to `onTabChange('new')`. UAT Test 8 passed. |
| 4 | Move left/right in the menu, core tabs fixed, position announced, order persists (GRP-05) | VERIFIED (screen reader needs a human) | `moveGroup` and `move_group` renumber positions. UAT Tests 4 and 10 passed. VoiceOver was skipped in UAT. |

### Plan 30-08 truths (gap closure)

| Truth | Status | Evidence |
|---|---|---|
| All 8 light swatches render | VERIFIED (automated) | `src/index.css` has a plain `:root { --color-group-* }` block with all 8 values. The first 30 lines (the `@theme` block) contain no `group` matches. |
| Dots for teal, green, orange and pink are visible in light theme | VERIFIED (automated) | Same `:root` declarations. `body.dark` redeclares all 8 dark values, so dark is unchanged. The cascade holds because the unlayered `:root` rule is always emitted. |
| Dark theme unchanged | VERIFIED | The dark values are intact in `body.dark` (`#60a5fa`, `#2dd4bf` and so on). |
| The production bundle always defines all 8 light vars | VERIFIED | I ran `npm run build` and grepped `dist/assets/*.css`. It returned 16 unique `--color-group-*:#hex` declarations (8 light plus 8 dark). |

## Spot-checks

- `npx vitest run src/features/groups/__tests__/colors.test.ts` passed 28 of 28. It includes the `:root` parity check and the guard that `@theme` has no group declarations.
- The orchestrator reports the full suite passing (1234 tests). I did not re-run it.
- Debt markers (TBD, FIXME, XXX) in `src/features/groups` and `src/index.css`: none.

## Requirements Coverage

| ID | Plans | Status |
|---|---|---|
| GRP-02 | 30-02, 30-03, 30-06, 30-07, 30-08 | SATISFIED |
| GRP-03 | 30-02, 30-03, 30-06, 30-07, 30-08 | SATISFIED |
| GRP-04 | 30-02, 30-04, 30-07 | SATISFIED |
| GRP-05 | 30-01, 30-02, 30-05 | SATISFIED |

All four IDs appear in plan frontmatter and in REQUIREMENTS.md, with no orphans. REQUIREMENTS.md still shows them as `[ ]` and Pending. The orchestrator should tick them.

## Advisory (not must-haves)

- WR-01 (30-REVIEW.md): a delete that fails with `not_found` leaves the dialog open and loses focus. It also never calls `onDeleted`, so the stored active tab may still point at the vanished group. This is a rare edge case that no plan must-have covers. **WARNING.**
- WR-02: a pending create that the user cancels still navigates. **WARNING.**

## Gaps Summary

No automated gaps. The UAT Test 1 gap is closed in code, and the bundle was checked. Human confirmation of the light-theme colors and the VoiceOver announcement remains, so the status is human_needed.

---

_Verified: 2026-10-12T16:25:00Z_
_Verifier: Claude (gsd-verifier)_
