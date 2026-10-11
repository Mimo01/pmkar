---
phase: 25
slug: preview-time-resolution
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-05
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Rust)** | `cargo test` |
| **Framework (Frontend)** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (frontend), `Cargo.toml` (Rust) |
| **Quick run (Rust)** | `cargo test -p pmkar-lib -- resolve_description_to_adf` |
| **Quick run (Frontend)** | `npx vitest run src/features/tickets/__tests__/` |
| **Full suite command** | Pre-commit hook (lint + type-check + test + clippy + fmt) |
| **Estimated runtime** | ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick run for the tier modified (Rust or Frontend)
- **After every plan wave:** Run full suite (pre-commit hook equivalent)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Behavior | Test Type | Automated Command | Status |
|---------|------|------|----------|-----------|-------------------|--------|
| 25-01-01 | 01 | 1 | `resolve_description_to_adf` returns `{ type: "doc" }` for non-empty HTML | Rust unit | `cargo test -p pmkar-lib -- resolve_description_to_adf` | ⬜ pending |
| 25-01-02 | 01 | 1 | Empty HTML input returns empty ADF doc | Rust unit | `cargo test -p pmkar-lib -- resolve_description_to_adf` | ⬜ pending |
| 25-01-03 | 01 | 1 | `UserResolver::fetch_users_by_domain("example.com")` against mock Cloud server returns `{ accountId, displayName }` | Rust integration (mock server) | `cargo test -p pmkar-lib -- resolve_users_preview_returns_account_id` | ⬜ pending |
| 25-02-01 | 02 | 2 | Pre-fill effect fires async, sets overrideValues['description'] to ADF | Frontend unit | `npx vitest run src/features/tickets/__tests__/CopyPreviewPage` | ⬜ pending |
| 25-02-02 | 02 | 2 | User fields pre-filled: overrideValues contains `{ accountId }` for user rows | Frontend unit | `npx vitest run src/features/tickets/__tests__/CopyPreviewPage` | ⬜ pending |
| 25-02-03 | 02 | 2 | UserPickerRenderer renders with pre-resolved `{ displayName }` value | Frontend unit | `npx vitest run src/features/field-renderers/__tests__/` | ⬜ pending |
| 25-02-04 | 02 | 2 | `confirmCopy` invoke args contain Phase 25 override values: `overrideValues.description` (ADF object) and `overrideValues.assignee` (accountId) — verified in copyStore.test.ts PREV-04 test | Frontend unit | `npx vitest run src/features/tickets/__tests__/copyStore.test.ts` | ⬜ pending |
| 25-02-05 | 02 | 2 | Description shown read-only in preview (ADF rendered, not empty textarea) | Frontend unit | `npx vitest run src/features/tickets/__tests__/CopyPreviewPage` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Rust unit tests: `resolve_description_to_adf_returns_doc_for_html`, `resolve_description_to_adf_returns_empty_doc_for_empty_html`, `resolve_description_to_adf_paragraph_content_non_empty` — in `commands.rs` test module (3 tests, no HTTP)
- [x] Rust integration test `resolve_users_preview_returns_account_id_for_known_mock_user` — in `src-tauri/tests/resolve_users_preview_integration.rs`; calls `UserResolver::fetch_users_by_domain` against mock Cloud server at 127.0.0.1:8081; asserts accountId and displayName are non-empty
- [ ] Frontend tests in CopyPreviewPage.test.tsx: PREV-01 (resolve_description_to_adf invoke), PREV-02 (resolve_users_preview invoke), PREV-03 (description excluded from DynamicTargetForm)
- [ ] Frontend test in copyStore.test.ts: PREV-04 (confirmCopy invoke args contain Phase 25 override values)

*Wave 0 must be written before implementation tasks in each plan.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Description ADF renders as formatted text in preview modal | ADF rendering is visual; unit tests can't verify prose layout | Open copy preview for a ticket with multi-paragraph description, confirm it renders formatted (not as JSON) |
| User picker shows pre-resolved user name | UserPickerRenderer visual state | Open copy preview for a ticket with assignee, confirm user name appears pre-filled before editing |
| Edited description override flows to copied issue | End-to-end UI flow | Pre-fill fires, user edits description text, clicks Copy — copied Jira issue must contain the edited description |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
