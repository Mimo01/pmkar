# Phase 17: Field Discovery + Mock Schema Fidelity - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 11 (7 new/modified Rust + 4 new/modified TypeScript)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/field_mapping_db.rs` | rust-db-module | persistence | `src-tauri/src/snapshot_db.rs` | exact |
| `src-tauri/src/field_discovery.rs` | rust-module | ingress + egress | `src-tauri/src/jira_client.rs` | exact |
| `src-tauri/src/commands.rs` (extend) | rust-tauri-command | ingress + egress | `src-tauri/src/commands.rs:1063` (`search_jira_users`) | exact |
| `src-tauri/src/main.rs` (extend) | rust-module | persistence | `src-tauri/src/main.rs:128-171` (snapshot_db + poll_engine spawn blocks) | exact |
| `src-tauri/src/mock_server.rs` (extend) | rust-mock-server-route | ingress + egress | `src-tauri/src/mock_server.rs:802-861` (build_v2_router / build_v3_router) | exact |
| `src-tauri/src/fixtures.rs` (extend) | rust-fixtures | pure | `src-tauri/src/fixtures.rs:158-250` (helper fns + build_fixtures) | exact |
| `src-tauri/src/lib.rs` (extend) | rust-module | pure | `src-tauri/src/lib.rs` (existing `pub mod` declarations) | exact |
| `src/features/mapping/fields/types.ts` | ts-types | pure | `src/features/tickets/types.ts` | role-match |
| `src/features/connections/connectionStore.ts` (extend) | ts-zustand-store | egress | `src/features/connections/connectionStore.ts` (existing store) | exact |
| `src/features/connections/ProbeStatusBanner.tsx` | ts-react-component | egress | `src/features/tickets/TicketListPage.tsx:285-295` (truncation warning div) | role-match |
| `src/features/connections/__tests__/ProbeStatusBanner.test.tsx` | test-ts | pure | `src/features/tickets/__tests__/TicketListPage.truncationWarning.test.tsx` | role-match |

---

## Pattern Assignments

---

### `src-tauri/src/field_mapping_db.rs` (rust-db-module, persistence)

**Analog:** `src-tauri/src/snapshot_db.rs`

**Imports pattern** (`snapshot_db.rs` lines 1-5):
```rust
use crate::error::AppResult;
use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
```
Phase 17 replaces `OptionalExtension` with direct row reads and adds `use hex;`. The `sha2`/`hex` imports are identical.

**Struct + open lifecycle pattern** (`snapshot_db.rs` lines 46-77):
```rust
pub struct SnapshotDb {
    conn: Connection,
}

impl SnapshotDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        // Migrations: silently ignore duplicate column errors
        conn.execute("ALTER TABLE snapshot_store ADD COLUMN ...", []).ok();
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        Ok(Self { conn })
    }
```

**What to replicate:** The exact same two-method lifecycle (`open` + `open_in_memory`), the `CREATE TABLE IF NOT EXISTS` const pattern, and `.ok()` on `ALTER TABLE` calls. Name the struct `FieldMappingDb`.

**What is Phase-17-specific:** The DDL is the `field_schema_cache` table (from RESEARCH.md §field_schema_cache DDL). No `ALTER TABLE` migrations needed at Phase 17 creation — they will be added here by Phase 19. The hash computation method should be a private `fn compute_schema_hash(raw_json: &str) -> AppResult<String>` that hashes the raw bytes (not stripped) because D-04's hash tracks API drift, not content change.

**SHA-256 hash pattern** (`snapshot_db.rs` lines 298-306):
```rust
fn compute_hash(response_json: &str) -> AppResult<String> {
    let value: serde_json::Value = serde_json::from_str(response_json)?;
    let stripped = strip_volatile_fields(value);
    let canonical = serde_json::to_string(&stripped)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result))
}
```
Phase 17's `compute_schema_hash` skips the `strip_volatile_fields` step — hash the raw concatenated response JSON bytes directly (schema drift detection needs the real shape, not a stripped canonical form).

---

### `src-tauri/src/field_discovery.rs` (rust-module, ingress + egress)

**Analog:** `src-tauri/src/jira_client.rs`

**Imports + client construction pattern** (`jira_client.rs` lines 1-27):
```rust
use crate::audit::{build_audited_client, AuditDb};
use crate::error::{AppError, AppResult};
use std::sync::{Arc, Mutex};

pub struct JiraClient {
    pub client: reqwest_middleware::ClientWithMiddleware,
}

impl JiraClient {
    pub fn new(audit_db: Arc<Mutex<AuditDb>>) -> Self {
        Self {
            client: build_audited_client(audit_db),
        }
    }
}
```
Phase 17 does NOT define a new `FieldDiscoveryClient` struct — it mirrors `search_tickets` and `fetch_ticket_detail_raw` as standalone `pub async fn` functions, passing `&ClientWithMiddleware` directly (same convention as `jira_client.rs` functions that take the plain `reqwest::Client`).

**Pagination loop pattern** (`jira_client.rs` lines 55-103):
```rust
let mut all_issues: Vec<serde_json::Value> = Vec::new();
let mut start_at: u64 = 0;

loop {
    let url = format!(
        "{trimmed_url}/rest/api/2/search?jql={encoded_jql}&...&startAt={start_at}"
    );
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Poll: failed to fetch tickets".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Poll: Jira search returned status {}",
            resp.status().as_u16()
        )));
    }

    let body: serde_json::Value = resp.json().await
        .map_err(|_| AppError::Http("Poll: failed to parse search response".into()))?;

    let page_issues = body["issues"].as_array().cloned().unwrap_or_default();
    let total = body["total"].as_u64().unwrap_or(0);
    let page_len = page_issues.len() as u64;
    all_issues.extend(page_issues);

    if page_len == 0 || all_issues.len() as u64 >= total {
        break;
    }
    start_at += SEARCH_PAGE_SIZE;
}
```
Replicate exactly for `fetch_all_createmeta_fields`. Replace `body["issues"]` with `body["fields"]`, `SEARCH_PAGE_SIZE` with `PAGE_SIZE: u64 = 50`, and the error message format with the D-07 template: `"GET {url} returned {status}. Your proxy may not expose the paginated createmeta endpoint."`.

**Error format for D-07** — the error string must include the full constructed endpoint URL and HTTP status code (not request headers). Mirror the `AppError::Http(format!(...))` style used throughout `jira_client.rs`.

**What is Phase-17-specific:** This module also owns the `FieldSchemaType` and `FieldSchema` serde structs (RESEARCH.md §Pattern 3), the `discover_source_fields` function (global v2 `/field`), and the `probe_createmeta` logic. The `#[cfg(test)]` mod at the bottom must cover all serde roundtrip variants per RESEARCH.md §Validation Architecture test map.

---

### `src-tauri/src/commands.rs` (rust-tauri-command, ingress + egress — extend existing file)

**Analog:** `src-tauri/src/commands.rs:1062-1091` (`search_jira_users`)

**Tauri command signature pattern** (lines 1062-1091):
```rust
#[tauri::command]
pub async fn search_jira_users(
    base_url: String,
    query: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    // ... HTTP call ...
    Ok(users)
}
```
New commands follow the same signature shape: `State<'_, Arc<Mutex<T>>>` params, `Result<ReturnType, AppError>` return, credential extraction via existing helpers (`get_server_pat`, `get_cloud_credentials`).

**Paginated Cloud command pattern** (lines 1096-1139 `search_jira_users_by_domain`):
```rust
let (base_url, cloud_email, api_token) = get_cloud_credentials(triage_db.inner())?;
let cloud_auth = format!(
    "Basic {}",
    base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
);
```
The `probe_createmeta` and `get_target_field_schema_for_issuetype` commands use this same Cloud Basic-auth construction.

**What to replicate:** Command bodies delegate to `field_discovery.rs` functions — commands are thin glue. New commands are appended after the existing `search_jira_users_by_domain` block and registered in the `generate_handler!` list in `main.rs`.

**What is Phase-17-specific:** New commands receive `mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>` as an additional param for cache read/write. They also accept `triage_db` for reading the target project key (Pitfall C — must check `target_project_key` is not `None` before probing).

---

### `src-tauri/src/main.rs` (extend — rust-module, persistence + async)

**Analog:** `src-tauri/src/main.rs:128-171` (snapshot_db block + poll-engine spawn)

**Managed-state registration pattern** (lines 128-138):
```rust
let snapshot_db_path = app_dir.join("snapshots.db");
let snapshot_db =
    SnapshotDb::open(&snapshot_db_path).expect("Failed to open snapshot database");
app.manage(Arc::new(Mutex::new(snapshot_db)));
```
Phase 17 inserts an identical block immediately after the `snapshot_db` block:
```rust
let mapping_db_path = app_dir.join("mapping.db");
let mapping_db =
    FieldMappingDb::open(&mapping_db_path).expect("Failed to open mapping database");
app.manage(Arc::new(Mutex::new(mapping_db)));
```

**Pre-warm spawn pattern** (lines 160-171):
```rust
{
    let app_handle = app.handle().clone();
    let triage_state = Arc::clone(app.state::<Arc<Mutex<TriageDb>>>().inner());
    let snapshot_state = Arc::clone(app.state::<Arc<Mutex<SnapshotDb>>>().inner());

    tauri::async_runtime::spawn(pmkar_lib::poll_engine::run_poll_loop(
        poll_rx,
        app_handle,
        triage_state,
        snapshot_state,
    ));
}
```
The pre-warm background task uses the same `Arc::clone` of managed state before `spawn` (Pitfall E — never call `app.state()` from inside the spawned closure). The pre-warm block must appear AFTER `app.manage(Arc::new(Mutex::new(mapping_db)))` and `app.manage(Arc::new(Mutex::new(triage_db)))`.

**Command registration** (line 187-212):
```rust
.invoke_handler(tauri::generate_handler![
    ...
    commands::search_jira_users,
    commands::search_jira_users_by_domain,
    ...
])
```
Append new commands (`probe_createmeta`, `discover_source_fields`, `get_target_field_schema_for_issuetype`) to this list.

---

### `src-tauri/src/mock_server.rs` (extend — rust-mock-server-route, ingress + egress)

**Analog:** `src-tauri/src/mock_server.rs:802-861` (build_v2_router / build_v3_router)

**Route registration pattern** (lines 802-826 for v2, lines 828-861 for v3):
```rust
pub fn build_v2_router(fixtures: SharedFixtures) -> Router {
    Router::new()
        .route("/rest/api/2/myself", get(v2::get_myself))
        // ... existing routes ...
        .route("/rest/api/2/project", get(v2::get_projects))
        // ↑ NEW routes added here, before .layer(...)
        .layer(middleware::from_fn(require_auth))
        .with_state(fixtures)
}
```
New routes are inserted before `.layer(middleware::from_fn(require_auth))` in both routers. The handler function is in the corresponding `mod v2 { ... }` or `mod v3 { ... }` inner module at the bottom of the file.

**Stateless handler pattern** (lines 760-798, `get_priorities`, `get_statuses`):
```rust
pub async fn get_priorities() -> impl IntoResponse {
    Json(json!([
        { "id": "1", "name": "Highest", "iconUrl": "" },
        ...
    ]))
}
```
The new field and createmeta handlers are stateless (fixture data is constants from `fixtures.rs`). Handlers that need pagination params (startAt, maxResults) use the `Query<T>` extractor pattern shown on line 43-50 (`V3UserSearchQuery`).

**Path-param handler pattern** (lines 704-731 `add_comment`, `State` + `Path` + `Json`):
```rust
pub async fn get_createmeta_fields(
    State(fixtures): State<SharedFixtures>,
    Path((project_key, issuetype_id)): Path<(String, String)>,
    Query(params): Query<CreametaQuery>,
) -> impl IntoResponse {
    // look up fixture by (project_key, issuetype_id) ...
}
```
Tuple destructuring `Path<(String, String)>` for two-segment paths like `/createmeta/:project_key/issuetypes/:issuetype_id`.

**What is Phase-17-specific:** The new `mod v3` handlers for `get_fields`, `get_createmeta_issuetypes`, `get_createmeta_fields`, `get_project_versions`, `get_project_components` plus a `mod v2` handler for `get_fields`. The `get_createmeta_fields` handler for Bug (issuetype_id `"10001"`) must return `total: 7, maxResults: 5` on first page to exercise Pitfall F pagination test.

---

### `src-tauri/src/fixtures.rs` (extend — rust-fixtures, pure)

**Analog:** `src-tauri/src/fixtures.rs:149-250` (FixtureState struct + helper fns + build_fixtures)

**FixtureState struct pattern** (lines 149-156):
```rust
#[derive(Debug, Clone)]
pub struct FixtureState {
    pub server_v2_issues: HashMap<String, JiraIssue>,
    pub cloud_v3_issues: HashMap<String, JiraIssue>,
    pub next_issue_id: u32,
}

pub type SharedFixtures = Arc<Mutex<FixtureState>>;
```
Phase 17 extends `FixtureState` by adding new fields for the field/createmeta fixture data, e.g.:
```rust
pub v2_fields: Vec<serde_json::Value>,           // GET /rest/api/2/field
pub v3_fields: Vec<serde_json::Value>,           // GET /rest/api/3/field
pub v3_createmeta_issuetypes: serde_json::Value, // GET /createmeta/MYPROJ/issuetypes
pub v3_createmeta_fields: HashMap<String, Vec<serde_json::Value>>, // keyed by issuetype_id
pub v3_project_versions: Vec<serde_json::Value>,
pub v3_project_components: Vec<serde_json::Value>,
```

**Helper function pattern** (lines 158-205, `v2_user`, `v3_user`, `v2_status`, `priority`):
```rust
fn v2_user(name: &str, display_name: &str) -> serde_json::Value {
    json!({
        "name": name,
        "displayName": display_name,
        "avatarUrls": { ... }
    })
}
```
Define similar `fn createmeta_field(field_id, name, required, schema, allowed_values) -> serde_json::Value` helper for the field fixture data. This keeps `build_fixtures()` readable.

**build_fixtures pattern** (line 242 — `#[allow(clippy::too_many_lines)]`):
```rust
#[allow(clippy::too_many_lines)]
pub fn build_fixtures() -> SharedFixtures {
    // ... inline declarative fixture construction ...
}
```
Phase 17 extends `build_fixtures()` by populating the new `FixtureState` fields. The `#[allow(clippy::too_many_lines)]` attribute is already present — no change needed.

**What is Phase-17-specific:** D-12 shape divergences require that `v2_fields` and `v3_fields` show different shapes for the same logical fields (e.g. user identity). D-11 requires Bug issuetype data to span two pages (`total: 7, maxResults: 5`) in `v3_createmeta_fields["10001"]`. D-09/D-10 require all 6 custom field fixtures (10001-10006). D-12 divergences 2 and 3 require `v3_project_versions` IDs to differ from v2 version IDs (force real lookup), and priority write-shape to be `{ "id": "X" }` only.

---

### `src-tauri/src/lib.rs` (extend — rust-module, pure)

**Analog:** Existing `lib.rs` (inspect existing `pub mod` declarations for pattern)

**What to replicate:** Add `pub mod field_discovery;` and `pub mod field_mapping_db;` alongside the existing `pub mod` lines. No other changes.

---

### `src/features/mapping/fields/types.ts` (ts-types, pure)

**Analog:** `src/features/tickets/types.ts`

**Type file pattern** (inferred from codebase — hand-written discriminated unions with string-literal discriminants, no codegen):
```typescript
// src/features/tickets/types.ts pattern: plain exported interfaces and type unions
export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export interface JiraTicket {
  key: string;
  fields: { ... };
}
```
Phase 17's `types.ts` mirrors this: exported type unions and interfaces only, no runtime code. File lives at `src/features/mapping/fields/types.ts`.

**What to replicate:** Export pattern — each type is a named `export type` or `export interface`. Use camelCase property names (matching `serde(rename_all = "camelCase")` on the Rust side). Include `export type FieldSide = 'source' | 'target'` and the `FieldSchema` interface per RESEARCH.md §Pattern 4.

**What is Phase-17-specific:** The `FieldSchemaType` discriminated union with all 11 variants (`string`, `number`, `date`, `datetime`, `user`, `array`, `option`, `option-with-child`, `issuetype`, `priority`, `any`). The `array` variant carries an `items` property — mirror the Rust `Array { items: String }` shape.

---

### `src/features/connections/connectionStore.ts` (ts-zustand-store, egress — extend existing)

**Analog:** `src/features/connections/connectionStore.ts` (the file itself)

**Store slice pattern** (lines 1-74):
```typescript
import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { ConnectionMeta } from './types';

interface ConnectionState {
  serverConnection: ConnectionMeta | null;
  // ...
  loadProjectConfig: () => Promise<void>;
  saveProjectConfig: (...) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  // initial state
  serverConnection: null,
  // ...
  loadProjectConfig: async () => {
    try {
      const config = await invoke<...>('get_project_config');
      set({ ... });
    } catch {
      // Non-fatal: ...
    }
  },
}));
```
Phase 17 adds fields to the `ConnectionState` interface and corresponding initial values + action methods inline in the single `create<ConnectionState>` call.

**What to replicate:** The `invoke` + `set` async action pattern. New fields: `probeStatus: 'idle' | 'ok' | 'failed'`, `probeError: string | null`, `probeErrorEndpoint: string | null`. New actions: `setProbeStatus`, `dismissProbeBanner` (sets `probeBannerDismissed: boolean`), `runProbe: () => Promise<void>` (calls `invoke('probe_createmeta')`, sets status). The non-fatal `catch` pattern (don't throw, just `set` error state) is established on lines 58-61 and 69-73.

**What is Phase-17-specific:** `probeStatus` drives two UI surfaces (D-08) — banner and Settings pill. `probeBannerDismissed` is per-session (not persisted to SQLite). `runProbe` must only invoke if `targetProjectKey` is not null (Pitfall C — read from existing `get().targetProjectKey`).

---

### `src/features/connections/ProbeStatusBanner.tsx` (ts-react-component, egress)

**Analog:** `src/features/tickets/TicketListPage.tsx:285-295` (truncation warning inline div)

**Warning banner JSX pattern** (lines 285-295):
```tsx
{truncated && fetchStatus !== 'error' && (
  <div
    className="mx-4 mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3"
    role="alert"
    data-testid="truncation-warning"
  >
    <p className="text-sm text-yellow-400">{t('tickets.truncationWarning')}</p>
    <p className="text-xs text-brand-muted mt-1">{t('tickets.truncationWarningHint')}</p>
  </div>
)}
```

**Dismiss button pattern** — use the existing Lucide `X` icon (already imported in `SettingsPage.tsx` line 15) inside the banner alongside the alert text.

**What to replicate:** `role="alert"`, `data-testid`, two-line text (main message + hint/detail), brand color classes (`border-red-400/20 bg-red-400/5` for errors per line 300 of TicketListPage), `rounded-lg` container.

**What is Phase-17-specific:** This is a standalone exported component (not inlined in a parent) since it renders in two locations (app-shell and Settings). It reads from `useConnectionStore` — `probeStatus`, `probeError`, `probeBannerDismissed`, `dismissProbeBanner`. Shows red styling (D-08 = error condition, not warning). The banner body includes the exact endpoint URL + status code from `probeError` (D-07). Only shown when `probeStatus === 'failed' && !probeBannerDismissed`.

**Skeleton panel pattern** (`src/features/tickets/TicketCard.tsx:97-116`):
```tsx
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading tickets" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-brand-border">
          <Skeleton className="h-4 w-full mb-1" />
          ...
        </div>
      ))}
    </div>
  );
}
```
Phase 17 also ships a `TargetFieldsSkeleton` component (for D-03/D-16 skeleton state on the target-fields panel) using the same `<Skeleton>` primitive from `@/components/ui/skeleton` and `aria-busy` pattern.

---

### `src/features/connections/__tests__/ProbeStatusBanner.test.tsx` (test-ts, pure)

**Analog:** `src/features/tickets/__tests__/TicketListPage.truncationWarning.test.tsx`

**Frontend test pattern** (inferred from `TicketListPage.truncationWarning.test.tsx` — Vitest + React Testing Library):
```tsx
// Pattern: render component with mocked store state, assert element visibility
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
```

**What to replicate:** Mock `useConnectionStore` via `vi.mock`, render `<ProbeStatusBanner />`, assert the banner shows when `probeStatus === 'failed'`, assert it is absent when `probeStatus === 'ok'` or `probeBannerDismissed === true`, assert clicking dismiss calls `dismissProbeBanner`. Use `data-testid` from the component for targeting.

**What is Phase-17-specific:** The test must also assert the exact D-07 error message format (endpoint URL + status code) appears in the rendered banner when `probeError` is set.

---

## Shared Patterns

### Managed state registration (`Arc<Mutex<>>`)
**Source:** `src-tauri/src/main.rs:128-138`
**Apply to:** `main.rs` extension for `FieldMappingDb`
```rust
let mapping_db_path = app_dir.join("mapping.db");
let mapping_db = FieldMappingDb::open(&mapping_db_path)
    .expect("Failed to open mapping database");
app.manage(Arc::new(Mutex::new(mapping_db)));
```

### Tauri command state injection
**Source:** `src-tauri/src/commands.rs:1063-1091`
**Apply to:** All new Tauri commands in Phase 17
```rust
#[tauri::command]
pub async fn <command_name>(
    ...,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<ReturnType, AppError> { ... }
```

### Cloud Basic auth construction
**Source:** `src-tauri/src/commands.rs:1103-1113`
**Apply to:** `probe_createmeta`, `get_target_field_schema_for_issuetype` commands
```rust
let (base_url, cloud_email, api_token) = get_cloud_credentials(triage_db.inner())?;
let cloud_auth = format!(
    "Basic {}",
    base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
);
```

### SHA-256 hex hash
**Source:** `src-tauri/src/snapshot_db.rs:298-306`
**Apply to:** `field_mapping_db.rs` private `compute_schema_hash` fn
```rust
let mut hasher = Sha256::new();
hasher.update(raw_json_bytes);
let result = hasher.finalize();
Ok(hex::encode(result))
```
Phase 17 variation: hash raw bytes directly (no `strip_volatile_fields` — schema drift must detect all changes).

### Zustand async invoke action
**Source:** `src/features/connections/connectionStore.ts:44-73`
**Apply to:** `connectionStore.ts` extension — `runProbe` action
```typescript
someAction: async () => {
  try {
    const result = await invoke<ResultType>('tauri_command_name', { ...args });
    set({ field: result });
  } catch {
    // Non-fatal: set error state, don't throw
    set({ errorField: 'message' });
  }
},
```

### Mock route handler — stateless JSON
**Source:** `src-tauri/src/mock_server.rs:760-798`
**Apply to:** All new mock handlers for field/createmeta endpoints
```rust
pub async fn get_fields(State(fixtures): State<SharedFixtures>) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    Json(state.v3_fields.clone())
}
```

### Inline warning banner JSX
**Source:** `src/features/tickets/TicketListPage.tsx:285-295`
**Apply to:** `ProbeStatusBanner.tsx` outer container and error state
```tsx
<div
  className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3"
  role="alert"
  data-testid="probe-status-banner"
>
  <p className="text-sm text-red-400">{mainMessage}</p>
  <p className="text-xs text-brand-muted mt-1">{detailMessage}</p>
</div>
```

---

## No Analog Found

All Phase 17 files have direct analogs. No files require falling back to RESEARCH.md patterns exclusively.

---

## Key Anti-Patterns to Avoid

| Anti-Pattern | Analog that shows the right way | Note |
|---|---|---|
| Adding tables to `triage_db.rs` | `snapshot_db.rs` — separate file per concern | `mapping.db` is a new file |
| Calling `app.state()` inside spawn closure | `main.rs:160-171` — `Arc::clone` before spawn | Pitfall E |
| Returning empty `fields: []` on probe error | `jira_client.rs:67-70` — return `Err` on non-200 | Pitfall from RESEARCH.md |
| Sharing a parse function between v2 and v3 createmeta | Separate `mod v2` / `mod v3` in `mock_server.rs` | v2 returns object, v3 returns array |
| Firing pre-warm before `app.manage()` completes | `main.rs:128-171` — manage then spawn | Strict ordering required |
| Hashing per-field instead of per-(side, project, issuetype) | `snapshot_db.rs:298-306` — hash the whole response | D-04 design |

---

## Metadata

**Analog search scope:** `src-tauri/src/`, `src/features/connections/`, `src/features/tickets/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-04-27
