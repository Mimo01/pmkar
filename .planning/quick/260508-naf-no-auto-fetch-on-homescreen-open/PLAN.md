---
slug: naf-no-auto-fetch-on-homescreen-open
title: Remove auto-fetch on homescreen open
date: 2026-05-08
status: in-progress
---

# Remove auto-fetch on homescreen open

## Problem
When the homescreen opens, `TicketListPage` automatically triggers `handleFetch()` if `config.lastFetchedAt` is set. The user wants fetches to happen only when:
1. They click the "Fetch" button manually
2. The background poll autofetch triggers (based on poll frequency settings)

## Root cause
`TicketListPage.tsx` lines 338-341: the mount effect calls `handleFetch()` when `config?.lastFetchedAt` is truthy, reasoning that "tickets are in-memory only". This is the undesired auto-fetch.

## Fix
Remove the `if (config?.lastFetchedAt) { handleFetch(); }` call from the mount effect. Keep all hydration (triage map, fetch config, unseen changes) intact.

## Task list
- [ ] Edit `src/features/tickets/TicketListPage.tsx`: remove auto-fetch from mount effect
- [ ] Update STATE.md Quick Tasks table
- [ ] Commit
