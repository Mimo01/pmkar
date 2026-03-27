# Phase 14: Notification Dispatch - Research

**Researched:** 2026-03-28
**Domain:** Tauri 2.x notification plugin, Rust notification dispatch, SQLite settings persistence, React settings UI patterns
**Confidence:** HIGH

## Summary

Phase 14 adds OS-level desktop notifications to pmkar when watched tickets change after a poll cycle. The Tauri ecosystem provides a first-party plugin (`tauri-plugin-notification` v2.3.3) that handles macOS permission request, permission state checking, and native notification dispatch. The plugin is not yet installed in the project — it must be added to Cargo.toml, registered in main.rs, and given `notification:default` capability.

The core dispatch architecture is straightforward: notification logic hooks into the existing `poll-complete` Tauri event. However, the `PollCompletePayload` currently only carries `changed_keys` (ticket key strings), not the `FieldChange` details needed to compose notification bodies. The Rust side must be extended so that after `process_tickets` runs, the full per-ticket `Vec<FieldChange>` is available to the notification dispatcher — either by enriching the payload or by re-fetching from the snapshot store immediately after the poll. Notification preferences (per-event toggles, quiet hours) are persisted in the existing `app_settings`-style pattern in `TriageDb`, requiring a new `notification_prefs` SQLite column or table.

Quiet hours check is best performed Rust-side (alongside notification dispatch) since the Rust tokio task already knows the current time and holds the preferences — this avoids a round-trip to the frontend and means suppression is deterministic even when the window is hidden.

**Primary recommendation:** Use `tauri-plugin-notification` v2.3.3 for all OS notification dispatch. Add a `notification_prefs` column (JSON blob) to `app_config` in `TriageDb` following the existing `poll_frequency` ALTER TABLE migration pattern. Implement a `notification_dispatcher.rs` module that is called from `do_poll()` after change detection, with Rust-side quiet hours check.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Notification content:**
- D-01: Each notification shows ticket key as title and change summary as body (e.g., Title: "CUST-123" — Body: "Status: Open → In Progress")
- D-02: One notification per changed ticket — no grouping or batching, even when multiple tickets change in a single poll cycle
- D-03: Comment notifications include commenter name and a truncated snippet (e.g., "CUST-123: Comment by John D. — 'We need to escalate this...'") — requires pulling comment data from snapshot diff

**Permission & first-run:**
- D-04: Request OS notification permission when user first sets poll frequency to anything other than Off — natural opt-in moment tied to monitoring activation
- D-05: If user denies permission, show a subtle info banner in the Notifications section of Settings: "Notifications disabled in system settings. Open System Settings to enable." — polling continues, just no OS notifications

**Preferences UI:**
- D-06: New "Notifications" section in SettingsPage, placed after the existing Polling section (flow: connections → appearance → polling → notifications)
- D-07: Toggle switches for each event type: New ticket, Status change, Priority change, New comment
- D-08: All event toggles default to ON when notifications are first enabled — opt-out model
- D-09: Notification preferences persisted in SQLite via TriageDb app_settings table — same pattern as poll frequency, language, theme

**Quiet hours:**
- D-10: Quiet hours suppress and discard notifications — no queue, no catch-up burst
- D-11: Quiet hours configured via start time + end time + weekday toggles
- D-12: Quiet hours off by default — notifications work 24/7 until user explicitly configures boundaries

### Claude's Discretion

- Tauri notification plugin choice and integration approach
- Rust-side notification dispatch architecture (hook into poll-complete event vs. separate module)
- Time picker component implementation for quiet hours
- How to extract comment author + snippet from snapshot diff data
- i18n keys structure for notification-related strings
- Whether quiet hours check happens Rust-side or frontend-side

### Deferred Ideas (OUT OF SCOPE)

- Badge count on dock/taskbar icon (NOTIF-09) — deferred to v0.4+
- In-app notification history panel (NOTIF-10) — deferred to v0.4+
- Click-to-navigate from OS notification to specific ticket — blocked by Tauri bug #8644 (still open as of 2026-03-28)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | App requests OS notification permission on first poll enable (macOS requirement) | `isPermissionGranted()` + `requestPermission()` from `@tauri-apps/plugin-notification`; trigger in `set_poll_frequency` command when transitioning from Off |
| NOTIF-02 | User receives OS-level notification when a new ticket matches watch criteria | `sendNotification()` JS API or Rust `app.notification().builder().show()`; new ticket = key appears in poll response but has no stored snapshot yet |
| NOTIF-03 | User receives OS-level notification when a watched ticket's status changes | `FieldChange { field: "status" }` from `check_for_changes()` already detected; feed to notification dispatcher |
| NOTIF-04 | User receives OS-level notification when a watched ticket's priority changes | `FieldChange { field: "priority" }` from `check_for_changes()` already detected |
| NOTIF-05 | User receives OS-level notification when a new comment is added | `FieldChange { field: "comment_count" }` detected; for commenter name/snippet, read latest comment from the new snapshot JSON |
| NOTIF-06 | Notification body includes change summary (e.g. "CUST-123: Status Open → In Progress") | `FieldChange.old_value` / `new_value` directly provide the before/after values |
| NOTIF-07 | User can toggle notification preferences per event type in settings | New `NotificationsSection` in `SettingsPage.tsx` with shadcn `Switch` components; preferences stored in `TriageDb` |
| NOTIF-08 | User can configure quiet hours to suppress notifications outside work hours | `QuietHoursRow` sub-component with native `<input type="time">` and weekday pills; Rust-side time check in dispatcher |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri-plugin-notification | 2.3.3 | OS notification dispatch, permission request, permission state | First-party Tauri plugin; handles macOS entitlements, permission dialog, and native notification delivery |
| @tauri-apps/plugin-notification | 2.3.3 | TypeScript bindings for isPermissionGranted, requestPermission, sendNotification | Paired JS counterpart to the Rust plugin |
| shadcn Switch | installed via `npx shadcn add switch` | Per-event toggle UI component | Already used in project (shadcn/radix); matches existing settings patterns |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chrono | 0.4 (already in Cargo.toml) | Quiet hours time comparison (current local time vs. configured window) | Already a dependency; `chrono::Local::now()` provides local time for quiet hours check |
| lucide-react Bell icon | bundled with existing lucide-react | Navigation item icon for Notifications settings section | Nav item icon per UI-SPEC |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-plugin-notification | Custom native binding (NSUserNotification / WinRT toast) | Plugin handles cross-platform, entitlement signing, permission UI — no reason to hand-roll |
| Rust-side notification dispatch | Frontend dispatch via `listen("poll-complete")` + JS `sendNotification()` | Rust-side is more reliable: fires even when frontend tab is backgrounded; JS approach works but creates race on app startup |
| ALTER TABLE migration for notification prefs | Separate `notification_prefs` table | Single-row JSON column in `app_config` matches existing poll_frequency/language migration pattern exactly |

**Installation:**
```bash
# Run from project root — adds Rust crate AND JS package in one step
npm run tauri add notification
# Equivalent manual steps:
cargo add tauri-plugin-notification  # in src-tauri/
npm install @tauri-apps/plugin-notification
```

**Version verification (confirmed 2026-03-28):**
- `tauri-plugin-notification` crates.io newest: **2.3.3**
- `@tauri-apps/plugin-notification` npm: **2.3.3**

---

## Architecture Patterns

### Recommended Project Structure

New files this phase adds:

```
src-tauri/src/
├── notification_dispatcher.rs   # NEW — builds notification content, checks prefs + quiet hours, sends
├── poll_engine.rs               # MODIFY — pass FieldChange data to dispatcher after process_tickets
├── triage_db.rs                 # MODIFY — add notification_prefs column via ALTER TABLE migration
├── commands.rs                  # MODIFY — add get/set notification prefs commands; trigger permission request on set_poll_frequency
├── main.rs                      # MODIFY — register tauri_plugin_notification::init()
└── lib.rs                       # MODIFY — pub mod notification_dispatcher

src-tauri/capabilities/
└── main.json                    # MODIFY — add "notification:default"

src/features/connections/
└── SettingsPage.tsx             # MODIFY — add NotificationsSection, QuietHoursRow, PermissionBanner

src/i18n/locales/
├── en.json                      # MODIFY — add settings.notifications.* and notification.* keys
└── sk.json                      # MODIFY — add matching Slovak translations
```

### Pattern 1: Plugin Registration (Rust)

Register the plugin in `main.rs` inside the `setup` closure alongside existing plugins:

```rust
// Source: https://v2.tauri.app/plugin/notification/
#[cfg(desktop)]
{
    app.handle().plugin(tauri_plugin_notification::init())?;
}
```

### Pattern 2: Capability Permission

Add to `src-tauri/capabilities/main.json`:

```json
{
  "permissions": [
    "core:default",
    "updater:default",
    "updater:allow-check",
    "updater:allow-download-and-install",
    "process:default",
    "process:allow-restart",
    "notification:default"
  ]
}
```

`notification:default` grants `allow-is-permission-granted`, `allow-request-permission`, and `allow-notify` — sufficient for all phase requirements.

### Pattern 3: Permission Request (TypeScript — triggered from PollingSection)

Decision D-04 places permission request at the moment the user switches poll frequency from Off to any active interval. The cleanest place is inside the existing `handleFrequencyChange` function in `PollingSection`:

```typescript
// Source: https://v2.tauri.app/plugin/notification/
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

async function handleFrequencyChange(freq: string) {
  await invoke('set_poll_frequency', { frequency: freq });
  useTicketStore.getState().setPollFrequency(freq);

  // D-04: request permission on first non-Off selection
  if (freq !== 'off') {
    const granted = await isPermissionGranted();
    if (!granted) {
      await requestPermission(); // triggers native macOS dialog
    }
  }
}
```

The permission state is also read on `NotificationsSection` mount to decide whether to show the `PermissionBanner`.

### Pattern 4: Notification Dispatch (Rust)

The `notification_dispatcher` module is called from `do_poll()` after change detection. Because `process_tickets` currently only returns `changed_keys` (not per-ticket `FieldChange` data), the payload must be enriched — the cleanest approach is to change `process_tickets` to return `Vec<(String, Vec<FieldChange>)>`:

```rust
// Source: adapted from existing process_tickets + NotificationExt trait
use tauri_plugin_notification::NotificationExt;

pub fn dispatch_notifications(
    app_handle: &tauri::AppHandle,
    ticket_key: &str,
    changes: &[FieldChange],
    prefs: &NotificationPrefs,
) {
    if !should_notify_now(prefs) {
        return; // quiet hours check
    }
    for change in changes {
        let body = build_body(change, /* snapshot_json for comment author */);
        if let Some(body) = body {
            let _ = app_handle
                .notification()
                .builder()
                .title(ticket_key)
                .body(&body)
                .show();
        }
    }
}
```

### Pattern 5: Notification Preferences in SQLite

Follow the existing `ALTER TABLE` migration pattern from `triage_db.rs`. Add a single JSON column to `app_config`:

```rust
// In triage_db.rs — new migration constant
const ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS: &str =
    "ALTER TABLE app_config ADD COLUMN notification_prefs TEXT;";

// In TriageDb::open() and open_in_memory():
let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS);
```

Store preferences as a JSON string (using `serde_json`) following the `watched_users` JSON column pattern already in `fetch_config`. The `NotificationPrefs` struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPrefs {
    pub notify_new_ticket: bool,       // NOTIF-07
    pub notify_status_change: bool,
    pub notify_priority_change: bool,
    pub notify_new_comment: bool,
    pub quiet_hours_enabled: bool,     // NOTIF-08
    pub quiet_start: Option<String>,   // "HH:MM" e.g. "18:00"
    pub quiet_end: Option<String>,     // "HH:MM" e.g. "08:00"
    pub quiet_days: Vec<String>,       // ["Mon","Tue","Wed","Thu","Fri"]
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            notify_new_ticket: true,       // D-08: all ON by default
            notify_status_change: true,
            notify_priority_change: true,
            notify_new_comment: true,
            quiet_hours_enabled: false,    // D-12: quiet hours off by default
            quiet_start: None,
            quiet_end: None,
            quiet_days: vec!["Mon","Tue","Wed","Thu","Fri"]
                .into_iter().map(String::from).collect(),
        }
    }
}
```

### Pattern 6: Comment Author + Snippet Extraction

For NOTIF-05 / D-03, the comment author and snippet are read from the **new** snapshot JSON (the ticket detail already fetched during `do_poll`). The last comment in `/fields/comment/comments` array is the newest:

```rust
fn extract_latest_comment(new_json: &str) -> Option<(String, String)> {
    let val: serde_json::Value = serde_json::from_str(new_json).ok()?;
    let comments = val.pointer("/fields/comment/comments")?.as_array()?;
    let last = comments.last()?;
    let author = last.pointer("/author/displayName")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let body = last.pointer("/body")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .chars()
        .take(60)
        .collect::<String>();
    Some((author, body))
}
```

### Pattern 7: Quiet Hours Check (Rust-Side)

Quiet hours check happens in `notification_dispatcher.rs`, not the frontend. This is the discretionary choice: Rust-side ensures suppression is guaranteed even if the window is hidden.

```rust
use chrono::{Local, Datelike, Timelike};

fn should_notify_now(prefs: &NotificationPrefs) -> bool {
    if !prefs.quiet_hours_enabled {
        return true;
    }
    let (Some(ref start), Some(ref end)) = (&prefs.quiet_start, &prefs.quiet_end) else {
        return true;
    };
    let now = Local::now();
    let day_name = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][now.weekday().num_days_from_sunday() as usize];
    if !prefs.quiet_days.iter().any(|d| d == day_name) {
        return true; // not a quiet day
    }
    let current_hhmm = format!("{:02}:{:02}", now.hour(), now.minute());
    // Quiet window may wrap midnight (e.g. 18:00 to 08:00)
    if start <= end {
        !(start.as_str() <= current_hhmm.as_str() && current_hhmm.as_str() < end.as_str())
    } else {
        // Wraps midnight
        !(current_hhmm.as_str() >= start.as_str() || current_hhmm.as_str() < end.as_str())
    }
}
```

### Anti-Patterns to Avoid

- **Passing notification prefs through PollCompletePayload:** The frontend should not be the source of truth for notification dispatch. Prefs are read Rust-side, eliminating IPC round-trips.
- **Emitting notifications from frontend on `listen("poll-complete")`:** Creates a race on app startup (event received before frontend store hydrates) and breaks when window is minimized.
- **Using a separate `app_settings` table:** The existing `app_config` table with ALTER TABLE migrations is the established pattern. A new table introduces unnecessary migration complexity.
- **Storing quiet hours start/end as two separate columns:** A single JSON column for `NotificationPrefs` follows the `watched_users` pattern and avoids proliferating columns on `app_config`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS notification dispatch | Custom NSUserNotification / WinRT toast bindings | tauri-plugin-notification | Handles permission lifecycle, notification center integration, macOS entitlements, cross-platform API surface |
| Permission request dialog | Direct system call | `requestPermission()` from plugin JS API | Native dialog, correct macOS behavior, permission state stored by OS |
| Time input UI | Custom time picker widget | Native `<input type="time">` (per UI-SPEC) | Zero dependencies, browsers/webviews handle time parsing, accessible |
| Toggle switch UI | Custom toggle implementation | shadcn `Switch` (Radix UI) | Already used in project, accessible, animated, consistent with design system |

**Key insight:** The notification permission flow on macOS is non-trivial (entitlements, system settings, first-ask behavior). The Tauri plugin handles all of this. Never bypass it.

---

## Common Pitfalls

### Pitfall 1: PollCompletePayload Only Carries Keys, Not FieldChange Data

**What goes wrong:** The existing `process_tickets()` returns `Vec<String>` (changed keys only). Notification dispatch needs the full `Vec<FieldChange>` per ticket. If you try to re-fetch from `snapshot_db` after the fact, you'll get the NEW snapshot (changes already stored), with no access to the old values.

**Why it happens:** `do_poll` was designed for Phase 13's scope — just surface changed keys to the frontend. Notification content requires old/new values.

**How to avoid:** Modify `process_tickets` to return `Vec<(String, Vec<FieldChange>)>` so both `changed_keys` (for the frontend payload) and per-ticket `FieldChange` data (for notification dispatch) are available in one pass. The change detection already produces this data — it just needs to be threaded through.

**Warning signs:** If you're calling `snapshot_db.get_snapshot()` inside the dispatcher to reconstruct changes, you've already lost the old snapshot.

### Pitfall 2: Quiet Hours Midnight Wrap

**What goes wrong:** Quiet hours "18:00 to 08:00" span midnight. A naive `start <= current <= end` check will fail because "18:00" > "08:00" lexicographically.

**Why it happens:** String comparison of HH:MM works for same-day windows but not cross-midnight ones.

**How to avoid:** Detect the wrap case: if `start > end`, the quiet window spans midnight. Use the two-branch check shown in Pattern 7. Test with times like 07:00, 09:00, 17:00, 19:00, 00:00.

### Pitfall 3: Permission Request on Every Non-Off Poll Change

**What goes wrong:** If permission is already granted, calling `requestPermission()` again on every poll frequency change is a no-op on most platforms but causes unnecessary async calls and may behave unexpectedly on some macOS versions.

**Why it happens:** D-04 says "request on first poll enable" — the intent is first time, not every time.

**How to avoid:** Always check `isPermissionGranted()` first; only call `requestPermission()` when it returns `false`.

### Pitfall 4: Plugin Not Registered Under #[cfg(desktop)]

**What goes wrong:** `tauri_plugin_notification::init()` called unconditionally causes a compile error on mobile targets (iOS/Android have different entitlement flows).

**Why it happens:** The project already uses `#[cfg(desktop)]` for `tauri_plugin_updater` and `tauri_plugin_process` — same pattern needed here.

**How to avoid:** Wrap plugin registration in `#[cfg(desktop)]` block exactly as done for updater/process plugins in the existing `main.rs`.

### Pitfall 5: Clippy too_many_lines on notification_dispatcher

**What goes wrong:** The `do_poll` function is already split due to clippy's 100-line limit (see STATE.md decision from Phase 13). Adding notification dispatch inline will re-trigger the lint.

**Why it happens:** Clippy pedantic config in Cargo.toml: `pedantic = "warn"`.

**How to avoid:** Keep `notification_dispatcher.rs` as a separate module. Call a single `dispatch_for_ticket(app_handle, key, &changes, &prefs)` function from the poll loop — keeps `do_poll` short.

### Pitfall 6: New Ticket Detection (NOTIF-02) Requires Different Logic

**What goes wrong:** New ticket detection is not in `FieldChange` data — `check_for_changes` returns an empty vec for a first-time ticket (by design, to avoid false-positive on initial poll).

**Why it happens:** The snapshot_db contract: first-time ticket → store snapshot, return empty changes. This was correct for Phase 13 change tracking but masks the "new ticket" event.

**How to avoid:** In `process_tickets`, separately track whether a ticket had NO prior snapshot before the `check_for_changes` call — that's the "new ticket" signal for NOTIF-02. One approach: check `snapshot_db.get_snapshot(key)` before calling `check_for_changes`; if `None`, it's a new ticket.

---

## Code Examples

Verified patterns from official sources:

### Sending a Notification (Rust — NotificationExt)
```rust
// Source: https://v2.tauri.app/plugin/notification/
use tauri_plugin_notification::NotificationExt;

app_handle
    .notification()
    .builder()
    .title("CUST-123")
    .body("Status: Open → In Progress")
    .show()
    .unwrap_or_else(|e| eprintln!("[notify] send failed: {e}"));
```

### Checking and Requesting Permission (TypeScript)
```typescript
// Source: https://v2.tauri.app/plugin/notification/
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

const granted = await isPermissionGranted();
if (!granted) {
  const result = await requestPermission();
  // result: 'granted' | 'denied' | 'default'
}
```

### ALTER TABLE Migration (Rust — follows triage_db.rs pattern)
```rust
const ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS: &str =
    "ALTER TABLE app_config ADD COLUMN notification_prefs TEXT;";

// In open() and open_in_memory():
let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS);
// Ignored if column already exists (SQLite idempotent pattern)
```

### Tauri Command Pattern for Notification Prefs (Rust)
```rust
// Source: mirrors get_poll_frequency / set_poll_frequency in commands.rs
#[tauri::command]
pub fn get_notification_prefs(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<NotificationPrefs, AppError> {
    let db = triage_db.lock().map_err(|_| AppError::Internal("Lock poisoned".into()))?;
    db.get_notification_prefs()
}

#[tauri::command]
pub fn set_notification_prefs(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    prefs: NotificationPrefs,
) -> Result<(), AppError> {
    let db = triage_db.lock().map_err(|_| AppError::Internal("Lock poisoned".into()))?;
    db.set_notification_prefs(&prefs)
}
```

### shadcn Switch Installation
```bash
npx shadcn add switch
# Installs: src/components/ui/switch.tsx
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 `tauri::api::notification::Notification` | `tauri_plugin_notification::NotificationExt` trait | Tauri v2 migration | Plugin-based; requires capability declaration |
| JS `notification` built into Tauri v1 API | Separate `@tauri-apps/plugin-notification` package | Tauri v2 | Must install explicitly |

**Deprecated/outdated:**
- `tauri::notification` (v1): Does not exist in Tauri 2.x — this project uses Tauri 2.10.

---

## Open Questions

1. **click-to-navigate (Tauri bug #8644 status)**
   - What we know: Issue #8644 "clicking notification does not unminimize app" is still OPEN as of the search on 2026-03-28. Issue #12834 (set_focus regression) is closed but attributed to TAO, not definitively fixed.
   - What's unclear: Whether either bug affects sending notifications at all (they only affect click behavior). The deferred decision (CONTEXT.md) already excludes click-to-navigate — no impact on Phase 14.
   - Recommendation: No action required. Document as known limitation in release notes if relevant.

2. **New ticket detection for NOTIF-02 vs. first-poll false positive**
   - What we know: `check_for_changes` returns empty vec on first-time ticket — correct for Phase 13. For NOTIF-02, a "new ticket" is a ticket appearing in poll results for the first time.
   - What's unclear: The user's first poll run should NOT trigger "new ticket" notifications for all pre-existing tickets. The snapshot foundation (Phase 12) addresses this: first-time check stores snapshot silently. So NOTIF-02 "new ticket" == ticket appears in JQL results AND no prior snapshot exists AND this is not the very first poll cycle. The "first poll" heuristic could be: if `watermark` was `None` before this poll, it's a baseline — skip new-ticket notifications. This needs a plan-level decision.
   - Recommendation: The planner should define "new ticket" as: ticket appears in poll results with no prior snapshot AND the poll watermark was already set (i.e., not the very first poll). Implement by checking `get_watermark()` before processing or by checking snapshot existence per ticket before calling `check_for_changes`.

3. **Notification prefs Rust-side access in poll loop**
   - What we know: `do_poll` has `triage_db` accessible as `Arc<Mutex<TriageDb>>`. Reading prefs requires a lock, which is fine since it's sync.
   - What's unclear: Whether prefs should be read once per `do_poll` call (efficient, consistent for a single poll cycle) or passed into `run_poll_loop` as a shared Arc (more responsive to mid-poll changes). For this phase's scope (no real-time pref update during a poll), once-per-poll is sufficient.
   - Recommendation: Read prefs at the top of `do_poll` alongside `extract_poll_params`, before any async calls. Single lock acquisition, no contention.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| tauri-plugin-notification (Rust) | NOTIF-01 to NOTIF-06 | Not yet installed | 2.3.3 (latest) | — (install required) |
| @tauri-apps/plugin-notification (JS) | NOTIF-01, NOTIF-07 | Not yet installed | 2.3.3 (latest) | — (install required) |
| chrono (Rust) | Quiet hours time comparison | Already in Cargo.toml | 0.4 | — |
| shadcn Switch | NOTIF-07 UI | Not yet installed | shadcn official | — (install required) |
| lucide-react Bell | Nav icon | Already in node_modules | current | — |

**Missing dependencies with no fallback:**
- `tauri-plugin-notification`: must be installed before implementation. Use `npm run tauri add notification` from project root.
- `shadcn Switch`: must be installed before frontend implementation. Use `npx shadcn add switch`.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via vite.config.ts `test` config) |
| Config file | `vite.config.ts` (test section) + `src/test-setup.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |
| Rust tests | `cargo test` in `src-tauri/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | Permission requested on poll frequency change from Off | unit (TS) | `npx vitest run src/features/connections/__tests__/NotificationsSection.test.tsx` | ❌ Wave 0 |
| NOTIF-02 | New ticket notification dispatched (new snapshot detection) | unit (Rust) | `cargo test -p pmkar_lib notification_dispatcher` | ❌ Wave 0 |
| NOTIF-03 | Status change notification dispatched | unit (Rust) | `cargo test -p pmkar_lib notification_dispatcher::tests::test_status_change_notification` | ❌ Wave 0 |
| NOTIF-04 | Priority change notification dispatched | unit (Rust) | `cargo test -p pmkar_lib notification_dispatcher::tests::test_priority_change_notification` | ❌ Wave 0 |
| NOTIF-05 | Comment notification dispatched with author + snippet | unit (Rust) | `cargo test -p pmkar_lib notification_dispatcher::tests::test_comment_notification` | ❌ Wave 0 |
| NOTIF-06 | Notification body format correct ("field: old → new") | unit (Rust) | `cargo test -p pmkar_lib notification_dispatcher::tests::test_body_format` | ❌ Wave 0 |
| NOTIF-07 | Toggle saves to SQLite, immediate-apply | unit (Rust + TS) | `cargo test -p pmkar_lib triage_db::tests::test_notification_prefs` | ❌ Wave 0 |
| NOTIF-08 | Quiet hours suppress notifications; midnight wrap handled | unit (Rust) | `cargo test -p pmkar_lib notification_dispatcher::tests::test_quiet_hours` | ❌ Wave 0 |

**Note:** Actual OS notification delivery cannot be unit tested (requires macOS notification center). Tests for the Rust side should use a mock/spy pattern — the `notification_dispatcher` module should accept an injectable notification sender trait or be structured so the body-building and quiet-hours logic is unit-testable independently of the actual `app_handle.notification()` call.

### Sampling Rate

- **Per task commit:** `cargo test -p pmkar_lib` + `npx vitest run src/features/connections/__tests__/`
- **Per wave merge:** `cargo test -p pmkar_lib` + `npx vitest run`
- **Phase gate:** Both `cargo test` and `npx vitest run` fully green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/features/connections/__tests__/NotificationsSection.test.tsx` — covers NOTIF-01, NOTIF-07 UI behavior
- [ ] `src-tauri/src/notification_dispatcher.rs` inline `#[cfg(test)]` block — covers NOTIF-02 through NOTIF-08 logic (body format, quiet hours, field filtering)
- [ ] `triage_db` test additions in existing `triage_db.rs` tests — covers NOTIF-07 persistence (get/set notification_prefs round-trip)

---

## Sources

### Primary (HIGH confidence)
- [https://v2.tauri.app/plugin/notification/](https://v2.tauri.app/plugin/notification/) — plugin installation, JS API, Rust API, capability permissions
- [https://docs.rs/tauri-plugin-notification/latest/tauri_plugin_notification/](https://docs.rs/tauri-plugin-notification/latest/tauri_plugin_notification/) — Rust struct/trait API reference
- [https://v2.tauri.app/reference/javascript/notification/](https://v2.tauri.app/reference/javascript/notification/) — TypeScript function signatures
- `src-tauri/src/poll_engine.rs` — existing PollCompletePayload, process_tickets, run_poll_loop (read directly)
- `src-tauri/src/snapshot_db.rs` — FieldChange struct, check_for_changes, WATCHED_FIELDS (read directly)
- `src-tauri/src/triage_db.rs` — ALTER TABLE migration pattern, app_config table (read directly)
- `src-tauri/Cargo.toml` — confirmed tauri 2.10, chrono 0.4 already present
- `src-tauri/capabilities/main.json` — existing capability structure
- npm registry: `@tauri-apps/plugin-notification` v2.3.3 confirmed

### Secondary (MEDIUM confidence)
- GitHub issue #8644 (still open) and #12834 (closed, TAO root cause) — click-to-navigate status confirmed deferred
- [https://github.com/tauri-apps/tauri-plugin-notification](https://github.com/tauri-apps/tauri-plugin-notification) — `notification:default` capability shorthand confirmed in README

### Tertiary (LOW confidence)
- None — all critical claims verified from primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm/crates.io versions verified 2026-03-28; official docs read directly
- Architecture: HIGH — based on reading actual project source files; dispatch pattern follows established conventions
- Pitfalls: HIGH — NOTIF-02 new-ticket detection gap is based on reading snapshot_db.rs check_for_changes contract; clippy lint limit documented in STATE.md
- Quiet hours midnight wrap: HIGH — standard algorithmic fact, verified in chrono docs

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (tauri-plugin-notification releases frequently; re-verify version before starting if > 2 weeks elapsed)
