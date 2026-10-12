---
phase: 30-group-management-reorder
plan: 05
subsystem: groups-ui
tags: [groups, menu, reorder, a11y, radix]
requires: [30-01, 30-02]
provides:
  - GroupMenuItems shared item list
  - GroupTab with `…` DropdownMenu + ContextMenu
  - GroupTabStrip move flow, live region, pending overlay state
affects: [30-07]
key-files:
  created:
    - src/features/groups/GroupMenuItems.tsx
    - src/features/groups/__tests__/GroupMenuItems.test.tsx
  modified:
    - src/features/groups/GroupTab.tsx
    - src/features/groups/GroupTabStrip.tsx
    - src/features/groups/__tests__/GroupTabStrip.test.tsx
decisions:
  - Tasks 2 and 3 committed together because both rewrite GroupTabStrip.tsx and its test file
  - setPending is called directly in onCloseAutoFocus (no setTimeout fallback was needed)
metrics:
  completed: 2026-10-12
---

# Phase 30 Plan 05: Group tab menu and Move left/right Summary

Active-tab `…` menu plus right-click / ContextMenu / Shift+F10 menu on group tabs, with Move left/right persisted via moveGroup, a polite live-region announcement, focus return and error toasts.

## Commits
- f79474c feat(30-05): add shared GroupMenuItems list
- dd6957a feat(30-05): group tab menu, move flow, live-region announcement

## What was built
- `GroupMenuItems`: one item list (Rename, Change color, separator, Move left/right, separator, destructive Delete) for both menu variants; Move items use Radix `disabled`.
- `GroupTab`: wrapper div (border moved here) holding the tab button and a sibling `…` trigger; inactive triggers are `invisible pointer-events-none`, aria-hidden, tabIndex -1 so the slot never shifts width. Right-click opens the menu without selecting; ContextMenu key and Shift+F10 dispatch a synthetic contextmenu event.
- `GroupTabStrip`: `pendingFocus {id,target,source}` replaces `pendingFocusId` (create entries cleared on navigate-away, manage entries kept); `focusGroupTrigger`, `handleMove` (movingRef + `moving` state), menu intent via `onCloseAutoFocus`, `pending`/`anchorRef` and vanished-group guard (toast notFound) for Plan 07; always-mounted `role=status` live region with clear-then-set (50 ms) and 5 s clear.

## Deviations from Plan
- Worktree base was `c4d9cb4`, not the expected `ea0e8a6`; reset to `ea0e8a6` per the branch check (worktree-agent branch, so allowed).
- Tasks 2 and 3 share one commit (see decisions).
- Test mocks reject with `{ code }` objects because `toGroupErrorCode` only reads `err.code`.

## Verification
- `npx vitest run src/features/groups src/components/ui`: 19 files, 243 tests passed (6 new GroupMenuItems, 14 new GroupTabStrip menu cases).
- `npx tsc --noEmit`: exit 0.
- Pre-commit hooks (cargo fmt, Biome, etc.) passed on both commits.
- Manual UAT deferred: VoiceOver announcement, Shift+F10 in WKWebView, no width jump on tab activation.

## Known Stubs
`pending`/`anchorRef` are set but not rendered yet; Plan 07 renders the rename/color/delete overlays.

## Self-Check: PASSED
