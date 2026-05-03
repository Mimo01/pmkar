# Phase 23: copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src-tauri/src/commands.rs` (copy_ticket removal + copy_ticket_v2 addition) | command | request-response | `src-tauri/src/commands.rs:1439` (copy_ticket itself) + `commands.rs:1331` (get_field_mapping multi-state injection) | exact |
| `src-tauri/src/copy_pipeline.rs` (new — CopyContext + extracted helpers) | service | request-response | `src-tauri/src/commands.rs:1867–2241` (attachment/comment/worklog/subtask blocks) | exact (inline extraction) |
| `src-tauri/src/audit.rs` (mapping_audit_log table addition) | model/service | CRUD | `src-tauri/src/audit.rs:26–35` (audit_log table DDL + AuditDb pattern) + `src-tauri/src/field_mapping_db.rs:35–53` | exact |
| `src-tauri/src/triage_db.rs` (audit_verbose flag) | model | CRUD | `src-tauri/src/triage_db.rs:68–80` (ALTER_APP_CONFIG_ADD_* pattern) | exact |
| `src-tauri/src/field_transform/pipeline.rs` (called from copy_ticket_v2 — no modification, only a new call site) | service | transform | itself | reference only |
| `src/features/tickets/copyStore.ts` (confirmCopy rewire) | store/service | request-response | `src/features/tickets/copyStore.ts:211–246` (confirmCopy current impl) | exact |
| `src-tauri/tests/copy_ticket_v2_integration.rs` (new CUTV-02 / CUTV-04 test) | test | request-response | `src-tauri/tests/probe_createmeta.rs` + `src-tauri/tests/mock_server.rs` | role-match |

---

## Pattern Assignments

### `src-tauri/src/copy_pipeline.rs` — CopyContext + extracted helpers (new file)

**Analog:** `src-tauri/src/commands.rs` lines 1453–2242 (the full copy_ticket body)

**Module declaration:** Add to `src-tauri/src/lib.rs` after existing module declarations (follow the `mod audit;` / `mod field_mapping_db;` pattern already in lib.rs).

**Imports pattern** — mirror commands.rs imports plus sha2/uuid for audit:
```rust
use crate::audit::{build_audited_client, AuditDb};
use crate::error::AppError;
use crate::triage_db::TriageDb;
use base64::Engine as _;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
```

**CopyContext struct** (D-09 — verbatim from CONTEXT.md decisions):
```rust
pub struct CopyContext {
    pub client: reqwest_middleware::ClientWithMiddleware, // from build_audited_client
    pub cloud_auth: String,
    pub server_pat: String,
    pub source_base_url: String,
    pub target_base_url: String,
    pub source_key: String,
    pub target_key: String,
    pub target_project_key: String,
}
```

Note: `client` type is `reqwest_middleware::ClientWithMiddleware` — this is the return type of `build_audited_client` (see `src-tauri/src/audit.rs:452–456`). The existing copy_ticket uses `client` with `.get(...)`, `.post(...)`, `.put(...)` — all work identically on `ClientWithMiddleware`.

**CopyContext constructor pattern** — copy from copy_ticket lines 1453–1469:
```rust
pub fn new_copy_context(
    audit_db: Arc<Mutex<AuditDb>>,
    triage_db: &Arc<Mutex<TriageDb>>,
    source_key: String,
    target_key: String,
    source_base_url: String,
    target_base_url: String,
) -> Result<Self, AppError> {
    let client = build_audited_client(audit_db);
    let (_, cloud_email, cloud_api_token) = crate::commands::get_cloud_credentials(triage_db)?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{cloud_api_token}"))
    );
    let server_pat = crate::commands::get_server_pat(triage_db)?;
    // target_project_key read from triage_db.get_project_keys() at call site
    ...
}
```

**Extracted helper signatures** (D-09 — free async functions, not methods):
```rust
pub async fn copy_attachments(
    ctx: &CopyContext,
    source_body: &serde_json::Value,
) -> Vec<crate::commands::CopyStepResult>

pub async fn copy_comments(
    ctx: &CopyContext,
    source_body: &serde_json::Value,
) -> Vec<crate::commands::CopyStepResult>

pub async fn copy_worklogs(
    ctx: &CopyContext,
    source_key: &str,
) -> Vec<crate::commands::CopyStepResult>

pub async fn copy_subtasks(
    ctx: &CopyContext,
    subtasks: &[serde_json::Value],
) -> Vec<crate::commands::CopyStepResult>

pub async fn add_remote_link(
    ctx: &CopyContext,
    source_key: &str,
    source_summary: &str,
) -> crate::commands::CopyStepResult
```

**copy_attachments body** — extract directly from commands.rs lines 1867–1975:
The download-then-upload pattern using `reqwest::Client::new()` for multipart (plain client, not audited — existing behavior preserved):
```rust
// Download from source using audited client
let dl_resp = ctx.client
    .get(download_url)
    .header("Authorization", format!("Bearer {}", ctx.server_pat))
    .send()
    .await;
// Upload to target using PLAIN client (multipart constraint — lines 1900–1918)
let plain_client = reqwest::Client::new();
let part = reqwest::multipart::Part::bytes(file_bytes.to_vec())
    .file_name(filename.clone())
    .mime_str(&mime)
    .unwrap_or_else(|_| {
        reqwest::multipart::Part::bytes(file_bytes.to_vec())
            .file_name(filename.clone())
    });
```

**copy_comments body** — extract from commands.rs lines 1977–2083. Key pattern: rendered HTML preferred over raw, attribution prepended as bold ADF paragraph.

**copy_worklogs body** — extract from commands.rs lines 2085–2168. Key: fetch from source via `GET /rest/api/2/issue/{key}/worklog` with server PAT; POST to target `/rest/api/3/issue/{target_key}/worklog` with cloud auth.

**copy_subtasks body** — extract from commands.rs lines 2170–2221. Key: uses `ctx.target_project_key` for `"project": { "key": ctx.target_project_key }` — this is the parameterization fix.

**add_remote_link body** — extract from commands.rs lines 1828–1865.

**Credential sanitizer for audit logging** (D-07 — plain string matching, no regex dep):
```rust
static CREDENTIAL_PATTERNS: &[&str] = &[
    "Bearer ", "Basic ", "eyJ",          // JWT prefix
    "xoxb-", "xoxp-",                    // Slack tokens
    "AKIA", "ASIA",                      // AWS access key prefixes
];

pub fn redact_credential_value(s: &str) -> String {
    for pat in CREDENTIAL_PATTERNS {
        if s.contains(pat) {
            return "[REDACTED]".to_string();
        }
    }
    s.to_string()
}
```
Note: `regex` is not in Cargo.toml — use plain `str::contains` per project convention (see commands.rs:1403 comment "No regex dependency needed" and field_transform/user.rs:202).

**SHA-256 hashing pattern** — copy from `src-tauri/src/field_mapping_db.rs:346–350`:
```rust
fn hash_field_value(v: &serde_json::Value) -> String {
    let json_str = serde_json::to_string(v).unwrap_or_default();
    let mut hasher = sha2::Sha256::new();
    hasher.update(json_str.as_bytes());
    hex::encode(hasher.finalize())
}
```

---

### `src-tauri/src/commands.rs` — copy_ticket_v2 command + copy_ticket removal

**Analog:** `src-tauri/src/commands.rs:1331–1365` (get_field_mapping / set_field_mapping for multi-state injection pattern)

**Imports addition** (at line ~1152 where FieldMappingDb import already lives):
```rust
use crate::copy_pipeline::{CopyContext, copy_attachments, copy_comments, copy_worklogs, copy_subtasks, add_remote_link};
use crate::field_mapping_db::FieldMappingDb;  // already present
use crate::field_transform::{apply_mapping, FieldMappingRow, TransformContext};
use crate::field_transform::user::UserResolver;
use crate::field_transform::version::VersionResolver;
use crate::field_transform::component::ComponentResolver;
```

**CopyTicketV2Args struct** (D-02/D-03):
```rust
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CopyTicketV2Args {
    pub source_key: String,
    pub source_base_url: String,
    pub target_base_url: String,
    pub target_issue_type_id: String,
    pub override_values: serde_json::Map<String, serde_json::Value>,
}
```

**copy_ticket_v2 command signature** (D-02 — single struct fixes too_many_arguments lint):
```rust
#[tauri::command]
pub async fn copy_ticket_v2(
    args: CopyTicketV2Args,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<CopyTicketResult, AppError>
```
Pattern: identical State injection to `discover_source_fields` (lines 1158–1178) which also takes `db`, `triage_db`, `mapping_db`.

**State lock pattern** (copy from get_field_mapping lines 1334–1338):
```rust
let mapping_rows = {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.get_all_mapping_rows()?
};
```

**audit_verbose read pattern** (new — mirrors get_poll_frequency from triage_db.rs:290–300):
```rust
let audit_verbose = {
    let db_guard = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db_guard.get_audit_verbose().unwrap_or(false)
};
```

**apply_mapping call site** — see pipeline.rs:14–18:
```rust
// Phase 1: batch user resolution
let user_resolver = UserResolver::new(/* client, cloud_auth, cloud_base_url */);
let user_map = user_resolver
    .resolve_batch(&source_body, &mapping_rows)
    .await;
// Phase 2: apply
let ctx = TransformContext {
    client: &plain_client,
    cloud_auth: &cloud_auth,
    cloud_base_url: &trimmed_target,
    target_project_key: &target_project_key,
    user_resolver: &user_resolver,
    version_resolver: &version_resolver,
    component_resolver: &component_resolver,
    user_map: &user_map,
};
let resolved = apply_mapping(&source_body, &mapping_rows, &ctx).await;
```

**override_values merge** — after `apply_mapping`, merge frontend overrides on top of resolved fields:
```rust
for (k, v) in &args.override_values {
    resolved.fields.insert(k.clone(), v.clone());
}
```

**Error-early pattern** — copy from copy_ticket lines 1481–1494 (early return on source fetch failure):
```rust
if !source_resp.status().is_success() {
    return Ok(CopyTicketResult {
        target_key: None,
        target_url: None,
        steps: vec![CopyStepResult {
            step: "fetch_source".to_string(),
            success: false,
            detail: Some(format!(
                "Source issue fetch returned status {}",
                source_resp.status().as_u16()
            )),
        }],
    });
}
```

**lib.rs / main.rs registration** — replace `commands::copy_ticket` with `commands::copy_ticket_v2` at main.rs line 220:
```rust
// Remove:
commands::copy_ticket,
// Add:
commands::copy_ticket_v2,
```

---

### `src-tauri/src/audit.rs` — mapping_audit_log table addition

**Analog:** `src-tauri/src/audit.rs:26–35` (audit_log CREATE TABLE DDL) + `src-tauri/src/field_mapping_db.rs:36–53` (field_mapping + mapping_meta tables in same DB)

**Decision on DB placement:** The researcher leaves this to Claude's discretion. Pattern precedent: `field_mapping_db.rs` already has multiple tables (field_schema_cache, field_mapping, mapping_meta) and uses `execute_batch` per-table at open(). Prefer adding `mapping_audit_log` to `field_mapping_db.rs` (mapping.db) to keep audit-of-mapping with the mapping data, rather than polluting the HTTP audit.db with a structurally different concern.

**DDL pattern** (copy from audit.rs:26–35, field_mapping_db.rs:35–46):
```rust
const CREATE_MAPPING_AUDIT_LOG: &str = "
    CREATE TABLE IF NOT EXISTS mapping_audit_log (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        copy_id             TEXT NOT NULL,
        field_id            TEXT NOT NULL,
        source_value_hash   TEXT NOT NULL,
        target_value_hash   TEXT NOT NULL,
        was_overridden      INTEGER NOT NULL DEFAULT 0,
        gap_kind            TEXT,
        timestamp           TEXT NOT NULL,
        created_at          INTEGER DEFAULT (strftime('%s','now'))
    );
";
```

**insert pattern** — mirror AuditDb::insert (audit.rs:50–70):
```rust
pub fn insert_mapping_audit(
    &self,
    copy_id: &str,
    field_id: &str,
    source_value_hash: &str,
    target_value_hash: &str,
    was_overridden: bool,
    gap_kind: Option<&str>,
    timestamp: &str,
) -> AppResult<()> {
    self.conn.execute(
        "INSERT INTO mapping_audit_log
             (copy_id, field_id, source_value_hash, target_value_hash,
              was_overridden, gap_kind, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            copy_id,
            field_id,
            source_value_hash,
            target_value_hash,
            was_overridden as i32,
            gap_kind,
            timestamp,
        ],
    )?;
    Ok(())
}
```

**open() call sequence** — add `conn.execute_batch(CREATE_MAPPING_AUDIT_LOG)?;` after the existing `conn.execute_batch(CREATE_MAPPING_META)?;` line in `FieldMappingDb::open` and `open_in_memory` (field_mapping_db.rs:89–107).

---

### `src-tauri/src/triage_db.rs` — audit_verbose flag

**Analog:** `src-tauri/src/triage_db.rs:68–80` (ALTER_APP_CONFIG_ADD_* migration constants) + lines 290–308 (get_poll_frequency/set_poll_frequency boolean-like scalar pattern)

**Migration constant** (copy ALTER pattern from lines 68–80):
```rust
const ALTER_APP_CONFIG_ADD_AUDIT_VERBOSE: &str =
    "ALTER TABLE app_config ADD COLUMN audit_verbose INTEGER NOT NULL DEFAULT 0;";
```

**Wire into open() and open_in_memory()** — add after the existing `let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS);` line (triage_db.rs:139/158):
```rust
let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_AUDIT_VERBOSE);
```
Pattern: `let _ =` suppresses error on existing DBs where column already exists (idempotent migration — copy from existing ALTER lines 130–139).

**get/set methods** (copy from get_poll_frequency pattern, lines 290–308):
```rust
pub fn get_audit_verbose(&self) -> AppResult<bool> {
    let val: i64 = self
        .conn
        .query_row(
            "SELECT audit_verbose FROM app_config WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(val != 0)
}

pub fn set_audit_verbose(&self, verbose: bool) -> AppResult<()> {
    self.conn.execute(
        "UPDATE app_config SET audit_verbose = ?1 WHERE id = 1",
        [verbose as i64],
    )?;
    Ok(())
}
```

---

### `src/features/tickets/copyStore.ts` — confirmCopy rewire

**Analog:** `src/features/tickets/copyStore.ts:211–246` (the current confirmCopy implementation)

**Current invoke call** (lines 221–232 — the exact block to replace):
```typescript
const result = await invoke<CopyTicketResult>('copy_ticket', {
  sourceKey: state.sourceKey,
  sourceBaseUrl,
  targetBaseUrl: cloudBaseUrl,
  targetSummary: state.targetSummary,
  targetDescription: state.targetDescription || null,
  targetStatus: state.targetStatus,
  targetPriorityId: state.targetPriorityId,
  targetLabels: state.selectedLabels,
  currentAccountId: state.cloudMeta?.currentAccountId,
  targetProjectKey: state.targetProjectKey,
});
```

**Replacement** (D-03 — single `args` object, camelCase IPC):
```typescript
const result = await invoke<CopyTicketResult>('copy_ticket_v2', {
  args: {
    sourceKey: state.sourceKey,
    sourceBaseUrl,
    targetBaseUrl: cloudBaseUrl,
    targetIssueTypeId: state.targetIssueTypeId ?? '',
    overrideValues: state.overrideValues,
  },
});
```

Note: The Phase 22 D-11 fields `targetIssueTypeId` and `overrideValues` are already on `CopyState` (copyStore.ts:33–34) — no new state additions needed. The old flat fields (`targetSummary`, `targetPriorityId`, etc.) are NOT removed yet per D-13 (kept for Phase 22→23 transition continuity; clean-up is Phase 23's job).

**Error handling** — keep the existing catch block verbatim (lines 235–245) — it already produces a `CopyTicketResult` shape compatible with the result view.

---

### `src-tauri/tests/copy_ticket_v2_integration.rs` — CUTV-02/CUTV-04 test

**Analog:** `src-tauri/tests/probe_createmeta.rs` (full structure) + `src-tauri/tests/mock_server.rs` (start_servers_once pattern)

**File header and server setup** (copy from probe_createmeta.rs:1–33):
```rust
use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::start_mock_servers;
use std::sync::Once;
use std::time::Duration;

static CUTV_SERVERS_ONCE: Once = Once::new();

fn start_servers_once() {
    CUTV_SERVERS_ONCE.call_once(|| {
        std::thread::spawn(|| {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            rt.block_on(async {
                let fixtures = build_fixtures();
                start_mock_servers(fixtures)
                    .await
                    .expect("Failed to start mock servers");
                loop {
                    tokio::time::sleep(Duration::from_secs(3600)).await;
                }
            });
        });
        std::thread::sleep(Duration::from_millis(300));
    });
}
```

**Test flavor** (copy from probe_createmeta.rs:43):
```rust
#[tokio::test(flavor = "multi_thread")]
async fn copy_ticket_v2_full_pipeline_succeeds() {
    start_servers_once();
    // ...
}
```

**CUTV-04 parameterization test** — must use `"ACME"` not `"MYPROJ"` as target project key to prove no hardcoded MYPROJ remains in production paths. The mock server must be configured to accept `POST /rest/api/3/issue` with `project.key=ACME` — confirm fixture support or add ACME fixture to `src-tauri/src/fixtures.rs` / `mock_server.rs`.

**Auth helpers** (copy from probe_createmeta.rs:35–39):
```rust
fn cloud_auth() -> String {
    format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode("test:test")
    )
}
fn server_auth() -> &'static str {
    "Bearer test-token-any-value"
}
```

**Direct function call pattern** — integration tests call library functions directly (not Tauri IPC). For copy_ticket_v2, the test should call the extracted `copy_pipeline::` free functions directly (copy_attachments, copy_comments, copy_worklogs, copy_subtasks, add_remote_link) against mock endpoints, plus assert on the returned `Vec<CopyStepResult>` shapes.

---

## Shared Patterns

### State Injection
**Source:** `src-tauri/src/commands.rs:1158–1178` (discover_source_fields) and `1331–1338` (get_field_mapping)
**Apply to:** `copy_ticket_v2` command

Pattern: `State<'_, Arc<Mutex<T>>>` for each managed DB. Lock with `.lock().map_err(|_| AppError::Internal("X lock poisoned".into()))?`. Extract value then release guard immediately (don't hold lock across await points).

```rust
let rows = {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.get_all_mapping_rows()?
}; // guard dropped here — before any .await
```

### SHA-256 Hashing
**Source:** `src-tauri/src/field_mapping_db.rs:346–350`
**Apply to:** `copy_pipeline.rs` credential sanitizer + field value hashing for mapping_audit_log

```rust
use sha2::{Digest, Sha256};
use hex;

fn sha256_hex(input: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input);
    hex::encode(hasher.finalize())
}
```

### Credential Sanitization (no regex)
**Source:** `src-tauri/src/commands.rs:1403` comment ("No regex dependency needed") + `src-tauri/src/field_transform/user.rs:202` ("No regex dep")
**Apply to:** `copy_pipeline.rs` sanitize_field_value helper (D-07)

Project convention: use `str::contains` for pattern matching. No `regex` crate in Cargo.toml.

### SQLite Migration Pattern
**Source:** `src-tauri/src/triage_db.rs:68–80` and `124–141`
**Apply to:** `triage_db.rs` (audit_verbose column) and `field_mapping_db.rs` (mapping_audit_log table)

Convention: `ALTER TABLE` constants at top of file, applied with `let _ = conn.execute_batch(ALTER_...)` (suppress error for idempotency on existing DBs). `CREATE TABLE IF NOT EXISTS` used for new tables.

### Tauri Command Registration
**Source:** `src-tauri/src/main.rs:192–246`
**Apply to:** Replace `commands::copy_ticket` with `commands::copy_ticket_v2` in the `invoke_handler!` list

Single line swap — no other changes to main.rs.

### Error Return Shape (soft errors vs hard errors)
**Source:** `src-tauri/src/commands.rs:1481–1494`
**Apply to:** `copy_ticket_v2` and all extracted helpers

Convention: HTTP-level failures that affect only one step return `Ok(CopyTicketResult { target_key: None, ... })` (soft failure, steps describe what went wrong). Infrastructure failures (lock poisoned, keychain missing) return `Err(AppError::...)`. This distinction is critical for the frontend result view to render correctly.

### serde camelCase IPC
**Source:** `src-tauri/src/commands.rs:123–137` (CopyStepResult, CopyTicketResult)
**Apply to:** `CopyTicketV2Args`

All Tauri-serialized structs use `#[serde(rename_all = "camelCase")]`. Deserialize-only input structs use `#[derive(serde::Deserialize)]`. Result structs use `#[derive(serde::Serialize)]`.

---

## No Analog Found

All files have close analogs. No entries.

---

## Metadata

**Analog search scope:** `src-tauri/src/`, `src-tauri/tests/`, `src/features/tickets/`
**Files scanned:** 11 (commands.rs, audit.rs, field_mapping_db.rs, field_transform/mod.rs, field_transform/pipeline.rs, triage_db.rs, error.rs, main.rs, copyStore.ts, tests/probe_createmeta.rs, tests/mock_server.rs)
**Pattern extraction date:** 2026-04-28
