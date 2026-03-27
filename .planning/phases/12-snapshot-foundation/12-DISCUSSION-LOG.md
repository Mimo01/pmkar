# Phase 12: Snapshot Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 12-snapshot-foundation
**Areas discussed:** Snapshot storage scope, Hash strategy, Change detection granularity, Watermark design

---

## Snapshot storage scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full JSON blob | Store entire Jira API response as JSON column. Larger but zero maintenance when fields change. Phase 15 diff view can compare any field without re-fetching. | ✓ |
| Selected fields only | Store only change-relevant fields in typed columns. Smaller footprint but needs schema migration when adding fields. | |
| Hybrid — blob + indexed columns | Store full JSON blob AND extract key fields into indexed columns for fast queries. Best of both worlds but more complex schema. | |

**User's choice:** Full JSON blob
**Notes:** Recommended approach accepted — simplicity and future-proofing valued over storage efficiency.

---

## Hash strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Hash normalized JSON | SHA-256 of full JSON with volatile fields stripped. Hash mismatch triggers field-level diff. Simple, catches everything. | ✓ |
| Use Jira's 'updated' timestamp | Compare ticket's 'updated' field against stored value. Zero computation but Jira sometimes updates timestamp without meaningful changes. | |
| Hash selected fields only | SHA-256 of a field subset. Ignores noise from irrelevant fields but could miss changes. | |

**User's choice:** Hash normalized JSON
**Notes:** Recommended approach accepted — full coverage preferred over avoiding false positives from noisy fields.

---

## Change detection granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Core + comments | Status, priority, assignee, summary, description, labels, components, fix versions, comment count. Attachments and worklogs tracked by count delta. | ✓ |
| Core fields only | Just status, priority, and comment count. Minimal — matches notification requirements but limits Phase 15 diff view. | |
| Everything comparable | All fields including attachments, worklogs, issue links, sub-tasks. Comprehensive but potentially noisy. | |

**User's choice:** Core + comments
**Notes:** Recommended approach accepted — balances coverage for Phase 15 diff view with avoiding noise from rarely-relevant fields.

---

## Watermark design

| Option | Description | Selected |
|--------|-------------|----------|
| Per-ticket timestamps | Each ticket row stores its own last_checked_at. Granular recovery — failed poll only leaves unchecked tickets behind. | ✓ |
| Single global watermark | One timestamp in config table. Simpler but partial failure makes all tickets appear stale. | |
| Batch watermark | Per-batch ID that only advances when entire batch succeeds. Atomic but re-checks already-seen tickets on partial failure. | |

**User's choice:** Per-ticket timestamps
**Notes:** Recommended approach accepted — granular failure recovery aligns with POLL-06 requirement that watermark only advances after successful response.

---

## Claude's Discretion

- JSON normalization strategy for hash computation
- SQLite schema migration approach
- Whether snapshot table lives in TriageDb or separate module
- Internal Rust data structures for field-level diffs

## Deferred Ideas

None — discussion stayed within phase scope
