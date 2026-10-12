---
phase: 32-durability
fixed_at: 2026-10-12T21:10:00Z
review_path: .planning/phases/32-durability/32-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 3
skipped: 3
status: partial
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-10-12T21:10:00Z
**Source review:** .planning/phases/32-durability/32-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (WR-07, WR-08, WR-09 open; WR-02, WR-03, WR-04 deferred)
- Fixed: 3
- Skipped: 3 (all intentionally deferred)

**Verification (after the last fix):**
- `npx tsc --noEmit`: clean.
- `npx vitest run src`: 1509/1509 passed.
- `cargo test` (src-tauri): all passed, including 269 lib tests.
- The pre-commit hook passed on every fix commit: cargo fmt, biome, tsc, clippy `-D warnings`, vitest and cargo test.
- Each new regression test was confirmed to fail with the source change stashed.

## Fixed Issues

### WR-07: A fetch orphaned by the Settings round-trip clobbers the new server's fetch state

**Status:** fixed: requires human verification (concurrency/state logic)
**Files modified:** `src/features/tickets/ticketStore.ts`, `src/features/tickets/TicketListPage.tsx`, `src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx`, `src/features/tickets/__tests__/ticketStore.test.ts`
**Commit:** d47aa8e
**Applied fix:**
- Fetch ownership is now global. `ticketStore` has a new `fetchGeneration` field and a `beginFetch()` action. `beginFetch()` increments the generation and sets `loading`. `resetForServerSwitch()` also increments it, and changes a `loading` status to `idle`, because the orphaned fetch will no longer write.
- `handleFetch` captures its generation. It checks `owns()` before every terminal write, so it returns without writing if a newer fetch or a server switch has taken over. This covers:
  - the custom and batch result gates;
  - the `catch`, which previously painted A's error onto B;
  - the change-detection loops and `setUnseenChange`, which also covers IN-08;
  - the batch loop, which now stops issuing requests to the old server.
- `discardStaleResult` only runs while this fetch still owns the status. The username-only switch path therefore behaves as before.
- Changed contract: the existing store test asserted that a switch leaves `fetchStatus` at `loading`. It now asserts `idle` and a bumped generation.
- New tests:
  - an orphan that rejects after a switch leaves B's status, error and complete signature alone;
  - an orphan from an unmounted page, settling during B's fetch, neither ends B's `loading` nor applies its list;
  - `beginFetch` and `reset` semantics.

### WR-08: During any fetch, every "Remove" confirm is a silent no-op

**Status:** fixed
**Files modified:** `src/features/tickets/useHintsEligible.ts`, `src/features/groups/ConfirmRemovePopover.tsx`, `src/features/groups/GroupViewPage.tsx`, `src/features/groups/GroupMenuItems.tsx`, `src/features/groups/GroupTabStrip.tsx`, `src/features/groups/RemoveMissingPopover.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/sk.json`, tests (`GroupViewPage`, `GroupMenuItems`, `ConfirmRemovePopover`)
**Commit:** eeb06b8
**Applied fix:** Used review option 1: disable the triggers while loading.
- New hook `useRemovalBlockedByFetch()`. Its selector returns a primitive boolean, `fetchStatus === 'loading'`.
- While a fetch is loading:
  - the per-card "Remove" and the "Remove all missing" buttons are disabled, with a `title` hint;
  - the tab-menu "Remove all missing (N)" item stays visible but is disabled, with the hint. D-10 hiding rules are unchanged.
- `ConfirmRemovePopover` has a new `confirmDisabledReason` prop. When a fetch starts while the confirm is already open, the Remove button is disabled and the reason appears under the question. Before, Remove closed the popover without doing anything.
- New copy key `groups.missing.refreshing` in EN and SK.
- The visibility gating in `useHintsEligible` is untouched, so there is no flicker.
- Not covered: changing `ConfirmRemovePopover`'s result handling, which belongs to deferred WR-03. That path can no longer hit the loading abort, but non-loading aborts and failures still close the popover.

### WR-09: The add veto checks the frontend's current server, not where the tickets came from

**Status:** fixed: requires human verification (scope logic plus UX of the rollback)
**Files modified:** `src/features/tickets/ticketStore.ts`, `src/features/tickets/TicketListPage.tsx`, `src/features/groups/groupStore.ts`, `src/features/connections/SettingsPage.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/sk.json`, tests (`groupStore`, `SettingsPage`, `membershipActions`)
**Commit:** cda9ddf
**Applied fix:**
- **Ticket origin.**
  - `setTickets` takes an optional `sourceBaseUrl`. It is recorded per ticket in a module `WeakMap`, keyed by object identity, and is never persisted or added to the ticket JSON. `handleFetch` passes `serverConn.baseUrl`.
  - The new `expectedAddScope(tickets)` uses each ticket's recorded origin. Tickets without one (snapshots, detail loaded by key) fall back to the current server. Mixed origins return `''`, which Rust rejects (fail closed).
  - Effect: a list ticket that outlives `resetForServerSwitch` is now vetoed by Rust.
  - I used a per-ticket origin rather than a list-level `ticketsBaseUrl`. A list-level value would be cleared on reset, which would break adds from group views and detail before the first fetch.
- **Settings drift.**
  - `set_connection_meta` failures are no longer swallowed. The page logs the error, rolls the frontend connection back to the value Rust still holds, and shows an error toast (`settings.connectionSaveFailed`, EN and SK).
  - The rollback is skipped if a newer save has already replaced the connection.
  - Group re-hydration still runs after the rollback, against the scope Rust kept.
- **Copy.** `groups.error.scopeMismatch` now reads "The connected server changed or is out of sync. Reopen the ticket list and try again. If this keeps happening, save the server connection again in Settings." The SK text is equivalent.
- **Not changed:** the SetupWizard persistence path still only logs, because it was not cited. No Rust changes were needed.

## Skipped Issues

### WR-02 [DEFERRED]: The bulk-remove confirm count differs from the visible heading

**File:** `src/features/groups/GroupViewPage.tsx:251, 257, 267-269`
**Reason:** Intentionally deferred (marked [DEFERRED] in REVIEW.md; the orchestrator said not to fix).
**Original issue:** The heading uses the filtered `missingVisible.length`. The confirm uses `missingKeys.size`, and the action removes every missing key, including members the user has not seen.

### WR-03 [DEFERRED]: ConfirmRemovePopover ignores the result of `onConfirm`, always closes, and leaks rejections

**File:** `src/features/groups/ConfirmRemovePopover.tsx:39-50`, `src/features/groups/RemoveMissingPopover.tsx:35-40`
**Reason:** Intentionally deferred (marked [DEFERRED] in REVIEW.md; the orchestrator said not to fix). WR-08 removes the most frequent silent case (aborts during loading) without touching this result handling.
**Original issue:** Aborts, failures and successes all close the popover the same way, and a rejected `onConfirm` is not caught.

### WR-04 [DEFERRED]: One invalid ticket aborts the whole snapshot refresh, indefinitely

**File:** `src-tauri/src/groups_db.rs` (`refresh_snapshots` validation loop), `src/features/groups/groupStore.ts:150-165`
**Reason:** Intentionally deferred (marked [DEFERRED] in REVIEW.md; the orchestrator said not to fix).
**Original issue:** All-or-nothing validation in the best-effort refresh path turns off snapshot freshness for every member.

---

_Fixed: 2026-10-12T21:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
