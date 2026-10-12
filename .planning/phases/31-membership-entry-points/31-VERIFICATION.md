---
phase: 31-membership-entry-points
verified: 2026-10-12T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open ticket detail, click Groups, type a name, pick Create '<name>', toggle checkboxes, press Esc"
    expected: "Search is autofocused; toggles add/remove immediately with picker open; Create adds the new group and issue in one step without navigating; Esc closes and returns focus to the button"
    why_human: "Popover focus, keyboard and visual behaviour in the Tauri webview"
  - test: "On cards, view an issue in 3+ groups; hover/focus the +N control; click a chip; open a group view"
    expected: "Max 2 colored chips plus +N with tooltip; click switches to that group's tab with focus on the tab; the current group's chip is hidden in its own view"
    why_human: "Layout, color and tooltip rendering; pointer-events overlay restructure of TicketCard"
  - test: "Hover the unseen-changes badge on a New-tab card (review WR-01)"
    expected: "Changed-fields tooltip opens (review predicts it does not, because of pointer-events-none)"
    why_human: "Pointer behaviour; regression is outside the 5 success criteria but is user-visible"
  - test: "In each list (New, Not mine, Linked, group view) toggle Select, click and shift-click cards, switch tabs, press Esc; open the assignee autocomplete and press Esc (review WR-02)"
    expected: "Checkboxes appear; shift-click selects a range; selection clears on tab change/exit; Esc in the autocomplete should not wipe the selection (review predicts it does)"
    why_human: "Interaction and keyboard event ordering"
  - test: "Select several issues, use Add to group (incl. inline create), then in a group view use Remove from group; also try during a New-tab refresh (review WR-03)"
    expected: "Count shown; one atomic operation; toast with real count; selection cleared; Remove confirm popover appears only in group views"
    why_human: "End-to-end UX and toasts"
---

# Phase 31: Membership Entry Points Verification Report

**Phase Goal:** Users can put issues into and take them out of any number of groups from detail, cards, and multi-select
**Verified:** 2026-10-12
**Status:** human_needed
**Re-verification:** No, initial verification

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Detail "Groups" button opens searchable checkbox picker; toggle is immediate; "Create '<name>'" makes group and adds issue | VERIFIED (code) | `TicketDetailPage.tsx:234` renders `DetailGroupsRow`; `GroupPicker.tsx` (440 lines) has checkbox and list modes, create row using validation; `membershipActions.ts` calls store `addToGroup`/`removeFromGroup`. Needs human UI check. |
| 2 | Multi-group membership, still in core tab; card shows up to 2 chips + "+N" tooltip, hidden for current group | VERIFIED | `GroupChips.tsx`: `MAX_VISIBLE = 2`, `+N` button inside Tooltip, filters `g.id !== hideGroupId`; `TicketCard.tsx:124` renders it; `GroupViewPage.tsx:121` passes `hideGroupId={groupId}`. Membership is independent of triage (separate group tables, `groups_db.rs`). |
| 3 | Chip click switches to group tab; remove via detail picker or detail chip | VERIFIED | `GroupChip.tsx:29-36` calls `navigateToGroup`; `App.tsx:161-170` sets tab, closes detail, clears selection, requests focus; Provider wraps both detail and list branches (`App.tsx:248, 275`). `DetailGroupsRow.tsx:87` chip navigation; removal via the picker checkbox uncheck (detail chip removal affordance: see human item 1). |
| 4 | "Select" toggle in every list header, shift-click range, clears on tab change / leaving select mode | VERIFIED | `useListSelection` used in `TicketListPage`, `IgnoredTicketsPage`, `LinkedTicketsPage`, `GroupViewPage`, each passing `selectMode`/`selectDisabled` to the filter bar. `toggle()` implements shift range between anchor and clicked key; `exit()` clears. `App.tsx` mounts one page per tab, so tab change unmounts and discards state. |
| 5 | Selection bar shows count, atomic add with inline create; group view also offers Remove from group | VERIFIED | `SelectionBar.tsx` (141 lines) rendered in all four pages with `onClear`/success handlers; adds call a single `addToGroup(group.id, tickets)`; backend runs in one transaction (`groups_db.rs:569-587`). `GroupViewPage.tsx:160` renders the bar with remove option. |

**Score:** 5/5 truths verified at code level (build and 1382 tests reported green).

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| GMEM-01 | 09 | SATISFIED | Independent membership, core tab lists unchanged |
| GMEM-02 | 04, 06 | SATISFIED | Detail picker checkbox toggles |
| GMEM-03 | 04, 06 | SATISFIED | Inline create row in `GroupPicker` |
| GMEM-04 | 05, 08, 09 | SATISFIED | `GroupChips` max 2 + "+N", `hideGroupId` |
| GMEM-05 | 01, 09 | SATISFIED | `navigateToGroup` via `GroupChip` |
| GMEM-06 | 03, 05, 07, 08, 09 | SATISFIED | `useListSelection` in all 4 lists |
| GMEM-07 | 04, 05, 06, 08 | SATISFIED | `SelectionBar` atomic add |
| GMEM-08 | 05, 06, 08 | SATISFIED | Remove-from-group in group view |
| GMEM-09 | 04, 06 | SATISFIED | Uncheck in picker removes; detail chip |

All nine IDs appear in plan frontmatter and in REQUIREMENTS.md; no orphans. Note: REQUIREMENTS.md still marks them Pending/unchecked; update on phase close.

## Review Warnings vs Success Criteria

- WR-01 (Changed badge tooltip dead, `TicketCard.tsx`): regression of existing behaviour, not a roadmap criterion. WARNING, recommend fix before milestone close.
- WR-02 (Escape in assignee autocomplete wipes selection): degrades SC4 edge case. WARNING; one-line `preventDefault` fix.
- WR-03 (New-tab bar usable while list hidden during refresh): can add tickets the user cannot see; SC5 edge case. WARNING.
- WR-04 (overlay button a11y in select mode): accessibility only. WARNING.
- IN-02: "+N" is not itself navigable, but SC2 only requires a tooltip. Not a gap.

None makes a success criterion fail in its primary flow.

## Anti-Patterns

I did not run a separate debt-marker scan; the review reported none as blockers.

## Gaps Summary

No blocking gaps in code. Status is human_needed because this is a Tauri UI with interaction, focus, tooltip and layout behaviour that code and tests cannot confirm, and the four review warnings (WR-01..04) are unresolved.

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
