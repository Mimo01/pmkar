---
phase: 36-detail-and-group-ui
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/__tests__/GroupViewPage.test.tsx
  - src/features/groups/__tests__/groupDetailTriage.test.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/IgnoredTicketsPage.test.tsx
  - src/features/tickets/RememberedLinkHint.tsx
  - src/features/tickets/__tests__/RememberedLinkHint.test.tsx
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/__tests__/TicketDetailPage.test.tsx
  - src/features/tickets/TicketDetailPanel.tsx
  - src/features/tickets/TicketDetailPanel.test.tsx
  - src/features/tickets/useTriageDetailActions.ts
  - src/features/tickets/__tests__/useTriageDetailActions.test.tsx
  - src/i18n/__tests__/detailLocale.test.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 16 (the test files were not read)
**Status:** issues_found

## Summary

I found no blockers. The shared `useTriageDetailActions` hook is sound. The problems are inconsistencies between the hook and its two consumers, a duplicated Slovak label, and some robustness gaps. I read only the source and locale files, and only grepped the locale files. The test files are listed in scope but I did not open them.

## Warnings

### WR-01: SK labels for "Dismiss" and "Deny" are identical

**File:** `src/i18n/locales/sk.json:110,114`
**Issue:** `detail.ignore` and `detail.deny` are both "Zamietnuť". They are different actions: one acts on an unlinked ticket, the other unlinks a copied ticket and remembers the link. The EN labels are distinct ("Dismiss" and "Deny"). They never appear together in one state, but the same word means different things with different tooltips. This also confuses the "Zamietnuté" tab naming.
**Fix:** Give `detail.deny` a distinct Slovak label, or confirm that one label is intended.

### WR-02: `isCopied` ignores `copiedKey`, but the hook's `isLinked` requires it

**File:** `src/features/tickets/TicketDetailPage.tsx:46,221,236` (same pattern in `TicketDetailPanel.tsx:44,374`)
**Issue:** If `state === 'copied'` with no `copiedKey`, `isCopied` is true. The Copy button is hidden, because `!isCopied` is false. The linked branch is skipped, because `copiedKey` is falsy. The user gets Dismiss and Mark handled but no Copy and no badge. The hook already defines `isLinked` as `state === 'copied' && !!copiedKey`, and the components ignore it.
**Fix:** Use `tri.isLinked` and `tri.isDenied` throughout the components. Show the Copy button when `!isLinked && !isIgnored && !isHandled`.

### WR-03: `restoreTicket` calls in list rows are fire-and-forget

**File:** `src/features/groups/GroupViewPage.tsx:168`, `src/features/tickets/IgnoredTicketsPage.tsx:123`
**Issue:** `restoreTicket(ticket.key)` returns a promise that is not awaited or voided. The detail views use `void restoreTicket(...)`. If it rejects, the rejection goes unhandled. The call also ignores its boolean result.
**Fix:** Use `void restoreTicket(ticket.key)`, or handle the failure.

### WR-04: `handleDeny` and `handleDismiss` leave `pendingFocus='primary'` armed when the state does not change

**File:** `src/features/tickets/useTriageDetailActions.ts:80-90`
**Issue:** Both handlers set `pendingFocus='primary'` before the await. If `denyTicket` returns true but the store state does not change, or the primary button never mounts, the pending target stays armed. Any later unrelated `state` or `focusTick` change then steals focus. `handleLink` has the same issue for `'badge'`. The `isConnected` check only protects against missing elements, not against stale intent.
**Fix:** Clear `pendingFocus` after the await when the action succeeded and the effect did not consume it. Alternatively, clear it on the next user interaction.

### WR-05: Escape handling differs between Panel and Page

**File:** `src/features/tickets/TicketDetailPanel.tsx:126-131` vs `TicketDetailPage.tsx:108-113`
**Issue:** The Page checks `!e.defaultPrevented`. The Panel does not. Escape pressed inside a Radix tooltip, popover or dialog would close the panel. The Panel now hosts tooltips on the new triage buttons.
**Fix:** Add `&& !e.defaultPrevented` to the Panel handler.

## Info

### IN-01: Variable `t` shadows the i18n `t` function

**File:** `src/features/groups/GroupViewPage.tsx:47,51,56,59`; `src/features/tickets/IgnoredTicketsPage.tsx:31,43,46`
**Issue:** The callbacks `(t) => ...` shadow `t` from `useTranslation`. It works today, but a later edit that calls `t('...')` inside those callbacks would fail.
**Fix:** Rename the callback parameter to `tk` or `ticket`.

### IN-02: Hardcoded English strings

**File:** `src/features/tickets/IgnoredTicketsPage.tsx:91`, `src/features/tickets/TicketDetailPanel.tsx:191`
**Issue:** The strings `aria-label="Dismiss info card"` and `aria-label="Ticket detail"` are not localized. The SK UI is a project requirement.
**Fix:** Move both to i18n keys.

### IN-03: Hacky `initialTabRef` type cast

**File:** `src/features/tickets/TicketDetailPanel.tsx:76-82`
**Issue:** `initialTabRef` is typed `TabId | null`, but it stores `issueKey as unknown as TabId`. The effect also duplicates the tab selection done in the fetch effect.
**Fix:** Type the ref as `string | null` and remove the duplicate effect.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
