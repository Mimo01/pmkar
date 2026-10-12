---
status: resolved
trigger: "Sometimes when I load tickets the loader shows the loader out of the number of users (correct) but it loads double the amount"
created: 2026-05-08
updated: 2026-05-08
---

## Symptoms

- expected: Progress counter increments once per user (e.g. 8 users → counts to 8 out of 8)
- actual: Progress counter counts to double the user count (e.g. 7 watched + 1 self = 8 users, but counter reaches 16 out of 8)
- errors: none reported
- timeline: unknown — may have always been this way
- reproduction: load tickets with watched users; observe the progress counter overshoot

## Current Focus

hypothesis: "Two concurrent handleFetch invocations each run the full batch loop, together incrementing batchesDone 2× the expected amount"
test: "Trace all handleFetch call sites; confirm two concurrent calls can occur"
expecting: "A code path exists where handleFetch is called while a prior invocation is still running its async batch loop"
next_action: "confirmed — apply fix"
reasoning_checkpoint: "store.setTickets() sets fetchStatus:'idle' (isLoading→false) before handleFetch finishes its post-fetch per-ticket change detection loop. Any poll-complete event (or React StrictMode double-effect) that arrives in this window sees isLoading=false and re-invokes handleFetch. Both instances run 8 batches each → 16 total batchesDone increments against batchesTotal=8."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-08T00:00:00Z
  observation: "handleFetch calls store.setTickets() at line 243, which sets fetchStatus:'idle' inside ticketStore. This makes isLoading=false immediately."
  file: src/features/tickets/TicketListPage.tsx
  line: 243

- timestamp: 2026-05-08T00:00:00Z
  observation: "After setTickets(), handleFetch continues an async per-ticket change detection loop (lines 251-279) with multiple awaits. Each await yields to the event loop, allowing React to commit the fetchStatus:'idle' re-render."
  file: src/features/tickets/TicketListPage.tsx
  line: 251-279

- timestamp: 2026-05-08T00:00:00Z
  observation: "poll-complete listener at line 339 checks !isLoading to guard against concurrent fetch (WR-03). But once isLoading=false (after setTickets), the guard is no longer effective even though handleFetch is still mid-execution."
  file: src/features/tickets/TicketListPage.tsx
  line: 339-356

- timestamp: 2026-05-08T00:00:00Z
  observation: "React StrictMode (main.tsx line 7) double-invokes effects in development. The mount effect (line 304) calls handleFetch() when lastFetchedAt is set. StrictMode fires this effect twice, causing two concurrent handleFetch calls when running via tauri dev."
  file: src/main.tsx
  line: 7

- timestamp: 2026-05-08T00:00:00Z
  observation: "No useRef guard exists for fetch concurrency. The only guard is !isLoading which is React state — it can be stale in closures and lags behind the actual async execution of handleFetch."
  file: src/features/tickets/TicketListPage.tsx
  line: 89

- timestamp: 2026-05-08T00:00:00Z
  observation: "With 8 batches × 2 concurrent handleFetch calls: 16 batchesDone increments, batchesTotal=8 (last writer wins). Matches the observed '16 out of 8'."

## Eliminated

- Backend emitting duplicate events: only poll-complete is emitted from Rust, and trigger_manual_poll only resets the sleep timer, does not immediately emit poll-complete
- Duplicate ticket data: tickets load correctly with dedup (seenKeys set), so the issue is purely in the counter state
- batchesDone incremented more than once per batch in the loop: setBatchesDone((n) => n + 1) is called exactly once per batch iteration at line 224

## Resolution

root_cause: "handleFetch has no synchronous concurrency guard. store.setTickets() transitions fetchStatus to 'idle' (isLoading→false) while handleFetch is still executing the per-ticket change detection loop. Any concurrent trigger (React StrictMode double-effect, poll-complete event) that fires in this window sees isLoading=false and launches a second handleFetch. Both instances run all 8 batches and both increment batchesDone, giving 16 out of 8."
fix: "Add a fetchInFlightRef = useRef(false) guard. At the start of handleFetch, return early if fetchInFlightRef.current is true; set it true immediately. Clear it in a finally block. This is immune to React state batching delays and prevents any concurrent invocation regardless of trigger source."
verification: "Progress counter shows at most batchesTotal during fetch; never overshoots. Tested by running tauri dev with lastFetchedAt set (StrictMode double-effect path) and with polling enabled."
files_changed: "src/features/tickets/TicketListPage.tsx"
