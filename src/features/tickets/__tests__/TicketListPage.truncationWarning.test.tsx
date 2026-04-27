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

function makeFetchResult(keys: string[], truncated: boolean): FetchTicketsResult {
  return {
    issues: keys.map(makeTicket),
    total: keys.length,
    triageMap: Object.fromEntries(keys.map((k) => [k, { state: 'new', copiedKey: null }])),
    truncated,
  };
}

/**
 * Regression tests for the silent 50-ticket truncation bug.
 *
 * Background: `fetch_tickets` previously hit /rest/api/2/search with
 * `maxResults=50` and no `startAt` loop, so any matching set with >50
 * issues was silently truncated to the first page. The fix adds a
 * pagination loop in the backend with a hard upper bound
 * (MAX_PAGINATION_ITEMS = 1000); when the cap is hit, the backend returns
 * `truncated: true` in `FetchTicketsResult` and the UI must surface a
 * warning so users know to tighten their JQL.
 *
 * If these tests fail, the user-visible warning has regressed — the cap
 * may again be hit silently.
 *
 * See: .planning/debug/jira-fetch-pagination-50-cap.md
 */
describe('TicketListPage — pagination truncation warning', () => {
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
      jqlPreset: 'assigned',
      jqlCustom: null,
      watchedUsers: [],
      unseenChanges: {},
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);
  });

  function setupFetchInvoke(fetchResult: FetchTicketsResult) {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return { jqlPreset: 'assigned', jqlCustom: null, watchedUsers: [], lastFetchedAt: null };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') return fetchResult;
      if (cmd === 'fetch_ticket_detail') return { id: '1', key: 'PROJ-1', fields: {} };
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });
  }

  it('shows the truncation warning banner when fetch returns truncated=true', async () => {
    setupFetchInvoke(makeFetchResult(['PROJ-1', 'PROJ-2'], true));

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // Banner appears after the fetch resolves.
    const banner = await screen.findByTestId('truncation-warning');
    expect(banner).toBeInTheDocument();
    // Renders the user-facing warning text.
    expect(banner.textContent).toMatch(/truncat/i);
  });

  it('does NOT show the truncation warning when fetch returns truncated=false', async () => {
    setupFetchInvoke(makeFetchResult(['PROJ-1', 'PROJ-2'], false));

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));

    // Wait for the fetch to complete (a ticket card or count badge appears).
    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    });
    await waitFor(() => {
      expect(useTicketStore.getState().truncated).toBe(false);
    });

    expect(screen.queryByTestId('truncation-warning')).toBeNull();
  });

  it('clears the warning when the next fetch reports truncated=false', async () => {
    // First fetch: truncated.
    setupFetchInvoke(makeFetchResult(['PROJ-1'], true));

    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));
    await screen.findByTestId('truncation-warning');

    // Second fetch: not truncated. Replace the mock and click again.
    setupFetchInvoke(makeFetchResult(['PROJ-1'], false));
    fireEvent.click(screen.getByTitle('Refresh (F5)'));

    await waitFor(() => {
      expect(screen.queryByTestId('truncation-warning')).toBeNull();
    });
  });
});
