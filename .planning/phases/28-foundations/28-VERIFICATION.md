---
phase: 28-foundations
verified: 2026-10-12T00:00:00Z
status: passed
score: 4/4 roadmap success criteria verified (plus all plan-level truths)
overrides_applied: 0
gaps: []
---

# Phase 28: Foundations Verification Report

**Phase Goal:** Groups have a durable, restart-safe home and the shared building blocks later phases rely on exist, while copy-step labels are fully translated
**Status:** passed (4 non-blocking review warnings carried forward)
**Re-verification:** No, initial verification

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | Groups, names, colors, order, memberships persist across restart | VERIFIED | `src-tauri/src/groups_db.rs` is file-backed SQLite (`GroupsDb::open(path)`). Test `groups_survive_reopen` drops and reopens from a tempdir path. `main.rs:146-149` opens `app_dir/groups.db` and manages it as `Arc<Mutex<GroupsDb>>`. All 10 commands are registered (`main.rs:203-212`). `App.tsx:82-87` calls `useGroupStore.hydrate()` once connection meta is loaded. The store reads `list_groups` and `list_group_memberships` (`groupStore.ts`). Rust `cargo test --lib groups`: 24 passed. |
| 2 | Copy screens show translated EN and SK labels for every step, including add_remotelink, fetch_source, update_triage, worklog:fetch | VERIFIED | `copyStepLabel.ts` handles all four named ids. `worklog:fetch` is matched before the generic `worklog:{n}` prefix. Unknown ids fall back to a translated label. Both CopyResultModal and CopyResultPage use the helper. "Created:" is translated (test asserts `Created: CLOUD-9`). Vitest copy and ticket suites: 31 files, 478 tests passed. |
| 3 | A test fails if Rust emits a copy step id with no translation key | VERIFIED | `__tests__/copyStepSync.test.ts` regex-scans `copy_pipeline.rs` and `commands.rs` for `step: "…".to_string()` and `format!("kind:{` ids. It asserts a non-vacuous set (at least 8 ids, the five named literals, the four kinds). For each id it checks success and failure against real keys in en.json and sk.json, and rejects the unknown fallback. |
| 4 | New / Not mine / Linked lists filter and sort as before | VERIFIED | The characterization test commit `fec1e51` precedes the refactor commit `8403f1a`. `ticketListUtils.ts` holds the shared logic and the three pages import it. `ticketListParity.test.tsx` and `ticketListUtils.test.ts` pass. |

### Plan-level truths (spot-checked against code)

- **Scope is derived in Rust, never by the frontend (28-05).** `groups_commands.rs` has `resolve_scope`, with tests for the no-meta case and the no_scope code. Lock-order and poisoned-mutex tests pass.
- **Source change re-hydrates after `set_connection_meta` settles (28-06).** `rehydrateAfter(persist)` awaits the persist promise first. It is wired in SettingsPage and SetupWizard, and the ordering test passes.
- **Palette and contrast (28-03).** `colors.ts`, the CSS variables and the parity and contrast tests pass.
- **Name, color and scope rules plus atomic bulk membership (28-04).** Present in `groups_db.rs` with shared vectors in `src/test-fixtures/group-vectors.json`. Rust tests pass. The crate checkpoint was approved by the user.
- **Zustand rule (28-06).** `selectGroupIdsForIssue` falls back to `null`.

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| GRP-06 | 28-01, 03, 04, 05, 06 | SATISFIED | Truth 1. REQUIREMENTS.md marks it Complete. |
| CONI-01 | 28-02 | SATISFIED | Truths 2 and 3: a shared helper, EN and SK keys, and the sync test. REQUIREMENTS.md still shows `[ ]` and "Pending", so tick it at phase close. |

There are no orphaned requirements. Only GRP-06 and CONI-01 map to Phase 28, and both are claimed by plans.

## Anti-Patterns

No TBD, FIXME or XXX markers in the phase's files. No stubs found.

## Review Warnings Considered (28-REVIEW.md)

None defeats a must-have. All four are hardening items for Phases 29 and later:
- **WR-01, hydrate race / stale overwrite.** It can matter for a scope switch, but the ordering-after-persist truth (D-01) is satisfied in the normal path. Recommend a sequence counter.
- **WR-02, failed refresh clears groups.** This is a UI-state resilience issue. Persisted data in groups.db is untouched, so SC1 holds. It should be fixed before group tabs render from this state.
- **WR-03, TS/Rust trim mismatch, and WR-04, zero-width names.** These are edge cases outside the shared vectors. The plan-level truth "Rust and the shared vectors agree" holds for the vectors that exist. Recommend adding vectors.

## Behavioral Spot-Checks

| Check | Result |
|---|---|
| `vitest run` on groups, tickets and `__tests__` | 478 passed, 0 failed |
| `cargo test --lib groups` | 24 passed |
| Baseline failures from the orchestrator (7 vitest, 2 Rust) | Pre-existing in unrelated areas (TicketListPage, StaticMappingRow, SettingsPage domain search, createmeta pagination). Not regressions, and they do not touch phase truths. |

## Human Verification

None required. Restart persistence is covered by the reopen test. A manual restart smoke test can be folded into milestone-end review, as the user prefers.

## Gaps Summary

No gaps. The phase goal is achieved.

---
_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
