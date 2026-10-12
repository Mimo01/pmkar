---
phase: 32-durability
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src-tauri/src/groups_commands.rs
  - src-tauri/src/groups_db.rs
  - src-tauri/src/main.rs
  - src/features/groups/ConfirmRemovePopover.tsx
  - src/features/groups/GroupMenuItems.tsx
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/RemoveMissingPopover.tsx
  - src/features/groups/groupStore.ts
  - src/features/groups/membershipActions.ts
  - src/features/groups/missingMembers.ts
  - src/features/groups/useGroupMembers.ts
  - src/features/tickets/TicketCard.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/fetchSignature.ts
  - src/features/tickets/ticketStore.ts
  - src/features/tickets/useHintsEligible.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Rust side (`refresh_snapshots`) is sound: it validates all input before writing, uses one transaction, never touches `group_member`, and is scope-bound. Zustand selectors follow the stable-ref rule (`?? null`, `EMPTY_MISSING`). No drag and drop was added, and the actions are explicit labelled buttons. The main problems are a cross-scope write race in the snapshot refresh, a missing confirm-time recheck for single removal, and a count mismatch in the bulk-remove confirm.

## Critical Issues

### CR-01: Snapshot refresh can write tickets from server A into server B's scope

**File:** `src/features/tickets/TicketListPage.tsx:162,285` and `src-tauri/src/groups_commands.rs:147-155`
**Issue:** `handleFetch` captures the signature (including baseUrl) at fetch start, but `refreshSnapshots(result.issues)` is called after the awaited fetch with no check that the connection is unchanged. The Rust command derives the scope at call time (`require_scope`). If the user switches or reconnects to another Jira server while a fetch is in flight, A's ticket JSON is written over B's snapshots wherever issue keys collide (e.g. `AB-1` exists on both). Keys are not globally unique across servers, so B's group views then show A's summaries and statuses. `store.setTickets` has the same stale-result exposure, but it is session-only. This write is persisted to SQLite, so it is data corruption.
**Fix:** Gate both `setTickets` and `refreshSnapshots` on the signature still matching, and ideally pass the expected scope to Rust.
```ts
const stillCurrent =
  computeFetchSignature(
    currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
  ) === fetchSig;
if (stillCurrent) void useGroupStore.getState().refreshSnapshots(mergedIssues);
```
For stronger protection, add an `expected_scope` argument to `refresh_group_snapshots` and have `refresh_group_snapshots_inner` return `NoScope` or a no-op on mismatch.

## Warnings

### WR-01: Single missing-member removal does not recheck "still missing" at confirm time

**File:** `src/features/groups/GroupViewPage.tsx:127-137`
**Issue:** The bulk path recomputes with `readMissingKeysNow` ("a member that came back is never removed"). The single-card path calls `removeMissingMember` directly. If a fetch completes while the popover is open and the ticket is back in results, or hints become ineligible, the confirm still removes it. This is inconsistent with the stated T-32-23 race guard.
**Fix:** In the `onConfirm` for a single card, check `readMissingKeysNow(groupId).has(ticket.key)` first. If it is false, return false without removing, and clear `pendingFocusRef`.

### WR-02: Bulk-remove confirm count disagrees with the visible heading, and can remove unseen members

**File:** `src/features/groups/GroupViewPage.tsx:~213-230`, `src/features/groups/missingMembers.ts`
**Issue:** The heading shows `missingVisible.length` (filtered by search or assignee). The confirm question uses `missingKeys.size`, and the action removes all missing keys. With a filter active the user sees "No longer in results (2)" and then "Remove 5 issues?". Missing keys whose snapshot is unreadable are also not rendered (`members` skips them) but are still counted and removed, so the user is destroying rows they never saw.
**Fix:** Either document and label the confirm as "all N missing, including filtered ones", or restrict the bulk action to the visible set. For unreadable snapshots, either show a placeholder row or exclude them from the count.

### WR-03: ConfirmRemovePopover ignores the result of `onConfirm` and always closes

**File:** `src/features/groups/ConfirmRemovePopover.tsx:43-51`
**Issue:** `onConfirm` returns `Promise<unknown>` (the single and bulk paths return a boolean), but the result is discarded. On failure the popover closes and focus is lost, so the user cannot retry in place. If `onConfirm` rejects, the `finally` block resets the state but the error propagates as an unhandled rejection from the click handler. `setBusy(false)` can also run after the popover has unmounted when the last missing card is removed.
**Fix:**
```ts
const ok = await onConfirm();
if (ok !== false) onOpenChange(false);
```
Wrap the call in try/catch, and make `RemoveMissingPopover` return the boolean from `removeAllMissingWithFeedback`. It currently returns void, so failures there are indistinguishable from successes.

### WR-04: One invalid ticket key aborts the whole snapshot refresh

**File:** `src-tauri/src/groups_db.rs:631-640`, `src/features/groups/groupStore.ts:~150`
**Issue:** `refresh_snapshots` returns `InvalidIssueKey` or `InvalidTicket` for the entire batch if any item is bad. The frontend only `console.warn`s. A single malformed Jira issue therefore silently disables snapshot refresh for every member, indefinitely, so offline snapshots go stale.
**Fix:** In the store, send only issues for which `is_valid_issue_key`-equivalent validation passes. Alternatively, have Rust skip invalid items for this best-effort command instead of failing the batch.

## Info

### IN-01: Remove-all leaves focus on a removed element

**File:** `src/features/groups/GroupViewPage.tsx:~213-232`
**Issue:** Single removal has focus handling via `pendingFocusRef`. After bulk removal the whole missing block, including the `removeAllRef` trigger, unmounts. Focus falls back to `body`, which is an a11y regression for keyboard users.
**Fix:** After a successful bulk removal, focus `listRef.current` or the select toggle.

### IN-02: Unused or untyped abstraction in popover result

**File:** `src/features/groups/ConfirmRemovePopover.tsx:9`
**Issue:** `onConfirm: () => Promise<unknown>` hides the success contract that callers actually rely on (see WR-03).
**Fix:** Type it as `Promise<boolean | void>`.

### IN-03: Redundant plural keys

**File:** `src/i18n/locales/en.json:~593-607`
**Issue:** English defines `_few` and `_many` variants that are never selected, and identical strings across all forms. This is harmless, but it is noise that can drift.
**Fix:** Keep only `_one` and `_other` for `en`.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
