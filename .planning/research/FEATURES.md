# Feature Research

**Domain:** Notifications, background polling, change tracking, and selector-based watching for a Tauri 2 / Rust / React 19 desktop app (Jira cross-instance bridge)
**Researched:** 2026-03-27
**Confidence:** HIGH for Tauri notification API and Jira changelog API; MEDIUM for UX patterns; HIGH for existing codebase analysis

---

> **Milestone scope:** This file covers ONLY the new features for v0.3.0. The original feature research for v0.1.0 (connection setup, ticket fetch, copy pipeline, triage workflow, audit log) remains valid and is not repeated here. This research focuses exclusively on: OS notifications, notification preferences, enhanced watch configuration, background polling, manual poll, and change diff view.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any monitoring/notification desktop tool. Missing these = the feature set feels half-built.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OS-level native notifications | Desktop tools that "notify on change" use native OS toast notifications — anything in-app-only feels disconnected | MEDIUM | `tauri-plugin-notification` (official, ships with Tauri plugins-workspace) provides this. Requires permission request on first use. Windows shows PowerShell sender in dev mode; production build shows app name. Permission must be requested before first notification is sent. |
| Configurable auto-poll interval | Any background polling tool exposes interval configuration — users expect control over how often the app hits the network | LOW | Standard range: 5 min / 15 min / 30 min / 1 hr / manual only. Store in SQLite `app_config` table (already exists). Render as a select in Settings. The Rust side uses `tokio::time::interval` inside a `tauri::async_runtime::spawn` loop. |
| Manual refresh / poll on demand | Users always want a "refresh now" button — automatic polling alone feels like loss of control | LOW | Expose as a Tauri command `poll_now` that triggers the same logic as the background poller. The existing `fetch_tickets` command is the logical foundation; polling reuses it and compares results. Keyboard shortcut (Cmd/Ctrl+R) is the expected UX. |
| Notification permission request | OS notifications require explicit permission on macOS and Windows — apps that skip this get silently blocked | LOW | `tauri-plugin-notification` exposes `requestPermission()` / `checkPermission()`. Should be requested on first Settings save or first time user enables notifications, not at app launch. |
| Per-event notification preferences | Users of Slack, Linear, GitHub expect to control which events trigger notifications (new ticket, status change, comment added, etc.) | MEDIUM | Store as a JSON blob or individual boolean columns in `app_config`. At minimum: new ticket detected / status changed / priority changed / comment added. Toggle per event type in Settings. |
| Change diff view on ticket | Any tool that says "something changed" must show what changed — otherwise the notification is noise | MEDIUM | Jira's `changelog.histories` already fetched and typed in the codebase (`ChangelogEntry`, `ChangelogItem` in `types.ts`). Need: store a snapshot of key fields at last-seen time, compare against re-fetched state, render a before/after diff in the TicketDetailPanel (new History tab entry or dedicated "Changes" section). |

### Differentiators (Competitive Advantage)

Features that raise the tool above "basic poller" status.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Selector-based watch (email domain) | "Watch all tickets assigned to anyone at customer.com" is more powerful than enumerating individual usernames, especially when customer team changes | MEDIUM | JQL does not natively support email domain patterns (confirmed: JRACLOUD-61425 and JRASERVER-22941 are open feature requests, not implemented). Implementation requires: fetch users matching domain pattern via `GET /rest/api/2/user/search?username=@domain.com` then expand into usernames for JQL `watcher in (...)` or `assignee in (...)`. Domain selector stored alongside `watched_users` in `fetch_config`. Must also support mixed (specific users + domains). |
| Change summary notification body | Instead of a generic "Ticket updated", surface what changed: "CUST-123: Status changed from Open to In Progress" makes the notification actionable | LOW | Construct notification body in Rust from the diff result before dispatching. Uses the same changelog parsing already present in `fetch_changelog` command. |
| Badge count on taskbar/dock | macOS dock badge and Windows taskbar badge showing count of unseen ticket changes sets expectation that app has things to review | MEDIUM | `tauri-plugin-notification` supports channels but badge count requires `app.set_badge_count()` via `tauri-plugin-badge` (separate from notification plugin — verify during implementation). On Linux this is less reliable. |
| Quiet hours / do-not-disturb awareness | Respect system DND on macOS (Focus mode) — do not fire OS notifications when the user is in a meeting or focused | LOW | On macOS 12+, the OS itself suppresses notifications when Focus mode is active; the app does not need to implement this. However, an explicit "only notify during work hours" setting (start/end time) is a useful opt-in. LOW complexity to store, MEDIUM to implement the time-window check in the Rust poller. |
| New-ticket-only diff emphasis | For brand-new tickets (first seen), diff view shows "New ticket" badge rather than field-by-field diff (which would be all fields) | LOW | Guard in diff rendering: if `triage_state.first_seen` equals the current poll timestamp, render as "new" not "changed". Reuses existing `TriageEntry.first_seen` field already in the DB. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Webhook-based push from Jira | "Real-time notification when Jira fires a webhook" — zero-latency changes | Jira Server webhooks require admin access to configure. Self-hosted Jira Server versions < 8 have unreliable webhook delivery. The app has no public HTTPS endpoint to receive webhooks. Adds infrastructure (reverse proxy or ngrok) that breaks the desktop-native model. | Configurable polling at 5-minute minimum. For most workflows, 5-minute latency is acceptable. |
| Persistent background daemon / system tray | "Run in the background even when the app window is closed" | Tauri system tray plugins (`tauri-plugin-tray`) exist but background polling when the window is hidden adds lifecycle complexity: credential access, DB locking, OS login items registration. Also harder to audit. | Poll only when the app is foregrounded OR implement a clear in-app indicator (last polled time + "poll now" button). Document that closing the window stops polling — users understand this. |
| Notifications for every field change | "Notify me when anything changes on any watched ticket" | Generates notification spam for minor changes (e.g., description reformatted, attachment renamed). Causes users to disable all notifications. | Default to high-signal events only: status change, priority change, new comment, new ticket. Make lower-signal events (e.g., summary edit, label change) opt-in. |
| In-app notification center / inbox | "Show all past notifications in a panel" | Recreates what the OS already does in its notification center. Adds a separate persistence layer (notification log table), read/unread state, dismissal logic. | Use the OS notification center as-is for the notification history. In-app, the change diff view and triage state already surface what changed. |
| Notification rate limiting / deduplication daemon | "Don't fire duplicate notifications for the same event" | A deduplication system requires tracking last-notified state per ticket per field per value — a mini event-sourcing system. Overkill for a polling interval of 5+ minutes. | At each poll, compare current snapshot to previous snapshot. Only notify on delta. Store previous snapshot as a JSON blob in SQLite keyed by ticket key. Simple equality comparison is sufficient. |
| Polling via separate process / sidecar | "Use a sidecar process so polling doesn't block the UI" | The existing app already has a Tokio async runtime via `tauri::async_runtime::spawn`. A sidecar adds process management, IPC, and crash recovery complexity. | `tauri::async_runtime::spawn` with `tokio::time::interval` runs on a non-blocking worker thread. The UI remains responsive. No sidecar needed. |

---

## Feature Dependencies

```
[Background Poller (Rust, tokio interval)]
    └──requires──> [Poll Interval Config (SQLite app_config)]
    └──requires──> [fetch_tickets command (already exists)]
    └──produces──> [Change Diff (per ticket)]
        └──requires──> [Ticket Snapshot Storage (SQLite, new table)]
    └──produces──> [OS Notification (via tauri-plugin-notification)]
        └──requires──> [Notification Permission (requested once)]
        └──requires──> [Notification Preference Config (per event type)]

[Manual Poll on Demand]
    └──shares logic with──> [Background Poller]
    └──triggered by──> [UI "Refresh" button / Cmd+R]

[Enhanced Watch Config (Selector-based)]
    └──extends──> [watched_users in fetch_config (already exists)]
    └──requires──> [User Search API (GET /rest/api/2/user/search)]
    └──produces──> [Expanded user list for JQL]

[Change Diff View]
    └──requires──> [Ticket Snapshot Storage]
    └──requires──> [fetch_changelog command (already exists)]
    └──renders in──> [TicketDetailPanel (already exists)]

[Notification Preferences]
    └──stored in──> [app_config (already exists, needs new columns)]
    └──consulted by──> [Background Poller before firing notification]
```

### Dependency Notes

- **Background poller requires existing fetch_tickets:** The poller is not a new data pipeline — it calls the same Rust command already used by manual fetch and compares results to a stored snapshot. Reuse is clean.
- **Change diff requires snapshot storage:** A new SQLite table (`ticket_snapshots`) holding the last-seen values of key fields (status, priority, assignee, comment count) per ticket key is needed. Without it, there is nothing to diff against.
- **OS notification requires plugin registration:** `tauri-plugin-notification` must be added to `Cargo.toml` and `tauri.conf.json` permissions. This is a new dependency not currently in the project.
- **Selector-based watch requires user search API call:** The email domain selector is expanded at fetch time into a list of usernames via Jira's user search endpoint. This means one additional API call per configured domain per poll cycle. Must be factored into rate limiting considerations.
- **Notification preferences block notification dispatch:** Before firing any notification, the Rust poller must check the stored preferences. Preferences live in `app_config` and are loaded at poller start; changes should cause the poller to reload config.
- **Manual poll shares poller logic:** The `poll_now` command and the background interval loop should call the same internal function. Do not duplicate the compare-and-notify logic.
- **Change diff view is independent of notifications:** A user can view diffs without enabling notifications. Diff view depends only on snapshot storage, not on the notification plugin.

---

## MVP Definition

This is milestone v0.3.0 MVP — what is needed for this milestone to ship.

### Launch With (v0.3.0)

- [ ] Background polling with configurable interval (5 min / 15 min / 30 min / 1 hr / off) — core feature, without this nothing else in the milestone is useful
- [ ] Ticket snapshot storage — required by both polling and diff view; small SQLite table, no UI needed
- [ ] Change detection (compare snapshot to freshly fetched data) — the logic that makes polling meaningful
- [ ] OS notification dispatch for new tickets (tauri-plugin-notification) — primary user-visible output of polling
- [ ] Notification permission request flow — required before any notification fires on macOS/Windows
- [ ] Per-event notification preferences (new ticket, status change, comment added at minimum) — prevents notification spam from day one
- [ ] Manual poll on demand (UI button + keyboard shortcut) — users need immediate control
- [ ] Change diff view in TicketDetailPanel — shows what changed since last seen; required for notifications to be actionable

### Add After Validation (v0.3.x)

- [ ] Selector-based watch by email domain — useful but adds API complexity; validate basic polling first
- [ ] Change summary in notification body (specific field + value) — polish on top of working notifications
- [ ] Quiet hours setting (time window for notifications) — quality-of-life addition after core works

### Future Consideration (v0.4+)

- [ ] Taskbar/dock badge count — requires `tauri-plugin-badge` research and cross-platform testing; low-risk deferral
- [ ] Notification history in-app — adds persistence complexity; OS notification center is sufficient for now

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Background polling with configurable interval | HIGH | MEDIUM | P1 |
| Ticket snapshot storage (new SQLite table) | HIGH (foundation) | LOW | P1 |
| Change detection logic | HIGH | LOW | P1 |
| OS notification on new ticket | HIGH | LOW (plugin already well-supported) | P1 |
| Notification permission request | HIGH | LOW | P1 |
| Per-event notification preferences | HIGH | LOW | P1 |
| Manual poll on demand | HIGH | LOW | P1 |
| Change diff view (TicketDetailPanel) | HIGH | MEDIUM | P1 |
| Selector-based watch (email domain) | MEDIUM | MEDIUM | P2 |
| Change summary in notification body | MEDIUM | LOW | P2 |
| Quiet hours config | LOW-MEDIUM | LOW | P2 |
| Taskbar/dock badge count | LOW | MEDIUM | P3 |
| In-app notification history | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v0.3.0 launch
- P2: Add during v0.3.x iterations
- P3: Future milestone consideration

---

## Existing Codebase Integration Points

Confidence: HIGH — based on direct codebase analysis.

These are the concrete hooks in the existing code that new features attach to:

| New Feature | Existing Hook | Notes |
|-------------|---------------|-------|
| Background poller spawn | `tauri::async_runtime::spawn` pattern already used in main.rs (mock server) | Same pattern; spawn in `setup()` closure |
| Poll interval config | `app_config` SQLite table (already exists, `language` column only) | Add `poll_interval_minutes INTEGER NOT NULL DEFAULT 15` via ALTER TABLE migration |
| Notification preferences | `app_config` table | Add boolean columns per event type via ALTER TABLE migration |
| Ticket snapshot storage | New `ticket_snapshots` table in `triage.db` | `ticket_key TEXT PK, snapshot_json TEXT, captured_at TEXT` |
| Change detection | `fetch_tickets` Tauri command (already exists) | Poller calls it; result compared to snapshot |
| Changelog for diff view | `fetch_changelog` Tauri command (already exists) | Returns `ChangelogEntry[]` already typed |
| Watched users | `fetch_config.watched_users` (already exists, JSON array) | Domain selector extends this; stored as `{ type: "user" | "domain", value: string }[]` |
| OS notification dispatch | `tauri-plugin-notification` (new dependency) | Add to Cargo.toml and tauri.conf.json |
| Settings UI | `SettingsPage.tsx` (already exists) | Add polling interval select and notification preference toggles |
| Diff view rendering | `TicketDetailPanel.tsx` + `HistoryTab.tsx` (already exist) | `HistoryTab` already renders `ChangelogEntry[]` from `changelog.histories` |

---

## Jira API Support for Change Detection

Confidence: HIGH — based on Atlassian REST API documentation and Jira community verified patterns.

### Polling for Changed Issues

The correct JQL pattern for incremental polling is:

```
(assignee = currentUser() OR watcher in (user1, user2)) AND updated > "2026-03-27 10:00"
```

The `updated` field supports relative (`-1h`, `-30m`) and absolute date-time values. The Jira Server v2 API and Jira Cloud v3 API both support this pattern via `POST /rest/api/2/search` (Server) and `POST /rest/api/3/issue/search` (Cloud). Store `last_polled_at` in `fetch_config` (already has `last_fetched_at`).

**Known caveat:** Some community reports note that Jira Cloud's `updated` filter can occasionally return issues slightly outside the range due to index lag. Mitigation: overlap the window by 2 minutes (query `updated > (last_poll - 2 minutes)`).

### Changelog API for Diff

`GET /rest/api/2/issue/{key}?expand=changelog` returns `changelog.histories` as a list of `ChangelogEntry` objects, each containing `items[].field`, `items[].fromString`, `items[].toString`. This data structure is already defined in `types.ts` as `ChangelogEntry` / `ChangelogItem` and is fetched by the existing `fetch_changelog` command.

For the snapshot-based diff (app-side), the poller compares stored field values directly without an API call — the changelog API is only used for the detailed diff view when a user opens a ticket. These are two separate mechanisms:

1. **Polling diff** (Rust, lightweight): compare `status.name`, `priority.name`, `fields.comment.comments.length` against the stored snapshot. No extra API call.
2. **Detail diff view** (React, on demand): call `fetch_changelog` when user opens a ticket with the "changed" indicator. Already implemented.

---

## Sources

- [Tauri v2 Notification Plugin documentation](https://v2.tauri.app/plugin/notification/) — HIGH confidence
- [tauri-plugin-notification on crates.io](https://crates.io/crates/tauri-plugin-notification) — HIGH confidence
- [Jira REST API: changelog expansion](https://support.atlassian.com/jira/kb/how-to-analyze-the-history-or-changelog-of-an-issue-in-jira/) — HIGH confidence
- [Jira email domain filtering limitation (JRACLOUD-61425)](https://jira.atlassian.com/browse/JRACLOUD-61425) — MEDIUM confidence (feature request status, open as of research date)
- [Jira incremental sync pattern via updatedDate](https://community.atlassian.com/forums/Jira-questions/Rest-API-Filter-based-on-created-or-updated-date/qaq-p/1354197) — MEDIUM confidence (community-verified pattern)
- [Smashing Magazine: Design Guidelines for Notifications UX](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) — MEDIUM confidence
- [Tauri async_runtime documentation](https://docs.rs/tauri/latest/tauri/async_runtime/index.html) — HIGH confidence
- Pmkar codebase: `src-tauri/src/main.rs`, `triage_db.rs`, `commands.rs`, `src/features/tickets/types.ts`, `ticketStore.ts` — HIGH confidence (direct analysis)

---

*Feature research for: Pmkar v0.3.0 — Notifications and Change Tracking milestone*
*Researched: 2026-03-27*
