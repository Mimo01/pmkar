---
phase: 24
slug: audit-log-copy-time-resolution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Rust)** | `cargo test` (tokio for async, rusqlite for in-memory SQLite) |
| **Framework (Frontend)** | Vitest 4.x |
| **Quick run (Rust)** | `cargo test -p pmkar-lib -- copy_time_audit` |
| **Quick run (Frontend)** | `npx vitest run src/features/tickets/AuditLogPage` |
| **Full suite** | Pre-commit hook (lint + type-check + test + clippy + fmt) |
| **Estimated runtime** | ~30 seconds (Rust unit), ~10 seconds (Frontend unit) |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick run command for that plan
- **After every plan wave:** Run full pre-commit suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~40 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 24-01-T1 | 24-01 | 1 | copy-time audit entries written with outcome='copied' | Rust unit | `cargo test -p pmkar-lib -- copy_time_audit` | [ ] |
| 24-01-T1 | 24-01 | 1 | skipped entries for null source values | Rust unit | `cargo test -p pmkar-lib -- copy_time_audit` | [ ] |
| 24-01-T1 | 24-01 | 1 | failed entries for GapVariant (gap_kind='person') | Rust unit | `cargo test -p pmkar-lib -- copy_time_audit` | [ ] |
| 24-01-T1 | 24-01 | 1 | copy_id threaded from args into inserted rows | Rust unit | `cargo test -p pmkar-lib -- copy_time_audit` | [ ] |
| 24-01-T1 | 24-01 | 1 | empty target_field_id rows are skipped | Rust unit | `cargo test -p pmkar-lib -- copy_time_audit` | [ ] |
| 24-01-T2 | 24-01 | 1 | previewCopyId flows from CopyPreviewPage → CopyTicketV2Args | TypeScript compile | `npx tsc --noEmit` | [ ] |
| 24-02-T1 | 24-02 | 2 | 'copied' badge renders blue | Frontend unit | `npx vitest run src/features/tickets/__tests__/AuditLogPage.fieldGrouping` | [ ] |
| 24-02-T1 | 24-02 | 2 | i18n key audit.fields.outcome.copied resolves in EN+SK | Frontend unit | `npx vitest run src/features/tickets/__tests__/AuditLogPage.fieldGrouping` | [ ] |
| 24-02-T2 | 24-02 | 2 | 'copied' rows not counted in failed/skipped summary | Frontend unit | `npx vitest run -- --reporter=verbose AuditLogPage.fieldGrouping` | [ ] |

---

## Wave 0 Gaps

Tests to be written during execution (not pre-existing):

- [ ] `copy_time_audit_entries_written` — Rust unit test in `field_mapping_db.rs` or `commands.rs` test module. Uses `FieldMappingDb::open_in_memory()`. Covers Plan 24-01 Task 1 (5 assertions: copied/skipped/failed outcomes, copy_id threading, empty target_field_id guard).
- [ ] `AuditLogPage.fieldGrouping` frontend tests — 3 new test cases in `AuditLogPage.fieldGrouping.test.tsx`. Covers Plan 24-02 Tasks 1-2 (blue badge render, i18n label, group summary counter unchanged).

---

## Security Validation

| Threat | Control | Verify Command |
|--------|---------|----------------|
| SQL injection via field_id | `params![]` binding in `insert_mapping_audit` | Existing test at `field_mapping_db.rs:1116` — `cargo test -p pmkar-lib -- sql_injection` |
| Unbounded JSON value (DoS) | `cap_audit_json` at 4096 bytes | Grep: `cap_audit_json` called before `insert_mapping_audit` in new loop |
| Credential leak via field values | `redact_string_in_value` applied before hash/persist | Grep: `redact_string_in_value` called in `write_copy_time_audit` helper |
