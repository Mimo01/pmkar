---
phase: 19
slug: mapping-persistence-crud-commands
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust built-in test harness (`#[cfg(test)]` + `#[test]`) |
| **Config file** | None — standard Cargo test runner |
| **Quick run command** | `cd src-tauri && cargo test -- field_mapping_db` |
| **Full suite command** | `cd src-tauri && cargo test` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `cd src-tauri && cargo test -- field_mapping_db`
- **After every plan wave:** Run `cd src-tauri && cargo test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | MAP-01 | — | SQL params bound via `params![]`, never interpolated | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::open_in_memory_creates_tables` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | MAP-02 | — | N/A | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::seed_inserts_five_defaults_on_empty_table` | ❌ W0 | ⬜ pending |
| 19-01-03 | 01 | 1 | MAP-02 | — | N/A | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::seed_does_not_run_when_table_has_rows` | ❌ W0 | ⬜ pending |
| 19-01-04 | 01 | 1 | MAP-02 | — | N/A | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::default_transformer_kinds_are_correct` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 2 | MAP-01 | — | N/A | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::get_returns_rows_in_insertion_order` | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 2 | MAP-01 | — | SQL params bound via `params![]` | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::upsert_mapping_row_replaces_existing` | ❌ W0 | ⬜ pending |
| 19-02-03 | 02 | 2 | MAP-01 | — | N/A | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::delete_mapping_row_is_idempotent` | ❌ W0 | ⬜ pending |
| 19-02-04 | 02 | 2 | MAP-01 | — | N/A | unit | `cd src-tauri && cargo test -- field_mapping_db::tests::round_trip_survives_reopen` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All 8 test functions are new additions to the existing `#[cfg(test)]` block in `src-tauri/src/field_mapping_db.rs` — no new test files needed.

- [ ] `src-tauri/src/field_mapping_db.rs` — add 8 new `#[test]` functions for MAP-01 and MAP-02 coverage
  - `open_in_memory_creates_tables`
  - `seed_inserts_five_defaults_on_empty_table`
  - `seed_does_not_run_when_table_has_rows`
  - `default_transformer_kinds_are_correct`
  - `get_returns_rows_in_insertion_order`
  - `upsert_mapping_row_replaces_existing`
  - `delete_mapping_row_is_idempotent`
  - `round_trip_survives_reopen`

*Framework already installed — no install step needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
