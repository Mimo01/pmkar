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

function makeFetchResult(keys: string[]): FetchTicketsResult {
  return {
    issues: keys.map(makeTicket),
    total: keys.length,
    triageMap: Object.fromEntries(keys.map((k) => [k, { state: 'new', copiedKey: null }])),
  };
}

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
      jqlPreset: 'assigned',
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
        return { jqlPreset: 'assigned', jqlCustom: null, watchedUsers: [], lastFetchedAt: null };
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
        return { jqlPreset: 'assigned', jqlCustom: null, watchedUsers: [], lastFetchedAt: null };
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
