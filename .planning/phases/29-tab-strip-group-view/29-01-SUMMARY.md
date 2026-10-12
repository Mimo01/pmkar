---
phase: 29-tab-strip-group-view
plan: 01
subsystem: groups
tags: [zustand, validation, unicode, rust]
requires: []
provides:
  - groupStore.hydrate with generation counter, hydrateError, last-good-state retention
  - Aligned TS/Rust group name trim and format-character policy
affects: [29 tab strip UI]
key-files:
  modified:
    - src/features/groups/groupStore.ts
    - src/features/groups/__tests__/groupStore.test.ts
    - src/features/groups/validation.ts
    - src-tauri/src/groups_db.rs
    - src/test-fixtures/group-vectors.json
decisions:
  - "No DB migration: no group-creation UI has shipped, so stored name_key values with format characters cannot exist in user data."
metrics:
  completed: 2026-10-12
---

# Phase 29 Plan 01: Phase 28 review fixes (WR-01..WR-04) Summary

Hydrate is now sequence-guarded and keeps last good state on failure, and TS/Rust group-name normalization use one explicit trim and format-character policy.

## Tasks

1. Harden groupStore.hydrate (commit 70995a7): hydrateSeq counter drops stale responses and stale rejections, failure sets hydrateError without wiping groups, memberships with unknown group ids are dropped. 7 new/rewritten tests.
2. Align name normalization (see git log, second fix commit): trim set White_Space plus U+FEFF on both sides; key strips U+200B..U+200F, U+2060..U+2064, U+00AD, U+FEFF; empty key rejected as empty; 9 new shared vectors.

## Verification

- vitest src/features/groups: 78 passed
- cargo test groups_db: 16 passed, including shared_vectors_match
- tsc --noEmit and biome check clean

## Deviations from Plan

None. The worktree base was reset to the expected commit at startup.

## Known Stubs

None.

## Self-Check: PASSED
