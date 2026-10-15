---
phase: 37-consistency-accessibility-and-uat
fixed_at: 2026-10-15T00:00:00Z
review_path: .planning/phases/37-consistency-accessibility-and-uat/37-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 1
skipped: 2
status: partial
---

# Phase 37: Code Review Fix Report

**Fixed at:** 2026-10-15
**Source review:** .planning/phases/37-consistency-accessibility-and-uat/37-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 1
- Skipped: 2

## Fixed Issues

### WR-01: LiveAnnouncer re-announces the last stale message on every remount

**Files modified:** `src/components/LiveAnnouncer.tsx`
**Commit:** 250881a
**Applied fix:** Added a `handled` ref seeded with the store nonce at mount. The effect skips when the nonce equals the handled value, so a remount no longer replays the old message. The existing LiveAnnouncer tests pass (5/5). Status: fixed, requires human verification (logic change).

## Skipped Issues

### WR-02: Announcement wording is inconsistent with the existing UI terminology

**File:** `src/i18n/locales/en.json:190`, `src/i18n/locales/sk.json:190`
**Reason:** The reviewer's premise does not hold. `nav.notMine`, the visible tab label, is "Dismissed", and `src/i18n/__tests__/a11yLocale.test.ts` deliberately requires `a11y.denied` to contain that label. Changing it to "Ignored" failed that test, so the change was reverted and not committed. The real inconsistency is that the UI itself mixes "Dismissed" (tab, heading, buttons) with "Ignored" (`nav.ignored`, `triage.denied`). That needs a product decision.
**Original issue:** Screen-reader text names a destination that differs from other strings.

### WR-03: aria-disabled link buttons may lose disabled styling and double-submit guard

**File:** `src/features/tickets/TicketDetailPage.tsx:295-327`
**Reason:** No change made. The re-entry guard is already in place: `useTriageDetailActions.handleLink` returns early on `linkingRef.current` (a ref, lines 52-53 and 93-102), so double clicks are safe. The suggested `aria-disabled:pointer-events-none` would suppress the existing `cursor-not-allowed` and the tooltip hover. Moving the `linkBusy` declaration is cosmetic only.
**Original issue:** aria-disabled replaced disabled, so hover styling stays active while busy.

---

_Fixed: 2026-10-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
