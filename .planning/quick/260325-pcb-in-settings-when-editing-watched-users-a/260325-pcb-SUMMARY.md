---
phase: quick-260325-pcb
plan: "01"
subsystem: frontend
tags: [bug-fix, react, settings, focus, performance]
dependency_graph:
  requires: []
  provides: [stable-SectionCard-identity]
  affects: [SettingsPage, watched-users-filter]
tech_stack:
  added: []
  patterns: [module-scope-component-extraction]
key_files:
  modified:
    - src/features/connections/SettingsPage.tsx
decisions:
  - SectionCard extracted to module scope — inline nested component definitions cause unmount/remount on every parent re-render, which steals focus from controlled inputs
metrics:
  duration: "3 min"
  completed: "2026-03-25"
  tasks: 1
  files: 1
---

# Quick 260325-pcb Summary

**One-liner:** Extracted `SectionCard` from inline definition inside `SettingsPage` to module scope, giving it a stable React identity and fixing input focus loss while filtering watched users.

## What Was Done

**Task 1: Extract SectionCard to module scope** — Commit `4c3888c`

`SectionCard` was defined as a nested function inside `SettingsPage`. React treats inline component definitions as new component types on every render, causing full unmount/remount cycles for the component tree beneath it. Any controlled input inside `SectionCard` (like the watched-users filter) would lose focus on each keystroke because the component was being destroyed and recreated.

The fix: moved `SectionCard` to module scope (line 197), just before `export function SettingsPage` (line 208). The component uses only `title` and `children` props with no closure variables from `SettingsPage`, so extraction required zero prop changes.

Files changed:
- `src/features/connections/SettingsPage.tsx` — SectionCard moved to module scope, removed `// Content card wrapper` comment

## Verification

- `grep -n "function SectionCard" src/features/connections/SettingsPage.tsx` → line 197 (before `export function SettingsPage` at line 208)
- TypeScript compiled clean (no errors)
- All 24 existing SettingsPage tests passed

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- File exists: `src/features/connections/SettingsPage.tsx` — FOUND
- Commit exists: `4c3888c` — FOUND
- SectionCard at module scope before SettingsPage export — VERIFIED
