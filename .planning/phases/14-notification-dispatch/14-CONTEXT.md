# Phase 14: Notification Dispatch - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Send OS-level desktop notifications when watched tickets change after a poll cycle. User controls which event types trigger notifications (new ticket, status, priority, comment) and can set quiet hours to suppress notifications outside work hours. Notification permission is requested before the first send. Change diff UI (Phase 15), watch configuration (Phase 16), and badge counts (NOTIF-09) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Notification content
- **D-01:** Each notification shows ticket key as title and change summary as body (e.g., Title: "CUST-123" — Body: "Status: Open → In Progress")
- **D-02:** One notification per changed ticket — no grouping or batching, even when multiple tickets change in a single poll cycle
- **D-03:** Comment notifications include commenter name and a truncated snippet (e.g., "CUST-123: Comment by John D. — 'We need to escalate this...'") — requires pulling comment data from snapshot diff

### Permission & first-run
- **D-04:** Request OS notification permission when user first sets poll frequency to anything other than Off — natural opt-in moment tied to monitoring activation
- **D-05:** If user denies permission, show a subtle info banner in the Notifications section of Settings: "Notifications disabled in system settings. Open System Settings to enable." — polling continues, just no OS notifications

### Preferences UI
- **D-06:** New "Notifications" section in SettingsPage, placed after the existing Polling section (flow: connections → appearance → polling → notifications)
- **D-07:** Toggle switches for each event type: New ticket, Status change, Priority change, New comment — consistent with typical desktop app settings pattern
- **D-08:** All event toggles default to ON when notifications are first enabled — opt-out model, user disables what they don't want
- **D-09:** Notification preferences persisted in SQLite via TriageDb app_settings table — same pattern as poll frequency, language, theme

### Quiet hours
- **D-10:** Quiet hours suppress and discard notifications — no queue, no catch-up burst. Changes are still detected and stored; user sees them when they open the app
- **D-11:** Quiet hours configured via start time + end time + weekday toggles (e.g., "Quiet from 18:00 to 08:00 on Mon–Fri")
- **D-12:** Quiet hours off by default — notifications work 24/7 until user explicitly configures boundaries

### Claude's Discretion
- Tauri notification plugin choice and integration approach
- Rust-side notification dispatch architecture (hook into poll-complete event vs. separate module)
- Time picker component implementation for quiet hours
- How to extract comment author + snippet from snapshot diff data
- i18n keys structure for notification-related strings
- Whether quiet hours check happens Rust-side or frontend-side

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Notification requirements
- `.planning/REQUIREMENTS.md` — NOTIF-01 through NOTIF-08 (permission, per-event notifications, preferences, quiet hours)
- `.planning/ROADMAP.md` Phase 14 — Success criteria and dependency on Phase 13

### Poll engine (Phase 13 deliverables)
- `src-tauri/src/poll_engine.rs` — `run_poll_loop()`, `do_poll()`, `PollCompletePayload` with `changed_keys` — notification dispatch hooks into poll-complete events
- `src-tauri/src/snapshot_db.rs` — `FieldChange` struct (field, old_value, new_value), `check_for_changes()`, `WATCHED_FIELDS` — source data for notification content

### Existing patterns
- `src-tauri/src/triage_db.rs` — SQLite settings persistence pattern (app_settings table) for notification preferences
- `src-tauri/src/commands.rs` — Tauri command registration pattern, `check_ticket_changes` command
- `src/features/connections/SettingsPage.tsx` — Settings page layout, dropdown/toggle patterns for new Notifications section

### Out of scope constraints
- `.planning/REQUIREMENTS.md` Out of Scope table — No click-to-navigate from notification (Tauri bugs #8644/#12834)
- `.planning/REQUIREMENTS.md` Future Requirements — NOTIF-09 (badge count) and NOTIF-10 (in-app history) deferred to v0.4+

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PollCompletePayload` in `poll_engine.rs`: Contains `changed_keys` and `checked_at` — notification dispatch can subscribe to the same `poll-complete` Tauri event
- `FieldChange` in `snapshot_db.rs`: Provides field name, old value, new value — directly maps to notification body content
- `SettingsPage.tsx`: Existing section layout with dropdowns — notification toggles and quiet hours extend this page
- `app_settings` table in `TriageDb`: Key-value persistence for notification prefs (same pattern as language, theme, poll frequency)

### Established Patterns
- Settings use immediate-apply pattern (no save button) — notification toggle changes should take effect immediately
- Tauri event system (`app_handle.emit("poll-complete", payload)`) — notification dispatch listens for this event
- `Arc<Mutex<>>` state management in Rust — notification preferences accessed through same pattern
- i18n via i18next with namespace-based keys — notification strings follow existing structure

### Integration Points
- Poll engine's `do_poll()` returns `PollCompletePayload` — notification logic needs the detailed `FieldChange` data per ticket, not just keys
- `SettingsPage.tsx` needs new Notifications section after the Polling section
- `src-tauri/src/main.rs` — Plugin registration for tauri-plugin-notification, new Tauri commands for notification prefs
- `src-tauri/Cargo.toml` — New dependency: tauri-plugin-notification

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- Badge count on dock/taskbar icon (NOTIF-09) — deferred to v0.4+
- In-app notification history panel (NOTIF-10) — deferred to v0.4+
- Click-to-navigate from OS notification to specific ticket — blocked by Tauri bugs #8644/#12834

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-notification-dispatch*
*Context gathered: 2026-03-28*
