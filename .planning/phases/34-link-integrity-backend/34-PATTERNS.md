# Phase 34: Link Integrity Backend - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 4 modified (plus 1 optional new test file)
**Analogs found:** 4 / 4 (all in-file or sibling analogs; this is a small in-repo change)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/triage_db.rs` (add `get_copied_key`, `relink`; change `set_triage`, `delete_triage_entries`; tests) | model/db | CRUD | `set_triage_copied` / `delete_triage_entries` (same file) | exact |
| `src-tauri/src/commands.rs` (add `relink_ticket`, `validate_triage_state`, `ensure_not_linked`; edit `set_triage_state`, `copy_ticket_v2`) | command | request-response | `set_triage_state` / `delete_done_triage` (same file L1040-1070) | exact |
| `src-tauri/src/main.rs` (register `relink_ticket`) | config | n/a | existing `generate_handler!` list L232-233 | exact |
| `src-tauri/src/triage_db.rs` tests (old-shape DB, D-16) | test | file-I/O | `tempfile = "3"` dev-dep; `MIGRATE_TRIAGE_CHECK_HANDLED` (L52-66) | role-match |
| `src-tauri/tests/*.rs` (optional mock/integration) | test | request-response | `tests/copy_ticket_v2_integration.rs` | partial (not needed; see notes) |

## Pattern Assignments

### `src-tauri/src/triage_db.rs` (db, CRUD)

**Analog:** `set_triage_copied` (L197-206), `set_triage` (L208-217), `delete_triage_entries` (L449-464).

**Imports** (L1-5): `use crate::error::AppResult;` only. A refusal in `set_triage` needs `AppError`, so change to `use crate::error::{AppError, AppResult};`.

**Writer pattern to copy for `relink`** (L197-206):
```rust
pub fn set_triage_copied(&self, source_key: &str, target_key: &str) -> AppResult<()> {
    let now = chrono::Utc::now().to_rfc3339();
    self.conn.execute(
        "INSERT INTO triage_state (ticket_key, state, first_seen, last_updated, copied_key)
         VALUES (?1, 'copied', ?2, ?2, ?3)
         ON CONFLICT(ticket_key) DO UPDATE SET state='copied', last_updated=?2, copied_key=?3",
        rusqlite::params![source_key, now, target_key],
    )?;
    Ok(())
}
```
New `relink` (RESEARCH Pattern 1): `UPDATE ... SET state='copied', last_updated=?1 WHERE ticket_key=?2 AND copied_key IS NOT NULL`; `n == 0` returns `Ok(None)`; otherwise `SELECT copied_key`. Use the two-statement form.

**Optional-row lookup pattern for `get_copied_key`** (L396-412 `get_project_keys`): `use rusqlite::OptionalExtension;` then `.query_row(..., |row| row.get::<_, Option<String>>(0)).optional()?`, then flatten: `.flatten()`. Unknown ticket gives `None`, keyless gives `None`.

**`set_triage` refusal** (edit L208): add at top
```rust
if state == "copied" {
    return Err(AppError::Internal(
        "State 'copied' cannot be set directly; use relink_ticket or the copy flow".into()));
}
```
Check that `AppError::Internal` exists in `src-tauri/src/error.rs` (serializes as bare message).

**Delete guard** (edit L459):
```rust
let sql = format!("DELETE FROM triage_state WHERE ticket_key IN ({placeholders}) AND copied_key IS NULL");
```
Keep placeholder-only interpolation (L453-462). Update the doc comment: returns rows actually deleted.

**Test conventions** (L486-621): `fn new_db() -> TriageDb { TriageDb::open_in_memory().expect(...) }`; `#[test]` with `.expect("... failed")` and `get_all_triage()` returning `HashMap<String,(String,Option<String>)>`; assertion messages included. Tests needing a Linked row must use `set_triage_copied`, not `set_triage`. Existing `test_delete_triage_entries_*` tests (L596-621) use keyless rows and keep passing. Note `test_invalid_triage_state_rejected` (L576) still passes.

**Old-shape DB test (D-16)**: tempfile is already a dev-dependency (`Cargo.toml` L54-55), so use `tempfile::tempdir()`. Seed via `rusqlite::Connection::open(path)`:
```sql
CREATE TABLE triage_state (
  ticket_key TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied')),
  first_seen TEXT NOT NULL, last_updated TEXT NOT NULL);
```
then `ALTER TABLE triage_state ADD COLUMN copied_key TEXT;` (const `ALTER_TRIAGE_ADD_COPIED_KEY`, L47) and inserts (linked with key, ignored with key, keyless). The seed SQL (including comments) must not contain the literal `'handled'`, because `migrate_triage_check_constraint` (L125-140) checks `existing_sql.contains("'handled'")`. Drop the connection, then `TriageDb::open(path)` (L142) and assert relink / `get_copied_key` / delete behaviour. The migration copies `copied_key` via INSERT...SELECT (L61-62).

---

### `src-tauri/src/commands.rs` (command, request-response)

**Analog:** `set_triage_state` and `delete_done_triage` (L1040-1070).

**Existing validator to edit** (L1046-1058):
```rust
match state.as_str() {
    "new" | "seen" | "ignored" | "copied" | "handled" => {}
    _ => {
        return Err(AppError::Internal(format!(
            "Invalid triage state: '{state}'. Must be one of: new, seen, ignored, copied, handled"
        )));
    }
}
let db = triage_db
    .lock()
    .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
db.set_triage(&ticket_key, &state)
```
Change: extract `fn validate_triage_state(state: &str) -> Result<(), AppError>` (testable without Tauri `State`), drop `"copied"` from the accepted arm, add an explicit `"copied"` arm before the `_` arm with a pointed message (re-link / copy flow), and update the "Must be one of" text to `new, seen, ignored, handled`.

**New `relink_ticket`** (copy the lock pattern above; RESEARCH Code Examples):
```rust
#[tauri::command]
pub fn relink_ticket(ticket_key: String, triage_db: State<'_, Arc<Mutex<TriageDb>>>)
    -> Result<Option<String>, AppError> {
    let db = triage_db.lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.relink(&ticket_key)
}
```
Place it after `delete_done_triage` (L1070).

**Guard in `copy_ticket_v2`** (L1611-1625): insert before `get_cloud_credentials` (L1625), and ideally before `build_audited_client` (L1618). Lock scoped in a block, as in L1634-1637 (`let target_project_key = { let g = triage_db.lock().map_err(...)?; ... };`), so the std Mutex guard is never held across `.await`:
```rust
{
    let g = triage_db.lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    ensure_not_linked(&g, &args.source_key)?;
}
```
Define `pub(crate) fn ensure_not_linked(db: &TriageDb, source_key: &str) -> AppResult<()>` (RESEARCH Pattern 4), message containing the stable phrase `already linked to {KEY}`. `args.source_key` is already used at L1852.

**Callers of the delete guard** need no change: `fetch_tickets` L818-820 (`tdb.delete_triage_entries(&done_keys)?;` return ignored) and `delete_done_triage` L1069.

**Tests**: add into the existing `mod tests { use super::*; ... }` at L2321-2322, plain `#[test]` with `TriageDb::open_in_memory()`. Cover `validate_triage_state` and `ensure_not_linked` (Err contains key for Linked, ignored-with-key, new-with-key; Ok for keyless and unknown).

---

### `src-tauri/src/main.rs` (config)

Register in the `generate_handler!` list, immediately after L233:
```rust
            commands::set_triage_state,
            commands::delete_done_triage,
            commands::relink_ticket,
```
Check `capabilities/` and `build.rs` for any per-command permission list (assumption A3); mirror whatever `set_triage_state` does.

---

### Mock server / integration tests (optional)

No request recorder exists in `mock_server.rs`, and triage state is local SQLite, so no fixture change is required. Pre-linked tickets are seeded in test setup via `set_triage_copied("PROJ-1", "CLOUD-1")`. "No Jira call" is shown structurally: the guard test uses a DB with no cloud connection meta, so the guard message (not a credentials error) proves the guard ran first. `copy_ticket_v2_integration.rs` only exercises `copy_pipeline` helpers and cannot call the Tauri command directly; leave it untouched and confirm it still passes.

## Shared Patterns

### Mutex lock and poison mapping
**Source:** `commands.rs` L1055-1057
**Apply to:** `relink_ticket`, the `copy_ticket_v2` guard block
```rust
let db = triage_db.lock()
    .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
```

### Error type
**Source:** `AppError::Internal(String)` (error.rs, `#[error("{0}")]`, bare message to UI)
**Apply to:** `set_triage` refusal, `validate_triage_state`, `ensure_not_linked`

### Parameterized SQL only
**Source:** `triage_db.rs` L453-462
**Apply to:** `relink`, `get_copied_key`, `delete_triage_entries`. Never interpolate ticket keys.

### Lint and test style
Clippy pedantic as warnings (`cargo clippy --all-targets`), `.expect("...")` in tests, in-memory DB via `new_db()`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Old-shape DB seeding test | test | file-I/O | No existing test seeds a legacy-schema file DB; build from `MIGRATE_TRIAGE_CHECK_HANDLED` and `tempfile` as above |

## Metadata

**Analog search scope:** `src-tauri/src/triage_db.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`, `src-tauri/tests/` listing
**Files scanned:** 5
**Pattern extraction date:** 2026-10-15
