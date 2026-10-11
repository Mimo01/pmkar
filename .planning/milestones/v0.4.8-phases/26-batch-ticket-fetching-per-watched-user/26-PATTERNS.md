# Phase 26: Batch Ticket Fetching per Watched User - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 4 (2 modified, 2 i18n additions)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/tickets/TicketListPage.tsx` | component | request-response | itself (lines 34–188) | exact — primary change target |
| `src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx` | test | request-response | itself (lines 1–169) | exact — extend existing file |
| `src/i18n/locales/en.json` | config | — | itself (lines 391–393, truncation key block) | exact |
| `src/i18n/locales/sk.json` | config | — | `src/i18n/locales/en.json` same key block | role-match |

---

## Pattern Assignments

### `src/features/tickets/TicketListPage.tsx` (component, request-response)

**Analog:** `src/features/tickets/TicketListPage.tsx` (the file being modified)

All patterns below come from the existing file; the planner copies and extends them.

---

#### Imports pattern (lines 1–14)

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '../../lib/format';
import { useConnectionStore } from '../connections/connectionStore';
import { SkeletonCards, TicketCard } from './TicketCard';
import { TicketFilterBar } from './TicketFilterBar';
import { useTicketStore } from './ticketStore';
import type { FetchTicketsResult, JqlPreset } from './types';
import { isDoneTicket } from './utils';
```

No new imports are needed. `useState` is already imported and will be used for the new `batchesDone`, `batchesTotal`, and `failedUserNames` state variables.

---

#### JQL builder pattern — existing `buildJql` to replace (lines 34–68)

```typescript
// EXISTING — to be replaced by two targeted builders (D-02)
function buildJql(
  preset: JqlPreset,
  custom: string | null,
  watchedUsers: { identifier: string }[],
  currentUser: string,
  sourceProjectKey: string | null,
): string {
  if (preset === 'custom' && custom) return custom;

  const mineClauses = [
    `assignee = "${currentUser}"`,
    `comment ~ "${currentUser}"`,
    `description ~ "${currentUser}"`,
    `issueKey in watchedIssues()`,
  ];

  let peopleClause: string;
  if (preset === 'all_watched' && watchedUsers.length > 0) {
    const watchedClauses = watchedUsers.flatMap((u) => [
      `assignee = "${u.identifier}"`,
      `comment ~ "${u.identifier}"`,
      `description ~ "${u.identifier}"`,
    ]);
    peopleClause = `${mineClauses.join(' OR ')} OR ${watchedClauses.join(' OR ')}`;
  } else {
    peopleClause = mineClauses.join(' OR ');
  }

  if (sourceProjectKey && sourceProjectKey.length > 0) {
    return `project = "${sourceProjectKey}" AND (${peopleClause}) ORDER BY updated DESC`;
  }
  return `(${peopleClause}) ORDER BY updated DESC`;
}
```

**Replace with** (D-02 — simplified per-batch builders):

```typescript
// NEW: "mine" batch — assignee + watchedIssues() only; no comment~/description~ clauses
function buildMineBatchJql(currentUser: string, sourceProjectKey: string | null): string {
  const clause = `assignee = "${currentUser}" OR issueKey in watchedIssues()`;
  if (sourceProjectKey && sourceProjectKey.length > 0) {
    return `project = "${sourceProjectKey}" AND (${clause}) ORDER BY updated DESC`;
  }
  return `(${clause}) ORDER BY updated DESC`;
}

// NEW: per watched-user batch — assignee only
function buildUserBatchJql(identifier: string, sourceProjectKey: string | null): string {
  const clause = `assignee = "${identifier}"`;
  if (sourceProjectKey && sourceProjectKey.length > 0) {
    return `project = "${sourceProjectKey}" AND ${clause} ORDER BY updated DESC`;
  }
  return `${clause} ORDER BY updated DESC`;
}
```

The project-scope wrapping pattern (lines 64–67) is preserved verbatim in both new builders.

---

#### Local state — progress counter and failure list (new, follows existing `useState` pattern)

Existing analog for local state (line 110):
```typescript
const [, setTick] = useState(0);
```

New state to add alongside existing state declarations (lines 91–106):
```typescript
const [batchesDone, setBatchesDone] = useState(0);
const [batchesTotal, setBatchesTotal] = useState(0);
const [failedUserNames, setFailedUserNames] = useState<string[]>([]);
```

---

#### Core `handleFetch` pattern — existing single-invoke (lines 116–188)

```typescript
// EXISTING (lines 116–188) — full body shown; replace internals per D-01 through D-07
const handleFetch = useCallback(async () => {
  const store = useTicketStore.getState();
  store.setFetchStatus('loading');
  try {
    const connState = useConnectionStore.getState();
    const serverConn = connState.serverConnection;
    if (!serverConn) throw new Error('No server connection');
    const jql = buildJql(
      store.jqlPreset,
      store.jqlCustom,
      store.watchedUsers,
      serverConn.username,
      connState.sourceProjectKey,
    );
    const result = await invoke<FetchTicketsResult>('fetch_tickets', {
      baseUrl: serverConn.baseUrl,
      jql,
    });
    store.setTickets(result.issues, result.triageMap, result.total, result.truncated);
    const now = new Date().toISOString();
    store.setLastFetchedAt(now);
    store.setLastCheckedAt(now);

    // change-detection loop (lines 140–181) — must iterate mergedIssues after refactor
    for (const ticket of result.issues) {
      try {
        const detail = await invoke<unknown>('fetch_ticket_detail', {
          baseUrl: serverConn.baseUrl,
          issueKey: ticket.key,   // <-- must stay `issueKey` (not ticketKey)
        });
        const changes = await invoke<
          { field: string; oldValue: string | null; newValue: string | null }[]
        >('check_ticket_changes', {
          ticketKey: ticket.key,
          responseJson: JSON.stringify(detail),
        });
        if (changes.length > 0) {
          store.setUnseenChange(ticket.key, changes.map((c) => c.field));
        }
      } catch (err) {
        console.error(`[manual-fetch] change detection failed for ${ticket.key}:`, err);
      }
    }

    invoke<string[]>('get_unseen_change_keys')
      .then((keys) => {
        for (const key of keys) {
          if (!store.unseenChanges[key]) store.setUnseenChange(key, []);
        }
      })
      .catch(() => {});

    invoke('trigger_manual_poll').catch(() => {});
  } catch (err) {
    store.setFetchStatus('error', err instanceof Error ? err.message : String(err));
  }
}, []);
```

**Replace inner try block with** (D-01, D-03, D-05, D-06, D-07):

```typescript
const handleFetch = useCallback(async () => {
  const store = useTicketStore.getState();
  store.setFetchStatus('loading');

  // Reset batch progress and prior failure state (Pitfall 3)
  setFailedUserNames([]);
  setBatchesDone(0);

  try {
    const connState = useConnectionStore.getState();
    const serverConn = connState.serverConnection;
    if (!serverConn) throw new Error('No server connection');

    const preset = store.jqlPreset;

    // Fast path: custom JQL — single invoke, no batching (Pitfall 4)
    if (preset === 'custom' && store.jqlCustom) {
      const result = await invoke<FetchTicketsResult>('fetch_tickets', {
        baseUrl: serverConn.baseUrl,
        jql: store.jqlCustom,
      });
      store.setTickets(result.issues, result.triageMap, result.total, result.truncated);
      // ... (change detection over result.issues, setLastFetchedAt, trigger_manual_poll)
      return;
    }

    // Build batch list (Pitfall 5: mine preset uses only the "mine" batch)
    const batches: { label: string; jql: string }[] = [
      {
        label: 'mine',
        jql: buildMineBatchJql(serverConn.username, connState.sourceProjectKey),
      },
      ...(preset === 'all_watched'
        ? store.watchedUsers.map((u) => ({
            label: u.displayName,
            jql: buildUserBatchJql(u.identifier, connState.sourceProjectKey),
          }))
        : []),
    ];

    setBatchesTotal(batches.length);

    const mergedIssues: import('./types').JiraTicket[] = [];
    const seenKeys = new Set<string>();
    const mergedTriageMap: Record<string, import('./types').TriageEntry> = {};
    let totalCount = 0;
    let anyTruncated = false;
    const localFailedUsers: string[] = [];

    // Sequential loop — D-05 (no Promise.all)
    for (const batch of batches) {
      try {
        const result = await invoke<FetchTicketsResult>('fetch_tickets', {
          baseUrl: serverConn.baseUrl,
          jql: batch.jql,
        });
        // Dedup: first-seen wins (D-07)
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
        // Per-user failure tolerance — D-06
        localFailedUsers.push(batch.label);
      }
      setBatchesDone((n) => n + 1);
    }

    if (localFailedUsers.length > 0) {
      setFailedUserNames(localFailedUsers);
    }

    // Single setTickets call after loop — D-03 (avoids fetchStatus reset mid-loop)
    store.setTickets(mergedIssues, mergedTriageMap, totalCount, anyTruncated);

    const now = new Date().toISOString();
    store.setLastFetchedAt(now);
    store.setLastCheckedAt(now);

    // Change-detection loop over mergedIssues (not individual batch result — Pitfall 2)
    for (const ticket of mergedIssues) {
      try {
        const detail = await invoke<unknown>('fetch_ticket_detail', {
          baseUrl: serverConn.baseUrl,
          issueKey: ticket.key,   // must stay `issueKey` (regression guard)
        });
        const changes = await invoke<
          { field: string; oldValue: string | null; newValue: string | null }[]
        >('check_ticket_changes', {
          ticketKey: ticket.key,
          responseJson: JSON.stringify(detail),
        });
        if (changes.length > 0) {
          store.setUnseenChange(ticket.key, changes.map((c) => c.field));
        }
      } catch (err) {
        console.error(`[manual-fetch] change detection failed for ${ticket.key}:`, err);
      }
    }

    invoke<string[]>('get_unseen_change_keys')
      .then((keys) => {
        for (const key of keys) {
          if (!store.unseenChanges[key]) store.setUnseenChange(key, []);
        }
      })
      .catch(() => {});

    invoke('trigger_manual_poll').catch(() => {});

    // Reset progress counter after fetch completes (Pitfall 6)
    setBatchesTotal(0);
  } catch (err) {
    store.setFetchStatus('error', err instanceof Error ? err.message : String(err));
  }
}, []);
```

---

#### Progress counter JSX — follows existing Loader2 pattern (lines 316–317)

Existing spinner in JSX (lines 316–317):
```tsx
{isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
{isLoading ? t('tickets.fetching') : t('tickets.fetchButton')}
```

Add progress counter alongside spinner (inside the same FetchBar `<div>`, after the button):
```tsx
{/* Progress counter — only when batchesTotal > 0 prevents "0/0" flash (Pitfall 6) */}
{isLoading && batchesTotal > 0 && (
  <span className="text-xs text-brand-muted" aria-live="polite">
    {t('tickets.fetchProgress', { done: batchesDone, total: batchesTotal })}
  </span>
)}
```

---

#### Partial-failure warning JSX — follows truncation warning pattern (lines 352–361)

Existing truncation warning (lines 352–361):
```tsx
{truncated && fetchStatus !== 'error' && (
  <div
    className="mx-4 mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3"
    role="alert"
    data-testid="truncation-warning"
  >
    <p className="text-sm text-yellow-400">{t('tickets.truncationWarning')}</p>
    <p className="text-xs text-brand-muted mt-1">{t('tickets.truncationWarningHint')}</p>
  </div>
)}
```

New partial-failure warning — insert immediately after truncation warning block, same structure:
```tsx
{failedUserNames.length > 0 && fetchStatus !== 'loading' && (
  <div
    className="mx-4 mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3"
    role="alert"
    data-testid="partial-fetch-warning"
  >
    <p className="text-sm text-yellow-400">
      {t('tickets.partialFetchWarning', { count: failedUserNames.length })}
    </p>
    <p className="text-xs text-brand-muted mt-1">{failedUserNames.join(', ')}</p>
  </div>
)}
```

---

### `src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx` (test, request-response)

**Analog:** `src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx` (extend existing file)

---

#### Test file structure pattern (lines 1–38)

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../connections/connectionStore';
import { TicketListPage } from '../TicketListPage';
import { useTicketStore } from '../ticketStore';
import type { FetchTicketsResult, JiraTicket } from '../types';

const mockInvoke = vi.mocked(invoke);
```

---

#### Factory helpers pattern (lines 17–38)

```typescript
function makeTicket(key: string): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: { name: 'In Progress', id: '3' },
      priority: { name: 'High', id: '2' },
      assignee: { displayName: 'Alice', accountId: 'alice123' },
      updated: '2024-06-01T00:00:00.000Z',
    },
  };
}

function makeFetchResult(keys: string[], truncated = false): FetchTicketsResult {
  return {
    issues: keys.map(makeTicket),
    total: keys.length,
    triageMap: Object.fromEntries(keys.map((k) => [k, { state: 'new', copiedKey: null }])),
    truncated,
  };
}
```

---

#### `beforeEach` reset pattern (lines 41–72)

```typescript
beforeEach(() => {
  mockInvoke.mockReset();

  useConnectionStore.setState({
    serverConnection: {
      baseUrl: 'http://server.example.com',
      username: 'testuser',
      serverVersion: '9.0.0',
      lastTestedAt: '2024-01-01T00:00:00.000Z',
      status: 'ok',
    },
    cloudConnection: null,
  });

  useTicketStore.setState({
    tickets: [],
    triageMap: {},
    selectedTicketKey: null,
    fetchStatus: 'idle',
    fetchError: null,
    lastFetchedAt: null,
    lastCheckedAt: null,
    pollFrequency: 'off',
    totalCount: 0,
    newCount: 0,
    truncated: false,
    jqlPreset: 'mine',
    jqlCustom: null,
    watchedUsers: [],
    unseenChanges: {},
  } as unknown as Parameters<typeof useTicketStore.setState>[0]);
});
```

For multi-batch tests, set `jqlPreset: 'all_watched'` and `watchedUsers: [{ identifier: 'user1@...', displayName: 'User One', accountId: '...' }]` in `beforeEach` or per-test overrides.

---

#### Core test body pattern (lines 90–131)

```typescript
it('invokes fetch_ticket_detail with issueKey (not ticketKey) for every fetched ticket', async () => {
  const fetchResult = makeFetchResult(['PROJ-1', 'PROJ-2']);
  const detailJson = { id: '1', key: 'PROJ-1', fields: {} };

  mockInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'get_triage_state') return {};
    if (cmd === 'get_fetch_config')
      return { jqlPreset: 'mine', jqlCustom: null, watchedUsers: [], lastFetchedAt: null };
    if (cmd === 'get_unseen_change_keys') return [];
    if (cmd === 'fetch_tickets') return fetchResult;
    if (cmd === 'fetch_ticket_detail') return detailJson;
    if (cmd === 'check_ticket_changes') return [];
    if (cmd === 'trigger_manual_poll') return null;
    return null;
  });

  render(<TicketListPage />);
  const button = await screen.findByTitle('Refresh (F5)');
  fireEvent.click(button);

  await waitFor(() => {
    const detailCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_ticket_detail');
    expect(detailCalls.length).toBe(2);
  });
  // ... assertions
});
```

For multi-batch tests, the `mockImplementation` must handle multiple `fetch_tickets` calls. Use `mockInvoke.mockResolvedValueOnce` sequences or a call-count–aware implementation:

```typescript
// Pattern for ordered per-batch mock responses
let fetchCount = 0;
mockInvoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
  if (cmd === 'get_triage_state') return {};
  if (cmd === 'get_fetch_config')
    return { jqlPreset: 'all_watched', jqlCustom: null, watchedUsers: [watchedUser], lastFetchedAt: null };
  if (cmd === 'get_unseen_change_keys') return [];
  if (cmd === 'fetch_tickets') {
    fetchCount += 1;
    if (fetchCount === 1) return makeFetchResult(['MINE-1']); // "mine" batch
    return makeFetchResult(['USER-1']);                        // watched-user batch
  }
  if (cmd === 'fetch_ticket_detail') return {};
  if (cmd === 'check_ticket_changes') return [];
  if (cmd === 'trigger_manual_poll') return null;
  return null;
});
```

---

### `src/i18n/locales/en.json` (config)

**Analog:** Lines 391–393 in `src/i18n/locales/en.json` — existing truncation warning key block:

```json
"tickets.truncationWarning": "Result set truncated",
"tickets.truncationWarningHint": "Your query returned more tickets than the maximum supported. Some tickets are not shown — tighten your JQL to narrow the results.",
```

**Add after the existing truncation keys** (same flat JSON object, no nesting):

```json
"tickets.fetchProgress": "{{done}}/{{total}} users fetched",
"tickets.partialFetchWarning": "Fetch failed for {{count}} user(s)"
```

---

### `src/i18n/locales/sk.json` (config)

**Analog:** `src/i18n/locales/en.json` for key structure; `src/i18n/locales/sk.json` for Slovak style (lines 1–30 show diacritic conventions).

**Add matching Slovak keys at the same position in sk.json:**

```json
"tickets.fetchProgress": "{{done}}/{{total}} používateľov načítaných",
"tickets.partialFetchWarning": "Načítanie zlyhalo pre {{count}} používateľa/ov"
```

---

## Shared Patterns

### Invoke call pattern
**Source:** `src/features/tickets/TicketListPage.tsx` lines 130–133
**Apply to:** Both the "mine" batch fast path and every iteration of the sequential batch loop
```typescript
const result = await invoke<FetchTicketsResult>('fetch_tickets', {
  baseUrl: serverConn.baseUrl,
  jql,
});
// result.issues, result.triageMap, result.total, result.truncated
```

### `setTickets` signature and side-effect
**Source:** `src/features/tickets/ticketStore.ts` lines 91–103
**Apply to:** The single post-loop `store.setTickets()` call
```typescript
setTickets: (tickets, triageMap, total, truncated = false) => {
  // ...
  set({ fetchStatus: 'idle', fetchError: null, ... });  // resets status — do NOT call mid-loop
}
```

### Alert block styling
**Source:** `src/features/tickets/TicketListPage.tsx` lines 352–361
**Apply to:** Partial-failure warning block
```tsx
className="mx-4 mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3"
role="alert"
// heading: text-sm text-yellow-400
// body:    text-xs text-brand-muted mt-1
```

### `useCallback` with empty deps
**Source:** `src/features/tickets/TicketListPage.tsx` line 188
**Apply to:** Refactored `handleFetch` — keep `[]` as dependency array; all accessed state is read via `.getState()` inside the callback
```typescript
}, []);
```

---

## No Analog Found

All files in scope have direct analogs in the codebase. No file requires falling back to RESEARCH.md patterns exclusively.

---

## Anti-Pattern Notes for Planner

These are confirmed codebase-specific pitfalls (sourced from RESEARCH.md + direct code read):

| Anti-Pattern | Why It Breaks | File Reference |
|---|---|---|
| Call `store.setTickets()` inside the batch loop | `ticketStore.ts:100` resets `fetchStatus: 'idle'` — hides spinner mid-loop | `ticketStore.ts` lines 91–103 |
| Iterate `result.issues` in change-detection after refactor | After refactor, `result` is one batch; earlier batches are skipped | `TicketListPage.tsx` lines 140–169 |
| Forget `setFailedUserNames([])` at start of `handleFetch` | Stale warning from previous run persists into next fetch | `TicketListPage.tsx` lines 116–118 |
| Render `{isLoading && batchesTotal > 0 ... }` without the `> 0` guard | Flashes "0/0 users fetched" before `setBatchesTotal` state update lands | JSX pattern from lines 316–317 |
| Run batch loop for `custom` preset | Custom JQL is a single raw string — wrap in early-return single-invoke fast path | `TicketListPage.tsx` lines 41 |
| Run watched-user batches for `mine` preset | `mine` should issue exactly 1 `fetch_tickets` call | `TicketListPage.tsx` lines 52–61 |

---

## Metadata

**Analog search scope:** `src/features/tickets/`, `src/i18n/locales/`
**Files read:** 5 (`TicketListPage.tsx`, `ticketStore.ts`, `TicketListPage.handleFetch.test.tsx`, `en.json`, `sk.json`)
**Pattern extraction date:** 2026-05-06
