# Phase 14: Notification Dispatch - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 14-notification-dispatch
**Areas discussed:** Notification content, Permission & first-run, Preferences UI, Quiet hours

---

## Notification Content

| Option | Description | Selected |
|--------|-------------|----------|
| Key + change summary | Title: "CUST-123" — Body: "Status: Open → In Progress". Compact, scannable. | ✓ |
| Key + ticket title + change | Title: "CUST-123: Fix login timeout" — Body: change summary. More context but longer. | |
| Minimal — key only | Title: "CUST-123 changed" — Body: just the field name. | |

**User's choice:** Key + change summary
**Notes:** Matches NOTIF-06 requirement directly.

### Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| One per ticket | Each changed ticket gets its own notification. | ✓ |
| Grouped summary | Single notification: "3 tickets changed: CUST-123, CUST-456, CUST-789". | |
| Individual up to 3, then group | Show individual for 1-3 changes; collapse into summary for more. | |

**User's choice:** One per ticket

### Comment notifications

| Option | Description | Selected |
|--------|-------------|----------|
| Commenter name + snippet | "CUST-123: Comment by John D. — 'We need to escalate...'" (truncated). | ✓ |
| Just "new comment" | "CUST-123: New comment added". Simpler. | |

**User's choice:** Commenter name + snippet

---

## Permission & First-Run

### When to request permission

| Option | Description | Selected |
|--------|-------------|----------|
| On first poll enable | When user first sets poll frequency to non-Off. Natural opt-in moment. | ✓ |
| On first change detected | Lazy — only request when something to notify about. | |
| On app launch (always) | Request at startup. Simple but potentially annoying. | |

**User's choice:** On first poll enable

### If permission denied

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle banner in Settings | Info banner in Notifications section with link to System Settings. | ✓ |
| Toast on first suppressed | In-app toast the first time a notification would have fired but couldn't. | |
| Do nothing | Silently skip notifications. | |

**User's choice:** Subtle banner in Settings

---

## Preferences UI

### Toggle presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle switches | On/off toggle for each event type in new Notifications section. | ✓ |
| Checkboxes in a group | Checkbox list under "Notify me when..." heading. | |
| Master toggle + per-event | One master toggle, then per-event toggles underneath. | |

**User's choice:** Toggle switches

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| After Polling section | Flow: connections → appearance → polling → notifications. | ✓ |
| Own tab/page | Separate "Notifications" tab. | |
| Inside Polling section | Nest under existing Polling section. | |

**User's choice:** After Polling section

### Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| All ON by default | Opt-out model — user gets everything, disables what they don't want. | ✓ |
| All OFF by default | Opt-in model — quieter start but more setup friction. | |

**User's choice:** All ON by default

---

## Quiet Hours

### Suppression behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Suppress and discard | Notifications silently dropped during quiet hours. No queue. | ✓ |
| Queue and deliver after | Queued and delivered as batch when quiet hours end. | |
| Suppress with badge count | Suppressed but dock badge shows count. (Deferred: NOTIF-09) | |

**User's choice:** Suppress and discard

### Schedule configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Start time + end time | Simple: "Quiet from 18:00 to 08:00". Two time pickers. Every day. | |
| Start + end + weekday toggle | Time range plus checkboxes for which days. More flexible. | ✓ |
| Work hours model | Flip: "Notify during 08:00–18:00". Same outcome, different mental model. | |

**User's choice:** Start + end + weekday toggle

### Default state

| Option | Description | Selected |
|--------|-------------|----------|
| Off by default | Quiet hours disabled until user configures. Notifications work 24/7. | ✓ |
| On with sensible defaults | Pre-filled 18:00–08:00 weekdays. | |

**User's choice:** Off by default

---

## Claude's Discretion

- Tauri notification plugin choice and integration approach
- Rust-side notification dispatch architecture
- Time picker component implementation
- Comment author + snippet extraction from snapshot diff data
- i18n keys structure for notification strings
- Whether quiet hours check happens Rust-side or frontend-side

## Deferred Ideas

- Badge count on dock/taskbar icon (NOTIF-09) — v0.4+
- In-app notification history panel (NOTIF-10) — v0.4+
- Click-to-navigate from notification — blocked by Tauri bugs #8644/#12834
