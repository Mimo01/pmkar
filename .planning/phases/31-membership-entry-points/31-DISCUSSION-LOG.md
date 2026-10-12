# Phase 31: Membership Entry Points - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log keeps the alternatives that were considered.

**Date:** 2026-10-12
**Phase:** 31-membership-entry-points
**Areas discussed:** Detail picker & chips, Card chips, Select mode behavior, Selection bar & bulk feedback

---

## Detail picker & chips

| Option | Description | Selected |
|--------|-------------|----------|
| Own row under the title | A Groups button plus chips between the title/status and the action buttons | ✓ |
| In the action button row | Groups as another outline button, with chips below | |
| Header, near the key | Chips and a small button in the key/updated line | |

| Option | Description | Selected |
|--------|-------------|----------|
| Visible × per chip, no confirmation | Immediate removal | |
| Chip display-only | Remove only via the picker | |
| × with confirmation | Confirm before removing | ✓ |

**Confirmation form:** a small popover on the × (chosen) over a modal alertdialog.
**Confirm on picker uncheck:** no, picker toggles take effect immediately (chosen), over confirming both.

| Option | Description | Selected |
|--------|-------------|----------|
| Tab order, filter by name | Same order as the tabs, with case- and diacritic-insensitive search | ✓ |
| Member groups first | Groups the issue is in are pinned at the top | |
| Alphabetical | Sorted A–Z | |

| Option | Description | Selected |
|--------|-------------|----------|
| Create row at bottom, picker stays open | Create, add and stay on the current view | ✓ |
| Same, but the picker closes | | |
| Same, and switch to the new tab | | |

**Toggle failure feedback:** You decide.

---

## Card chips

| Option | Description | Selected |
|--------|-------------|----------|
| End of metadata row | Right-aligned on line 3 | ✓ |
| Line 1, after key/badges | | |
| Own 4th line | | |

**Long names:** the same cap as tab names, about 24 characters (chosen), over about 16 characters.
**+N:** a tooltip only, with the first 2 chips in tab order (chosen), over a popover of clickable chips.
**Chip click:** switches to the group tab only (chosen), over switching tab and highlighting the issue.

---

## Select mode behavior

**Toggle placement:** in `TicketFilterBar`, right side (chosen), over a separate row.
**Card body click in select mode:** toggles selection (chosen), over only the checkbox selecting.
**Select all:** no, shift-click range only (chosen), over selecting all visible.
**Other exit / filter behavior:** You decide. Options were: Esc and stay in select mode after a bulk action; Esc with filter changes keeping the selection; Esc with filter changes pruning hidden issues.

---

## Selection bar & bulk feedback

**Bar position:** a floating bar at the bottom of the list (chosen), over replacing the filter bar row.
**After a successful bulk action:** clear the selection, exit select mode and show a toast (chosen), over staying in select mode or keeping the selection.
**Remove confirmation:** yes, a popover confirm (chosen), over immediate removal with a toast.
**Issues already in the group:** count only those newly added in the toast (chosen), over a tri-state picker.

---

## Claude's Discretion

- Feedback when a picker toggle fails
- Esc and filter-change behavior in select mode. Lean: Esc exits; filter changes prune hidden issues.
- Excluding the current group from the bar picker in a group view
- The picker primitive
- Lifting `currentTab` and selection state
- Shift-click anchor rules
- EN/SK copy

## Deferred Ideas

- Select all visible (rejected for now)
- A tri-state bulk picker
- Chip click that also highlights the issue
- Undo (GRP-F1)
