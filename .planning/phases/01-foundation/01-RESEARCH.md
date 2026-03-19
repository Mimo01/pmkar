# Phase 1: Foundation - Research

**Researched:** 2026-03-20
**Domain:** Tauri 2 desktop scaffold, OS keychain (keyring-rs), embedded axum mock server, reqwest-middleware audit logging, SQLite persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- React with TypeScript for the Tauri frontend
- Tailwind CSS for styling (utility-first, no component library initially)
- Zustand for state management (lightweight, works well with Tauri IPC)
- npm as package manager (available on system, no extra tooling needed)
- Mock Jira server embedded in the Rust backend (actix-web or axum), starts with the app in dev mode
- Separate ports: Server v2 on :8080, Cloud v3 on :8081 — mirrors real-world two-host setup
- Full read-write from the start — includes create/update/upload endpoints, not just read
- Realistic fixture data: 10-15 tickets with varied fields, comments, attachment metadata, sub-tasks, and linked issues
- Standard Tauri layout: src-tauri/ for Rust, src/ for React frontend
- Rust backend: module-per-concern (keychain.rs, mock_server.rs, audit.rs, jira_client.rs, commands.rs)
- Frontend: feature-based organization (src/features/connections/, src/features/tickets/, etc.) with shared UI in src/components/ui/
- SQLite database for structured, queryable audit log storage
- Standard entry fields: timestamp, HTTP method, URL, status code, request headers (redacted), response status, response body (truncated at 10KB)
- Logs persist across app sessions with manual "clear logs" option
- Credential redaction at the HTTP client layer — Authorization headers replaced with [REDACTED] before the log entry is created, credentials never touch the audit system

### Claude's Discretion
- Specific Tauri version and plugin choices
- Vite configuration details
- SQLite schema design for audit logs
- Mock server framework choice (actix-web vs axum)
- Error boundary implementation pattern
- Test framework selection (Rust and frontend)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Mock Jira server simulates Jira Server v2 API responses | Axum router on :8080, fixture data module, Server v2 endpoint shapes documented |
| TEST-02 | Mock Jira server simulates Jira Cloud v3 API responses | Axum router on :8081, ADF JSON structure documented, Cloud v3 endpoint shapes documented |
| TEST-03 | App can run fully against mock server without real PATs | App config/environment flag to point HTTP client at localhost, keychain stores mock tokens |
| CONN-03 | User credentials stored in OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service) | keyring 3.6.x crate with platform-native backends; API: Entry::new, set_password, get_password, delete_credential |
| AUDIT-01 | All REST API calls logged with timestamp, method, URL, status code, and response | reqwest-middleware 0.5.x custom middleware writes to SQLite via rusqlite 0.39.x |
| AUDIT-03 | Audit log redacts credentials and sensitive auth headers | Middleware strips Authorization header before creating log entry; credentials never reach audit system |
</phase_requirements>

---

## Summary

This phase establishes everything the remaining six phases build on: a working Tauri 2 desktop shell, a security-first credential store, a fully mocked Jira API layer, and an audit system that guarantees credentials never appear in logs. All six requirements are achievable with well-maintained, production-quality Rust crates and the standard Tauri 2 ecosystem.

The mock server decision (axum over actix-web) is recommended based on ecosystem momentum and better ergonomics for state sharing across the two mock server instances and the Tauri command layer. The two servers share one axum application state behind Arc<Mutex<T>>, which is also the pattern Tauri 2 uses for managed state, giving a uniform model throughout the Rust backend.

The most important architectural insight: credential redaction must happen as a reqwest-middleware layer, not in the logging call site. This guarantees that even if a future developer adds a new log location, the redaction is already done before the data leaves the middleware. Credentials enter the keychain crate and never appear in any log, IPC payload, or serialized struct.

**Primary recommendation:** Use Tauri 2.10, axum 0.8, keyring 3.6, reqwest-middleware 0.5, rusqlite 0.39, Vitest 4, tokio 1.50 as the exact locked versions. Scaffold with `npm create tauri-app@latest`, select React + TypeScript.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tauri-apps/cli | 2.10.1 | Tauri build toolchain | Official CLI, current stable |
| @tauri-apps/api | 2.10.1 | Frontend IPC bindings | Official API package |
| tauri (Rust) | 2.10.3 | Desktop shell runtime | Official Tauri crate |
| axum | 0.8.8 | Embedded mock HTTP server | Tokio-native, excellent ergonomics, strong ecosystem momentum over actix-web for this use case |
| keyring | 3.6.3 | OS keychain read/write | Cross-platform, 6M+ downloads, supports macOS/Win/Linux natively |
| rusqlite | 0.39.0 | SQLite for audit log | Ergonomic synchronous SQLite wrapper, no async complexity needed for log writes |
| reqwest | (via tauri-plugin-http) | HTTP client for Jira API | Standard async HTTP, integrates with reqwest-middleware |
| reqwest-middleware | 0.5.1 | Middleware chain on HTTP client | Enables clean separation of logging, redaction, retry logic |
| tokio | 1.50.0 | Async runtime (Rust) | Required for axum; already a Tauri transitive dependency |
| serde / serde_json | 1.0.228 / 1.0.149 | JSON serialization | Required for IPC, fixture data, API response parsing |

### Frontend
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | Locked decision |
| TypeScript | 5.x | Type safety | Locked decision |
| Vite | 8.0.1 | Build/dev server | Official Tauri React scaffold uses Vite |
| Tailwind CSS | 4.2.2 | Styling | Locked decision |
| Zustand | 5.0.12 | Frontend state management | Locked decision |
| Vitest | 4.1.0 | Unit test runner | Official Tauri mock support targets Vitest |
| @testing-library/react | 16.3.2 | Component testing utilities | Standard React testing partner for Vitest |

### Supporting Rust Crates
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| async-trait | latest | Async trait definitions | Required by reqwest-middleware Middleware trait |
| chrono | latest | Timestamps for audit log | UTC timestamps with serde serialization |
| uuid | latest | Unique IDs for fixtures | Fixture ticket IDs, log entry IDs |
| tracing | latest | Structured logging | Tauri apps use tracing; helps during development |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| axum | actix-web | actix-web is mature but heavier; axum integrates better with the tokio/tower ecosystem Tauri already depends on. Use axum. |
| rusqlite | sqlx | sqlx adds compile-time query checking but requires async and a migration runner — unnecessary complexity for an append-only audit log. Use rusqlite. |
| keyring 3.6 | tauri-plugin-keyring (community) | tauri-plugin-keyring wraps keyring-rs but adds an IPC layer. Since credentials stay server-side (Rust only, never exposed over IPC), use keyring directly. |
| Vitest | Jest | Tauri's mockIPC uses @tauri-apps/api/mocks which is ESM-native; Vitest handles ESM without configuration overhead. Use Vitest. |

**Installation:**
```bash
# Frontend
npm create tauri-app@latest pmkar -- --template react-ts
cd pmkar
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitest/ui

# Rust - add to src-tauri/Cargo.toml
# axum = "0.8"
# keyring = { version = "3", features = ["apple-native", "windows-native", "linux-native-sync-persistent"] }
# rusqlite = { version = "0.39", features = ["bundled"] }
# reqwest-middleware = "0.5"
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
# tokio = { version = "1", features = ["full"] }
# chrono = { version = "0.4", features = ["serde"] }
# async-trait = "0.1"
```

**Version verification (confirmed 2026-03-20):**
- `@tauri-apps/cli`: 2.10.1 (npm registry)
- `@tauri-apps/api`: 2.10.1 (npm registry)
- `tauri` (Rust): 2.10.3 (crates.io)
- `axum`: 0.8.8 (crates.io)
- `keyring`: 3.6.3 (crates.io; note: 4.0.0-rc.3 exists but is pre-release — use 3.6.3)
- `rusqlite`: 0.39.0 (crates.io)
- `reqwest-middleware`: 0.5.1 (crates.io)
- `tokio`: 1.50.0 (crates.io)
- `vitest`: 4.1.0 (npm registry)
- `zustand`: 5.0.12 (npm registry)

---

## Architecture Patterns

### Recommended Project Structure
```
pmkar/
├── src/                          # React frontend
│   ├── features/
│   │   ├── connections/          # Phase 2: connection config UI
│   │   └── tickets/              # Phase 3+: ticket workflows
│   ├── components/
│   │   └── ui/                   # Shared presentational components
│   ├── store/                    # Zustand stores
│   ├── lib/                      # Utility functions, IPC wrappers
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Tauri builder, app setup, state registration
│   │   ├── commands.rs           # All #[tauri::command] functions
│   │   ├── keychain.rs           # keyring-rs wrapper: store/retrieve/delete PAT
│   │   ├── mock_server.rs        # Axum routers for :8080 (Server v2) and :8081 (Cloud v3)
│   │   ├── fixtures.rs           # Static fixture data (10-15 tickets, ADF descriptions)
│   │   ├── audit.rs              # SQLite schema, log entry writes, clear function
│   │   ├── jira_client.rs        # reqwest-middleware client with AuditMiddleware
│   │   └── error.rs              # Unified error type, IPC error serialization
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

### Pattern 1: Tauri State Registration
**What:** All Rust state (mock server handles, audit DB connection, keychain config) registered at startup via `app.manage()`
**When to use:** Any shared resource accessed across multiple Tauri commands

```rust
// Source: https://v2.tauri.app/develop/state-management/
use std::sync::Mutex;
use tauri::{Builder, Manager};

fn main() {
    Builder::default()
        .setup(|app| {
            app.manage(Mutex::new(AuditDb::open(&app.path().app_data_dir()?)?));
            app.manage(Mutex::new(MockServerState::default()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::store_credential,
            commands::get_credential,
            commands::delete_credential,
            commands::start_mock_servers,
            commands::get_audit_logs,
            commands::clear_audit_logs,
        ])
        .run(tauri::generate_context!())
        .unwrap();
}

// Accessing state in a command:
#[tauri::command]
fn get_credential(
    service: String,
    state: State<'_, Mutex<KeychainConfig>>,
) -> Result<String, String> {
    let entry = keyring::Entry::new(&service, "pmkar")
        .map_err(|e| e.to_string())?;
    entry.get_password().map_err(|e| e.to_string())
}
```

### Pattern 2: reqwest-middleware AuditMiddleware
**What:** Custom middleware that logs every outbound HTTP request/response to SQLite, with Authorization header replaced with [REDACTED] before the log entry is constructed
**When to use:** Every HTTP client that calls Jira (real or mock). Attach once, covers all calls.

```rust
// Source: https://docs.rs/reqwest-middleware/latest/reqwest_middleware/
use reqwest_middleware::{Middleware, Next, Result};
use reqwest::{Request, Response};
use task_local_extensions::Extensions;

pub struct AuditMiddleware {
    pub db: Arc<Mutex<AuditDb>>,
}

#[async_trait::async_trait]
impl Middleware for AuditMiddleware {
    async fn handle(
        &self,
        mut req: Request,
        extensions: &mut Extensions,
        next: Next<'_>,
    ) -> Result<Response> {
        let method = req.method().to_string();
        let url = req.url().to_string();
        let timestamp = chrono::Utc::now();

        // REDACT before any logging — credentials never appear below this line
        let headers_redacted = {
            let mut h = req.headers().clone();
            if h.contains_key("authorization") {
                h.insert("authorization", "[REDACTED]".parse().unwrap());
            }
            format!("{:?}", h)
        };

        let resp = next.run(req, extensions).await?;
        let status = resp.status().as_u16();

        // Write audit entry — Authorization is already [REDACTED]
        self.db.lock().unwrap().insert(AuditEntry {
            timestamp,
            method,
            url,
            headers: headers_redacted,
            status_code: status,
        });

        Ok(resp)
    }
}

// Build the audited client:
let client = reqwest_middleware::ClientBuilder::new(reqwest::Client::new())
    .with(AuditMiddleware { db: Arc::clone(&audit_db) })
    .build();
```

### Pattern 3: Axum Mock Server on Named Port
**What:** Two independent axum Router instances bound to :8080 and :8081, sharing fixture state via Arc
**When to use:** TEST-01 and TEST-02 — each server answers one Jira API dialect

```rust
// Server v2 (Jira Server) on :8080
let v2_router = Router::new()
    .route("/rest/api/2/issue/:key", get(handlers::v2::get_issue))
    .route("/rest/api/2/search", get(handlers::v2::search_issues))
    .route("/rest/api/2/issue", post(handlers::v2::create_issue))
    .with_state(Arc::clone(&fixtures));

// Cloud v3 on :8081
let v3_router = Router::new()
    .route("/rest/api/3/issue/:key", get(handlers::v3::get_issue))
    .route("/rest/api/3/search/jql", post(handlers::v3::search_issues))
    .route("/rest/api/3/issue", post(handlers::v3::create_issue))
    .with_state(Arc::clone(&fixtures));

// Spawn both as tokio tasks — Tauri's async runtime drives them
tokio::spawn(axum::serve(
    tokio::net::TcpListener::bind("127.0.0.1:8080").await?,
    v2_router,
));
tokio::spawn(axum::serve(
    tokio::net::TcpListener::bind("127.0.0.1:8081").await?,
    v3_router,
));
```

### Pattern 4: Vitest with Tauri IPC Mocking
**What:** jsdom environment with mockIPC intercepting Rust command calls
**When to use:** All frontend unit tests that call `invoke()`

```typescript
// Source: https://v2.tauri.app/develop/tests/mocking/
import { beforeAll, afterEach, describe, it, expect } from 'vitest';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { randomFillSync } from 'crypto';

beforeAll(() => {
  // jsdom lacks WebCrypto — polyfill required for Tauri mocks
  Object.defineProperty(window, 'crypto', {
    value: { getRandomValues: (buf: BufferSource) => randomFillSync(buf as any) },
  });
});

afterEach(() => clearMocks());

describe('credential store', () => {
  it('stores and retrieves a PAT', async () => {
    mockIPC((cmd, args) => {
      if (cmd === 'store_credential') return true;
      if (cmd === 'get_credential') return 'mock-token-value';
    });
    // test component logic here
  });
});
```

### Anti-Patterns to Avoid
- **Calling keyring from the frontend:** Credentials must never cross the IPC boundary. The frontend asks Rust to use a credential, never receives the raw value.
- **Logging before redaction:** Never log the request object or headers before stripping Authorization. The middleware is the only safe log point.
- **Using tauri-plugin-store for PATs:** The store plugin writes to a JSON file on disk — plaintext. Use keyring.
- **Sharing a single axum Router for both Jira API dialects:** They have different path prefixes, auth schemes, and response shapes. Two routers on two ports prevents path collision and correctly mirrors production topology.
- **Using `sqlx` for the audit log:** Async connection pool + migrations + compile-time query macros is over-engineered for an append-only log. Use rusqlite with the `bundled` feature (static link, no system SQLite version dependency).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS keychain CRUD | Custom keychain FFI per platform | `keyring` 3.6 | Handles macOS Security framework, WinCred, D-Bus Secret Service; 6M downloads; edge cases around keychain prompts and locked keychains are handled |
| HTTP middleware chain | Custom wrapper around reqwest::Client | `reqwest-middleware` 0.5 | Tower-compatible; correct ordering semantics; handles retry/logging composition without trait object gymnastics |
| JSON serialization | Custom serde implementations | `serde` + `serde_json` derive macros | Hand-rolled serialization breaks with field renames, optional fields, nested ADF structures |
| SQLite connection + schema | Raw sqlite3 FFI | `rusqlite` with `bundled` feature | Bundled feature statically links SQLite — no system version dependency, no deployment headaches on Windows |
| ADF document construction | String concatenation | Serde-serializable Rust structs | ADF structure has strict required fields (`version`, `type`, `content`); struct derive catches mistakes at compile time |
| Tauri IPC mocking in tests | Custom window.__TAURI__ shim | `@tauri-apps/api/mocks` `mockIPC` | Official mock handles the encryption handshake Tauri uses internally; hand-rolled shims break on Tauri updates |

**Key insight:** The two hardest problems in this phase are credential isolation and audit-log redaction. Both are solved architecturally (keyring never exposes over IPC; middleware redacts before log creation), not by testing after the fact.

---

## Common Pitfalls

### Pitfall 1: keyring Linux DBus Dependency
**What goes wrong:** The app builds and runs on macOS/Windows but crashes on Linux at first keychain access with a DBus connection error.
**Why it happens:** Linux Secret Service (Gnome Keyring / KWallet) requires DBus. On minimal CI images and some desktop environments, the DBus session bus is not running.
**How to avoid:** Use `linux-native-sync-persistent` feature flag. In CI, start a DBus session with `dbus-run-session` or install `gnome-keyring`. Document Linux runtime dependency in README.
**Warning signs:** `Error: No service or bus daemon` at runtime on Linux.

### Pitfall 2: Tauri Tokio Runtime Conflict with Axum
**What goes wrong:** Spawning axum servers from Tauri's setup closure panics with "Cannot start a runtime from within a Tauri context" or causes runtime shutdown on app exit.
**Why it happens:** Tauri uses its own internal tokio runtime. Calling `tokio::runtime::Runtime::new()` manually creates a nested runtime.
**How to avoid:** Spawn axum servers with `tauri::async_runtime::spawn()` (not `tokio::spawn()` directly in setup). This uses Tauri's managed runtime. Alternatively, access it via the `.setup()` async context.
**Warning signs:** Panic on app launch with runtime-related message, or servers that silently never start.

### Pitfall 3: IPC Credential Leak via Error Messages
**What goes wrong:** A Rust command returns a `Result<_, String>` where the error message includes the PAT (e.g., from a failed reqwest response that echoes the Authorization header in the error).
**Why it happens:** Default error Display implementations for reqwest errors can include request details.
**How to avoid:** Define a custom `AppError` enum that maps all external errors to sanitized messages before the `#[tauri::command]` boundary. Never pass a raw reqwest error string to the frontend.
**Warning signs:** Any `Err(format!("{}", e))` or `.map_err(|e| e.to_string())` on a reqwest error.

### Pitfall 4: Mock Server PAT Validation
**What goes wrong:** Mock server rejects requests with 401 because it tries to validate the Bearer token against a real Jira auth endpoint.
**Why it happens:** Over-engineering the mock to behave like real Jira auth.
**How to avoid:** Mock server should accept ANY non-empty Authorization header and return 401 only for missing/empty Authorization. The goal is realism of response shape, not real auth validation.
**Warning signs:** Tests failing with 401 when the mock server is running.

### Pitfall 5: ADF Required Version Field Missing
**What goes wrong:** Jira Cloud v3 API rejects fixture responses that are missing `"version": 1` in the ADF root node, causing downstream phases to fail when they parse descriptions.
**Why it happens:** ADF structures without the version field are invalid per the schema at http://go.atlassian.com/adf-json-schema.
**How to avoid:** Define a Rust struct `AdfDoc { version: u8, r#type: String, content: Vec<AdfNode> }` with `version: 1` defaulted. All fixtures go through this struct.
**Warning signs:** JSON description fields that are plain strings instead of `{"version":1,"type":"doc","content":[...]}`.

### Pitfall 6: keyring 4.x Pre-Release API Changes
**What goes wrong:** `cargo add keyring` pulls in 4.0.0-rc.3 (a pre-release), which has API differences from 3.6.x.
**Why it happens:** Cargo may resolve pre-release versions when using bare version constraints.
**How to avoid:** Pin explicitly to `keyring = "3.6"` in Cargo.toml. Do not use `keyring = "*"` or `keyring = "4"` until 4.0 is stable.
**Warning signs:** Compile errors on `Entry::new` signature after `cargo update`.

---

## Code Examples

Verified patterns from official sources:

### Jira Server v2 Issue Endpoint Shape
```json
// Source: https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/
// GET /rest/api/2/issue/PROJ-1
{
  "id": "10000",
  "key": "PROJ-1",
  "fields": {
    "summary": "Customer reported login failure",
    "status": { "name": "In Progress", "id": "3" },
    "priority": { "name": "High", "id": "2" },
    "assignee": { "name": "jdoe", "displayName": "Jane Doe" },
    "reporter": { "name": "csmith", "displayName": "Chris Smith" },
    "description": "Steps to reproduce:\n1. Navigate to login\n2. Enter valid credentials",
    "comment": {
      "comments": [
        {
          "id": "10001",
          "author": { "name": "jdoe", "displayName": "Jane Doe" },
          "body": "I can reproduce this on build 4.2.1",
          "created": "2026-01-15T10:30:00.000+0000"
        }
      ]
    },
    "attachment": [
      {
        "id": "10100",
        "filename": "screenshot.png",
        "size": 45231,
        "mimeType": "image/png",
        "content": "http://localhost:8080/secure/attachment/10100/screenshot.png"
      }
    ],
    "subtasks": [],
    "issuelinks": []
  }
}
```

### Jira Cloud v3 Issue Endpoint Shape (ADF description)
```json
// Source: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
// GET /rest/api/3/issue/PROJ-1
{
  "id": "10000",
  "key": "PROJ-1",
  "fields": {
    "summary": "Customer reported login failure",
    "status": { "name": "In Progress", "statusCategory": { "key": "indeterminate" } },
    "description": {
      "version": 1,
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Steps to reproduce..." }]
        }
      ]
    },
    "comment": {
      "comments": [
        {
          "id": "10001",
          "author": { "accountId": "5b10a2844c20165700ede21g", "displayName": "Jane Doe" },
          "body": {
            "version": 1,
            "type": "doc",
            "content": [
              { "type": "paragraph", "content": [{ "type": "text", "text": "I can reproduce this." }] }
            ]
          },
          "created": "2026-01-15T10:30:00.000+0000"
        }
      ]
    }
  }
}
```

### keyring Entry API
```rust
// Source: https://docs.rs/keyring/3.6.3/keyring/
use keyring::Entry;

// Store a PAT
let entry = Entry::new("pmkar-jira-server", "pmkar")?;
entry.set_password(&pat)?;

// Retrieve a PAT
let pat = entry.get_password()?;

// Delete (on disconnect)
entry.delete_credential()?;
```

### SQLite Audit Log Schema
```sql
-- Proposed schema for audit.rs to create on first run
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL,       -- ISO 8601 UTC: "2026-03-20T10:30:00Z"
    method      TEXT NOT NULL,       -- "GET", "POST", etc.
    url         TEXT NOT NULL,
    headers     TEXT NOT NULL,       -- JSON object, Authorization = "[REDACTED]"
    status_code INTEGER,             -- NULL if request never completed
    response_body TEXT,              -- Truncated at 10KB
    created_at  INTEGER DEFAULT (strftime('%s','now'))
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri Stronghold plugin | keyring crate directly | Tauri v2 (Stronghold deprecated, removed in v3) | Stronghold is the wrong tool for simple PAT storage — do not use it |
| tauri-plugin-store for secrets | keyring (OS-native) | Ongoing | Store writes plaintext JSON to disk — incorrect for credentials |
| actix-web for embedded servers | axum | 2022-2023 shift | axum is now the dominant Rust HTTP framework for new projects; better tokio integration |
| sqlx for all SQLite | rusqlite for simple use cases | Stable | sqlx macros and async add complexity not justified for an audit log |
| Jest for Tauri frontend tests | Vitest | Tauri v2 | Tauri's official mock library (@tauri-apps/api/mocks) is ESM-native; Vitest handles this without configuration |

**Deprecated/outdated:**
- Tauri Stronghold plugin: documented as deprecated, will be removed in v3. Do not use.
- `keytar` npm package (v7.9.0): was used for Electron keychain. Not applicable in Tauri — use Rust keyring crate directly.
- Jira v2 Cloud endpoints: Jira Cloud deprecated v2 in favor of v3. The app targets Cloud v3 and Server v2, which is correct.

---

## Open Questions

1. **ADF schema version for fixture validation**
   - What we know: ADF root node requires `"version": 1` and the JSON schema is at http://go.atlassian.com/adf-json-schema
   - What's unclear: Whether the schema has changed in 2025/2026 for newer Jira Cloud versions
   - Recommendation: Fetch the canonical ADF JSON schema during Wave 0 setup and include it in the repo for fixture validation. Do not assume the version stays at 1.

2. **Mock server in production build**
   - What we know: Mock server should start "in dev mode" per the locked decision
   - What's unclear: Exact mechanism — compile-time feature flag (`#[cfg(feature = "mock")]`) or runtime environment variable
   - Recommendation: Use a Cargo feature flag `mock-server` so the mock is compiled out of release builds. The planner should decide and lock this in.

3. **Linux CI environment for keyring tests**
   - What we know: Linux Secret Service requires a running DBus session
   - What's unclear: Whether the project will run CI on Linux and how to handle the keyring dependency there
   - Recommendation: Use `dbus-run-session` in CI configuration; mark keychain integration tests with `#[ignore]` on platforms where Secret Service is unavailable, with a documented workaround.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Rust framework | `cargo test` with `#[tokio::test]` for async |
| Frontend framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` — see Wave 0 |
| Quick run command (Rust) | `cargo test -p pmkar-lib -- --test-thread=1` |
| Quick run command (frontend) | `npx vitest run` |
| Full suite command | `cargo test && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Mock server responds to GET /rest/api/2/issue/:key with correct Server v2 JSON shape | Integration (Rust) | `cargo test test_mock_server_v2` | No — Wave 0 |
| TEST-02 | Mock server responds to GET /rest/api/3/issue/:key with ADF description in Cloud v3 shape | Integration (Rust) | `cargo test test_mock_server_v3` | No — Wave 0 |
| TEST-03 | App can call mock server with any non-empty Authorization, get valid fixture response | Integration (Rust) | `cargo test test_mock_accepts_token` | No — Wave 0 |
| CONN-03 | store_credential + get_credential round-trip stores and retrieves value from OS keychain | Unit (Rust) | `cargo test test_keychain_roundtrip` | No — Wave 0 |
| AUDIT-01 | AuditMiddleware writes a log entry to SQLite after each HTTP call | Unit (Rust) | `cargo test test_audit_log_entry` | No — Wave 0 |
| AUDIT-03 | AuditMiddleware log entry has Authorization = "[REDACTED]" | Unit (Rust) | `cargo test test_audit_redaction` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test && npx vitest run`
- **Per wave merge:** `cargo test && npx vitest run` (same — this phase has one wave)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/lib.rs` — library crate target so tests can import modules
- [ ] `src-tauri/tests/mock_server.rs` — integration tests for TEST-01, TEST-02, TEST-03
- [ ] `src-tauri/tests/keychain.rs` — integration tests for CONN-03
- [ ] `src-tauri/tests/audit.rs` — unit tests for AUDIT-01, AUDIT-03
- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `src/test-setup.ts` — WebCrypto polyfill for mockIPC

---

## Sources

### Primary (HIGH confidence)
- Context7 / [https://v2.tauri.app/develop/state-management/](https://v2.tauri.app/develop/state-management/) — Tauri 2 state management patterns verified
- [https://docs.rs/keyring/3.6.3/keyring/](https://docs.rs/keyring/3.6.3/keyring/) — keyring API, platform backends, Linux DBus dependency
- [https://docs.rs/reqwest-middleware/latest/reqwest_middleware/](https://docs.rs/reqwest-middleware/latest/reqwest_middleware/) — Middleware trait interface, ClientBuilder pattern
- [https://v2.tauri.app/develop/tests/mocking/](https://v2.tauri.app/develop/tests/mocking/) — Official Tauri IPC mocking with Vitest, mockIPC pattern
- [https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) — ADF structure, doc root node, paragraph/heading shapes
- [crates.io](https://crates.io) — Version verification for axum 0.8.8, rusqlite 0.39.0, keyring 3.6.3, reqwest-middleware 0.5.1, tokio 1.50.0 (verified 2026-03-20)
- [npm registry](https://registry.npmjs.org) — Version verification for @tauri-apps/cli 2.10.1, @tauri-apps/api 2.10.1, vitest 4.1.0, zustand 5.0.12 (verified 2026-03-20)

### Secondary (MEDIUM confidence)
- [https://v2.tauri.app/plugin/stronghold/](https://v2.tauri.app/plugin/stronghold/) — Stronghold deprecation note confirmed
- [https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/](https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/) — Jira Server v2 response shape examples
- [https://github.com/open-source-cooperative/keyring-rs](https://github.com/open-source-cooperative/keyring-rs) — Linux DBus dependency, platform feature flags
- [https://truelayer.com/blog/engineering/adding-middleware-support-to-rust-reqwest/](https://truelayer.com/blog/engineering/adding-middleware-support-to-rust-reqwest/) — reqwest-middleware design rationale (TrueLayer, the crate authors)

### Tertiary (LOW confidence — needs validation)
- ADF JSON schema version currency — only verified `"version": 1` is current as of 2026; schema URL http://go.atlassian.com/adf-json-schema should be fetched during Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry and crates.io on 2026-03-20
- Architecture: HIGH — patterns sourced from official Tauri v2 docs and crate docs
- Jira API shapes: MEDIUM — endpoint paths and field names from official Atlassian docs, but fixture completeness (sub-tasks, linked issues, work log) needs cross-check against live API schema
- ADF schema currency: LOW — version 1 confirmed, but latest schema file not fetched

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable libraries; Tauri 2 minor versions may advance but API is stable)
