# Quick Task 260508-s7u: Loading Screen Enhancement - Research

**Researched:** 2026-05-08
**Domain:** React conditional rendering + scroll reset in TicketListPage.tsx
**Confidence:** HIGH (all findings from direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hide existing tickets while loading: render skeleton only — guard card list with `!isLoading`
- Skeleton count stays at 3 (fixed, not dynamic)
- Reset scroll to top when fetch completes (fetchStatus transitions loading → idle/error)
- Keep existing `aria-busy` / `role="status"` on SkeletonCards

### Claude's Discretion
- How to wire the scroll reset (ref on overflow-y-auto div, useEffect watching fetchStatus)

### Deferred Ideas (OUT OF SCOPE)
- None stated
</user_constraints>

---

## Bug Confirmation

**File:** `src/features/tickets/TicketListPage.tsx`

Lines 504–526 render the skeleton and card list as independent siblings with no mutual exclusion:

```tsx
{/* Loading skeleton — line 504 */}
{isLoading && <SkeletonCards count={3} />}

{/* Card list — line 515 */}
{hasTickets && (
  <div className="flex-1 overflow-y-auto">
    {sortedCandidates.map(...)}
  </div>
)}
```

On a re-fetch, `isLoading` becomes `true` but `hasTickets` stays `true` (tickets from the previous fetch are still in the store). Both branches evaluate truthy simultaneously — skeleton cards render above the stale list. [VERIFIED: direct file inspection]

**Fix:** Add `!isLoading` guard to the card list condition, line 515:

```tsx
{hasTickets && !isLoading && (
  <div className="flex-1 overflow-y-auto" ref={scrollRef}>
    ...
  </div>
)}
```

---

## Scroll Reset Pattern

### Existing scroll container

The `overflow-y-auto` div at line 516 is the only scroll container in the component. It has no `ref` today — one must be added. [VERIFIED: direct file inspection]

### Wiring the reset

`fetchStatus` is already subscribed from the store (`const fetchStatus = useTicketStore((s) => s.fetchStatus)`). A `useEffect` watching it is the correct, idiomatic pattern:

```tsx
const scrollRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (fetchStatus !== 'loading' && scrollRef.current) {
    scrollRef.current.scrollTop = 0;
  }
}, [fetchStatus]);
```

**How it fires:** Every time `fetchStatus` changes. When loading ends (transitions to `'idle'` or `'error'`), the effect runs and resets scroll. It is a no-op on the `'loading'` entry transition. [ASSUMED — standard React useEffect behaviour, consistent with observed store usage pattern]

**Imports needed:** `useRef` — already imported on line 4 alongside `useCallback`, `useEffect`, `useMemo`, `useState`. No new import required. [VERIFIED: direct file inspection]

---

## Pitfalls

### 1. ref targets a conditionally rendered node
The `overflow-y-auto` div is inside `{hasTickets && !isLoading && (...)}`. When `isLoading` is true, the div unmounts and `scrollRef.current` becomes `null`. The `scrollRef.current.scrollTop = 0` call must be guarded (`if (scrollRef.current)`) — which the pattern above includes. No issue when the guard is present.

### 2. fetchStatus cycles through values — effect fires on every change
The effect fires on `'loading'` entry too (when `fetchStatus !== 'loading'` is false), so it's a no-op there. No double-fire concern. If `fetchStatus` were to briefly flicker through `'idle'` mid-batch (it does not — it stays `'loading'` throughout the batch loop; `setFetchStatus('idle')` is only called in `store.setTickets`), that would cause a premature scroll reset. The current store implementation avoids this. [VERIFIED: handleFetch logic in TicketListPage.tsx lines 100–293 — `setFetchStatus` is only called with `'loading'` at the start and implicitly transitions to `'idle'` via `store.setTickets`]

### 3. Accessibility: hiding stale content during load
Hiding stale tickets behind `!isLoading` is correct. The `SkeletonCards` component already carries `aria-busy="true"` and `role="status"` (TicketCard.tsx line 99), which communicates loading state to assistive technology. No additional ARIA work required. [VERIFIED: TicketCard.tsx line 99]

### 4. Empty state flash
`showEmptyState` is defined as `hasFetched && !hasTickets && fetchStatus === 'idle'`. During loading, `fetchStatus !== 'idle'` so the empty state never renders. After a successful fetch that returns zero results, it will correctly show. No flash introduced by the fix. [VERIFIED: line 406]

---

## Minimal Change Set

Two isolated edits to `TicketListPage.tsx`:

| # | Location | Change |
|---|----------|--------|
| 1 | After existing `useState`/`useEffect` hooks (around line 87) | Add `const scrollRef = useRef<HTMLDivElement>(null);` |
| 2 | After existing `useEffect` hooks | Add `useEffect` watching `fetchStatus` to reset `scrollRef.current.scrollTop` |
| 3 | Line 515 — card list condition | Change `{hasTickets && (` to `{hasTickets && !isLoading && (` |
| 4 | Line 516 — overflow-y-auto div | Add `ref={scrollRef}` |

No changes needed to `TicketCard.tsx`, `ticketStore.ts`, or any other file.

---

## Sources

- `src/features/tickets/TicketListPage.tsx` — direct inspection [VERIFIED]
- `src/features/tickets/TicketCard.tsx` — SkeletonCards ARIA attributes [VERIFIED]
- `.planning/quick/260508-s7u-.../260508-s7u-CONTEXT.md` — user decisions [VERIFIED]
