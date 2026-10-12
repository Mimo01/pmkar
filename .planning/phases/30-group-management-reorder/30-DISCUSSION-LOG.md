# Phase 30: Group Management & Reorder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 30-group-management-reorder
**Areas discussed:** Menu trigger & contents, Rename flow, Color picker, Delete & move feedback

---

## Menu trigger & contents

| Option | Description | Selected |
|--------|-------------|----------|
| Active tab only | `…` only inside the active group tab | |
| Every group tab | `…` always shown on each group tab | |
| Active tab + right-click | `…` on the active tab, and right-click on any group tab opens the same menu | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Rename, Color, Move L/R, Delete | Separate items, with Delete last and destructive | ✓ |
| Edit, Move L/R, Delete | One combined "Edit group…" item | |

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled at the edge | Shown but aria-disabled | ✓ |
| Hidden at the edge | Omitted when not applicable | |

| Option | Description | Selected |
|--------|-------------|----------|
| Close after each move | Focus returns to the moved tab's `…` | ✓ |
| Stay open | Repeat clicks without reopening | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, menu only | Right-click doesn't switch tab | ✓ |
| Yes, switch then open | Activate the tab first | |

**User's choice:** All recommended choices, except the trigger: the user chose active tab **plus right-click**.

---

## Rename flow

| Option | Description | Selected |
|--------|-------------|----------|
| Popover anchored to the tab | Reuses the Create form | ✓ |
| Inline edit in the tab | Tab label becomes an input | |
| Small modal dialog | Centered dialog | |

| Option | Description | Selected |
|--------|-------------|----------|
| Unchanged name disables Save | Case/diacritic-only change of its own name is allowed | ✓ |
| Allow Save, no-op | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Back to the tab's `…` trigger | Right-clicked inactive tab → the tab button | ✓ |
| To the group tab itself | | |

---

## Color picker

| Option | Description | Selected |
|--------|-------------|----------|
| Swatch popover anchored to tab | Applies immediately, labelled swatches | ✓ |
| Submenu of the `…` menu | 8 menu items | |
| Swatches + Save button | Preview then confirm | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, preselected default | Create popover gets the swatch row, preselected to least-used | ✓ |
| No, menu only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Allowed, no warning | | ✓ |
| Allowed, show "in use" hint | | |

---

## Delete & move feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog, red Delete | alertdialog, Cancel focused by default | ✓ |
| Popover confirm under the tab | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Always New | Matches resolveActiveTab and the start tab | ✓ |
| Last-visited core tab | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Neighbouring group tab, else ＋ | Active group deleted → focus on New | ✓ |
| Always the landing core tab | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Name + position | "“Sprint 12” moved to position 2 of 5." | ✓ |
| Position only | | |

---

## Claude's Discretion

- The menu primitive (Radix dropdown-menu / context-menu), and the keyboard alternative to right-click
- How `…` fits inside the tab
- Error feedback for failed move, delete or color changes
- Shared form and swatch component extraction; EN/SK copy

## Deferred Ideas

None.
