---
phase: 33-polish-verification
plan: 09
subsystem: ui
tags: [a11y, keyboard, focus, tab-strip, select-mode]
requires: [33-08]
provides:
  - Arrow/Home/End focus movement across core and group tabs
  - D-01 keyboard and focus-return test matrix
affects: [33-10]
key-files:
  created:
    - src/components/ui/__tests__/AppShell.navKeys.test.tsx
    - src/features/groups/__tests__/a11y.keyboard.test.tsx
  modified:
    - src/components/ui/AppShell.tsx
    - src/features/groups/GroupTab.tsx
    - src/features/groups/useListSelection.ts
    - src/features/groups/__tests__/useListSelection.test.tsx
key-decisions:
  - "Arrow keys as focus accelerator, every tab stays in Tab order. Approved by user 2026-10-12. Phase 29 lock (no roving tabindex) preserved."
requirements-completed: [GQA-02]
completed: 2026-10-12
---

# Phase 33 Plan 09: Keyboard Navigation and Focus Matrix Summary

Tab strip gets Left/Right/Home/End focus movement (no wrap, no activation, no tabIndex changes) via `data-nav-tab` markers and an AppShell nav handler, plus a 23-case keyboard/focus-return matrix.

## Decision
Arrow keys are a focus accelerator only; every tab button stays in the Tab order. Approved by user 2026-10-12. 33-10 UAT keeps a confirmation step only.

## Commits
- 6844838 feat(33-09): arrow/Home/End focus movement in tab strip
- 2e3b75f test(33-09): keyboard and focus-return matrix; Esc in text input keeps select mode

## Deviations from Plan

**1. [Rule 1 - Bug] Esc inside the key filter input exited select mode**
- Found during: Task 2 matrix (RED verified locally; test and fix committed together because the pre-commit hook runs the full suite)
- Fix: `useListSelection.handleKeyDown` ignores Escape whose target is INPUT/TEXTAREA/contenteditable. Unit test added.
- Files: useListSelection.ts, useListSelection.test.tsx

**2. Planned TicketCard fix not needed.** Shift+Space and Shift+Enter on the card checkbox already range-select in jsdom (user-event carries shiftKey on the keyboard-generated click), so no onKeyDown/ref-flag was added. WKWebView may differ; 33-10 UAT must repeat Shift+Space in the real app.

**3. Task 1 RED was not run separately** (test and implementation written in the same pass; the commit hook runs the suite).

No focus-return gaps were found: all Escape paths already returned focus to their documented triggers, so GroupPicker/SelectionBar/TicketCard were left unchanged.

## Notes
- A focused Radix tooltip trigger (e.g. bar Clear button) consumes the first Escape to dismiss the tooltip, so select-mode exit takes a second Esc from there. Matrix asserts Esc from Add to group (no tooltip). Flag for UAT, not changed.

## Known Stubs
None.

## Verification
`npx vitest run src/features/groups src/features/tickets src/components` all green (1179 tests); lint 0 errors; pre-commit hooks passed.

## Self-Check: PASSED
