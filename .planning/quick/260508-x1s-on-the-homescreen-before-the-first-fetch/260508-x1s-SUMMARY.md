---
phase: quick-260508-x1s
plan: 01
subsystem: tickets-ui
tags: [ux, i18n, empty-state, homescreen]
dependency_graph:
  requires: []
  provides: [pre-fetch-empty-state, noresults-empty-state]
  affects: [TicketListPage, sk.json, en.json]
tech_stack:
  added: []
  patterns: [conditional-render-on-state, i18n-flat-key]
key_files:
  created: []
  modified:
    - src/features/tickets/TicketListPage.tsx
    - src/i18n/locales/sk.json
    - src/i18n/locales/en.json
decisions:
  - Pre-fetch state uses `fetchStatus !== 'error'` guard — avoid showing pre-fetch text when a fetch has already been attempted and failed (fetch error state takes priority)
  - Old tickets.empty.heading / tickets.empty.body keys kept intact — they remain in the file but are no longer referenced in TicketListPage; safe to clean up later
  - Used Unicode curly quote „..." (U+201E / U+201C) in Slovak prefetch body — matches Slovak typographic convention; required fixing a straight-quote contamination that broke JSON parsing
metrics:
  duration: 8 min
  completed: "2026-05-08"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 260508-x1s: Homescreen Pre-fetch Empty State Summary

**One-liner:** Two distinct empty states — pre-fetch (click the button) and post-fetch-no-results (JQL hint) — replacing the single ambiguous message on the homescreen.

## What Was Built

Before this task, the homescreen showed a single empty state block (`showEmptyState`) that only appeared after a successful fetch returned zero results. Before the first fetch, the page showed nothing — no guidance for new users on what to do.

This task adds:

1. `showPreFetchState` — a new boolean that is `true` when `!hasFetched && !isLoading && fetchStatus !== 'error'`. This renders a "Tikety ešte neboli načítané" / "No tickets fetched yet" message with an instruction to click the fetch button.

2. The existing post-fetch empty state now uses `tickets.empty.noresults.heading` and `tickets.empty.noresults.body` keys with text that explicitly mentions the JQL query and directs the user to Settings.

3. Four new i18n keys in both sk.json and en.json for the two new states.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add pre-fetch empty state to TicketListPage | 43804b4 | src/features/tickets/TicketListPage.tsx |
| 2 | Add new i18n strings to sk.json and en.json | 3e03bf6 | src/i18n/locales/sk.json, src/i18n/locales/en.json |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid JSON in sk.json caused by unescaped straight double quote**
- **Found during:** Task 2 verification (node -e JSON parse check)
- **Issue:** The Slovak prefetch body string used „Načítať tikety" but the closing `"` character was a straight ASCII U+0022 quote, which prematurely closed the JSON string value. Node and Python both reported a JSON parse error at line 254 col 73.
- **Fix:** Replaced the straight closing quote with the proper Unicode right double quotation mark U+201C so the string reads `„Načítať tikety"` — both characters are now curly quotes that don't interfere with JSON string delimiters.
- **Files modified:** src/i18n/locales/sk.json
- **Commit:** 3e03bf6 (same task commit)

## Known Stubs

None — both empty states are fully wired to real store state (`lastFetchedAt`, `fetchStatus`, `isLoading`).

## Threat Flags

None — changes are purely presentational (static i18n string lookup; no new network endpoints, auth paths, or data access).

## Self-Check: PASSED

- src/features/tickets/TicketListPage.tsx — FOUND (modified)
- src/i18n/locales/sk.json — FOUND (modified)
- src/i18n/locales/en.json — FOUND (modified)
- Commit 43804b4 — FOUND
- Commit 3e03bf6 — FOUND
- TypeScript errors: pre-existing CopyPreviewModal.tsx error unchanged; no new errors introduced
