import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../connections/connectionStore';
import { useGroupStore } from '../../groups/groupStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../fetchSignature';
import { TicketListPage } from '../TicketListPage';
import { useTicketStore } from '../ticketStore';
import type { FetchTicketsResult, JiraTicket } from '../types';

const mockInvoke = vi.mocked(invoke);

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

function deferred<T>() {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

const u1 = { identifier: 'u1@example.com', displayName: 'User One', accountId: 'u1id' };
const u2 = { identifier: 'u2@example.com', displayName: 'User Two', accountId: 'u2id' };

describe('TicketListPage — manual fetch change-detection IPC contract', () => {
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

  /**
   * Regression test for the silent IPC parameter mismatch that caused
   * manual fetch to never run change detection.
   *
   * Background: the Tauri command `fetch_ticket_detail` declares
   * `issue_key: String` in Rust. Tauri exposes it to JS as `issueKey`
   * (camelCased). An earlier version of `handleFetch` mistakenly passed
   * `ticketKey`, which Tauri rejected as a deserialization error. The
   * surrounding bare `try/catch` swallowed the rejection silently, so
   * `check_ticket_changes` was never called for any ticket on a manual
   * fetch — even though the auto-poll path (which uses Rust-internal
   * calls) worked correctly.
   *
   * If this test fails, the manual-fetch button is silently broken again.
   * See: .planning/debug/manual-fetch-misses-changes.md
   */
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

    // Click the fetch button
    const button = await screen.findByTitle('Refresh (F5)');
    fireEvent.click(button);

    // Wait until both per-ticket detail invocations land
    await waitFor(() => {
      const detailCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_ticket_detail');
      expect(detailCalls.length).toBe(2);
    });

    const detailCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_ticket_detail');

    for (const [, payload] of detailCalls) {
      // The payload MUST use `issueKey` — Tauri's camelCase of Rust `issue_key`.
      // If this regresses to `ticketKey`, manual fetch silently stops detecting changes.
      expect(payload).toHaveProperty('issueKey');
      expect(payload).not.toHaveProperty('ticketKey');
      expect(payload).toHaveProperty('baseUrl', 'http://server.example.com');
    }

    // Sanity: the keys passed match the fetched tickets.
    const issueKeys = detailCalls.map(([, p]) => (p as { issueKey: string }).issueKey).sort();
    expect(issueKeys).toEqual(['PROJ-1', 'PROJ-2']);
  });

  /**
   * Companion test: after the detail fetches succeed, change detection
   * MUST be invoked for each ticket. Previously this never ran because
   * the detail invoke rejected on the wrong field name and the catch
   * swallowed it.
   */
  it('invokes check_ticket_changes for every fetched ticket after detail fetch succeeds', async () => {
    const fetchResult = makeFetchResult(['PROJ-A', 'PROJ-B', 'PROJ-C']);
    const detailJson = { id: '1', key: 'PROJ-A', fields: {} };

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
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const checkCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'check_ticket_changes');
      expect(checkCalls.length).toBe(3);
    });

    const checkKeys = mockInvoke.mock.calls
      .filter(([cmd]) => cmd === 'check_ticket_changes')
      .map(([, p]) => (p as { ticketKey: string }).ticketKey)
      .sort();
    expect(checkKeys).toEqual(['PROJ-A', 'PROJ-B', 'PROJ-C']);
  });
});

describe('TicketListPage — per-user batch fetching (D-01, D-02, D-05, D-07)', () => {
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

  it('all_watched preset issues exactly 1 + N fetch_tickets calls (D-01, D-05)', async () => {
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      watchedUsers: [u1, u2],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) return makeFetchResult(['U1-1']);
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(3);
    });
  });

  it('all_watched preset issues "mine" batch first, then watched users in order', async () => {
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      watchedUsers: [u1, u2],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) return makeFetchResult(['U1-1']);
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(3);
    });

    const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
    const jqls = fetchCalls.map(([, args]) => (args as { jql: string }).jql);

    // call[0]: mine batch — must contain assignee testuser AND watchedIssues()
    expect(jqls[0]).toContain('assignee = "testuser"');
    expect(jqls[0]).toContain('watchedIssues()');

    // call[1]: u1 batch — must contain u1 identifier but NOT watchedIssues()
    expect(jqls[1]).toContain('assignee = "u1@example.com"');
    expect(jqls[1]).not.toContain('watchedIssues()');

    // call[2]: u2 batch — must contain u2 identifier
    expect(jqls[2]).toContain('assignee = "u2@example.com"');
  });

  it('mine batch JQL drops comment~ and description~ clauses (D-02)', async () => {
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      watchedUsers: [u1, u2],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) return makeFetchResult(['U1-1']);
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(3);
    });

    const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
    const mineJql = (fetchCalls[0][1] as { jql: string }).jql;

    expect(mineJql).not.toContain('comment ~');
    expect(mineJql).not.toContain('description ~');
  });

  it('per-user batch JQL contains only assignee = identifier (D-02)', async () => {
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      watchedUsers: [u1, u2],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) return makeFetchResult(['U1-1']);
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(3);
    });

    const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
    const u1Jql = (fetchCalls[1][1] as { jql: string }).jql;

    expect(u1Jql).not.toContain('watchedIssues()');
    expect(u1Jql).not.toContain('comment ~');
    expect(u1Jql).not.toContain('description ~');
  });

  it('mine preset issues exactly 1 fetch_tickets call regardless of watchedUsers (Pitfall 5)', async () => {
    useTicketStore.setState({
      jqlPreset: 'mine',
      watchedUsers: [u1, u2],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'mine',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') return makeFetchResult(['MINE-1']);
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(1);
    });

    const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
    const jql = (fetchCalls[0][1] as { jql: string }).jql;

    expect(jql).toContain('assignee = "testuser"');
    expect(jql).toContain('watchedIssues()');
    expect(jql).not.toContain('assignee = "u1@example.com"');
  });

  it('custom preset issues exactly 1 fetch_tickets call with raw jqlCustom string (Pitfall 4)', async () => {
    const customJql = 'project = "X" AND key = "X-1"';
    useTicketStore.setState({
      jqlPreset: 'custom',
      jqlCustom: customJql,
      watchedUsers: [u1, u2],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'custom',
          jqlCustom: customJql,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') return makeFetchResult(['X-1']);
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(1);
    });

    const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
    const jql = (fetchCalls[0][1] as { jql: string }).jql;

    // Must use verbatim custom JQL string
    expect(jql).toBe(customJql);
  });

  it('deduplication first-seen wins — ticket appearing in two batches appears once in merged setTickets call (D-07)', async () => {
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      watchedUsers: [u1],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['DUPE-1', 'MINE-1']);
        return makeFetchResult(['DUPE-1', 'USER-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(2);
    });

    await waitFor(() => {
      const keys = useTicketStore.getState().tickets.map((t) => t.key);
      // DUPE-1 from first batch, MINE-1 from first batch, USER-1 from second batch
      // DUPE-1 from second batch is dropped (first-seen wins)
      expect(keys).toContain('DUPE-1');
      expect(keys).toContain('MINE-1');
      expect(keys).toContain('USER-1');
      expect(keys.filter((k) => k === 'DUPE-1').length).toBe(1);
    });
  });

  it('setTickets called exactly once per handleFetch (Pitfall 1)', async () => {
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      watchedUsers: [u1, u2],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    let fetchCount = 0;
    // Track 'loading' → 'idle' transitions (each setTickets call resets to 'idle')
    let loadingToIdleTransitions = 0;
    let prevStatus = useTicketStore.getState().fetchStatus;
    const unsubscribe = useTicketStore.subscribe((state) => {
      if (prevStatus === 'loading' && state.fetchStatus === 'idle') {
        loadingToIdleTransitions += 1;
      }
      prevStatus = state.fetchStatus;
    });

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) return makeFetchResult(['U1-1']);
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(3);
    });

    await waitFor(() => {
      expect(useTicketStore.getState().fetchStatus).toBe('idle');
    });

    unsubscribe();

    // setTickets resets fetchStatus from 'loading' to 'idle' — should happen exactly once
    expect(loadingToIdleTransitions).toBe(1);
  });
});

describe('TicketListPage — partial failure tolerance (D-06)', () => {
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
      jqlPreset: 'all_watched',
      jqlCustom: null,
      watchedUsers: [u1, u2],
      unseenChanges: {},
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);
  });

  it('one batch failure does not abort remaining batches', async () => {
    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) throw new Error('u1 batch failed');
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // All 3 fetch_tickets calls were attempted (mine + u1 + u2)
    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(3);
    });

    // Store has tickets from mine and u2 batches
    await waitFor(() => {
      const keys = useTicketStore.getState().tickets.map((t) => t.key);
      expect(keys).toContain('MINE-1');
      expect(keys).toContain('U2-1');
    });
  });

  it('partial-failure warning lists failed user displayName', async () => {
    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) throw new Error('u1 batch failed');
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // Warning banner must appear after fetch completes
    const warning = await screen.findByTestId('partial-fetch-warning');
    expect(warning).toBeInTheDocument();

    // Failed user's displayName appears; succeeded user's does not
    expect(warning.textContent).toContain('User One');
    expect(warning.textContent).not.toContain('User Two');
  });

  it('failedUserNames cleared at start of new fetch (Pitfall 3)', async () => {
    let run = 0;
    let fetchCount = 0;

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        // Run 1: mine ok, u1 fails, u2 ok
        if (run === 1) {
          const localCount = fetchCount - runStartCount;
          if (localCount === 1) return makeFetchResult(['MINE-1']);
          if (localCount === 2) throw new Error('u1 batch failed');
          return makeFetchResult(['U2-1']);
        }
        // Run 2: all succeed
        return makeFetchResult(['SUCCESS-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    let runStartCount = 0;

    render(<TicketListPage />);

    // First fetch — triggers partial failure
    run = 1;
    runStartCount = 0;
    fetchCount = 0;
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // Warning appears
    await screen.findByTestId('partial-fetch-warning');

    // Second fetch — all succeed
    run = 2;
    runStartCount = fetchCount;
    fireEvent.click(screen.getByTitle('Refresh (F5)'));

    // Warning must disappear after second fetch resolves
    await waitFor(() => {
      expect(screen.queryByTestId('partial-fetch-warning')).toBeNull();
    });
  });
});

describe('TicketListPage — progress counter (D-04)', () => {
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
      jqlPreset: 'all_watched',
      jqlCustom: null,
      watchedUsers: [u1, u2],
      unseenChanges: {},
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);
  });

  it('progress counter renders <done>/<total> users fetched while loading', async () => {
    const secondBatchDeferred = deferred<FetchTicketsResult>();

    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) return secondBatchDeferred.promise;
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // While second batch is pending, progress counter element should be visible
    // (batchesTotal > 0 is set after batches array is built)
    await screen.findByTestId('fetch-progress');

    // Resolve the deferred to let the fetch complete
    secondBatchDeferred.resolve(makeFetchResult(['U1-1']));

    // Wait for fetch to finish
    await waitFor(() => {
      expect(useTicketStore.getState().fetchStatus).toBe('idle');
    });
  });

  it('progress counter disappears after fetch completes (Pitfall 6)', async () => {
    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['MINE-1']);
        if (fetchCount === 2) return makeFetchResult(['U1-1']);
        return makeFetchResult(['U2-1']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // Wait for all 3 fetch_tickets calls to complete
    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(3);
    });

    await waitFor(() => {
      expect(useTicketStore.getState().fetchStatus).toBe('idle');
    });

    // Progress counter element must be gone after fetch completes (batchesTotal reset to 0)
    await waitFor(() => {
      expect(screen.queryByTestId('fetch-progress')).toBeNull();
    });
  });
});

describe('TicketListPage — change detection over merged list (Pitfall 2 + regression guard)', () => {
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
      jqlPreset: 'all_watched',
      jqlCustom: null,
      watchedUsers: [u1, u2],
      unseenChanges: {},
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);
  });

  it('fetch_ticket_detail is invoked once per merged ticket, not per batch', async () => {
    let fetchCount = 0;
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [u1, u2],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        if (fetchCount === 1) return makeFetchResult(['M-1']);
        if (fetchCount === 2) return makeFetchResult(['U-1']);
        return makeFetchResult(['U-2']);
      }
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // 3 tickets total (one per batch), so 3 detail calls
    await waitFor(() => {
      const detailCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_ticket_detail');
      expect(detailCalls.length).toBe(3);
    });

    const detailKeys = mockInvoke.mock.calls
      .filter(([cmd]) => cmd === 'fetch_ticket_detail')
      .map(([, args]) => (args as { issueKey: string }).issueKey)
      .sort();

    expect(detailKeys).toEqual(['M-1', 'U-1', 'U-2']);
  });

  it('regression guard — all_watched with empty watchedUsers still executes mine batch only', async () => {
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      watchedUsers: [],
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);

    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'all_watched',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') return makeFetchResult(['MINE-1']);
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBe(1);
    });

    // fetch_ticket_detail invoked with issueKey (regression guard)
    await waitFor(() => {
      const detailCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_ticket_detail');
      expect(detailCalls.length).toBe(1);
    });

    const detailCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_ticket_detail');
    expect(detailCalls[0][1]).toHaveProperty('issueKey');
    expect(detailCalls[0][1]).not.toHaveProperty('ticketKey');
  });
});

describe('TicketListPage — fetch completeness and snapshot refresh (D-12, D-13, D-15, GDUR-01)', () => {
  type FetchImpl = (n: number) => FetchTicketsResult | Promise<FetchTicketsResult>;
  let refreshImpl: () => Promise<number>;

  function setup(impl: FetchImpl) {
    let fetchCount = 0;
    const cfg = useTicketStore.getState();
    const fetchConfig = {
      jqlPreset: cfg.jqlPreset,
      jqlCustom: cfg.jqlCustom,
      watchedUsers: cfg.watchedUsers,
      lastFetchedAt: null,
    };
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config') return fetchConfig;
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') {
        fetchCount += 1;
        return impl(fetchCount);
      }
      if (cmd === 'refresh_group_snapshots') return refreshImpl();
      if (cmd === 'fetch_ticket_detail') return {};
      if (cmd === 'check_ticket_changes') return [];
      return null;
    });
  }

  function seed(partial: Record<string, unknown>) {
    useTicketStore.setState(partial as unknown as Parameters<typeof useTicketStore.setState>[0]);
  }

  async function clickFetch() {
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));
  }

  function sigNow() {
    return computeFetchSignature(
      currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
    );
  }

  function refreshCalls() {
    return mockInvoke.mock.calls.filter(([cmd]) => cmd === 'refresh_group_snapshots');
  }

  beforeEach(() => {
    mockInvoke.mockReset();
    refreshImpl = async () => 1;
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
    seed({
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
      lastCompleteFetchSignature: null,
    });
    useGroupStore.setState({ groupIdsByIssue: { 'AB-1': [1] } } as unknown as Parameters<
      typeof useGroupStore.setState
    >[0]);
  });

  afterEach(() => {
    useGroupStore.setState({ groupIdsByIssue: {} } as unknown as Parameters<
      typeof useGroupStore.setState
    >[0]);
    seed({ lastCompleteFetchSignature: null });
  });

  it('custom JQL not truncated records the fetch-start signature', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    setup(() => makeFetchResult(['AB-1']));
    const expected = sigNow();
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() =>
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBe(expected),
    );
  });

  it('custom JQL truncated leaves signature null but still refreshes snapshots', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    setup(() => makeFetchResult(['AB-1'], true));
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(refreshCalls().length).toBe(1));
    expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull();
  });

  it('all_watched with all batches ok sets the signature', async () => {
    seed({ jqlPreset: 'all_watched', watchedUsers: [u1] });
    setup((n) => makeFetchResult(n === 1 ? ['AB-1'] : ['U1-1']));
    const expected = sigNow();
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() =>
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBe(expected),
    );
  });

  it('partial batch failure leaves signature null and still refreshes members', async () => {
    seed({ jqlPreset: 'all_watched', watchedUsers: [u1] });
    setup((n) => {
      if (n === 2) throw new Error('boom');
      return makeFetchResult(['AB-1']);
    });
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(refreshCalls().length).toBe(1));
    expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull();
    expect(useTicketStore.getState().tickets.map((t) => t.key)).toEqual(['AB-1']);
  });

  it('any truncated batch leaves signature null', async () => {
    seed({ jqlPreset: 'all_watched', watchedUsers: [u1] });
    setup((n) => makeFetchResult(n === 1 ? ['AB-1'] : ['U1-1'], n === 2));
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(useTicketStore.getState().tickets.length).toBe(2));
    expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull();
  });

  it('all batches failing clears a previously set signature and keeps tickets', async () => {
    seed({
      jqlPreset: 'all_watched',
      watchedUsers: [u1],
      tickets: [makeTicket('OLD-1')],
      lastCompleteFetchSignature: 'previous',
    });
    setup(() => {
      throw new Error('down');
    });
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(useTicketStore.getState().fetchStatus).toBe('error'));
    expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull();
    expect(useTicketStore.getState().tickets.map((t) => t.key)).toEqual(['OLD-1']);
  });

  it('custom JQL invoke throwing clears the signature', async () => {
    seed({
      jqlPreset: 'custom',
      jqlCustom: 'project = X',
      lastCompleteFetchSignature: 'previous',
    });
    setup(() => {
      throw new Error('bad jql');
    });
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(useTicketStore.getState().fetchStatus).toBe('error'));
    expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull();
  });

  it('complete fetch followed by partial fetch goes from set to null', async () => {
    seed({ jqlPreset: 'all_watched', watchedUsers: [u1] });
    let failSecondBatch = false;
    setup((n) => {
      if (failSecondBatch && n % 2 === 0) throw new Error('boom');
      return makeFetchResult(['AB-1']);
    });
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() =>
      expect(useTicketStore.getState().lastCompleteFetchSignature).not.toBeNull(),
    );
    await waitFor(() => expect(useTicketStore.getState().fetchStatus).toBe('idle'));
    failSecondBatch = true;
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));
    await waitFor(() => expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull());
  });

  it('preset changed mid-flight stores the fetch-start signature', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    const d = deferred<FetchTicketsResult>();
    setup(() => d.promise);
    const startSig = sigNow();
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() =>
      expect(mockInvoke.mock.calls.some(([cmd]) => cmd === 'fetch_tickets')).toBe(true),
    );
    seed({ jqlPreset: 'mine' });
    d.resolve(makeFetchResult(['AB-1']));
    await waitFor(() =>
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBe(startSig),
    );
    expect(useTicketStore.getState().lastCompleteFetchSignature).not.toBe(sigNow());
  });

  it('poll-complete triggered fetch with all batches ok sets the signature', async () => {
    const { listen } = await import('@tauri-apps/api/event');
    let handler: ((e: { payload: unknown }) => void) | undefined;
    vi.mocked(listen).mockImplementation(((name: string, cb: (e: { payload: unknown }) => void) => {
      if (name === 'poll-complete') handler = cb;
      return Promise.resolve(() => {});
    }) as unknown as typeof listen);
    setup(() => makeFetchResult(['AB-1']));
    const expected = sigNow();
    render(<TicketListPage />);
    await waitFor(() => expect(handler).toBeDefined());
    handler?.({
      payload: { changedKeys: ['AB-1'], checkedAt: '2024-01-01T00:00:00Z', hadError: false },
    });
    await waitFor(() =>
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBe(expected),
    );
    vi.mocked(listen).mockImplementation((() =>
      Promise.resolve(() => {})) as unknown as typeof listen);
  });

  it('refresh_group_snapshots is not invoked when no fetched ticket is a member', async () => {
    setup(() => makeFetchResult(['ZZ-9']));
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(useTicketStore.getState().tickets.length).toBe(1));
    expect(refreshCalls().length).toBe(0);
  });

  it('refresh_group_snapshots only receives member tickets', async () => {
    setup(() => makeFetchResult(['AB-1', 'ZZ-9']));
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(refreshCalls().length).toBe(1));
    const payload = refreshCalls()[0][1] as { issues: { issueKey: string }[] };
    expect(payload.issues.map((i) => i.issueKey)).toEqual(['AB-1']);
  });

  it('refresh_group_snapshots rejecting does not change fetch status or toast', async () => {
    refreshImpl = async () => {
      throw new Error('refresh failed');
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setup(() => makeFetchResult(['AB-1']));
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(refreshCalls().length).toBe(1));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(useTicketStore.getState().fetchStatus).toBe('idle');
    expect(useTicketStore.getState().fetchError).toBeNull();
    warn.mockRestore();
  });

  async function startPendingFetch() {
    const d = deferred<FetchTicketsResult>();
    setup(() => d.promise);
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() =>
      expect(mockInvoke.mock.calls.some(([cmd]) => cmd === 'fetch_tickets')).toBe(true),
    );
    return d;
  }

  async function settle(d: { resolve: (v: FetchTicketsResult) => void }) {
    d.resolve(makeFetchResult(['AB-1']));
    await waitFor(() => expect(useTicketStore.getState().tickets.length).toBe(1));
  }

  function switchConnection(patch: { baseUrl?: string; username?: string }) {
    const cur = useConnectionStore.getState().serverConnection;
    if (!cur) throw new Error('no connection');
    useConnectionStore.setState({ serverConnection: { ...cur, ...patch } });
  }

  async function settleDiscarded(d: { resolve: (v: FetchTicketsResult) => void }) {
    d.resolve(makeFetchResult(['AB-1']));
    await waitFor(() => expect(useTicketStore.getState().fetchStatus).toBe('idle'));
    // let any trailing microtasks (that would apply tickets) run
    await new Promise((r) => setTimeout(r, 0));
  }

  function expectDiscarded() {
    const s = useTicketStore.getState();
    expect(s.tickets.some((t) => t.key === 'AB-1')).toBe(false);
    expect(s.lastCompleteFetchSignature).toBeNull();
    expect(s.hasFetchedThisSession).toBe(false);
    expect(refreshCalls().length).toBe(0);
    const cmds = mockInvoke.mock.calls.map(([c]) => c);
    expect(cmds).not.toContain('trigger_manual_poll');
    expect(cmds).not.toContain('fetch_ticket_detail');
  }

  it('custom path: baseUrl switched mid-flight discards results and never refreshes', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    seed({ tickets: [makeFetchResult(['OLD-1']).issues[0]], hasFetchedThisSession: false });
    const d = await startPendingFetch();
    switchConnection({ baseUrl: 'http://other.example.com' });
    await settleDiscarded(d);
    expectDiscarded();
    expect(useTicketStore.getState().tickets).toEqual([]);
  });

  it('batch path: baseUrl switched mid-flight discards results and never refreshes', async () => {
    const d = await startPendingFetch();
    switchConnection({ baseUrl: 'http://other.example.com' });
    await settleDiscarded(d);
    expectDiscarded();
  });

  it('batch path: username changed mid-flight discards results and never refreshes', async () => {
    const d = await startPendingFetch();
    switchConnection({ username: 'someoneelse' });
    await settleDiscarded(d);
    expectDiscarded();
  });

  it('discard releases the in-flight lock so a second fetch runs', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    const d = await startPendingFetch();
    switchConnection({ baseUrl: 'http://other.example.com' });
    await settleDiscarded(d);
    const before = mockInvoke.mock.calls.filter(([c]) => c === 'fetch_tickets').length;
    await clickFetch();
    await waitFor(() =>
      expect(mockInvoke.mock.calls.filter(([c]) => c === 'fetch_tickets').length).toBe(before + 1),
    );
  });

  it('WR-07: orphaned fetch rejecting after a server switch does not touch the new state', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    const d = await startPendingFetch();
    switchConnection({ baseUrl: 'http://other.example.com' });
    // resetForServerSwitch settles the orphan's 'loading' itself
    expect(useTicketStore.getState().fetchStatus).toBe('idle');
    seed({ lastCompleteFetchSignature: 'b-complete-sig' });
    d.reject(new Error('timeout talking to A'));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const s = useTicketStore.getState();
    expect(s.fetchStatus).toBe('idle');
    expect(s.fetchError).toBeNull();
    expect(s.lastCompleteFetchSignature).toBe('b-complete-sig');
  });

  it('WR-07: fetch orphaned by unmount cannot clobber a newer fetch from the remounted page', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    const d1 = deferred<FetchTicketsResult>();
    const d2 = deferred<FetchTicketsResult>();
    setup((n) => (n === 1 ? d1.promise : d2.promise));
    const first = render(<TicketListPage />);
    await clickFetch();
    await waitFor(() =>
      expect(mockInvoke.mock.calls.filter(([c]) => c === 'fetch_tickets').length).toBe(1),
    );
    first.unmount(); // Settings round-trip: switch A -> B, then back to the list
    switchConnection({ baseUrl: 'http://other.example.com' });

    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() =>
      expect(mockInvoke.mock.calls.filter(([c]) => c === 'fetch_tickets').length).toBe(2),
    );

    // A's orphan settles first: must neither apply its list nor end B's loading state.
    d1.resolve(makeFetchResult(['OLD-1']));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(useTicketStore.getState().fetchStatus).toBe('loading');
    expect(useTicketStore.getState().tickets.some((t) => t.key === 'OLD-1')).toBe(false);

    d2.resolve(makeFetchResult(['AB-1']));
    await waitFor(() =>
      expect(useTicketStore.getState().tickets.map((t) => t.key)).toEqual(['AB-1']),
    );
    expect(useTicketStore.getState().fetchStatus).toBe('idle');
    expect(useTicketStore.getState().lastCompleteFetchSignature).toBe(sigNow());
  });

  it('custom path: preset changed mid-flight never refreshes snapshots', async () => {
    seed({ jqlPreset: 'custom', jqlCustom: 'project = X' });
    const d = await startPendingFetch();
    seed({ jqlPreset: 'mine' });
    await settle(d);
    expect(refreshCalls().length).toBe(0);
  });

  it('unchanged signature refreshes once with the fetching baseUrl', async () => {
    const d = await startPendingFetch();
    await settle(d);
    await waitFor(() => expect(refreshCalls().length).toBe(1));
    expect((refreshCalls()[0][1] as { expectedBaseUrl: string }).expectedBaseUrl).toBe(
      'http://server.example.com',
    );
  });

  it('never invokes remove_issues_from_group during a fetch (GDUR-01)', async () => {
    seed({ jqlPreset: 'all_watched', watchedUsers: [u1] });
    setup((n) => {
      if (n === 2) throw new Error('boom');
      return makeFetchResult(['AB-1']);
    });
    render(<TicketListPage />);
    await clickFetch();
    await waitFor(() => expect(refreshCalls().length).toBe(1));
    expect(mockInvoke.mock.calls.some(([cmd]) => cmd === 'remove_issues_from_group')).toBe(false);
  });
});
