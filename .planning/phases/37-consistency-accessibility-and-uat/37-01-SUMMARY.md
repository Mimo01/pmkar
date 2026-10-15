---
phase: 37-consistency-accessibility-and-uat
plan: 01
subsystem: accessibility
tags: [aria-live, zustand, i18n]
requires: []
provides:
  - "announce(message) API, useAnnouncerStore, LiveAnnouncer component"
  - "a11y.denied/undone/linked/restored/handled EN+SK strings"
affects: [37-03]
tech-stack:
  added: []
  patterns: ["Zustand store drives a pre-mounted sr-only polite live region; clear-then-set after 50ms for identical repeats"]
key-files:
  created:
    - src/components/LiveAnnouncer.tsx
    - src/components/__tests__/LiveAnnouncer.test.tsx
    - src/i18n/__tests__/a11yLocale.test.ts
  modified:
    - src/App.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
key-decisions:
  - "Each App.tsx branch is an early return, so exactly one live region exists at a time"
requirements-completed: [RQA-03]
duration: 15min
completed: 2026-10-15
---

# Phase 37 Plan 01: LiveAnnouncer Summary

App-level polite sr-only live region with `announce()` API, mounted beside all 5 Toasters, plus five localized a11y.* announcement strings (EN/SK, "tiket" terminology).

## Commits
- d368212: LiveAnnouncer, test, App.tsx mounts
- 0fa6450: a11y.* locale keys and a11yLocale guard test

## Deviations from Plan
None of substance. SK `nav.notMine` is "Zamietnuté" and EN is "Dismissed", so the plan literals were kept. Biome formatting/import-order fixes were applied to new files. A temporary untracked `node_modules` symlink in the worktree was used for running tests (not committed).

## Verification
LiveAnnouncer, App and all src/i18n/__tests__ tests pass (51 tests); pre-commit checks pass.

## Self-Check: PASSED
