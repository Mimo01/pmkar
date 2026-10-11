---
phase: 27
slug: add-static-value-mapping-to-configurable-field-mapping
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react (frontend) / Rust built-in `#[test]` (backend) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/features/field-mapping && cargo test -p pmkar-lib` |
| **Full suite command** | `npx vitest run && cargo test -p pmkar-lib` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/features/field-mapping && cargo test -p pmkar-lib`
- **After every plan wave:** Run `npx vitest run && cargo test -p pmkar-lib`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-DB-01 | DB | 1 | STATIC-DB-01 | — | rusqlite params binding prevents SQL injection | unit (Rust) | `cargo test -p pmkar-lib field_mapping_db` | ❌ W0 | ⬜ pending |
| 27-DB-02 | DB | 1 | STATIC-DB-02 | — | N/A | unit (Rust) | `cargo test -p pmkar-lib upsert_mapping_row` | ❌ W0 | ⬜ pending |
| 27-PIPE-01 | Pipeline | 1 | STATIC-PIPE-01 | — | static_value forwarded as JSON field value to Jira API | unit (Rust) | `cargo test -p pmkar-lib pipeline` | ❌ W0 | ⬜ pending |
| 27-PIPE-02 | Pipeline | 1 | STATIC-PIPE-02 | — | N/A | unit (Rust) | `cargo test -p pmkar-lib pipeline` | ❌ W0 | ⬜ pending |
| 27-UI-01 | UI | 2 | STATIC-UI-01 | — | N/A | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticMappingRow` | ❌ W0 | ⬜ pending |
| 27-UI-02 | UI | 2 | STATIC-UI-02 | — | N/A | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticValueWidget` | ❌ W0 | ⬜ pending |
| 27-UI-03 | UI | 2 | STATIC-UI-03 | — | N/A | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticMappingRow` | ❌ W0 | ⬜ pending |
| 27-UI-04 | UI | 2 | STATIC-UI-04 | — | N/A | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticMappingRow` | ❌ W0 | ⬜ pending |
| 27-I18N-01 | UI | 2 | STATIC-I18N-01 | — | N/A | integration | `npx vitest run src/i18n/__tests__/translations` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx` — stubs for STATIC-UI-01, STATIC-UI-03, STATIC-UI-04
- [ ] `src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` — stub for STATIC-UI-02
- [ ] Rust `#[test]` functions in `src-tauri/src/field_mapping_db.rs` — stubs for STATIC-DB-01, STATIC-DB-02
- [ ] Rust `#[test]` functions in `src-tauri/src/field_transform/pipeline.rs` — stubs for STATIC-PIPE-01, STATIC-PIPE-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smart widget renders correct input type per field schema | STATIC-UI-02 | Requires live Tauri IPC + field_schema_cache data | Open Settings → Copying → Field Mapping, add static value, pick an option field, verify dropdown appears; pick a string field, verify text input appears |
| Static value written to Jira on copy | STATIC-PIPE-01 | Requires live Jira Cloud sandbox | Copy a ticket with a static mapping; verify target issue has expected field value |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
