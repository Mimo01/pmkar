---
phase: 23-copy-ticket-v2-wiring
plan: 02
subsystem: database
tags: [audit, sqlite, rusqlite, sha256, credential-sanitizer, migration, triage_db, field_mapping_db]

# Dependency graph
requires:
  - phase: 23-copy-ticket-v2-wiring plan 01
    provides: copy_pipeline.rs CopyContext and extracted helpers (D-08/D-09)

provides:
  - audit_verbose boolean flag on TriageDb app_config (D-06) with idempotent ALTER migration + getter/setter
  - mapping_audit_log table on FieldMappingDb mapping.db (D-05) with insert API
  - redact_credential_value() — plain str::contains sanitizer covering Bearer/Basic/eyJ/xoxb-/xoxp-/AKIA/ASIA (D-07)
  - hash_field_value() — deterministic SHA-256 hex digest of serde_json::Value
  - get_target_project_key() convenience getter for Plan 23-03 (CUTV-04)

affects:
  - 23-copy-ticket-v2-wiring plan 03 — consumes all pub API items delivered here

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "idempotent ALTER migration: let _ = conn.execute_batch(ALTER_*) — error suppressed for existing column, mirrors all prior ADD COLUMN migrations"
    - "CREATE TABLE IF NOT EXISTS for new tables: hard ? fail on schema corruption (not let _ =)"
    - "rusqlite::params![] for all INSERT bindings — never format!() or string interpolation"
    - "bool → i64 via i64::from(bool) — avoids clippy::cast_lossless"
    - "too_many_arguments allow annotation on domain-required 7-param insert method"

key-files:
  created: []
  modified:
    - src-tauri/src/triage_db.rs
    - src-tauri/src/field_mapping_db.rs

key-decisions:
  - "[Phase 23-02] mapping_audit_log lives in mapping.db (FieldMappingDb), not audit.db — keeps audit-of-mapping next to mapping data; avoids polluting audit.db whose audit_log table records HTTP calls (structurally different)"
  - "[Phase 23-02] redact_credential_value uses plain str::contains (no regex dep) — consistent with commands.rs:1403 and field_transform/user.rs:202 project convention"
  - "[Phase 23-02] insert_mapping_audit annotated #[allow(clippy::too_many_arguments)] — 7 domain params required by schema column set; no logical grouping that would justify a struct without adding complexity"
  - "[Phase 23-02] bool → i64 via i64::from(verbose) instead of verbose as i64 — clippy::cast_lossless compliance"

patterns-established:
  - "redact_credential_value: call before any logging or hashing of field values in copy_ticket_v2"
  - "hash_field_value: deterministic SHA-256 of JSON-serialized serde_json::Value; same approach as compute_schema_hash"

requirements-completed:
  - CUTV-03

# Metrics
duration: 22min
completed: 2026-04-28
---

# Phase 23 Plan 02: Audit Infrastructure Summary

**Persistent `audit_verbose` flag in TriageDb and `mapping_audit_log` table in FieldMappingDb with SHA-256 hasher, credential sanitizer, and SQL-injection-safe insert API**

## Performance

- **Duration:** 22 min
- **Started:** 2026-04-28T21:10:00Z
- **Completed:** 2026-04-28T21:32:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 2

## Accomplishments

- `audit_verbose` INTEGER column added to `app_config` in TriageDb with idempotent ALTER migration (same `let _ =` pattern as all prior ADD COLUMN migrations); getter and setter exposed as pub methods defaulting false
- `mapping_audit_log` table created in FieldMappingDb (mapping.db) with 9 columns; `insert_mapping_audit()` uses `rusqlite::params![]` exclusively — SQL injection regression test passes (T-23-T2 mitigation)
- `redact_credential_value()` free function covers all 7 credential markers (Bearer, Basic, eyJ, xoxb-, xoxp-, AKIA, ASIA) via plain `str::contains` — no regex dependency
- `hash_field_value()` free function produces deterministic SHA-256 hex from JSON-serialized `serde_json::Value` — mirrors existing `compute_schema_hash` pattern
- `get_target_project_key()` convenience getter wraps 4-tuple `get_project_keys()` for Plan 23-03 (CUTV-04)
- 14 new unit tests (5 in triage_db, 9 in field_mapping_db); all pass; zero new clippy errors

## Task Commits

1. **Task 1: Add audit_verbose flag to TriageDb** - `db34b3c` (feat)
2. **Task 2: Add mapping_audit_log + insert API + sanitizer + hasher to FieldMappingDb** - `651ca0b` (feat)

## New Public API

| Function | Signature | File |
|----------|-----------|------|
| `get_audit_verbose` | `(&self) -> AppResult<bool>` | triage_db.rs |
| `set_audit_verbose` | `(&self, verbose: bool) -> AppResult<()>` | triage_db.rs |
| `get_target_project_key` | `(&self) -> AppResult<Option<String>>` | triage_db.rs |
| `insert_mapping_audit` | `(&self, copy_id, field_id, src_hash, tgt_hash, was_overridden, gap_kind, timestamp) -> AppResult<()>` | field_mapping_db.rs |
| `redact_credential_value` | `(s: &str) -> String` | field_mapping_db.rs |
| `hash_field_value` | `(v: &serde_json::Value) -> String` | field_mapping_db.rs |

## mapping_audit_log Table Schema

```sql
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
```

## Files Created/Modified

- `src-tauri/src/triage_db.rs` — ALTER constant + open() wiring (2x) + get/set_audit_verbose + get_target_project_key + 5 tests (+82 lines)
- `src-tauri/src/field_mapping_db.rs` — DDL constant + open() wiring (2x) + insert_mapping_audit + redact_credential_value + hash_field_value + 9 tests (+214 lines)

## Test Counts

| File | Pre-existing | New | Total |
|------|-------------|-----|-------|
| triage_db.rs | 11 | 5 | 16 |
| field_mapping_db.rs | 16 | 9 | 25 |

## Decisions Made

- `mapping_audit_log` placed in `mapping.db` (FieldMappingDb), not `audit.db` — mapping decisions are structurally different from HTTP call audit records; colocation with mapping data is more coherent
- `redact_credential_value` uses plain `str::contains` (no regex) — consistent with project convention at commands.rs:1403 and field_transform/user.rs:202
- `insert_mapping_audit` uses `#[allow(clippy::too_many_arguments)]` — all 7 params are required schema columns with no logical grouping
- `bool → i64` conversion uses `i64::from(bool)` (not `as i64`) for clippy::cast_lossless compliance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced assert_eq! with bool literals with assert!()/assert!(!)**
- **Found during:** Task 1 (clippy verification)
- **Issue:** `assert_eq!(x, false)` and `assert_eq!(x, true)` trigger clippy::bool_assert_comparison — -D warnings fails
- **Fix:** Replaced with `assert!(!x)` and `assert!(x)` in all 3 affected test assertions
- **Files modified:** src-tauri/src/triage_db.rs
- **Verification:** clippy passes with zero triage_db errors
- **Committed in:** db34b3c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed doc comments missing backticks around code identifiers**
- **Found during:** Task 1 (clippy verification)
- **Issue:** `audit_verbose`, `mapping_audit_log`, `INSERT OR IGNORE`, `target_project_key`, `get_project_keys()`, `copy_ticket_v2`, `Ok(None)` in doc comments triggered clippy::doc_markdown — -D warnings fails
- **Fix:** Added backticks to all code identifiers in doc comments
- **Files modified:** src-tauri/src/triage_db.rs
- **Verification:** clippy passes with zero triage_db errors
- **Committed in:** db34b3c (Task 1 commit)

**3. [Rule 1 - Bug] Replaced `verbose as i64` with `i64::from(verbose)`**
- **Found during:** Task 1 (clippy verification)
- **Issue:** `verbose as i64` triggers clippy::cast_lossless — -D warnings fails
- **Fix:** Used `i64::from(verbose)` which is the infallible idiomatic form
- **Files modified:** src-tauri/src/triage_db.rs
- **Verification:** clippy passes with zero triage_db errors
- **Committed in:** db34b3c (Task 1 commit)

**4. [Rule 1 - Bug] Added #[allow(clippy::too_many_arguments)] on insert_mapping_audit**
- **Found during:** Task 2 (clippy verification)
- **Issue:** 7 domain params + &self = 8 total args triggers clippy::too_many_arguments (limit 7)
- **Fix:** Added `#[allow(clippy::too_many_arguments)]` annotation — all 7 params are required by schema; no logical grouping improves the API
- **Files modified:** src-tauri/src/field_mapping_db.rs
- **Verification:** clippy passes with zero field_mapping_db errors
- **Committed in:** 651ca0b (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 - clippy compliance)
**Impact on plan:** All fixes necessary for clippy -D warnings compliance. No scope creep.

## Known Stubs

None — all public API items are fully implemented with real logic. No placeholder returns.

## Threat Flags

No new threat surface introduced beyond what is in the plan's threat model. All threat mitigations from T-23-06 through T-23-09 are implemented as specified.

## Issues Encountered

Pre-existing clippy errors (28 errors in probe_createmeta.rs, mock_server.rs, audit.rs, field_discovery.rs, field_transform/identity.rs, field_transform/pipeline.rs, field_transform/version.rs) are out of scope for this plan. These errors existed before Plan 23-02 execution and are unchanged. Deferred to `deferred-items.md` tracking.

## Next Phase Readiness

- Plan 23-03 (`copy_ticket_v2` implementation) can now consume all 6 pub API items
- `get_audit_verbose()` reads the persistent flag for hash-only vs verbose mode decision
- `insert_mapping_audit()` is the single write path for mapping decisions (T-23-T2 mitigation verified)
- `redact_credential_value()` and `hash_field_value()` are ready to be called in the mapping audit loop
- `get_target_project_key()` provides the CUTV-04 target project key without tuple unpacking

---
*Phase: 23-copy-ticket-v2-wiring*
*Completed: 2026-04-28*
