# Phase 15: Change Diff View - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 15-Change Diff View
**Areas discussed:** Change indicator style, Diff panel placement, Diff visual format, Change state lifecycle

---

## Change Indicator Style

| Option | Description | Selected |
|--------|-------------|----------|
| Colored dot | Small colored dot next to ticket key — subtle, Linear-style | ✓ |
| Badge with count | Small badge showing number of changed fields | |
| Highlight row background | Entire card gets a subtle background tint | |

**User's choice:** Colored dot
**Notes:** Dot positioned next to ticket key. Tooltip on hover showing brief change summary (e.g., "3 changes: status, priority, comments").

### Follow-up: Dot position

| Option | Description | Selected |
|--------|-------------|----------|
| Next to ticket key | Dot right after the key (e.g., "CUST-123 ●") | ✓ |
| Left edge of card | Dot on the far left margin | |
| You decide | Claude picks | |

### Follow-up: Tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, brief summary | Hover shows change count and field names | ✓ |
| No, just the dot | Keep it minimal | |

---

## Diff Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Changes' tab | 6th tab alongside existing tabs, with badge count | ✓ |
| Banner on Overview tab | Collapsible banner at top of Overview | |
| Inline on each field | Old→new directly on affected fields in Overview | |

**User's choice:** New 'Changes' tab
**Notes:** Auto-switch to Changes tab when opening a ticket with pending changes.

### Follow-up: Auto-switch

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-switch | Open directly to Changes tab if changes exist | ✓ |
| No, stay on Overview | Always open to Overview | |
| You decide | Claude picks | |

---

## Diff Visual Format

| Option | Description | Selected |
|--------|-------------|----------|
| Table rows with arrow | Field / Old Value / → / New Value per row | ✓ |
| Stacked cards per field | Each change as its own mini-card | |
| Side-by-side columns | Left = old, right = new | |

**User's choice:** Table rows with arrow

### Follow-up: Color coding

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle muted/accent | Old in gray, new in normal/accented text | ✓ |
| Red/green diff colors | Classic diff style | |
| You decide | Claude picks | |

### Follow-up: Long text fields

| Option | Description | Selected |
|--------|-------------|----------|
| 'Description changed' indicator only | Just note the change, no inline diff | ✓ |
| Truncated preview with expand | Show first ~100 chars of old/new | |
| You decide | Claude decides | |

---

## Change State Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| On viewing Changes tab | Dot clears when user views Changes tab | ✓ |
| On opening ticket detail | Any tab view clears indicator | |
| Manual dismiss button | Explicit 'Mark as seen' button | |
| On next poll cycle | Auto-clear on next poll | |

**User's choice:** On viewing the Changes tab

### Follow-up: Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, persist in SQLite | has_unseen_changes flag in SnapshotDb | ✓ |
| No, in-memory only | Zustand state, lost on restart | |

### Follow-up: Change stacking

| Option | Description | Selected |
|--------|-------------|----------|
| Show original old value | Keep old value from when ticket was last 'seen' | ✓ |
| Show latest change only | Each poll overwrites previous diff | |
| You decide | Claude decides based on SnapshotDb | |

---

## Claude's Discretion

- Dot color and size
- Table layout and spacing
- "Last seen snapshot" storage approach
- i18n key structure
- Changes tab empty state
- Tauri command design for fetching changes
