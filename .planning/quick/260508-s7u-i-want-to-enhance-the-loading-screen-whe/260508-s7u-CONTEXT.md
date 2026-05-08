# Quick Task 260508-s7u: Loading screen enhancement - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Task Boundary

Fix the broken loading screen when fetching new stories. Currently `isLoading && <SkeletonCards count={3} />` renders above the existing ticket list (when `hasTickets` is also true), causing both skeletons and real tickets to show simultaneously.

File: `src/features/tickets/TicketListPage.tsx`

</domain>

<decisions>
## Implementation Decisions

### Loading behavior on re-fetch
- Hide existing tickets while loading: render skeleton only (no visible stale ticket list underneath)
- Fix: guard the card list with `!isLoading` — `{hasTickets && !isLoading && <div>...tickets...</div>}`

### Skeleton count
- Keep fixed at 3. Do not match previous ticket count.

### Scroll position
- Reset scroll to top when fetch completes (new data, fresh start)
- Implement by resetting a scroll container ref after `fetchStatus` transitions from `loading` to `idle`/`error`

### Claude's Discretion
- How to wire the scroll reset (ref on the overflow-y-auto div, effect watching fetchStatus)
- Whether to keep or remove the existing `aria-busy` / `role="status"` on SkeletonCards (keep it)

</decisions>

<specifics>
## Specific Ideas

- The overflow-y-auto div wrapping the card list is the scroll container to reset
- `isLoading` is derived as `fetchStatus === 'loading'`, so watching `fetchStatus` in a useEffect for the transition is sufficient
- The fix is minimal: one conditional change + one useRef/useEffect for scroll reset

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
