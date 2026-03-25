---
phase: 10-improve-codebase-quality
plan: 01
subsystem: frontend
tags: [biome, linting, formatting, typescript, dead-code, type-safety]

# Dependency graph
requires: []
provides:
  - Biome linter/formatter configuration (biome.json)
  - npm lint/format scripts (lint, lint:fix, format)
  - Clean lint baseline for all frontend code
---

## What was delivered

Installed and configured Biome as the project's linter/formatter. All TypeScript/React source files pass lint and format checks. Eliminated all `any` type usage. Removed dead code (TicketTable.tsx).

## Key changes

### Task 1: Install Biome, create config, add npm scripts
- Installed `@biomejs/biome` as devDependency
- Created `biome.json` with recommended rules for lint, format, a11y, security
- Added `lint`, `lint:fix`, `format` scripts to package.json
- Auto-formatted all source files

### Task 2: Fix lint violations, eliminate `any`, remove dead code
- Fixed all Biome lint violations across 68 source files
- Eliminated all `as any` and `: any` usage in source and test files
- Removed deprecated `TicketTable.tsx` (dead code)
- Removed all `eslint-disable` comments

## Commits

- `b946699` chore(10-01): install Biome, add lint/format scripts, auto-format all src files
- `1816e87` fix(10-01): fix all Biome lint violations, eliminate any types, remove dead code
- `70d93b5` fix(10-01): fix optional chaining in ConnectionForm useEffect dependency

## Deviations

1. ConnectionForm.tsx had a bug introduced during `any` elimination — `initialValues.username` in useEffect dependency array needed optional chaining (`initialValues?.username`). Fixed in follow-up commit.

## Self-Check: PASSED

key-files:
  created:
    - biome.json
  modified:
    - package.json
    - src/test-setup.ts
    - src/features/connections/ConnectionForm.tsx
    - src/features/tickets/CopyPreviewModal.test.tsx
    - src/features/tickets/TicketListPage.test.tsx
    - src/features/tickets/IgnoredTicketsPage.test.tsx
  deleted:
    - src/features/tickets/TicketTable.tsx

verification:
  - "npm run lint: PASSED (0 errors, 8 warnings — non-null assertions in tests)"
  - "npm test: PASSED (114/114 tests)"
  - "grep any: PASSED (no as any or : any remaining)"
  - "TicketTable.tsx: DELETED"
