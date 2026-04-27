# Project Research Summary

**Project:** pmkar v0.3.0 — Notifications, Background Polling, and Change Tracking
**Domain:** Cross-platform Tauri 2 desktop app with dual Jira REST API integration
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

pmkar is an existing Tauri 2 / React 19 / Rust desktop application that bridges Jira Cloud and Jira Server instances. The v0.3.0 milestone adds OS-level notifications, configurable background polling, ticket change tracking, and selector-based watch configuration on top of a well-established production codebase. The core architectural patterns — IPC via `invoke`, `Arc<Mutex<TriageDb>>` for SQLite access, Zustand stores per feature, Tauri event system for Rust-to-frontend push — are stable and should not be restructured; v0.3.0 extends them with minimal surgical additions.

The recommended approach is a layered build: snapshot storage foundation first, then the Rust-side polling engine, then notification dispatch, then the diff UI, and finally enhanced watch configuration. This ordering respects dependency chains: polling is meaningless without snapshot storage; notifications are meaningless without change detection; and the email domain selector feature has API limitations that require an explicit design decision before any UI work begins. Every new feature attaches to an already-existing integration point in the codebase, and only three new dependencies are required (tauri-plugin-notification, tokio-util, similar on the Rust side; react-diff-viewer-continued on the frontend).

The most significant risks are not implementation complexity but correctness traps: OS notification permission must be explicitly requested before the first send or it silently fails on macOS; the background poll loop must live in Rust (not React) or it will be throttled when the window is minimized; poll watermarks must only advance after a successful API response or changes will be permanently missed; and the email domain watch feature depends on Jira API data that is frequently redacted by Jira Cloud privacy controls. All four risks are entirely avoidable with correct design at the start of each phase.

---

## Key Findings

### Recommended Stack

The v0.3.0 additions are minimal and surgical. The base stack (Tauri 2.10, React 19, Vite 8, Zustand, shadcn/ui, rusqlite, reqwest, tokio) is already in production. Only three new Rust crates and one new npm package are needed.

**New core technologies:**
- `tauri-plugin-notification` 2.3.3 (Rust + JS): OS-level desktop notifications via the official first-party Tauri plugin — supports macOS Notification Center, Windows Toast, Linux libnotify; respects the Tauri capability/permission system; do NOT use the community `notify-rust` crate which bypasses Tauri's sandboxed permissions
- `tokio-util` 0.7.18: `CancellationToken` for clean background poll loop shutdown — the standard pattern for cancelling spawned async tasks in Tauri 2; the project already has tokio full features
- `similar` 2.7.0: Rust-side text diffing (Myers + Patience algorithms) for structured change detection — keeps diffing deterministic, testable via `cargo test`, and storable in SQLite; avoids shipping large strings across IPC just to diff them in JavaScript
- `react-diff-viewer-continued` 4.2.0 (frontend only): Renders inline/split diffs of changed ticket fields — React 19 compatible as of v4.1.0+ (GitHub issue #63 closed Feb 2026); actively maintained fork of the abandoned original

Background polling, change tracking, and enhanced watch configuration require no additional libraries beyond these — they build on existing tokio, rusqlite, and reqwest infrastructure already in the project.

### Expected Features

**Must have for v0.3.0 launch (P1):**
- Background polling with configurable interval (5 min / 15 min / 30 min / 1 hr / off) — core deliverable; without it nothing else in this milestone is useful
- Ticket snapshot storage (`ticket_snapshots` SQLite table) — foundational; required by both polling and diff view
- Change detection (hash-based fast check + field-level diff on mismatch) — makes polling actionable
- OS notification dispatch on new ticket / status change / priority change / comment added
- Notification permission request flow — required before any notification fires on macOS
- Per-event notification preferences (toggles per event type, stored in `notification_prefs` table)
- Manual poll on demand (`poll_now` command + UI button + Cmd/Ctrl+R)
- Change diff view in TicketDetailPanel — renders what changed since last seen; makes notifications actionable

**Should have for v0.3.x iterations (P2):**
- Selector-based watch by email domain (config-time resolver pattern, not runtime JQL)
- Change summary in notification body ("CUST-123: Status changed from Open to In Progress")
- Quiet hours / work-hours-only notification window

**Defer to v0.4+ (P3):**
- Taskbar/dock badge count — requires `tauri-plugin-badge` research and cross-platform testing
- In-app notification history — OS notification center is sufficient; adding in-app history is high complexity for low value

**Explicitly rejected as anti-features:**
- Webhook-based push from Jira (requires admin access, no public HTTPS endpoint on a desktop app)
- Persistent background daemon when window is closed (lifecycle, DB locking, and security complexity)
- Frontend-driven polling with `setInterval` (throttled when webview is backgrounded by OS)
- Sidecar process for polling (tauri::async_runtime::spawn is sufficient; sidecar adds process management overhead)

### Architecture Approach

v0.3.0 adds three new Rust modules and four new frontend files, modifies seven existing files, and adds three new SQLite tables via the existing ALTER TABLE migration pattern. The overall component structure is an extension of the established pattern, not a redesign.

**Major new components:**
1. `poll_scheduler.rs` — long-running async task spawned once at app startup; owns `tokio::time::interval`; receives `PollConfig` reconfiguration via `tokio::sync::watch` channel (not mpsc — only latest config matters); delegates to change_tracker and notification; emits `"ticket-changes"` event to frontend via `AppHandle.emit()`
2. `change_tracker.rs` — pure diff logic; extracts and hashes mutable user-visible fields (status, priority, summary, updated, assignee display name); runs field-level diff only on hash mismatch; writes snapshots to `ticket_snapshots` table; no network I/O
3. `notification.rs` — thin preference-aware wrapper around `tauri-plugin-notification`; reads `notification_prefs` from DB before each send; does not cache prefs in memory (avoids dual-source-of-truth)
4. `usePollController.ts` — React hook that subscribes to `"ticket-changes"` Tauri event and updates Zustand store; mounts once at app root; returns unlisten cleanup to avoid memory leaks
5. `ChangeDiffView.tsx` — renders field-level diffs from `changesMap[ticketKey]` in `ticketStore` using `react-diff-viewer-continued`

**Key patterns to follow:**
- Single Rust background loop with `watch::channel` for live reconfiguration — `watch` is correct here (not `mpsc`); only latest config matters
- `AppHandle.emit()` / `listen()` for all Rust-to-frontend push — clean separation; Rust never knows about React state
- Snapshot-hash change detection — hash mutable fields for fast O(1) equality check; full field diff only on mismatch; avoids false positives from Jira API volatile metadata (`self` URLs, expand fields)
- Lock-narrow pattern for TriageDb mutex — lock → read → unlock; network I/O with no lock held; lock → write → unlock; two short critical sections, never a long one

### Critical Pitfalls

1. **OS notification permission not requested before first send** — silently fails on macOS with no error; undetectable during development on Linux (auto-granted). Avoid by making `isPermissionGranted()` / `requestPermission()` the first thing built in the notification phase, before any other notification logic.

2. **Background poll implemented with frontend `setInterval`** — webview throttled by OS when window is minimized; polling stops and notifications cease. Avoid by implementing the poll loop entirely in Rust with `tauri::async_runtime::spawn` + `tokio::time::interval`; the frontend only listens for emitted events.

3. **Poll watermark advances on failed poll** — changes during the failed window are permanently and silently missed. Avoid by advancing the watermark only after a successful API response; store watermark in SQLite (not Zustand, lost on restart); use a 1-minute overlap buffer to tolerate clock skew; deduplicate by ticket key + updated timestamp.

4. **Notification click does not unminimize the window** — confirmed Tauri bugs: #8644 (click does not unminimize) and #12834 (`window.set_focus()` regression on macOS in Tauri 2.3+). Avoid by scoping v0.3.0 notifications as informational only (no click-to-navigate); use system tray as the re-entry point if needed.

5. **Email domain watch feature depends on redacted API data** — Jira Cloud privacy settings hide `emailAddress` by default; JQL domain clauses were removed October 2021 (JRACLOUD-61425). Avoid by designing the feature as a config-time resolver pattern (user searches → confirms list → list stored), not a runtime JQL filter.

6. **Jira Cloud rate limiting (HTTP 429) during burst polls** — Cloud burst limits fire at low request-per-second thresholds. Avoid by enforcing a 5-minute minimum poll interval; implementing exponential backoff with jitter on 429; honoring the `Retry-After` header; and testing with mock 429 responses.

7. **Changelog API gaps — comments and worklogs are not in `changelog.histories`** — a comment-only update advances `updated` but produces empty changelog; diff view would show "no changes" when there are changes. Avoid by designing diff data from three sources: changelog field items + comment count delta + worklog delta.

---

## Implications for Roadmap

Research establishes a clear dependency chain. Each phase must complete before the next can safely begin.

### Phase 1: Snapshot Foundation

**Rationale:** Everything in this milestone requires snapshot storage. Zero features can work without it. Pure backend infrastructure, no UI surface, lowest risk — build this first to validate the data layer before adding behavior on top.

**Delivers:** `ticket_snapshots` table in triage.db; `change_tracker.rs` module; snapshot upsert/read CRUD in `triage_db.rs`; hash-based change detection returning `Vec<FieldChange>`; `FieldChange` and `TicketChangesPayload` types in `types.ts`

**Addresses:** Snapshot storage (P1), change detection logic (P1)

**Avoids:** Storing full API response blobs (volatile metadata causes false-positive diffs); building polling before the comparison layer exists

**Research flag:** Standard patterns — skip research-phase. SQLite table schema and hash-based diffing are fully specified in ARCHITECTURE.md.

---

### Phase 2: Background Polling Engine

**Rationale:** The Rust-side polling loop is the central deliverable of v0.3.0. It must be built before notification dispatch (nothing to dispatch without poll results) and before the diff UI (no live data to display). The critical design decision — Rust loop, not frontend timer — has no safe retrofit path; getting this right now avoids a significant refactor later.

**Delivers:** `poll_scheduler.rs` with `tokio::time::interval` + `watch::channel`; `poll_config` SQLite table; `poll_now` / `set_poll_config` / `get_poll_config` commands; `PollConfigForm.tsx` in Settings; manual poll button + Cmd/Ctrl+R in `TicketListPage`; `usePollController.ts` hook registered in `App.tsx`; watermark logic in SQLite with overlap buffer and advance-on-success-only rule; exponential backoff on 429

**Addresses:** Background polling with configurable interval (P1), manual poll on demand (P1)

**Avoids:** Frontend `setInterval` polling; mutex held during network I/O; watermark advancing on failed poll; poll interval < 5 minutes

**Research flag:** Standard patterns — skip research-phase. Poll loop architecture is fully specified with code examples in ARCHITECTURE.md. Watermark and backoff requirements are documented in PITFALLS.md.

---

### Phase 3: Notification Dispatch

**Rationale:** Notification dispatch depends on Phase 2 producing change events. Permission request must be the very first thing implemented in this phase — all other notification work is blocked until permission flow is in place and verified on macOS.

**Delivers:** `tauri-plugin-notification` dependency added to Cargo.toml and capability file; `notification.rs` preference-aware wrapper; `notification_prefs` SQLite table; permission request flow; `get_notification_prefs` / `set_notification_prefs` commands; `NotificationPrefsForm.tsx` in Settings; per-event toggles for new ticket, status change, priority change, comment added; notification body text construction

**Addresses:** OS-level native notifications (P1), notification permission request (P1), per-event notification preferences (P1)

**Avoids:** Sending before permission is granted (silent macOS failure); click-to-navigate (confirmed Tauri bugs); notification spam via per-event preferences from day one; using `notify-rust` crate (bypasses Tauri permissions)

**Research flag:** Standard patterns for plugin integration. Test on macOS explicitly — Linux auto-grants permission and masks the failure during development. Accept Windows dev-build PowerShell branding as expected, not a bug.

---

### Phase 4: Change Diff View

**Rationale:** The diff view depends on snapshot storage (Phase 1) for the before/after data and working polling (Phase 2) to produce real change data during development. Building this after polling is confirmed working avoids developing against only empty states. This is the feature that makes notifications actionable.

**Delivers:** `ChangeDiffView.tsx` using `react-diff-viewer-continued`; `changesMap` state in `ticketStore`; `applyChanges` action; "changed" badge on `TicketCard`; diff panel in `TicketDetailPanel`; data assembled from three sources (changelog items + comment count delta + worklog delta); sort changelog by `created` timestamp

**Addresses:** Change diff view (P1), change summary in notification body (P2 polish can land here)

**Avoids:** Diff view showing "no changes" for comment-only updates (changelog API gap); relying solely on `changelog.histories` without comment/worklog delta; trusting API ordering of changelog entries

**Research flag:** Needs attention during story writing. The three-source data model for "what changed" must be explicitly scoped in stories before UI development begins — the changelog API gap (Pitfall 13) is a correctness requirement, not an edge case.

---

### Phase 5: Enhanced Watch Configuration (Email Domain Selector)

**Rationale:** Deferred from the core milestone because the feature has a known API limitation that requires an explicit design decision: Jira Cloud privacy settings frequently hide email addresses, and JQL domain clauses no longer exist. The resolver pattern must be designed before any UI work begins. Shipping phases 1–4 first means the core milestone is not blocked by this constraint.

**Delivers:** Domain selector UI in watch configuration; `GET /rest/api/2/user/search` integration for config-time user discovery; mixed user/domain watch list storage (`{ type: "user" | "domain", value: string }[]`); warning UI for Jira Cloud email privacy limitations; "email hidden" fallback state

**Addresses:** Selector-based watch by email domain (P2)

**Avoids:** Assuming `user.emailAddress` is present in Jira Cloud responses; runtime JQL domain filtering (clause removed 2021); mock returning all users with email addresses while real API hides them

**Research flag:** Needs `/gsd:research-phase`. Jira Cloud email privacy behavior under different org settings and PAT permission scopes is incompletely documented. Validate against a real Cloud instance before scoping Phase 5 stories. The "email hidden" fallback UX is underspecified and needs design validation.

---

### Phase Ordering Rationale

- Snapshot before polling: the poller compares against snapshots; without the table, polling can fetch but cannot detect changes
- Polling before notifications: notifications are emitted by the poll loop; the notification module has no trigger without a working poller
- Polling before diff UI: the diff view requires at least one successful poll cycle to have real data; building the UI without it means developing against empty states only
- Notifications before diff UI: the notification body text can be validated with real data before the visual diff component is built
- Domain selector last: it has an external API dependency with documented limitations requiring a specific design approach; deferring it avoids blocking the core milestone on a P2 feature

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (Email Domain Selector):** Jira Cloud email privacy API behavior is incompletely documented; recommend `/gsd:research-phase` before scoping stories

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** SQLite schema and hash-based diffing are fully specified in ARCHITECTURE.md
- **Phase 2:** tokio background loop with watch channel is fully specified with code examples in ARCHITECTURE.md and STACK.md
- **Phase 3:** `tauri-plugin-notification` integration is documented in official Tauri docs; permission flow is specified in PITFALLS.md
- **Phase 4:** `react-diff-viewer-continued` is a drop-in component; the multi-source data model is specified in PITFALLS.md

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All new dependencies verified against docs.rs, npm registry, and official Tauri docs. React 19 compat for `react-diff-viewer-continued` confirmed via closed GitHub issue (Feb 2026). Version numbers verified. |
| Features | HIGH | Based on direct codebase inspection of existing integration points. Jira changelog API structure verified from Atlassian documentation. Email domain limitation verified via open Jira feature request and confirmed clause removal in Oct 2021. |
| Architecture | HIGH | Core patterns (AppHandle.emit, tokio::async_runtime::spawn, watch::channel, lock-narrow) verified against official Tauri docs and existing codebase usage. One MEDIUM-confidence community blog source corroborated by official docs. |
| Pitfalls | HIGH | Notification permission silent failure verified against Tauri plugin docs. Webview throttling confirmed via open wry GitHub issues. Notification click bugs verified as open issues in Tauri repo. Changelog API gaps confirmed via Atlassian documentation and community reports. Rate limiting verified from Atlassian docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **Jira Cloud email privacy in domain selector (Phase 5):** The exact behavior of `GET /rest/api/2/user/search` under different Jira Cloud org privacy settings and specific PAT permission scopes is not validated. Handle by designing a config-time resolver with an explicit "email hidden" fallback, and validate against a real Cloud instance before shipping Phase 5.

- **`react-diff-viewer-continued` rendering edge cases:** React 19 compatibility is confirmed, but rendering behavior for very long field values (multi-paragraph ticket descriptions) has not been tested. Handle by building `ChangeDiffView` with a truncation strategy and test against realistic ticket content early in Phase 4.

- **Tauri bug status at implementation time:** The notification click/unminimize bugs (#8644, #12834) are confirmed open at research date (2026-03-27). Verify their status against Tauri 2.10 before finalizing Phase 3 scope — if fixed, click-to-navigate becomes feasible.

- **Windows dev-build notification branding:** Notifications appear under "Windows PowerShell" in dev builds (not production). Document in team dev setup notes to prevent misidentification as a bug during Phase 3 testing.

---

## Sources

### Primary (HIGH confidence)
- [Tauri v2 Notification Plugin](https://v2.tauri.app/plugin/notification/) — plugin setup, permissions, platform support
- [tauri-plugin-notification 2.3.3 on docs.rs](https://docs.rs/tauri-plugin-notification/latest/) — Rust NotificationExt API, version confirmed (released 2025-10-27)
- [Tauri: Calling the Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) — AppHandle.emit(), Emitter trait, listen()
- [Tauri State Management](https://v2.tauri.app/develop/state-management/) — app.manage() and State<> extractor
- [similar crate docs.rs](https://docs.rs/similar/latest/similar/) — version 2.7.0, TextDiff API
- [tokio-util 0.7.18 on docs.rs](https://docs.rs/tokio-util/latest/) — CancellationToken, version confirmed
- [react-diff-viewer-continued GitHub issue #63](https://github.com/Aeolun/react-diff-viewer-continued/issues/63) — React 19 support confirmed closed Feb 2026
- [Tauri async_runtime documentation](https://docs.rs/tauri/latest/tauri/async_runtime/index.html) — spawn pattern
- [Jira REST API changelog expansion](https://support.atlassian.com/jira/kb/how-to-analyze-the-history-or-changelog-of-an-issue-in-jira/) — changelog structure and gaps
- Pmkar codebase (direct inspection): `src-tauri/src/main.rs`, `triage_db.rs`, `commands.rs`, `src/features/tickets/types.ts`, `ticketStore.ts`, `src/App.tsx`, `src/features/update/useUpdateCheck.ts`

### Secondary (MEDIUM confidence)
- [Long-running async tasks in Tauri v2](https://sneakycrow.dev/blog/2024-05-12-running-async-tasks-in-tauri-v2) — spawn + AppHandle clone pattern (corroborated by official Tauri docs)
- [Jira incremental sync via updatedDate](https://community.atlassian.com/forums/Jira-questions/Rest-API-Filter-based-on-created-or-updated-date/qaq-p/1354197) — polling JQL overlap buffer pattern (community-verified)
- [react-diff-viewer-continued npm](https://www.npmjs.com/package/react-diff-viewer-continued) — version 4.2.0 (npm page not directly fetched; corroborated by GitHub)
- [Smashing Magazine: Design Guidelines for Notifications UX](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) — per-event preference UX patterns

### Tertiary (needs validation at implementation time)
- Tauri bug #8644 (notification click does not unminimize) — confirmed open at research date; verify against Tauri 2.10 before Phase 3
- Tauri bug #12834 (`window.set_focus()` macOS regression in 2.3+) — confirm against Tauri 2.10 before Phase 3
- wry issue #5250 (background throttling) — confirm webview throttling behavior against Tauri 2.10 on macOS/Windows before Phase 2
- [JRACLOUD-61425](https://jira.atlassian.com/browse/JRACLOUD-61425) — email domain JQL feature request; confirmed open; JQL clause removal confirmed October 2021

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
