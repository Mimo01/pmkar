---
phase: quick-260508-s7u
plan: "01"
subsystem: frontend
tags: [loading, skeleton, ux, scroll, re-fetch]
dependency_graph:
  requires: []
  provides: [mutual-exclusion skeleton vs stale card list, scroll-to-top on fetch completion]
  affects: [TicketListPage]
tech_stack:
  added: []
  patterns: [useRef scroll reset, loading guard on conditional render]
key_files:
  created: []
  modified:
    - src/features/tickets/TicketListPage.tsx
decisions:
  - Guard card list with !isLoading so skeleton and stale list are mutually exclusive
  - Use scrollRef on the overflow-y-auto div with a fetchStatus useEffect to reset scroll position when loading ends
  - scrollRef.current null guard required because the div unmounts while isLoading is true
metrics:
  duration: "3 min"
  completed: "2026-05-08"
---

# Phase quick-260508-s7u Plan 01: Loading Screen Fix Summary

**One-liner:** Added `!isLoading` guard and `scrollRef` scroll-reset to TicketListPage, eliminating stale card list visible during skeleton loading and resetting scroll position after each fetch.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix mutual exclusion and add scroll reset | f4a789f | src/features/tickets/TicketListPage.tsx |

## Changes Made

Four targeted edits to `src/features/tickets/TicketListPage.tsx`:

1. Added `useRef` to the React import
2. Declared `const scrollRef = useRef<HTMLDivElement>(null)` after the `isLoading` derivation
3. Added `useEffect` watching `fetchStatus` — resets `scrollRef.current.scrollTop = 0` when loading ends
4. Changed `{hasTickets && (` to `{hasTickets && !isLoading && (` and attached `ref={scrollRef}` to the scroll container div

## Verification

- `grep "hasTickets && !isLoading"` returns one match at line 523
- `grep -c "scrollRef"` returns 4 (declaration, useEffect condition, useEffect body, ref prop)
- `npx tsc --noEmit` exits with no errors

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- `src/features/tickets/TicketListPage.tsx` — modified and confirmed
- Commit `f4a789f` — verified via `git rev-parse --short HEAD`
