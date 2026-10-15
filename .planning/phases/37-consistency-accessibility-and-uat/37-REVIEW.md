---
phase: 37-consistency-accessibility-and-uat
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/App.tsx
  - src/components/LiveAnnouncer.tsx
  - src/components/__tests__/LiveAnnouncer.test.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.tsx
  - src/features/tickets/triageActions.ts
  - src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx
  - src/features/tickets/__tests__/triageActions.test.ts
  - src/features/tickets/__tests__/triageConsistency.test.tsx
  - src/i18n/__tests__/a11yLocale.test.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The changes add a live-region announcer, route triage outcomes through it, and add focus-ring and aria-disabled styling. No security issues were found. The test files were not read in full. I reviewed the source diffs, the announcer and the locale strings. The issues below are a stale re-announcement on remount, terminology that disagrees with existing strings, and a possible gap in `aria-disabled` styling.

## Warnings

### WR-01: LiveAnnouncer re-announces the last stale message on every remount

**File:** `src/components/LiveAnnouncer.tsx:25-30` (mounted at `src/App.tsx:213,238,252,279,325`)
**Issue:** `<LiveAnnouncer />` is rendered separately in each of five early-return branches of `App`. When `App` moves between branches (for example loading to main, or connection setup to main), the component unmounts and remounts. The store keeps `nonce > 0` and `message`, so the effect on mount passes the `nonce === 0` guard and announces the old message again. Screen-reader users would hear an outdated "X moved to Dismissed" after unrelated navigation.
**Fix:** Mount it once, outside the branching (a wrapper around the returned tree). Alternatively, track the last-handled nonce in a module-level ref or store field and skip it on mount:
```tsx
const handled = useRef(useAnnouncerStore.getState().nonce);
useEffect(() => {
  if (nonce === handled.current) return;
  handled.current = nonce;
  ...
}, [message, nonce]);
```

### WR-02: Announcement wording is inconsistent with the existing UI terminology

**File:** `src/i18n/locales/en.json:190`, `src/i18n/locales/sk.json:190`
**Issue:** `a11y.denied` says "moved to Dismissed" (SK: "Zamietnuté"). The neighbouring `triage.undoFailed` strings and the Ignored page say "Ignored" (SK: "Ignorované"). The screen-reader text names a destination that does not match the visible label, which breaks the consistency goal of this phase.
**Fix:** Use the same destination label as the sidebar and page title ("Ignored" / "Ignorované"), or confirm the label with the product owner and align every string.

### WR-03: aria-disabled link buttons may lose their disabled styling and double-submit guard on the shared Button

**File:** `src/features/tickets/TicketDetailPage.tsx:295-305,317-327`
**Issue:** `disabled` was replaced by `aria-disabled`, with a JS guard on `onClick`. The `aria-disabled:*` classes are added only through `className`, so the shared `Button` component's own `disabled:` variants (pointer-events-none and similar) no longer apply. Hover styles stay active while busy. `linkBusy` is also declared between `isIgnored` and `isHandled`, which splits related triage derivations. The guard is also not synchronous: two clicks inside one render tick both pass because `linkBusy` is a render-time closure value. This relies on `tri.handleLink` guarding against re-entry itself.
**Fix:** Confirm `useTriageActions.handleLink` returns early while `linking` is true, using a ref rather than state. Add `aria-disabled:pointer-events-none` so hover styling is suppressed.

## Info

### IN-01: Duplicated focus-ring class string

**File:** `src/features/tickets/TicketDetailPanel.tsx:287,316,340,353,367,383` (also `GroupViewPage.tsx:170`, `IgnoredTicketsPage.tsx:125`)
**Issue:** The string `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2` is copy-pasted at least eight times.
**Fix:** Extract a shared constant (for example `FOCUS_RING`) or a Tailwind `@apply` utility.

### IN-02: Magic numbers

**File:** `src/features/tickets/triageActions.ts:78`
**Issue:** The Undo toast duration `8000` is hard-coded, and its meaning appears only in a doc comment.
**Fix:** Name it as `UNDO_TOAST_MS`, as `ANNOUNCE_DELAY_MS` is in `LiveAnnouncer`.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
