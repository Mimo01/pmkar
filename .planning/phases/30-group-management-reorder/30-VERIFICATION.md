---
phase: 30-group-management-reorder
verified: 2026-10-12T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (automated)
overrides_applied: 0
human_verification:
  - test: "VoiceOver: use Move left / Move right from a tab menu"
    expected: "The new position is announced ('X moved to position N of M') and focus returns to the moved tab or its more button"
    why_human: "Screen-reader output cannot be checked in jsdom. Only the aria-live region content is covered by tests."
  - test: "Right-click and Shift+F10 on an inactive tab in the real Tauri WebView"
    expected: "The context menu opens and Move, Rename, Change color and Delete all work"
    why_human: "WebView keyboard and context-menu behaviour differs from jsdom."
  - test: "Activate a tab and check the strip for layout shift from the more button slot"
    expected: "No width jump when the active tab changes"
    why_human: "Visual layout."
  - test: "Rename a group and open the popover"
    expected: "The existing name is fully selected (see WR-02)"
    why_human: "Probable focus/selection ordering issue that no test covers"
  - test: "Restart the app after reordering, recoloring and renaming groups"
    expected: "Order, names and colors persist"
    why_human: "End-to-end persistence. Rust position renumbering is tested, but I did not run an app restart."
---

# Phase 30: Group Management & Reorder Verification Report

**Goal:** Users can fully manage existing groups: rename, recolor, delete safely, and reorder tabs via Move left/right menu actions.
**Status:** human_needed. No automated gaps were found.

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Rename from the "..." menu with the same validation as create | VERIFIED | `RenameGroupPopover` and `CreateGroupPopover` share `useGroupNameForm`/`GroupNameForm`. The store calls `rename_group`, which is registered in `main.rs:207` and implemented in `groups_db.rs:493`. |
| 2 | Pick color from a fixed palette; new group defaults to the next unused color | VERIFIED | `ChangeColorPopover` and `GroupColorSwatches` call `setGroupColor`. `CreateGroupPopover:28` seeds the color from `pickDefaultColor(used)`, defined in `colors.ts:52`. `set_group_color` is registered at `main.rs:208`. |
| 3 | Delete asks for confirmation with issue count and "issues not affected"; if the tab was active, land on a core tab | VERIFIED | `DeleteGroupDialog` is an alertdialog with a count-plural body in EN and SK. The EN body reads "...The issues themselves are not affected." For an empty group it shows "This group is empty." `onDeleted` calls `onTabChange('new')` when `wasActive`. Focus goes to a core tab, a neighbouring group, or the create button. |
| 4 | Move left/right in the tab menu, mouse or keyboard; core tabs fixed; screen reader announces position; order survives restart | VERIFIED (automated); SR and restart need a human | `GroupMenuItems` has disabled-at-edge items. `handleMove` calls `moveGroup` and then `announce` into a `role=status` `aria-live` region. `groups_db::move_group` renumbers positions densely in a transaction, and the store sorts by `position`. Core tabs are not part of the groups list. No DnD is present. |

## Requirements Coverage

| ID | Plans | Status |
|---|---|---|
| GRP-02 | 30-03, 30-05, 30-06, 30-07 | SATISFIED |
| GRP-03 | 30-03, 30-05, 30-06, 30-07 | SATISFIED |
| GRP-04 | 30-04, 30-06, 30-07 | SATISFIED |
| GRP-05 | 30-02, 30-05, 30-06 | SATISFIED |

All four IDs appear in plan frontmatter and are mapped to Phase 30 in REQUIREMENTS.md. There are no orphaned requirements. REQUIREMENTS.md still shows these IDs as Pending and unchecked, so the orchestrator should update that traceability.

## Spot-checks

- `npx vitest run src/features/groups` passed: 18 files, 274 tests. This was run independently.
- The orchestrator reports a full-suite pass (102 files, 1229 tests) and a passing build. I did not re-run them.
- I did not run the Rust tests; the `cargo test` attempt failed on a missing `timeout` command.
- The Rust `move_group` test (`move_group_swaps_and_edges`) exists.

## Review warnings vs must-haves

- WR-01 (focus lost on a failed move): this affects only the error path. A toast is still shown and the order is unchanged. It is an accessibility degradation, not a failure of SC4. **WARNING.**
- WR-02 (rename does not select the existing name on open): this is cosmetic. Rename still works and is validated. **WARNING.** A human check is listed above.
- WR-03 (`not_found` leaves a stale tab): this is an edge case for concurrent deletion. The user sees an error message, and the tab clears on the next hydrate. **WARNING.**

None of these three breaks a must-have. I recommend fixing them in a follow-up or in Phase 33 polish.

## Anti-patterns

No TBD, FIXME or XXX markers or stubs were found in the files I read. IN-01 (dead `delete` branch in `PendingAction`) is informational.

## Gaps

None blocking. Manual items are listed in the frontmatter.

_Verifier: Claude (gsd-verifier)_
