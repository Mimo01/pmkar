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
    let idleTransitions = 0;
    const unsubscribe = useTicketStore.subscribe((state) => {
      if (state.fetchStatus === 'idle') idleTransitions += 1;
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

    // setTickets resets fetchStatus to 'idle' — should happen exactly once
    expect(idleTransitions).toBe(1);
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

    // While second batch is pending, progress counter should be visible
    // Total = 3 (mine + u1 + u2)
    await screen.findByText(/\d+\/\d+ users fetched/i);

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

    // Progress counter must be gone after fetch completes
    await waitFor(() => {
      expect(screen.queryByText(/users fetched/i)).toBeNull();
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
