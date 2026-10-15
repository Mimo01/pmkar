---
phase: 35-shared-triage-actions
plan: 01
subsystem: tickets/triage
tags: [triage, zustand, tauri, i18n, tdd]
requires: [relink_ticket, set_triage_state, get_triage_state]
provides: [denyTicket, restoreTicket, markHandled, linkTicket, LinkResult]
affects: [IgnoredTicketsPage, GroupViewPage]
key-files:
  modified:
    - src/features/tickets/triageActions.ts
    - src/features/tickets/__tests__/triageActions.test.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - Deny with no remembered key shows no Undo toast (Undo means return to Linked)
  - linkTicket returns 'failed' on errors so callers never get exceptions
metrics:
  tasks: 2
  completed: 2026-10-15
requirements: [LINT-01, RTRI-02, RTRI-03, RLNK-01, RLNK-02]
---

# Phase 35 Plan 01: Shared Triage Actions Summary

Single triage module (deny, restore, handled, link) that preserves the remembered Cloud key on every transition, shows an 8 s Undo toast on deny, and hands off to the copy preview when no key exists.

## What was built
- `applyState` helper: optimistic write carrying `prev?.copiedKey`, persists only via `set_triage_state`, identity-checked rollback.
- `denyTicket` with Undo toast (`deny-KEY`, 8000 ms) that calls `relink_ticket` and uses the DB-returned key.
- `restoreTicket` / `markHandled` now key-preserving and async (existing non-awaiting callers still work).
- `linkTicket`: non-optimistic `relink_ticket`; `'relinked'`, `'needs-copy'` (fetches detail if needed, calls `startPreview`), or `'failed'`.
- Six `triage.*` i18n keys in EN and SK (SK uses "tiket").
- 21 tests including hydrate round-trip; full suite 1664 passing.

## Deviations from Plan

**1. [Rule 3 - Blocking] RED and GREEN committed together.** The repo pre-commit hook (typecheck plus full frontend test run, `--no-verify` forbidden) rejects any commit with failing tests. RED was verified locally (18 of 21 failing) but could not be committed separately. Single commit `95d8510` contains tests, i18n, and implementation. TDD gate: no standalone `test(...)` commit exists.

## Commits
- 95d8510: feat(35-01): shared triage actions with key preservation and Undo

## Known Stubs
None.

## Self-Check: PASSED
