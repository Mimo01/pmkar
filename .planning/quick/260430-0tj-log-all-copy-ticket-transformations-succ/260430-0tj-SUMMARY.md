---
quick_id: 260430-0tj
slug: log-all-copy-ticket-transformations-succ
description: Log all copy ticket transformations (successful and failed)
status: complete
completed_date: "2026-04-30"
duration: ~25 min
tasks: 2
files_changed: 8
commits:
  - 6e4cd07: "feat(260430-0tj): extend mapping_audit_log schema + audit write site + getter command"
  - bf12728: "feat(260430-0tj): add Field Transformations tab to AuditLogPage"
key_decisions:
  - "migrate_mapping_audit_log_columns uses pragma_table_info check + per-column ALTER TABLE — idempotent, surfaces errors rather than silently diverging (T-0tj-02)"
  - "get_mapping_audit_log_page clamps limit to 1..=500 server-side — prevents unbounded SELECT from frontend bug (T-0tj-03)"
  - "Field Transformations tab lazy-loads on first activation and maintains independent state from API Audit tab"
  - "outcome derivation order: gap_kind present → failed; fields contains key → ok; src_val null → skipped(source value missing); else → skipped(no value produced)"
---

# Quick Task 260430-0tj: Log All Copy Ticket Transformations Summary

**One-liner:** Extended mapping_audit_log with transformer_kind/outcome/failure_reason columns + idempotent migration + Tauri getter command + tabbed AuditLogPage UI showing per-field copy outcomes color-coded (ok/failed/skipped).

## What Was Built

### Task 1: Rust — Schema + Audit Write Site + Getter Command

**field_mapping_db.rs:**
- Added `transformer_kind TEXT NOT NULL DEFAULT ''`, `outcome TEXT NOT NULL DEFAULT 'ok'`, `failure_reason TEXT` columns to `CREATE_MAPPING_AUDIT_LOG`
- Added `migrate_mapping_audit_log_columns()` — idempotent ALTER TABLE via `PRAGMA table_info` check, called from both `open()` and `open_in_memory()` after schema creation
- Added `MappingAuditEntry` DTO struct with `#[serde(rename_all = "camelCase")]` for frontend
- Extended `insert_mapping_audit()` signature with `transformer_kind`, `outcome`, `failure_reason` params (3 params added)
- Added `get_mapping_audit_log_page(offset, limit)` returning `Vec<MappingAuditEntry>` ordered by `id DESC`

**commands.rs:**
- Updated `copy_ticket_v2` audit loop to derive `(outcome, failure_reason)` per row: gap → "failed"/"unresolved {gk}"; field in resolved → "ok"/None; src null → "skipped"/"source value missing"; else → "skipped"/"no value produced"
- Updated pure-override loop to pass `"override"/"ok"` sentinel values
- Added `get_mapping_audit_log_page` Tauri command with `limit.clamp(1, 500)` and `offset.max(0)`

**main.rs:**
- Registered `commands::get_mapping_audit_log_page` in invoke_handler adjacent to `copy_ticket_v2`

**Tests:** Updated 4 existing mapping_audit tests for new signature; added 5 new tests (3 outcome tests, pagination ordering, legacy DB migration).

### Task 2: Frontend — Field Transformations Tab

**types.ts:** Added `MappingAuditEntry` interface

**en.json / sk.json:** Added 17 new `audit.tab.*` and `audit.fields.*` i18n keys; Slovak with full diacritics

**AuditLogPage.tsx:**
- Added `Tab = 'api' | 'fields'` type + `activeTab` state
- Added Field Transformations state: `mappingEntries`, `mappingOffset`, `mappingHasMore`, `mappingLoading`, `mappingError`, `mappingFetched`
- Added `useEffect` that lazy-loads on first `activeTab === 'fields'` activation
- Added `loadMoreMapping()` function
- Added tab bar (`role="tablist"`) between header and filter toolbar
- Added Field Transformations panel: loading spinner, error, empty state (with hint), table with 6 columns (timestamp, copy id 8-char+ellipsis, field, transformer badge, outcome badge color-coded, failure reason), load-more pagination
- Gated all existing API Audit content (toolbar, loading skeleton, error, empty states, table) on `activeTab === 'api'`

**AuditLogPage.test.tsx:** Added 2 new tests using `mockImplementation` dispatch by command name

## Test Results

- `cargo test --lib field_mapping_db`: 30/30 passed (25 existing + 5 new)
- `cargo check --lib`: clean
- `npx tsc --noEmit`: clean
- `npx vitest run AuditLogPage.test.tsx`: 25/25 passed (23 existing + 2 new)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| (none) | — | New IPC command `get_mapping_audit_log_page` covered by T-0tj-01/T-0tj-03 in plan threat model; limit clamped 1..=500, values are already-redacted hashes |

## Known Stubs

None — mapping_audit_log data flows from real copy_ticket_v2 calls; UI wired to live Tauri command.

## Self-Check: PASSED

- `src-tauri/src/field_mapping_db.rs` — modified, committed in 6e4cd07
- `src-tauri/src/commands.rs` — modified, committed in 6e4cd07
- `src-tauri/src/main.rs` — modified, committed in 6e4cd07
- `src/features/tickets/types.ts` — modified, committed in bf12728
- `src/i18n/locales/en.json` — modified, committed in bf12728
- `src/i18n/locales/sk.json` — modified, committed in bf12728
- `src/features/tickets/AuditLogPage.tsx` — modified, committed in bf12728
- `src/features/tickets/AuditLogPage.test.tsx` — modified, committed in bf12728
