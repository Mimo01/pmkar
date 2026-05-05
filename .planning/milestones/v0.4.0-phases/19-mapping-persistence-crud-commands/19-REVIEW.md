---
phase: 19-mapping-persistence-crud-commands
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src-tauri/src/field_mapping_db.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/main.rs
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: fixed
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 19 delivers SQLite-backed field mapping persistence (`field_mapping`, `mapping_meta`, `mapping_audit_log` tables in `field_mapping_db.rs`), three Tauri CRUD commands (`get_field_mapping`, `set_field_mapping`, `delete_field_mapping` in `commands.rs`), and their registration in `main.rs`. The schema design is careful: parameterised SQL throughout, a partial unique index on `target_field_id` to allow multiple dismissed-sentinel rows, a dedup migration to handle pre-existing data, and a seeded set of five defaults. The audit machinery (`insert_mapping_audit`, `log_preview_transformations`) is well-structured.

Two critical issues were found. The first is a command injection vector on Windows in `open_external_url` that is reachable from the frontend and survives the `http://`/`https://` prefix guard. The second is a silent hash collision in `hash_field_value` that corrupts the audit trail when JSON serialisation fails. Four warnings cover a silently-swallowed HTTP error in user-domain pagination, two `unwrap()` panics in `main.rs` startup, missing WAL mode on `mapping.db`, and a missing transaction boundary over the batch audit insert. Two info items flag absent `transformer_kind` validation and an untested private helper.

---

## Critical Issues

### CR-01: Command injection via `cmd /C start <url>` on Windows

**File:** `src-tauri/src/commands.rs:659-662`

**Issue:** On Windows, `open_external_url` passes the raw URL string as a bare argument to `cmd /C start`. Windows `cmd.exe` tokenises everything after `/C` as a shell command string and honours metacharacters (`&`, `|`, `&&`, `||`, `"`). The `starts_with("http")` guard on line 647 does not prevent a URL like `https://x.com" & calc.exe "` from being constructed by the frontend and passed through. `std::process::Command::args()` does not shell-quote arguments for `cmd /C`; the OS concatenates them with spaces before `cmd` re-parses them as a shell command line. The macOS and Linux paths (`open`/`xdg-open`) do not have this problem because those tools do not invoke a shell.

```rust
// VULNERABLE — cmd re-parses the concatenated argument list as shell syntax
std::process::Command::new("cmd")
    .args(["/C", "start", &url])   // line 660
    .spawn()
```

**Fix:** Bypass `cmd` on Windows entirely. `rundll32 url.dll,FileProtocolHandler <url>` is the conventional safe alternative; it receives the URL as a single argument without shell re-parsing:

```rust
#[cfg(target_os = "windows")]
{
    std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn()
        .map_err(|e| AppError::Internal(format!("Failed to open URL: {e}")))?;
}
```

Alternatively, add the `open` crate which handles all platforms correctly.

---

### CR-02: Silent empty-string hash in `hash_field_value` causes audit collision

**File:** `src-tauri/src/field_mapping_db.rs:661`

**Issue:** `hash_field_value` calls `serde_json::to_string(v).unwrap_or_default()`. If serialisation ever fails, `unwrap_or_default()` returns `""`. The SHA-256 of `""` is the constant digest `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. Any two distinct field values that both fail serialisation will produce the same hash and appear identical in `mapping_audit_log`. The hash is stored as the authoritative "what was transformed" fingerprint; a collision silently corrupts the audit trail with no error surfaced anywhere in the call chain (the caller in `log_preview_transformations` discards all errors with `let _ =`).

```rust
// Line 661 — serialisation failure silently hashes the empty string
let json_str = serde_json::to_string(v).unwrap_or_default();
```

**Fix:** Return a sentinel value that is obviously invalid rather than a valid-looking but wrong hash:

```rust
pub fn hash_field_value(v: &serde_json::Value) -> String {
    match serde_json::to_string(v) {
        Ok(json_str) => {
            let mut hasher = Sha256::new();
            hasher.update(json_str.as_bytes());
            hex::encode(hasher.finalize())
        }
        // Distinct sentinel — never a valid SHA-256 hex string (wrong length + prefix)
        Err(_) => "HASH_ERROR_SERIALIZATION_FAILED".to_string(),
    }
}
```

---

## Warnings

### WR-01: HTTP error silently swallowed mid-pagination in `search_jira_users_by_domain`

**File:** `src-tauri/src/commands.rs:1154-1158`

**Issue:** When a non-2xx response is received mid-pagination (e.g. a 429 rate-limit on page 2), the function `break`s and returns `Ok(partial_results)`. The caller receives no indication that the result is incomplete. Additionally, on line 1158 a JSON parse failure on a successful response is also swallowed via `unwrap_or_default()` — again returning a silently truncated list. Both paths cause the frontend to display an incomplete user-resolution table as if it were the full result.

```rust
if !resp.status().is_success() {
    break;  // silent partial result — status dropped on the floor
}
let page: Vec<serde_json::Value> = resp.json().await.unwrap_or_default(); // parse error also dropped
```

**Fix:** Propagate errors rather than silently truncating:

```rust
if !resp.status().is_success() {
    return Err(AppError::Http(format!(
        "User domain search returned status {} at offset {start_at}",
        resp.status().as_u16()
    )));
}
let page: Vec<serde_json::Value> = resp
    .json()
    .await
    .map_err(|e| AppError::Http(format!("Failed to parse user search page: {e}")))?;
```

---

### WR-02: `unwrap()` on mutex locks in `main.rs` startup can panic the process

**File:** `src-tauri/src/main.rs:156, 160`

**Issue:** Two `.lock().unwrap()` calls in the `setup` closure handle the `TriageDb` mutex and the `poll_tx` mutex. If either mutex is poisoned (possible if another thread panicked while holding it during earlier setup steps), these calls panic and crash the application at launch with no user-facing recovery path. Every other lock acquisition in the codebase uses `.lock().map_err(|_| AppError::Internal(...))` or equivalent; these two are an inconsistency introduced in `main.rs` setup code.

```rust
// Lines 156, 160 — panic on poison instead of graceful error
let freq_str = tdb.lock().unwrap().get_poll_frequency()...
let _ = poll_tx.lock().unwrap().send(initial_freq);
```

**Fix:** Use the `?` operator with a mapped error to propagate into the `setup` closure's `Box<dyn Error>` return:

```rust
let freq_str = tdb
    .lock()
    .map_err(|_| "TriageDb lock poisoned during startup")?
    .get_poll_frequency()
    .unwrap_or_else(|_| "off".to_string());
poll_tx
    .lock()
    .map_err(|_| "poll_tx lock poisoned during startup")?
    .send(initial_freq)
    .ok();
```

---

### WR-03: No transaction boundary in `log_preview_transformations` batch insert

**File:** `src-tauri/src/commands.rs:1780-1802`

**Issue:** `log_preview_transformations` inserts up to 500 audit rows in a `for` loop with each row individually auto-committed by SQLite's default autocommit mode. If the process crashes mid-loop (after row 200 of 500), the `mapping_audit_log` for that `copy_id` is left permanently incomplete. The audit tab would then show a partial picture for that copy event. The "best-effort" comment justifies swallowing per-row insert errors, but it does not justify the absence of atomicity for the batch as a whole. 500 individual auto-commits also have unnecessary I/O overhead.

**Fix:** Wrap the entire loop in an explicit SQLite transaction. Since `conn` is private on `FieldMappingDb`, the cleanest approach is to add a transaction wrapper in `insert_mapping_audit` or expose a batch method:

```rust
// In FieldMappingDb — add a batch method with a transaction:
pub fn insert_mapping_audit_batch(&self, rows: &[AuditRowArgs]) -> AppResult<()> {
    self.conn.execute_batch("BEGIN")?;
    for row in rows {
        // individual errors roll back the whole batch
        self.insert_mapping_audit_inner(row)?;
    }
    self.conn.execute_batch("COMMIT")?;
    Ok(())
}
```

---

### WR-04: `FieldMappingDb` opens without WAL journal mode

**File:** `src-tauri/src/field_mapping_db.rs:269-282`

**Issue:** Neither `FieldMappingDb::open` nor `open_in_memory` sets `PRAGMA journal_mode=WAL`. Without WAL, SQLite uses the default DELETE journal mode, which serialises all readers and writers. The poll engine background thread and the main Tauri thread both hold references to `Arc<Mutex<FieldMappingDb>>` — but if the Mutex is ever dropped or if a future refactor splits the DB access across threads, concurrent reads during a write will receive `SQLITE_BUSY`. In the existing design the Mutex prevents concurrent access, but WAL mode is still the correct default for application databases (it is standard in the other DB modules in this codebase). Omitting it is an inconsistency that creates risk if the locking model ever changes.

**Fix:** Add WAL pragma immediately after `Connection::open`:

```rust
pub fn open(path: &std::path::Path) -> AppResult<Self> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    // ... existing migration steps
}
```

---

## Info

### IN-01: `set_field_mapping` accepts `transformer_kind` as an unchecked free-form string

**File:** `src-tauri/src/commands.rs:1347-1355`

**Issue:** The `set_field_mapping` command deserialises a `FieldMappingRow` from the frontend and upserts it without validating `transformer_kind` against the known set (`identity`, `wiki_to_adf`, `priority`, `user`, etc.). An unknown value persisted to `field_mapping` will fail silently at copy time when `apply_mapping` dispatches on it. This is inconsistent with `set_triage_state` (lines 1032-1039) which explicitly enumerates valid values and rejects unknown ones. The `field_mapping` table DDL also has no `CHECK` constraint on this column (compare with `field_schema_cache.side` which does).

**Fix:** Add an allow-list check in `set_field_mapping` before calling `upsert_mapping_row`:

```rust
const VALID_TRANSFORMER_KINDS: &[&str] =
    &["identity", "wiki_to_adf", "priority", "user", "version", "component"];

pub fn set_field_mapping(row: FieldMappingRow, ...) -> Result<(), AppError> {
    if !VALID_TRANSFORMER_KINDS.contains(&row.transformer_kind.as_str()) {
        return Err(AppError::Internal(format!(
            "Unknown transformer_kind: '{}'. Valid values: {:?}",
            row.transformer_kind, VALID_TRANSFORMER_KINDS
        )));
    }
    // ... rest unchanged
}
```

---

### IN-02: `redact_string_in_value` is a private helper with no unit tests

**File:** `src-tauri/src/commands.rs:1681-1696`

**Issue:** `redact_string_in_value` recursively walks a `serde_json::Value` tree and calls `redact_credential_value` on string leaves. It is private (`fn`, not `pub fn`) and lives in `commands.rs` where the `#[cfg(test)]` block has no coverage for it. The `field_mapping_db.rs` test suite covers `redact_credential_value` thoroughly (lines 1143-1187), but the tree-walking wrapper that is actually called from `log_preview_transformations` is untested. An edge case — such as a `Value::Null` or deeply-nested array — could produce incorrect output without detection.

**Fix:** Move `redact_string_in_value` to `field_mapping_db.rs` where it can be tested alongside `redact_credential_value`, or add targeted tests in `commands.rs`:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn redact_string_in_value_recurses_into_object() {
        use super::*;
        let v = serde_json::json!({"auth": "Bearer secret", "count": 1});
        let out = redact_string_in_value(&v);
        assert_eq!(out["auth"], "[REDACTED]");
        assert_eq!(out["count"], 1); // non-string passes through
    }
}
```

---

_Reviewed: 2026-05-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
