---
phase: 17
slug: field-discovery-mock-schema-fidelity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust: `cargo test` (built-in). Frontend: `vitest` (already in package.json). |
| **Config file** | `src-tauri/Cargo.toml` (Rust), `vitest.config.ts` (TS) |
| **Quick run command** | `cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery && npx vitest run --no-coverage src/types/fieldSchema.test.ts` |
| **Full suite command** | `cargo test --manifest-path src-tauri/Cargo.toml && npx vitest run --no-coverage` |
| **Estimated runtime** | ~45 seconds (quick) / ~3 minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command (scoped to `field_discovery::*` + `fieldSchema.test.ts`)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green; manual probe-failure walkthrough completed
- **Max feedback latency:** ~45 seconds (quick) / ~180 seconds (full)

---

## Per-Task Verification Map

> Concrete `task_id → test command` map will be filled in by the planner during plan-phase. Per RESEARCH.md §"Validation Architecture", every plan task that touches field discovery code must reference one of the Wave 0 test files (or extend it).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | DISC-01 | T-17-01 / — | Discovered field types validated against allowlist (no arbitrary serde tag execution) | unit | `cargo test --manifest-path src-tauri/Cargo.toml field_discovery::serde_round_trip` | ❌ W0 | ⬜ pending |
| {N}-01-02 | 01 | 1 | DISC-02 | T-17-02 / — | Pagination loop bounded by Atlassian-reported `total`; rejects responses where pages exceed declared total to prevent infinite loops | unit | `cargo test --manifest-path src-tauri/Cargo.toml field_discovery::pagination_bounded` | ❌ W0 | ⬜ pending |
| {N}-01-03 | 01 | 1 | DISC-04 | T-17-03 / — | Probe-failure error message redacts auth headers; surfaces only endpoint URL + status code | integration | `cargo test --manifest-path src-tauri/Cargo.toml --test probe probe_redacts_credentials` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> The planner will replace these illustrative rows with one row per task during plan-phase. Wave 0 stubs are listed below.

---

## Wave 0 Requirements

Test files that MUST exist before Wave 1 implementation begins (mirrors RESEARCH.md §"Wave 0 Test Gaps"):

**Rust (under `src-tauri/src/` and `src-tauri/tests/`):**
- [ ] `src-tauri/src/field_discovery.rs` — module root with `#[cfg(test)] mod tests` block
- [ ] `src-tauri/src/field_mapping_db.rs` — `mapping.db` open + migration tests
- [ ] `src-tauri/tests/field_discovery_integration.rs` — end-to-end tests against the in-process mock server
- [ ] `src-tauri/tests/createmeta_pagination.rs` — pagination correctness across page boundaries
- [ ] `src-tauri/tests/probe_createmeta.rs` — probe pass/fail paths
- [ ] `src-tauri/tests/mock_server_field_routes.rs` — `/field`, `/createmeta`, `/createmeta/{key}/issuetypes/{id}`, `/editmeta`, `/project/{key}/versions`, `/project/{key}/components` returns expected fixtures

**TypeScript (under `src/types/` and `src/features/`):**
- [ ] `src/types/fieldSchema.ts` — discriminated union types
- [ ] `src/types/fieldSchema.test.ts` — vitest unit tests for type narrowing helpers + JSON parse
- [ ] `src/stores/schemaCacheStore.ts` — Zustand store skeleton (cache state + manual refresh action)
- [ ] `src/stores/schemaCacheStore.test.ts` — store action tests

**Fixture files:**
- [ ] `src-tauri/src/fixtures.rs` — extension scaffolding for 5 customfield fixtures (D-09, D-10) + Bug/Task/Story issue types (D-11)

*No new test framework needed — `cargo test` and `vitest` are already configured per `package.json` and the existing `src-tauri/tests/` directory.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Connection probe failure surfaces in real Settings UI (banner + red status pill) | DISC-04 | Visual presentation of dismissable banner + Settings → Connections row pill cannot be auto-asserted without a browser-driver setup that does not exist in this project | 1. Configure a Cloud target whose proxy returns 404 for `/createmeta/{key}/issuetypes/{id}`. 2. Launch app. 3. Confirm app-shell banner appears with exact endpoint URL + HTTP status code. 4. Confirm red status pill on the Cloud connection row in Settings → Connections. 5. Dismiss banner; reopen app — banner reappears (not persistently dismissed). |
| Pre-warm fetch fires after probe success without blocking app launch | DISC-02 | Timing assertion between probe and pre-warm requires production timing, not test-time | 1. Add `tracing::info!` log at probe-success and pre-warm-start. 2. Launch app. 3. Confirm log shows pre-warm started after probe within 1s, and app interactive UI rendered before pre-warm completed (cold-start time per RESEARCH.md). |
| Skeleton render on cache miss inside Copy Preview | DISC-01 | Visual skeleton consistency with existing TicketCard / AuditLogPage skeletons | Phase 22 manual UAT — out of scope for Phase 17 sign-off. Phase 17 only verifies the cache-miss code path returns the correct loading state shape via unit tests. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references in RESEARCH.md §"Wave 0 Test Gaps"
- [ ] No watch-mode flags (cargo test runs single-shot, vitest uses `run` not `watch`)
- [ ] Feedback latency < 60s for quick command on a warm cache
- [ ] `nyquist_compliant: true` set in frontmatter once planner has filled the per-task map and all Wave 0 stubs exist

**Approval:** pending
