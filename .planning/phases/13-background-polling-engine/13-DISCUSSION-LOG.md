# Phase 13: Background Polling Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 13-background-polling-engine
**Areas discussed:** Poll frequency UI, Poll loop lifecycle, Manual refresh trigger, Frontend feedback

---

## Poll Frequency UI

| Option | Description | Selected |
|--------|-------------|----------|
| New "Polling" section | Dedicated section below Language/Theme in SettingsPage | ✓ |
| Grouped under "Notifications" | Combine with future notification prefs | |
| You decide | Claude picks placement | |

**User's choice:** New "Polling" section (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown | Consistent with existing theme/language selectors | ✓ |
| Segmented buttons | All options visible at once | |
| You decide | Claude picks | |

**User's choice:** Dropdown (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate | Change takes effect instantly like language/theme | ✓ |
| Explicit save button | User clicks Save to apply | |

**User's choice:** Immediate (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite via TriageDb | Same pattern as language preference | ✓ |
| Tauri config file | Tauri store plugin for JSON config | |

**User's choice:** SQLite via TriageDb (Recommended)

---

## Poll Loop Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Log and retry next cycle | Silent failure, skip cycle, try next interval | ✓ |
| Exponential backoff | Double wait after failure | |
| Notify user on repeated failures | Emit warning after N consecutive failures | |

**User's choice:** Log and retry next cycle (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel and restart with new interval | Abort current sleep, start new cycle immediately | ✓ |
| Finish current cycle, apply next | Let old timer expire then switch | |

**User's choice:** Cancel and restart with new interval (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-start | Read saved frequency on startup, start if not off | ✓ |
| No, require manual enable | User must enable each session | |

**User's choice:** Yes, auto-start (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Watermark-filtered JQL | Use get_poll_watermark() to limit API calls | ✓ |
| Re-fetch all tracked tickets | Poll every ticket in snapshot store | |

**User's choice:** Watermark-filtered JQL (Recommended)

---

## Manual Refresh Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Ticket list header/toolbar | Refresh icon next to Fetch button | |
| AppShell header bar | Global refresh in top-level header | |
| Both locations | Toolbar + global shortcut | |

**User's choice:** Other — "The Fetch button should do both actions" (fetch + snapshot check as one operation)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, reset timer | Manual poll resets countdown | ✓ |
| No, independent | Background timer unaffected | |

**User's choice:** Yes, reset timer (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Poll refresh | Override Cmd/Ctrl+R for poll | |
| Keep browser reload, different shortcut | Use F5 or Cmd/Ctrl+Shift+R | ✓ |

**User's choice:** Keep browser reload, use different shortcut

| Option | Description | Selected |
|--------|-------------|----------|
| F5 | Classic refresh key | ✓ |
| Cmd/Ctrl+Shift+R | Modified reload shortcut | |

**User's choice:** F5 (Recommended)

---

## Frontend Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle timestamp near Fetch button | "Last checked: 2 min ago" in toolbar | ✓ |
| Status bar / footer | Global footer area | |
| No visible timestamp | Trust the system | |

**User's choice:** Subtle timestamp near Fetch button (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Animate Fetch button icon | Spin/pulse during poll | ✓ |
| Toast notification | "Checking for updates..." toast | |
| No indicator for auto-polls | Silent background polls | |

**User's choice:** Animate Fetch button icon (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri emit events | Rust emits poll-complete with changed keys | ✓ |
| Frontend polls a command | Frontend calls get_poll_results | |

**User's choice:** Tauri emit events (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-refresh ticket list | Silently update on changes | ✓ |
| Banner with refresh button | "N tickets updated" banner | |
| You decide | Claude picks | |

**User's choice:** Auto-refresh ticket list (Recommended)

---

## Claude's Discretion

- Tokio task cancellation mechanism
- Tauri event payload structure
- Last-checked timestamp update strategy
- Error logging format
- Debounce for rapid manual poll clicks

## Deferred Ideas

None — discussion stayed within phase scope
