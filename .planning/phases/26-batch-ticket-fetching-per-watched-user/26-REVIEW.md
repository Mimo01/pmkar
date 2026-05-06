---
phase: 26-batch-ticket-fetching-per-watched-user
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx
  - src/features/tickets/__tests__/TicketListPage.projectScope.test.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 26 refactors `handleFetch` to run one JQL batch per watched user sequentially, merging results with first-seen deduplication. The batch structure, dedup logic, partial-failure tolerance, progress counter, and JQL construction are all implemented correctly and well-tested. Three issues require attention before shipping.

The most significant finding is a behavioral regression: when all batches fail, the previously-loaded ticket list is silently wiped rather than preserved. This is a new behaviour introduced by Phase 26 — before this phase a complete fetch failure showed an error banner and kept existing tickets intact. Two additional warnings cover a concurrent-fetch window that grew larger with the sequential batch loop, and an untranslated internal label surfacing in the failure UI.

---

## Warnings

### WR-01: All-batches-failure silently clears the ticket list (behavioral regression)

**File:** `src/features/tickets/TicketListPage.tsx:188-220`

**Issue:** When every batch in the loop fails (every `invoke('fetch_tickets')` throws), each error is caught individually and pushed to `localFailedUsers`. After the loop, `store.setTickets([], {}, 0, false)` is called unconditionally (line 220). `setTickets` resets `fetchStatus` to `'idle'` and overwrites `tickets` with an empty array, wiping any previously-loaded tickets. The UI then displays the empty-state panel ("No new tickets") while showing the partial-failure warning banner.

Before Phase 26, a complete fetch failure was caught by the outer `try/catch` (line 275), which called `store.setFetchStatus('error', ...)`. That path left `tickets` unchanged and showed a red error banner. The Phase 26 refactor moved per-batch errors into an inner catch, inadvertently removing the all-fail protection.

**Fix:** Guard `store.setTickets` with a check that at least one batch succeeded before overwriting the store:

```ts
// Only commit merged results if at least one batch produced data.
// If all batches failed, preserve existing tickets and show the error banner.
if (localFailedUsers.length === batches.length) {
  store.setFetchStatus(
    'error',
    `All ${batches.length} batch(es) failed. Check your connection.`,
  );
  setFailedUserNames(localFailedUsers);
  return;
}

store.setTickets(mergedIssues, mergedTriageMap, totalCount, anyTruncated);
```

---

### WR-02: The `mine` batch hardcoded label renders verbatim in the partial-failure UI

**File:** `src/features/tickets/TicketListPage.tsx:170`

**Issue:** The batch for the current user is constructed with the hardcoded label `'mine'` (line 170). When this batch fails, `localFailedUsers.push(batch.label)` pushes `'mine'` (line 210), and the UI renders it literally at line 468:

```tsx
<p className="text-xs text-brand-muted mt-1">{failedUserNames.join(', ')}</p>
```

The user sees: `"Fetch failed for 1 user(s)"` followed by the raw string `"mine"` — an internal identifier with no translation and no user-facing meaning. The watched-user batches correctly use `u.displayName` (line 175) which is always a proper name.

**Fix:** Replace the hardcoded string with a translated label resolved at build-time (outside the `useCallback`) or resolve it inside the callback:

```ts
// Option A — resolve t() inside the useCallback (requires adding t to the dep array):
{
  label: t('settings.preset.mine'),  // "Mine" in EN, "Moje" in SK
  jql: buildMineBatchJql(serverConn.username, connState.sourceProjectKey),
},

// Option B — keep 'mine' internally and translate when rendering:
<p className="text-xs text-brand-muted mt-1">
  {failedUserNames
    .map((n) => (n === 'mine' ? t('settings.preset.mine') : n))
    .join(', ')}
</p>
```

Either option requires `t` to be stable across renders (it is, from `useTranslation`).

---

### WR-03: `poll-complete` listener triggers `handleFetch` without an `isLoading` guard

**File:** `src/features/tickets/TicketListPage.tsx:324-326`

**Issue:** The `poll-complete` event handler calls `handleFetch()` unconditionally when `changedKeys.length > 0`. In contrast, the F5 keyboard handler at line 308 correctly gates on `!isLoading`. With Phase 26's sequential batch loop, a single `handleFetch` invocation can take multiple seconds (one network round-trip per watched user). A background poll completing with changes during that window launches a second concurrent `handleFetch`, both of which will eventually call `store.setTickets`. The second invocation's result can overwrite the first's result non-deterministically.

This issue existed before Phase 26, but the blast radius was a single fast request. Phase 26 extends the vulnerable window proportionally to the number of watched users.

**Fix:** Add the same guard used by the F5 handler:

```ts
if (event.payload.changedKeys.length > 0 && !isLoading) {
  handleFetch();
}
```

`isLoading` is already a closure variable available in the `useEffect` scope at line 316, and `isLoading` is already in the dependency array (implicitly, via `handleFetch` which closes over it). For the listener effect to see updated `isLoading`, add it to the `useEffect` dependency array:

```ts
}, [handleFetch, isLoading]);
```

---

## Info

### IN-01: Orphaned i18n key `tickets.lastFetched` in both locale files

**File:** `src/i18n/locales/en.json:77`, `src/i18n/locales/sk.json:77`

**Issue:** The key `tickets.lastFetched` exists in both locale files but is not referenced anywhere in the source. `TicketListPage` uses `tickets.lastChecked` (line 416). The `tickets.lastFetched` key was likely superseded when the "last checked" timestamp was introduced in a prior phase and was never removed.

**Fix:** Delete the orphaned entry from both locale files:

```json
// Remove from en.json:
"tickets.lastFetched": "Last fetched: {{time}}",

// Remove from sk.json:
"tickets.lastFetched": "Naposledy načítané: {{time}}",
```

---

### IN-02: `triageMap` merge uses last-write-wins but issue dedup uses first-seen-wins

**File:** `src/features/tickets/TicketListPage.tsx:204`

**Issue:** Duplicate tickets across batches are deduplicated with first-seen-wins (lines 198-202). However, the `triageMap` entries are merged with `Object.assign` (line 204), which is last-write-wins. For a ticket that appears in both the `mine` batch and a watched-user batch, the issue data comes from the mine batch but the triage entry comes from whichever batch was fetched last.

In practice the triage map is populated from a single SQLite source, so both batches return identical entries for overlapping keys. The inconsistency is harmless today but creates fragility if the backend ever returns per-user triage views.

**Fix:** Apply the same first-seen-wins logic to the triage map:

```ts
for (const [key, entry] of Object.entries(result.triageMap)) {
  if (!(key in mergedTriageMap)) {
    mergedTriageMap[key] = entry;
  }
}
```

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
