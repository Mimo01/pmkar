# Phase 26: Batch Ticket Fetching per Watched User - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the single combined JQL fetch with per-user sequential requests — one fetch per watched user plus one for "mine" — so that following many users never produces a single oversized query. Results are merged and deduplicated before display. The progress counter shows how many user batches have completed during loading.

</domain>

<decisions>
## Implementation Decisions

### Fetch Architecture
- **D-01:** Frontend splits — N sequential `invoke('fetch_tickets')` calls, one per watched user plus one for "mine". Existing Tauri command (`fetch_tickets` in `commands.rs:718`) reused unchanged. No new Rust command needed.
- **D-02:** JQL simplified per batch. **"Mine" batch:** `assignee = "me" OR issueKey in watchedIssues()` — drop `comment ~` and `description ~` clauses. **Per watched-user batch:** `assignee = "u.identifier"` only — no mention searches. The existing `buildJql()` in `TicketListPage.tsx:34` is refactored to produce these per-batch strings.

### Progressive Rendering
- **D-03:** Wait-for-all rendering — loop through all user batches sequentially, accumulate results, then call `store.setTickets()` once at the end. No incremental store updates mid-fetch.
- **D-04:** Show a live progress counter while loading: **"X/N users fetched"** alongside the existing Loader2 spinner. Track in local component state (not in the store). Total N = 1 ("mine") + number of watched users.

### Concurrency & Failure Handling
- **D-05:** Sequential fetching — users fetched one at a time in a simple loop. No `Promise.all`, no parallelism, no semaphore.
- **D-06:** Per-user failure tolerance — if one user's batch throws, continue fetching remaining users. After the loop, show partial results from successful batches and surface a warning listing which users failed (e.g., "Fetch failed for 2 users"). Do not abort the whole operation on a single failure.
- **D-07:** Deduplication by ticket key, first-seen wins. As batches accumulate, skip any key already in the merged set. The "mine" batch runs first so its results take precedence. Sorting is applied after merge.

### Poll Engine
- **D-08 (Claude's discretion):** `poll_engine.rs` keeps its existing combined JQL. The watermark (`updated >= "<timestamp>"`) already narrows the poll result set enough that timeout risk is low. Per-user watermarks would add complexity outside this phase's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend — Fetch Logic
- `src/features/tickets/TicketListPage.tsx` — `buildJql()` (line 34) and `handleFetch()` (line 116) are the primary change targets
- `src/features/tickets/ticketStore.ts` — `setTickets()`, `setFetchStatus()`, `watchedUsers` state shape

### Backend — Fetch Command & Client
- `src-tauri/src/commands.rs` (lines 703–843) — `fetch_tickets` Tauri command; reused as-is for each per-user batch
- `src-tauri/src/jira_client.rs` — `search_tickets()`, `MAX_PAGINATION_ITEMS` (1000), `SEARCH_PAGE_SIZE` (50)

### Background Poll (read-only reference — not modified in this phase)
- `src-tauri/src/poll_engine.rs` — `build_poll_jql()` and watermark logic; kept unchanged

### Phase Specification
- `.planning/ROADMAP.md` Phase 26 — success criteria, especially criteria 1–5

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `invoke('fetch_tickets', { baseUrl, jql })` — existing Tauri command; called once per user in the new loop
- `store.setTickets(issues, triageMap, total, truncated)` in `ticketStore.ts:91` — called once after loop with merged results
- `store.setFetchStatus('loading' | 'error' | 'idle')` — drives spinner; stays `'loading'` for the full loop duration
- Loader2 spinner in `TicketListPage` — exists today; progress counter text added alongside it

### Established Patterns
- `useCallback` + `invoke` pattern in `handleFetch` — same pattern used for per-user loop
- Triage map from `fetch_tickets` result — must be merged across batches (union of all returned `triageMap` entries)
- `totalCount` field — becomes the sum of all per-batch `total` values (pre-dedup)
- `truncated` flag — OR'd across batches: if any batch is truncated, surface the warning

### Integration Points
- `handleFetch()` is called from: initial mount effect, F5 shortcut, `poll-complete` event handler — all three callers stay unchanged; only the internals of `handleFetch` change
- Change detection loop after fetch (lines 140–181) iterates over `result.issues` — this must iterate over the merged final list
- `invoke('trigger_manual_poll')` reset at end of fetch (line 184) — stays in place, after the full loop

</code_context>

<specifics>
## Specific Ideas

- Progress counter format: **"X/N users fetched"** — show during the loop, disappear once fetch completes
- "Mine" batch runs first in the loop; watched-user batches follow in watch-list order
- Partial failure warning should identify which users failed (not just a count), since the watch list is typically small

</specifics>

<deferred>
## Deferred Ideas

- **Parallel fetching with bounded concurrency** — Milan asked for sequential for now; parallel could be revisited if load times are still slow with a large watch list
- **Poll engine per-user batching** — keeping combined JQL in poll_engine.rs; could be its own phase if timeout issues surface for large watch lists during background polling
- **Per-user fetch config** — custom JQL per watched user; out of scope

</deferred>

---

*Phase: 26-batch-ticket-fetching-per-watched-user*
*Context gathered: 2026-05-06*
