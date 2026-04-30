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

const mockInvoke = vi.mocked(invoke);

/**
 * Regression coverage for debug session: fetched-tasks-wrong-project.
 *
 * Background: when the JQL preset was redesigned (2dd76f1) to broaden "mine"
 * to include `comment ~ me`, `description ~ me`, and `issueKey in
 * watchedIssues()`, foreign-project tickets started leaking into the source
 * ticket list. The fix wraps the OR'd people clause with `project = "<key>"
 * AND (...)` whenever a source project is configured.
 *
 * If these tests fail, foreign-project tickets are likely leaking into the
 * source ticket list again.
 */
describe('TicketListPage — JQL is scoped to the configured source project', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
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

  function setConnection(sourceProjectKey: string | null) {
    useConnectionStore.setState({
      serverConnection: {
        baseUrl: 'http://server.example.com',
        username: 'alice',
        serverVersion: '9.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
      cloudConnection: null,
      sourceProjectKey,
      sourceProjectName: sourceProjectKey ? `${sourceProjectKey} project` : null,
      targetProjectKey: null,
      targetProjectName: null,
    });
  }

  function mockHydrationAndFetch(preset: 'mine' | 'all_watched' | 'custom' = 'mine') {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return { jqlPreset: preset, jqlCustom: null, watchedUsers: [], lastFetchedAt: null };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') return { issues: [], total: 0, triageMap: {}, truncated: false };
      if (cmd === 'fetch_ticket_detail') return { id: '1', key: 'x', fields: {} };
      if (cmd === 'check_ticket_changes') return [];
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });
  }

  async function clickFetchAndCaptureJql(): Promise<string> {
    render(<TicketListPage />);
    fireEvent.click(await screen.findByTitle('Refresh (F5)'));
    await waitFor(() => {
      const fetchCalls = mockInvoke.mock.calls.filter(([cmd]) => cmd === 'fetch_tickets');
      expect(fetchCalls.length).toBeGreaterThan(0);
    });
    const fetchCall = mockInvoke.mock.calls.find(([cmd]) => cmd === 'fetch_tickets');
    const payload = fetchCall?.[1] as { jql: string };
    return payload.jql;
  }

  it('wraps the mine preset with `project = "<key>" AND (...)` when source project is set', async () => {
    setConnection('XYZ');
    mockHydrationAndFetch('mine');

    const jql = await clickFetchAndCaptureJql();

    // Project clause must be present and scope the people clause.
    expect(jql).toMatch(/^project\s*=\s*"XYZ"\s+AND\s*\(/);
    // People clauses are still inside the parentheses.
    expect(jql).toContain('assignee = "alice"');
    expect(jql).toContain('comment ~ "alice"');
    expect(jql).toContain('description ~ "alice"');
    expect(jql).toContain('watchedIssues()');
    expect(jql).toMatch(/ORDER BY updated DESC$/);
  });

  it('omits the project clause when no source project is configured', async () => {
    setConnection(null);
    mockHydrationAndFetch('mine');

    const jql = await clickFetchAndCaptureJql();

    expect(jql).not.toContain('project =');
    expect(jql).toContain('assignee = "alice"');
  });

  it('leaves custom JQL untouched even when source project is set', async () => {
    setConnection('XYZ');
    useTicketStore.setState({
      jqlPreset: 'custom',
      jqlCustom: 'project = ABC AND status = Open',
    } as unknown as Parameters<typeof useTicketStore.setState>[0]);
    mockHydrationAndFetch('custom');
    // Override fetch_config so hydration also reports custom preset.
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'get_triage_state') return {};
      if (cmd === 'get_fetch_config')
        return {
          jqlPreset: 'custom',
          jqlCustom: 'project = ABC AND status = Open',
          watchedUsers: [],
          lastFetchedAt: null,
        };
      if (cmd === 'get_unseen_change_keys') return [];
      if (cmd === 'fetch_tickets') return { issues: [], total: 0, triageMap: {}, truncated: false };
      if (cmd === 'trigger_manual_poll') return null;
      return null;
    });

    const jql = await clickFetchAndCaptureJql();

    // The user's custom JQL is passed through verbatim — we do not inject
    // a `project = "XYZ"` clause on top, because that would silently
    // contradict their explicit `project = ABC` filter.
    expect(jql).toBe('project = ABC AND status = Open');
  });
});
