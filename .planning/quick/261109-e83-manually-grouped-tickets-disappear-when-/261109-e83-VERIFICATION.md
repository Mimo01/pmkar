---
status: passed
task: 261109-e83
verified: 2026-11-09
score: 7/7 must-haves verified
---

# Quick 261109-e83 Verification

**Goal:** Manually grouped tickets disappear when Jira no longer returns them (auto-remove after a complete fetch; missing UI deleted).

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Auto-remove absent members after complete matching fetch, no confirmation | VERIFIED | `pruneMissingMembers` in `missingMembers.ts` calls `removeFromGroup(id, [...keys])` with no confirmation step |
| 2 | No removal while loading, partial, errored, unhydrated, or on signature mismatch | VERIFIED | `hydrated` check, plus `readMissingKeysNow` going through `readHintsEligibleNow`. Tests cover each case. |
| 3 | Eligibility rechecked per group after each await | VERIFIED | `readMissingKeysNow(id)` is called inside the loop, immediately before each removal |
| 4 | Chip counts and views reflect the removal | VERIFIED | `removeFromGroup` re-hydrates the store. The store's behavior was not changed. |
| 5 | Removed ticket is not re-added | VERIFIED | Only removals are done. There is no re-add path. |
| 6 | Missing UI is gone | VERIFIED | `RemoveMissingPopover.tsx` and `ConfirmRemovePopover.tsx` are deleted. `TicketCard` has no `dimmed` or `footerSlot`. A grep of `src` for the removed symbols finds only the negative i18n test. |
| 7 | i18n strings removed, suite/tsc/lint green | VERIFIED | `groups.missing` and `removeMissing` are absent from both locale files. `tsc --noEmit` is clean. Full `npm test` gives 147 files and 2026 tests passing. `npm run lint` reports warnings only, none in the touched files. |

## Wiring

- `useAutoRemoveMissingMembers()` is called exactly once, at `src/App.tsx:102` (app-level, so it survives Settings).
- The hook selects store refs directly, with no `?? []` selector fallback.
- Re-entrancy is handled with `pruning` and `rerunRequested`. Failures only `console.warn`, never reject, and leave state unchanged, so the effect does not loop.
- `readHintsEligibleNow` is kept. `useHintsEligible` and `useRemovalBlockedByFetch` are removed.
- D-NOGUARD is honored: there is no signature-change skip.

## Checks run

- `npx vitest run src/features/groups`: 34 files, 533 tests passed.
- `npm test`: 147 files, 2026 tests passed.
- `npx tsc --noEmit`: clean.

## Human verification

None required. Optionally, a quick manual smoke in the app: put a ticket in a group, then make Jira stop returning it. After a full fetch it should vanish and the chip count should drop.
