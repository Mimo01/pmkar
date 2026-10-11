# Phase 24: Audit Log Copy-Time Resolution — Research

**Researched:** 2026-05-05
**Domain:** Rust backend audit logging, Tauri command layer, React audit UI
**Confidence:** HIGH — all findings verified directly from codebase source files

---

## Summary

Phase 24 fixes a misleading audit UI: users see `target: null` for `wiki_to_adf` and `user` fields after copying a ticket, and conclude the fields were not copied. The actual root cause is that the `mapping_audit_log` only contains preview-time pre-fill entries (written by `log_preview_transformations` when the copy preview opens), not copy-time resolution entries. The copy-time audit loop was explicitly removed from `copy_ticket_v2` (commands.rs:1544) on the premise that preview-time logging made it redundant — but this is wrong for the two async-resolution field types.

The fix has two parts: (1) after `apply_mapping` completes in `copy_ticket_v2`, write per-field audit rows with actual resolved values and a distinct outcome value (e.g. `'copied'`); (2) update the Field Transformations UI to display and summarise these new outcome rows correctly alongside the existing `ok`/`skipped`/`failed` outcomes.

All infrastructure needed already exists: `insert_mapping_audit`, `hash_field_value`, `redact_string_in_value`, `cap_audit_json`, and the grouping UI. The planner's work is to wire the call site in the command and extend the UI constants.

**Primary recommendation:** Add a copy-time audit loop in `copy_ticket_v2` immediately after the `apply_mapping` call (and after `override_values` merge), using the same `insert_mapping_audit` signature already used by `log_preview_transformations`. Use `outcome = "copied"` to distinguish copy-time entries from preview-time `"ok"` entries.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Write copy-time audit entries | API / Backend (Rust) | — | `apply_mapping` runs server-side; resolved field values only exist in Rust at copy time |
| Display copy-time entries in UI | Frontend (React) | — | AuditLogPage reads from the same `mapping_audit_log` table via existing `get_mapping_audit_log_page` |
| Distinguish outcome badge colors/labels | Frontend (React) | — | Badge rendering and i18n keys live in AuditLogPage.tsx and en.json/sk.json |
| Group copy-time + preview entries under same copyId | Frontend (React) | — | `groupByCopyId` already groups by `copyId` — same UUID must be threaded from frontend to backend |

---

## Research Questions Answered

### Q1: What does `apply_mapping` return? What data is available to log per-field outcomes?

`apply_mapping` returns `Result<ResolvedFields, TransformError>`.

`ResolvedFields` (from `src-tauri/src/field_transform/mod.rs`, confirmed via pipeline.rs imports):
```rust
pub struct ResolvedFields {
    pub fields: Map<String, Value>,  // target_field_id → resolved JSON value
    pub gaps: Vec<GapVariant>,       // fields that could not be resolved
}
```

After `apply_mapping` completes, `resolved.fields` contains the **actual resolved values** for every field that succeeded. For `wiki_to_adf` fields, this is the full ADF document JSON. For `user` fields, it is `{"accountId": "..."}` or absent if unresolvable (the gap is emitted instead). For `version`/`component` arrays, it is `[{"id":"..."}]`.

The `mapping_rows` slice (already available in `copy_ticket_v2` context) provides the per-row `source_field_id`, `target_field_id`, and `transformer_kind` needed to construct audit entries.

The `source_body` (the fetched source issue JSON) is also in scope at that point, so `source_body.pointer(&format!("/fields/{}", row.source_field_id))` gives the raw source value.

[VERIFIED: src-tauri/src/field_transform/pipeline.rs lines 17-103, commands.rs lines 1540-1548]

### Q2: What is the `mapping_audit_log` schema?

Full schema from `CREATE_MAPPING_AUDIT_LOG` in `field_mapping_db.rs` (lines 102-119):

```sql
CREATE TABLE IF NOT EXISTS mapping_audit_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    copy_id             TEXT NOT NULL,           -- UUID linking preview + copy entries
    field_id            TEXT NOT NULL,           -- target_field_id
    source_value_hash   TEXT NOT NULL,           -- SHA-256 of redacted source JSON
    target_value_hash   TEXT NOT NULL,           -- SHA-256 of redacted target JSON
    was_overridden      INTEGER NOT NULL DEFAULT 0,
    gap_kind            TEXT,                   -- NULL | "person" | "version" | "component"
    transformer_kind    TEXT NOT NULL DEFAULT '',
    outcome             TEXT NOT NULL DEFAULT 'ok',
    failure_reason      TEXT,
    timestamp           TEXT NOT NULL,           -- RFC 3339
    source_value_json   TEXT,                   -- nullable, capped at 4096 bytes, redacted
    target_value_json   TEXT,                   -- nullable, capped at 4096 bytes, redacted
    created_at          INTEGER DEFAULT (strftime('%s','now'))
);
```

Existing outcome values in use:
- `'ok'` — preview-time prefill succeeded (identity/priority fields)
- `'skipped'` — preview-time: async field, or source value missing
- `'failed'` — preview-time: explicit failure

New outcome value to introduce:
- `'copied'` — copy-time resolution succeeded (wiki_to_adf, user, version, component)

[VERIFIED: src-tauri/src/field_mapping_db.rs lines 102-119]

### Q3: How does `log_preview_transformations` write entries?

The existing Tauri command signature (commands.rs lines 1793-1839):
```rust
pub fn log_preview_transformations(
    copy_id: String,
    entries: Vec<PreviewTransformationLog>,
    mapping_db: tauri::State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError>
```

It wraps all inserts in a single SQLite transaction (`begin_transaction` / `commit_transaction`), swallows per-row errors (best-effort pattern), and caps the batch at 500 entries.

Each entry goes through:
1. `redact_string_in_value(&e.source_value)` — credential redaction
2. `hash_field_value(&src_red)` — SHA-256 hex
3. `serde_json::to_string(&src_red).ok().map(cap_audit_json)` — 4096-byte cap
4. `mdb.insert_mapping_audit(...)` — all 12 params

The `insert_mapping_audit` function signature (field_mapping_db.rs lines 554-568):
```rust
pub fn insert_mapping_audit(
    &self,
    copy_id: &str,
    field_id: &str,
    source_value_hash: &str,
    target_value_hash: &str,
    was_overridden: bool,
    gap_kind: Option<&str>,
    transformer_kind: &str,
    outcome: &str,
    failure_reason: Option<&str>,
    timestamp: &str,
    source_value_json: Option<&str>,
    target_value_json: Option<&str>,
) -> AppResult<()>
```

[VERIFIED: src-tauri/src/commands.rs lines 1793-1839, src-tauri/src/field_mapping_db.rs lines 554-591]

### Q4: Does the UI currently distinguish between different outcome values?

The UI uses a three-way badge color switch on `row.outcome` (AuditLogPage.tsx lines 764-773):
- `'ok'` → emerald green
- `'failed'` → red
- `'skipped'` → amber

The badge label comes from `t('audit.fields.outcome.${row.outcome}')` — a dynamic i18n key. This means a new outcome value `'copied'` will render as the raw string `"copied"` (key miss fallback) unless an i18n key is added:
- `"audit.fields.outcome.copied": "copied"` (or a more informative label like `"resolved at copy time"`)

The group summary in `FieldTransformationGroup` counts only `failed` and `skipped`:
```typescript
if (r.outcome === 'failed') failed += 1;
else if (r.outcome === 'skipped') skipped += 1;
```
A `'copied'` row will be counted in `total` but not in either named counter, which is semantically correct — it succeeded.

The `buildGroupCopyText` plain-text renderer (line 314) outputs `row.outcome` directly, so `'copied'` will appear verbatim. No change needed there.

[VERIFIED: src/features/tickets/AuditLogPage.tsx lines 253-280, 760-780]

### Q5: What is the copy_id / context linking pre-fill entries to copy-time entries?

The `previewCopyId` is generated in `CopyPreviewPage.tsx` (lines 137-148):
```typescript
const [previewCopyId, setPreviewCopyId] = useState<string | null>(null);
useEffect(() => {
  if (phase !== 'previewing') { setPreviewCopyId(null); return; }
  setPreviewCopyId(crypto.randomUUID());
}, [phase]);
```

This UUID is passed to `log_preview_transformations` as `copyId`, but it is **not** currently passed to `copy_ticket_v2`. The `CopyTicketV2Args` struct (commands.rs line 123) does not include a `copy_id` field.

**Design choice for Plan 01:**

Option A — Thread `previewCopyId` through `copyStore.confirmCopy` → `CopyTicketV2Args` → `copy_ticket_v2` so that copy-time entries share the same `copy_id` as preview-time entries. This groups all entries for a single copy operation under one UUID in the UI.

Option B — Generate a fresh UUID inside `copy_ticket_v2` (server-side) for copy-time entries. This produces a separate group in the UI.

Option A gives the best UX: users see both the preview snapshot and the actual copy-time resolution in one expanded group. It requires adding `copy_id: Option<String>` to `CopyTicketV2Args` and threading it from `copyStore.confirmCopy`.

[VERIFIED: src/features/tickets/CopyPreviewPage.tsx lines 134-148; src-tauri/src/commands.rs lines 123-145; src/features/tickets/copyStore.ts lines 229-248]

### Q6: Are there existing tests that cover the audit log writing path?

**Rust tests (field_mapping_db.rs):** 10+ tests covering `insert_mapping_audit`, `get_mapping_audit_log_page`, migration, SQL injection safety, JSON column persistence, legacy row fallback. These are the unit tests for the DB layer and do not need to change — the new copy-time entries use the same API.

**Rust integration test (copy_ticket_v2_integration.rs):** Covers the full `copy_pipeline` (attach, comments, worklogs, subtasks, remote link) against mock servers. Does NOT test audit log insertion because the test exercises `copy_pipeline` helpers directly (not the Tauri command layer where `FieldMappingDb` is injected). A new integration test would need to call `copy_ticket_v2` through the command layer with a real `FieldMappingDb` to verify entries are written — but this is complex to set up.

**Simpler test approach:** Add a unit test in `commands.rs` test module (or a separate file) that builds a `FieldMappingDb::open_in_memory()`, calls the new copy-time audit loop logic (extracted as a helper function), and asserts that rows with `outcome='copied'` appear for resolved fields and `outcome='skipped'`/`'failed'` for gaps.

**Frontend tests:** `AuditLogPage.test.tsx` and `AuditLogPage.fieldGrouping.test.tsx` cover existing rendering. Adding a test that renders a row with `outcome='copied'` and verifies the badge renders the correct label is straightforward.

[VERIFIED: src-tauri/tests/copy_ticket_v2_integration.rs; src-tauri/src/field_mapping_db.rs tests block]

---

## Standard Stack

No new libraries. All needed infrastructure already exists.

| Component | Already Exists | Location |
|-----------|---------------|----------|
| `insert_mapping_audit` | Yes | `field_mapping_db.rs:554` |
| `hash_field_value` | Yes | `field_mapping_db.rs:676` |
| `redact_string_in_value` | Yes | `commands.rs:1710` |
| `cap_audit_json` | Yes | `commands.rs:1771` |
| `MAX_AUDIT_JSON_BYTES` | Yes | `commands.rs:1767` |
| `begin_transaction` / `commit_transaction` | Yes | `field_mapping_db.rs:597-605` |
| `groupByCopyId` | Yes | `AuditLogPage.tsx:253` |
| Badge outcome rendering | Yes | `AuditLogPage.tsx:760-773` |
| i18n outcome keys | Partial | `en.json:277-279` (missing `'copied'`) |

---

## Architecture Patterns

### Pattern 1: Copy-Time Audit Loop in `copy_ticket_v2`

Insert the loop **after** `apply_mapping` completes and **after** `override_values` are merged (to reflect what was actually sent to Jira), but **before** the `create_issue` HTTP call (so failures before Jira API are still logged).

Location: commands.rs, after line 1552 (the override merge loop).

```rust
// Copy-time audit entries — written AFTER override merge so target values
// reflect what will actually be sent to Jira Cloud.
{
    let timestamp = chrono::Utc::now().to_rfc3339();
    let mdb = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    let _ = mdb.begin_transaction();
    for row in &mapping_rows {
        if row.target_field_id.is_empty() { continue; }
        let path = format!("/fields/{}", row.source_field_id);
        let src_val = source_body.pointer(&path).cloned().unwrap_or(Value::Null);
        let tgt_val = resolved.fields.get(&row.target_field_id)
            .cloned()
            .unwrap_or(Value::Null);

        // Determine outcome and gap_kind.
        let (outcome, gap_kind, failure_reason) = if !tgt_val.is_null() {
            ("copied", None, None)
        } else {
            // Check gaps for this field.
            let gap = resolved.gaps.iter().find(|g| g.target_field_id() == row.target_field_id);
            match gap {
                Some(GapVariant::Person(_)) => ("failed", Some("person"), Some("user not resolved")),
                Some(GapVariant::Version(_)) => ("failed", Some("version"), Some("version not resolved")),
                Some(GapVariant::Component(_)) => ("failed", Some("component"), Some("component not resolved")),
                None => ("skipped", None, Some("source value missing")),
            }
        };

        let was_overridden = args.override_values.contains_key(&row.target_field_id);
        let src_red = redact_string_in_value(&src_val);
        let tgt_red = redact_string_in_value(&tgt_val);
        let src_hash = hash_field_value(&src_red);
        let tgt_hash = hash_field_value(&tgt_red);
        let src_json = serde_json::to_string(&src_red).ok().map(cap_audit_json);
        let tgt_json = serde_json::to_string(&tgt_red).ok().map(cap_audit_json);
        let _ = mdb.insert_mapping_audit(
            &copy_id,  // threaded from CopyTicketV2Args
            &row.target_field_id,
            &src_hash,
            &tgt_hash,
            was_overridden,
            gap_kind,
            &row.transformer_kind,
            outcome,
            failure_reason,
            &timestamp,
            src_json.as_deref(),
            tgt_json.as_deref(),
        );
    }
    let _ = mdb.commit_transaction();
}
```

Note: `GapVariant` needs a `target_field_id()` accessor — verify the existing API of `GapVariant` variants to confirm field access pattern.

[ASSUMED] — exact `GapVariant` method names from field_transform/mod.rs not read; verify `UnresolvedPerson.target_field_id`, `UnresolvedVersion.target_field_id`, `UnresolvedComponent.target_field_id` are public fields (confirmed by pipeline.rs test code constructing these structs directly).

### Pattern 2: Extend `CopyTicketV2Args` to thread `copy_id`

Add `copy_id: Option<String>` to `CopyTicketV2Args`. In `copyStore.ts`, pass `previewCopyId` (already available in component state) down through `confirmCopy` and into the `invoke('copy_ticket_v2', { args: { ..., copyId: previewCopyId } })` call.

If `copy_id` is `None` (e.g., called programmatically without a preview), generate a fresh UUID server-side with `uuid::Uuid::new_v4().to_string()`. The `uuid` crate is already available (check Cargo.toml) — if not, use `chrono + rand` or a simple timestamp UUID as a fallback.

[ASSUMED] — uuid crate availability; verify with `grep -r "uuid" src-tauri/Cargo.toml`.

### Pattern 3: UI — Add `'copied'` Outcome

Two changes:
1. Add `"audit.fields.outcome.copied"` to `en.json` and `sk.json`.
2. Add a badge color branch for `row.outcome === 'copied'` — use blue/brand color to distinguish from green `'ok'` (preview prefill) and amber `'skipped'`.

The group header summary counts do not need to change: `'copied'` rows are successes and correctly excluded from `failed` and `skipped` counters.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hashing of field values | Custom hash | `hash_field_value` (field_mapping_db.rs:676) | Already exists, correct, tested |
| Credential redaction | Custom regex | `redact_string_in_value` (commands.rs:1710) | Matches project convention (str::contains, no regex) |
| JSON byte capping | Custom truncation | `cap_audit_json` (commands.rs:1771) | Handles UTF-8 char boundaries correctly |
| SQLite transaction wrapping | Manual BEGIN/COMMIT | `begin_transaction`/`commit_transaction` (field_mapping_db.rs:597-605) | Same pattern as `log_preview_transformations` |
| copyId UUID generation | Custom UUID | `crypto.randomUUID()` (already used in CopyPreviewPage.tsx:144) | Already threaded — just pass it through |

---

## Common Pitfalls

### Pitfall 1: Writing audit entries BEFORE `apply_mapping` returns

**What goes wrong:** If the audit loop runs before `apply_mapping`, there are no resolved values to log. The preview-time entries are already there — adding more null entries duplicates the confusing state.

**How to avoid:** Loop runs after `let mut resolved = apply_mapping(...).await?;` and after the override merge.

### Pitfall 2: Logging overridden fields with resolved (pre-override) values

**What goes wrong:** `resolved.fields` contains the `apply_mapping` output BEFORE `override_values` are merged. If an assignee was resolved by `apply_mapping` but then overridden by the user's GapsSection input, the audit log shows the resolved value but Jira received the override.

**How to avoid:** Run the audit loop AFTER the override merge loop (line 1550-1552 in commands.rs). Use `resolved.fields.get(&row.target_field_id)` — which by then contains the final merged value (because the override loop writes into `resolved.fields`).

Wait — confirmed that the override merge writes into `resolved.fields`:
```rust
for (k, v) in &args.override_values {
    resolved.fields.insert(k.clone(), v.clone());
}
```
So reading `resolved.fields` after the merge gives the correct final value.

[VERIFIED: commands.rs lines 1549-1552]

### Pitfall 3: Duplicate audit entries for the same copy_id

**What goes wrong:** If `copy_id` from the frontend matches the `previewCopyId`, the same `copy_id` will have both preview-time entries (from `log_preview_transformations`) and copy-time entries (from the new loop). The group UI groups all rows under one `copy_id` — this is the DESIRED behavior. However, for fields that are both prefilled (`identity`/`priority`) AND are in `mapping_rows`, there will be two entries per field: one `'ok'` (preview) and one `'copied'` (copy).

**Impact:** This is acceptable and informative — the user sees both the pre-fill snapshot and the copy-time outcome. The duplicate-field display is not a bug. If it is deemed noisy, filter by `outcome !== 'ok'` in preview entries for fields that also have a `'copied'` entry — but this is a follow-up concern, not a blocker.

### Pitfall 4: `gap_kind` mismatch with `GapVariant` enum

**What goes wrong:** `gap_kind` values in the DB are `"person"`, `"version"`, `"component"` (lowercase). The `GapVariant` enum uses `Person`, `Version`, `Component` (PascalCase) as variant names. The DB string representation must be derived from the variants by hand.

**How to avoid:** Use explicit string literals `"person"`, `"version"`, `"component"` in the audit loop (same as `log_preview_transformations` does with `e.gap_kind.as_deref()`).

### Pitfall 5: `mapping_db` lock held across async boundary

**What goes wrong:** `FieldMappingDb` uses `Arc<Mutex<_>>` (std mutex). Holding the lock across `.await` points would deadlock or block the async runtime.

**How to avoid:** Lock, do all synchronous DB writes, then drop the lock before any `.await`. The audit loop is entirely synchronous (no HTTP calls, no `.await`). Keep it in a scoped block `{ let mdb = mapping_db.lock()...; ... }` to release before the next async step.

[VERIFIED: commands.rs pattern for mapping_db lock usage at line 1805-1808]

### Pitfall 6: `target_field_id` of empty-string dismissed rows

**What goes wrong:** `mapping_rows` may include rows with `target_field_id = ""` (dismissed suggestions). Logging these produces a spurious audit entry with `field_id = ""`.

**How to avoid:** Skip rows where `row.target_field_id.is_empty()` — same guard used in `apply_mapping`'s duplicate-target check (pipeline.rs line 37).

---

## Code Examples

### Verified: Insert audit entry pattern (from log_preview_transformations)

```rust
// Source: src-tauri/src/commands.rs:1816-1835
let src_red = redact_string_in_value(&e.source_value);
let tgt_red = redact_string_in_value(&e.target_value);
let src_hash = hash_field_value(&src_red);
let tgt_hash = hash_field_value(&tgt_red);
let src_json = serde_json::to_string(&src_red).ok().map(cap_audit_json);
let tgt_json = serde_json::to_string(&tgt_red).ok().map(cap_audit_json);
let _ = mdb.insert_mapping_audit(
    &copy_id,
    &e.target_field_id,
    &src_hash,
    &tgt_hash,
    e.was_overridden,
    e.gap_kind.as_deref(),
    &e.transformer_kind,
    &e.outcome,
    e.failure_reason.as_deref(),
    &timestamp,
    src_json.as_deref(),
    tgt_json.as_deref(),
);
```

### Verified: groupByCopyId — already handles mixed outcome rows

```typescript
// Source: src/features/tickets/AuditLogPage.tsx:253-281
export function groupByCopyId(rows: MappingAuditEntry[]): FieldTransformationGroup[] {
  const map = new Map<string, MappingAuditEntry[]>();
  for (const row of rows) {
    const arr = map.get(row.copyId);
    if (arr) { arr.push(row); }
    else { map.set(row.copyId, [row]); }
  }
  // ... counts failed and skipped, 'copied' goes into total only
}
```

### Verified: Badge rendering — add 'copied' branch

```typescript
// Source: src/features/tickets/AuditLogPage.tsx:760-773 — ADD blue branch for 'copied'
<Badge
  variant="outline"
  className={cn(
    'text-[10px] font-mono',
    row.outcome === 'ok' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    row.outcome === 'copied' && 'bg-blue-500/15 text-blue-400 border-blue-500/20',  // NEW
    row.outcome === 'failed' && 'bg-red-500/15 text-red-400 border-red-500/20',
    row.outcome === 'skipped' && 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  )}
>
  {t(`audit.fields.outcome.${row.outcome}`)}
</Badge>
```

### Verified: CopyPreviewPage previewCopyId wiring

```typescript
// Source: src/features/tickets/CopyPreviewPage.tsx:137-148
const [previewCopyId, setPreviewCopyId] = useState<string | null>(null);
useEffect(() => {
  if (phase !== 'previewing') { setPreviewCopyId(null); return; }
  setPreviewCopyId(crypto.randomUUID());
}, [phase]);

// And in confirmCopy (copyStore.ts line 230):
// Must add: copyId: previewCopyId (thread from component state to store action)
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| Copy-time audit loop in `copy_ticket_v2` | Removed as "redundant" (line 1544) | Problem — re-add with distinct outcome |
| All field outcomes shown in one UI group | groupByCopyId by copyId (quick task 260430-26i) | Correct pattern — extend, don't change |
| Preview entries use `outcome='ok'/'skipped'/'failed'` | Same | Stable — add `'copied'` as new value |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GapVariant::Person/Version/Component` have public `target_field_id` fields (not methods) | Architecture Patterns | Compile error — use `.target_field_id` vs method call; fixable in minutes |
| A2 | `uuid` crate is in `src-tauri/Cargo.toml` | Architecture Patterns | If absent, use `chrono + thread_rng` or just pass copy_id from frontend; low risk since frontend UUID is the preferred approach anyway |
| A3 | `MappingAuditEntry` TypeScript type in `types.ts` already has `copyId` as camelCase | Plan 02 UI | Already confirmed via AuditLogPage.tsx line 256 using `row.copyId` |

---

## Open Questions (RESOLVED)

1. **Should copy-time and preview-time entries share the same `copy_id`?**
   - What we know: `previewCopyId` is a frontend-generated UUID passed to `log_preview_transformations`. It is not currently threaded to `copy_ticket_v2`.
   - RESOLVED: Yes — one combined group. Thread `previewCopyId` from `CopyPreviewPage.handleConfirm` through `copyStore.confirmCopy` into `CopyTicketV2Args.copy_id` so all entries share one group in the UI. Implemented in Plan 24-01 Task 2.

2. **Should the group summary header distinguish 'copied' entries?**
   - What we know: The header currently shows `N fields · X failed · Y skipped`. `'copied'` rows count toward total only.
   - RESOLVED: No change for Phase 24. `'copied'` is a success state; group header remains "N fields · X failed · Y skipped". `groupByCopyId` counter logic unchanged. Implemented in Plan 24-02 Task 1.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 24 is a pure code change in an existing codebase. No new external dependencies required. All tools (Rust toolchain, Node, Vitest) are confirmed working from recent Phase 23 activity.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Rust) | `cargo test` (tokio for async, rusqlite for SQLite) |
| Framework (Frontend) | Vitest 4.x |
| Quick run (Rust) | `cargo test -p pmkar-lib field_mapping_db` |
| Quick run (Frontend) | `npx vitest run src/features/tickets/AuditLogPage` |
| Full suite | Pre-commit hook (lint + type-check + test + clippy + fmt) |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| Plan 01: copy-time entries written | `insert_mapping_audit` called with `outcome='copied'` for resolved fields after copy | Rust unit | `cargo test -p pmkar-lib -- copy_time_audit` |
| Plan 01: skipped entries for missing source | Rows with `outcome='skipped'` for null source values | Rust unit | Same test function |
| Plan 01: failed entries for gaps | `gap_kind='person'` + `outcome='failed'` when user not resolved | Rust unit | Same test function |
| Plan 01: copy_id threading | `CopyTicketV2Args.copy_id` passes through to inserted rows | Rust unit | Same test function |
| Plan 02: 'copied' badge renders | Badge shows blue, label from i18n key | Frontend unit | `npx vitest run src/features/tickets/__tests__/AuditLogPage` |
| Plan 02: i18n key exists | `t('audit.fields.outcome.copied')` resolves | Frontend unit | Same |
| Plan 02: group summary unchanged | `'copied'` rows not counted in `failed`/`skipped` | Frontend unit | `npx vitest run -- --reporter=verbose AuditLogPage.fieldGrouping` |

### Wave 0 Gaps

- [ ] Rust test `copy_time_audit_entries_written` — covers Plan 01; tests the new loop logic against `FieldMappingDb::open_in_memory()`.
- [ ] Frontend test — renders a `MappingAuditEntry` with `outcome='copied'` and asserts blue badge and i18n label.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes | `cap_audit_json` (4096-byte cap), batch limit 500 (already applied to `log_preview_transformations`) |
| V6 Cryptography | N/A | SHA-256 for hashing, not for encryption |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via field_id | Tampering | `params![]` binding already enforced by `insert_mapping_audit`; SQL injection test exists (field_mapping_db.rs:1116) |
| Unbounded JSON value (DoS) | DoS | `cap_audit_json` at 4096 bytes; already applied in existing path |
| Credential leak via field values | Information Disclosure | `redact_string_in_value` applied before hash and JSON persist; markers: Bearer/Basic/eyJ/xoxb-/xoxp-/AKIA/ASIA |

---

## Sources

### Primary (HIGH confidence — verified from codebase files)

- `src-tauri/src/commands.rs` — `copy_ticket_v2` (lines 1413-1600), `log_preview_transformations` (1793-1839), `redact_string_in_value` (1710-1725), `cap_audit_json` (1771-1780)
- `src-tauri/src/field_mapping_db.rs` — `mapping_audit_log` schema (102-119), `insert_mapping_audit` (554-591), `hash_field_value` (676-686), `begin_transaction`/`commit_transaction` (597-605), `get_mapping_audit_log_page` (611-644)
- `src-tauri/src/field_transform/pipeline.rs` — `apply_mapping` return type `ResolvedFields { fields, gaps }` (17-103)
- `src/features/tickets/AuditLogPage.tsx` — badge rendering (760-773), `groupByCopyId` (253-281), outcome counts (265-270)
- `src/features/tickets/CopyPreviewPage.tsx` — `PREFILLABLE_KINDS` (83), `previewCopyId` (137-148), pre-fill loop (182-249)
- `src/features/tickets/copyStore.ts` — `confirmCopy` → `invoke('copy_ticket_v2', ...)` (229-248)
- `src/i18n/locales/en.json` — existing outcome i18n keys (277-279)
- `.planning/debug/wiki-adf-user-map-copy-skip.md` — root cause analysis (verified)
- `src-tauri/tests/copy_ticket_v2_integration.rs` — existing integration test coverage

---

## Metadata

**Confidence breakdown:**
- Root cause: HIGH — verified from debug session + source code
- Insert path: HIGH — verified from existing `log_preview_transformations` implementation
- UI rendering: HIGH — verified from AuditLogPage.tsx badge switch
- copy_id threading: HIGH — verified flow from CopyPreviewPage → copyStore; exact field additions are implementation details but the path is clear
- GapVariant field access: MEDIUM — struct fields visible in pipeline.rs tests but mod.rs not read

**Research date:** 2026-05-05
**Valid until:** Until next significant changes to `commands.rs` copy_ticket_v2 or `field_mapping_db.rs` schema
