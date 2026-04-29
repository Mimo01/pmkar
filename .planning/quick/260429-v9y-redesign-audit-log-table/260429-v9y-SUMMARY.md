---
quick_id: 260429-v9y
slug: redesign-audit-log-table
date: 2026-04-29
status: complete
mode: quick
---

# Quick Task 260429-v9y — Summary

## Goal

Make the audit log (HTTP call log) easier to scan and easier to share when reporting bugs.

## What changed

**`src/features/tickets/AuditLogPage.tsx` — major rewrite**

- Added a sticky filter toolbar above the table with:
  - Search input (matches URL or method, case-insensitive substring)
  - Method `<select>` (All / GET / POST / PUT / DELETE / Other)
  - Status-class `<select>` (All / 2xx / 3xx / 4xx / 5xx / Error)
  - Result count `{shown} of {total}` (live aria-live region)
  - Inline "Clear filters" button (visible only when filters are active)
- Filtering happens client-side over already-loaded entries (no backend changes, no extra Tauri calls).
- New filtered-empty state with its own "Clear filters" CTA when no rows match.
- "Load more" pagination is hidden while filters are active (server-side pagination + client-side filter would be confusing).

**Copy a log — two entry points**
- Expanded panel: full "Copy" button (icon + label) in the top-right of the expanded detail.
- Summary row: icon-only Copy button next to the status badge — visible on hover/focus, `e.stopPropagation()` prevents toggling row expansion.
- Both copy a multi-section plain-text representation:
  ```
  [{ts}] {METHOD} {url}
  Status: {code or "Error"}

  Request Headers:
    {key}: {value}
    ...

  Response Body:
  {pretty-printed JSON or "(empty)"}
  ```
- 1500 ms "Copied ✓" feedback per row keyed by row identifier; timer cleaned up on unmount.
- Uses `navigator.clipboard.writeText()` directly — Tauri 2.x webview supports it; no plugin added.
- `buildCopyText` exported from the module so logic is unit-testable separately from the React tree.

**Visual polish**
- Method badges now use bg/border/text triple tints (mirrors `renderStatusBadge`) so GET/POST/PUT/DELETE are clearly distinct in dark and light modes — the prior `text-{color}-600` on outline badges had near-invisible contrast.
- URL column drops the `max-w-0` ellipsis trick in favor of `min-w-0 truncate` + `title` tooltip — full URL visible on hover without expanding the row.
- Chevron-down hint appears on collapsed rows on hover (mirror of the existing chevron-up shown when expanded), making the click-to-expand affordance discoverable.

**Tests**
- 7 new tests for filter toolbar and copy behavior, including:
  - Search by URL substring (case-insensitive)
  - Method filter narrows entries
  - Status-class filter narrows entries
  - Result count reflects filter
  - Filtered-empty state with clear-filters restoration
  - Expanded copy button writes formatted text to clipboard
  - Summary-row copy icon does not toggle row expansion
  - `buildCopyText` plain-text format and `Status: Error` handling
- 5 pre-existing tests updated for selector specificity (toolbar select options now contain method/status text that previously matched only data-row badges; tests scope queries to `<tbody>`).

**i18n**
- 13 new keys in `en.json` and `sk.json` (Slovak with full diacritics, matching project translation style):
  - `audit.search.placeholder`, `audit.filter.method`, `audit.filter.status`, `audit.filter.all`, `audit.filter.error`, `audit.filter.clear`, `audit.filter.empty.heading`, `audit.filter.empty.body`, `audit.count`, `audit.copy`, `audit.copied`, `audit.copy.aria`

## Notable decisions

- **Plain-text copy format, not JSON.** The user's primary use case is pasting into a teammate chat or bug report; a multi-section labeled block is more readable than a JSON dump. JSON is recoverable by parsing the response-body section if needed.
- **Toolbar `<select>` instead of chips.** Chips are prettier but use more horizontal space and are harder to keyboard-navigate. With 6 method options + 6 status-class options, native selects are more accessible.
- **Method comparison case-insensitive (`toUpperCase()`).** Defensive against non-canonical method strings from headers.
- **Toolbar is hidden during loading.** Skeleton rows shouldn't be filterable.
- **"Load more" hidden when filters are active.** Server pagination + client filter would surprise users (e.g. "I see 3 of 50, but if I load more I'll see more matches" — confusing UX). Cleaner to require Clear-filters first.
- **Two copy entry points kept distinct.** Expanded button has visible "Copy" text (accessible name = "Copy"); summary-row icon button uses `aria-label="Copy log entry"`. This both differentiates the test-finding selectors and gives the icon button a sensible screen-reader name.

## Files touched

- `src/features/tickets/AuditLogPage.tsx` (450 → 522 lines, mostly additive)
- `src/features/tickets/AuditLogPage.test.tsx` (+7 tests, 5 selectors updated for specificity)
- `src/i18n/locales/en.json` (+13 keys)
- `src/i18n/locales/sk.json` (+13 keys)

## Verification

- `npx vitest run src/features/tickets/AuditLogPage.test.tsx` → 23 passed
- `npx tsc --noEmit` → clean
- `npx biome check` on changed files → clean (formatting auto-applied)
- Pre-existing failures in `CopyPreviewModal.test.tsx` and `SettingsPage.test.tsx` are in unrelated files modified by prior sessions — not introduced by this task.

## Out of scope (intentionally deferred)

- No new audit columns (e.g. duration). The `AuditEntry` schema doesn't carry timing data; would require backend changes.
- No real-time auto-refresh / tail mode.
- No "Clear log" button (i18n key `audit.clear` exists but no Tauri command — out of scope here).
- No row-level export to file (Tauri dialog/save plugin not yet wired).
- No keyboard shortcut for filter focus (could add `/` to focus search later).
