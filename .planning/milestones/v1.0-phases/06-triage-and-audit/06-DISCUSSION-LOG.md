# Phase 6: Triage and Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 06-triage-and-audit
**Areas discussed:** Ignore action UX, Ignored list access, Audit log viewer, Audit log navigation

---

## Ignore action UX

### How should the user trigger 'ignore'?

| Option | Description | Selected |
|--------|-------------|----------|
| Button in detail panel | "Not for me" button in detail panel header — review then decide | ✓ |
| Row action button | Small × icon on each row — quick dismiss without opening | |
| Both locations | Row action + detail panel button — two paths | |

**User's choice:** Button in detail panel
**Notes:** Matches review-then-act workflow

### Should ignoring require confirmation?

| Option | Description | Selected |
|--------|-------------|----------|
| Instant with undo | Brief toast notification with Undo link (3-5s) | |
| Confirmation dialog | Modal confirmation before ignoring | |
| No confirmation | Instant action, recover from ignored list | ✓ |

**User's choice:** No confirmation
**Notes:** None

### After ignoring, what happens to the detail panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Close panel | Return to ticket list | |
| Show next ticket | Auto-advance to next ticket | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Ignored list access

### Where should the ignored list live?

| Option | Description | Selected |
|--------|-------------|----------|
| Filter toggle on ticket list | Candidates/Ignored tabs on same page | |
| Separate page | Dedicated nav page | ✓ |
| Collapsible section | Collapsed section below ticket table | |

**User's choice:** Separate page
**Notes:** None

### How should un-ignoring work?

| Option | Description | Selected |
|--------|-------------|----------|
| Restore button per row | Each row has Restore icon | |
| Detail panel with restore | Open detail, click Restore | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Audit log viewer

### How should audit log entries be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Table with expandable rows | Compact table, click to expand details | ✓ |
| Two-panel (list + detail) | Browser devtools-inspired split view | |
| Simple scrollable list | Full-width cards, scroll through | |

**User's choice:** Table with expandable rows
**Notes:** None

### Should the audit log have filtering?

| Option | Description | Selected |
|--------|-------------|----------|
| Method + status filters | Dropdown filters for method and status range | |
| No filtering | Just chronological list | |
| You decide | Claude picks based on log volume | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Audit log navigation

### Where should users access the audit log?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page section | New section on Settings page | |
| Dedicated nav tab | Top-level tab in AppShell | |
| Footer/status bar link | Small "N API calls" link in footer | ✓ |

**User's choice:** Footer/status bar link
**Notes:** None

### What should the audit log open as?

| Option | Description | Selected |
|--------|-------------|----------|
| Full page view | Replaces main content area | ✓ |
| Slide-up panel | Panel from footer like browser devtools | |
| You decide | Claude picks | |

**User's choice:** Full page view
**Notes:** None

---

## Claude's Discretion

- Post-ignore detail panel behavior (close vs auto-advance)
- Un-ignore mechanism on ignored list
- Whether to include audit log filters
- Loading and empty states

## Deferred Ideas

None
