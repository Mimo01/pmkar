# Architecture Research

**Domain:** Tauri desktop app — dual Jira integration with credential management and audit logging
**Researched:** 2026-03-19
**Confidence:** MEDIUM (Tauri v2 patterns: HIGH from training data; Jira API differences: HIGH; mock server wiring: MEDIUM — no live docs verification possible)

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                        WebView Layer (Frontend)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Setup Wizard │  │ Ticket Review│  │   Ignored / History List  │  │
│  │  (connection  │  │  (candidate  │  │   (reviewable ignored     │  │
│  │   config)     │  │   tickets)   │  │    tickets + audit log)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                 │
│         └─────────────────┴────────────────────────┘                │
│                           │ invoke() / emit()                        │
│                      Tauri IPC Bridge                                │
├───────────────────────────┼────────────────────────────────────────┤
│                        Rust Core Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Credential  │  │  Jira Client │  │     Audit Logger          │  │
│  │  Manager     │  │  (customer + │  │  (append-only JSONL file) │  │
│  │  (keychain)  │  │   company)   │  │                           │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────────────┘  │
│                           │                                          │
│               ┌───────────┴────────────┐                            │
│               │    State Manager        │                            │
│               │  (ticket queue,        │                            │
│               │   ignore list,         │                            │
│               │   copy history)        │                            │
│               └───────────┬────────────┘                            │
│                           │                                          │
│         ┌─────────────────┼─────────────────┐                       │
│         ▼                 ▼                 ▼                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │  OS Keychain│  │  SQLite DB   │  │  Log File               │    │
│  │  (PATs)     │  │  (state,     │  │  (audit.jsonl)          │    │
│  │             │  │   history)   │  │                         │    │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘    │
├───────────────────────────┬────────────────────────────────────────┤
│                    External Services                                  │
│  ┌──────────────────────┐ │ ┌──────────────────────────────────┐    │
│  │  Customer Jira        │ │ │  Company Jira Cloud              │    │
│  │  (self-hosted,        │ │ │  (REST API v3, PAT via           │    │
│  │   Server REST API)    │ │ │   Authorization header)          │    │
│  └──────────────────────┘ │ └──────────────────────────────────┘    │
│                            │                                          │
│              OR (dev mode) │                                          │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │              Mock Jira Server (axum or wiremock-rs)         │     │
│  │    Responds to both Server and Cloud API surface areas      │     │
│  └────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| WebView / Frontend | All user interaction: setup wizard, ticket review UI, ignore list | React or Svelte compiled to static assets served by Tauri |
| Tauri IPC Bridge | Typed boundary between JS and Rust via `invoke()` (commands) and `emit()` (events) | `#[tauri::command]` Rust macros; `@tauri-apps/api` on JS side |
| Credential Manager | Read/write PATs to OS keychain; never expose to frontend | `keyring` crate (wraps macOS Keychain, Windows Credential Manager, Linux Secret Service) |
| Jira Client | HTTP requests to both Jira instances; handles Server vs Cloud API differences; attachment downloads | `reqwest` async HTTP client; two typed clients, one per Jira variant |
| Audit Logger | Append structured JSON lines for every outbound request and response | Custom Rust struct; writes to app data dir via `tauri::api::path::app_log_dir` |
| State Manager | Ticket queue (fetched, pending review), ignore list, copy history with origin links | SQLite via `rusqlite` or `sqlx`; persisted to app data dir |
| Mock Jira Server | Simulates both Jira Cloud and Server REST endpoints; usable in dev and CI without real PATs | `axum` HTTP server launched in a separate thread or process; seeded from fixture JSON files |
| OS Keychain | Secure PAT storage; platform-native | macOS Keychain / Windows Credential Manager / Linux Secret Service (via `keyring` crate) |
| SQLite DB | Ticket state, ignore list, copy history, watched users config | Single file in app data directory |
| Log File | Immutable audit trail of every API call | JSONL append-only file; one line per request/response pair |

## Recommended Project Structure

```
pmkar/
├── src-tauri/                   # Rust backend (Tauri core)
│   ├── src/
│   │   ├── main.rs              # Tauri app builder, command registration
│   │   ├── commands/            # Tauri IPC command handlers (thin — delegate to services)
│   │   │   ├── auth.rs          # save_credentials, test_connection
│   │   │   ├── tickets.rs       # fetch_candidates, copy_ticket, ignore_ticket
│   │   │   └── audit.rs         # get_audit_log, export_log
│   │   ├── jira/                # Jira API clients
│   │   │   ├── mod.rs
│   │   │   ├── client.rs        # Shared reqwest client setup, PAT auth header
│   │   │   ├── cloud.rs         # Jira Cloud REST API v3 calls
│   │   │   ├── server.rs        # Jira Server REST API calls (older endpoints)
│   │   │   └── types.rs         # Shared response types (Issue, Comment, Attachment…)
│   │   ├── credentials/
│   │   │   └── mod.rs           # keyring wrapper — store/load/delete PATs by profile key
│   │   ├── state/
│   │   │   ├── mod.rs
│   │   │   ├── db.rs            # SQLite init, migrations, queries
│   │   │   └── models.rs        # Ticket, IgnoredTicket, CopyRecord, WatchedUser structs
│   │   ├── audit/
│   │   │   └── mod.rs           # AuditLogger — append JSONL, expose read for UI
│   │   └── mock/                # Dev-only mock server
│   │       ├── mod.rs
│   │       ├── server.rs        # axum router for mock Jira endpoints
│   │       └── fixtures/        # JSON files with sample ticket data
│   └── Cargo.toml
├── src/                         # Frontend (TypeScript + React or Svelte)
│   ├── main.ts                  # App entry point
│   ├── pages/
│   │   ├── Setup.tsx            # Connection wizard
│   │   ├── Review.tsx           # Candidate ticket list + detail panel
│   │   └── Ignored.tsx          # Ignored ticket list
│   ├── components/
│   │   ├── TicketCard.tsx       # Ticket summary row
│   │   ├── TicketDetail.tsx     # Full ticket view (comments, attachments, history)
│   │   └── AuditPanel.tsx       # Log viewer
│   ├── lib/
│   │   ├── tauri.ts             # Typed wrappers around invoke() calls
│   │   └── types.ts             # Shared TS types mirroring Rust models
│   └── store/                   # Frontend state (Zustand or Svelte stores)
│       └── tickets.ts
└── tests/
    └── integration/             # Tests against mock server
```

### Structure Rationale

- **commands/:** Tauri IPC handlers are kept thin — they validate inputs and delegate to service modules. This keeps commands testable without Tauri runtime.
- **jira/cloud.rs vs jira/server.rs:** Jira Server (self-hosted) and Jira Cloud REST APIs differ at the endpoint and auth level. Separating them avoids conditional spaghetti throughout the codebase.
- **mock/:** Gated behind a Cargo feature flag (`mock-server`). Ships in debug builds, stripped from release. Lives in `src-tauri` so the mock speaks the same types as the real client.
- **audit/:** Isolated module. Audit logger is passed as Tauri managed state so any command can write to it without global state.
- **state/db.rs:** SQLite migrations are embedded as versioned SQL strings. Ensures the DB schema is always current on first launch and on upgrades.

## Architectural Patterns

### Pattern 1: Thin Commands, Fat Services

**What:** Tauri `#[tauri::command]` functions are kept to ~5 lines: extract args, call a service, return result. All logic lives in plain Rust service modules.

**When to use:** Always. Commands are hard to unit test because they require Tauri app context. Services (jira::cloud, state::db, audit) are plain Rust and trivially testable.

**Trade-offs:** Small amount of boilerplate. Worth it — the alternative (fat commands) makes testing impossible and mixes concerns.

**Example:**
```rust
#[tauri::command]
async fn copy_ticket(
    ticket_id: String,
    state: tauri::State<'_, AppState>,
    audit: tauri::State<'_, AuditLogger>,
) -> Result<CopyRecord, String> {
    tickets::copy_ticket(&ticket_id, &state, &audit)
        .await
        .map_err(|e| e.to_string())
}
```

### Pattern 2: Tauri Managed State for Shared Resources

**What:** Pass shared resources (DB connection pool, audit logger, HTTP clients) through `tauri::State<T>` rather than thread-local globals or `Arc<Mutex<T>>` scattered across modules.

**When to use:** Any resource needed by multiple commands: DB, audit logger, Jira clients, credential cache.

**Trade-offs:** State must be `Send + Sync`. Forces clean ownership model. Avoids hidden globals.

**Example:**
```rust
// In main.rs builder
tauri::Builder::default()
    .manage(AppState::new(db_pool))
    .manage(AuditLogger::new(log_path))
    .manage(JiraClients::new())
    .invoke_handler(tauri::generate_handler![
        commands::auth::save_credentials,
        commands::tickets::fetch_candidates,
        commands::tickets::copy_ticket,
    ])
```

### Pattern 3: Feature-Gated Mock Server

**What:** The mock Jira server is compiled and started only when the `mock-server` Cargo feature is enabled. In release builds it is absent entirely.

**When to use:** From day one — the project has no real PATs for development. The mock server is not a test-only concern; it is the primary development environment.

**Trade-offs:** Adds an axum dependency and fixture JSON to the dev build. Acceptable — this is a dev tool, not shipped to end users.

**Example (Cargo.toml):**
```toml
[features]
default = []
mock-server = ["axum", "tokio/full"]

[dependencies]
axum = { version = "0.7", optional = true }
```

### Pattern 4: Typed IPC Contract (Rust ↔ TypeScript)

**What:** Rust structs that cross the IPC boundary are `#[derive(Serialize, Deserialize)]`. The TypeScript side defines mirrored interfaces. Consider `ts-rs` crate to generate TypeScript types from Rust structs at build time.

**When to use:** For every type that appears in a Tauri command signature.

**Trade-offs:** `ts-rs` adds a build step. Without it, type drift between Rust and TypeScript is a persistent bug source. Worth the setup cost.

## Data Flow

### Flow 1: Credential Setup

```
User enters PAT in Setup Wizard (Frontend)
    │ invoke("save_credentials", { profile, token })
    ▼
commands::auth::save_credentials (Rust)
    │
    ├─→ credentials::store(profile, token)  →  OS Keychain (write)
    │
    └─→ AuditLogger::write({ action: "credential_saved", profile })
    │
    ▼
Return Ok(()) → Frontend shows "Connected"
```

### Flow 2: Ticket Fetch (Candidate Discovery)

```
User clicks "Fetch Tickets" (Frontend)
    │ invoke("fetch_candidates")
    ▼
commands::tickets::fetch_candidates (Rust)
    │
    ├─→ credentials::load("customer") → OS Keychain (read)
    ├─→ jira::server::search_assigned(token, watched_users)
    │       │  HTTP GET /rest/api/2/search?jql=...
    │       └─→ AuditLogger::write({ req, resp })
    │
    ├─→ state::db::get_ignored_ids()  →  SQLite (read)
    │
    ├─→ Filter: exclude already-copied and ignored tickets
    │
    └─→ Return Vec<Ticket> → Frontend renders ticket list
```

### Flow 3: Copy Ticket to Company Jira

```
User clicks "Copy" on a ticket (Frontend)
    │ invoke("copy_ticket", { ticket_id })
    ▼
commands::tickets::copy_ticket (Rust)
    │
    ├─→ credentials::load("customer") + credentials::load("company") → OS Keychain
    │
    ├─→ jira::server::get_ticket_full(ticket_id)
    │       └─→ AuditLogger::write (source fetch)
    │
    ├─→ jira::cloud::create_issue(mapped_fields)
    │       └─→ AuditLogger::write (create)
    │
    ├─→ jira::cloud::add_comments(new_issue_id, comments)
    │       └─→ AuditLogger::write (per comment)
    │
    ├─→ jira::cloud::upload_attachments(new_issue_id, attachments)
    │       └─→ AuditLogger::write (per attachment)
    │
    ├─→ state::db::record_copy(ticket_id, new_issue_id, source_url)
    │
    └─→ Return CopyRecord → Frontend marks ticket as copied
```

### Flow 4: Ignore Ticket

```
User clicks "Ignore" (Frontend)
    │ invoke("ignore_ticket", { ticket_id })
    ▼
commands::tickets::ignore_ticket (Rust)
    ├─→ state::db::insert_ignored(ticket_id, timestamp)
    └─→ Return Ok(()) → Frontend removes from candidate list
```

### Key State Transitions

```
Ticket discovered (in candidate queue)
    ├─→ [Ignore] → ignored_tickets table (reviewable, removable)
    └─→ [Copy]   → copy_history table (immutable, with source_url)

Tickets not acted on: remain in next fetch (re-queried each session)
```

## Jira API Compatibility Layer

The two Jira instances speak different REST APIs. This is a first-class architectural concern.

| Concern | Jira Server (self-hosted) | Jira Cloud |
|---------|--------------------------|------------|
| Base path | `/rest/api/2/` | `/rest/api/3/` |
| Auth header | `Authorization: Bearer <PAT>` | `Authorization: Bearer <PAT>` (same) |
| Issue body format | Plain text or wiki markup | Atlassian Document Format (ADF) JSON |
| Attachments | `/rest/api/2/issue/{id}/attachments` | `/rest/api/3/issue/{id}/attachments` |
| User lookup | Username-based | AccountId-based |
| Pagination | `startAt` + `maxResults` | Same, but Cloud also supports cursor |

**Implication for build order:** The description field transformation (wiki markup → ADF or plain text → ADF) is a non-trivial mapping. Plan a dedicated translation step inside the copy flow, not an afterthought.

## Scaling Considerations

This is a single-user desktop app. Traditional "scale" concerns do not apply. Relevant performance considerations:

| Concern | Approach |
|---------|----------|
| Attachment downloads (large files) | Stream to disk via reqwest streaming response; do not buffer in memory |
| Many comments on one ticket | Paginate comment fetches; don't assume all comments fit in one response |
| Slow self-hosted Jira | Add per-request timeout config (e.g., 30s); surface timeout errors in UI |
| SQLite contention | Single writer guaranteed (Tauri app is single-process); no connection pool needed beyond one |
| Audit log growth | JSONL file grows unboundedly; provide UI to view + export but do not auto-truncate (audit requirement) |

## Anti-Patterns

### Anti-Pattern 1: Making HTTP Calls from the Frontend

**What people do:** Use JavaScript `fetch()` to call Jira directly from the WebView, storing PATs in frontend state or localStorage.

**Why it's wrong:** PATs are exposed in the renderer process, which is a less trusted sandbox. Breaks the security model — credentials must live in Rust/OS keychain only. Also bypasses the audit logger.

**Do this instead:** All HTTP calls go through Rust commands. Frontend invokes a command, Rust loads credentials from keychain, makes the call, logs it, and returns the result.

### Anti-Pattern 2: Storing PATs in App Config Files

**What people do:** Write PATs to `~/.config/pmkar/config.json` or Tauri's built-in config store.

**Why it's wrong:** Plaintext credentials on disk, readable by any process with user permissions. PROJECT.md explicitly prohibits this.

**Do this instead:** `keyring` crate — one call per PAT, platform-native secure storage.

### Anti-Pattern 3: Fat Tauri Commands

**What people do:** Put business logic (fetching, mapping, deduplication, copy orchestration) directly inside `#[tauri::command]` functions.

**Why it's wrong:** Commands cannot be unit tested without spinning up a Tauri app context. Complex commands become untestable monoliths.

**Do this instead:** Commands call service functions that take plain Rust types. Services are unit tested directly. Commands are integration-tested against the mock server.

### Anti-Pattern 4: Single Jira Client for Both API Versions

**What people do:** Write one HTTP client with `if server { v2 } else { v3 }` branches everywhere.

**Why it's wrong:** The API differences (especially ADF vs markup for descriptions, accountId vs username for users) are pervasive. Branching accumulates throughout the codebase.

**Do this instead:** Two separate client modules (`jira::server`, `jira::cloud`) behind a shared `JiraClient` trait. The copy orchestration calls the trait, not the concrete type.

### Anti-Pattern 5: Skipping the Mock Server Until "Later"

**What people do:** Defer mock server implementation, plan to add real credentials "soon" for testing.

**Why it's wrong:** PROJECT.md states no test PATs are available. Without a mock, development stalls every time a new API feature is needed. The mock server needs to be built alongside (or before) the real client.

**Do this instead:** Build the mock server in Phase 1 alongside credential scaffolding. Every Jira client call gets a corresponding mock endpoint from the start.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Customer Jira (self-hosted) | `reqwest` async GET/POST, PAT in `Authorization: Bearer` header | REST API v2; may be older Jira version with subset of endpoints |
| Company Jira (cloud) | `reqwest` async GET/POST, PAT in `Authorization: Bearer` header | REST API v3; requires ADF for description/comment bodies |
| OS Keychain | `keyring` crate synchronous calls | Must be called from a blocking context or `spawn_blocking`; not async |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Rust Core | Tauri IPC (`invoke` / `emit`) | Serialized JSON; define types with `ts-rs` to avoid drift |
| Rust Commands ↔ Jira Client | Direct function calls (async) | Pass audit logger reference so all calls are logged |
| Rust Commands ↔ Credential Manager | Direct function calls (sync, via `spawn_blocking`) | Keychain calls are blocking; do not call on async executor directly |
| Rust Commands ↔ SQLite | `rusqlite` or `sqlx` synchronous queries | Single file in `app_data_dir()`; migrations on startup |
| Jira Client ↔ Mock Server | HTTP (localhost) — identical to production path | Mock starts on a known port; client URL is configurable |

## Suggested Build Order

Dependencies between components determine phase ordering:

```
1. Credential Manager + OS Keychain wiring
   └─→ Required by: everything (no API call is possible without credentials)

2. Mock Jira Server (both API surfaces)
   └─→ Required by: Jira client development (no real PATs available)

3. Jira Server Client (customer — read-only: search, get issue, fetch attachments)
   └─→ Required by: ticket fetch flow

4. State / SQLite layer (ticket queue, ignore list, copy history)
   └─→ Required by: candidate filtering, copy recording

5. Audit Logger
   └─→ Required by: all Jira client calls (must wrap from first real call)

6. Copy orchestration (Jira Cloud client — write: create issue, comments, attachments)
   └─→ Requires: items 1-5 all in place

7. Frontend UI (Setup Wizard → Review → Ignore list)
   └─→ Requires: Rust command layer stable enough to call

8. Excel export
   └─→ Deferred (PROJECT.md scope TBD)
```

## Sources

- Tauri v2 architecture: training data (Tauri stable release Oct 2024) — HIGH confidence for IPC and managed state patterns
- `keyring` crate cross-platform keychain: training data — HIGH confidence (stable, widely used in Tauri apps)
- Jira Server REST API v2 vs Cloud REST API v3 differences: training data — HIGH confidence (stable, documented for years)
- Atlassian Document Format (ADF): training data — HIGH confidence (Jira Cloud requirement, stable)
- `axum` for mock server: training data — HIGH confidence (idiomatic Rust HTTP, commonly used in Tauri dev tooling)
- `ts-rs` for TypeScript type generation from Rust: training data — MEDIUM confidence (popular but version compatibility should be verified)

---
*Architecture research for: Tauri desktop app, dual Jira integration (self-hosted Server + Cloud)*
*Researched: 2026-03-19*
