# Architecture Research

**Domain:** Tauri 2 desktop app — configurable Jira field mapping engine on top of an existing Server v2 → Cloud v3 copy pipeline
**Researched:** 2026-04-27
**Confidence:** HIGH (existing codebase inspected directly + Atlassian Jira REST API docs + prior v0.3.0 architecture decisions)

## Focus

This document covers ONLY the new architectural additions for v0.4.0 Configurable Field Mapping. The existing architecture — Tauri command → Zustand store → React component pattern, `Arc<Mutex<DbStruct>>` managed state per SQLite file, audited `reqwest_middleware` HTTP client, `htmltoadf` for ADF translation, axum mock servers exposing both v2 and v3 routes, single global app config in `app_config` table — is preserved. The v0.4.0 work is a surgical replacement of one slice of the copy pipeline (field translation) with a discovery + persistence + render + transform stack, while leaving comments, attachments, worklogs, sub-tasks, summary, and origin remote link inside the existing `copy_ticket` function untouched.

---

## System Overview

### Existing architecture (unchanged)

```
React 19 frontend ── Tauri IPC ── Rust backend ── audit / triage / snapshot SQLite + reqwest
        |                                                |
        |                                                +── axum mock_server (v2 + v3 routers)
        |
        +── Zustand stores per feature (ticketStore, copyStore, connectionStore, ...)
```

Files of record:

- `src-tauri/src/commands.rs` — 2,188 lines, all `#[tauri::command]` entry points
- `src-tauri/src/copy_ticket` is the 800-line god-function inside `commands.rs` (lines 1221–2024); it does discover → create → upload images → PUT description → remote link → attachments → comments → worklog → sub-tasks all in one
- `src-tauri/src/triage_db.rs` — owns `app_config`, `connection_meta`, `fetch_config`, `triage_state` (single-row config pattern)
- `src-tauri/src/snapshot_db.rs` — separate file, separate `Arc<Mutex<SnapshotDb>>`, separate `snapshots.db` SQLite file, illustrating the established "one DB struct per concern" pattern
- `src-tauri/src/mock_server.rs` — `build_v2_router` and `build_v3_router` exposing `/rest/api/2/*` and `/rest/api/3/*`; auth middleware accepts any non-empty header
- `src/features/tickets/CopyPreviewModal.tsx` — current 369-line modal with hardcoded summary / status / priority / labels / description controls
- `src/features/tickets/copyStore.ts` — thin Zustand store that calls `fetch_cloud_meta` then `copy_ticket`

### New components for v0.4.0

```
React 19 frontend
  src/features/mapping/                                       ← NEW feature directory
    schemaStore.ts            Zustand: cached source/target FieldSchema[]
    mappingStore.ts           Zustand: persisted FieldMapping[] + dirty/saved tracking
    overrideStore.ts          Zustand: per-copy inline overrides (lives only for the modal session)
    MappingEditor.tsx         Settings page — full source ↔ target mapping table
    MappingRow.tsx            One row: source field + transformer + target field selectors
    fields/                   Field-type-aware renderer registry (component-per-type)
      registry.ts             Lookup: schemaType → renderer component
      TextFieldRenderer.tsx
      AdfFieldRenderer.tsx
      MultiSelectFieldRenderer.tsx   (labels, components, fix versions)
      VersionPickerRenderer.tsx
      PersonPickerRenderer.tsx       (uses search_jira_users_by_domain)
      DatePickerRenderer.tsx
      NumberFieldRenderer.tsx
      PriorityRenderer.tsx           (replaces today's hard-coded select)
      IssueTypePickerRenderer.tsx
      types.ts                FieldRendererProps shape
  src/features/tickets/CopyPreviewModal.tsx                   ← MODIFIED
    Right column becomes <DynamicTargetForm/>; left column unchanged
  src/features/tickets/DynamicTargetForm.tsx                  ← NEW
    Reads mappingStore + overrideStore + schemaStore; for each target field
    in the resolved mapping, looks up renderer in registry and mounts it.
    Owns required-field validation; disables Confirm button until valid.

Rust backend (src-tauri/src/)
  field_discovery.rs                                          ← NEW module
    Tauri commands: discover_source_fields, discover_target_fields, refresh_field_schema
    Hits /rest/api/2/field, /rest/api/3/field, /createmeta, /editmeta
    Persists raw JSON + parsed FieldSchema rows in field_schema_cache table
  field_mapping_db.rs                                         ← NEW module (separate SQLite file: mapping.db)
    Mirrors snapshot_db.rs / triage_db.rs pattern
    Owns: field_schema_cache, field_mapping, mapping_meta tables
  field_transform/                                            ← NEW submodule directory
    mod.rs                    pub use of submodules + Transformer trait
    user.rs                   v2 username → v3 accountId via cloud user search
    version.rs                v2 name → v3 id (project versions endpoint)
    component.rs              v2 name → v3 id (project components endpoint)
    wiki_to_adf.rs            wraps htmltoadf::convert_html_str_to_adf_str
    identity.rs               passthrough (text, labels list, priority id when names match)
    pipeline.rs               apply_mapping(source_issue, mapping, schema) -> ResolvedFields
  commands.rs                                                 ← MODIFIED
    + discover_source_fields, discover_target_fields, refresh_field_schema
    + get_field_mapping, save_field_mapping
    + validate_target_payload (calls editmeta against a placeholder issue OR createmeta)
    + copy_ticket_v2 (new mapping-aware path; old copy_ticket kept until cutover)
  main.rs                                                     ← MODIFIED
    + opens mapping.db, manages Arc<Mutex<FieldMappingDb>>
    + registers new commands in invoke_handler
  mock_server.rs                                              ← MODIFIED
    + GET /rest/api/2/field, /rest/api/3/field
    + GET /rest/api/2/issue/createmeta, /rest/api/3/issue/createmeta
    + GET /rest/api/3/issue/{key}/editmeta (still v2 too for symmetry)
    + GET /rest/api/3/project/{key}/versions, /components
  fixtures.rs                                                 ← MODIFIED
    + adds field_schema_v2 and field_schema_v3 to FixtureState
    + adds at least one customfield (e.g. customfield_10100 "Story Points") and one
      multi-select custom field to exercise non-standard renderers
```

The mapping engine is the only piece that talks to discovery, mapping, transform; the existing copy_ticket retains responsibility for attachments/comments/worklogs/sub-tasks/summary/remote link. v0.4.0 builds `copy_ticket_v2` alongside the old function (feature flag inside the modal — not a runtime flag, just a frontend choice between calling v1 vs v2). After v0.4.0 ships, v0.5.0 can delete `copy_ticket` v1.

---

## New vs Modified: explicit list

### New files (Rust — `src-tauri/src/`)

| File | Purpose |
|------|---------|
| `field_discovery.rs` | Calls v2/v3 `/field`, `/createmeta`, `/editmeta`; parses into `FieldSchema`; writes to `field_schema_cache` |
| `field_mapping_db.rs` | Owns `mapping.db` SQLite file; `field_schema_cache`, `field_mapping`, `mapping_meta` tables; CRUD methods |
| `field_transform/mod.rs` | Re-exports submodules, defines `Transformer` trait |
| `field_transform/user.rs` | `username → accountId` via cloud `/user/search?query=email` |
| `field_transform/version.rs` | `name → id` via `/project/{key}/versions` |
| `field_transform/component.rs` | `name → id` via `/project/{key}/components` |
| `field_transform/wiki_to_adf.rs` | Thin wrapper around `htmltoadf` that handles HTML re-fetch + image rewrite delegation back to existing `extract_image_urls`/`rewrite_image_urls` helpers (still in `commands.rs`, exposed via `pub`) |
| `field_transform/identity.rs` | Passthrough for text, labels arrays, raw IDs |
| `field_transform/pipeline.rs` | `apply_mapping(source_issue: &Value, mapping: &FieldMapping, schemas: &SchemaPair) -> Result<Map<String, Value>>`; the assembled "fields" map fed into the Cloud `POST /issue` body |

### New files (frontend — `src/features/mapping/`)

| File | Purpose |
|------|---------|
| `schemaStore.ts` | Zustand: `sourceSchema: FieldSchema[]`, `targetSchema: FieldSchema[]`, `lastRefreshedAt`, `refresh()` |
| `mappingStore.ts` | Zustand: `mappings: FieldMapping[]`, `dirty: boolean`, `load()`, `save()`, `addRow()`, `removeRow()`, `updateRow()` |
| `overrideStore.ts` | Zustand: `overrides: Record<targetFieldId, unknown>`, `setOverride()`, `clear()`; lives for one modal session; reset on close |
| `MappingEditor.tsx` | Settings sub-page mounted at `/settings/mapping` (route addition in `App.tsx`) |
| `MappingRow.tsx` | Row component: source field combobox + transformer combobox + target field combobox |
| `fields/registry.ts` | `getRendererForSchema(schema): React.FC<FieldRendererProps>` |
| `fields/TextFieldRenderer.tsx`, `AdfFieldRenderer.tsx`, `MultiSelectFieldRenderer.tsx`, `VersionPickerRenderer.tsx`, `PersonPickerRenderer.tsx`, `DatePickerRenderer.tsx`, `NumberFieldRenderer.tsx`, `PriorityRenderer.tsx`, `IssueTypePickerRenderer.tsx` | One per Jira field type |
| `fields/types.ts` | `FieldRendererProps`, `FieldSchema`, `FieldMapping`, `TransformerKind` types |
| `DynamicTargetForm.tsx` | Mounts inside `CopyPreviewModal`, replaces today's hardcoded right column |

### Modified files (Rust)

| File | Change |
|------|--------|
| `commands.rs` | Add 6 new commands: `discover_source_fields`, `discover_target_fields`, `refresh_field_schema`, `get_field_mapping`, `save_field_mapping`, `copy_ticket_v2` (mapping-aware), and `validate_target_payload`. Existing `copy_ticket` remains unchanged. |
| `main.rs` | Open `mapping.db`, `app.manage(Arc::new(Mutex::new(FieldMappingDb)))`, register new commands in `invoke_handler!` |
| `lib.rs` | Add `pub mod field_discovery; pub mod field_mapping_db; pub mod field_transform;` |
| `mock_server.rs` | Add ~6 routes for field discovery on both v2 and v3 routers |
| `fixtures.rs` | Add `field_schema_v2`, `field_schema_v3` HashMaps + at least 2 custom fields on existing `JiraIssue` instances; add `createmeta` + `editmeta` payload constants |

### Modified files (frontend)

| File | Change |
|------|--------|
| `src/features/tickets/CopyPreviewModal.tsx` | Replace right column body (lines ~225–344) with `<DynamicTargetForm sourceTicket={...} />`; keep header, progress bar, footer |
| `src/features/tickets/copyStore.ts` | Replace `confirmCopy` to invoke `copy_ticket_v2` with mapping + overrides payload instead of hardcoded fields |
| `src/features/tickets/types.ts` | Remove (or deprecate) `CloudMeta` once renderers fetch their own option lists; add re-exports of mapping types |
| `src/features/connections/SettingsPage.tsx` | Add link/section pointing to `/settings/mapping` |
| `src/App.tsx` | Add route for `MappingEditor` |
| `src/i18n/*` | Add translation keys for new mapping UI |

---

## Component Responsibilities

| Component | Responsibility | Communicates with |
|-----------|----------------|-------------------|
| `field_discovery.rs` | Fetch + cache field schemas; emits no events; pure request/response | `mapping.db` (write `field_schema_cache`), `reqwest` audited client |
| `field_mapping_db.rs` | Persistence: schema cache, mapping rows, mapping metadata (timestamps, version) | None — pure SQLite |
| `field_transform::pipeline` | Given source issue + mapping + schemas, build target `fields` map; call individual transformers; collect error per field | All `field_transform::*` modules; reads from `mapping.db` and may issue auxiliary HTTP for user/version/component lookups |
| `commands::copy_ticket_v2` | Orchestrates: load mapping → call pipeline → apply overrides → POST `/issue` → delegate non-mapped concerns (attachments, comments, worklogs, sub-tasks, remote link) to refactored helpers extracted from `copy_ticket` | `field_transform::pipeline`, existing copy helpers |
| `commands::validate_target_payload` | Pre-flight: GET `/createmeta` for target project + issue type, return list of required fields lacking values in current payload | `field_discovery` or direct HTTP |
| `schemaStore` | Holds discovered schemas in memory; calls `refresh_field_schema` Tauri command on user request or first mapping editor open | `MappingEditor`, `DynamicTargetForm` |
| `mappingStore` | Holds saved mapping rows; persists via `save_field_mapping`; loads via `get_field_mapping` on app start | `MappingEditor`, `DynamicTargetForm` |
| `overrideStore` | Per-copy session state for inline tweaks that do NOT mutate saved mapping | `DynamicTargetForm`; cleared on `CopyPreviewModal` close |
| `fields/registry` | Pure lookup table from `FieldSchema.type` (+ `custom`) → React component | `DynamicTargetForm` |
| `PersonPickerRenderer` | Email-prefilled person selector; debounced calls to `search_jira_users_by_domain` (already exists from Phase 16) | Tauri command, no new state |
| `DynamicTargetForm` | For each target field in resolved-mapping, render the appropriate component; track per-field validation; expose `isValid` and `getOverrides()` to parent modal | `mappingStore`, `overrideStore`, `schemaStore`, all renderers |

---

## Architectural Patterns

### Pattern 1: Separate SQLite file per concern (continued)

**What:** v0.3.0 already established the "one struct, one Arc<Mutex<>>, one .db file" pattern (`AuditDb` → `audit.db`, `TriageDb` → `triage.db`, `SnapshotDb` → `snapshots.db`). v0.4.0 follows it exactly: `FieldMappingDb` → `mapping.db`. Do NOT extend `triage_db.rs` with mapping tables.

**Why:** Mapping schema cache + mapping rows is a substantial sub-system; mixing it into `triage_db.rs` (which already manages 5 concerns: triage, connection meta, fetch config, app config, language) violates the established separation. New file matches the existing precedent.

**Trade-offs:** One extra `app.manage()` call in `main.rs`. Three transactions if a single command spans triage + mapping (none expected for this milestone). Lower coupling and clearer test surface.

**Example:**
```rust
// main.rs setup, after snapshot_db block
let mapping_db_path = app_dir.join("mapping.db");
let mapping_db = FieldMappingDb::open(&mapping_db_path)
    .expect("Failed to open mapping database");
app.manage(Arc::new(Mutex::new(mapping_db)));
```

### Pattern 2: Discovery cache with explicit refresh (NOT auto-refresh)

**What:** `field_schema_cache` table stores the parsed `FieldSchema` rows plus the raw JSON response and a `cached_at` timestamp. Discovery commands check the cache first. There is no time-based invalidation. Refresh is user-triggered: a "Refresh field list" button in `MappingEditor` calls `refresh_field_schema` which re-hits `/field` + `/createmeta` and overwrites the rows.

**Why:** Field schemas in real Jira instances change rarely (admin adds a custom field once a quarter). Auto-refresh on every modal open wastes API calls and audit log entries. Explicit refresh matches user intent and keeps audit logs clean.

**Trade-offs:** Stale schema possible if admin adds a field and user doesn't refresh. Acceptable: visible refresh button + last-refreshed timestamp surfaces this. Mitigation: optional auto-refresh on first launch of a new app version (changelog migration).

**Example:**
```rust
// field_discovery.rs
pub async fn discover_target_fields(
    project_key: String,
    issue_type_id: String,
    db: State<'_, Arc<Mutex<FieldMappingDb>>>,
    audit_db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<FieldSchema>, AppError> {
    // 1. Cache hit?
    let cached = {
        let d = db.lock()?;
        d.get_target_schema(&project_key, &issue_type_id)?
    };
    if let Some(schemas) = cached { return Ok(schemas); }

    // 2. Cache miss — hit Cloud
    let (base, email, token) = get_cloud_credentials(triage_db.inner())?;
    let client = build_audited_client(Arc::clone(audit_db.inner()));
    let url = format!("{base}/rest/api/3/issue/createmeta/{project_key}/issuetypes/{issue_type_id}");
    let resp = client.get(&url).header("Authorization", basic(&email, &token)).send().await?;
    let body: serde_json::Value = resp.json().await?;
    let schemas = parse_createmeta_response(&body);

    // 3. Persist
    {
        let d = db.lock()?;
        d.put_target_schema(&project_key, &issue_type_id, &body, &schemas)?;
    }
    Ok(schemas)
}
```

### Pattern 3: Renderer registry (component-per-field-type)

**What:** Each Jira field type (`string`, `array.string`, `user`, `array.user`, `date`, `datetime`, `number`, `priority`, `issuetype`, `version`, `array.version`, `component`, `array.component`, `option`, `array.option`, ADF) maps to one React component via `fields/registry.ts`. The registry is a `Map<string, React.FC<FieldRendererProps>>` keyed by a normalised type token. `DynamicTargetForm` does `const Renderer = getRendererForSchema(schema); return <Renderer {...props} />`.

**Why:** Closed-set extension: adding a new renderer is a single registry entry, no switch statement bloat in the form component. Custom fields with unknown types fall back to `TextFieldRenderer` with a warning badge.

**Trade-offs:** Indirection cost (one Map lookup per field). Negligible. Major win on test isolation — each renderer is unit-tested in isolation; `DynamicTargetForm` is tested with mocked registry.

**Example:**
```typescript
// fields/registry.ts
import { TextFieldRenderer } from './TextFieldRenderer';
import { PersonPickerRenderer } from './PersonPickerRenderer';
// ...

const registry = new Map<string, React.FC<FieldRendererProps>>([
  ['string', TextFieldRenderer],
  ['user', PersonPickerRenderer],
  ['array.user', PersonPickerRenderer],
  ['priority', PriorityRenderer],
  ['issuetype', IssueTypePickerRenderer],
  // ...
]);

export function getRendererForSchema(s: FieldSchema): React.FC<FieldRendererProps> {
  const key = s.schema.items ? `array.${s.schema.items}` : s.schema.type;
  return registry.get(key) ?? TextFieldRenderer;
}
```

### Pattern 4: Pipeline of pure transformers

**What:** `field_transform::pipeline::apply_mapping` walks the saved mapping. For each row it picks one transformer (identified by `TransformerKind` enum stored in the mapping row), calls it with `(source_value, source_schema, target_schema, ctx)`, and accumulates the result into a target-fields map. Transformers are async (some need HTTP for user lookup) but each is pure given its inputs + the audit'd HTTP client in `ctx`.

**Why:** Composable, testable per-transformer; explicit error per field instead of one fail-everything. Each transformer is small enough to unit-test exhaustively.

**Trade-offs:** Async fan-out can be slow if every field needs an HTTP call. Mitigation: pipeline batches user lookups (collect all unique source usernames first, look them up once, then dispatch). Other transformers are sync.

**Example:**
```rust
// field_transform/mod.rs
#[async_trait]
pub trait Transformer: Send + Sync {
    async fn transform(
        &self,
        source_value: &Value,
        ctx: &TransformContext<'_>,
    ) -> Result<Value, TransformError>;
}

// pipeline.rs
pub async fn apply_mapping(
    source_issue: &Value,
    mapping: &FieldMapping,
    ctx: &TransformContext<'_>,
) -> Result<Map<String, Value>, Vec<TransformError>> {
    let mut out = Map::new();
    let mut errors = Vec::new();
    // First pass: collect all user references for batch lookup
    ctx.preload_user_lookups(source_issue, mapping).await?;
    // Second pass: per-row transform
    for row in &mapping.rows {
        let src_val = source_issue.pointer(&row.source_pointer()).unwrap_or(&Value::Null);
        let transformer = ctx.transformer_for(row.transformer_kind);
        match transformer.transform(src_val, ctx).await {
            Ok(v) => { out.insert(row.target_field_id.clone(), v); }
            Err(e) => errors.push(e),
        }
    }
    if errors.is_empty() { Ok(out) } else { Err(errors) }
}
```

### Pattern 5: Saved mapping + per-copy override layer

**What:** Two separate Zustand stores. `mappingStore` holds the persisted rows from `field_mapping` table. `overrideStore` holds inline overrides keyed by target field id. `DynamicTargetForm` resolves the value as `overrideStore.value ?? transformedFromMapping(source, mapping)`. On Confirm, `copy_ticket_v2` receives `(mapping_id, overrides)` — Rust applies the mapping then merges overrides on top before POSTing.

**Why:** Cleanly separates "how we want to copy by default" (saved, audited, editable in Settings) from "what we want this one time" (transient, no Settings round-trip). Override never mutates the saved mapping.

**Trade-offs:** Two stores instead of one. Worth it: clear mental model, simple "Save mapping" UX (only mappingStore is dirty-trackable), simple "Reset overrides" UX (overrideStore.clear()).

---

## Data flow

### Discovery flow (one-time per project/issue-type pair)

```
User opens MappingEditor
    |
schemaStore.refresh()
    |
invoke("discover_source_fields", { baseUrl: server_base })
    |
field_discovery.rs:
    cache hit?  → return rows from field_schema_cache
    cache miss? → GET /rest/api/2/field on Server v2
                 → parse into FieldSchema { id, name, schema: { type, items?, custom?, customId? } }
                 → write to mapping.db field_schema_cache (scope='source', project=NULL, issuetype=NULL)
                 → return rows
    |
invoke("discover_target_fields", { projectKey, issueTypeId })
    |
field_discovery.rs:
    cache hit on (projectKey, issueTypeId)?  → return
    cache miss? → GET /rest/api/3/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}
                 → parse `fields` object into FieldSchema list (includes `required` + `allowedValues`)
                 → write to mapping.db field_schema_cache
                 → return rows
    |
schemaStore: setSourceSchema(...), setTargetSchema(...)
    |
MappingEditor renders rows: source combobox (all source fields) → transformer combobox → target combobox
```

### Mapping save flow

```
User edits row in MappingEditor
    |
mappingStore.updateRow(rowIndex, partial)  → set { dirty: true }
    |
User clicks "Save"
    |
mappingStore.save()
    |
invoke("save_field_mapping", { rows: FieldMappingRow[] })
    |
commands::save_field_mapping:
    lock FieldMappingDb → DELETE FROM field_mapping; INSERT all new rows; UPDATE mapping_meta SET updated_at=now → unlock
    |
Audit entry written via existing audited client wrapper? NO — this is a pure local DB write.
Optionally write to AuditDb manually for traceability of mapping changes.
```

### Copy flow (replaces current confirmCopy)

```
User clicks "Copy" on a ticket card
    |
copyStore.startPreview(ticket)
    |
DynamicTargetForm mounts:
    fetch saved mapping from mappingStore
    fetch source + target schema from schemaStore (refresh if missing)
    for each mapping row:
        transformer.preview(source_field_value)  → display in target renderer
    overrideStore is empty initially
    |
User edits a person picker field → overrideStore.setOverride('assignee', { accountId: 'abc123' })
User edits a custom select → overrideStore.setOverride('customfield_10100', 8)
    |
DynamicTargetForm.isValid:
    for each target field where schema.required && !hasValue(field): isValid = false
    Confirm button disabled accordingly
    |
User clicks Confirm
    |
copyStore.confirmCopy(sourceBaseUrl, cloudBaseUrl)
    |
invoke("copy_ticket_v2", {
    sourceKey, sourceBaseUrl, targetBaseUrl,
    targetProjectKey, targetIssueTypeId,
    overrides: Record<string, unknown>,
})
    |
commands::copy_ticket_v2:
    1. fetch source v2 issue (existing pattern)
    2. load saved mapping from FieldMappingDb
    3. ctx = TransformContext::new(audited_client, cloud_creds, target_project_key, target_base_url)
    4. let mapped_fields = field_transform::pipeline::apply_mapping(&source, &mapping, &ctx).await?;
    5. merge overrides into mapped_fields
    6. validate against cached createmeta required-fields list (defensive double-check)
    7. POST /rest/api/3/issue with { fields: mapped_fields }
    8. delegate attachments/comments/worklogs/sub-tasks/remote link to existing helpers
       (extracted as pub fns from current copy_ticket — see Build Order below)
    9. set triage state copied
    |
Returns CopyTicketResult, same shape as today
```

### Person picker resolution flow

```
PersonPickerRenderer mounts with initialValue (e.g. source assignee email "alice@customer.com")
    |
useEffect: invoke("search_jira_users_by_domain", { domain: "customer.com" })
    |
Phase 16 command (already exists) — paginated GET /rest/api/3/user/search?query=@customer.com
    |
returns Vec<JiraUser>; component does exact email match
    |
match found? → pre-fill, mark as auto-resolved (badge)
no match?    → show empty picker, user must search/select manually
              → on user typing: invoke("search_jira_users_by_domain") with sub-domain or full email
```

### Required-field gating

Both layers:
- **Frontend:** `DynamicTargetForm` reads `schema.required` from cached target schema; disables Confirm button when any required field is empty. Real-time, no round-trip.
- **Rust:** `copy_ticket_v2` performs a defensive check just before POST — if mapped_fields + overrides do not cover all required fields from the cached createmeta, returns a structured error before the network call. This catches the case where target schema changed between cache time and copy time without the user refreshing.

NOT used: `editmeta`. `editmeta` requires an existing issue, which we don't have at create time. createmeta is the correct source for required-at-creation fields.

---

## v2 → v3 schema differences (translation layer responsibilities)

| Field | v2 source shape | v3 target shape | Transformer |
|-------|----------------|-----------------|-------------|
| `description` | wiki markup (string) or rendered HTML in `renderedFields.description` | ADF (`{ version: 1, type: "doc", content: [...] }`) | `wiki_to_adf` (uses existing `htmltoadf` crate, already a dep) |
| `assignee` / `reporter` | `{ name, displayName, emailAddress? }` | `{ accountId }` | `user` (search by email → accountId) |
| `priority` | `{ id, name }` | `{ id }` (id often differs across instances) | `identity` if id matches; `priority` transformer if name-based mapping required (lookup by name in target priorities list, returned by `/rest/api/3/priority` already cached today) |
| `versions`, `fixVersions` | `[{ id, name }]` (project-scoped) | `[{ id }]` where id is **target** project's version id | `version` (lookup by name in target project's `/project/{key}/versions`) |
| `components` | `[{ id, name }]` | `[{ id }]` target-project-scoped | `component` (lookup by name in `/project/{key}/components`) |
| `labels` | `["a", "b"]` | `["a", "b"]` | `identity` |
| `issuetype` | `{ id, name }` | `{ id }` (target project may not have same names) | New `issuetype` transformer: lookup by name in target createmeta issue types |
| `customfield_xxxxx` (single-select) | `{ id, value }` | `{ id }` or `{ value }` depending on field; target may have different option ids | identity if option id stable; otherwise lookup by `value` string match |
| `customfield_xxxxx` (multi-select) | `[{ value }]` | `[{ value }]` | identity-or-lookup, batched |
| `customfield_xxxxx` (date) | `"YYYY-MM-DD"` | `"YYYY-MM-DD"` | `identity` |
| `customfield_xxxxx` (number) | numeric | numeric | `identity` |

The mapping row data structure stores `{ source_field_id, target_field_id, transformer_kind }`. The transformer registry on the Rust side is the source of truth for which transformers exist; the frontend offers them as choices in the `MappingRow` "transformer" combobox, populated from a `list_transformers` Tauri command (or a static list shared via generated types).

---

## SQLite schema (mapping.db, new file)

```sql
-- Cache of discovered field schemas. scope='source' | 'target'.
-- For target, project_key + issue_type_id scope the rows; for source, both NULL.
CREATE TABLE IF NOT EXISTS field_schema_cache (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    scope           TEXT NOT NULL CHECK(scope IN ('source','target')),
    project_key     TEXT,                    -- NULL for source/global
    issue_type_id   TEXT,                    -- NULL for source/global
    field_id        TEXT NOT NULL,           -- "summary" | "customfield_10100" | ...
    field_name      TEXT NOT NULL,
    schema_json     TEXT NOT NULL,           -- raw schema object (type, items, custom, customId)
    required        INTEGER NOT NULL DEFAULT 0,
    allowed_values  TEXT,                    -- JSON array if applicable
    raw_response    TEXT,                    -- raw JSON for debugging (only on the first row per scope)
    cached_at       TEXT NOT NULL,
    UNIQUE(scope, project_key, issue_type_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_schema_scope ON field_schema_cache(scope, project_key, issue_type_id);

-- Saved mapping: one row per source→target field pair.
-- Only one global mapping for v0.4.0 (mapping_id=1). Multi-mapping is out of scope.
CREATE TABLE IF NOT EXISTS field_mapping (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    mapping_id          INTEGER NOT NULL DEFAULT 1,
    source_field_id     TEXT NOT NULL,        -- "summary" | "customfield_10100"
    target_field_id     TEXT NOT NULL,
    transformer_kind    TEXT NOT NULL,        -- "identity" | "user" | "version" | "wiki_to_adf" | ...
    transformer_config  TEXT,                 -- JSON for transformer-specific options
    enabled             INTEGER NOT NULL DEFAULT 1,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    UNIQUE(mapping_id, source_field_id, target_field_id)
);
CREATE INDEX IF NOT EXISTS idx_mapping_id ON field_mapping(mapping_id, sort_order);

-- Singleton metadata for the active mapping.
CREATE TABLE IF NOT EXISTS mapping_meta (
    id                INTEGER PRIMARY KEY CHECK(id = 1),
    target_project_key TEXT,
    target_issue_type_id TEXT,
    updated_at        TEXT NOT NULL,
    schema_version    INTEGER NOT NULL DEFAULT 1
);
```

`transformer_config` is a JSON column (not separate columns) because each transformer kind needs different options (e.g., `version` may want a fallback mode; `user` may want fail-on-no-match vs leave-empty). Keeping it as JSON avoids schema migration every time a transformer adds a knob.

The "global mapping" decision (PROJECT.md line 102) is enforced by `mapping_id=1` — there is no UI for additional mapping_ids in v0.4.0, but the column exists for future-proofing without forcing a migration.

---

## Mock server changes (specific routes + payloads)

### v2 router additions (`src-tauri/src/mock_server.rs build_v2_router`)

| Route | Returns |
|-------|---------|
| `GET /rest/api/2/field` | flat array of all fields known to mock (system fields + at least one customfield), each: `{ id, name, custom: bool, schema: { type, items?, custom?, customId? } }` |
| `GET /rest/api/2/issue/createmeta?projectKeys=...&issuetypeNames=...&expand=projects.issuetypes.fields` | nested `{ projects: [{ key, issuetypes: [{ id, name, fields: { ... } }] }] }` matching v2 format |

### v3 router additions (`build_v3_router`)

| Route | Returns |
|-------|---------|
| `GET /rest/api/3/field` | same shape as v2 |
| `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes` | `{ issueTypes: [{ id, name }] }` (paginated wrapper acceptable but not required for mock) |
| `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` | `{ fields: [{ fieldId, name, required, schema: {...}, allowedValues: [...] }] }` (Cloud uses an array of fields here, not a map; this differs from v2) |
| `GET /rest/api/3/issue/{key}/editmeta` | `{ fields: { customfield_10100: { required: false, schema: {...}, allowedValues: [...] }, ... } }` (object keyed by field id) |
| `GET /rest/api/3/project/{projectKey}/versions` | `[{ id, name, released }]` |
| `GET /rest/api/3/project/{projectKey}/components` | `[{ id, name }]` |

### `fixtures.rs` additions

```rust
pub struct FixtureState {
    pub server_v2_issues: HashMap<String, JiraIssue>,
    pub cloud_v3_issues: HashMap<String, JiraIssue>,
    // NEW
    pub field_schema_v2: Vec<FieldSchema>,
    pub field_schema_v3: Vec<FieldSchema>,
    pub createmeta_v3: HashMap<(String, String), CreateMeta>, // (project_key, issue_type_id) → response
    pub editmeta_v3: HashMap<String, EditMeta>,                // ticket_key → response
    pub project_versions: HashMap<String, Vec<JiraVersion>>,
    pub project_components: HashMap<String, Vec<JiraComponent>>,
}
```

The mock should expose at least:
- One **single-select custom field** (e.g. `customfield_10010` "Story Points" type=number)
- One **multi-select custom field** (e.g. `customfield_10020` "Affected Products" type=array.option)
- One **person custom field** (e.g. `customfield_10030` "Tech Lead" type=user)
- One **date custom field** (e.g. `customfield_10040` "Due Date" type=date)
- Differing v2 vs v3 representations of the same field where Atlassian's docs diverge (priority, user, versions)

This proves the renderer registry handles real-world variety and that the transform pipeline correctly translates v2 → v3 forms.

---

## Build Order (dependency chain)

The phases the roadmapper should derive must respect this dependency DAG:

```
1. Field-schema discovery + mock fixture support
       │ (provides FieldSchema rows)
       ▼
2. mapping.db schema + FieldMappingDb CRUD + Tauri commands (get/save mapping)
       │ (provides persistence layer)
       ▼
3. Frontend renderer registry + individual renderers (built in isolation, unit-tested)
       │ (provides field-aware UI components)
       ▼
4. MappingEditor settings page (uses 1+2+3 to display mapping table)
       │ (provides user-facing config workflow)
       ▼
5. Field transform pipeline (Rust) — pure transformers + integration with mapping
       │ (provides v2 → v3 translation)
       ▼
6. DynamicTargetForm (replaces hardcoded right column in CopyPreviewModal)
       │ (provides per-copy preview + override UI)
       ▼
7. copy_ticket_v2 command — wires pipeline + overrides + existing copy helpers
       │ (provides end-to-end mapping-driven copy)
       ▼
8. Required-field gating + audit logging of mapping decisions
       │ (provides safety + observability)
       ▼
9. Refactor: extract attachment/comment/worklog/sub-task helpers from old copy_ticket
   for reuse by copy_ticket_v2 (DEFERRED to here so old copy_ticket keeps working)
```

**Critical dependency notes:**

- Step 1 must include the mock fixture additions, otherwise step 2 has nothing to test against without a real Jira.
- Step 3 can proceed in parallel with step 2 — renderers are pure presentation, can be storybook-style developed against fake schemas.
- Step 5 (transform pipeline) and step 6 (DynamicTargetForm) can also proceed in parallel after step 4 ships — the pipeline returns shape `Map<String, Value>` and the form produces inputs of the same shape, so they meet in the middle.
- Step 7 must happen after both 5 and 6 are testable in isolation; copy_ticket_v2 is the integration point.
- Step 9 (refactor) is intentionally last so the old copy_ticket continues to work as a fallback during 1–8. After step 9, both copy_ticket and copy_ticket_v2 share the same downstream helpers, then copy_ticket can be deleted in v0.5.0.

---

## Integration points

### External services

| Service | Endpoint | Notes |
|---------|----------|-------|
| Jira Server v2 | `GET /rest/api/2/field` | Global field list incl. custom fields. Cached in mapping.db. |
| Jira Server v2 | `GET /rest/api/2/issue/createmeta?expand=projects.issuetypes.fields` | Project-scoped required fields for source side (used to discover source schema overrides per project) |
| Jira Cloud v3 | `GET /rest/api/3/field` | Cloud version of global field list. |
| Jira Cloud v3 | `GET /rest/api/3/issue/createmeta/{key}/issuetypes` | List of issue types for project — feeds IssueTypePickerRenderer. |
| Jira Cloud v3 | `GET /rest/api/3/issue/createmeta/{key}/issuetypes/{id}` | Per-issue-type field schema with required + allowedValues. **Primary source of target schema.** |
| Jira Cloud v3 | `GET /rest/api/3/project/{key}/versions` | For VersionPickerRenderer + version transformer name → id resolution. |
| Jira Cloud v3 | `GET /rest/api/3/project/{key}/components` | For component transformer name → id resolution. |
| Jira Cloud v3 | `GET /rest/api/3/user/search?query=@domain` | Reuses Phase 16 `search_jira_users_by_domain` command. NOT a new endpoint. |
| Jira Cloud v3 | `POST /rest/api/3/issue` | Final create call. Same as today. |

All discovery calls go through the existing `build_audited_client` so they appear in audit log automatically — same pattern as `fetch_cloud_meta`.

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `mappingStore` ↔ `field_mapping_db.rs` | Tauri commands `get_field_mapping`, `save_field_mapping` | Same lock-acquire-then-release pattern as triage_db |
| `schemaStore` ↔ `field_discovery.rs` | Tauri commands `discover_source_fields`, `discover_target_fields`, `refresh_field_schema` | Cache hit returns immediately; miss triggers HTTP |
| `DynamicTargetForm` ↔ `mappingStore` + `overrideStore` + `schemaStore` | Direct Zustand subscription | All three stores are read; only overrideStore is written from form |
| `DynamicTargetForm` ↔ renderers | Props (FieldRendererProps) | One-way data flow; renderer calls `onChange` callback into overrideStore |
| `copy_ticket_v2` ↔ `field_transform::pipeline` | Direct fn call | pipeline takes audited client, no direct Tauri State |
| `field_transform::user` ↔ existing user search | Direct call to `commands::search_jira_users_by_domain` helper extracted as pub fn | Or copy the fetch logic; either works, prefer extraction |
| Existing `copy_ticket` ↔ existing audit middleware | Unchanged | reqwest_middleware audit/redaction layer stays as-is |

---

## Anti-patterns to avoid

### Anti-pattern 1: Extending `triage_db.rs` with mapping tables

**What people do:** Add `field_schema_cache` and `field_mapping` columns/tables to the existing `triage.db` because "it's just more app config".

**Why wrong:** `triage_db.rs` is already 629 lines with 5 distinct concerns (triage state, connection metadata, fetch config, app config, language). Adding mapping makes it the dumping ground. Worse, mapping tables can be large (one row per field per project) and complicate triage backups.

**Do this instead:** New file `field_mapping_db.rs`, new SQLite file `mapping.db`, new `Arc<Mutex<FieldMappingDb>>` managed state. Follow the precedent set by `snapshot_db.rs` in v0.3.0.

### Anti-pattern 2: Big switch statement in `DynamicTargetForm`

**What people do:** Render the form with `switch (schema.type) { case 'user': return <PersonPicker .../>; case 'date': return <DatePicker .../>; ... }` inside `DynamicTargetForm.tsx`.

**Why wrong:** Every new field type modifies the form file. Tests for the form mix concerns. Custom fields require ad-hoc fall-through cases.

**Do this instead:** Registry table (`fields/registry.ts`) with `Map<string, React.FC<FieldRendererProps>>`. New field type = new file + one registry entry; the form file never changes.

### Anti-pattern 3: Auto-refresh field schema on every modal open

**What people do:** Call `/field` + `/createmeta` every time `CopyPreviewModal` opens to "always be current".

**Why wrong:** Two API calls + audit log entries on every copy attempt. In a busy session that's 50+ unnecessary calls. Schemas change quarterly at most.

**Do this instead:** Cache in `field_schema_cache` table. Show "Last refreshed: 3 days ago — refresh now?" link in MappingEditor. Optionally trigger one-time refresh on app version bump.

### Anti-pattern 4: Mutating saved mapping from per-copy override UI

**What people do:** When the user changes a person picker value in `CopyPreviewModal`, write it to `mappingStore` so "next time it's pre-filled correctly".

**Why wrong:** Per-copy intent ≠ global default. The user picked a different assignee for this one ticket, not "from now on". Writing to mappingStore means every override silently rewrites the user's saved configuration.

**Do this instead:** Two stores. `overrideStore` holds the per-copy value, lives only for the modal session, cleared on close. `mappingStore` only changes when the user explicitly saves the MappingEditor.

### Anti-pattern 5: Treating editmeta as a substitute for createmeta

**What people do:** Use `/rest/api/3/issue/{key}/editmeta` to determine required-at-create fields.

**Why wrong:** editmeta requires an existing issue. At the moment of copy, the issue doesn't exist yet. editmeta also reports edit-time required fields, which can differ from create-time required fields (e.g. fields with default values are required at create but not edit).

**Do this instead:** Use `/rest/api/3/issue/createmeta/{projectKey}/issuetypes/{issueTypeId}`. Reserve editmeta for a future "edit copied ticket" feature.

### Anti-pattern 6: Synchronous person-by-email lookup inside the transform pipeline

**What people do:** Inside the `user` transformer, call `search_jira_users_by_domain` separately for each user reference, awaiting one at a time.

**Why wrong:** A ticket with assignee + reporter + 3 watchers = 5 sequential HTTP calls. With 10 fields and 3 users each = 30 sequential calls. Slow.

**Do this instead:** First-pass walk in the pipeline collects all unique source emails, calls `search_jira_users_by_domain` once per unique domain, builds a `HashMap<email, accountId>`, then transformers consume the map. Single round-trip per domain regardless of field count.

---

## Scaling considerations (single-user desktop app)

| Concern | Practical limit | Mitigation |
|---------|-----------------|------------|
| `field_schema_cache` row count | ~50 system fields + ~50 custom × N projects × M issuetypes ≈ low thousands | Index on (scope, project_key, issue_type_id); negligible on disk |
| `field_mapping` row count | ~50 rows for one global mapping | No mitigation needed |
| Discovery latency on first open | ~1–3 sec for createmeta on a project with many issue types | Show skeleton renderer; cache aggressively |
| Per-copy transform time | < 100ms for ~30 fields, longer if user lookups required | Batch user lookups, parallel HTTP for independent transforms |
| Mock server fixture growth | Adding 4 custom fields × 2 versions × per-issue payloads | Define fixtures once in `build_fixtures()`; use builder helpers to avoid copy-paste sprawl |

---

## Recommended file layout (additions)

```
src-tauri/src/
├── field_discovery.rs                    # NEW
├── field_mapping_db.rs                   # NEW (mapping.db SQLite)
├── field_transform/
│   ├── mod.rs                            # NEW
│   ├── pipeline.rs                       # NEW
│   ├── identity.rs                       # NEW
│   ├── user.rs                           # NEW
│   ├── version.rs                        # NEW
│   ├── component.rs                      # NEW
│   ├── wiki_to_adf.rs                    # NEW
│   └── priority.rs                       # NEW
├── commands.rs                           # MODIFIED: 7 new commands
├── main.rs                               # MODIFIED: open mapping.db, register commands
├── lib.rs                                # MODIFIED: export new modules
├── mock_server.rs                        # MODIFIED: 6+ new routes
└── fixtures.rs                           # MODIFIED: schemas + custom fields

src/features/
├── mapping/                              # NEW feature dir
│   ├── schemaStore.ts
│   ├── mappingStore.ts
│   ├── overrideStore.ts
│   ├── MappingEditor.tsx
│   ├── MappingRow.tsx
│   ├── DynamicTargetForm.tsx
│   ├── fields/
│   │   ├── registry.ts
│   │   ├── types.ts
│   │   ├── TextFieldRenderer.tsx
│   │   ├── AdfFieldRenderer.tsx
│   │   ├── MultiSelectFieldRenderer.tsx
│   │   ├── VersionPickerRenderer.tsx
│   │   ├── PersonPickerRenderer.tsx
│   │   ├── DatePickerRenderer.tsx
│   │   ├── NumberFieldRenderer.tsx
│   │   ├── PriorityRenderer.tsx
│   │   └── IssueTypePickerRenderer.tsx
│   └── __tests__/
└── tickets/
    ├── CopyPreviewModal.tsx              # MODIFIED: right column → DynamicTargetForm
    ├── copyStore.ts                      # MODIFIED: confirmCopy → copy_ticket_v2
    └── types.ts                          # MODIFIED: re-export mapping types
```

---

## Sources

- [Jira REST API Example: Discovering Meta Data for Creating Issues](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/) — official Atlassian guide to createmeta usage (HIGH confidence)
- [Jira Cloud REST API v3 — Issue Fields group](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/) — `/field` endpoint reference for v3 (HIGH confidence)
- [Get all custom fields and values — Atlassian Developer Community](https://community.developer.atlassian.com/t/get-all-custom-fields-and-values/30154) — confirms custom field id pattern `customfield_<n>` and need for createmeta to discover (MEDIUM confidence — community thread; verified against Atlassian docs)
- [Get single field metadata — Atlassian Developer Community](https://community.developer.atlassian.com/t/get-single-field-metadata/73451) — schema response shape (MEDIUM confidence)
- Existing pmkar codebase, direct inspection (HIGH confidence):
  - `src-tauri/src/commands.rs` — `copy_ticket` (lines 1221–2024), `fetch_cloud_meta` (142–244), `search_jira_users_by_domain` (1096–1147)
  - `src-tauri/src/triage_db.rs` — single-row config + ALTER TABLE migration pattern
  - `src-tauri/src/snapshot_db.rs` — separate-file-per-DB-concern precedent
  - `src-tauri/src/main.rs` — `app.manage(Arc::new(Mutex::new(...)))` setup
  - `src-tauri/src/mock_server.rs` — axum `build_v2_router` and `build_v3_router`
  - `src-tauri/src/fixtures.rs` — `FixtureState` shape and `build_fixtures()` builder
  - `src/features/tickets/CopyPreviewModal.tsx` — current modal layout
  - `src/features/tickets/copyStore.ts` — current copy invocation
  - `src/features/tickets/types.ts` — current `CloudMeta` shape
- Prior milestone research: `.planning/milestones/v0.3.0-research/ARCHITECTURE.md` — established patterns (separate DB structs, ALTER TABLE migration, Zustand-per-feature, audited reqwest client)

---

*Architecture research for: pmkar v0.4.0 — configurable field mapping engine*
*Researched: 2026-04-27*
