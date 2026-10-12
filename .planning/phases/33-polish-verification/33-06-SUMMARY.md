---
phase: 33-polish-verification
plan: 06
subsystem: i18n-guards
tags: [i18n, static-analysis, typescript-ast, contrast, tests]
requires: [33-01, 33-04, 33-05]
provides:
  - AST literal-string scan, dynamic t() key gate and referenced-key existence test
  - Source guard locking contrast token usage
affects: [groups, tickets, app-shell]
key-files:
  created:
    - src/i18n/__tests__/noLiteralStrings.test.ts
    - src/features/groups/__tests__/groupTokenUsage.test.ts
  modified:
    - src/features/tickets/TicketCard.tsx
    - src/components/ui/AppShell.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - .planning/phases/33-polish-verification/deferred-items.md
requirements: [GQA-01, GQA-02]
completed: 2026-10-12
---

# Phase 33 Plan 06: Literal-string and token guards Summary

A TypeScript-AST scan (recursive over src/features/groups .ts/.tsx plus TicketCard, TicketFilterBar, TicketListPage and AppShell) now fails on literal JSX text, literal expression children, aria-label/title/placeholder/alt literals (including template literals), and literal arguments to toast/announce/setError sinks. A dynamic-key gate requires every non-literal `t()` argument to be on an allowlist with a full key expansion, and every referenced key must be non-empty in en.json and sk.json. A second test locks the 33-04/33-05 contrast tokens.

## RED scan result (before fixes)
- TicketCard.tsx:196 "Loading tickets"
- TicketListPage.tsx:485 "Refresh (F5)"
- AppShell.tsx:36 "pm" / "kar" (brand wordmark)
- AppShell.tsx:81 "Main navigation"
- Unlisted dynamic keys: DetailGroupsRow.tsx:53, GroupPicker.tsx:166/194/237/261 (membershipErrorKey / groupNameErrorKey calls not in the seed list).

## Fixes
- TicketCard SkeletonCards: `t('tickets.loadingAria')` (EN "Loading tickets", SK "Načítavajú sa úlohy").
- AppShell nav: `t('nav.mainAria')` (EN "Main navigation", SK "Hlavná navigácia").
- "pm"/"kar" added to NON_TRANSLATABLE (product wordmark).
- "Refresh (F5)" added to DEFERRED_NON_GROUP and logged in deferred-items.md (D-03).
- The five extra dynamic sites added to DYNAMIC_KEY_ALLOWLIST with expansions over every GroupErrorCode (exhaustive `satisfies Record<...>` objects so a new union member is a type error).

Additional src/features/groups/** files edited: none (the scan found no group-scope literals). GroupTabStrip.tsx was scanned (33-07 merged) and is clean.

## Commits
Single commit containing tests and fixes (see below).

## Deviations from Plan
- [Rule 3] Worktree started on old base c4d9cb4; reset to main (8aaeef8) per the startup check, then `npm ci`.
- [Rule 3] RED was verified locally (2 failing tests listing the violations above); the pre-commit hook runs the full suite, so tests and fixes are committed together in one commit rather than a failing-test-only commit.
- Tasks 1 and 2 share that one commit for the same reason.

## Verification
`npx vitest run src/i18n src/features/groups/__tests__/groupTokenUsage.test.ts` passed; full suite is run by the pre-commit hook. Biome reports only warnings (template-string placeholder in sanity snippet strings).

## Known Stubs
None.

## Self-Check: PASSED (files exist; commit verified below)
