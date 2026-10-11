# Phase 26: Batch Ticket Fetching per Watched User - Research

**Researched:** 2026-05-06
**Domain:** TypeScript / React / Tauri IPC — frontend fetch orchestration refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Frontend splits — N sequential `invoke('fetch_tickets')` calls, one per watched user plus one for "mine". Existing Tauri command (`fetch_tickets` in `commands.rs:718`) reused unchanged. No new Rust command needed.
- **D-02:** JQL simplified per batch. **"Mine" batch:** `assignee = "me" OR issueKey in watchedIssues()` — drop `comment ~` and `description ~` clauses. **Per watched-user batch:** `assignee = "u.identifier"` only — no mention searches. The existing `buildJql()` in `TicketListPage.tsx:34` is refactored to produce these per-batch strings.
- **D-03:** Wait-for-all rendering — loop through all user batches sequentially, accumulate results, then call `store.setTickets()` once at the end. No incremental store updates mid-fetch.
- **D-04:** Show a live progress counter while loading: **"X/N users fetched"** alongside the existing Loader2 spinner. Track in local component state (not in the store). Total N = 1 ("mine") + number of watched users.
- **D-05:** Sequential fetching — users fetched one at a time in a simple loop. No `Promise.all`, no parallelism, no semaphore.
- **D-06:** Per-user failure tolerance — if one user's batch throws, continue fetching remaining users. After the loop, show partial results from successful batches and surface a warning listing which users failed (e.g., "Fetch failed for 2 users"). Do not abort the whole operation on a single failure.
- **D-07:** Deduplication by ticket key, first-seen wins. As batches accumulate, skip any key already in the merged set. The "mine" batch runs first so its results take precedence. Sorting is applied after merge.
- **D-08 (Claude's Discretion):** `poll_engine.rs` keeps its existing combined JQL. The watermark (`updated >= "<timestamp>"`) already narrows the poll result set enough that timeout risk is low. Per-user watermarks would add complexity outside this phase's scope.

### Claude's Discretion

- Poll engine scope: Keep `poll_engine.rs` unchanged with combined JQL. The timestamp watermark already narrows results sufficiently. Per-user watermarks would add complexity that doesn't serve the phase goal.

### Deferred Ideas (OUT OF SCOPE)

- **Parallel fetching with bounded concurrency** — sequential chosen for now; parallel could be revisited if load times are still slow with a large watch list
- **Poll engine per-user batching** — keeping combined JQL in poll_engine.rs; could be its own phase if timeout issues surface for large watch lists during background polling
- **Per-user fetch config** — custom JQL per watched user; out of scope
</user_constraints>

---

## Summary

Phase 26 is a pure frontend refactor of `handleFetch()` in `TicketListPage.tsx`. The current implementation builds a single combined JQL query, issues one `invoke('fetch_tickets')` call, and renders the result. The new implementation replaces this with a sequential loop: one batch for "mine" (assignee + watchedIssues only), then one batch per watched user (assignee only). Results are accumulated in local variables, deduplicated by key (first-seen wins), then committed to the store in a single `setTickets()` call at the end.

The Rust backend (`fetch_tickets` command, `jira_client.rs`, `poll_engine.rs`) is untouched. All changes are in TypeScript: `buildJql()` is refactored to produce per-batch JQL strings instead of a single combined string, and `handleFetch()` gains a local `batchesDone` / `batchesTotal` counter driving the progress text displayed alongside the existing `Loader2` spinner.

There is one meaningful integration risk: the change-detection loop that follows the fetch (lines 140–181 in `TicketListPage.tsx`) must iterate over the merged final issue list, not a single `result.issues` from one batch. The test contract in `__tests__/TicketListPage.handleFetch.test.tsx` must be extended to cover the multi-batch invoke sequence and the deduplication/merge logic.

**Primary recommendation:** Keep the Rust layer entirely untouched. Confine all changes to `buildJql()`, `handleFetch()`, and the JSX progress counter in `TicketListPage.tsx`, plus i18n keys for the progress text and partial-failure warning.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JQL construction (per-batch) | Frontend (TicketListPage.tsx) | — | `buildJql()` already lives here; splitting into per-batch builders is the same tier |
| Sequential fetch loop | Frontend (TicketListPage.tsx) | — | D-01: no new Rust command; invoke() loop is a TS concern |
| Result accumulation + dedup | Frontend (TicketListPage.tsx) | — | In-memory merge before store commit; no persistence needed |
| Progress counter state | Frontend (TicketListPage.tsx) | — | D-04: local component state, not store |
| Partial-failure warning | Frontend (TicketListPage.tsx) | — | Rendered alongside existing error alert; list of failed user display names |
| Jira HTTP search | Backend (commands.rs / jira_client.rs) | — | `fetch_tickets` Tauri command — reused as-is |
| Triage state update | Backend (commands.rs) | — | Each per-user `fetch_tickets` call updates triage DB; merge happens in frontend |
| Background poll | Backend (poll_engine.rs) | — | Unchanged per D-08 |

---

## Standard Stack

All libraries used in this phase are already in the project. No new dependencies are required.

### Core (all already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@tauri-apps/api` | installed | `invoke()` for Tauri IPC | Used unchanged |
| `react` | installed | `useState`, `useCallback`, `useEffect` | Progress counter via `useState` |
| `zustand` | installed | `useTicketStore` — `setTickets`, `setFetchStatus` | Called once after loop |
| `react-i18next` | installed | `useTranslation` — new i18n keys for progress counter and partial-failure warning | |
| `lucide-react` | installed | `Loader2` spinner — kept; progress text added alongside | |

**Installation:** None required. [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
handleFetch() is called
        │
        ▼
setFetchStatus('loading')
batchesDone = 0
batchesTotal = 1 + watchedUsers.length
mergedIssues = []
seenKeys = Set<string>
failedUsers = []
        │
        ▼
┌──────────────────────────────┐
│  Sequential loop             │
│  ["mine", ...watchedUsers]   │
│                              │
│  for each batch:             │
│    buildBatchJql(user)       │
│          │                   │
│          ▼                   │
│    invoke('fetch_tickets')   │──► Tauri / Jira API
│          │                   │
│    success? ──yes──► merge   │
│          │          into     │
│          │          mergedIssues│
│    error? ──yes──► push to  │
│                    failedUsers│
│                              │
│    batchesDone += 1          │
│    (re-render progress text) │
└──────────────────────────────┘
        │
        ▼
store.setTickets(mergedIssues, mergedTriageMap, totalCount, anyTruncated)
store.setLastFetchedAt(now)
        │
        ▼
change-detection loop over mergedIssues
(fetch_ticket_detail + check_ticket_changes per ticket)
        │
        ▼
invoke('trigger_manual_poll')
        │
        ▼
if failedUsers.length > 0 → surface partial-failure warning
```

### Recommended File Changes

```
src/features/tickets/
├── TicketListPage.tsx      # Primary change target
│                           # - buildJql() split into buildMineBatchJql() + buildUserBatchJql()
│                           # - handleFetch() replaced with sequential batch loop
│                           # - Progress counter state + JSX
│                           # - Partial-failure warning JSX (new alert block)
└── (no other files changed in src/)

src/i18n/locales/
├── en.json                 # New keys: tickets.fetchProgress, tickets.partialFetchWarning
└── sk.json                 # Slovak translations for same keys
```

No changes to `ticketStore.ts`, `types.ts`, `commands.rs`, `jira_client.rs`, or `poll_engine.rs`.

### Pattern 1: Sequential async loop with per-iteration error isolation

The standard pattern in this codebase is `useCallback` + `invoke` inside a try/catch. The batch loop extends this: each `invoke` call is wrapped in its own try/catch so failures are collected rather than re-thrown.

```typescript
// Source: [VERIFIED: codebase — handleFetch pattern in TicketListPage.tsx:116]
const handleFetch = useCallback(async () => {
  const store = useTicketStore.getState();
  store.setFetchStatus('loading');

  const connState = useConnectionStore.getState();
  const serverConn = connState.serverConnection;
  if (!serverConn) {
    store.setFetchStatus('error', 'No server connection');
    return;
  }

  const batches = [
    { label: 'mine', jql: buildMineBatchJql(serverConn.username, connState.sourceProjectKey) },
    ...store.watchedUsers.map((u) => ({
      label: u.displayName,
      jql: buildUserBatchJql(u.identifier, connState.sourceProjectKey),
    })),
  ];

  const total = batches.length;
  // batchesDone is local component state set via setBatchesDone (D-04)

  const mergedIssues: serde_json::Value[] = [];
  const seenKeys = new Set<string>();
  const mergedTriageMap: Record<string, TriageEntry> = {};
  let totalCount = 0;
  let anyTruncated = false;
  const failedUsers: string[] = [];

  for (const batch of batches) {
    try {
      const result = await invoke<FetchTicketsResult>('fetch_tickets', {
        baseUrl: serverConn.baseUrl,
        jql: batch.jql,
      });
      for (const issue of result.issues) {
        if (!seenKeys.has(issue.key)) {
          seenKeys.add(issue.key);
          mergedIssues.push(issue);
        }
      }
      Object.assign(mergedTriageMap, result.triageMap);
      totalCount += result.total;
      if (result.truncated) anyTruncated = true;
    } catch (err) {
      failedUsers.push(batch.label);
    }
    setBatchesDone((n) => n + 1);
  }

  store.setTickets(mergedIssues, mergedTriageMap, totalCount, anyTruncated);
  // ... rest of handleFetch (change detection, trigger_manual_poll)
}, []);
```

### Pattern 2: JQL builders — simplified per D-02

```typescript
// Source: [VERIFIED: codebase — buildJql in TicketListPage.tsx:34 + D-02 from CONTEXT.md]

function buildMineBatchJql(currentUser: string, sourceProjectKey: string | null): string {
  const clause = `assignee = "${currentUser}" OR issueKey in watchedIssues()`;
  if (sourceProjectKey && sourceProjectKey.length > 0) {
    return `project = "${sourceProjectKey}" AND (${clause}) ORDER BY updated DESC`;
  }
  return `(${clause}) ORDER BY updated DESC`;
}

function buildUserBatchJql(identifier: string, sourceProjectKey: string | null): string {
  const clause = `assignee = "${identifier}"`;
  if (sourceProjectKey && sourceProjectKey.length > 0) {
    return `project = "${sourceProjectKey}" AND ${clause} ORDER BY updated DESC`;
  }
  return `${clause} ORDER BY updated DESC`;
}
```

The existing `buildJql()` function is replaced by these two targeted builders. The `custom` preset (raw user JQL) bypasses both; that case stays as a single invoke with the raw JQL string passed directly.

### Pattern 3: Progress counter — local state, not store (D-04)

```typescript
// Source: [VERIFIED: codebase — D-04 from CONTEXT.md, useState pattern throughout TicketListPage]
const [batchesDone, setBatchesDone] = useState(0);
const [batchesTotal, setBatchesTotal] = useState(0);

// Reset at loop start:
setBatchesDone(0);
setBatchesTotal(total);

// JSX alongside existing Loader2:
{isLoading && batchesTotal > 0 && (
  <span className="text-xs text-brand-muted">
    {t('tickets.fetchProgress', { done: batchesDone, total: batchesTotal })}
  </span>
)}
```

### Pattern 4: Partial-failure warning

Follows the existing truncation warning pattern (lines 352–361 in `TicketListPage.tsx`): a yellow alert box rendered conditionally, dismissed once a new fetch begins.

```typescript
// Source: [VERIFIED: codebase — truncation warning pattern in TicketListPage.tsx:352]
{failedUserNames.length > 0 && fetchStatus !== 'loading' && (
  <div className="mx-4 mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3" role="alert">
    <p className="text-sm text-yellow-400">
      {t('tickets.partialFetchWarning', { count: failedUserNames.length })}
    </p>
    <p className="text-xs text-brand-muted mt-1">{failedUserNames.join(', ')}</p>
  </div>
)}
```

`failedUserNames` must be component state (not local-only to `handleFetch`) so it persists for display after the async function returns.

### Anti-Patterns to Avoid

- **Calling `store.setTickets()` inside the loop:** D-03 explicitly requires one call at the end. Intermediate calls would reset `fetchStatus` to `'idle'` (see `ticketStore.ts:91`) and hide the progress counter prematurely.
- **Storing `batchesDone` / `batchesTotal` in Zustand:** D-04 says local component state. The store has no batch-progress concept and the planner should not add one.
- **Calling `store.setFetchStatus('error')` on per-user failure:** D-06 says continue; only surface a warning. The overall fetch succeeds with partial results.
- **Running change-detection over individual batch `result.issues` instead of merged list:** The change-detection loop (lines 140–181) must run once over `mergedIssues` after all batches complete. Running it inside the batch loop would be both redundant and incorrect (ordering/dedup not yet applied at that point).
- **Forgetting to reset `failedUserNames` at the start of a new fetch:** The state must be cleared (`setFailedUserNames([])`) at the beginning of `handleFetch` so stale warnings from the previous run don't persist.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sequential async iteration | custom promise queue | plain `for...of` loop with `await` inside | JS `for...of` + `await` is natively sequential; no library needed |
| Deduplication | custom equality logic | `Set<string>` keyed on `ticket.key` | Ticket keys are already unique Jira identifiers |
| Merge of triage maps | deep merge | `Object.assign(mergedTriageMap, result.triageMap)` | Shallow merge is correct — triage entries are flat objects keyed by ticket key |

**Key insight:** The entire implementation is standard async TypeScript. No new abstractions, utilities, or libraries are warranted.

---

## Common Pitfalls

### Pitfall 1: setTickets() resets fetchStatus to 'idle' mid-loop
**What goes wrong:** `ticketStore.ts:91` sets `fetchStatus: 'idle'` inside `setTickets()`. If called inside the batch loop, the spinner disappears and `isLoading` becomes `false` between batches, causing a UI flicker and breaking the F5 guard (`if (!isLoading) handleFetch()`).
**Why it happens:** The store setter is a convenience that bundles status reset with data update.
**How to avoid:** Call `store.setTickets()` exactly once, after the loop completes. Keep `store.setFetchStatus('loading')` set for the duration of the loop.
**Warning signs:** Spinner disappearing and reappearing between batches; F5 triggering a second fetch while the first is still running.

### Pitfall 2: Change-detection loop iterates over a single batch result
**What goes wrong:** The change-detection `for` loop (TicketListPage.tsx lines 140–181) currently iterates over `result.issues`. After refactor, if `result` references only the last batch, change detection silently skips tickets from earlier batches.
**Why it happens:** Straightforward variable naming collision — the local `result` in the old code becomes one of N batch results in the new code.
**How to avoid:** Run the change-detection loop over `mergedIssues` (the accumulated list), not any individual `result` variable. Place it after the batch loop exits.
**Warning signs:** `check_ticket_changes` call count in tests is lower than total merged ticket count.

### Pitfall 3: failedUserNames state not cleared on re-fetch
**What goes wrong:** User clicks Fetch again after a partial failure. The warning from the previous run remains visible during the new fetch, even if it succeeds.
**Why it happens:** React state from the previous call to `handleFetch` persists across calls unless explicitly reset.
**How to avoid:** `setFailedUserNames([])` at the very top of `handleFetch`, before the loop.
**Warning signs:** Yellow warning visible during loading, or warning from run N still shown after a successful run N+1.

### Pitfall 4: `custom` JQL preset not handled
**What goes wrong:** When `store.jqlPreset === 'custom'`, the batch logic should not run. A single invoke with the raw JQL is the correct behavior (same as today).
**Why it happens:** Refactor focuses on `mine`/`all_watched` presets but forgets the third branch.
**How to avoid:** Add an early-return path: if `preset === 'custom'`, fall through to the original single-invoke path. The batch loop only runs for `mine` and `all_watched`.
**Warning signs:** Custom JQL queries issuing one extra "mine" batch invoke.

### Pitfall 5: `mine` preset with watched users still batches per-user
**What goes wrong:** When `store.jqlPreset === 'mine'`, only the "mine" batch should run (no per-user batches). The watched-user list is irrelevant for this preset.
**Why it happens:** The batch construction reads `store.watchedUsers` unconditionally.
**How to avoid:** For `mine` preset, the batches array contains only the "mine" entry. For `all_watched`, it contains "mine" + one entry per watched user. Encode this as a conditional build of the `batches` array.
**Warning signs:** Extra `fetch_tickets` invocations when preset is `mine`.

### Pitfall 6: `batchesTotal = 0` on first render causing divide-by-zero or empty counter
**What goes wrong:** If `batchesTotal` is initialized as state with `0`, the progress counter renders "0/0 users fetched" briefly before the loop starts.
**Why it happens:** `setBatchesTotal` is called at the start of `handleFetch` but state update is async; the render happens before the update is processed.
**How to avoid:** Only render the progress counter when `isLoading && batchesTotal > 0`. The condition `batchesTotal > 0` prevents the "0/0" flash. Reset to `0` after fetch completes (in the `finally` block or after `setTickets`).

---

## Code Examples

### Existing `setTickets` signature (unchanged)
```typescript
// Source: [VERIFIED: codebase — ticketStore.ts:91]
setTickets: (tickets, triageMap, total, truncated = false) => {
  const safeMap = triageMap ?? {};
  const newCount = Object.values(safeMap).filter((e) => e.state === 'new').length;
  set({
    tickets,
    triageMap: safeMap,
    totalCount: total,
    newCount,
    truncated,
    fetchStatus: 'idle',   // <-- resets status; do NOT call mid-loop
    fetchError: null,
  });
},
```

### Existing invoke pattern for fetch_tickets
```typescript
// Source: [VERIFIED: codebase — TicketListPage.tsx:130]
const result = await invoke<FetchTicketsResult>('fetch_tickets', {
  baseUrl: serverConn.baseUrl,
  jql,
});
// result.issues, result.triageMap, result.total, result.truncated
```

### FetchTicketsResult type (unchanged)
```typescript
// Source: [VERIFIED: codebase — types.ts:158]
export interface FetchTicketsResult {
  issues: JiraTicket[];
  total: number;
  triageMap: Record<string, TriageEntry>;
  truncated: boolean;
}
```

### Existing triage map merge pattern
```typescript
// Source: [VERIFIED: codebase — commands.rs:826 — triage map is a flat key→entry record]
// Frontend merge: shallow assign is correct (no nested structure)
Object.assign(mergedTriageMap, result.triageMap);
```

---

## I18n Keys Required

Two new keys needed in `en.json` and `sk.json`:

```json
// en.json additions
"tickets.fetchProgress": "{{done}}/{{total}} users fetched",
"tickets.partialFetchWarning": "Fetch failed for {{count}} user(s)"
```

The Slovak translations follow the existing `sk.json` pattern with full diacritics.

---

## Validation Architecture

nyquist_validation is enabled (config.json `workflow.nyquist_validation` is absent, treated as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/features/tickets/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Behavior | Test Type | File | Status |
|----------|-----------|------|--------|
| Multiple `fetch_tickets` invocations for `all_watched` preset with N watched users | unit/integration | `TicketListPage.test.tsx` or new handleFetch test | Needs new test |
| "Mine" batch uses simplified JQL (no comment~/description~) | unit | `TicketListPage.test.tsx` — assert JQL string shape | Existing test checks `assignee`; needs assertion on absence of `comment ~` |
| Per-user batch uses `assignee = "identifier"` only | unit | New test or extend handleFetch test | Needs new test |
| Deduplication: ticket appearing in two batches appears once in merged result | unit | New handleFetch test | Needs new test |
| Progress counter text "X/N users fetched" visible during load | component | `TicketListPage.test.tsx` | Needs new test |
| Partial failure: failed user listed in warning; successful batches displayed | component | `TicketListPage.test.tsx` | Needs new test |
| Custom JQL preset: single invoke, no batching | unit | Extend existing test | Needs assertion |
| Mine preset: only 1 invoke (no watched-user batches) | unit | New test | Needs new test |
| Change detection runs over merged list, not single batch result | integration | `__tests__/TicketListPage.handleFetch.test.tsx` | Existing test (`issueKey` contract) needs extension for multi-batch |
| `failedUserNames` cleared at start of re-fetch | unit | New test | Needs new test |

### Wave 0 Gaps

- [ ] New test file or extended cases in `src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx` — covers multi-batch invoke count, dedup, partial failure
- [ ] Extended cases in `src/features/tickets/TicketListPage.test.tsx` — covers progress counter render, custom/mine preset single-invoke fast path

*(Existing test infrastructure covers all other areas — no new config or fixtures needed.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Note |
|---------------|---------|------|
| V5 Input Validation | no | JQL is constructed from stored user identifiers, not free user input in this phase |
| V4 Access Control | no | No new commands or endpoints |

No new security surface introduced. The `fetch_tickets` Tauri command validates credentials internally (PAT from keychain). JQL strings passed to the Rust command are URL-encoded inside the command itself (`urlencoding::encode`). [VERIFIED: codebase — commands.rs:731]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Object.assign(mergedTriageMap, result.triageMap)` correctly merges triage maps — later batches overwrite same keys | Architecture Patterns | If "mine" batch triage state should take precedence over a watched-user batch triage state for the same ticket, first-seen wins must be applied to the triage map too. Likely harmless since both batches call `fetch_tickets` which reads from the same SQLite source; values will be identical. | [ASSUMED] |
| A2 | The `mine` preset should still produce a single invoke (not a "mine" batch + no user batches) when `watchedUsers` is empty | Common Pitfalls | If batches array for `mine` always includes only the "mine" entry regardless of watchedUsers, behavior is correct. | [VERIFIED: CONTEXT.md D-05 + phase description] |

---

## Open Questions

1. **Triage map merge conflict for tickets in multiple batches**
   - What we know: `fetch_tickets` writes triage state to SQLite and returns the full map. If the same ticket appears in two batches (mine + a watched user), both will update SQLite then return the same state.
   - What's unclear: Should "mine" batch triage state win, or is last-write fine?
   - Recommendation: Last-write is fine. Both calls read from the same DB row; the value is idempotent.

2. **`store.jqlPreset` value when preset is `mine` and user has watched users**
   - What we know: D-05 says sequential fetching for `all_watched`; `mine` should only fetch "mine" regardless of watchedUsers list.
   - What's unclear: Roadmap success criterion 3 mentions "progressive rendering" but CONTEXT.md D-03 says wait-for-all. Success criterion 3 is aspirational wording; the CONTEXT decision is authoritative.
   - Recommendation: Treat D-03 (wait-for-all) as the definitive specification.

---

## Environment Availability

Step 2.6: SKIPPED — phase is a pure TypeScript/React code change with no external tool dependencies beyond the existing project build chain.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `src/features/tickets/TicketListPage.tsx` — full file read, `buildJql()` at line 34, `handleFetch()` at line 116, change-detection loop lines 140–181
- [VERIFIED: codebase] `src/features/tickets/ticketStore.ts` — `setTickets()` implementation confirms `fetchStatus: 'idle'` side-effect
- [VERIFIED: codebase] `src-tauri/src/commands.rs` lines 703–843 — `fetch_tickets` Tauri command shape, `FetchTicketsResult` struct
- [VERIFIED: codebase] `src-tauri/src/jira_client.rs` — `MAX_PAGINATION_ITEMS = 1000`, `SEARCH_PAGE_SIZE = 50`
- [VERIFIED: codebase] `src/features/tickets/types.ts` — `FetchTicketsResult`, `WatchedUser`, `JiraTicket` interfaces
- [VERIFIED: codebase] `.planning/phases/26-batch-ticket-fetching-per-watched-user/26-CONTEXT.md` — all locked decisions
- [VERIFIED: codebase] `src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx` — existing IPC contract tests
- [VERIFIED: codebase] `src/features/tickets/TicketListPage.test.tsx` — existing component tests
- [VERIFIED: codebase] `vitest.config.ts` — test framework config
- [VERIFIED: codebase] `src/i18n/locales/en.json` — existing i18n key structure

### Secondary (MEDIUM confidence)
- [ASSUMED: A1] Triage map merge conflict behavior — see Assumptions Log

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified from codebase
- Architecture: HIGH — all change targets read directly; flow derived from CONTEXT.md locked decisions
- Pitfalls: HIGH — derived from direct code analysis (setTickets side-effect, change-detection loop structure, state reset patterns)

**Research date:** 2026-05-06
**Valid until:** Stable — this phase's scope is narrow and the codebase is the primary source
