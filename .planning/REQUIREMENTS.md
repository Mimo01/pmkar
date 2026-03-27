# Requirements: pmkar

**Defined:** 2026-03-27
**Core Value:** Surface relevant tickets from customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## v0.3.0 Requirements

Requirements for Notifications & Change Tracking milestone. Each maps to roadmap phases.

### Polling

- [ ] **POLL-01**: User can configure auto-poll frequency (5m / 15m / 30m / 1h / off) in settings
- [ ] **POLL-02**: App polls for ticket updates in background at configured interval (Rust-side tokio loop)
- [ ] **POLL-03**: User can trigger a manual poll anytime via button or Cmd/Ctrl+R
- [ ] **POLL-04**: App stores ticket snapshots in SQLite for change comparison
- [ ] **POLL-05**: App detects ticket changes via hash-based fast check + field-level diff on mismatch
- [ ] **POLL-06**: Poll watermark persists in SQLite and only advances after successful API response

### Notifications

- [ ] **NOTIF-01**: App requests OS notification permission on first poll enable (macOS requirement)
- [ ] **NOTIF-02**: User receives OS-level notification when a new ticket matches watch criteria
- [ ] **NOTIF-03**: User receives OS-level notification when a watched ticket's status changes
- [ ] **NOTIF-04**: User receives OS-level notification when a watched ticket's priority changes
- [ ] **NOTIF-05**: User receives OS-level notification when a new comment is added to a watched ticket
- [ ] **NOTIF-06**: Notification body includes change summary (e.g. "CUST-123: Status Open → In Progress")
- [ ] **NOTIF-07**: User can toggle notification preferences per event type in settings
- [ ] **NOTIF-08**: User can configure quiet hours to suppress notifications outside work hours

### Change Tracking

- [ ] **CHNG-01**: User can see field-level diff on ticket detail page showing what changed since last fetch
- [ ] **CHNG-02**: Changed tickets display a visual indicator (badge/dot) in the ticket list view

### Watch Configuration

- [ ] **WTCH-01**: User can add a watch selector by email domain (e.g. @acme.com)
- [ ] **WTCH-02**: Domain selector resolves to matching users at config time (search + confirm list)

## Future Requirements

Deferred to v0.4+. Tracked but not in current roadmap.

### Notifications (Enhanced)

- **NOTIF-09**: Taskbar/dock badge count showing unread change count
- **NOTIF-10**: In-app notification history panel

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Webhook-based push from Jira | Requires admin access, no public HTTPS endpoint on a desktop app |
| Persistent background daemon when window closed | Lifecycle, DB locking, and security complexity |
| Frontend-driven polling (setInterval) | Throttled when webview is backgrounded by OS |
| Sidecar process for polling | tauri::async_runtime::spawn is sufficient; sidecar adds overhead |
| Click-to-navigate from notification | Tauri bug #8644 / #12834 — verify fix before scoping |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POLL-01 | — | Pending |
| POLL-02 | — | Pending |
| POLL-03 | — | Pending |
| POLL-04 | — | Pending |
| POLL-05 | — | Pending |
| POLL-06 | — | Pending |
| NOTIF-01 | — | Pending |
| NOTIF-02 | — | Pending |
| NOTIF-03 | — | Pending |
| NOTIF-04 | — | Pending |
| NOTIF-05 | — | Pending |
| NOTIF-06 | — | Pending |
| NOTIF-07 | — | Pending |
| NOTIF-08 | — | Pending |
| CHNG-01 | — | Pending |
| CHNG-02 | — | Pending |
| WTCH-01 | — | Pending |
| WTCH-02 | — | Pending |

**Coverage:**
- v0.3.0 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after initial definition*
