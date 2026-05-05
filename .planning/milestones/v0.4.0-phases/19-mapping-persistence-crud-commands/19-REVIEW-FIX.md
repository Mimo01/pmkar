---
phase: 19-mapping-persistence-crud-commands
fixed_at: 2026-05-04T23:38:00Z
review_path: .planning/milestones/v0.4.0-phases/19-mapping-persistence-crud-commands/19-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-05-04T23:38:00Z
**Source review:** `.planning/milestones/v0.4.0-phases/19-mapping-persistence-crud-commands/19-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 1 (WR-01 already fixed by prior phase)

## Fixed Issues

### CR-01: Command injection via `cmd /C start <url>` on Windows

**Files modified:** `src-tauri/src/commands.rs`
**Commit:** 7facbb3
**Applied fix:** Replaced `std::process::Command::new("cmd").args(["/C", "start", &url])` with `std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url])` in `open_external_url`. This bypasses `cmd.exe` entirely so shell metacharacters in the URL cannot be interpreted as shell commands.

---

### CR-02: Silent empty-string hash in `hash_field_value`

**Files modified:** `src-tauri/src/field_mapping_db.rs`
**Commit:** ab12099
**Applied fix:** Replaced `serde_json::to_string(v).unwrap_or_default()` with a `match` that returns the sentinel string `"HASH_ERROR_SERIALIZATION_FAILED"` on serialisation failure. This sentinel is visibly invalid (wrong length, not valid hex), preventing silent audit collisions where all failed-serialisation values would hash to the same SHA-256 digest.

---

### WR-02: `unwrap()` on mutex locks in `main.rs` startup

**Files modified:** `src-tauri/src/main.rs`
**Commit:** 4a6dc1c
**Applied fix:** Replaced both `.lock().unwrap()` calls in the setup closure with `.lock().map_err(|_| "...")?.` propagation. The first (TriageDb lock) propagates `"TriageDb lock poisoned during startup"`, the second (poll_tx lock) propagates `"poll_tx lock poisoned during startup"`. Both now use `?` so Tauri receives the error cleanly instead of crashing the process. The trailing `let _ = ... .send(...)` was also changed to `.send(...).ok()` to discard the send error explicitly.

---

### WR-03: No transaction boundary in `log_preview_transformations` batch insert

**Files modified:** `src-tauri/src/field_mapping_db.rs`, `src-tauri/src/commands.rs`
**Commit:** bb63662
**Applied fix:** Added two new methods to `FieldMappingDb`: `begin_transaction()` and `commit_transaction()`, each delegating to `self.conn.execute_batch("BEGIN"/"COMMIT")`. In `log_preview_transformations`, the batch `for` loop is now wrapped with `let _ = mdb.begin_transaction()` before the loop and `let _ = mdb.commit_transaction()` after. Best-effort semantics (errors ignored) are preserved to match the existing "preview/copy flow must not block" contract, but the batch is now atomic: either all rows commit or none do.

---

### WR-04: `FieldMappingDb` opens without WAL journal mode

**Files modified:** `src-tauri/src/field_mapping_db.rs`
**Commit:** 6a4f12a
**Applied fix:** Added `conn.execute_batch("PRAGMA journal_mode=WAL;")?;` immediately after `Connection::open(path)?` in `FieldMappingDb::open`. The `open_in_memory` path is intentionally left unchanged — SQLite ignores the WAL pragma for in-memory connections and the pragma would add noise without effect.

---

## Skipped Issues

### WR-01: HTTP error silently swallowed mid-pagination in `search_jira_users_by_domain`

**File:** `src-tauri/src/commands.rs`
**Reason:** Already fixed by a prior phase (Phase 17 WR-06). The current code at the relevant location already returns `Err(AppError::Http(format!("User domain search returned status {} at startAt={start_at}", resp.status().as_u16())))` on non-success status, and uses `.map_err(|e| AppError::Http(format!("Failed to parse user search page: {e}")))?` for the JSON parse. No change was needed.
**Original issue:** Non-2xx response mid-pagination was previously handled with `break`, silently returning a partial result to the caller.

---

_Fixed: 2026-05-04T23:38:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
