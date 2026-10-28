---
phase: 261028-hle-redo-global-search-as-header-search-icon
reviewed: 2026-10-28T00:00:00Z
depth: quick
files_reviewed: 11
files_reviewed_list:
  - src/App.search.test.tsx
  - src/components/ui/AppShell.tsx
  - src/components/ui/__tests__/AppShell.navKeys.test.tsx
  - src/features/search/GlobalSearch.tsx
  - src/features/search/SearchDialog.tsx
  - src/features/search/__tests__/GlobalSearch.test.tsx
  - src/features/search/__tests__/SearchDialog.test.tsx
  - src/features/search/__tests__/shortcut.test.tsx
  - src/features/search/shortcut.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Quick Task 261028-hle: Code Review Report

**Reviewed:** 2026-10-28
**Depth:** quick
**Files Reviewed:** 11
**Status:** issues_found (info only)

## Narrative Findings (AI reviewer)

## Summary

Quick-depth pattern scan over the 11 files in `cf52357..HEAD`, plus a skim of the non-test source diffs (AppShell, GlobalSearch, SearchDialog, shortcut, locales).

Pattern scan results:
- Hardcoded secrets: none
- Dangerous functions: one hit, `document.body.innerHTML = ''` in `src/features/search/__tests__/shortcut.test.tsx:27`. This is test DOM cleanup with no input involved, so it is not a finding.
- Debug artifacts (console.log, debugger, TODO/FIXME/XXX/HACK): none
- Empty catch blocks: none
- `as any`, `@ts-ignore`, new `eslint-disable`, `.only`/`.skip` in tests: none

Cross-checks:
- No code still references the removed `search.regionLabel` key or `role="search"`.
- `useSearchShortcut` has one consumer (`SearchDialog`). Every caller uses the new callback signature.
- `DialogContent` in `src/components/ui/dialog.tsx` supports `hideClose`.
- The SK wording "aspoň {{min}} znaky" is grammatically correct for `SEARCH_MIN_CHARS = 2`. It uses "tiket" terminology, which matches the project convention.
- `isModalOpen()` leaves the palette out via `closest('[data-search-dialog]')`. This also matches when the attribute sits on the dialog element itself, so Ctrl/Cmd+K while the palette is open correctly refocuses the input.

No blockers or warnings at this depth. One minor info item is below.

## Info

### IN-01: Untracked timer in onCloseAutoFocus

**File:** `src/features/search/SearchDialog.tsx:89-95`
**Issue:** `onCloseAutoFocus` schedules `setTimeout(() => { suppressTip.current = false }, 0)` and never clears it. If `SearchDialog` unmounts in the same tick (for example, when an AppShell remount follows a navigation), the callback writes to a ref of an unmounted component. This is harmless today because it only writes a ref and never calls `setState`. It is still an untracked side effect, and it would become a real bug if someone later changes the callback to update state.
**Fix:** Store the timer id in a ref and clear it in a cleanup effect, for example:
```tsx
const tipTimer = useRef<ReturnType<typeof setTimeout>>();
useEffect(() => () => clearTimeout(tipTimer.current), []);
// ...
onCloseAutoFocus={() => {
  tipTimer.current = setTimeout(() => { suppressTip.current = false; }, 0);
}}
```

---

_Reviewed: 2026-10-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
