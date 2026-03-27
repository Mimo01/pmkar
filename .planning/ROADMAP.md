# Roadmap: Pmkar

## Milestones

- ✅ **v0.1.0 MVP** — Phases 1-11 (shipped 2026-03-25)
- 🚧 **v0.3.0 Notifications & Change Tracking** — Phases 12-16 (in progress)

## Phases

<details>
<summary>✅ v0.1.0 MVP (Phases 1-11) — SHIPPED 2026-03-25</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-03-20
- [x] Phase 2: Connection Setup (3/3 plans) — completed 2026-03-20
- [x] Phase 3: Ticket Fetch and Review (5/5 plans) — completed 2026-03-21
- [x] Phase 4: Copy — Core Fields (5/5 plans) — completed 2026-03-22
- [x] Phase 5: Copy — Attachments and Comments (3/3 plans) — completed 2026-03-22
- [x] Phase 6: Triage and Audit (3/3 plans) — completed 2026-03-23
- [x] Phase 7: Internationalization (3/3 plans) — completed 2026-03-23
- [x] Phase 8: UI Redesign (6/6 plans) — completed 2026-03-24
- [x] Phase 9: Accessibility (4/4 plans) — completed 2026-03-24
- [x] Phase 10: Codebase Quality (5/5 plans) — completed 2026-03-25
- [x] Phase 11: Deployment & Auto-Updates (4/4 plans) — completed 2026-03-25

Full details: [milestones/v0.1.0-ROADMAP.md](milestones/v0.1.0-ROADMAP.md)

</details>

### 🚧 v0.3.0 Notifications & Change Tracking (In Progress)

**Milestone Goal:** Detect ticket changes after initial fetch, notify users via OS-level desktop notifications, and let them configure what they watch, what triggers notifications, and how often to poll.

- [x] **Phase 12: Snapshot Foundation** - SQLite snapshot storage and hash-based change detection (completed 2026-03-27)
- [x] **Phase 13: Background Polling Engine** - Rust-side poll loop with configurable interval and manual trigger (completed 2026-03-27)
- [ ] **Phase 14: Notification Dispatch** - OS-level notifications with per-event preferences and quiet hours
- [ ] **Phase 15: Change Diff View** - Field-level diff UI and changed-ticket indicators in ticket list
- [ ] **Phase 16: Enhanced Watch Configuration** - Email domain selector with config-time user resolver

## Phase Details

### Phase 12: Snapshot Foundation
**Goal**: The app can store ticket snapshots and detect which fields changed since the last fetch
**Depends on**: Phase 11 (existing codebase)
**Requirements**: POLL-04, POLL-05, POLL-06
**Success Criteria** (what must be TRUE):
  1. A ticket fetched twice with no changes produces zero detected field changes
  2. A ticket whose status or priority changes between fetches produces a non-empty field change list with old and new values
  3. A comment-only update (no changelog entry) is detected as a change via comment count delta
  4. The poll watermark stored in SQLite does not advance when the API call fails
**Plans**: 2 plans
Plans:
- [x] 12-01-PLAN.md — SnapshotDb data layer: SQLite storage, SHA-256 hash, field-level diff, watermark query (TDD)
- [x] 12-02-PLAN.md — Tauri integration: SnapshotDb state management and command wiring

### Phase 13: Background Polling Engine
**Goal**: The app polls for ticket updates on a Rust-side background loop at a user-configured interval, and the user can trigger a manual poll at any time
**Depends on**: Phase 12
**Requirements**: POLL-01, POLL-02, POLL-03
**Success Criteria** (what must be TRUE):
  1. User can set poll frequency (5m / 15m / 30m / 1h / off) in Settings and the change takes effect without restarting the app
  2. The background poll loop runs on the Rust side and continues firing when the app window is minimized
  3. User can click a Refresh button (or press F5) and see the ticket list update immediately
  4. Polling stops cleanly when frequency is set to off and resumes when a frequency is re-selected
**Plans**: 2 plans
Plans:
- [x] 13-01-PLAN.md — Rust poll engine: tokio loop with watch-channel control, TriageDb frequency persistence, Tauri commands, main.rs wiring
- [x] 13-02-PLAN.md — Frontend integration: Settings polling section, dual-purpose Fetch button, F5 shortcut, poll-complete event listener
**UI hint**: yes

### Phase 14: Notification Dispatch
**Goal**: The app sends OS-level desktop notifications when watched tickets change, with user control over which event types trigger notifications and when notifications are suppressed
**Depends on**: Phase 13
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08
**Success Criteria** (what must be TRUE):
  1. On macOS, the app requests notification permission before the first poll fires and does not send notifications without permission
  2. User receives an OS notification containing a change summary (e.g., "CUST-123: Status Open → In Progress") when a watched ticket's status changes
  3. User receives an OS notification when a watched ticket's priority changes or a new comment is added
  4. User can toggle per-event notification preferences in Settings (new ticket, status change, priority change, comment) and toggling off suppresses that event type immediately
  5. User can set quiet hours in Settings; notifications are suppressed outside the configured work-hours window
**Plans**: 2 plans
Plans:
- [ ] 14-01-PLAN.md — Rust backend: notification dispatcher module, plugin registration, notification prefs in SQLite, poll engine enrichment with FieldChange data
- [ ] 14-02-PLAN.md — Frontend: NotificationsSection UI with event toggles, quiet hours, permission request, i18n keys
**UI hint**: yes

### Phase 15: Change Diff View
**Goal**: Users can see exactly what changed on a ticket since it was last fetched, both as a visual indicator in the list and as a field-level diff in the detail view
**Depends on**: Phase 13
**Requirements**: CHNG-01, CHNG-02
**Success Criteria** (what must be TRUE):
  1. A ticket with detected changes shows a visual badge or dot in the ticket list view
  2. Opening a changed ticket's detail view shows a diff panel with old and new values for each changed field
  3. The diff panel accounts for comment and worklog changes, not only changelog field items
**Plans**: 2 plans
Plans:
- [ ] 15-01-PLAN.md — [to be planned]
- [ ] 15-02-PLAN.md — [to be planned]
**UI hint**: yes

### Phase 16: Enhanced Watch Configuration
**Goal**: Users can add a watch selector by email domain; the app resolves matching users from Jira at configuration time and stores the resulting user list
**Depends on**: Phase 13
**Requirements**: WTCH-01, WTCH-02
**Success Criteria** (what must be TRUE):
  1. User can type an email domain (e.g., @acme.com) in watch configuration and trigger a user search against the Jira instance
  2. The app displays the list of matched users for confirmation before saving the selector
  3. When Jira Cloud privacy settings hide email addresses, the app shows an explicit warning rather than silently returning an empty list
**Plans**: 2 plans
Plans:
- [ ] 16-01-PLAN.md — [to be planned]
- [ ] 16-02-PLAN.md — [to be planned]
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v0.1.0 | 4/4 | Complete | 2026-03-20 |
| 2. Connection Setup | v0.1.0 | 3/3 | Complete | 2026-03-20 |
| 3. Ticket Fetch and Review | v0.1.0 | 5/5 | Complete | 2026-03-21 |
| 4. Copy — Core Fields | v0.1.0 | 5/5 | Complete | 2026-03-22 |
| 5. Copy — Attachments and Comments | v0.1.0 | 3/3 | Complete | 2026-03-22 |
| 6. Triage and Audit | v0.1.0 | 3/3 | Complete | 2026-03-23 |
| 7. Internationalization | v0.1.0 | 3/3 | Complete | 2026-03-23 |
| 8. UI Redesign | v0.1.0 | 6/6 | Complete | 2026-03-24 |
| 9. Accessibility | v0.1.0 | 4/4 | Complete | 2026-03-24 |
| 10. Codebase Quality | v0.1.0 | 5/5 | Complete | 2026-03-25 |
| 11. Deployment & Auto-Updates | v0.1.0 | 4/4 | Complete | 2026-03-25 |
| 12. Snapshot Foundation | v0.3.0 | 2/2 | Complete    | 2026-03-27 |
| 13. Background Polling Engine | v0.3.0 | 2/2 | Complete    | 2026-03-27 |
| 14. Notification Dispatch | v0.3.0 | 0/2 | Not started | - |
| 15. Change Diff View | v0.3.0 | 0/? | Not started | - |
| 16. Enhanced Watch Configuration | v0.3.0 | 0/? | Not started | - |
