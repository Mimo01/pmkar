# Architecture Research

**Domain:** Tauri 2 desktop app — OS notifications, background polling, change tracking, selector-based watching
**Researched:** 2026-03-27
**Confidence:** HIGH (Tauri official docs + existing codebase inspection)

## Focus

This document covers only the NEW architectural additions for v0.3.0. The existing architecture (IPC via invoke, Arc<Mutex<TriageDb>>, Zustand stores per feature, SQLite in app data dir) is well-established and should not be restructured.

---

## System Overview

### Current Architecture (unchanged)

```
┌──────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend                          │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │  ticketStore  │  │ connectionStore│  │   updateStore      │   │
│  │   (Zustand)   │  │   (Zustand)    │  │   (Zustand)        │   │
│  └───────┬───────┘  └───────┬────────┘  └────────────────────┘   │
│          │                  │   invoke() / listen()               │
├──────────┴──────────────────┴──────────────────────────────────-─┤
│                     Tauri IPC Bridge                               │
├───────────────────────────────────────────────────────────────────┤
│                     Rust Backend (commands.rs)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │  triage_db   │  │ jira_client  │  │   audit / keychain    │   │
│  │  (rusqlite)  │  │  (reqwest)   │  │                       │   │
│  └──────────────┘  └──────────────┘  └───────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### New Components for v0.3.0

```
┌──────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend                          │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    ticketStore (extended)                   │   │
│  │  + changesMap: Record<key, FieldChange[]>                  │   │
│  │  + pollConfig: { enabled, intervalMinutes }                │   │
│  │  + notifPrefs: NotificationPreferences                     │   │
│  └───────────────────────┬───────────────────────────────────┘   │
│  ┌───────────────────────┴──────────────────────────────────┐    │
│  │  NEW: usePollController hook                              │    │
│  │  Listens for "ticket-changes" events from Rust           │    │
│  │  Calls invoke("poll_now") for manual refresh             │    │
│  └───────────────────────┬──────────────────────────────────┘    │
│  ┌───────────────────────┴──────────────────────────────────┐    │
│  │  NEW: ChangeDiffView component                            │    │
│  │  Shows field-level diff for a ticket since last fetch    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                           listen("ticket-changes")                │
├───────────────────────────────────────────────────────────────────┤
│                     Tauri IPC Bridge                               │
│                  app.emit("ticket-changes", payload)              │
├───────────────────────────────────────────────────────────────────┤
│                     Rust Backend                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  NEW: poll_scheduler.rs                                   │    │
│  │  Spawned once at startup via tauri::async_runtime::spawn │    │
│  │  Holds: AppHandle clone, Arc<Mutex<TriageDb>> reference  │    │
│  │  tokio::time::interval drives periodic Jira fetches      │    │
│  │  watch::Receiver<PollConfig> for reconfiguration         │    │
│  └───────────────────┬──────────────────────────────────────┘    │
│  ┌───────────────────┴──────────────────────────────────────┐    │
│  │  NEW: change_tracker.rs                                   │    │
│  │  Compares current ticket snapshot against stored hash    │    │
│  │  Produces Vec<FieldChange> for changed tickets           │    │
│  │  Persists ticket_snapshots table in triage.db            │    │
│  └───────────────────┬──────────────────────────────────────┘    │
│  ┌───────────────────┴──────────────────────────────────────┐    │
│  │  MODIFIED: triage_db.rs                                   │    │
│  │  + ticket_snapshots table (key, snapshot_json, hash,     │    │
│  │    captured_at)                                           │    │
│  │  + notification_prefs table (single-row config)          │    │
│  │  + poll_config table (enabled, interval_minutes)         │    │
│  └───────────────────┬──────────────────────────────────────┘    │
│  ┌───────────────────┴──────────────────────────────────────┐    │
│  │  MODIFIED: commands.rs                                    │    │
│  │  + poll_now command (manual trigger)                     │    │
│  │  + set_poll_config / get_poll_config commands            │    │
│  │  + get_notification_prefs / set_notification_prefs       │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  NEW: notification.rs                                     │    │
│  │  Wraps tauri-plugin-notification NotificationExt          │    │
│  │  Checks prefs before sending each notification type      │    │
│  └──────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

---

## New vs Modified: Explicit List

### New Files (Rust — src-tauri/src/)

| File | Purpose |
|------|---------|
| `poll_scheduler.rs` | Long-running background async loop; owns poll interval timer |
| `change_tracker.rs` | Snapshot diffing logic; produces structured change records |
| `notification.rs` | Thin wrapper around `tauri_plugin_notification`; preference-aware |

### New Files (Frontend — src/features/tickets/)

| File | Purpose |
|------|---------|
| `ChangeDiffView.tsx` | Field-level diff display component |
| `NotificationPrefsForm.tsx` | UI for enabling/disabling notification event types |
| `PollConfigForm.tsx` | UI for auto-poll toggle + interval selector |
| `usePollController.ts` | Hook: starts listener for "ticket-changes" event, triggers store updates |

### Modified Files (Rust)

| File | Change |
|------|--------|
| `triage_db.rs` | Add `ticket_snapshots`, `notification_prefs`, `poll_config` tables + CRUD methods via ALTER TABLE pattern (existing migration approach) |
| `commands.rs` | Add `poll_now`, `set_poll_config`, `get_poll_config`, `get_notification_prefs`, `set_notification_prefs` Tauri commands |
| `main.rs` | Register `tauri-plugin-notification`, create `watch::channel`, start `poll_scheduler` on setup, add new commands to `invoke_handler`, manage `Arc<watch::Sender<PollConfig>>` |
| `lib.rs` | Export `poll_scheduler`, `change_tracker`, `notification` modules |

### Modified Files (Frontend)

| File | Change |
|------|--------|
| `ticketStore.ts` | Add `changesMap`, `pollConfig`, `notifPrefs` state + `applyChanges`, `hydratePollConfig`, `hydrateNotifPrefs` actions |
| `types.ts` | Add `FieldChange`, `TicketChangesPayload`, `NotificationPreferences`, `PollConfig` types |
| `SettingsPage.tsx` | Add notification prefs section and poll config section |
| `TicketCard.tsx` | Add "changed" badge when `changesMap[key]` has entries |
| `TicketListPage.tsx` | Add "Refresh now" button wired to `invoke("poll_now")`; mount `usePollController` |
| `App.tsx` | Mount `usePollController` once at app root (or `TicketListPage` — either works, but root ensures listener is always active) |

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `poll_scheduler.rs` | Owns the background timer loop; re-fetches JQL; delegates to change_tracker and notification | `change_tracker`, `notification`, `triage_db`, `jira_client`, frontend via `app.emit` |
| `change_tracker.rs` | Pure diff logic: takes current ticket + stored snapshot, returns `Vec<FieldChange>`; writes new snapshot | `triage_db` (reads/writes `ticket_snapshots`) |
| `notification.rs` | Sends OS notification if preference allows; reads prefs from DB before each send | `triage_db` (reads `notification_prefs`), `tauri_plugin_notification::NotificationExt` |
| `usePollController.ts` | Subscribes to `"ticket-changes"` Tauri event; calls `ticketStore.applyChanges` | `ticketStore`, Tauri `listen()` API |
| `ChangeDiffView.tsx` | Renders field-level diffs from `changesMap[ticketKey]` | `ticketStore` |

---

## Architectural Patterns

### Pattern 1: Single Background Loop with Reconfiguration Channel

**What:** One async task spawned at app startup holds an `AppHandle` clone. It uses `tokio::time::interval` for periodic polling. A `tokio::sync::watch` channel carries the live `PollConfig`; the loop reads the latest value on each tick and can reconfigure the interval or park when disabled.

**When to use:** Single-user desktop app where exactly one background poller is needed. The `watch` channel (not `mpsc`) is correct here because only the latest config matters — missed intermediate values are fine.

**Trade-offs:** Simple, low overhead. Changing interval requires sending a new config over the watch channel; the loop picks it up on the next iteration. The `watch::Sender` is managed state so any Tauri command can reconfigure it.

**Example (Rust):**
```rust
// poll_scheduler.rs
pub async fn run_poll_loop(
    app: AppHandle,
    db: Arc<Mutex<TriageDb>>,
    mut config_rx: watch::Receiver<PollConfig>,
) {
    let cfg = config_rx.borrow().clone();
    let mut interval = tokio::time::interval(
        Duration::from_secs(cfg.interval_minutes * 60)
    );
    loop {
        tokio::select! {
            _ = interval.tick() => {
                let cfg = config_rx.borrow().clone();
                if cfg.enabled {
                    do_poll(&app, &db).await;
                }
            }
            Ok(_) = config_rx.changed() => {
                let cfg = config_rx.borrow().clone();
                interval = tokio::time::interval(
                    Duration::from_secs(cfg.interval_minutes * 60)
                );
            }
        }
    }
}
```

### Pattern 2: Emit-Then-Listen for Rust-to-Frontend Push

**What:** The Rust poll loop calls `app.emit("ticket-changes", payload)` after detecting changes. The frontend registers a permanent listener in a React hook that updates Zustand state.

**When to use:** Any time Rust needs to push unsolicited data to the frontend (poll completed, changes detected). This is the established Tauri pattern — `AppHandle` implements the `Emitter` trait; `listen()` from `@tauri-apps/api/event` on the frontend side.

**Trade-offs:** Clean separation — Rust has no knowledge of React state. The payload must be `serde::Serialize` on Rust side and match a TypeScript interface on the frontend. The `unlisten` function returned by `listen()` should be called on hook cleanup to avoid memory leaks.

**Example (TypeScript):**
```typescript
// usePollController.ts
export function usePollController() {
  useEffect(() => {
    const unlistenPromise = listen<TicketChangesPayload>(
      'ticket-changes',
      (event) => {
        useTicketStore.getState().applyChanges(event.payload);
      }
    );
    return () => { unlistenPromise.then(fn => fn()); };
  }, []);
}
```

### Pattern 3: Snapshot-Hash Change Detection

**What:** After each JQL fetch, extract only mutable user-visible fields from each ticket (status name, priority name, summary, updated timestamp, assignee display name) into a normalised struct. Serialise deterministically and hash (SHA-256). Compare against the stored hash in `ticket_snapshots`. If hash differs, diff field-by-field to produce named `FieldChange` entries.

**When to use:** Change detection in any polling scenario where full response comparison is noisy. The hash acts as a fast equality check; full diff only runs on mismatch.

**Trade-offs:** Hashing costs ~microseconds per ticket. Avoids false positives from Jira API volatile metadata (`self` URLs, expand fields). Store only mutable fields — not the full API response — to keep snapshot size small and diffs meaningful.

### Pattern 4: Selector-Based Watch Configuration

**What:** Extend `FetchConfig.watched_users` to accept two entry types: plain usernames (existing) and domain selectors prefixed with `@` (e.g., `@customer.com`). The JQL builder resolves selectors against `search_jira_users` results at build time. Resolved usernames are used in JQL; the selector string itself is stored in `watched_users`, not the expanded list.

**When to use:** When a user wants to watch all tickets from a customer company without maintaining an explicit user list.

**Trade-offs:** Resolution requires a Jira API call on each poll if the selector is present. Cache resolved usernames in Zustand for the session, invalidating when settings change. The selector is a frontend-layer concept — Rust never sees `@domain.com`, only the resolved list of usernames passed in JQL.

---

## Data Flow

### Background Poll Flow

```
tokio::time::interval tick fires
    |
poll_scheduler: read PollConfig from watch::Receiver (borrow, no lock)
    |
    +-- disabled? --> return, wait for next tick
    |
poll_scheduler: lock TriageDb → read FetchConfig → unlock
    |
poll_scheduler: call jira_client::fetch_tickets(jql)  [no lock held during network I/O]
    |
change_tracker: for each ticket in result:
    hash mutable fields
    compare against ticket_snapshots (lock → read → unlock)
    if hash differs:
        diff field-by-field → Vec<FieldChange>
        upsert ticket_snapshots (lock → write → unlock)
    |
notification.rs: for each changed ticket:
    lock TriageDb → read notification_prefs → unlock
    if pref.enabled && relevant change type enabled:
        AppHandle.notification().builder().title(key).body(summary).show()
    |
app.emit("ticket-changes", TicketChangesPayload {
    changes: HashMap<key, Vec<FieldChange>>,
    updated_tickets: Vec<JiraTicket>,
})
    |
Frontend: usePollController listen handler fires
    |
ticketStore.applyChanges():
    merge updated_tickets into tickets[]
    store changesMap entries
    |
React re-renders: TicketCard shows "changed" badge
                  ChangeDiffView available on ticket detail
```

### Manual Poll Flow

```
User clicks "Refresh now" in TicketListPage
    |
invoke("poll_now")
    |
commands.rs poll_now:
    get State<Arc<watch::Sender<PollConfig>>>
    read current PollConfig
    send PollConfig with immediate_trigger=true flag
    (poll_scheduler wakes via select! config_rx.changed() branch)
    |
Same path as background poll from "poll_scheduler: read FetchConfig" above
```

### Notification Preference Write Flow

```
User toggles setting in SettingsPage > NotificationPrefsForm
    |
invoke("set_notification_prefs", prefs)
    |
commands.rs: lock TriageDb → UPDATE notification_prefs → unlock
    |
(notification.rs reads from DB on each send — no in-memory cache needed)
```

---

## New SQLite Tables (additions to triage.db via ALTER TABLE migration pattern)

### ticket_snapshots

```sql
CREATE TABLE IF NOT EXISTS ticket_snapshots (
    ticket_key    TEXT PRIMARY KEY,
    snapshot_json TEXT NOT NULL,   -- JSON of mutable fields only
    hash          TEXT NOT NULL,   -- SHA-256 hex of snapshot_json
    captured_at   TEXT NOT NULL    -- ISO 8601
);
```

Fields in snapshot: `status.name`, `priority.name`, `summary`, `updated`, `assignee.displayName` (null if unassigned).

### notification_prefs

```sql
CREATE TABLE IF NOT EXISTS notification_prefs (
    id                 INTEGER PRIMARY KEY CHECK(id = 1),
    enabled            INTEGER NOT NULL DEFAULT 1,
    on_status_change   INTEGER NOT NULL DEFAULT 1,
    on_priority_change INTEGER NOT NULL DEFAULT 1,
    on_new_ticket      INTEGER NOT NULL DEFAULT 1,
    on_assignee_change INTEGER NOT NULL DEFAULT 0
);
```

### poll_config

```sql
CREATE TABLE IF NOT EXISTS poll_config (
    id               INTEGER PRIMARY KEY CHECK(id = 1),
    enabled          INTEGER NOT NULL DEFAULT 0,
    interval_minutes INTEGER NOT NULL DEFAULT 15
);
```

All three tables use the existing `ALTER TABLE + INSERT OR IGNORE` migration approach already established in `triage_db.rs::open()`.

---

## Integration Points

### New Cargo Dependency

```toml
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-notification = "2"
```

Register in `main.rs` setup block identically to `tauri-plugin-updater`.

### watch::Sender as Managed State

```rust
// main.rs setup (after TriageDb is opened)
let (poll_tx, poll_rx) = tokio::sync::watch::channel(PollConfig::default());
let poll_tx = Arc::new(poll_tx);
app.manage(poll_tx.clone());

let db_for_scheduler = triage_db_arc.clone();
let handle_for_scheduler = app.handle().clone();
tauri::async_runtime::spawn(async move {
    poll_scheduler::run_poll_loop(handle_for_scheduler, db_for_scheduler, poll_rx).await;
});
```

`poll_now` and `set_poll_config` commands receive `State<'_, Arc<watch::Sender<PollConfig>>>` and send on it.

### Tauri Capability Permission

Add to `src-tauri/capabilities/default.json`:
```json
"notification:default"
```

---

## Recommended Project Structure Additions

```
src-tauri/src/
├── poll_scheduler.rs    # NEW — background polling loop
├── change_tracker.rs    # NEW — snapshot hashing + diffing
├── notification.rs      # NEW — OS notification dispatch
├── triage_db.rs         # MODIFIED — 3 new tables
├── commands.rs          # MODIFIED — 5 new commands
├── main.rs              # MODIFIED — plugin + scheduler init
└── lib.rs               # MODIFIED — 3 new module exports

src/features/tickets/
├── usePollController.ts     # NEW — event listener hook
├── ChangeDiffView.tsx        # NEW — diff UI component
├── NotificationPrefsForm.tsx # NEW — settings form
├── PollConfigForm.tsx        # NEW — poll settings form
├── ticketStore.ts            # MODIFIED — changesMap, pollConfig, notifPrefs
└── types.ts                  # MODIFIED — FieldChange, PollConfig, NotifPrefs types
```

---

## Anti-Patterns

### Anti-Pattern 1: Polling from the Frontend with setInterval

**What people do:** Run `setInterval(() => invoke("fetch_tickets"), 60000)` in a React component or hook.

**Why it's wrong:** Tauri's webview can be suspended or throttled by the OS when the window is minimised or backgrounded. A Rust async task runs regardless of webview state. Frontend-driven polling also cannot send OS notifications when the window is hidden.

**Do this instead:** One persistent `tokio::time::interval` loop in `poll_scheduler.rs`, spawned at app startup. The frontend only manages display state; it never owns the poll timer.

### Anti-Pattern 2: Storing Full API Response Snapshots

**What people do:** Store the entire `JiraTicket` JSON blob to detect changes.

**Why it's wrong:** Jira API responses include volatile metadata (`self` URLs, expand fields, internal IDs) that changes without meaningful ticket change, producing false-positive notifications. Blob diffs are also noisy and storage grows linearly.

**Do this instead:** Extract only mutable user-visible fields into a small normalised snapshot. Hash that snapshot deterministically. Run full field diff only when hash mismatches.

### Anti-Pattern 3: Holding the TriageDb Mutex During Network I/O

**What people do:** Lock `Arc<Mutex<TriageDb>>`, call Jira API (network I/O), then write results, all under one lock hold.

**Why it's wrong:** Every other Tauri command (including UI interactions) blocks while the network call runs. Jira calls can take 2-10 seconds.

**Do this instead:** Lock → read config → unlock. Network I/O with no lock held. Lock → write results → unlock. Two short critical sections flanking the I/O.

### Anti-Pattern 4: Duplicating Config in Managed State and SQLite

**What people do:** Add `app.manage(Arc::new(Mutex::new(NotificationPrefs { ... })))` as an in-memory copy of settings.

**Why it's wrong:** TriageDb is already the persistence layer for all app config. An in-memory copy creates dual-source-of-truth; the in-memory copy is lost on restart and can diverge from the DB.

**Do this instead:** Keep all persistent config in TriageDb. Use `watch::channel` only for `PollConfig` because the scheduler task needs a non-blocking way to receive reconfiguration signals. Everything else reads from the DB directly.

---

## Scaling Considerations

Single-user desktop app. Practical concerns only:

| Concern | Practical Limit | Mitigation |
|---------|-----------------|------------|
| `ticket_snapshots` table growth | ~1,000 tickets × ~300B each ≈ 300KB | Prune rows for tickets no longer in current fetch result after each poll |
| Poll frequency floor | Minimum 5 minutes to avoid Jira rate-limiting | Enforce minimum in `set_poll_config` command; reject values below floor |
| Notification spam | Many tickets change at once | Batch: if changes > threshold (default 5), emit one "N tickets changed" notification instead of N individual ones |
| Mutex contention | Background poll + UI commands both acquire TriageDb lock | Keep all lock windows < 1ms (no I/O under lock) as described above |

---

## Sources

- [Tauri Notification Plugin — official docs](https://v2.tauri.app/plugin/notification/) — plugin registration and JavaScript API (HIGH confidence)
- [tauri-plugin-notification 2.3.3 on docs.rs](https://docs.rs/tauri-plugin-notification/latest/tauri_plugin_notification/) — Rust `NotificationExt` API (HIGH confidence)
- [Tauri: Calling the Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) — `AppHandle.emit()`, `Emitter` trait, frontend `listen()` (HIGH confidence)
- [Long-running backend async tasks in Tauri v2](https://sneakycrow.dev/blog/2024-05-12-running-async-tasks-in-tauri-v2) — `tauri::async_runtime::spawn` + `AppHandle` clone pattern (MEDIUM confidence — community blog, verified against official docs)
- [Tauri State Management](https://v2.tauri.app/develop/state-management/) — `app.manage()` and `State<>` extractor (HIGH confidence)
- Existing codebase: `src-tauri/src/main.rs`, `triage_db.rs`, `commands.rs`, `src/features/tickets/ticketStore.ts`, `src/App.tsx`, `src/features/update/useUpdateCheck.ts` — direct inspection (HIGH confidence)

---

*Architecture research for: pmkar v0.3.0 — notifications, polling, change tracking*
*Researched: 2026-03-27*
