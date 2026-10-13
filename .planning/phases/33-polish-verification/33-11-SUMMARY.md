---
phase: 33-polish-verification
plan: 11
subsystem: ui
tags: [a11y, contrast, wcag, tickets, testing]
requires: []
provides:
  - Dimmed missing cards dim only the brand-text summary
  - Contrast test asserting >= 4.5 on composited dimmed text, opacity derived from source
  - Anchored and escaped readVar
affects: [33-polish-verification]
tech-stack:
  added: []
  patterns: [derive test constants from component source]
key-files:
  created: []
  modified:
    - src/features/tickets/TicketCard.tsx
    - src/features/tickets/__tests__/TicketCard.test.tsx
    - src/features/groups/__tests__/contrast.test.ts
    - src/test-utils/contrast.ts
    - .planning/phases/33-polish-verification/33-UI-SPEC.md
key-decisions:
  - "Dim by token instead of opacity: key/dates/meta stay full text-secondary, only summary uses opacity-70"
requirements-completed: [GQA-02]
duration: 10min
completed: 2026-10-13
---

# Phase 33 Plan 11: Dimmed-card contrast and readVar anchoring Summary

Missing-card key, dates and assignee now render at full secondary-text contrast; only the summary is dimmed, and the contrast test asserts >= 4.5:1 on the composited color using the opacity read from TicketCard.tsx.

## Tasks

1. Dim only the summary, assert >= 4.5 composited (WR-02) - a8ee014
2. Anchor and escape readVar with regression tests (WR-04) - 89a0714

## Deviations from Plan

None - plan executed as written. Worktree base was reset to e8fcb56 at startup per the branch check. A node_modules symlink to the main repo was used for running tests (not committed).

## Verification

- vitest: src/features/groups (561 tests) and TicketCard tests pass
- tsc --noEmit clean; pre-commit hooks (biome, cargo, tests) passed on both commits

## Self-Check: PASSED
