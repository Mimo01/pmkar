# Phase 12: Snapshot Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Store ticket snapshots in SQLite for change comparison. Detect which fields changed since the last fetch using hash-based fast check and field-level diff. Poll watermark persists in SQLite and advances only after successful API response.

</domain>

<decisions>
## Implementation Decisions

### Snapshot storage scope
- **D-01:** Store the full Jira API response as a JSON blob column per ticket — no selective field extraction
- **D-02:** Zero schema maintenance when new fields are added — the blob captures everything automatically

### Hash strategy
- **D-03:** Compute SHA-256 of the full JSON response with volatile fields stripped (self URLs, avatar URLs, expand metadata)
- **D-04:** A hash mismatch triggers field-level diff; matching hash means no change — skip diff entirely

### Change detection granularity
- **D-05:** Field-level diff covers: status, priority, assignee, summary, description, labels, components, fix versions, comment count
- **D-06:** Attachments and worklogs tracked by count delta (new attachment count > stored count = change)
- **D-07:** Each detected change records field name, old value, and new value

### Watermark design
- **D-08:** Per-ticket `last_checked_at` timestamp stored alongside the snapshot row
- **D-09:** Watermark = MIN(last_checked_at) across all tracked tickets — used by Phase 13 polling engine
- **D-10:** A failed API call for a ticket does NOT update that ticket's `last_checked_at` — only successful responses advance the timestamp

### Claude's Discretion
- JSON normalization strategy for hash computation (field ordering, whitespace handling)
- SQLite schema migration approach (ALTER TABLE vs. new table)
- Whether to add the snapshot table to existing `TriageDb` or create a separate `SnapshotDb`
- Internal data structures for representing field-level diffs in Rust

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Snapshot storage and change detection
- `.planning/REQUIREMENTS.md` — POLL-04 (snapshot storage), POLL-05 (hash check + field diff), POLL-06 (watermark persistence)
- `.planning/ROADMAP.md` Phase 12 — Success criteria defining expected behaviors

### Existing database layer
- `src-tauri/src/triage_db.rs` — Existing SQLite schema and `TriageDb` struct pattern (rusqlite, single-file DB)
- `src-tauri/src/audit.rs` — Audit DB pattern (separate concern, same SQLite approach)

### Ticket data model
- `src/features/tickets/types.ts` — `JiraTicket` (list view) and `JiraTicketDetail` (full detail) TypeScript interfaces
- `src-tauri/src/jira_client.rs` — HTTP client structure (reqwest + audit middleware)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TriageDb` struct (`src-tauri/src/triage_db.rs`): Established pattern for SQLite table creation, migrations via ALTER TABLE, and CRUD operations with rusqlite
- `JiraTicketDetail` type (`src/features/tickets/types.ts`): Full ticket structure including changelog, comments, attachments — defines what the JSON blob will contain
- `JiraClient` (`src-tauri/src/jira_client.rs`): HTTP client with audit middleware — snapshot storage will consume responses from this client

### Established Patterns
- Single SQLite database file managed by rusqlite `Connection`
- Schema migrations via idempotent `ALTER TABLE` with error suppression (`let _ = conn.execute_batch(...)`)
- Serde serialization between Rust structs and frontend TypeScript types (snake_case to camelCase)
- `AppResult<T>` error type wrapping across all Rust modules

### Integration Points
- Snapshot storage will be called after each ticket fetch (currently in Tauri commands in `commands.rs`)
- Change detection results will be consumed by Phase 13 (polling engine) and Phase 14 (notifications)
- Field-level diffs will be consumed by Phase 15 (change diff view UI)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-snapshot-foundation*
*Context gathered: 2026-03-27*
