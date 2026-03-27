---
phase: 12-snapshot-foundation
plan: "01"
subsystem: database
tags: [rusqlite, sha2, hex, snapshot, change-detection, watermark, chrono]

# Dependency graph
requires: []
provides:
  - SnapshotDb struct with file-backed and in-memory SQLite storage
  - store_snapshot / get_snapshot / get_watermark CRUD operations
  - SHA-256 hash computation with volatile field stripping (self, expand, avatarUrls, iconUrl, avatar sizes)
  - detect_changes field-level diff for status/priority/assignee/summary/description/labels/components/fixVersions
  - comment_count, attachment_count, worklog_count array-length delta detection
  - check_for_changes top-level orchestrator: first-time no-op, hash match no-op, hash mismatch returns FieldChange vec
  - 10 unit tests covering all POLL-04/05/06 data-layer behaviors
affects:
  - 12-02-PLAN: polling engine consumes SnapshotDb via check_for_changes
  - phase-13: notification/diff UI consumes FieldChange vec from SnapshotDb
  - phase-14: UI integrates change badges driven by FieldChange
  - phase-15: any downstream change-tracking consumers

# Tech tracking
tech-stack:
  added:
    - sha2 = "0.10" (SHA-256 digest computation)
    - hex = "0.4" (hash byte-to-hex encoding)
  patterns:
    - SnapshotDb mirrors AuditDb/TriageDb pattern: open(path) + open_in_memory() + execute_batch(schema)
    - OptionalExtension for query_row None-on-missing (QueryReturnedNoRows not propagated as error)
    - INSERT OR REPLACE with ON CONFLICT DO UPDATE SET for upsert semantics
    - Volatile field stripping via recursive serde_json::Value mutation before hashing

key-files:
  created:
    - src-tauri/src/snapshot_db.rs
  modified:
    - src-tauri/Cargo.toml (added sha2, hex dependencies)
    - src-tauri/src/lib.rs (registered pub mod snapshot_db)
    - Cargo.lock (updated for new deps)

key-decisions:
  - "sha2 + hex chosen over ring crate — lighter, digest-focused, no async overhead"
  - "Volatile field stripping list: self, expand, avatarUrls, iconUrl, 48x48/32x32/24x24/16x16 — removes URL and CDN fields that change on server migration without content change"
  - "Watermark = MIN(last_checked_at) across all stored tickets — caller is responsible for calling store_snapshot; missing API call does not advance watermark"
  - "check_for_changes first-time behavior: stores snapshot and returns empty vec — prevents false positive on initial poll"
  - "Hash match path still calls store_snapshot to update last_checked_at — ensures watermark advances on successful poll even with no content changes"

patterns-established:
  - "SnapshotDb pattern: same open/open_in_memory/execute_batch structure as AuditDb and TriageDb"
  - "Volatile field stripping: strip_recursive modifies Value in-place before canonical JSON serialization"
  - "TDD inline: tests and impl in same file, tests use open_in_memory() for isolation"

requirements-completed: [POLL-04, POLL-05, POLL-06]

# Metrics
duration: 6min
completed: 2026-03-27
---

# Phase 12 Plan 01: SnapshotDb Foundation Summary

**SQLite snapshot store with SHA-256 hash-based change detection, volatile field stripping, field-level diff, and watermark query — 10 tests, all POLL-04/05/06 behaviors covered**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T21:34:30Z
- **Completed:** 2026-03-27T21:39:54Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- `SnapshotDb` struct with `open(path)` and `open_in_memory()` constructors matching project DB pattern
- SHA-256 hash computation with recursive volatile field stripping before canonicalization (eliminates false positives from URL/CDN fields)
- `detect_changes` comparing 8 WATCHED_FIELDS plus comment/attachment/worklog count deltas, returning typed `FieldChange` vec
- `check_for_changes` orchestrator handles first-time, no-change, and changed cases correctly
- `get_watermark` returns `MIN(last_checked_at)` — excludes tickets not yet stored, exactly per POLL-06 spec
- All 10 unit tests pass; 27/27 lib tests pass; no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add direct dependencies and register module** - `1df1a29` (feat)

## Files Created/Modified

- `src-tauri/src/snapshot_db.rs` — SnapshotDb, StoredSnapshot, FieldChange, compute_hash, strip_volatile_fields, detect_changes, check_for_changes, 10 unit tests
- `src-tauri/Cargo.toml` — added sha2 = "0.10" and hex = "0.4"
- `src-tauri/src/lib.rs` — added `pub mod snapshot_db;`
- `Cargo.lock` — updated for new dependencies

## Decisions Made

- Used `sha2` + `hex` crates over `ring` — lighter, digest-focused, no async overhead needed for synchronous hash computation
- Volatile key list (self, expand, avatarUrls, iconUrl, 48x48/32x32/24x24/16x16) strips server-URL and CDN avatar fields that change on infrastructure migration without meaningful content changes
- Hash match path still calls `store_snapshot` to refresh `last_checked_at` — ensures watermark advances on successful polls even when content is unchanged
- First-time `check_for_changes` stores snapshot and returns empty vec — prevents false-positive change event on initial poll

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed two clippy pedantic warnings in snapshot_db.rs**
- **Found during:** Task 1 (post-implementation clippy verification)
- **Issue 1:** Doc comment used bare `(field_name, json_pointer)` — clippy::doc_markdown requires backtick quoting
- **Issue 2:** `|a| a.len()` closure — clippy::redundant_closure_for_method_calls prefers `Vec::len`
- **Fix:** Added backticks to doc comment; changed closure to method reference
- **Files modified:** src-tauri/src/snapshot_db.rs
- **Verification:** `cargo clippy -- -D warnings` exits 0
- **Committed in:** `1df1a29` (same task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - clippy pedantic compliance)
**Impact on plan:** Cosmetic fix required for clippy -D warnings gate to pass. No behavioral change.

## Issues Encountered

None — implementation compiled and all 10 tests passed on first run after clippy fixes.

## Known Stubs

None — all data-layer behaviors are fully implemented with real SQLite storage and SHA-256 hashing.

## Next Phase Readiness

- `SnapshotDb` is ready for consumption by the polling engine (12-02)
- `check_for_changes` and `FieldChange` are the primary integration points
- `get_watermark` provides the JQL `updated >= watermark` filter anchor for 12-02

---
*Phase: 12-snapshot-foundation*
*Completed: 2026-03-27*
