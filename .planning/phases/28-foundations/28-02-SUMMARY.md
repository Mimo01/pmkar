---
phase: 28-foundations
plan: 02
subsystem: ui
tags: [i18n, copy-pipeline, react, vitest]
requires: []
provides:
  - copyStepLabel(step, t) shared helper matching real Rust step ids
  - Rust-source-scanning sync test for copy step ids
affects: [copy result screens]
tech-stack:
  added: []
  patterns: [source-scan sync test between Rust emit sites and i18n keys]
key-files:
  created:
    - src/features/tickets/copyStepLabel.ts
    - src/features/tickets/__tests__/copyStepLabel.test.ts
    - src/features/tickets/__tests__/copyStepSync.test.ts
  modified:
    - src/features/tickets/CopyResultModal.tsx
    - src/features/tickets/CopyResultPage.tsx
    - src/features/tickets/CopyResultModal.test.tsx
    - src/features/tickets/__tests__/CopyResultPage.test.tsx
    - src/features/tickets/types.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
key-decisions:
  - "Sync test scans Rust source with regex (no Rust-side const list)"
  - "SK 'work log' wording reuses existing 'Pracovný výkaz'"
requirements-completed: [CONI-01]
duration: 15min
completed: 2026-10-12
---

# Phase 28 Plan 02: Copy step label translation Summary

Shared `copyStepLabel(step, t)` replaces both duplicated `stepLabel` functions, matches the step ids Rust actually emits (fixes `add_remotelink`, `worklog:fetch`, `fetch_source`, `update_triage`), translates unknown-step and English fallbacks, and a source-scanning Vitest guards future Rust ids.

## Tasks
1. Helper, 14 EN/SK keys (12 step + 2 `copy.result.created*`), label tests, Rust sync test - `4bde64f`
2. Both result screens use the helper; "Created:" translated; tests extended - `e35b7b6`

## Deviations from Plan

**1. [Rule 1 - Bug] Stale step id in existing tests**
- Existing tests used `add_remote_link` (id Rust never emits) and expected an unknown step to render as the bare id. Updated to `add_remotelink` and the D-10 fallback "Step: foo_bar — completed", which the plan's requirements contradict otherwise.
- Files: CopyResultModal.test.tsx, __tests__/CopyResultPage.test.tsx

**2. [Rule 3 - Blocking] Node types in sync test**
- `tsc` did not resolve `node:fs`; added `/// <reference types="node" />` to copyStepSync.test.ts.

**3. Environment:** the worktree had no node_modules; a symlink to the main repo's node_modules was created locally (untracked, not committed).

## Deferred Issues
- `src/features/tickets/TicketListPage.test.tsx` has 2 failing tests (empty state, auto-refetch) in files unrelated to this plan; not touched.
- Repo-wide `biome check src/features/tickets src/i18n` reports pre-existing errors in unrelated files (GapsSection, IssueTypeChooser, CopyPreviewPage, copyStore tests, comments component); all files changed here are biome-clean.
- Vacuity check (regex matching nothing) was not run manually; the test instead asserts explicit presence of required ids and kinds with a minimum count of 8.

## Verification
- `vitest run` copyStepLabel, copyStepSync, CopyResultModal, CopyResultPage, src/i18n: pass
- `tsc --noEmit`: clean
- No `dangerouslySetInnerHTML`, no remaining `Created:` literals in either screen (T-28-03 mitigated)

## Self-Check: PASSED
