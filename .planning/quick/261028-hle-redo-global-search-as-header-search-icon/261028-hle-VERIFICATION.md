---
phase: quick-261028-hle
verified: 2026-10-28T13:35:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Desktop app (WebView2): click the header search icon"
    expected: "Palette appears about 15vh from the top, 600px wide, with a dimmed backdrop; input on top, results below"
    why_human: "Visual position and backdrop cannot be confirmed in jsdom"
  - test: "Press Ctrl+K and Ctrl+F (and again while the palette is open)"
    expected: "Palette opens with the input text selected; while open it re-selects; WebView2 native find (Ctrl+F) does not open"
    why_human: "Whether the native WebView2 accelerator is suppressed by preventDefault needs the real runtime"
  - test: "Press Esc in the palette, then click the backdrop on reopen"
    expected: "Palette closes, focus returns to the icon, the icon tooltip does NOT pop, query is kept; in ticket detail Esc does not navigate back"
    why_human: "Tooltip-on-focus-return is the same bug class as 7f5f380, which needed a WebView2 check; backdrop click is not covered by tests (Radix default)"
  - test: "Reopen with a stored query, then open a ticket"
    expected: "Previous results show immediately; opening a ticket closes the palette"
    why_human: "End-to-end flow feel"
---

# Quick 261028-hle: Header search icon + command palette Verification Report

**Goal:** Redo global search as a header search icon (first in the right-side icon toolbar) that opens a command-palette search modal overlay.
**Verified:** 2026-10-28
**Status:** human_needed
**Re-verification:** No (initial)

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No inline field; brand left, toolbar order Search, Audit, Settings | VERIFIED | `AppShell.tsx`: `role="search"` wrapper and GlobalSearch import are gone; `{onOpenTicket && <SearchDialog/>}` is the first child of the header `TooltipProvider`, before Audit and Settings; header is `justify-between`. Tested in `AppShell.navKeys.test.tsx:173,184` |
| 2 | Icon opens a centered palette near the top (~15vh) with backdrop, input above results | VERIFIED (visual check pending) | `SearchDialog.tsx` DialogContent `top-[15vh] translate-y-0 w-[600px] max-w-[calc(100vw-32px)]`; the existing `DialogOverlay` is `bg-black/80`; GlobalSearch renders input, then hint or results in flow (`max-h-[480px] overflow-y-auto`) |
| 3 | Ctrl/Cmd+K/F open with focus and selection; re-select while open; blocked by other dialogs | VERIFIED | `shortcut.ts` `isModalOpen()` skips elements inside `[data-search-dialog]`; callback ref, listener attached once; `SearchDialog` callback does `open ? focusInput() : handleOpenChange(true)`; `onOpenAutoFocus` preventDefaults, then focuses and selects. Tests: SearchDialog.test 93, 103, 109 |
| 4 | Query survives close/reopen; 2+ chars shows results immediately | VERIFIED | Query lives in `searchStore`; `useSearchCorpus(true)` and `debounced` initialised from `query`, so `panelVisible` is true on mount. Test: SearchDialog.test 145 and App.search.test 181 |
| 5 | Esc, backdrop or close action closes without clearing; focus returns to the icon; Esc does not leave detail | VERIFIED | GlobalSearch has no Escape branch; Radix handles close. `TicketDetailPage.tsx:114` and `TicketDetailPanel` check `!e.defaultPrevented`. Tests: SearchDialog.test 119 and 130, App.search.test 206. Backdrop click relies on the Radix default and has no test |
| 6 | Open ticket closes on true, stays on false | VERIFIED | `handleOpenTicket` wraps `onOpenTicket` and closes only on `ok`. Tests: SearchDialog.test 156 and 166, App.search.test 225 (copy flow) |
| 7 | Under 2 chars shows a hint; announcements reach screen readers while modal open | VERIFIED | Hint `<p>` with `search.hint.minChars` (EN/SK, SK says "tiketov"); a `<LiveAnnouncer/>` inside DialogContent subscribes to the shared Zustand announcer store, so it receives the same messages while Radix hides the app-level region. Test: SearchDialog.test 177 |

**Score:** 7/7

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/features/search/SearchDialog.tsx` | VERIFIED | 104 lines; exports `SearchDialog`; controlled tooltip, Dialog, shortcut |
| `src/features/search/shortcut.ts` | VERIFIED | Contains `data-search-dialog` (`SEARCH_DIALOG_ATTR`); callback API |
| `src/features/search/GlobalSearch.tsx` | VERIFIED | Optional `inputRef`; no click-outside, Tab or Escape branches, no absolute dropdown; search logic reused |
| `src/features/search/__tests__/SearchDialog.test.tsx` | VERIFIED | 12 cases incl. axe |

## Key Links

| From | To | Via | Status |
|------|----|-----|--------|
| AppShell.tsx | SearchDialog.tsx | `<SearchDialog onOpenTicket>`, first in TooltipProvider | WIRED |
| SearchDialog.tsx | GlobalSearch.tsx | `<GlobalSearch inputRef onOpenTicket={handleOpenTicket}>` | WIRED |
| SearchDialog.tsx | shortcut.ts | `useSearchShortcut(() => ...)` | WIRED |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Search/UI/App search/i18n tests | `npx vitest run src/features/search src/components/ui src/App.search.test.tsx src/i18n` | 28 files, 244 tests passed | PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | PASS |
| No `search.regionLabel` in src | grep | none | PASS |
| No `brand-accent` in search/AppShell | grep | none (one pre-existing use in OverviewTab.tsx, not touched by this task) | PASS |

I did not re-run the full suite (2075 tests, per the SUMMARY). The scoped run covers every file this task changed.

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| QUICK-261028-hle | SATISFIED | Truths 1-7 |

## Anti-Patterns

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| SearchDialog.tsx / GlobalSearch.tsx | 70 / 163, 191 | `text-brand-muted` | Info | Used on icon colour only (lucide icons and the icon button, same as the sibling Audit/Settings buttons), not on text |
| - | - | TBD/FIXME/XXX/TODO | - | None found |

## Human Verification Required

1. **Palette appearance** — In the desktop app, click the search icon. Expected: the palette sits about 15vh from the top with a dimmed backdrop.
2. **Shortcuts in WebView2** — Press Ctrl+K and Ctrl+F. Expected: the palette opens with the text selected, and WebView2's native find bar does not appear.
3. **Close behavior** — Close with Esc and with a backdrop click. Expected: the icon tooltip does not pop, the query is kept, and ticket detail stays open.
4. **Reopen and navigate** — Reopen with a stored query, then open a ticket. Expected: results show right away, and opening a ticket closes the palette.

## Gaps Summary

No gaps. Every must-have is backed by code and tests. The remaining items are visual and WebView2 runtime checks, which the plan already deferred as a human check.

---

_Verified: 2026-10-28_
_Verifier: Claude (gsd-verifier)_
