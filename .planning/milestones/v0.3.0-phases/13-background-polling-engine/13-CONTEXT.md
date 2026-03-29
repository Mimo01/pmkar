# Phase 13: Background Polling Engine - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Rust-side tokio background loop that polls for ticket updates at a user-configured interval (5m / 15m / 30m / 1h / off). User can trigger a manual poll via the existing Fetch button or F5 shortcut. Poll results are emitted to the frontend via Tauri events. Notifications (Phase 14), change diff UI (Phase 15), and watch configuration (Phase 16) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Poll frequency UI
- **D-01:** New "Polling" section in SettingsPage, below existing Language/Theme sections
- **D-02:** Dropdown selector for frequency options (5m / 15m / 30m / 1h / Off) — consistent with existing theme/language dropdowns
- **D-03:** Frequency change takes effect immediately (no save button) — same pattern as language/theme toggles
- **D-04:** Poll frequency persisted in SQLite via TriageDb app_settings table — survives app restarts

### Poll loop lifecycle
- **D-05:** Poll loop runs as a tokio::spawn task on the Rust side — continues firing when webview is minimized
- **D-06:** On app launch, read saved frequency from SQLite; if not "off", auto-start the poll loop immediately
- **D-07:** On API error (network timeout, 401, etc.), log the error and retry on next scheduled cycle — no watermark advance, no user notification (silent failure)
- **D-08:** When user changes frequency mid-cycle, cancel current sleep and restart with new interval immediately
- **D-09:** Poll scope uses watermark-filtered JQL via `get_poll_watermark()` — only fetches tickets updated since the watermark, not all tracked tickets

### Manual refresh trigger
- **D-10:** No separate refresh button — the existing Fetch button in TicketListPage becomes dual-purpose: fetches tickets AND runs snapshot change detection in one action
- **D-11:** F5 keyboard shortcut triggers manual poll (Cmd/Ctrl+R left as browser default)
- **D-12:** Manual poll resets the background timer — next auto-poll starts a full interval from the manual poll time

### Frontend feedback
- **D-13:** Subtle "Last checked: X min ago" timestamp displayed near the Fetch button in the ticket list toolbar
- **D-14:** Fetch button icon animates (spin/pulse) while a poll is in progress — no toast, no layout shift
- **D-15:** Rust emits Tauri events (e.g., `poll-complete`) with changed ticket keys after each poll cycle — frontend listens and updates
- **D-16:** When changes are detected, ticket list auto-refreshes silently — no banner or manual "show updates" step

### Claude's Discretion
- Exact tokio task cancellation mechanism (e.g., `tokio::sync::watch` channel, `AbortHandle`, or `tokio::select!` with a signal)
- Tauri event payload structure for poll-complete events
- How the "last checked" relative timestamp updates (reactive interval vs. on-event)
- Error logging format and verbosity for failed poll cycles
- Whether to debounce rapid manual poll clicks

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Polling requirements
- `.planning/REQUIREMENTS.md` — POLL-01 (configurable frequency), POLL-02 (background Rust-side loop), POLL-03 (manual trigger)
- `.planning/ROADMAP.md` Phase 13 — Success criteria and dependency on Phase 12

### Snapshot foundation (Phase 12 deliverables)
- `src-tauri/src/snapshot_db.rs` — `SnapshotDb` struct, `check_for_changes()`, `get_watermark()`, `FieldChange` type
- `src-tauri/src/commands.rs` lines 1911-1940 — `check_ticket_changes` and `get_poll_watermark` Tauri commands

### Existing patterns
- `src-tauri/src/triage_db.rs` — SQLite settings persistence pattern (app_settings table, `get_app_language`/`set_app_language`)
- `src-tauri/src/main.rs` — Tauri app setup, state management (`Arc<Mutex<>>` pattern), command registration
- `src-tauri/src/commands.rs` lines 675-760 — `fetch_tickets` and `fetch_ticket_detail` commands (poll loop will invoke similar logic)

### Frontend integration
- `src/features/connections/SettingsPage.tsx` — Settings page layout, dropdown pattern for new Polling section
- `src/features/tickets/TicketListPage.tsx` — Ticket list with Fetch button (will become dual-purpose)
- `src/features/tickets/ticketStore.ts` — Zustand store for ticket state (poll results update this)

### Out of scope constraints
- `.planning/REQUIREMENTS.md` Out of Scope table — No frontend-driven polling, no sidecar, no persistent daemon, no webhook push

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SnapshotDb::check_for_changes()` (`snapshot_db.rs`): Core change detection — poll loop calls this per ticket after fetching
- `SnapshotDb::get_watermark()` (`snapshot_db.rs`): Returns MIN(last_checked_at) — used to build watermark-filtered JQL
- `check_ticket_changes` Tauri command (`commands.rs:1918`): Already wired as a Tauri command — frontend can call directly for manual poll
- `get_poll_watermark` Tauri command (`commands.rs:1935`): Already wired — frontend or Rust-side can query watermark
- `TriageDb` app_settings pattern (`triage_db.rs`): get/set language already works — same pattern for poll frequency
- `app.emit()` / `Emitter` trait (`main.rs`): Tauri event emission already imported — use for poll-complete events

### Established Patterns
- `Arc<Mutex<>>` for shared state across Tauri commands (TriageDb, AuditDb, SnapshotDb all use this)
- SQLite persistence for user preferences (language stored in TriageDb)
- Serde rename_all camelCase for Rust-to-frontend type serialization
- `AppResult<T>` / `AppError` error type wrapping across all Rust modules

### Integration Points
- Poll loop spawned during `tauri::Builder::setup()` in `main.rs` — needs access to app handle for emit and state
- Settings dropdown in `SettingsPage.tsx` — new section after existing Theme section
- Fetch button in `TicketListPage.tsx` — enhanced to also trigger snapshot checks
- `ticketStore.ts` — listen for `poll-complete` events and re-fetch ticket list

</code_context>

<specifics>
## Specific Ideas

- Existing Fetch button should be enhanced to do both: fetch tickets from Jira AND run snapshot change detection — not a separate "poll" button
- F5 as the manual poll shortcut (not Cmd/Ctrl+R which stays as browser reload)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-background-polling-engine*
*Context gathered: 2026-03-27*
