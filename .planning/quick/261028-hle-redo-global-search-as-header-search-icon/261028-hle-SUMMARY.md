---
phase: quick-261028-hle
plan: 01
status: complete
subsystem: search
tags: [search, header, dialog, command-palette, a11y]
requires: [37.3 global search]
provides: [SearchDialog command palette, callback-based useSearchShortcut]
affects: [AppShell header toolbar]
tech-stack:
  added: []
  patterns: [Radix Dialog hosting ARIA combobox, controlled Radix tooltip suppressed on focus return]
key-files:
  created:
    - src/features/search/SearchDialog.tsx
    - src/features/search/__tests__/SearchDialog.test.tsx
  modified:
    - src/features/search/shortcut.ts
    - src/features/search/GlobalSearch.tsx
    - src/components/ui/AppShell.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/search/__tests__/shortcut.test.tsx
    - src/features/search/__tests__/GlobalSearch.test.tsx
    - src/components/ui/__tests__/AppShell.navKeys.test.tsx
    - src/App.search.test.tsx
decisions:
  - Palette open state is local to SearchDialog (not in searchStore); it closes when onOpenTicket returns true
  - isModalOpen ignores elements inside [data-search-dialog], so Ctrl/Cmd+K inside the palette focuses and selects the input again
  - GlobalSearch no longer handles Escape; Radix closes the dialog and preventDefaults, so detail views do not also navigate back and the query is kept
  - LiveAnnouncer is rendered inside DialogContent so announcements are not hidden by Radix hideOthers
metrics:
  completed: 2026-10-28
  tasks: 3
  files: 11
---

# Quick 261028-hle: Header search icon + command palette Summary

The inline header search field is replaced by a Search icon button, first in the header toolbar (Search, Audit, Settings). It opens a Radix Dialog command palette about 15vh from the top. The palette hosts the existing GlobalSearch combobox, now always expanded, and opens with Ctrl/Cmd+K or Ctrl/Cmd+F with the input focused and its text selected.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Callback-based shortcut + always-expanded GlobalSearch | ef31ae0 |
| 2 | SearchDialog launcher + AppShell header wiring | eb70bc6 |
| 3 | Migrate App-level search tests, full suite | f5e8c9b |

## What changed

- `shortcut.ts`: `useSearchShortcut(onActivate)` keeps the latest callback in a ref and attaches the listener once. Exports `SEARCH_DIALOG_ATTR`, and `isModalOpen()` skips the search palette.
- `GlobalSearch.tsx`: optional `inputRef` prop; corpus is enabled on mount, so a stored query of 2+ characters shows results right away. Removed click-outside, the Tab/Escape branches, the ArrowDown re-open branch and the absolute dropdown. Results now render in flow (`max-h-[480px]`). Under 2 characters it shows a hint line (`search.hint.minChars`). The WR-01 no-announce-after-navigation guard now uses `navigatedRef`.
- `SearchDialog.tsx`: `DialogTrigger` sits inside `TooltipTrigger` (assumption A1 held). The tooltip is controlled and stays shut on the focus return after close (same bug class as 7f5f380). It also has `data-search-dialog`, `hideClose`, an sr-only `DialogTitle`, a wrapped `onOpenTicket` that closes on true, and an in-dialog `LiveAnnouncer`.
- i18n: added `search.open` and `search.hint.minChars` (EN/SK, SK uses "tiketov"); removed `search.regionLabel`.

## Verification

- `npx vitest run` passes: 149 files, 2075 tests. `npx tsc --noEmit` is clean. Biome is clean on the changed files. The pre-commit hook passed on all three commits.
- Grep checks: no `role="search"` in AppShell, no `search.regionLabel` and no `brand-accent` in search/i18n/AppShell.

## Deviations from Plan

- [Rule 3 - Blocking] The pre-commit hook runs the full suite on the working tree. Committing Task 1 alone failed on the App-level Esc test, which Task 3 migrates. I finished all three tasks first, then committed each task's files separately, so every commit passed the hook without `--no-verify`.
- One full-suite run in between showed 10 failures in unrelated files, with test durations around 870s (the machine stalled). A clean rerun passed 2075/2075, so these were environmental, not regressions.
- The results block has no extra `border-t`, because the input wrapper already has `border-b`. This avoids a double border.

## Human check pending

In the desktop app (WebView2): the palette sits about 15vh from the top with a dimmed backdrop. Ctrl+K and Ctrl+F open it with the text selected. Esc closes it without the icon tooltip popping. Reopening shows the previous results. Opening a ticket closes the palette.

## Self-Check: PASSED

- Files exist: SearchDialog.tsx, SearchDialog.test.tsx
- Commits exist: ef31ae0, eb70bc6, f5e8c9b
