# Phase 34: Link Integrity Backend - Research

**Researched:** 2026-10-15
**Domain:** Rust/Tauri 2 backend, rusqlite (SQLite) triage store, mock Jira servers
**Confidence:** HIGH (all findings are from direct code reading of this repo; no new external libraries)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New Tauri command `relink_ticket(ticket_key)` does one atomic `UPDATE triage_state SET state='copied', last_updated=? WHERE ticket_key=? AND copied_key IS NOT NULL` and returns `Option<String>` (the remembered Cloud key).
- **D-02:** No remembered link returns `Ok(None)`, not an error. Frontend treats `None` as "open the copy preview" (RLNK-02).
- **D-03:** Idempotent: calling on an already-Linked ticket returns the key again (no error).
- **D-04:** Allowed from any state as long as `copied_key` is set (ignored, new, seen, handled, copied).
- **D-05:** `copied_key` is never changed by relink. It only flips `state`.
- **D-06:** `set_triage_state` with `state='copied'` returns an error (fail loudly, message points to the re-link / copy flow). Remove `copied` from the accepted states in the command validator.
- **D-07:** Enforce at both layers: `TriageDb::set_triage()` also refuses `'copied'`. `set_triage_copied()` (from `copy_ticket_v2` Phase 8) stays the only writer that creates a Linked row; `relink_ticket` the only other path into `copied`.
- **D-08:** Guard condition is `copied_key IS NOT NULL` for the source ticket, regardless of current state.
- **D-09:** Guard runs first in `copy_ticket_v2`, before credentials, mapping load or any Jira call; leaves no partial steps or audit rows.
- **D-10:** Refusal is an `AppError` whose message carries the existing Cloud key.
- **D-11:** No override or force flag.
- **D-12:** A done ticket with a remembered link keeps its whole row (state and key untouched). Done tickets without a key are still deleted.
- **D-13:** Rule lives in `TriageDb::delete_triage_entries` (SQL guard `AND copied_key IS NULL`), protecting both `fetch_tickets` cleanup and `delete_done_triage`.
- **D-14:** No migration, no schema change. Previously linked tickets re-link with no extra work.
- **D-15:** Known gaps accepted: (a) Linked row with NULL key, (b) linked tickets already cleaned up before this update. Both make `relink_ticket` return `None`.
- **D-16:** A Rust test seeds an old-shape DB (pre-`handled` CHECK, `copied_key` added by ALTER), runs normal migrations, then asserts relink, guard and cleanup on pre-existing Linked rows and ignored-with-key rows.
- **D-17:** Mock server and Rust tests cover: relink hit / miss / idempotent / any-state, `copied` rejection at command and DB layer, guard refusal with key in message and no Jira call, cleanup keeps linked done rows and deletes keyless done rows, old-shape test.

### Claude's Discretion
- Exact error wording and `AppError` variant for the `copied` rejection and guard refusal.
- Return type of `delete_triage_entries` (still a deleted-row count) and how the guard test asserts "no Jira call".
- Mock fixture shape for a pre-linked ticket.

### Deferred Ideas (OUT OF SCOPE)
- Cloud existence check on re-link (404 falls back to copy preview).
- Force re-copy override.
- Startup audit/report of keyless Linked rows.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINT-02 | A Linked row can never exist without a Cloud key (`set_triage_state` rejects `copied`; re-link via dedicated atomic command) | `set_triage` is the only generic writer (commands.rs:1058); fetch only calls it with `"new"` (commands.rs:814). Frontend never sends `'copied'` (grep verified), so rejection breaks no caller. |
| LINT-03 | Backend refuses to copy a ticket that already has a remembered link | Guard at top of `copy_ticket_v2` (commands.rs:1611) before `get_cloud_credentials` (L1625). |
| LINT-04 | Done ticket's remembered link not erased by fetch cleanup | `delete_triage_entries` (triage_db.rs:449) is the single delete path used by fetch (commands.rs:~818) and `delete_done_triage`. |
</phase_requirements>

## Summary

This is a small, entirely in-repo change touching `src-tauri/src/triage_db.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/main.rs` and tests. No new crates. Everything rides on existing rusqlite `execute` calls; each statement is atomic in SQLite, so `relink_ticket` as a single `UPDATE ... WHERE copied_key IS NOT NULL` needs no explicit transaction.

Key design facts found in code: `TriageDb` wraps a single `rusqlite::Connection` behind `Arc<Mutex<TriageDb>>`; the `state` CHECK constraint allows `copied`, so the DB itself will not stop a keyless `copied` write, hence the D-07 Rust-level refusal in `set_triage`. `set_triage` upserts and never touches `copied_key`, so deny/restore already preserve it. `copy_ticket_v2` is a Tauri command taking `State<...>` and cannot be called directly from the existing integration tests (those exercise `copy_pipeline` helpers only), so the guard should be extracted to a plain function to be testable.

**Primary recommendation:** Add `TriageDb::get_copied_key`, `TriageDb::relink`, change `set_triage`/`delete_triage_entries`, extract a `pub(crate) fn ensure_not_linked(&TriageDb, &str) -> AppResult<()>` in commands.rs called as the first statement of `copy_ticket_v2`, and unit-test everything in `triage_db.rs` / `commands.rs` test modules.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Reject `copied` in generic triage write | API / Backend (commands.rs) | Database layer (`TriageDb::set_triage`) | Defense in depth per D-06/D-07 |
| Atomic re-link | Database layer (single UPDATE) | Backend command wrapper | Atomicity from one SQL statement |
| Duplicate-copy guard | API / Backend (`copy_ticket_v2`) | Database lookup | Must precede any Jira call |
| Done-row preservation | Database layer (`delete_triage_entries` SQL) | — | Protects all callers |

## Standard Stack

No new dependencies. Existing: `rusqlite` (TriageDb), `tauri` 2.10, `chrono` (timestamps), `thiserror`-based `AppError` (error.rs), `tokio` + axum mock servers in tests. Verification of package versions skipped: nothing to install. [VERIFIED: src-tauri/Cargo.toml]

## Package Legitimacy Audit

No external packages installed in this phase. Nothing to audit.

## Architecture Patterns

### Flow
```
Frontend invoke
  ├─ set_triage_state(key,state) ─ validate (no 'copied') ─> TriageDb::set_triage (also refuses 'copied') ─> UPSERT (copied_key untouched)
  ├─ relink_ticket(key) ─> TriageDb::relink ─ UPDATE ... WHERE copied_key IS NOT NULL ─> rows>0 ? SELECT copied_key : None
  ├─ copy_ticket_v2(args) ─> ensure_not_linked(source_key) ─ Err(key in msg) | continue ─> creds ─> mapping ─> Jira ... ─> set_triage_copied
  └─ fetch_tickets / delete_done_triage ─> delete_triage_entries (… AND copied_key IS NULL)
```

### Pattern 1: relink (TriageDb)
```rust
// Source: pattern from existing set_triage_copied (triage_db.rs:197)
pub fn relink(&self, key: &str) -> AppResult<Option<String>> {
    let now = chrono::Utc::now().to_rfc3339();
    let n = self.conn.execute(
        "UPDATE triage_state SET state='copied', last_updated=?1
         WHERE ticket_key=?2 AND copied_key IS NOT NULL",
        rusqlite::params![now, key],
    )?;
    if n == 0 { return Ok(None); }
    Ok(self.conn.query_row(
        "SELECT copied_key FROM triage_state WHERE ticket_key=?1",
        [key], |r| r.get::<_, Option<String>>(0))?)
}
```
The UPDATE and SELECT run under the `Mutex<TriageDb>` lock held by the command, so no interleaving write is possible within the app. Alternatively use `UPDATE ... RETURNING copied_key` (SQLite >= 3.35; bundled rusqlite normally satisfies this, but confirm the `bundled` feature/version in Cargo.toml before relying on it; the two-statement form is safe regardless). [ASSUMED: RETURNING availability]

Note on an empty-string `copied_key`: `IS NOT NULL` would treat `''` as a link. Consider `AND copied_key IS NOT NULL AND copied_key <> ''` only if desired; CONTEXT locks `IS NOT NULL`, nothing in code writes `''`. [ASSUMED]

### Pattern 2: set_triage refusal
Place check at top of `TriageDb::set_triage`: `if state == "copied" { return Err(AppError::Internal("...use relink_ticket or the copy flow".into())) }`. In the command, drop `"copied"` from the `match` arm and add an explicit `"copied"` arm with the pointed message, ahead of the generic invalid-state arm, and update the "Must be one of" text.

### Pattern 3: delete guard
`format!("DELETE FROM triage_state WHERE ticket_key IN ({placeholders}) AND copied_key IS NULL")`. Returned count now means "actually deleted". Callers: fetch ignores the return value; `delete_done_triage` returns it to the frontend (usize) so semantics stay valid. Existing tests `test_delete_triage_entries_*` use `set_triage` rows without key and still pass.

### Pattern 4: testable guard
```rust
pub(crate) fn ensure_not_linked(db: &TriageDb, source_key: &str) -> AppResult<()> {
    if let Some(existing) = db.get_copied_key(source_key)? {
        return Err(AppError::Internal(format!(
            "Ticket {source_key} is already linked to {existing}. Use Link to re-link instead of copying again.")));
    }
    Ok(())
}
```
In `copy_ticket_v2`, lock `triage_db`, call it, drop the guard, before `get_cloud_credentials`. Do not hold the std Mutex guard across `.await`.

Error variant: `AppError::Internal` serializes as the bare message (error.rs `#[error("{0}")]`), which is best for a UI that must parse "already linked to KEY". Other variants prefix text ("Database error: ..."). Recommend `Internal`. A stable, parseable phrase (e.g. "already linked to ACME-123") helps Phase 35; consider documenting the format in the plan. [VERIFIED: src-tauri/src/error.rs]

### Anti-Patterns
- Adding a `'copied'` branch to `set_triage` that inserts with NULL key.
- Putting the guard after `get_cloud_credentials` (keychain call first; violates D-09).
- Doing relink as SELECT then UPDATE across two lock acquisitions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Atomicity | Manual transaction / app-level flags | Single SQL UPDATE under the existing Mutex |
| Test DB | Temp files | `TriageDb::open_in_memory()`; for old-shape test use `rusqlite::Connection` on a tempfile or in-memory + see Pitfall 3 |

## Runtime State Inventory

Not a rename phase, but relevant to D-14/D-15: stored data is the user's existing `triage_state` rows in the app SQLite file. No schema change; existing Linked rows with `copied_key` work immediately. Nothing else (services, OS registrations, env vars, artifacts) is affected. Verified by code reading.

## Common Pitfalls

### Pitfall 1: CHECK constraint does not protect against keyless `copied`
`CHECK(state IN (..., 'copied', ...))` allows it, so the Rust-level refusal is the only guard. Add a DB-level test: `set_triage("X","copied")` is `Err` and leaves no row.

### Pitfall 2: Existing tests that write `copied` through `set_triage`
Grep of `src` and `tests` shows `set_triage` is called only at commands.rs:814 (`"new"`) and in triage_db.rs tests. Re-grep during execution (`grep -rn 'set_triage(' src-tauri`) in case inline tests in other modules (poll_engine, groups) use it. Tests needing a Linked row must use `set_triage_copied`.

### Pitfall 3: Old-shape DB test via `TriageDb::open`
`open_in_memory` and `open(path)` run the migration; to seed an old shape you need a file DB: create a temp file with `rusqlite::Connection`, create `triage_state` with the 4-value CHECK (no `'handled'`) and no `copied_key`, `ALTER TABLE ... ADD COLUMN copied_key`, insert rows (Linked with key, ignored with key, keyless), close, then `TriageDb::open(path)` and assert. Check whether `tempfile` is already a dev-dependency (Cargo.toml) before adding; otherwise use `std::env::temp_dir()` with a unique name and delete afterwards. Migration `MIGRATE_TRIAGE_CHECK_HANDLED` only triggers when the table SQL lacks `'handled'`, so the seed SQL must not contain that literal (including in comments). `INSERT ... SELECT` in the rebuild copies `copied_key`, which is how existing keys survive. [VERIFIED: triage_db.rs]

### Pitfall 4: Mock server cannot observe "no Jira call"
Mock servers (axum, `mock_server.rs`) have no request recorder (grep: none). Options: (a) preferred: test `ensure_not_linked` directly and, since it is the first statement, prove ordering structurally; in a test with a fresh DB lacking cloud connection meta, a non-guarded path would fail with a credentials error rather than the guard message, so asserting the guard's message demonstrates it ran first; (b) optionally snapshot the v3 fixture issue count before/after if the fixtures store is reachable. Do not add Tauri `test` feature solely for this. [VERIFIED: grep of mock_server.rs]

### Pitfall 5: Holding the std Mutex across await in `copy_ticket_v2`
Scope the lock in a block, as other code there does.

### Pitfall 6: Frontend in-memory store drift
Not in this phase (Phase 35), but after a `relink_ticket` the frontend store must be updated; backend only returns the key.

## Code Examples

Command registration (main.rs ~L232): add `commands::relink_ticket,` after `commands::delete_done_triage,`.

```rust
#[tauri::command]
pub fn relink_ticket(
    ticket_key: String,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Option<String>, AppError> {
    let db = triage_db.lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.relink(&ticket_key)
}
```

Tauri permission: custom `#[tauri::command]`s in this app are registered via `generate_handler!`; check `capabilities/` and `build.rs` to see whether app commands need an explicit permission entry (existing `set_triage_state` is the template; mirror whatever it does). [ASSUMED: no extra permission needed]

## Test Plan (Validation Architecture)

| Property | Value |
|----------|-------|
| Framework | Rust built-in `#[test]` / `#[tokio::test]`, `cargo test` in `src-tauri` |
| Quick run | `cd src-tauri && cargo test --lib triage_db` |
| Full suite | `cd src-tauri && cargo test && cargo clippy --all-targets` (pedantic lints are `warn`) |

| Req | Behavior | Test location | Command |
|-----|----------|---------------|---------|
| LINT-02 | `set_triage(.., "copied")` Err, no row | triage_db.rs tests | `cargo test --lib triage_db::tests::` |
| LINT-02 | command validator rejects `copied` (extract `validate_triage_state(&str) -> Result<(),AppError>` to test without Tauri State) | commands.rs tests | `cargo test --lib commands::` |
| LINT-02 | relink: hit returns key + state copied; miss returns None and creates no row; idempotent; any-state (new/seen/ignored/handled with key); key unchanged | triage_db.rs | same |
| LINT-03 | `ensure_not_linked` Err contains key for Linked, ignored-with-key, new-with-key; Ok for keyless/unknown | commands.rs | same |
| LINT-04 | delete keeps keyed rows, deletes keyless, returns count of actually deleted; mixed batch | triage_db.rs | same |
| D-16 | old-shape DB migrates, then relink/guard/cleanup behave | triage_db.rs | same |

Wave 0 gaps: none for framework. Mock server: add optional fixture only if an integration test needs it (triage state is local SQLite, not Jira, so a mock fixture for "pre-linked ticket" is just rows seeded via `set_triage_copied` in test setup; existing PROJ-* keys work). Success criterion 5's "mock server" is satisfied by that seeding plus existing mock-based copy tests continuing to pass.

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input validation | yes | State whitelist in command; parameterized SQL only (rusqlite params). `delete_triage_entries` builds only `?N` placeholders, no key interpolation. Keep it that way. |
| V4 Access control | no | Local single-user desktop app |
| Others | no | |

Threat: SQL injection via ticket key: mitigated by bound parameters. Data integrity (tampering): the invariant "Linked implies key" enforced in Rust.

## Environment Availability

Rust toolchain present (cargo 1.95.0). No other external dependencies. [VERIFIED: shell]

## State of the Art

Not applicable (internal change).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SQLite `UPDATE ... RETURNING` available via bundled rusqlite | Pattern 1 | Low; two-statement form recommended anyway |
| A2 | Empty-string `copied_key` never written | Pattern 1 | Low; nothing writes it |
| A3 | No tauri capability/permission entry needed for new command | Code Examples | Medium-low; would surface at first frontend invoke in Phase 35, check `capabilities/` |
| A4 | `tempfile` dev-dependency availability unknown | Pitfall 3 | Low; fall back to `std::env::temp_dir()` |

## Open Questions

1. **Guard-message format for Phase 35 parsing** (RESOLVED by recommendation): use a stable phrase "already linked to {KEY}". Phase 35 can regex it, or planner may choose a structured error later (out of scope).
2. **`delete_triage_entries` return semantics**: now returns rows actually deleted (kept ones excluded); fine for both callers.

## Sources

### Primary (HIGH confidence)
- Direct reading: src-tauri/src/triage_db.rs, commands.rs (L62, 780-830, 1030-1070, 1600-1680, 1840-1870), error.rs, main.rs, lib.rs, tests/common/mod.rs, tests/copy_ticket_v2_integration.rs, Cargo.toml
- Repo grep of frontend: no caller sends `state: 'copied'` to `set_triage_state`

## Metadata

**Confidence:** Standard stack HIGH (no change); architecture HIGH; pitfalls HIGH (code-verified), with the four assumptions above flagged.
**Research date:** 2026-10-15
**Valid until:** 30 days (stable internal code)

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` found in the repo root and no `.claude/skills` / `.agents/skills` directory. Conventions inferred from code: clippy pedantic as warnings, `AppError::Internal("Triage DB lock poisoned")` on mutex poison, SK UI term "tiket" (frontend only, not this phase).
