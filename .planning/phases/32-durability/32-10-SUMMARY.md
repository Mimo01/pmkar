---
phase: 32-durability
plan: 10
subsystem: groups
tags: [rust, tauri, zustand, i18n, scope-veto, gap-closure]
requires: [32-08]
provides:
  - add_issues_to_group expected-scope veto (ScopeMismatch error)
affects: [groups add path]
key-files:
  modified:
    - src-tauri/src/groups_db.rs
    - src-tauri/src/groups_commands.rs
    - src/features/groups/types.ts
    - src/features/groups/groupStore.ts
    - src/features/groups/membershipActions.ts
    - src/features/groups/__tests__/groupStore.test.ts
    - src/features/groups/__tests__/membershipActions.test.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - New scope_mismatch code (not no_scope) so the user gets accurate copy
  - Expected base URL read via useConnectionStore.getState() at invoke time, so caller signatures are unchanged
requirements: [GDUR-06]
completed: 2026-10-12
---

# Phase 32 Plan 10: Add-path scope veto (CR-01) Summary

`add_issues_to_group` now takes `expected_base_url` and returns `ScopeMismatch` (before the groups lock, nothing written) when it does not normalize to the Rust-derived scope. The frontend sends `expectedBaseUrl` and shows a translated error.

## Tasks

1. Rust veto, `GroupErrorCode::ScopeMismatch`, 6 new cargo tests - commit cea115e
2. Frontend `expectedBaseUrl`, `scope_mismatch` mapping, en/sk copy, vitest - commit cdf2603

## Verification

- cargo test groups: 43 passed; clippy clean for touched files
- vitest groups and tickets suites pass; tsc clean; biome clean on touched paths

## Deviations from Plan

- Worktree HEAD was at c4d9cb4, not the required base; reset to 7fcc60b per the branch check.
- No incidental test updates were needed outside files_modified.
- The pre-commit hook's full vitest run hit a one-off timeout in the unrelated `src/__tests__/App.test.tsx` ("shows SetupWizard...") on the first attempt (Rust-only change). The retry passed. Looks flaky under load.
- `cargo clippy --all-targets -D warnings` reports pre-existing errors in other files (none in groups files); out of scope.

## Known Stubs

None.

## Self-Check: PASSED
