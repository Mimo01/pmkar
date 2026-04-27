# Stack Research

**Domain:** Cross-platform Tauri desktop app with dual Jira REST API integration
**Researched:** 2026-03-27 (updated for v0.3.0 — notifications, polling, change tracking)
**Confidence:** HIGH for Tauri plugin and Rust additions (verified against docs.rs and v2.tauri.app); MEDIUM for diff UI library (React 19 compat verified, minor version in flux)

---

## v0.3.0 Stack Additions

This section documents only the NEW dependencies required for OS-level notifications,
background polling, change tracking/diffing, and enhanced watch selectors.
The base stack (Tauri 2.10, React 19, Vite 8, Zustand, shadcn/ui, i18next, Rust core
dependencies) is already in production and is NOT re-researched here.

---

### New Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `tauri-plugin-notification` | 2.3.3 (Rust) / `@tauri-apps/plugin-notification` 2.3.3 (JS) | OS-level desktop notifications on macOS, Windows, Linux | The official first-party Tauri notification plugin. Wraps platform notification APIs natively — no Electron-style workarounds. Supports text, title, icon. Permissions declared in `capabilities/`. Cross-platform: macOS Notification Center, Windows Toast, Linux (via libnotify). Latest stable: 2.3.3, released 2025-10-27. |
| `tokio-util` | 0.7.18 | `CancellationToken` for clean background poller shutdown | Already have `tokio = { version = "1", features = ["full"] }` in Cargo.toml. `tokio-util` adds `CancellationToken` — the standard pattern for cancelling background poll loops on app exit or user-triggered stop. Avoids orphaned tasks. Latest: 0.7.18. |
| `similar` | 2.7.0 | Rust-side text diffing for change detection | Computes diffs between old and new field values (description, summary, status, comments) in the Rust backend before serializing to frontend. Dependency-free, implements Myers + Patience algorithms. Used by `cargo-audit`, `git2`, `insta` — mature and well-maintained. Generates structured change data (`ChangeTag::Insert/Delete/Equal`) that maps cleanly to the existing serde JSON IPC. |

### New Supporting Libraries — Rust (Cargo) Side

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tauri-plugin-notification` | 2.3.3 | Register plugin in `lib.rs`, call `notification::notify()` from Tauri commands or background task | Use when a poll detects a field change on a watched ticket. Called from within `tauri::async_runtime::spawn` background task after change detection. |
| `tokio-util` | 0.7.18 | `CancellationToken` — share a clone into the background poll loop; cancel it on app shutdown or when user disables auto-poll | Use in the poll task spawned during `.setup()`. The token is stored in `AppState` so commands can cancel polling on demand. |
| `similar` | 2.7.0 | `TextDiff::from_lines()` or `TextDiff::from_words()` to diff old vs new string field values | Use in the change-detection layer to produce structured diffs stored in SQLite alongside ticket snapshots. Do NOT diff in the frontend — keeps diffing deterministic and testable in Rust. |

### New Supporting Libraries — Frontend (npm) Side

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-diff-viewer-continued` | 4.2.0 | Renders inline/split diff view for changed ticket fields | Use in the change diff view panel to display what changed on a ticket. React 19 support confirmed in v4.1.0+ (issue #63 closed February 2026). Renders unified or split diff from old/new strings. Actively maintained fork of the abandoned `react-diff-viewer`. |
| `@tauri-apps/plugin-notification` | 2.3.3 | JS bindings — `isPermissionGranted()`, `requestPermission()`, `sendNotification()` | Use in notification preference settings to check/request permission. On macOS/Linux this is typically pre-granted for desktop apps. On Windows (dev mode) notifications appear as PowerShell — document this. |

---

## Background Polling Pattern (No New Library — Built on Existing tokio)

The project already has `tokio = { version = "1", features = ["full"] }`. Background polling
does NOT require a new crate beyond `tokio-util` for `CancellationToken`.

The canonical pattern for Tauri v2:

```rust
// In lib.rs setup hook
.setup(|app| {
    let app_handle = app.handle().clone();
    let token = CancellationToken::new();
    // Store token in AppState so commands can cancel/restart polling
    app.manage(PollState { token: token.clone(), ... });

    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(config.poll_secs));
        loop {
            tokio::select! {
                _ = token.cancelled() => break,
                _ = interval.tick() => {
                    // fetch tickets, compare with last snapshot, emit "tickets-updated" event
                    app_handle.emit("tickets-updated", payload).unwrap();
                }
            }
        }
    });
    Ok(())
})
```

Frontend listens with `@tauri-apps/api` event system (already a dependency):
```typescript
import { listen } from "@tauri-apps/api/event";
listen("tickets-updated", (event) => { /* update Zustand store */ });
```

No additional libraries needed for this pattern.

---

## Change Tracking Pattern (SQLite Snapshots — No New Library)

The project already has `rusqlite = { version = "0.39", features = ["bundled"] }`.
Change tracking uses the existing SQLite database to store ticket field snapshots:

1. On each poll, fetch tickets from Jira Server API (already works).
2. Compare fetched fields against last snapshot stored in SQLite.
3. Use `similar` crate to compute text diffs for changed string fields.
4. Store the diff result as JSON in a `ticket_changes` table.
5. Emit `tickets-updated` event with change summary to frontend.

This means change tracking adds ONE new Rust crate (`similar`) and one new SQLite table.
No additional infrastructure.

---

## Enhanced Watch Configuration (No New Library)

Watch selectors (e.g., "all tickets assigned to users with @acme.com email domain") are
pure business logic in Rust — JQL construction and filter evaluation. No new library
needed. Existing `rusqlite` stores watch rules; existing `reqwest` executes the queries.

---

## Installation — New Additions Only

```bash
# Frontend: diff viewer component + notification plugin JS bindings
npm install react-diff-viewer-continued @tauri-apps/plugin-notification
```

```toml
# src-tauri/Cargo.toml additions

[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
# existing entries preserved:
tauri-plugin-updater = "2.10"
tauri-plugin-process = "2.3"
# NEW:
tauri-plugin-notification = "2.3"

[dependencies]
# existing entries preserved (tauri, tokio, rusqlite, reqwest, etc.)
# NEW:
tokio-util = { version = "0.7", features = ["rt"] }
similar = "2.7"
```

Capability file (`src-tauri/capabilities/default.json`) — add permission:
```json
"tauri:notification:default"
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `tauri-plugin-notification` (official) | `tauri-plugin-notifications` (community, Choochmeque) | Community plugin adds FCM/APNs push delivery — not needed for a desktop-only app. The official plugin is maintained by the Tauri team and covers all three desktop platforms. |
| `similar` (Rust-side diff) | Frontend-only diff (pass raw old/new strings to JS) | Diffing in Rust keeps the computation deterministic, testable with `cargo test`, and produces a structured result that can be stored in SQLite. Avoids sending large strings across IPC just to diff them. |
| `react-diff-viewer-continued` | `@git-diff-view/react` | `@git-diff-view/react` is a heavier, git-style diff renderer designed for file diffs. `react-diff-viewer-continued` is simpler, lighter, and designed for string-to-string text diff display — the right fit for ticket field changes. Also: `@git-diff-view/react` is at v0.1.x and less mature. |
| `react-diff-viewer-continued` | Custom diff renderer with `diff` npm package | Building a custom renderer takes time; `react-diff-viewer-continued` covers the standard inline/split views out of the box with React 19 support now confirmed. |
| `tokio::time::interval` + `CancellationToken` | `tokio-cron-scheduler` or external cron | Configurable interval (not cron expression) is all that's needed. A simple `tokio::time::interval` loop is 20 lines and zero new dependencies beyond `tokio-util`. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `notify-rust` crate | Would bypass Tauri's capability/permission system and call OS notification APIs directly. Breaks Tauri's sandboxed permissions model. | `tauri-plugin-notification` (registers with Tauri's plugin system, respects capability declarations) |
| `web-push` / FCM / APNs libraries | Push delivery infrastructure — only needed for mobile and cloud services, not a local desktop polling use case. | OS desktop notifications via `tauri-plugin-notification` |
| `redux` / `redux-saga` for polling state | Background polling state in this app is simple: running/paused, last polled time, interval value. Zustand (already present) is sufficient. | Existing Zustand store |
| `diff` npm package directly | Only produces text-level diffs as strings; `react-diff-viewer-continued` bundles its own diff computation and renders it. Using both would duplicate diffing. | `react-diff-viewer-continued` handles both |
| `imara-diff` Rust crate | Alternative to `similar` — less documentation, smaller ecosystem. `similar` is used by major Rust tools and has excellent `TextDiff` ergonomics for the string-field use case. | `similar` |
| Server-Sent Events (SSE) or WebSocket | The internal mock server (axum) already exists, but background polling does not require a streaming transport. The Tauri event system (`app_handle.emit()`) is the correct IPC for backend-to-frontend updates. | `app_handle.emit()` via Tauri event system |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `tauri-plugin-notification` 2.3.3 | Tauri 2.10 | Plugin major versions track Tauri major versions. Minor version 2.3.x is compatible with Tauri 2.10. Verified: docs.rs shows 2.3.3 released 2025-10-27. |
| `@tauri-apps/plugin-notification` 2.3.3 | `@tauri-apps/api` 2.10.x | npm package versions mirror the Rust crate versions. |
| `react-diff-viewer-continued` 4.2.0 | React 19 | React 19 peer dependency support confirmed in v4.1.0+ (GitHub issue #63 closed Feb 2026). Currently at 4.2.0 (published ~March 2026). |
| `similar` 2.7.0 | Rust MSRV 1.60 | Project uses Rust stable which is well above 1.60. No conflict with existing tokio 1.x or serde 1.x. |
| `tokio-util` 0.7.18 | `tokio` 1.x | `tokio-util` 0.7.x is the companion for tokio 1.x. Current version: 0.7.18. |

---

## Sources

- [Tauri Notification Plugin docs](https://v2.tauri.app/plugin/notification/) — setup, permissions, platform support (HIGH confidence)
- [tauri-plugin-notification 2.3.3 on docs.rs](https://docs.rs/crate/tauri-plugin-notification/latest) — version confirmed, released 2025-10-27 (HIGH confidence)
- [Tauri: Calling the Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) — AppHandle.emit() pattern, event system (HIGH confidence)
- [Tauri async tasks blog post](https://sneakycrow.dev/blog/2024-05-12-running-async-tasks-in-tauri-v2) — setup hook spawn pattern, AppHandle clone (MEDIUM confidence)
- [similar crate docs.rs](https://docs.rs/similar/latest/similar/) — version 2.7.0, algorithms (HIGH confidence)
- [tokio-util 0.7.18 on docs.rs](https://docs.rs/crate/tokio-util/latest) — CancellationToken, version confirmed (HIGH confidence)
- [react-diff-viewer-continued npm](https://www.npmjs.com/package/react-diff-viewer-continued) — version 4.2.0, active maintenance (MEDIUM confidence — npm page not directly fetched)
- [react-diff-viewer-continued GitHub issue #63](https://github.com/Aeolun/react-diff-viewer-continued/issues/63) — React 19 support confirmed closed Feb 2026 (HIGH confidence)
- [tokio CancellationToken docs](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html) — graceful shutdown pattern (HIGH confidence)

---

*Stack research for: Tauri cross-platform desktop app — v0.3.0 notifications, polling, change tracking additions*
*Researched: 2026-03-27*
