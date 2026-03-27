# Pitfalls Research

**Domain:** Desktop app for cross-instance Jira ticket management (Tauri, Cloud + Server, PAT auth)
**Researched:** 2026-03-27
**Confidence:** MEDIUM-HIGH — Tauri notification plugin docs verified directly; Jira API rate limiting verified from Atlassian docs; background polling and polling architecture from Tauri GitHub discussions + official docs; change detection/diff from community research. Some UX claims from empirical push notification research (Business of Apps 2025).

---

## Critical Pitfalls

### Pitfall 1: Treating Jira Cloud and Server APIs as Identical

**What goes wrong:**
Code written against one API shape silently fails or returns wrong data when run against the other. The APIs have significant structural differences that are not immediately obvious: field naming conventions, pagination models, authentication headers, and resource URL schemes all differ. Projects assume one adapter is enough and get burned when real edge cases surface.

**Why it happens:**
Both expose a "REST API" and share many endpoint names. Developers write against the Cloud API (better documented), then discover Server uses different field names for the same concepts, different pagination (startAt/maxResults vs cursor-based in some Cloud v3 endpoints), and that some Cloud-only fields (e.g., `accountId` instead of `name`/`key` for users) simply do not exist on Server.

Specific documented differences:
- **User identity**: Cloud uses `accountId` (opaque string). Server uses `name` (username) and `key`. Mixing these breaks assignee lookups and comment author attribution.
- **API version paths**: Cloud REST API v3 (`/rest/api/3/`) uses Atlassian Document Format (ADF) for description and comment bodies. Server typically uses v2 (`/rest/api/2/`) with Jira Wiki Markup or plain text. Sending ADF to a Server instance will be rejected or stored as garbage.
- **Attachment URLs**: Cloud attachment download URLs require authenticated requests with a different auth header pattern. Server attachment URLs may be directly accessible or require cookie-based auth depending on configuration.
- **Pagination**: Cloud v3 has moved some endpoints to cursor-based pagination; Server is always offset-based (startAt + maxResults).
- **Custom fields**: IDs are instance-specific (`customfield_10014`) but the same logical field (e.g., story points) may map to different IDs across instances.

**How to avoid:**
Design the Jira client as two separate adapter implementations behind a single interface from day one. Never share a single client implementation with branching conditionals — the conditionals will multiply. Define a `JiraClient` trait/interface with methods that return normalized internal types. Each adapter handles translation. Never pass raw API response shapes across the adapter boundary.

**Warning signs:**
- A single `jira_client.rs` file with `if is_cloud { ... } else { ... }` blocks growing beyond 3-4 cases
- User display names showing as `accountId` strings in the UI
- Description or comment bodies rendering as raw ADF JSON markup
- Copy succeeding silently but destination ticket having empty description

**Phase to address:**
Foundation / API integration phase — the adapter split must be established before any feature work begins. Retrofitting it later requires touching every callsite.

---

### Pitfall 2: Rich Content (ADF vs Wiki Markup) Conversion Causing Data Loss

**What goes wrong:**
Ticket descriptions and comments copied from Server to Cloud (or vice versa) arrive as unrendered markup strings, broken JSON blobs, or stripped plain text. The content looks fine in the source but is unusable in the destination. This is the single most common "copy looked successful but data is wrong" failure.

**Why it happens:**
Jira Cloud API v3 uses Atlassian Document Format (ADF) — a structured JSON schema — for all rich text fields (description, comment body, environment, etc.). Jira Server API v2 uses Jira Wiki Markup (a custom markup language) or sometimes plain text. Sending a Wiki Markup string to Cloud's v3 endpoint as the `description` field will not auto-convert it — Cloud will store it as a literal string inside an ADF paragraph node, losing all formatting. Sending ADF JSON to a Server v2 endpoint that expects a string will either fail validation or store `[object Object]`.

There is no official Atlassian-provided conversion library. Third-party converters exist (`jira-markup` npm package, `adf-builder`) but have coverage gaps for tables, nested lists, macros, and embedded images.

**How to avoid:**
- Always use the `renderedFields` parameter when fetching from Server (returns HTML) — this gives you rendered output which is more portable than Wiki Markup
- For the Cloud→Server direction (copying back is out of scope, but relevant for mock testing), use the `expand=renderedFields` query param
- Implement a conservative conversion: strip unsupported formatting rather than failing silently. A description with plain text is better than a broken copy.
- Add a "content fidelity" flag to the copy result: "description copied (formatting may differ)" vs "description copied (full fidelity)"
- Test with tickets that contain: tables, code blocks, inline images, numbered lists, @mentions, and issue links — these are the most common failure cases

**Warning signs:**
- Descriptions in destination tickets start with `{"version":1,"type":"doc"...`
- Descriptions show raw `*bold*` or `{code}` syntax instead of rendered formatting
- Tables are missing or flattened to single-line text
- @mentions appear as raw `[~username]` text

**Phase to address:**
Core copy workflow phase. Must be explicitly scoped — "copy description" is not done until rich content round-trips correctly through a mock that exercises both API shapes.

---

### Pitfall 3: Credential Leakage Through Rust Panic Messages and Log Output

**What goes wrong:**
PATs appear in log files, crash reports, or Tauri webview console output. This happens even when credentials are stored securely in the OS keychain — the moment a PAT is retrieved and used in an HTTP request, it passes through code paths that may log it.

**Why it happens:**
The PROJECT.md requirement for "full request/response logging" creates a direct conflict with credential security. A developer implements logging as `log::debug!("Request: {:?}", request)` and the PAT appears in the Authorization header. Rust's `Debug` derive on HTTP request structs will include all fields including auth headers. Tauri's webview DevTools (accessible in dev builds) shows IPC payloads that may include PATs if they're passed to the frontend.

Additionally, Rust panics triggered during HTTP calls may include partial request state in the panic message, which propagates to crash logs.

**How to avoid:**
- Never pass PATs to the frontend layer — all API calls must happen in the Rust backend
- Implement a `RedactedString` wrapper type for credentials that implements `Debug` as `"[REDACTED]"` and `Display` as `"[REDACTED]"` — use this type wherever credentials are held in memory
- Create a `SanitizedRequest` log struct that explicitly excludes the Authorization header, built separately from the actual request struct
- In the audit log (which per requirements logs full request/response), store header names but redact `Authorization` header value
- Never enable Tauri's `devTools` in release builds
- Add a CI check: grep for PAT patterns in log output during test runs

**Warning signs:**
- Audit log files containing `Bearer ey...` or `Basic ...` strings
- `cargo test -- --nocapture` output showing credential strings
- Tauri IPC payloads in browser DevTools containing token fields

**Phase to address:**
Foundation phase — the credential handling architecture (RedactedString type, log sanitization) must be in place before any HTTP client code is written. The audit logging feature (a PROJECT.md requirement) must be designed with this constraint from the start.

---

### Pitfall 4: Mock Server Drift — Tests Pass But Real API Fails

**What goes wrong:**
The mock Jira server diverges from real API behavior over time. Tests pass against the mock, but integration with a real Jira instance fails on edge cases the mock doesn't reproduce: field nullability, unexpected pagination behavior, rate limiting, attachment download quirks, or API version-specific response shapes.

**Why it happens:**
The mock is built to make tests pass, not to accurately model the full API contract. Developers add only the response fields their code currently reads, leaving other fields absent. When new code reads a previously-ignored field, it works against the mock (which was written to match) but fails against a real API that returns the field with a different name, type, or nesting.

A second failure mode: the mock is never run against a real Jira instance to validate parity. Without a validation harness, drift is invisible.

**How to avoid:**
- Build the mock from Atlassian's OpenAPI spec, not from observed responses — this ensures correct schema even for fields you haven't written code for yet
- Use response fixtures captured from real Jira API calls (sanitized) rather than hand-crafted JSON — include all fields the API actually returns, not just the ones you need
- Implement contract tests: a test suite that runs the same assertions against both the mock and (when credentials are available) a real instance
- Version the mock against specific Jira API versions (v2 Server, v3 Cloud) and document which version each fixture represents
- Mark mock endpoints with coverage status: "full parity", "partial — missing X", "stub only"

**Warning signs:**
- Mock response JSONs have fewer than 20 fields for a ticket (real Jira issues have 50+ fields)
- Test fixtures were hand-written rather than captured from a real API
- No test exercises the `renderedFields` expansion
- Mock returns `200 OK` for all requests including malformed ones

**Phase to address:**
Testing infrastructure phase — must be addressed before feature development, not retrofitted. The mock server design should be a deliverable in its own right, reviewed for API fidelity.

---

### Pitfall 5: Attachment Handling Broken by Auth Model Differences

**What goes wrong:**
Attachments fetch successfully (the metadata endpoint returns URLs), but downloading the actual binary content fails. Attachments appear in the UI as broken links or empty files. This affects the "copy with full fidelity" requirement directly.

**Why it happens:**
Jira attachment download URLs are not public. They require authentication, but the authentication mechanism differs:
- **Cloud**: The content URL returned by the API must be fetched with the same PAT in an `Authorization: Bearer` header. The URL itself is not pre-signed and does not embed credentials.
- **Server (older versions)**: The attachment URL may require cookie-based session authentication rather than PAT headers, depending on the server's authentication configuration. Some Server configurations will return the attachment metadata (with content URLs) to a PAT-authenticated request but then reject the content download from the same PAT.
- URL schemes differ: Cloud uses `api.atlassian.com/ex/jira/{cloudId}/...` while Server uses the instance's own domain.

A copy operation that transfers attachment metadata but not content produces a ticket with broken attachment links in the destination — which looks complete until a user clicks a link.

**How to avoid:**
- Implement a two-step attachment transfer: fetch metadata, then independently verify content download succeeds before marking the attachment transfer as complete
- In the mock server, implement attachment content endpoints (return actual binary content), not just metadata
- Test the attachment download path explicitly — do not assume it works because metadata returned 200
- For Server instances, test against both PAT-only and session-cookie configurations in the mock
- Make attachment transfer failures visible: report "copied with N attachments (M failed)" rather than silently omitting failures

**Warning signs:**
- Tests only assert that attachment metadata was copied, not that binary content was transferred
- Mock server has `/rest/api/2/issue/{key}/attachments` returning metadata but no corresponding content download endpoint
- Copy operation returns success with 0 bytes written to attachment storage

**Phase to address:**
Core copy workflow phase — specifically the attachment sub-feature. Must not be marked "done" until binary content transfer is verified end-to-end in the mock.

---

### Pitfall 6: Pagination Assumption — Silently Missing Tickets

**What goes wrong:**
Ticket fetch returns only the first page of results (typically 50 tickets). Users see an incomplete list and don't know it — there's no indication that more results exist. Over time they miss tickets they were supposed to review.

**Why it happens:**
The Jira search API (`/rest/api/2/search` or v3 equivalent) returns paginated results. The default `maxResults` is 50 on most instances. A JQL query for "tickets assigned to me or watched users" can easily return more than 50 results. Code that fetches one page and stops looks correct in tests (where the mock returns < 50 tickets) but silently truncates in production.

**How to avoid:**
- Always implement full pagination for any list-returning endpoint: loop until `startAt + issues.length >= total`
- Set a conservative maximum page size (50-100) — Server instances may enforce lower limits than Cloud
- Display the total count alongside the visible list: "Showing 23 of 23 tickets" vs "Showing 50 of 147 tickets — load more"
- In the mock, include test cases where total > maxResults to exercise pagination logic

**Warning signs:**
- Fetch function returns `Vec<Issue>` without a total count field
- No test case exercises a response where `total > maxResults`
- UI shows a list with no indication of whether more results exist

**Phase to address:**
Ticket fetch / candidate discovery phase. Pagination must be in the initial implementation, not added when a user reports missing tickets.

---

### Pitfall 7: Tauri IPC Boundary Leaks Internal Error Details

**What goes wrong:**
Rust errors bubble up to the frontend as raw error strings that expose internal implementation details: file paths, stack traces, credential-adjacent field names, or Jira API error payloads including account IDs and instance URLs.

**Why it happens:**
Tauri commands return `Result<T, E>` and the error type is serialized to the frontend. If `E` is `anyhow::Error` or a raw Jira API error struct, the full error message — including context added with `.context("while fetching ticket for account_id: abc123")` — reaches the JavaScript layer and may be displayed or logged.

**How to avoid:**
- Define a `FrontendError` enum with user-facing variants only: `ConnectionFailed`, `AuthFailed`, `NotFound`, `CopyFailed { ticket_key: String }`, etc.
- Internal errors (including Jira API error bodies) are logged at Rust level only — never forwarded to frontend
- The `From<InternalError> for FrontendError` conversion strips sensitive context
- In tests, assert that error messages returned to the frontend contain no URLs, account IDs, or credential strings

**Warning signs:**
- Tauri commands return `anyhow::Error` directly
- Frontend displays error messages containing URLs (e.g., `https://companyinstance.atlassian.net/...`)
- Error messages in the UI show Jira field names or account IDs

**Phase to address:**
Foundation phase — the error handling architecture should be designed before feature work. Retrofitting a `FrontendError` enum after all commands are written is feasible but tedious.

---

## v0.3.0 Critical Pitfalls — Notifications, Polling & Change Tracking

### Pitfall 8: OS Notification Permission Not Requested Before First Send

**What goes wrong:**
`sendNotification()` silently fails on macOS and returns no error. The user never sees any notifications. The developer tests on Linux (where permissions are granted by default) and doesn't notice the failure.

**Why it happens:**
macOS requires an explicit runtime permission grant before any notification can be displayed. The Tauri notification plugin exposes `isPermissionGranted()` and `requestPermission()` but these are not called automatically when the plugin is registered. If code calls `sendNotification()` without first checking and requesting permission, the notification is silently dropped on macOS. On Linux, permissions are auto-granted, masking the missing check during development.

On Windows in development builds, notifications appear under "Windows PowerShell" instead of the app name because package identity is only established after MSIX packaging for distribution. This does not block functionality but confuses dev testing.

**How to avoid:**
- At startup (or first notification attempt), call `isPermissionGranted()` and if false, call `requestPermission()` before any notification is sent
- Handle the `Denied` case — store the denial in app state and suppress future permission requests; provide a settings prompt to guide users to OS notification settings
- In the test suite, mock the permission check so tests don't depend on OS state
- Accept that Windows dev builds will show PowerShell branding; test notification content and behavior, not the sender name, in CI

**Warning signs:**
- Notifications tested only on Linux during development
- No `isPermissionGranted()` call in the notification send path
- "Notifications work on my machine" report from developer on Linux but user on macOS reports no notifications
- No test case for permission-denied state

**Phase to address:**
Background polling / notification phase — the permission check + request flow must be the first thing built before any other notification logic.

---

### Pitfall 9: Notification Click Does Not Bring Minimized Window to Front

**What goes wrong:**
User receives a notification for a ticket change, clicks it, and nothing happens — the app remains minimized. The notification seems to fire but does not navigate to the changed ticket.

**Why it happens:**
The Tauri notification plugin does not currently provide a click callback in its JavaScript API (there is an open GitHub issue: `[feat] notification click event #4770`). The OS delivers the click to the app, but Tauri's webview does not expose a handler that fires on notification click. Additionally, a confirmed Tauri bug (`[bug] Clicking on notification does not unminimize the app. #8644`) means the window is not automatically unminimized when a notification is clicked — the app stays minimized.

A second issue: on macOS, `window.set_focus()` has a reported regression in Tauri 2.3+ (`[bug] window.set_focus does not work after upgrading from tauri 2.0 to 2.3 on macOS #12834`).

**How to avoid:**
- Do not build a "click notification → navigate to ticket" feature for v0.3.0 without first verifying the current plugin version's click callback support; check the Tauri notification plugin CHANGELOG for click action support
- For now, implement notification as informational only (no deep-link click). The user opens the app manually to see changes.
- For focus/unminimize on notification click: implement a system tray icon as an alternative entry point — this is standard Tauri practice for persistent desktop apps and is well-supported; on tray click, explicitly call `window.unminimize()` followed by `window.set_focus()`
- If click-to-navigate is required, investigate notification actions API (available on mobile; limited on desktop) as a workaround

**Warning signs:**
- Story "click notification to open changed ticket" is added to v0.3.0 scope without checking current plugin capability
- No test covering "app minimized → notification click → window appears"
- `window.set_focus()` used without version compatibility check

**Phase to address:**
Notification integration phase — verify click callback capability before scoping click-to-navigate; use tray icon for focus recovery.

---

### Pitfall 10: Background Poll Stops When the Window Is Minimized (WebView Throttling)

**What goes wrong:**
Background polling works correctly when the window is visible, but stops (or slows to once per minute) when the window is minimized or the user switches to another app. Ticket change notifications stop arriving.

**Why it happens:**
Tauri's webview (WKWebView on macOS, WebView2 on Windows) throttles JavaScript timers when the webview is backgrounded. If polling is implemented with `setInterval` or a React `useEffect` timer on the frontend side, it will be throttled by the OS webview scheduler. This is a known upstream issue (`[feat] Allow disable background throttling #5250`, `Allow disabling background throttling/suspension on macOS #1246` in wry).

**How to avoid:**
- Implement the polling loop entirely in Rust using `tauri::async_runtime::spawn` with `tokio::time::interval` — Rust timers are not subject to webview throttling
- The Rust loop polls the Jira API and calls `app_handle.emit("ticket-changed", payload)` to notify the frontend
- The frontend only listens for events — it never drives polling itself
- Clone `AppHandle` cheaply; the clone is designed for this pattern (Tauri docs confirm: "Cloning AppHandle and Window instances is relatively cheap")
- For graceful shutdown: hold the spawned task handle in `AppState` under a `Mutex<Option<JoinHandle>>` so it can be cancelled on app exit

**Warning signs:**
- Polling implemented with `setInterval` in React
- Poll interval is a state variable managed in Zustand, not a Rust-side timer
- `tokio::time::sleep` loop is inside a Tauri command (blocking command thread) rather than a spawned task

**Phase to address:**
Background polling architecture phase — this must be the design decision made first; moving polling from frontend to Rust is a significant refactor if done late.

---

### Pitfall 11: Poll Watermark Drift — Missing Changes or Duplicate Notifications

**What goes wrong:**
The poll uses a "last checked" timestamp to query for tickets updated since that time (`updatedDate >= "last_checked"`). Either: (a) tickets updated exactly at the boundary are missed, (b) the same ticket triggers duplicate notifications on consecutive polls, or (c) the watermark advances even when the poll fails, silently skipping changes.

**Why it happens:**
Three distinct failure modes:

1. **Timezone mismatch**: Jira Server's JQL uses the server JVM timezone, not UTC. If the app stores timestamps in UTC and the Jira Server is in a different timezone, the JQL query misses a window of changes. A known Atlassian support article confirms this: JQL date/time does not take the user's timezone into account — it uses the server's JVM timezone.

2. **Watermark advance on failure**: If the poll fails (network error, 429 rate limit, timeout), and the code advances the watermark anyway to "avoid re-fetching", the changes during that failed window are permanently missed.

3. **Clock skew / off-by-one**: Using strict equality `=` instead of `>=` on the `updated` field, or rounding timestamps, causes tickets updated in the last second of a window to be missed.

**How to avoid:**
- Only advance the watermark after a successful poll response
- Use `>= "last_watermark - 1 minute"` (overlap buffer) to tolerate clock skew and off-by-one; deduplicate on ticket key + `updated` timestamp before notifying
- Store the server's timezone offset (retrieve from Jira Server's `/rest/api/2/serverInfo`) and convert timestamps before constructing JQL
- Store the watermark in SQLite (already used by the app), not in-memory — so it survives app restarts and crashes
- Log every watermark advance and the count of tickets returned: "Poll at 14:23:01 — watermark 14:20:00 → 14:23:01, 3 tickets found"

**Warning signs:**
- Watermark stored in Zustand state (lost on app restart)
- Watermark advanced before the API response is processed
- JQL uses `updated = "..."` instead of `updated >= "..."`
- No test for poll failure → watermark unchanged → next poll picks up missed window

**Phase to address:**
Change detection / polling phase — the watermark and deduplication logic must be designed as a unit; do not build them separately.

---

### Pitfall 12: Jira Cloud Rate Limiting During Burst Polls

**What goes wrong:**
The app starts polling at a short interval (e.g., 1 minute) and triggers Jira Cloud's burst rate limit (HTTP 429). All polls for a window are blocked. If the app does not back off and retry, it either spams the API or misses changes silently.

**Why it happens:**
Jira Cloud enforces three independent rate limiting systems simultaneously: points-based hourly quota, burst per-second limits, and per-issue write limits. The burst limit fires when requests per second exceeds a threshold — even a single app polling at short intervals can trigger it if the JQL query returns many results (a search returning 50 issues costs 51 points). The Retry-After header gives the backoff duration, but if the app ignores it and retries immediately, it will continue hitting 429s.

Jira Server self-hosted can also be rate-limited if the administrator has configured it (available since Server Data Center 8.x).

**How to avoid:**
- Implement exponential backoff with jitter on 429: start at 2s base delay, double per retry, add random jitter (multiply by 0.7–1.3), cap at 4 retries then mark poll as "rate limited — will retry next scheduled interval"
- Always read the `Retry-After` response header and honor it
- Do not reduce minimum configurable poll interval below 5 minutes (reduces burst risk while still being practical for change detection)
- Log 429 responses in the audit log with the Retry-After value
- In the mock server, simulate 429 responses to verify backoff behavior under test

**Warning signs:**
- Minimum configurable poll interval is under 2 minutes
- No 429 handling in the HTTP client — `reqwest` returns an error but code doesn't inspect status code
- Poll retry on failure is immediate (no delay)
- Mock server never returns 429

**Phase to address:**
Background polling architecture phase — backoff must be part of the initial polling implementation, not added after users report blocked accounts.

---

### Pitfall 13: Changelog API Does Not Capture All Change Types

**What goes wrong:**
The diff view shows a ticket as "changed" (because the `updated` timestamp moved) but the changelog shows no relevant changes. Or the diff view misses changes to attachments and worklogs even though the user can see them changed in Jira.

**Why it happens:**
The Jira changelog (`GET /rest/api/2/issue/{key}?expand=changelog`) captures field-level changes (status, assignee, summary, description, priority, etc.) but has documented gaps:

- **Comments are not in the changelog items** — they appear in `fields.comment.comments` but not in `changelog.histories[].items`. A new comment causes `updated` to advance but adds no changelog entry.
- **Worklog entries are not in the changelog items** — same behavior. Time logged advances `updated` but does not appear as a changelog history item.
- **Attachment additions/deletions**: behavior varies by Jira version. Some versions do record attachment changes in changelog; others do not.
- **History order is not guaranteed**: Atlassian community confirms changelog items may return in ascending or descending order depending on the instance — you must sort by `created` timestamp yourself.

**How to avoid:**
- Design the diff view to show changes from three separate sources: (1) changelog field changes, (2) comment delta (compare comment count/IDs since last fetch), (3) worklog delta (compare total time spent or entry count)
- Never assume `updated` moved = there are changelog items to show; handle the "zero changelog items" case with a fallback ("ticket was updated — comments or worklogs may have changed")
- Sort changelog histories by `created` before display — do not rely on API ordering
- In the mock, test a response where `updated` advanced but `changelog.histories` is empty (comment-only update)

**Warning signs:**
- Diff view only reads `changelog.histories[].items` and ignores `fields.comment` and `fields.worklog`
- No test case for a ticket where the only change was a new comment
- Diff view shows "no changes" for a ticket the user can see was recently commented on

**Phase to address:**
Change diff view phase — the data model for "what changed" must be designed to pull from multiple sources before the UI is built.

---

### Pitfall 14: Email Domain Selector for Watch Configuration Relies on Unavailable API Data

**What goes wrong:**
The "watch by email domain" feature is built assuming the app can query Jira for all users matching a domain (`@customer.com`). At runtime, no users are discovered. The feature appears to work in dev (where the mock returns users) but fails against a real Jira Cloud instance.

**Why it happens:**
Two compounding problems:

1. **Jira Cloud privacy controls hide email addresses**: By default, Jira Cloud's user management privacy settings do not return email addresses in user API responses. The `emailAddress` field is redacted based on the user's privacy preferences. Even if you have a valid PAT with Browse Users permission, the `GET /rest/api/3/user/search` endpoint may return users with `emailAddress` omitted.

2. **No native email domain filter in JQL**: JQL has no `emailDomain` field. The "Domain of reporter" and "Domain of assignee" JQL clauses were removed in October 2021. There is no supported way to express "all users from domain X" in a JQL query.

The practical workaround is to resolve domain → user list at configuration time: the user manually identifies which users belong to the customer's domain and the app stores the explicit list. But this must be designed intentionally, not discovered after the feature is shipped.

**How to avoid:**
- Design "watch by domain" as: user enters domain (e.g., `customer.com`), app uses `GET /rest/api/2/user/search?username=` or the user picker to find matching users, user confirms the list, and the confirmed list is stored as explicit user watches
- On Jira Cloud, warn users that email addresses may be hidden by privacy settings and that domain matching may be incomplete
- Treat the domain as a search hint for the configuration UI only, not as a runtime JQL filter
- In the mock server, test with users whose `emailAddress` is omitted from the response to verify the fallback UX works

**Warning signs:**
- Feature assumes `user.emailAddress` is always present in API responses
- JQL query contains a domain-based clause (these no longer exist in Cloud)
- Mock returns all users with email addresses but the real API hides them
- No "user not found for domain" error state in the configuration UI

**Phase to address:**
Watch configuration phase — design the email domain feature around the resolver pattern (config-time lookup, not runtime JQL) before any UI is built.

---

### Pitfall 15: Notification Spam Erodes User Trust and Leads to OS-Level Blocking

**What goes wrong:**
The app sends a notification every time any watched ticket is updated during a poll. During an active Jira sprint, a user watching 20 tickets receives 40+ notifications per hour. The user blocks the app in OS notification settings. After that, no notifications are delivered, and the user thinks the feature is broken.

**Why it happens:**
Push notification research (Business of Apps 2025) finds that 62% of users consider push messages spam when they receive too many, and 53% say notifications irritated them. Desktop notification spam leads to OS-level blocking. Once blocked in macOS Notification Center or Windows Action Center, there is no way to recover without the user manually unblocking — the app has no visibility into the blocked state.

A second risk: the first time the app requests notification permission, if the user is presented with a burst of example notifications during setup, they are more likely to deny permission permanently.

**How to avoid:**
- Default to digest mode: batch changes from a single poll into one notification ("3 tickets changed since last check") rather than one notification per ticket
- Make per-ticket notification opt-in (high-urgency tickets only), not the default
- Add a configurable quiet period (e.g., "do not notify between 22:00 and 08:00")
- Add a "max N notifications per hour" cap with a "N more changes — open app to view" overflow notification
- Never send example/test notifications during onboarding
- In the notification preferences UI, show a preview of what the notification will look like before enabling

**Warning signs:**
- Notification send is called once per changed ticket in a loop
- No "last notified" deduplication — same ticket triggers a notification on every poll if it stays "changed since last visit"
- No configurable batch/digest mode
- Notification preferences page has no "send test" preview — developer can't verify what the user will see before shipping

**Phase to address:**
Notification preferences phase — batching and deduplication must be the default behavior from the start. Adding it retroactively after users complain about spam is too late (they've already blocked the app in OS settings).

---

### Pitfall 16: Stale Zustand State Causes Change Diff to Show False Positives

**What goes wrong:**
The diff view shows a ticket as "changed" on every app launch, even when the user has already reviewed the change. Or: the diff view shows changes that were already reflected in the last fetch, making every poll look like it found something new.

**Why it happens:**
The "what changed" diff is computed by comparing current Jira data against a stored snapshot. If the stored snapshot is held in Zustand (in-memory state), it is lost on app restart. On the next launch, the snapshot is empty, so every field looks "changed" compared to the current value.

A second failure mode: the snapshot is updated optimistically (before the Jira response arrives), causing a stale closure in the Zustand setter to capture an old ticket state. The next poll compares against the stale snapshot, not the actual last-known state.

**How to avoid:**
- Persist ticket snapshots (field values at last-viewed time) to SQLite — this is the correct store for structured, queryable, persistent data; Zustand should only hold the current session's UI state
- Update the snapshot only after successfully reading the ticket detail (user opened the ticket detail view), not at poll time
- Use Zustand's `get()` inside async updaters, not captured closures: `set((state) => ...)` or `get().tickets` to access current state in async callbacks
- Add a test: restart the app → open diff view → no changes shown for a ticket that hasn't actually changed

**Warning signs:**
- Ticket snapshot stored as `lastSeenSnapshot: Record<string, Issue>` in Zustand
- Snapshot updated inside a `useEffect` or polling callback without using `get()` from the Zustand store
- Diff view always shows changes on first app launch
- No test for snapshot persistence across app restarts

**Phase to address:**
Change tracking architecture phase — storage decision (SQLite vs in-memory) must be made before any diff logic is written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single Jira client with `if is_cloud` branches | Faster initial build | Branches multiply; untestable combinations; refactor required when adding third source | Never — split from start |
| Hand-write mock response fixtures | Fast to create first test | Mock drifts from real API; silent test-passes/real-fails | Only for trivial status-code tests, not for data structure tests |
| Skip ADF/Wiki Markup conversion, copy raw string | Description "copies" quickly | Destination tickets have broken/unrendered content; users lose trust in the tool | Never for the primary copy path |
| Store copy history in JSON file alongside app | Simple to implement | No query capability; file corruption loses history; hard to extend | Acceptable for MVP if schema is versioned and migration path planned |
| Hardcode field mappings (summary→summary, description→description) | Works for standard fields | Custom fields silently dropped; users discover missing data after copy | Acceptable for MVP with explicit "custom fields not copied" notice |
| Pass credentials through Tauri IPC to frontend | Simplifies architecture | Credentials in webview memory, accessible via DevTools, risk of logging | Never — credentials stay in Rust backend only |
| Frontend-driven poll interval (setInterval in React) | Fast to prototype | Webview throttles timers when backgrounded; polling stops when window minimized | Never — background polling must be Rust-side |
| Store poll watermark in Zustand | Simple to implement | Lost on app restart; causes missed changes after crash or close | Never — watermark must be in SQLite |
| One notification per changed ticket per poll | Simple loop | Users block app in OS notification settings after first sprint | Never as default — digest/batch from day one |
| Treat `updated` timestamp as proxy for "what changed" | No extra API calls | Comments and worklog changes trigger `updated` but have no changelog items | Acceptable for notification trigger; not acceptable for diff display |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira Cloud API v3 | Send string as `description` field | Send ADF document: `{"version":1,"type":"doc","content":[...]}` |
| Jira Server API v2 | Send ADF JSON as `description` | Send Wiki Markup string or use `renderedFields` HTML as source |
| Jira user identity | Use `name`/`displayName` as assignee on Cloud | Use `accountId` for Cloud, `name` for Server; they are not interchangeable |
| Jira attachments | Assume attachment URL is directly downloadable | Re-fetch attachment content with authenticated request using the same PAT |
| Jira issue links | Copy `inwardIssue`/`outwardIssue` keys directly | Keys reference the source instance; links in destination will be broken unless destination has matching tickets |
| Jira sub-tasks | Copy parent ticket assuming sub-tasks copy automatically | Sub-tasks must be fetched and copied separately; parent key in `fields.parent` must be updated to destination key |
| Jira custom fields | Read `customfield_10014` by ID | IDs are instance-specific; same logical field has different ID on source vs destination; build a field mapping configuration |
| PAT authentication | Use Basic auth with `user:token` as password | Cloud uses Bearer token for PAT; Server uses Basic auth with `user:token` — different schemes |
| Jira changelog API | Assume `changelog.histories` covers all changes | Comments and worklogs advance `updated` but are not in changelog.histories; fetch separately |
| Jira Cloud user search | Use `emailAddress` for domain filtering | Email addresses are hidden by privacy settings; domain filtering must be a configuration-time lookup, not runtime JQL |
| Jira Server JQL timestamps | Use app-local UTC timestamps in JQL queries | JQL uses server JVM timezone; fetch timezone from `/rest/api/2/serverInfo` and convert |
| Tauri notifications (macOS) | Call `sendNotification()` without checking permission | Always call `isPermissionGranted()` first; request permission if not granted; handle Denied state |
| Tauri notifications (Windows dev) | Test in dev expecting correct app name | Dev builds show "PowerShell" as sender; package identity only available in MSIX distribution builds |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full ticket details in list view | UI hangs during candidate fetch; slow initial load | Fetch list with minimal fields, load full detail on demand | At 20+ tickets in a session |
| Sequential attachment downloads | Copy operation takes minutes for tickets with many attachments | Parallelize attachment downloads (bounded concurrency — 3-5 simultaneous) | At 5+ attachments per ticket |
| No caching of watched-user lookups | User profile lookups on every ticket render | Cache user profiles for session duration | At 10+ unique users across 20 tickets |
| Fetching all comments upfront | High memory use; slow for tickets with 100+ comments | Paginate comments; load older comments on demand | At 50+ comments per ticket |
| Re-fetching source ticket on every copy attempt | Unnecessary round-trips if user copies multiple fields | Cache source ticket data until user navigates away | Per-session, not a scaling issue — but poor UX |
| Polling full ticket detail on every interval | JQL search + N detail fetches every 5 minutes | Poll JQL for changed ticket keys only; fetch full detail only for newly-changed tickets | At 10+ watched tickets polled every 5 minutes |
| Fetching full changelog on every poll | Changelog pagination can be large for old tickets | Only request changelog items since last watermark using `startAt` pagination | At 50+ changelog items per ticket |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full HTTP requests including Authorization header | PAT written to audit log file on disk | Sanitize auth headers in log layer; log header name but not value |
| Passing PAT to frontend via Tauri IPC | PAT in webview memory; accessible via DevTools in dev mode | All API calls stay in Rust backend; frontend receives results, never credentials |
| Storing PAT in app config file as fallback | Config file readable by other processes; checked into source control accidentally | OS keychain only, no fallback; fail loudly if keychain is unavailable |
| Using PAT in URL query string (`?token=...`) | PAT in server logs, browser history, Tauri webview address bar | Header-only auth; never put credentials in URLs |
| Not clearing PAT from memory after use | PAT remains in Rust heap until GC; could appear in crash dumps | Zeroize credential buffers after use (zeroize crate) |
| Trusting TLS certificate without validation on Server instances | Man-in-the-middle against self-hosted instance | Enforce TLS validation; provide explicit "accept this certificate" UX for self-signed certs rather than disabling validation globally |
| Notification payload includes sensitive ticket content | Notification content visible in OS notification center history and lock screen | Limit notification body to ticket key and generic change type; never include field values, comments, or personal data in notification payload |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No indication of copy fidelity | User assumes full copy; discovers missing data later | Show explicit "copied: description (may differ), 3 attachments, 2 comments, 0 sub-tasks (not copied)" summary |
| Copy operation has no progress feedback | For tickets with many attachments, app appears frozen | Progress bar with step labels: "Copying description... Uploading attachments (2/5)..." |
| Ignore list is not reviewable in-flow | User accidentally ignores a ticket; has no way to recover it | Dedicated "Ignored" view accessible at all times; undo for recent ignores |
| Connection test only on save, not on open | Saved credentials expire; user discovers on first fetch attempt | Test connection on app startup; show connection status in UI persistently |
| No distinction between "no new tickets" and "fetch failed" | User doesn't know if they're up to date or if something went wrong | Explicit "last fetched: X minutes ago (success)" vs "last fetch: failed — [reason]" |
| Custom fields silently dropped | User doesn't know Sprint, Story Points, Epic Link weren't copied | Explicit "fields not copied" section in copy result — show what was dropped |
| Notification fires for tickets user has already reviewed | Noise; erodes trust | Only notify for changes that occurred after the user last viewed the ticket; track "last viewed" per ticket |
| Diff view shows "no changes" for comment-only updates | User misses new comments on watched tickets | Diff view must show comment and worklog deltas, not only field changes from changelog |
| Poll status invisible when background polling runs | User doesn't know if polling is active; can't tell if it's stuck | Status indicator in UI: "polling every 5 min — last checked 2 min ago" |
| Notification permission denied state is invisible | User thinks notifications are on; actually all blocked at OS level | Check `isPermissionGranted()` on each app launch; show persistent warning if denied |

---

## "Looks Done But Isn't" Checklist

- [ ] **Ticket copy**: Often missing sub-task copy — verify sub-tasks appear in destination with correct parent
- [ ] **Ticket copy**: Often missing attachment binary content (metadata copies, content doesn't) — verify file downloads from destination
- [ ] **Description copy**: Often stored as raw ADF or Wiki Markup — verify rendered view in destination Jira shows formatted content, not raw markup
- [ ] **Comment copy**: Often copies author as the PAT holder's account, not the original author — verify author attribution in destination
- [ ] **Connection wizard**: Often passes with valid PAT but fails on first real fetch due to missing permissions — verify PAT has Browse Projects + Create Issues permissions
- [ ] **Credential storage**: Often stored in keychain but leaked in audit log — grep audit log for Bearer/Basic strings after a test run
- [ ] **Pagination**: Often returns first 50 results only — verify with a mock returning 51 tickets that all 51 appear in the list
- [ ] **Ignored tickets**: Often "ignored" state is lost on restart — verify ignored list persists across app restarts
- [ ] **Mock server**: Often only implements happy path — verify error cases (401, 404, 429 rate limit, 500) are handled gracefully in UI
- [ ] **OS notifications (macOS)**: Often skips permission check — verify `isPermissionGranted()` is called before first send; verify denied state shows warning in UI
- [ ] **Background polling**: Often implemented in React frontend — verify poll loop is in Rust and continues when window is minimized
- [ ] **Poll watermark**: Often lost on restart — verify watermark is persisted in SQLite and resumed correctly after app close/crash
- [ ] **Change diff — comments**: Often shows "no changes" when only a comment was added — verify comment delta appears in diff view
- [ ] **Notification batching**: Often sends one notification per changed ticket — verify poll of 5 changed tickets produces 1 batched notification, not 5
- [ ] **Email domain watch**: Often assumes `emailAddress` is returned by Jira Cloud user API — verify feature works when email is hidden (privacy settings)
- [ ] **Rate limiting**: Often no 429 handling — verify mock 429 response triggers backoff and does not advance watermark

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Merged Cloud/Server client needing split | HIGH | Define JiraClient trait, create two impl files, migrate callsites one by one; ~2 days for moderate codebase |
| ADF/markup conversion not implemented | MEDIUM | Add conversion layer; hardest part is tables and macros; can ship "plain text only" as interim with user notice |
| Credentials found in audit log | HIGH | Rotate all PATs immediately; audit log files must be considered compromised; redesign log sanitization before re-shipping |
| Mock server too simplistic, real API fails | MEDIUM | Capture real API responses (sanitized), replace hand-written fixtures; add contract tests; 1-3 days |
| Pagination missing, users reporting missing tickets | LOW | Add pagination loop to fetch functions; straightforward code change; 1-2 hours |
| Attachment content not transferred | MEDIUM | Add content-download step to copy workflow; test with various attachment types; 1 day |
| Polling implemented in React, stops when minimized | HIGH | Rewrite poll loop as Rust spawned task; update frontend to be event-listener only; 1-2 days; test on all platforms |
| Watermark in Zustand, missed changes after crash | MEDIUM | Add SQLite watermark table; migrate existing in-memory watermark; straightforward schema addition; 4-8 hours |
| User blocked notifications at OS level | HIGH | Cannot be fixed by the app; user must manually re-enable in OS notification settings; prevent by defaulting to low-frequency digest notifications |
| Diff view misses comments/worklogs | MEDIUM | Add comment and worklog delta fetches to diff computation; 1 day; retroactive enhancement |
| Email domain watch doesn't work on Cloud | LOW | Add UX copy explaining limitation; switch to manual user selection with domain as search hint; 4-8 hours |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cloud/Server API treated as identical | Foundation — API client design | Two separate adapter impls exist; no shared response types cross boundary |
| ADF vs Wiki Markup conversion | Core copy workflow | Round-trip test: copy ticket with table and code block; verify rendered in destination |
| Credential leakage in logs | Foundation — credential architecture | Grep audit log output for `Bearer`/`Basic` strings; CI check |
| Mock server drift | Testing infrastructure (before features) | Contract test suite documents coverage; fixtures are captured not hand-written |
| Attachment content not transferred | Core copy workflow — attachments sub-feature | Copy a ticket with 3 attachments; verify binary content downloadable from destination |
| Pagination truncating results | Ticket fetch phase | Test with mock returning 51 tickets; verify all 51 in list |
| Tauri IPC leaking internal errors | Foundation — error handling architecture | Assert frontend error messages contain no URLs or account IDs |
| Copy fidelity not communicated | Core copy UI | Copy result shows per-field status; no silent drops |
| Notification permission not requested | Background polling / notification phase (first task) | macOS test: fresh app install → first notification → permission dialog appears; denial → warning shown in UI |
| Notification click doesn't unminimize | Notification integration phase | Check current plugin CHANGELOG for click action support before scoping; use tray icon as alternative |
| Background poll stops when minimized | Background polling architecture phase | Run app minimized for 10 minutes; verify poll events arrive on un-minimize |
| Poll watermark drift | Change detection / polling phase | Test: poll fails → watermark unchanged → next poll covers full gap |
| Rate limiting not handled | Background polling architecture phase | Mock returns 429 → verify backoff → verify watermark not advanced |
| Changelog misses comments/worklogs | Change diff view phase | Test: comment added → diff view shows comment delta; no changelog items test |
| Email domain selector unreliable on Cloud | Watch configuration phase | Test with mock user where `emailAddress` is absent; verify fallback UX works |
| Notification spam → OS blocking | Notification preferences phase | Poll with 5 changed tickets → verify 1 batched notification; verify per-ticket dedup |
| Stale Zustand diff state | Change tracking architecture phase | Restart app → open diff view → no false positives for unchanged tickets |
| Notification payload leaks sensitive data | Notification integration phase | Verify notification body contains only ticket key and change type, not field values |

---

## Sources

- Atlassian REST API documentation (v2 Server, v3 Cloud) — well-established differences, HIGH confidence
- Atlassian ADF schema documentation — HIGH confidence for format differences
- Known Tauri security architecture (Rust backend isolation, IPC serialization) — MEDIUM confidence for specific pitfall patterns
- Community patterns for Jira integration projects — MEDIUM confidence; based on training knowledge and verified search results
- `zeroize` crate for credential memory safety — MEDIUM confidence, standard Rust practice for secrets
- Jira PAT authentication mechanism differences (Cloud Bearer vs Server Basic) — HIGH confidence, documented by Atlassian
- [Tauri Notification Plugin v2 — Official Docs](https://v2.tauri.app/plugin/notification/) — permission requirements, Windows dev behavior, platform limitations — HIGH confidence
- [Tauri GitHub Issue #8644 — notification click does not unminimize](https://github.com/tauri-apps/tauri/issues/8644) — confirmed bug, MEDIUM confidence
- [Tauri GitHub Issue #12834 — set_focus regression on macOS 2.3+](https://github.com/tauri-apps/tauri/issues/12834) — MEDIUM confidence
- [Tauri GitHub Issue #5250 — background throttling](https://github.com/tauri-apps/tauri/issues/5250) — webview timer throttling, MEDIUM confidence
- [Tauri Discussion #2684 — tray icon for persistent background app](https://github.com/tauri-apps/tauri/discussions/2684) — MEDIUM confidence
- [Jira Cloud Rate Limiting — Official Atlassian Docs](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/) — points model, burst limits, exponential backoff — HIGH confidence
- [Jira Server JQL timestamp/timezone mismatch — Atlassian Support](https://support.atlassian.com/jira/kb/jiras-timestamp-doesnt-match-the-system-time/) — HIGH confidence
- [JQL date/time search issues — Atlassian Developer Community](https://community.developer.atlassian.com/t/jql-on-search-with-updated-date-time-does-not-work-correctly/58754) — MEDIUM confidence
- [Atlassian "Domain of reporter" JQL deprecation — October 2021](https://confluence.atlassian.com/jirakb/workaround-to-search-issue-domain-of-reporter-using-automation-and-insight-1095239385.html) — HIGH confidence
- [Jira Cloud user email privacy API limitation](https://community.developer.atlassian.com/t/api-to-get-user-exactly-by-email/93265) — MEDIUM confidence
- [Push Notifications Statistics 2025 — Business of Apps](https://www.businessofapps.com/marketplace/push-notifications/research/push-notifications-statistics/) — 62% spam perception stat — MEDIUM confidence
- [Zustand stale closures — Official Discussion #784](https://github.com/pmndrs/zustand/discussions/784) — MEDIUM confidence
- Jira changelog API limitations (comments/worklogs not in history items) — MEDIUM confidence from community reports and Atlassian support articles

---
*Pitfalls research for: Pmkar — cross-instance Jira desktop app (Tauri + Cloud + Server) — v0.3.0 Notifications & Change Tracking milestone*
*Researched: 2026-03-27*
