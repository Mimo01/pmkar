# Project Research Summary

**Project:** Pmkar — cross-instance Jira ticket management desktop app
**Domain:** Tauri desktop app with dual Jira REST API integration (Cloud v3 + Server v2)
**Researched:** 2026-03-19
**Confidence:** MEDIUM

## Executive Summary

Pmkar is a single-user desktop application that bridges two Jira instances: a customer-hosted Jira Server and an internal Jira Cloud. The tool enables a human-in-the-loop review workflow — fetch candidate tickets from the customer instance, review them one by one, then copy approved tickets with full content fidelity (attachments, comments, sub-tasks) into the company's Jira Cloud, with a complete audit trail of every API call. This product occupies a unique niche: unlike marketplace sync tools (Exalate, Backbone Issue Sync), it requires no Jira admin access on either side, performs no automatic background sync, and keeps the human reviewer in control. These are design constraints, not limitations.

The recommended implementation is Tauri 2.x (Rust backend + React/TypeScript frontend) with all HTTP calls, credentials, and audit logging confined to the Rust layer. The OS keychain (via the `keyring` crate) is the only approved storage for PATs. A mock Jira server — simulating both the Server v2 and Cloud v3 API shapes — must be built from day one because no real test credentials are available. This mock-first approach is not optional; it is the primary development environment. The two Jira API variants must be treated as two separate adapters behind a shared interface, not as a single client with branching conditionals.

The primary risks are: (1) ADF vs Wiki Markup content translation between API versions causing silent data loss in descriptions and comments; (2) credential leakage through log output despite OS keychain storage; (3) mock server drift producing tests that pass but real integrations that fail; and (4) the temptation to defer the mock server and adapter split until "later" — both must be Phase 1 infrastructure. All seven critical pitfalls identified in research have clear prevention strategies that must be built into the foundation, not retrofitted.

---

## Key Findings

### Recommended Stack

The Tauri 2.x / React 18 / TypeScript 5 stack is the correct choice for this project's security requirements. Tauri's architecture enforces the credential boundary by design: the Rust backend owns secrets and HTTP clients, while the WebView frontend handles only presentation. This makes the "no credentials in the frontend" requirement architectural rather than a policy that developers must remember to follow. The main alternative (Electron) would require disciplined convention to achieve the same security boundary — a weaker guarantee.

On the Rust side, `reqwest` handles all HTTP to both Jira instances, `keyring` wraps the OS keychain, `tracing` + `tracing-subscriber` provide structured audit logging, and `rusqlite`/`sqlx` manages the persistent state (triage history, ignore list). On the frontend, TanStack Query treats Tauri `invoke()` calls as async query functions, handling caching and background refetch cleanly across the two Jira connections.

**Core technologies:**
- Tauri 2.x: Desktop shell + Rust backend — enforces credential isolation by architecture
- React 18 + TypeScript 5: Frontend UI — large ecosystem, official Tauri templates, strict typing catches IPC shape mismatches
- Rust / reqwest: All HTTP calls — PATs never leave the Rust process
- keyring crate: OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service) — only approved PAT storage
- TanStack Query 5.x: Async state management for invoke() calls — handles dual-connection caching via query keys
- SQLite (rusqlite/sqlx): Persistent triage state — ticket queue, ignore list, copy history
- tracing + tracing-subscriber: Structured audit logging — satisfies hard audit requirement
- axum (mock-server feature): Mock Jira server for both API shapes — required from day one

**What NOT to use:**
- `tauri-plugin-http` (JS-side HTTP): routes responses through the WebView, violating the credential boundary
- `tauri-plugin-store` for credentials: writes plaintext JSON to disk
- `localStorage` or any browser storage for credentials: same plaintext problem
- Any direct `fetch()` from the frontend to Jira: requires passing PATs to JS

### Expected Features

The product has a clear v1 scope and a clean v1.x / v2+ deferral list. The core workflow is linear: setup connections → fetch candidates → review individually → copy or ignore → audit trail throughout. Every feature maps onto this flow. The competitor analysis confirms that admin-free setup, human-in-the-loop review, and full audit logging are genuine differentiators that no existing marketplace tool offers.

**Must have (table stakes):**
- Dual connection setup (Cloud + Server) with OS keychain credential storage — nothing works without this
- Connection validation on save — prevents silent auth failures
- Candidate ticket fetch via JQL (assignee + watched users) with full issue expand — core data pipeline
- Full issue detail view (description, comments, attachments list, sub-tasks, linked issues, work log) — must see everything before acting
- Copy to company Jira: summary, description, metadata, attachments (binary), comments (with attribution) — the primary action
- Origin tracking: remote link back to source ticket — stated requirement, enables traceability
- Ignore action + reviewable ignored list + persistent triage state — triage workflow without this is incomplete
- Audit log of all REST calls — stated hard requirement from day one
- Mock Jira server (Cloud v3 + Server v2 shapes) — development blocker with no real PATs available

**Should have (competitive):**
- Work log copy with attribution — same pattern as comment copy, add after comment copy is stable
- Sub-task hierarchy copy — two-pass creation (parent first, then children referencing parent key)
- Configurable JQL filter — power user control over fetch scope
- Diff view before copy — reduces accidental copies, adds user confidence
- Watched users configuration UI — start with config file, add UI when list grows

**Defer (v2+):**
- Excel export — explicitly deferred in project requirements, scope TBD
- Linked issue reference copy — lower value; broken keys are confusing without full cross-instance resolution
- Re-copy / update existing copy — requires matching logic between source and existing target issue

### Architecture Approach

The architecture is a two-layer Tauri application: a React WebView layer that handles all user interaction via `invoke()` calls, and a Rust Core layer that owns credentials, HTTP clients, the SQLite state store, and the audit logger. The IPC boundary is the security perimeter — nothing crosses it except typed results and sanitized errors. All shared Rust resources (DB connection, audit logger, Jira clients) are registered as Tauri managed state (`tauri::State<T>`) to avoid hidden globals. Tauri commands are kept thin (5 lines: extract args, call a service, return result); all business logic lives in plain Rust service modules that are independently testable without a Tauri runtime.

**Major components:**
1. Credential Manager (`credentials/`) — keyring wrapper; store/load/delete PATs by profile key; never exposes PATs to frontend
2. Jira Client pair (`jira/cloud.rs` + `jira/server.rs`) — two separate adapters behind a `JiraClient` trait; Cloud uses ADF, Server uses wiki markup/plain text; no shared response types cross the adapter boundary
3. State Manager (`state/db.rs`) — SQLite migrations on startup; ticket queue, ignore list, copy history, watched users
4. Audit Logger (`audit/`) — append-only JSONL file in app data dir; Authorization header values always redacted; passed as managed state so any command can write to it
5. Mock Jira Server (`mock/`, feature-gated) — axum HTTP server responding to both Cloud v3 and Server v2 endpoint shapes; seeded from fixture JSON; compiled into debug builds only
6. Frontend UI (`src/pages/`) — Setup wizard, Review (candidate list + detail panel), Ignored list; communicates exclusively via typed `invoke()` wrappers in `lib/tauri.ts`

### Critical Pitfalls

1. **Cloud and Server APIs treated as identical** — Build two separate adapter implementations behind a shared `JiraClient` trait from the start. Never use a single client with `if is_cloud` branching; the conditionals multiply to every callsite. Recovery after the fact costs ~2 days.

2. **ADF vs Wiki Markup causing silent content loss** — The description/comment format mismatch between Cloud (ADF JSON) and Server (Wiki Markup string) is the most common "copy looks successful but data is wrong" failure. Plan an explicit translation step in the copy flow. Use `renderedFields` (returns HTML) from Server as a more portable source. Test with tickets containing tables, code blocks, @mentions, and numbered lists — these are the highest-failure content types.

3. **Credential leakage through log output** — The audit log requirement creates a direct conflict with credential security. Implement a `RedactedString` type for credentials (Debug/Display both output `[REDACTED]`), a `SanitizedRequest` log struct that strips the Authorization header value, and a CI check that greps audit output for `Bearer`/`Basic` strings. This must be built before any HTTP client code is written.

4. **Mock server drift** — Tests pass against a hand-crafted mock; real API fails on fields the mock omitted. Build the mock from the Atlassian OpenAPI spec, use captured real-API fixtures (sanitized) rather than hand-written JSON, and add contract tests that document parity coverage. Real Jira issues return 50+ fields; a mock returning 10 fields is a trap.

5. **Attachment content not transferred (only metadata)** — Attachment download URLs are not public; they require authenticated re-fetching. Test explicitly that binary content downloads, not just that metadata returned 200. The mock must have content-download endpoints returning actual bytes. Report "copied N attachments (M failed)" rather than silently omitting failures.

6. **Pagination truncation silently missing tickets** — The Jira search API returns 50 results by default. Always paginate until `startAt + issues.length >= total`. Include a test case in the mock where `total > maxResults`. Surface total count in the UI.

7. **Tauri IPC leaking internal error details** — Define a `FrontendError` enum with user-facing variants only. Internal errors (including Jira API error bodies, URLs, account IDs) are logged at Rust level and never forwarded to the frontend.

---

## Implications for Roadmap

Based on the dependency chain in FEATURES.md and the build order in ARCHITECTURE.md, and the phase warnings in PITFALLS.md, the following phase structure is recommended:

### Phase 1: Foundation — Credentials, Mock Server, and Error Architecture

**Rationale:** Every other phase depends on credentials working and the mock server existing. The security architecture (RedactedString, FrontendError, log sanitization) must be in place before any HTTP client code is written — retrofitting it is costly and leaves a window where credentials could appear in logs. The mock server is not a testing nicety; it is the primary development environment given no real PATs are available.

**Delivers:** A working Tauri shell with: OS keychain read/write for two PAT profiles, a running mock Jira server responding to both Cloud v3 and Server v2 endpoints with realistic fixture data, and the error-handling architecture (FrontendError enum, RedactedString type, audit log sanitization) established as infrastructure.

**Addresses (from FEATURES.md):** Credential storage (OS keychain), connection validation foundation, mock Jira server (development blocker), audit log infrastructure

**Avoids (from PITFALLS.md):** Credential leakage in logs (must be built first), IPC error leakage (error architecture upfront), mock server drift (build from spec, not to make tests pass)

### Phase 2: Connection Setup and Validation

**Rationale:** Connection config is the gateway to all API features. Users cannot fetch tickets without working connections. This phase builds the Setup Wizard UI and the first real `invoke()` command that calls a Jira API endpoint (`GET /myself` for validation).

**Delivers:** Setup Wizard (React, React Hook Form + Zod validation), save-credentials command (writes to OS keychain via Phase 1 credential manager), test-connection command (calls `/rest/api/2/myself` or `/rest/api/3/myself` via the mock), persistent connection-status indicator in UI.

**Uses (from STACK.md):** React Hook Form 7.x, Zod 3.x, TanStack Query for connection status, `@tauri-apps/api` invoke(), Tauri managed state

**Avoids (from PITFALLS.md):** PAT passed to frontend (credentials stay in Rust), IPC error exposure (FrontendError variants: `ConnectionFailed`, `AuthFailed`)

### Phase 3: Ticket Fetch and Candidate Review

**Rationale:** This is the core read path — the UI that users will spend most of their time in. Must be built before the copy workflow because the copy payload is constructed from fetched issue data. Pagination and the two separate Jira adapters must be established here.

**Delivers:** Two separate Jira client implementations (`jira::cloud`, `jira::server`) behind a `JiraClient` trait; `fetch_candidates` command with full JQL execution, pagination, and filtering of already-copied/ignored tickets; Full issue detail view (description, comments, attachments list, sub-tasks, linked issues, work log); Ticket list with sort/filter using TanStack Table; SQLite schema for triage state (candidate queue, ignore list).

**Uses (from STACK.md):** reqwest, serde/serde_json, TanStack Query, TanStack Table, Zustand, SQLite/rusqlite

**Avoids (from PITFALLS.md):** Single client with branching (two separate adapter modules from the start), pagination truncation (paginate all list endpoints; test with >50 results), ADF vs Wiki Markup in display (use `renderedFields` for rendering in detail view)

### Phase 4: Copy Workflow — Core Fields

**Rationale:** The primary action. Depends on Phase 3 for the full ticket payload. This phase implements flat copy only (summary, description, metadata, origin tracking) — no attachments, comments, or sub-tasks yet — to validate the end-to-end copy pipeline before adding the more complex sub-features.

**Delivers:** `copy_ticket` command with field mapping (Server → Cloud schema), description translation (wiki markup/HTML → ADF), `jira::cloud::create_issue` implementation, origin tracking (remote link from destination ticket back to source), SQLite copy_history record, copy result returned to frontend with per-field status.

**Avoids (from PITFALLS.md):** ADF content loss (explicit translation step, test with tables/code blocks/mentions), silent custom field drops (show "fields not copied" section in copy result), copy fidelity UX (show explicit per-field copy status, not just success/fail)

### Phase 5: Copy Workflow — Attachments and Comments

**Rationale:** Adds content fidelity to the copy workflow. Attachments are a stated deal-breaker for ticket usefulness; comments preserve discussion context. Both are required for the v1 scope. Separated from Phase 4 to allow Phase 4 to validate the basic copy pipeline first.

**Delivers:** `jira::server::download_attachment` (authenticated binary download, streaming to avoid memory buffering), `jira::cloud::upload_attachment` (multipart POST), comment copy with attribution prefix ("Mirrored from [Customer]: Originally by [Author] on [Date]:"), progress reporting to frontend during copy (step labels: "Uploading attachments 2/5..."), partial failure reporting ("copied with 3 attachments, 1 failed").

**Avoids (from PITFALLS.md):** Attachment metadata without content (test binary content download explicitly; mock must have content endpoints), sequential attachment downloads (parallelize with bounded concurrency 3-5), comment author appearing as PAT holder (attribution prefix explicitly names original author)

### Phase 6: Ignore Workflow and Triage Persistence

**Rationale:** The ignore workflow completes the review loop. Triage state persistence prevents re-reviewing tickets across sessions — a core usability requirement. These features are lower risk than the copy workflow and can be built in parallel with Phase 5 if capacity allows.

**Delivers:** `ignore_ticket` command writing to SQLite `ignored_tickets` table, Ignored List view with un-ignore capability, session-persistent triage state (seen/ignored/copied per ticket key), connection-status check on app startup (not just on save), "last fetched" status indicator showing success/failure clearly.

**Avoids (from PITFALLS.md):** Ignore state lost on restart (SQLite-backed, not in-memory), no distinction between "no new tickets" and "fetch failed" (explicit last-fetch status in UI), ignore list not reviewable (dedicated Ignored view accessible at all times)

### Phase 7: v1.x Enhancements

**Rationale:** Post-launch additions that add depth to the core workflow. Work log copy and sub-task hierarchy follow the same patterns established in Phase 5 but add complexity (two-pass sub-task creation). These are explicitly P2 in the feature matrix.

**Delivers:** Work log copy with attribution (same pattern as comment copy), sub-task hierarchy copy (two-pass: create parent, then create each sub-task with `fields.parent` set to destination key), configurable JQL filter UI with validation, diff view before copy (show what will be created before committing), watched users configuration UI.

**Avoids (from PITFALLS.md):** Sub-task copy with wrong parent key (two-pass creation is explicit; parent key comes from the Phase 4 create_issue response, not the source key)

### Phase Ordering Rationale

- Phases 1-2 are strictly gated: no API work is possible until credentials exist and the mock server runs. This is both an architecture dependency and a security requirement.
- Phase 3 establishes the adapter split (`jira::cloud` + `jira::server`). All later phases build on this — it cannot be deferred.
- Phase 4 validates the end-to-end copy pipeline with flat fields before adding the complexity of binary transfer (Phase 5). A working flat copy is shippable for early feedback.
- Phase 5 attachments + comments are both P1 for v1 launch but separated from Phase 4 to isolate risk. Phase 4 can be validated independently.
- Phase 6 (ignore workflow) has no technical dependency on Phases 4-5 — it can be built in parallel by a second developer or interleaved with Phase 5.
- Phase 7 items are explicitly v1.x — they extend the copy workflow after the core is validated.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 (Mock Server):** ADF schema for fixture construction needs verification against current Atlassian OpenAPI spec. The axum-based mock design should be reviewed for completeness against both API surfaces before build begins.
- **Phase 4 (Description Translation):** Wiki Markup to ADF conversion has no official library. The translation approach (using `renderedFields` HTML as the source, wrapping in ADF paragraph nodes) needs a prototype to validate before committing to it as the production path.
- **Phase 5 (Attachment Download, Server):** Self-hosted Jira Server attachment authentication (PAT vs cookie-based depending on configuration) cannot be fully validated without a real Server instance. The mock should cover both models but real-world behavior needs early customer verification.

Phases with standard patterns (skip research-phase):

- **Phase 2 (Connection Setup):** React Hook Form + Zod + Tauri invoke() is a well-documented pattern with official Tauri examples.
- **Phase 3 (Ticket Fetch):** Jira search JQL and issue expand are stable, well-documented APIs. TanStack Query + Tauri invoke() integration is a known pattern.
- **Phase 6 (Ignore Workflow):** SQLite-backed state with rusqlite is standard Rust; no novel patterns required.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Tauri 2.x, React 18, TanStack Query 5, Zustand 4, Vite 5 are well-established stable releases (HIGH). Specific Tauri 2.x minor version, tauri-plugin-store 2.x API, keyring 2.x cross-platform behavior require verification before implementation (brings overall to MEDIUM). |
| Features | MEDIUM | Jira REST API v2/v3 surface area is HIGH confidence (stable, documented for years). Competitor feature comparisons (Exalate, Backbone, Issue Sync) are MEDIUM (may have changed since training data). |
| Architecture | HIGH | Tauri IPC and managed state patterns, keyring crate cross-platform behavior, Jira Server v2 vs Cloud v3 API differences, ADF format — all HIGH from training data. ts-rs for TS type generation from Rust is MEDIUM (version compatibility should be verified). |
| Pitfalls | HIGH | Core API differences (ADF vs Wiki Markup, accountId vs username, attachment auth) are HIGH confidence from Atlassian documentation. Tauri-specific security pitfalls are MEDIUM. Community frequency of specific mistakes is MEDIUM (pattern-based, not empirically verified). |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Jira Server attachment download auth model:** Self-hosted Server instances may use cookie-based auth for attachment content downloads rather than PAT headers, depending on server configuration. Cannot verify without a real Server instance. Mitigation: build the mock to cover both models; seek early customer confirmation of their server's auth configuration before Phase 5.

- **Wiki Markup to ADF conversion fidelity:** No official conversion library exists. The `renderedFields` approach (HTML as intermediate) has unknown edge case coverage for macros, embedded images, and Jira-specific markup. A conversion prototype should be built early in Phase 4 planning to identify failure cases before committing to the approach.

- **Custom field mapping across instances:** Custom field IDs (`customfield_10014`) are instance-specific. The same logical field (e.g., Story Points, Sprint, Epic Link) will have different IDs on source vs destination. The v1 approach (copy standard fields; append custom fields as structured text in description) is an acceptable MVP decision but should be communicated explicitly to users via the "fields not copied" section in copy results.

- **Tauri 2.x current minor version and plugin API stability:** All version recommendations are based on training data through August 2025. Verify current minor versions at https://github.com/tauri-apps/tauri/releases and https://tauri.app/plugin/store/ before pinning in Cargo.toml and package.json.

- **Linux keychain dependency:** The `keyring` crate requires `libsecret-1-dev` on Linux. Linux build instructions must document this; CI for Linux must provision it.

---

## Sources

### Primary (HIGH confidence)
- Atlassian REST API v2 documentation (Jira Server/DC) — training knowledge, stable API surface
- Atlassian REST API v3 documentation (Jira Cloud) — training knowledge, stable API surface
- Atlassian Document Format (ADF) specification — format differences, field requirements
- Jira PAT authentication mechanism (Cloud Bearer vs Server Basic) — documented by Atlassian
- Tauri v2 architecture: IPC, managed state, command patterns — stable release Oct 2024

### Secondary (MEDIUM confidence)
- Training data: Tauri 2.x + React/TypeScript ecosystem versions — verify current minor versions before implementation
- Training data: `keyring` Rust crate cross-platform behavior — verify at https://crates.io/crates/keyring
- Training data: `httpmock` / `axum` for mock server — verify at https://crates.io
- Training data: Atlassian Marketplace competitor feature sets (Exalate, Backbone Issue Sync, Issue Sync for Jira) — may have changed

### Tertiary (needs validation)
- Wiki Markup to ADF conversion approach (renderedFields HTML as intermediate) — prototype required to validate fidelity
- Jira Server attachment content download behavior with PAT auth on self-hosted instances — requires real Server instance for verification

---

*Research completed: 2026-03-19*
*Ready for roadmap: yes*
