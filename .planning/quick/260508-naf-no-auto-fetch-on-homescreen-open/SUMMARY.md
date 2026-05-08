---
slug: naf-no-auto-fetch-on-homescreen-open
status: complete
date: 2026-05-08
---

# Summary

Removed the auto-fetch on homescreen open from `TicketListPage.tsx`.

**What changed:** The mount `useEffect` previously called `handleFetch()` when `config.lastFetchedAt` was set (i.e., whenever the user had ever fetched before). This was removed. The effect now only hydrates triage map, fetch config, and unseen changes — it no longer triggers a network fetch.

**Preserved behaviours:**
- Button click → fetch
- F5 key → fetch  
- `poll-complete` event with changed keys → fetch (autofetch trigger)
- All hydration on mount (triage state, fetch config, unseen change keys)

**File changed:** `src/features/tickets/TicketListPage.tsx`
