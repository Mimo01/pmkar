# Phase 23: copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Cutover the copy execution path to a new `copy_ticket_v2` Tauri command that drives all field mapping through the Phase 18 mapping engine (`apply_mapping`). Extract the existing attachment/comment/worklog/subtask helpers behind a `CopyContext` seam shared across both the old and new command paths, then remove `copy_ticket` entirely. Add per-copy mapping decision audit logging (new table, hash-based redaction, verbose-mode toggle). Parameterize the MYPROJ project key end-to-end via `CopyContext`.

**In scope:**
- New `copy_ticket_v2` Tauri command (single input struct, mapping-engine-driven)
- `CopyContext` struct + extraction of attachment/comment/worklog/subtask helpers as free functions
- Both `copy_ticket` and `copy_ticket_v2` refactored to use shared helpers before `copy_ticket` is removed
- New `mapping_audit_log` SQLite table with hash-based field-value redaction
- Verbose audit mode persisted as a boolean flag in TriageDb
- MYPROJ parameterized via `CopyContext.target_project_key` (from connection settings)
- Full-pipeline integration test against mock server (CUTV-02)
- Frontend: `confirmCopy` wired to `copy_ticket_v2`

**Out of scope:**
- Inline mapping editor inside the copy preview (Phase 22 territory)
- Exposing the mapping audit log in a UI view (future phase)
- Mutating saved mapping from within the copy preview
- Any changes to attachment/comment/worklog/subtask business logic (they are extracted as-is)

</domain>

<decisions>
## Implementation Decisions

### Command Cutover
- **D-01:** `copy_ticket` (old Tauri command) is **removed entirely** by end of Phase 23. No dual-path coexistence. Verify no other frontend call sites exist before deletion.
- **D-02:** `copy_ticket_v2` accepts a **single Rust struct** (`CopyTicketV2Args` or similar) — fixes the clippy `too_many_arguments` lint without `#[allow]`. The struct is `#[serde(rename_all = "camelCase")]` for Tauri IPC compatibility.

### copy_ticket_v2 Payload Shape
- **D-03:** No explicit named field params (no `target_summary`, `target_priority_id`, `target_labels`). All field values flow through `override_values: serde_json::Map<String, Value>` from the frontend copyStore (`overrideValues` from Phase 22 D-11). Input struct carries:
  ```rust
  pub struct CopyTicketV2Args {
      pub source_key: String,
      pub source_base_url: String,
      pub target_base_url: String,
      pub target_issue_type_id: String,
      pub override_values: serde_json::Map<String, serde_json::Value>,
  }
  ```
- **D-04:** Saved mapping rows are **loaded inside the command** from `mapping.db` via the existing `State<Arc<Mutex<FieldMappingDb>>>` injection pattern (same as Phase 19's `get_field_mapping`). The frontend does not pass mapping data.

### Mapping Decision Audit (CUTV-03)
- **D-05:** Mapping decisions go in a **new `mapping_audit_log` SQLite table**, separate from the existing `audit_log` HTTP call table. Location: same audit.db (or mapping.db — researcher to confirm which is less disruptive). Each row records: `copy_id` (UUID per `copy_ticket_v2` invocation), `field_id`, `source_value_hash` (SHA-256 of JSON-serialized value), `target_value_hash`, `was_overridden` (bool), `gap_kind` (null | "person" | "version" | "component"), `timestamp`.
- **D-06:** Verbose mode (logs raw field values instead of hashes) is a **persistent boolean flag in TriageDb** (`audit_verbose: bool`, default false). Read at the start of each `copy_ticket_v2` invocation. Settings UI exposure is deferred to a future phase.
- **D-07:** Credential sanitizer regex patterns (Bearer/Basic/JWT/AWS/Slack token patterns per CUTV-03 requirement) applied to all string field values before hashing — matched tokens are replaced with `[REDACTED]` regardless of verbose mode.

### CopyContext Seam
- **D-08:** **Both `copy_ticket` and `copy_ticket_v2`** call the shared extracted helpers. Refactoring happens first; then `copy_ticket` is removed. This proves the helpers work before deleting the old path.
- **D-09:** `CopyContext` is a **thin credentials + client + keys struct** — no business logic, no mapping pipeline types:
  ```rust
  pub struct CopyContext {
      pub client: reqwest::Client,  // audited client from build_audited_client
      pub cloud_auth: String,
      pub server_pat: String,
      pub source_base_url: String,
      pub target_base_url: String,
      pub source_key: String,
      pub target_key: String,
      pub target_project_key: String,
  }
  ```
  Extracted helpers (e.g., `copy_attachments`, `copy_comments`, `copy_worklogs`, `copy_subtasks`, `add_remote_link`) are **free functions** taking `&CopyContext` + any helper-specific args. No methods on `CopyContext` itself.

### Claude's Discretion
- Module placement for `CopyContext` and helpers (new `copy_pipeline.rs` module, or inline in `commands.rs` as private functions)
- Whether `mapping_audit_log` lives in `audit.db` or `mapping.db`
- Exact naming of the `audit_verbose` column in TriageDb and the migration strategy
- Integration test structure (single `#[tokio::test]` against mock server, or split per helper)
- Whether the `copy_id` UUID is generated in Rust or passed from the frontend

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §CUTV-01…CUTV-04 — locked requirements for Phase 23

### Prior Phase Decisions
- `.planning/phases/22-copy-preview-override-panel/22-CONTEXT.md` — D-11 (copyStore shape with `overrideValues`, `targetIssueTypeId`), D-12 (confirmCopy → copy_ticket_v2 handoff seam), D-13 (old store fields kept for Phase 22→23 transition)

### Existing Code to Read Before Planning
- `src-tauri/src/commands.rs` (line ~1439) — full `copy_ticket` implementation; the monolith to refactor and replace
- `src-tauri/src/field_transform/mod.rs` — `TransformContext`, `ResolvedFields`, `GapVariant`, `FieldMappingRow` — the mapping engine contracts
- `src-tauri/src/field_transform/pipeline.rs` — `apply_mapping(source_issue, mapping, ctx)` — entry point for Phase 18 pipeline
- `src-tauri/src/audit.rs` — existing `AuditDb`, `AuditEntry`, `AuditMiddleware`, `build_audited_client` — understand before adding `mapping_audit_log`
- `src-tauri/src/field_mapping_db.rs` — `FieldMappingDb`, `get_field_mapping` patterns from Phase 19
- `src/features/tickets/copyStore.ts` — `overrideValues`, `targetIssueTypeId`, `confirmCopy` — the frontend call site to update

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apply_mapping` (`src-tauri/src/field_transform/pipeline.rs:14`) — takes `&Value`, `&[FieldMappingRow]`, `&TransformContext` → `ResolvedFields { fields, gaps }`. Ready to call from `copy_ticket_v2`.
- `build_audited_client` (`src-tauri/src/audit.rs`) — returns `reqwest::Client` that auto-logs all HTTP calls. `CopyContext.client` should be built with this.
- `get_cloud_credentials` / `get_server_pat` (`src-tauri/src/commands.rs`) — existing helper functions; `CopyContext` constructor calls these.
- `FieldMappingDb` (`src-tauri/src/field_mapping_db.rs`) — Phase 19's DB with `get_all_field_mappings()` or equivalent; `copy_ticket_v2` reads rows from here.

### Established Patterns
- `State<Arc<Mutex<T>>>` injection: used for `AuditDb`, `TriageDb`, `FieldMappingDb` — `copy_ticket_v2` follows the same pattern.
- `CopyTicketResult { target_key, target_url, steps: Vec<CopyStepResult> }` — existing return type; `copy_ticket_v2` returns the same shape (CUTV-01 requirement: 528 frontend tests still pass).
- Helper extraction pattern: `copy_ticket` inline logic → free `async fn copy_attachments(ctx: &CopyContext, ...) -> Vec<CopyStepResult>` functions (mirrors Phase 18's resolver free-function pattern).

### Integration Points
- `src/features/tickets/copyStore.ts` `confirmCopy()` — replace `invoke('copy_ticket', { ... })` with `invoke('copy_ticket_v2', { args: { sourceKey, ..., targetIssueTypeId, overrideValues } })`.
- `src-tauri/src/lib.rs` — Tauri command registration: remove `copy_ticket`, add `copy_ticket_v2`.
- `src-tauri/src/field_transform/user.rs` `UserResolver.resolve_batch` — Phase 1 of the two-phase pipeline; called before `apply_mapping`.

</code_context>

<specifics>
## Specific Ideas

- **`CopyTicketV2Args` struct fields (D-03):**
  ```rust
  pub struct CopyTicketV2Args {
      pub source_key: String,
      pub source_base_url: String,
      pub target_base_url: String,
      pub target_issue_type_id: String,
      pub override_values: serde_json::Map<String, serde_json::Value>,
  }
  ```

- **`CopyContext` struct (D-09):**
  ```rust
  pub struct CopyContext {
      pub client: reqwest::Client,
      pub cloud_auth: String,
      pub server_pat: String,
      pub source_base_url: String,
      pub target_base_url: String,
      pub source_key: String,
      pub target_key: String,
      pub target_project_key: String,
  }
  ```

- **Extracted helper signatures (D-09 / D-08):**
  ```rust
  async fn copy_attachments(ctx: &CopyContext, source_body: &Value) -> Vec<CopyStepResult>
  async fn copy_comments(ctx: &CopyContext, source_body: &Value) -> Vec<CopyStepResult>
  async fn copy_worklogs(ctx: &CopyContext, source_key: &str) -> Vec<CopyStepResult>
  async fn copy_subtasks(ctx: &CopyContext, subtasks: &[Value]) -> Vec<CopyStepResult>
  async fn add_remote_link(ctx: &CopyContext, source_key: &str) -> CopyStepResult
  ```

- **CUTV-04 integration test** — must use a Cloud project key other than `MYPROJ` (e.g., `ACME`) to prove parameterization. Test should fail before D-09 fix if any hardcoded `MYPROJ` remains in production paths.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-copy-ticket-v2-wiring*
*Context gathered: 2026-04-28*
