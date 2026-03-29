# Phase 13: Background Polling Engine - Research

**Researched:** 2026-03-27
**Domain:** Tauri 2 async task management, tokio cancellation, Tauri event emission, React/Zustand event listener integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Poll frequency UI**
- D-01: New "Polling" section in SettingsPage, below existing Language/Theme sections
- D-02: Dropdown selector for frequency options (5m / 15m / 30m / 1h / Off) — consistent with existing theme/language dropdowns
- D-03: Frequency change takes effect immediately (no save button) — same pattern as language/theme toggles
- D-04: Poll frequency persisted in SQLite via TriageDb app_settings table — survives app restarts

**Poll loop lifecycle**
- D-05: Poll loop runs as a tokio::spawn task on the Rust side — continues firing when webview is minimized
- D-06: On app launch, read saved frequency from SQLite; if not "off", auto-start the poll loop immediately
- D-07: On API error (network timeout, 401, etc.), log the error and retry on next scheduled cycle — no watermark advance, no user notification (silent failure)
- D-08: When user changes frequency mid-cycle, cancel current sleep and restart with new interval immediately
- D-09: Poll scope uses watermark-filtered JQL via `get_poll_watermark()` — only fetches tickets updated since the watermark, not all tracked tickets

**Manual refresh trigger**
- D-10: No separate refresh button — the existing Fetch button in TicketListPage becomes dual-purpose: fetches tickets AND runs snapshot change detection in one action
- D-11: F5 keyboard shortcut triggers manual poll (Cmd/Ctrl+R left as browser default)
- D-12: Manual poll resets the background timer — next auto-poll starts a full interval from the manual poll time

**Frontend feedback**
- D-13: Subtle "Last checked: X min ago" timestamp displayed near the Fetch button in the ticket list toolbar
- D-14: Fetch button icon animates (spin/pulse) while a poll is in progress — no toast, no layout shift
- D-15: Rust emits Tauri events (e.g., `poll-complete`) with changed ticket keys after each poll cycle — frontend listens and updates
- D-16: When changes are detected, ticket list auto-refreshes silently — no banner or manual "show updates" step

### Claude's Discretion
- Exact tokio task cancellation mechanism (e.g., `tokio::sync::watch` channel, `AbortHandle`, or `tokio::select!` with a signal)
- Tauri event payload structure for poll-complete events
- How the "last checked" relative timestamp updates (reactive interval vs. on-event)
- Error logging format and verbosity for failed poll cycles
- Whether to debounce rapid manual poll clicks

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLL-01 | User can configure auto-poll frequency (5m / 15m / 30m / 1h / off) in settings | D-01 through D-04; settings persistence via ALTER TABLE on app_config (same pattern as language); SettingsPage SectionCard + inline button group pattern documented in UI-SPEC |
| POLL-02 | App polls for ticket updates in background at configured interval (Rust-side tokio loop) | D-05 through D-09; `tauri::async_runtime::spawn` + `tokio::select!` + `tokio::sync::watch` channel documented; `app.emit()` / `Emitter` already imported in main.rs |
| POLL-03 | User can trigger a manual poll anytime via button or F5 | D-10 through D-12; existing Fetch button enhanced; `keydown` listener pattern confirmed in App.tsx |
</phase_requirements>

---

## Summary

Phase 13 builds on top of the complete Phase 12 snapshot foundation. All change detection primitives (`check_for_changes`, `get_watermark`, `SnapshotDb`) are already wired. This phase has three workstreams: (1) Rust-side polling daemon using `tauri::async_runtime::spawn` with a `tokio::sync::watch` channel for graceful cancellation/restart; (2) SQLite persistence of the poll frequency setting using a new `ALTER TABLE app_config ADD COLUMN poll_frequency` migration (identical in structure to how `language` is stored); (3) frontend changes to `SettingsPage.tsx`, `TicketListPage.tsx`, `ticketStore.ts`, and translation files.

The key engineering decision left to discretion is the cancellation mechanism. The recommendation is `tokio::sync::watch` over `AbortHandle` because it allows mid-cycle restart with a new interval without orphaning a running API call — the loop body can be designed to finish any in-progress fetch and then pick up the new interval. `AbortHandle` is simpler but drops in-flight futures without cleanup. A `tokio::select!` on `sleep + watch_receiver.changed()` cleanly models D-08 (cancel current sleep, restart immediately).

The poll loop in `main.rs` `setup()` block needs a clone of `AppHandle` for `app.emit()` and a clone of the `Arc<Mutex<>>` states for `TriageDb` and `SnapshotDb`. The existing `tauri::async_runtime::spawn` for the mock server (line 144 in main.rs) demonstrates the exact wiring pattern.

**Primary recommendation:** Use `tokio::sync::watch::channel(initial_interval)` shared as `Arc<Mutex<>>` Tauri state for the poll loop control; loop uses `tokio::select! { _ = tokio::time::sleep(interval) => { /* poll */ }, _ = rx.changed() => { /* restart with new interval */ } }`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tokio | 1.x (via `features = ["full"]`) | Async runtime, `spawn`, `sleep`, `select!` | Already in Cargo.toml; Tauri 2 uses tokio internally |
| `tokio::sync::watch` | (tokio 1.x) | Send new interval to running poll loop without abort | Zero-copy broadcast; designed for "config change" signaling |
| tauri `Emitter` trait | 2.10 | `app.emit("poll-complete", payload)` | Already imported in main.rs line 9 |
| `@tauri-apps/api/event` `listen` | 2.10.1 | Frontend subscribes to `poll-complete` event | Already used in App.tsx for `show-about` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rusqlite 0.39 | (bundled) | `ALTER TABLE app_config ADD COLUMN poll_frequency` migration | Same migration pattern already used for `source_project_key` etc. |
| serde / serde_json | 1.x | Serialize `PollCompletePayload` struct for Tauri event | Already in Cargo.toml; all commands use this pattern |
| chrono 0.4 | (with serde) | ISO-8601 timestamp for last-checked-at in event payload | Already used throughout snapshot_db.rs and triage_db.rs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tokio::sync::watch` | `tokio::task::AbortHandle` | AbortHandle is simpler but cancels in-flight futures; watch lets the fetch complete and restarts the sleep |
| `tokio::sync::watch` | `tokio::sync::mpsc` | mpsc works but watch is semantically cleaner for "latest config wins" signals |
| Inline poll logic in main.rs | New `poll_engine.rs` module in lib | A dedicated module keeps main.rs lean and makes the engine unit-testable without a full Tauri app handle |

**No new Cargo dependencies required.** All needed crates are already in Cargo.toml.

---

## Architecture Patterns

### Recommended Project Structure — new/changed files

```
src-tauri/src/
├── poll_engine.rs       # NEW — PollEngine struct, run_poll_loop(), PollFrequency enum
├── commands.rs          # ADD get_poll_frequency, set_poll_frequency commands
├── triage_db.rs         # ADD get_poll_frequency / set_poll_frequency methods + migration
├── main.rs              # ADD poll loop spawn in setup(); register new commands
src/features/
├── connections/
│   └── SettingsPage.tsx # ADD PollingSection component + sidebar nav entry
├── tickets/
│   ├── TicketListPage.tsx  # ENHANCE Fetch button (dual-purpose + F5 listener)
│   └── ticketStore.ts      # ADD lastCheckedAt state + poll-complete event listener
src/i18n/locales/
├── en.json              # ADD polling i18n keys
└── sk.json              # ADD polling i18n keys (Slovak)
```

### Pattern 1: tokio poll loop with watch-channel restart

**What:** A long-running `tauri::async_runtime::spawn` task that sleeps for the configured interval, does work, then loops. A `tokio::sync::watch` channel carries the current interval. When the user changes frequency, the command handler sends the new value to the channel, `select!` wakes immediately, and the loop restarts with the new interval.

**When to use:** Whenever background work must be cancellable/restartable mid-sleep without aborting in-progress I/O.

```rust
// Source: tokio docs + established Tauri async_runtime::spawn pattern (main.rs line 144)
use tokio::sync::watch;
use tokio::time::{sleep, Duration};

pub enum PollFrequency {
    Off,
    Secs(u64),  // 300, 900, 1800, 3600
}

pub async fn run_poll_loop(
    mut rx: watch::Receiver<PollFrequency>,
    app_handle: tauri::AppHandle,
    // ... state Arc clones
) {
    loop {
        let freq = rx.borrow().clone();
        match freq {
            PollFrequency::Off => {
                // Park until a non-Off frequency arrives
                let _ = rx.changed().await;
            }
            PollFrequency::Secs(secs) => {
                tokio::select! {
                    _ = sleep(Duration::from_secs(secs)) => {
                        do_poll(&app_handle, /* states */).await;
                    }
                    _ = rx.changed() => {
                        // Frequency changed — loop again immediately with new value
                    }
                }
            }
        }
    }
}
```

### Pattern 2: SQLite migration for poll_frequency column

**What:** Add a new column to the existing `app_config` row (id=1). Uses the same defensive `let _ = conn.execute_batch(ALTER_...)` pattern already in `TriageDb::open()`.

**When to use:** Any new user preference that must survive app restarts.

```rust
// Source: triage_db.rs lines 40-83 — existing ALTER TABLE migration pattern
const ALTER_APP_CONFIG_ADD_POLL_FREQUENCY: &str =
    "ALTER TABLE app_config ADD COLUMN poll_frequency TEXT NOT NULL DEFAULT 'off';";

// In TriageDb::open() and open_in_memory():
let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_POLL_FREQUENCY);

pub fn get_poll_frequency(&self) -> AppResult<String> {
    let freq: String = self.conn.query_row(
        "SELECT poll_frequency FROM app_config WHERE id = 1",
        [],
        |row| row.get(0),
    ).unwrap_or_else(|_| "off".to_string());
    Ok(freq)
}

pub fn set_poll_frequency(&self, frequency: &str) -> AppResult<()> {
    self.conn.execute(
        "UPDATE app_config SET poll_frequency = ?1 WHERE id = 1",
        [frequency],
    )?;
    Ok(())
}
```

### Pattern 3: Tauri event emission from background task

**What:** The poll loop has an `AppHandle` clone. After each cycle it calls `app_handle.emit("poll-complete", payload)`. Frontend subscribes with `listen("poll-complete", handler)` in a `useEffect`.

**When to use:** Any Rust-to-frontend push notification.

```rust
// Source: main.rs line 9 (`use tauri::Emitter`) and line 99 (`app.emit("show-about", ())`)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PollCompletePayload {
    pub changed_keys: Vec<String>,
    pub checked_at: String,      // ISO-8601
    pub had_error: bool,
}

// Inside do_poll():
let _ = app_handle.emit("poll-complete", PollCompletePayload {
    changed_keys,
    checked_at: chrono::Utc::now().to_rfc3339(),
    had_error: false,
});
```

```typescript
// Source: App.tsx lines 73-78 — established listen() pattern
// In ticketStore.ts or a dedicated hook:
useEffect(() => {
  const unlisten = listen<PollCompletePayload>('poll-complete', (event) => {
    useTicketStore.getState().setLastCheckedAt(event.payload.checkedAt);
    if (event.payload.changedKeys.length > 0) {
      // silently re-invoke handleFetch()
    }
  });
  return () => { unlisten.then((fn) => fn()); };
}, []);
```

### Pattern 4: Tauri shared state for watch::Sender

**What:** The `watch::Sender<PollFrequency>` is wrapped in `Arc<Mutex<>>` and registered as Tauri managed state. The `set_poll_frequency` command locks it and sends the new value.

**When to use:** Whenever a Tauri command needs to communicate with a running background task.

```rust
// In main.rs setup():
let (tx, rx) = tokio::sync::watch::channel(PollFrequency::Off);
let tx = Arc::new(Mutex::new(tx));
app.manage(tx.clone());  // type: Arc<Mutex<watch::Sender<PollFrequency>>>

// Spawn the loop with rx + AppHandle clone
let app_handle = app.handle().clone();
tauri::async_runtime::spawn(run_poll_loop(rx, app_handle, /* state clones */));
```

### Pattern 5: Dual-purpose Fetch button + F5 shortcut

**What:** The existing `handleFetch` callback in `TicketListPage.tsx` is extended to also call `check_ticket_changes` for each fetched ticket. F5 is wired via a `keydown` event listener in `useEffect`.

```typescript
// In TicketListPage.tsx — extend handleFetch
// After fetching tickets, iterate and invoke check_ticket_changes per key.
// This mirrors the POLL-06 guarantee: changes only checked after successful fetch.

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'F5') {
      e.preventDefault();
      if (!isLoading) handleFetch();
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isLoading, handleFetch]);
```

### Anti-Patterns to Avoid

- **Using `AbortHandle` to cancel the poll task:** This will drop in-flight `reqwest` futures mid-request, leaving TCP connections in an unknown state. Use `select!` on `sleep` only — never abort during the fetch body.
- **Spawning a new tokio task on every frequency change:** Leads to multiple concurrent poll loops. One loop, one channel, reconfigured via watch message.
- **Advancing the watermark in the Rust poll loop for failed fetches:** POLL-06 requires watermark advancement only on success. The `do_poll` function must not call `SnapshotDb::store_snapshot` if the Jira HTTP call fails.
- **Frontend `setInterval` for "last checked" display:** D-13 says update on `poll-complete` event, not on a timer. A setInterval would cause stale-closure issues and unnecessary re-renders. Update the timestamp from the event payload `checkedAt` field.
- **Locking `Arc<Mutex<TriageDb>>` across an `await` boundary:** Rust borrow checker will reject this. Lock → extract needed data (base_url, PAT, JQL params) → drop lock → do async fetch.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Interval timer with restart | Custom sleep-loop with AtomicBool flag | `tokio::select!` on `sleep + watch::changed()` | select! is cancel-safe; AtomicBool polling wastes CPU and has race conditions |
| Config change signaling | mpsc channel or shared AtomicU64 | `tokio::sync::watch` | watch delivers the latest value without buffering; naturally handles rapid frequency changes |
| "Last checked" relative time | New utility function | Existing `formatRelativeTime()` in `src/lib/format.ts` | Already in use for `lastFetchedAt` in TicketListPage — identical semantics |
| Watermark JQL filter | Custom string interpolation | `get_poll_watermark()` Tauri command already wired (commands.rs:1935) | Reuse Phase 12 deliverable; watermark logic already tested |

**Key insight:** The entire Phase 12 foundation was designed with Phase 13 in mind. `get_poll_watermark`, `check_ticket_changes`, `SnapshotDb::check_for_changes` are all already Tauri commands. The poll loop calls these — it does not re-implement them.

---

## Common Pitfalls

### Pitfall 1: Lock held across await boundary
**What goes wrong:** `let db = triage_db.lock().unwrap(); let result = some_async_call().await;` — Rust rejects this because `MutexGuard` is not `Send`.
**Why it happens:** The poll loop is an async task; `Arc<Mutex<>>` guards cannot cross `.await` points.
**How to avoid:** Lock → clone/extract needed values (base URL, PAT, frequency) → drop the guard before the first `.await`. Only the synchronous SQLite reads need the lock; the HTTP call happens with extracted values.
**Warning signs:** `error[E0277]: *std::sync::MutexGuard<_>* cannot be sent between threads safely` at compile time.

### Pitfall 2: Multiple poll loops accumulate after frequency changes
**What goes wrong:** If `set_poll_frequency` spawns a new task instead of sending to the existing channel, the old task keeps running. Two loops fire simultaneously; API rate limits triggered.
**Why it happens:** Spawning is easy; channel signaling requires the sender to be in state.
**How to avoid:** Store the `watch::Sender` in Tauri managed state. `set_poll_frequency` command sends to the channel only — never spawns.
**Warning signs:** Ticket list refreshes twice in quick succession; duplicate `poll-complete` events per cycle.

### Pitfall 3: Watermark not advancing when poll succeeds
**What goes wrong:** Poll fetches tickets but never calls `check_ticket_changes`, so `last_checked_at` never updates, and the watermark JQL always queries all history.
**Why it happens:** Easy to implement the HTTP fetch without wiring the snapshot step.
**How to avoid:** For each ticket returned by the watermark-filtered JQL, call `check_ticket_changes(ticket_key, response_json)`. This is the same POLL-06 call-site contract enforced in Phase 12.
**Warning signs:** `get_poll_watermark()` returns the same timestamp after multiple poll cycles.

### Pitfall 4: `Off` frequency blocks the loop instead of parking it
**What goes wrong:** `if freq == Off { return; }` exits the spawned task entirely. When the user re-enables polling, there is no loop to receive the new frequency.
**Why it happens:** Natural instinct to `return` when there's nothing to do.
**How to avoid:** When `Off`, the loop parks on `rx.changed().await` instead of returning. The task stays alive; it just doesn't poll until signaled.
**Warning signs:** Enabling polling after setting it to Off has no effect; requires app restart.

### Pitfall 5: Frontend event listener not cleaned up
**What goes wrong:** If `listen('poll-complete', ...)` is called in a component that unmounts and remounts (e.g., route change), listeners accumulate. Each re-mount adds another handler; ticket list refreshes multiply.
**Why it happens:** Missing cleanup in `useEffect` return.
**How to avoid:** Always return the unlisten cleanup function from the `useEffect`, following the exact pattern in `App.tsx` lines 74-78.
**Warning signs:** Console shows `poll-complete` handler called multiple times per event.

### Pitfall 6: F5 default browser behavior not prevented
**What goes wrong:** In some webview contexts, F5 triggers a page reload, unmounting the React app.
**Why it happens:** Browser default behavior for F5 is reload.
**How to avoid:** `e.preventDefault()` in the `keydown` handler before invoking `handleFetch`.
**Warning signs:** App UI flashes/reloads when pressing F5.

---

## Code Examples

### Wiring the poll loop in main.rs setup()

```rust
// Source: established tauri::async_runtime::spawn pattern (main.rs line 144)
// and tokio::sync::watch docs

let (poll_tx, poll_rx) = tokio::sync::watch::channel(
    pmkar_lib::poll_engine::PollFrequency::Off
);
let poll_tx = Arc::new(Mutex::new(poll_tx));
app.manage(poll_tx.clone());  // type: Arc<Mutex<watch::Sender<PollFrequency>>>

// Read saved frequency from DB and send initial value
{
    let tdb = app.state::<Arc<Mutex<TriageDb>>>();
    let freq_str = tdb.lock().unwrap().get_poll_frequency().unwrap_or_default();
    let initial_freq = PollFrequency::from_str(&freq_str);
    let _ = poll_tx.lock().unwrap().send(initial_freq);
}

let app_handle = app.handle().clone();
let triage_state = Arc::clone(app.state::<Arc<Mutex<TriageDb>>>().inner());
let snapshot_state = Arc::clone(app.state::<Arc<Mutex<SnapshotDb>>>().inner());

tauri::async_runtime::spawn(
    pmkar_lib::poll_engine::run_poll_loop(poll_rx, app_handle, triage_state, snapshot_state)
);
```

### set_poll_frequency Tauri command

```rust
// Source: get_app_language pattern (commands.rs lines 23-41)
#[tauri::command]
pub fn set_poll_frequency(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    poll_tx: tauri::State<'_, Arc<Mutex<tokio::sync::watch::Sender<PollFrequency>>>>,
    frequency: String,
) -> Result<(), AppError> {
    // Persist to SQLite
    {
        let db = triage_db.lock().map_err(|_| AppError::Internal("Lock poisoned".into()))?;
        db.set_poll_frequency(&frequency)?;
    }
    // Signal running loop — takes effect immediately (D-08)
    let freq = PollFrequency::from_str(&frequency);
    let tx = poll_tx.lock().map_err(|_| AppError::Internal("Lock poisoned".into()))?;
    let _ = tx.send(freq);  // ignore error (no receivers = loop not started yet)
    Ok(())
}
```

### SettingsPage polling section (pattern mirrors ThemeSection)

```typescript
// Source: SettingsPage.tsx ThemeSection pattern (lines referenced in UI-SPEC)
// Frequency options as inline button group — same flex pattern as theme selector
const POLL_OPTIONS = [
  { value: 'off',   label: 'Off'    },
  { value: '5m',    label: '5 min'  },
  { value: '15m',   label: '15 min' },
  { value: '30m',   label: '30 min' },
  { value: '1h',    label: '1 hr'   },
] as const;

type PollFrequency = typeof POLL_OPTIONS[number]['value'];
```

### ticketStore additions

```typescript
// Add to TicketState interface in ticketStore.ts:
lastCheckedAt: string | null;
pollFrequency: PollFrequency;

// Add action:
setLastCheckedAt: (ts: string) => void;
setPollFrequency: (freq: PollFrequency) => void;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri 1.x `tauri::async_runtime::spawn` pattern | Same API in Tauri 2.x — no breaking change | Tauri 2.0 GA 2024 | No migration needed; existing mock server spawn pattern directly applicable |
| Frontend `setInterval` polling | Rust-side tokio loop | This project's architecture decision | setInterval is throttled when webview is backgrounded by OS; documented in REQUIREMENTS.md Out of Scope |

---

## Open Questions

1. **PollFrequency storage format in SQLite**
   - What we know: `language` is stored as a short string (e.g., `"en"`). Same column-per-setting pattern works.
   - What's unclear: Whether to store as `"5m"`, `"15m"`, `"30m"`, `"1h"`, `"off"` (human-readable) or seconds (`"300"`, `"900"`, etc.).
   - Recommendation: Store as human-readable strings (`"5m"`, `"off"` etc.) — they match the UI option values and are self-documenting in the SQLite file. Convert to `Duration` in Rust via a simple match arm.

2. **Manual poll and background timer reset (D-12)**
   - What we know: When the user manually clicks Fetch, the background timer should reset.
   - What's unclear: Whether to send a "reset timer" signal through the watch channel or implement a separate mechanism.
   - Recommendation: Send the current frequency value unchanged to the watch channel from the manual poll command — the loop receives `changed()`, exits the select, and restarts the full sleep with a fresh timer. This is the simplest approach with no additional state.

3. **Debouncing rapid Fetch button clicks**
   - What we know: CONTEXT.md flags this as Claude's discretion.
   - What's unclear: Risk level without debounce.
   - Recommendation: The existing `isLoading` guard (`disabled={isLoading}`) already prevents double-submission. No additional debounce needed.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all required runtimes, CLI tools, and libraries are already present in the project).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Rust) | cargo test (built-in) |
| Framework (Frontend) | vitest 1.x |
| Config file | `vitest.config.ts` (project root) |
| Quick run command (frontend) | `npm test` |
| Full suite command (frontend) | `npm test` |
| Rust test command | `cargo test -p pmkar` (from src-tauri/) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLL-01 | `get_poll_frequency` returns default `"off"` for fresh DB | unit (Rust) | `cargo test test_poll_frequency` | ❌ Wave 0 |
| POLL-01 | `set_poll_frequency` persists value across re-open | unit (Rust) | `cargo test test_poll_frequency` | ❌ Wave 0 |
| POLL-01 | `hydratePollFrequency` sets store state | unit (TS) | `npm test` | ❌ Wave 0 |
| POLL-02 | Poll loop parks when frequency is `Off` | unit (Rust) | `cargo test test_poll_engine` | ❌ Wave 0 |
| POLL-02 | Poll loop restarts with new interval on watch signal | unit (Rust) | `cargo test test_poll_engine` | ❌ Wave 0 |
| POLL-02 | `PollCompletePayload` serializes to camelCase | unit (Rust) | `cargo test test_poll_payload` | ❌ Wave 0 |
| POLL-03 | F5 keydown calls handleFetch and prevents default | unit (TS) | `npm test` | ❌ Wave 0 |
| POLL-03 | Fetch button disabled during isLoading prevents double-click | unit (TS) | `npm test` (TicketListPage.test.tsx — exists) | ✅ partial |

### Sampling Rate
- **Per task commit:** `npm test` (frontend) + `cargo test` (Rust)
- **Per wave merge:** Full suite: `npm test && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/poll_engine.rs` — new module with unit tests for `run_poll_loop` (POLL-02)
- [ ] `src-tauri/src/triage_db.rs` additions — `test_set_and_get_poll_frequency` test in existing `#[cfg(test)]` block (POLL-01)
- [ ] `src/features/tickets/__tests__/ticketStore.test.ts` — extend existing file with `setPollFrequency` and `setLastCheckedAt` tests (POLL-01, POLL-03)
- [ ] `src/features/tickets/TicketListPage.test.tsx` — extend with F5 keydown test and dual-purpose fetch test (POLL-03)

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src-tauri/src/main.rs` — `tauri::async_runtime::spawn` wiring pattern (line 144), `app.emit` usage (line 99), `Arc<Mutex<>>` state management
- Existing codebase: `src-tauri/src/triage_db.rs` — `ALTER TABLE` migration pattern (lines 40-83), `get_app_language`/`set_app_language` template (lines 199-214)
- Existing codebase: `src-tauri/src/commands.rs` lines 1911-1942 — `check_ticket_changes` and `get_poll_watermark` (Phase 12 deliverables)
- Existing codebase: `src/App.tsx` lines 73-78 — `listen`/`unlisten` pattern for Tauri events
- Existing codebase: `src/features/tickets/ticketStore.ts` — Zustand store shape and extension points
- Existing codebase: `src-tauri/Cargo.toml` — `tokio = { version = "1", features = ["full"] }` confirms `tokio::sync::watch` is available without new dependencies
- Existing codebase: `src/i18n/locales/en.json` — existing i18n key structure for new polling keys
- Existing codebase: `.planning/phases/13-background-polling-engine/13-UI-SPEC.md` — complete component inventory, interaction contracts, copywriting, accessibility requirements

### Secondary (MEDIUM confidence)
- tokio documentation for `tokio::sync::watch` channel semantics — behavior of `rx.changed()` and `tx.send()` matches the described loop pattern
- Tauri 2 documentation for `app.handle().clone()` and `AppHandle` usage in spawned tasks

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in Cargo.toml and package.json; no new crates needed
- Architecture: HIGH — patterns are direct extensions of code already in the codebase; mock server spawn is the exact template
- Pitfalls: HIGH — lock-across-await and multiple-loop issues are compile-time or immediately observable; patterns verified against existing code structure
- Test gaps: HIGH — existing test infrastructure (vitest + cargo test) covers all phase test requirements; Wave 0 gaps are additive extensions to existing test files

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable Tauri 2.x, stable tokio 1.x — no fast-moving APIs)
