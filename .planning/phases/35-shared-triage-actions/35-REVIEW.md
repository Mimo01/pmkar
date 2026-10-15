---
phase: 35-shared-triage-actions
reviewed: 2026-10-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.test.tsx
  - src/features/tickets/TicketDetailPanel.tsx
  - src/features/tickets/__tests__/TicketDetailPage.test.tsx
  - src/features/tickets/__tests__/triageActions.test.ts
  - src/features/tickets/triageActions.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The detail page and panel handlers are correctly routed through the shared `triageActions` module. The key-preservation and rollback logic is mostly sound. The remaining problems are stale-state races in Undo and rollback, plus one inconsistency in `linkTicket`. I read the test files only for scope and did not audit them.

## Warnings

### WR-01: Undo toast can overwrite newer state

**File:** `src/features/tickets/triageActions.ts:47-58`
**Issue:** `undoDeny` runs up to 8 s after the deny. It calls `relink_ticket` and then writes `copied` without checking that the entry is still `ignored`. If the user has meanwhile restored the ticket, marked it handled, or re-copied it, Undo silently clobbers that state. The toast also isn't dismissed when `restoreTicket` or `markHandled` runs, so it can outlive the state it was meant to undo.
**Fix:** In `undoDeny`, check `useTicketStore.getState().triageMap[issueKey]?.state === 'ignored'` before calling `relink_ticket` or writing the entry. Call `toast.dismiss(\`deny-${issueKey}\`)` in `restoreTicket` and `markHandled` on success.

### WR-02: Rollback uses a stale `prev` under concurrent actions

**File:** `src/features/tickets/triageActions.ts:27-43`
**Issue:** If two actions on the same key overlap, for example a double-click on Ignore or Ignore followed quickly by Restore, the second action captures the first one's optimistic entry as `prev`. If the first action then fails, the identity guard sees that the entry is no longer its own optimistic object and skips its rollback. If the second action also fails, it rolls back to the first action's optimistic (never persisted) state. The UI then shows a state the DB never held. Nothing prevents a second invocation while the first is in flight.
**Fix:** Serialize actions per ticket key, for example with a `Map<string, Promise>` queue or an in-flight set. Alternatively, on failure, reload the entry from the backend rather than restoring `prev`.

### WR-03: `linkTicket` hand-off ignores a failure in `startPreview`

**File:** `src/features/tickets/triageActions.ts:112-127`
**Issue:** `void useCopyStore.getState().startPreview(...)` discards the promise. A rejection becomes an unhandled promise rejection, and the function still returns `'needs-copy'`. When `serverConnection` is absent, `serverBase` is `''`, so `fetch_ticket_detail` is called with an empty base URL. That produces a generic "link failed" toast rather than a "not connected" message.
**Fix:** Guard on a missing connection and return `'failed'` early. Attach `.catch` to the `startPreview` call, or await it.

## Info

### IN-01: `handleUnignore` and `handleUnhandle` are duplicates

**File:** `src/features/tickets/TicketDetailPage.tsx:60-68`, `src/features/tickets/TicketDetailPanel.tsx:58-66`
**Issue:** Both handlers have identical bodies (`restoreTicket(issueKey)`) in each file.
**Fix:** Use a single `handleRestore`, or pass `restoreTicket` directly.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
