# Phase 12: Snapshot Foundation - Research

**Researched:** 2026-03-27
**Domain:** Rust/SQLite snapshot storage, SHA-256 hash-based change detection, field-level diff
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Snapshot storage scope**
- D-01: Store the full Jira API response as a JSON blob column per ticket — no selective field extraction
- D-02: Zero schema maintenance when new fields are added — the blob captures everything automatically

**Hash strategy**
- D-03: Compute SHA-256 of the full JSON response with volatile fields stripped (self URLs, avatar URLs, expand metadata)
- D-04: A hash mismatch triggers field-level diff; matching hash means no change — skip diff entirely

**Change detection granularity**
- D-05: Field-level diff covers: status, priority, assignee, summary, description, labels, components, fix versions, comment count
- D-06: Attachments and worklogs tracked by count delta (new attachment count > stored count = change)
- D-07: Each detected change records field name, old value, and new value

**Watermark design**
- D-08: Per-ticket `last_checked_at` timestamp stored alongside the snapshot row
- D-09: Watermark = MIN(last_checked_at) across all tracked tickets — used by Phase 13 polling engine
- D-10: A failed API call for a ticket does NOT update that ticket's `last_checked_at` — only successful responses advance the timestamp

### Claude's Discretion
- JSON normalization strategy for hash computation (field ordering, whitespace handling)
- SQLite schema migration approach (ALTER TABLE vs. new table)
- Whether to add the snapshot table to existing `TriageDb` or create a separate `SnapshotDb`
- Internal data structures for representing field-level diffs in Rust

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLL-04 | App stores ticket snapshots in SQLite for change comparison | SQLite blob storage via rusqlite INSERT OR REPLACE pattern; `snapshot_store` table design |
| POLL-05 | App detects ticket changes via hash-based fast check + field-level diff on mismatch | SHA-256 via `sha2` crate (already transitive dep); `serde_json::Value` diff walk |
| POLL-06 | Poll watermark persists in SQLite and only advances after successful API response | Per-ticket `last_checked_at` column; watermark query = MIN(last_checked_at); conditional update only on success |
</phase_requirements>

---

## Summary

Phase 12 adds a pure-Rust data layer: a `snapshot_store` SQLite table that holds the raw JSON blob of the last-seen ticket response alongside a SHA-256 hash and a `last_checked_at` timestamp. When a new response arrives, compute the hash first; if it matches the stored hash the ticket is unchanged and no further work is needed. On a mismatch, deserialize both blobs into `serde_json::Value` trees and walk a fixed field set to produce `FieldChange { field, old_value, new_value }` structs.

All three crates required to implement this are already in the dependency graph: `rusqlite` 0.39 (bundled SQLite), `serde_json` 1.x, and `sha2` 0.10.9 (transitive dep — must be added as a direct dep in Cargo.toml to use it). Adding `sha2` and `hex` as direct dependencies is the only Cargo.toml change needed. The established project pattern of a struct wrapping a `rusqlite::Connection` with idempotent `CREATE TABLE IF NOT EXISTS` plus `let _ = ALTER TABLE` migrations fits cleanly here. The only undecided structural choice is whether to extend `TriageDb` or create a parallel `SnapshotDb`; the research recommendation is a dedicated `SnapshotDb` (see Architecture Patterns).

**Primary recommendation:** Create `src-tauri/src/snapshot_db.rs` as a standalone `SnapshotDb` struct mirroring the `AuditDb` pattern, add `sha2` and `hex` as direct Cargo.toml dependencies, and implement `store_snapshot` / `detect_changes` as synchronous methods callable from Tauri commands.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | 0.39 (bundled) | SQLite CRUD, schema creation, migrations | Already in project; bundled feature means no system SQLite required |
| serde_json | 1.x | JSON blob serialization/deserialization; `Value` tree for field diff | Already in project; `serde_json::Value` is the idiomatic dynamic JSON type |
| sha2 | 0.10.9 | SHA-256 hash computation | Already in Cargo.lock as transitive dep via an existing crate; needs to become a direct dep |
| hex | 0.4.3 | Encode SHA-256 bytes as hex string for storage | Already in Cargo.lock as transitive dep; needs to become direct dep |
| chrono | 0.4 | RFC3339 timestamp for `last_checked_at` | Already in project — same pattern as `triage_db.rs` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| serde | 1.x (derive) | Rust struct serialization for `FieldChange` | Needed to expose diffs to Tauri commands via JSON |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sha2` crate for hashing | `std::collections::hash_map::DefaultHasher` | Standard hasher is not stable across Rust versions and not cryptographic — SHA-256 is more predictable |
| `serde_json::Value` field walk | Custom Rust structs deserializing each field | Custom structs would need updating whenever watched fields change; `Value` walk is zero-schema-change |
| New `SnapshotDb` struct | Extending `TriageDb` | Extending TriageDb mixes concerns; `SnapshotDb` keeps file size manageable and is easy to test in isolation |

**Installation (Cargo.toml additions):**
```toml
sha2 = "0.10"
hex = "0.4"
```

Both are already in Cargo.lock as transitive dependencies — adding them as direct deps does not change the resolved version; it just makes them explicit. No `cargo update` needed.

**Version verification:**
- `sha2` 0.10.9 confirmed in Cargo.lock (source: lock file inspection, HIGH confidence)
- `hex` 0.4.3 confirmed in Cargo.lock (source: lock file inspection, HIGH confidence)
- `rusqlite` 0.39 confirmed in Cargo.toml (source: direct inspection, HIGH confidence)

---

## Architecture Patterns

### Recommended Project Structure

```
src-tauri/src/
├── snapshot_db.rs       # New: SnapshotDb struct, snapshot_store table, FieldChange type
├── triage_db.rs         # Unchanged
├── audit.rs             # Unchanged
├── jira_client.rs       # Unchanged
├── commands.rs          # Integration point: call SnapshotDb after successful ticket fetch
└── lib.rs               # Add: pub mod snapshot_db;
```

### Pattern 1: SnapshotDb Struct (mirrors AuditDb)

**What:** A new struct `SnapshotDb` wrapping a `rusqlite::Connection`, with its own `open` / `open_in_memory` constructors and idempotent schema creation.

**When to use:** Any time the phase requires new SQLite state that doesn't belong with triage config. Separate struct = separate file = independently testable.

**Example:**
```rust
// Source: inferred from src-tauri/src/audit.rs and src-tauri/src/triage_db.rs patterns
use crate::error::AppResult;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

const CREATE_SNAPSHOT_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS snapshot_store (
        ticket_key      TEXT PRIMARY KEY,
        response_json   TEXT NOT NULL,
        content_hash    TEXT NOT NULL,
        last_checked_at TEXT NOT NULL
    );
";

pub struct SnapshotDb {
    conn: Connection,
}

impl SnapshotDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        Ok(Self { conn })
    }
}
```

### Pattern 2: Hash Computation with Volatile Field Stripping

**What:** Before hashing, deserialize the JSON string to `serde_json::Value`, remove volatile keys (`self`, `expand`, `avatarUrls`, `iconUrl`), then re-serialize with `serde_json::to_string` and hash the bytes. Key insight: `serde_json` serializes `Value::Object` (backed by `IndexMap` or `BTreeMap`) in key-insertion order by default. Use `serde_json::Map`'s iteration order — or explicitly sort keys using `serde_json::to_string` with a sorted map — to ensure identical content produces identical byte strings regardless of field order in the API response.

**When to use:** Every time a new snapshot is stored; computed hash is stored alongside the blob.

**Example:**
```rust
// Source: sha2 crate docs (sha2 = "0.10") + serde_json Value manipulation
use sha2::{Digest, Sha256};

/// Strips volatile Jira API fields that change between requests even when
/// ticket content is unchanged (self-links, avatar URLs, expand metadata).
fn strip_volatile_fields(mut v: serde_json::Value) -> serde_json::Value {
    let volatile = &["self", "expand", "avatarUrls", "iconUrl", "48x48", "32x32", "24x24", "16x16"];
    strip_recursive(&mut v, volatile);
    v
}

fn strip_recursive(v: &mut serde_json::Value, keys: &[&str]) {
    match v {
        serde_json::Value::Object(map) => {
            for key in keys {
                map.remove(*key);
            }
            for val in map.values_mut() {
                strip_recursive(val, keys);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                strip_recursive(item, keys);
            }
        }
        _ => {}
    }
}

fn compute_hash(response_json: &str) -> AppResult<String> {
    let v: serde_json::Value = serde_json::from_str(response_json)?;
    let stripped = strip_volatile_fields(v);
    // to_string produces compact JSON; key order follows insertion order in the
    // Jira response — stable enough since the same Jira endpoint returns the
    // same key order for the same ticket.
    let canonical = serde_json::to_string(&stripped)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}
```

### Pattern 3: FieldChange Type and Field-Level Diff

**What:** A simple Rust struct representing one detected change. Serializable for Tauri command responses and future Phase 15 diff UI.

**When to use:** Produced by `detect_changes(old_json, new_json)` and passed to Phase 13/14 consumers.

**Example:**
```rust
// Source: project pattern — mirrors TriageEntry, AuditEntry Serialize patterns
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub field: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}
```

The diff function extracts each watched field from `serde_json::Value::pointer` paths and compares string representations:

```rust
// Field paths in the Jira detail response JSON
const WATCHED_FIELDS: &[(&str, &str)] = &[
    ("status",      "/fields/status/name"),
    ("priority",    "/fields/priority/name"),
    ("assignee",    "/fields/assignee/displayName"),
    ("summary",     "/fields/summary"),
    ("description", "/fields/description"),
    ("labels",      "/fields/labels"),
    ("components",  "/fields/components"),
    ("fix_versions","/fields/fixVersions"),
];

pub fn detect_changes(old_json: &str, new_json: &str) -> AppResult<Vec<FieldChange>> {
    let old: serde_json::Value = serde_json::from_str(old_json)?;
    let new: serde_json::Value = serde_json::from_str(new_json)?;
    let mut changes = Vec::new();

    for (field_name, pointer) in WATCHED_FIELDS {
        let old_val = extract_string(&old, pointer);
        let new_val = extract_string(&new, pointer);
        if old_val != new_val {
            changes.push(FieldChange {
                field: field_name.to_string(),
                old_value: old_val,
                new_value: new_val,
            });
        }
    }

    // Comment count delta (D-05 / D-06)
    let old_comments = count_array(&old, "/fields/comment/comments");
    let new_comments = count_array(&new, "/fields/comment/comments");
    if old_comments != new_comments {
        changes.push(FieldChange {
            field: "comment_count".to_string(),
            old_value: Some(old_comments.to_string()),
            new_value: Some(new_comments.to_string()),
        });
    }

    // Attachment count delta (D-06)
    let old_attach = count_array(&old, "/fields/attachment");
    let new_attach = count_array(&new, "/fields/attachment");
    if old_attach != new_attach {
        changes.push(FieldChange {
            field: "attachment_count".to_string(),
            old_value: Some(old_attach.to_string()),
            new_value: Some(new_attach.to_string()),
        });
    }

    Ok(changes)
}
```

### Pattern 4: Conditional Watermark Advance (D-10)

**What:** The `last_checked_at` column is only updated in the success path. The call site in `commands.rs` only calls `snapshot_db.store_snapshot(key, json)` after a successful HTTP response is received. If the HTTP call returns an `Err`, neither `store_snapshot` nor any timestamp update is called.

**When to use:** This is the caller's responsibility enforced by code structure, not by `SnapshotDb` internals. `store_snapshot` always updates the timestamp — it is the caller that decides whether to call it.

### Pattern 5: Watermark Query

**What:** Phase 13 needs the poll watermark. SnapshotDb exposes:

```rust
pub fn get_watermark(&self) -> AppResult<Option<String>> {
    let result: Option<String> = self.conn.query_row(
        "SELECT MIN(last_checked_at) FROM snapshot_store",
        [],
        |row| row.get(0),
    ).ok().flatten();
    Ok(result)
}
```

Returns `None` when the table is empty (no tickets have been checked yet).

### Anti-Patterns to Avoid

- **Normalizing JSON key order globally via BTreeMap:** Converting the full response `Value` to a BTreeMap-backed map for stable serialization is O(n log n) and changes the semantic structure unnecessarily. The Jira API returns consistent key order for the same endpoint — relying on that (with volatile field stripping) is sufficient. If instability is ever observed, switch to a sorted-key serializer.
- **Storing the snapshot in the same table as triage state:** Mixing snapshot data into `triage_state` would require ALTER TABLE on the primary triage table used by all existing code. A new `snapshot_store` table in a new module avoids this risk.
- **Comparing raw JSON strings directly without stripping volatile fields:** Avatar URLs and self-links change between requests (token expiry, CDN rotation). Raw string comparison would produce false positives on every fetch.
- **Using Rust's `std::hash` for content hashing:** `DefaultHasher` is explicitly non-stable across Rust versions and non-deterministic across processes. SHA-256 is the correct choice.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hash | Custom hash function | `sha2` crate | Cryptographic correctness, stability across versions |
| Hex encoding of hash bytes | Custom byte-to-hex loop | `hex` crate | Trivial but error-prone — standard crate is one call |
| JSON value traversal | Custom recursive parser | `serde_json::Value::pointer` | Pointer syntax handles nested paths cleanly; already in project |
| SQLite connection management | Custom connection pool | `rusqlite::Connection` (single-threaded, same as existing code) | Tauri Rust commands are already called from the async runtime; `Mutex<SnapshotDb>` is the established pattern |

**Key insight:** The existing codebase already has every ingredient. The only new addition to Cargo.toml is two crates that are already in the lock file as transitive dependencies.

---

## Common Pitfalls

### Pitfall 1: Volatile Field Order Causing False Hash Mismatches
**What goes wrong:** Jira sometimes reorders JSON object keys slightly between requests (e.g., optional fields appear/disappear from `expand`, `renderedFields` structure). If the canonical serialization is sensitive to key order, identical ticket content hashes differently on two sequential fetches.
**Why it happens:** `serde_json::to_string` preserves insertion order from the parsed JSON. If the API changes key order (even rarely), hashes diverge.
**How to avoid:** Strip volatile top-level keys (`expand`, `renderedFields`, `self`) before hashing. If instability still occurs, convert the stripped `Value` to a `BTreeMap`-backed object before serializing (add a `sort_keys` step).
**Warning signs:** Tests pass but production shows spurious "no changes detected → full diff → no fields changed" cycles.

### Pitfall 2: Description Field Producing False Positives (Jira Cloud v3 ADF)
**What goes wrong:** Jira Cloud returns `description` as an Atlassian Document Format (ADF) JSON object, not a string. The ADF object may include generated IDs or positions that vary between fetches even when the text is unchanged.
**Why it happens:** `extract_string` with `serde_json::Value::to_string()` on an ADF object will produce the full ADF JSON. If the ADF JSON is unstable, this registers as a description change.
**How to avoid:** For the `description` field, extract the `serde_json::Value::pointer("/fields/description")` node and compare using the stripped JSON representation of that node. Do NOT rely on ADF stability for the hash computation — the hash strips the whole response including description. The per-field diff for description may produce noisy results on v3 (Jira Cloud). Document this as a known limitation in code comments.
**Warning signs:** Description always shows up as changed even when the ticket text is visually identical.

### Pitfall 3: `last_checked_at` Updated on Error
**What goes wrong:** If the call site updates `last_checked_at` before confirming the API response succeeded, the watermark advances past failed tickets. Those tickets won't be re-polled by Phase 13.
**Why it happens:** Easy to accidentally call `store_snapshot` in an error handler or in a shared "finally" block.
**How to avoid:** The call site must gate `store_snapshot` strictly inside the success path. The `SnapshotDb` API itself doesn't enforce this — the structure of the calling code must. Add a comment at the call site: `// POLL-06: only call on success — do NOT call on HTTP error`.
**Warning signs:** Success criterion 4 test fails ("watermark does not advance when API call fails").

### Pitfall 4: SHA-256 Crate Not a Direct Dependency
**What goes wrong:** `sha2` is currently only a transitive dependency. `cargo` may in theory resolve it to a different version when other dependencies are updated. Without it being a direct dep, `use sha2::Digest` in new code will work today but could break after a `cargo update`.
**Why it happens:** Relying on transitive deps for direct use is fragile.
**How to avoid:** Add `sha2 = "0.10"` and `hex = "0.4"` to `[dependencies]` in `src-tauri/Cargo.toml`. This pins the feature set and version range explicitly.

### Pitfall 5: Missing `open_in_memory` Constructor Breaks Tests
**What goes wrong:** Without an `open_in_memory` constructor, unit tests cannot instantiate `SnapshotDb` without a real file path. The `TriageDb` and `AuditDb` pattern both implement `open_in_memory` for exactly this reason.
**Why it happens:** Forgetting to add the in-memory constructor means writing snapshot tests requires temp files and cleanup logic.
**How to avoid:** Implement `open_in_memory` as the first method alongside `open`. All unit tests use `SnapshotDb::open_in_memory().expect(...)`.

---

## Code Examples

### Storing a Snapshot

```rust
// Source: rusqlite 0.39 INSERT OR REPLACE pattern (same as triage_db.rs)
pub fn store_snapshot(&self, ticket_key: &str, response_json: &str) -> AppResult<String> {
    let hash = compute_hash(response_json)?;
    let now = chrono::Utc::now().to_rfc3339();
    self.conn.execute(
        "INSERT INTO snapshot_store (ticket_key, response_json, content_hash, last_checked_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(ticket_key) DO UPDATE SET
             response_json   = excluded.response_json,
             content_hash    = excluded.content_hash,
             last_checked_at = excluded.last_checked_at",
        rusqlite::params![ticket_key, response_json, hash, now],
    )?;
    Ok(hash)
}
```

### Retrieving a Stored Snapshot

```rust
// Source: rusqlite 0.39 query_row pattern (same as triage_db.rs get_fetch_config)
pub fn get_snapshot(&self, ticket_key: &str) -> AppResult<Option<StoredSnapshot>> {
    let result = self.conn.query_row(
        "SELECT response_json, content_hash, last_checked_at FROM snapshot_store WHERE ticket_key = ?1",
        rusqlite::params![ticket_key],
        |row| {
            Ok(StoredSnapshot {
                response_json:   row.get(0)?,
                content_hash:    row.get(1)?,
                last_checked_at: row.get(2)?,
            })
        },
    );
    match result {
        Ok(snap) => Ok(Some(snap)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}
```

### Full Change Detection Flow (called from commands.rs on success)

```rust
// Source: project pattern — AppResult<T> wrapping, same as existing commands
pub fn check_for_changes(
    snap_db: &SnapshotDb,
    ticket_key: &str,
    new_json: &str,
) -> AppResult<Vec<FieldChange>> {
    let new_hash = compute_hash(new_json)?;

    match snap_db.get_snapshot(ticket_key)? {
        None => {
            // First time seeing this ticket — store and return no changes
            snap_db.store_snapshot(ticket_key, new_json)?;
            Ok(vec![])
        }
        Some(stored) if stored.content_hash == new_hash => {
            // D-04: hash match — skip diff, still advance watermark
            snap_db.store_snapshot(ticket_key, new_json)?;
            Ok(vec![])
        }
        Some(stored) => {
            // Hash mismatch — run field-level diff then update snapshot
            let changes = detect_changes(&stored.response_json, new_json)?;
            snap_db.store_snapshot(ticket_key, new_json)?;
            Ok(changes)
        }
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `rusqlite` procedural migrations (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE`) | Same — no ORM needed at this scale | N/A — already established | No change to existing pattern |
| Custom hash implementations | `sha2` crate from RustCrypto ecosystem | Established — crate is already a transitive dep | Direct dep addition only |

**No deprecated approaches identified** — this is a new module with no existing code to migrate.

---

## Open Questions

1. **JSON key-order stability across Jira API versions**
   - What we know: `serde_json::to_string` preserves insertion order; Jira generally returns stable key order for the same endpoint
   - What's unclear: Whether Jira Cloud v3 ADF description objects have any non-deterministic fields that survive volatile-field stripping
   - Recommendation: Accept known limitation for description on v3; the hash approach is best-effort for ADF content. Document in code comments. The per-field diff for description will surface the change explicitly even if the hash also fires on non-semantic ADF metadata changes.

2. **Where SnapshotDb is initialized in the Tauri app state**
   - What we know: `TriageDb` and `AuditDb` are both created in `main.rs` / `commands.rs` and wrapped in `Arc<Mutex<T>>` or `Mutex<T>` passed to `tauri::Builder::manage`
   - What's unclear: The exact Tauri state management call site — `commands.rs` has not been read in full
   - Recommendation: Follow the existing pattern. Read `commands.rs` during Wave 0 before implementation to confirm injection point.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely Rust code and SQLite (both already present and verified). No new external tools, services, or CLI utilities are required. `sha2` and `hex` are already in Cargo.lock.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust built-in `#[test]` (no external test runner) |
| Config file | none — inline `#[cfg(test)]` modules per file |
| Quick run command | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db` |
| Full suite command | `cargo test --manifest-path src-tauri/Cargo.toml` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLL-04 | `store_snapshot` persists blob and `get_snapshot` retrieves it | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_store_and_get_snapshot` | Wave 0 — new file |
| POLL-05 | Identical fetch produces zero field changes (hash fast-path) | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_no_changes_on_identical_response` | Wave 0 — new file |
| POLL-05 | Status/priority change produces non-empty FieldChange list with old+new | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_field_change_detected` | Wave 0 — new file |
| POLL-05 | Comment-only update detected via comment count delta | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_comment_count_change_detected` | Wave 0 — new file |
| POLL-06 | `last_checked_at` does NOT advance when caller does not call `store_snapshot` | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_watermark_not_advanced_on_no_store` | Wave 0 — new file |
| POLL-06 | Watermark = MIN(last_checked_at) across stored tickets | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_watermark_is_minimum` | Wave 0 — new file |

### Sampling Rate

- **Per task commit:** `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db`
- **Per wave merge:** `cargo test --manifest-path src-tauri/Cargo.toml`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src-tauri/src/snapshot_db.rs` — new file covering all POLL-04, POLL-05, POLL-06 tests
- [ ] `src-tauri/Cargo.toml` — add `sha2 = "0.10"` and `hex = "0.4"` direct deps
- [ ] `src-tauri/src/lib.rs` — add `pub mod snapshot_db;`

---

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` found in the project root. No project-level constraints to enforce beyond what is already documented in CONTEXT.md decisions.

---

## Sources

### Primary (HIGH confidence)

- `src-tauri/src/triage_db.rs` — established SQLite/rusqlite patterns: `CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`, `ON CONFLICT DO UPDATE`, `open_in_memory` for tests
- `src-tauri/src/audit.rs` — `SnapshotDb` struct template; Arc<Mutex<T>> threading pattern
- `src-tauri/Cargo.toml` — confirmed dependency versions: rusqlite 0.39, serde_json 1.x, chrono 0.4, serde 1.x
- `Cargo.lock` (transitive) — confirmed sha2 0.10.9 and hex 0.4.3 already present

### Secondary (MEDIUM confidence)

- `sha2` crate README / RustCrypto ecosystem: `Digest` trait, `Sha256::new()` / `hasher.update()` / `hasher.finalize()` API (well-established, unchanged since 0.10.0)
- `serde_json::Value::pointer` docs: JSON Pointer (RFC 6901) for field extraction

### Tertiary (LOW confidence)

- Jira Cloud ADF description instability: based on known behavior from multiple community reports; not formally verified against this project's Jira instance

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all crates confirmed in Cargo.toml or Cargo.lock via direct file inspection
- Architecture: HIGH — directly modeled on audited existing code in triage_db.rs and audit.rs
- Pitfalls: MEDIUM — most pitfalls derived from direct code analysis; ADF instability is LOW (community knowledge, not locally tested)

**Research date:** 2026-03-27
**Valid until:** 2026-05-01 (stable Rust ecosystem, no fast-moving dependencies)
