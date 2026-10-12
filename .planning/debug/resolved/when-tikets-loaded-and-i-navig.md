---
status: resolved
trigger: "When tikets loaded and I navigate through the app back to homescreen it shows 'Tikety ešte neboli načítané' and under that the loaded tickets"
created: 2026-05-09
updated: 2026-05-09
---

## Symptoms

- **Expected:** Homescreen shows only loaded tickets without any pre-fetch message
- **Actual:** Homescreen shows 'Tikety ešte neboli načítané' (pre-fetch empty state) AND the loaded tickets beneath it simultaneously
- **Errors:** No console errors visible
- **Timeline:** Started after pre-fetch empty state was added (commits cf24410 / 43804b4)
- **Reproduction:** Load tickets → navigate away from homescreen → navigate back to homescreen

## Current Focus

hypothesis: hasFetchedThisSession is React useState — it resets to false on every mount (navigation). The Zustand ticket store still holds fetched tickets, so both showPreFetchState and hasTickets are simultaneously true after navigation back.
test: n/a
expecting: n/a
next_action: move hasFetchedThisSession out of component local state into Zustand ticketStore so it survives unmount/remount
reasoning_checkpoint: The fix in a2b31f1 correctly switched from lastFetchedAt (persisted) to a session-local flag, but stored it in useState. useState is destroyed on unmount. The flag must outlive the component instance.

## Evidence

- timestamp: 2026-05-09T00:00:00Z
  file: src/features/tickets/TicketListPage.tsx
  lines: 102, 425-426
  observation: |
    hasFetchedThisSession = useState(false). showPreFetchState = !hasFetchedThisSession && !isLoading && fetchStatus !== 'error'.
    showPreFetchState is true after navigation back (component remounts, state resets to false).
    hasTickets is true because Zustand store still has tickets. Both render simultaneously.

- timestamp: 2026-05-09T00:00:00Z
  commit: a2b31f1
  observation: |
    Commit message confirms the intent: "hasFetchedThisSession starts false and flips only when a fetch completes in the current session."
    The word 'session' was intended to mean app-session, but React useState gives component-instance lifetime, not app-session lifetime.

## Eliminated

- lastFetchedAt being null: eliminated — lastFetchedAt is hydrated from persistent store on mount, so it is populated. The old hasFetched check using lastFetchedAt would have been true immediately. That was the bug a2b31f1 tried to fix.
- fetchStatus being wrong: eliminated — fetchStatus stays 'idle' (Zustand global), not affected by navigation.

## Resolution

root_cause: |
  hasFetchedThisSession is stored in component-local useState(false), which resets to false
  every time TicketListPage unmounts and remounts (i.e. on every navigation away and back).
  The Zustand ticket store retains fetched tickets across navigation, so after returning to the
  homescreen showPreFetchState is true (flag reset) while hasTickets is also true (store intact),
  causing both the pre-fetch banner and the ticket list to render simultaneously.

fix: |
  Move hasFetchedThisSession into the Zustand ticketStore as a boolean field
  (e.g. hasFetchedThisSession: false, with an action setHasFetchedThisSession).
  Replace the useState in TicketListPage with a store selector.
  The store field must NOT be persisted / hydrated — it should stay false until the first
  successful fetch in the current app session (same semantics, durable across navigation).

verification: |
  1. Load tickets (hasFetchedThisSession flips to true in store).
  2. Navigate away from homescreen.
  3. Navigate back — hasFetchedThisSession is still true in store.
  4. showPreFetchState evaluates false → pre-fetch banner does not render.
  5. hasTickets is true → ticket list renders.
  Result: only the ticket list is visible.

files_changed:
  - src/features/tickets/ticketStore.ts (add hasFetchedThisSession field + action)
  - src/features/tickets/TicketListPage.tsx (replace useState with store selector)
