# Requirements: pmkar

**Defined:** 2026-03-27
**Core Value:** Surface relevant tickets from customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## v0.3.0 Requirements

Requirements for Notifications & Change Tracking milestone. Each maps to roadmap phases.

### Polling

- [x] **POLL-01**: User can configure auto-poll frequency (5m / 15m / 30m / 1h / off) in settings
- [x] **POLL-02**: App polls for ticket updates in background at configured interval (Rust-side tokio loop)
- [x] **POLL-03**: User can trigger a manual poll anytime via button or Cmd/Ctrl+R
- [x] **POLL-04**: App stores ticket snapshots in SQLite for change comparison
- [x] **POLL-05**: App detects ticket changes via hash-based fast check + field-level diff on mismatch
- [x] **POLL-06**: Poll watermark persists in SQLite and only advances after successful API response

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

- [x] **CHNG-01**: User can see field-level diff on ticket detail page showing what changed since last fetch
- [x] **CHNG-02**: Changed tickets display a visual indicator (badge/dot) in the ticket list view

### Watch Configuration

- [x] **WTCH-01**: User can add a watch selector by email domain (e.g. @acme.com)
- [x] **WTCH-02**: Domain selector resolves to matching users at config time (search + confirm list)

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
| POLL-01 | Phase 13 | Complete |
| POLL-02 | Phase 13 | Complete |
| POLL-03 | Phase 13 | Complete |
| POLL-04 | Phase 12 | Complete |
| POLL-05 | Phase 12 | Complete |
| POLL-06 | Phase 12 | Complete |
| NOTIF-01 | Phase 14 | Pending |
| NOTIF-02 | Phase 14 | Pending |
| NOTIF-03 | Phase 14 | Pending |
| NOTIF-04 | Phase 14 | Pending |
| NOTIF-05 | Phase 14 | Pending |
| NOTIF-06 | Phase 14 | Pending |
| NOTIF-07 | Phase 14 | Pending |
| NOTIF-08 | Phase 14 | Pending |
| CHNG-01 | Phase 15 | Complete |
| CHNG-02 | Phase 15 | Complete |
| WTCH-01 | Phase 16 | Complete |
| WTCH-02 | Phase 16 | Complete |

**Coverage:**
- v0.3.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
