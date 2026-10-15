import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// AllFieldsSection (via OverviewTab) reads source schema on mount.
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        cache: { 'source|__null__|__null__': { status: 'success', fields: [] } },
        loadSchema: vi.fn(),
      }),
    {
      getState: () => ({
        cache: { 'source|__null__|__null__': { status: 'success', fields: [] } },
        loadSchema: vi.fn(),
      }),
    },
  ),
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

import { invoke } from '@tauri-apps/api/core';
import { useConnectionStore } from '../../connections/connectionStore';
import { cancelConfirm } from '../../tickets/__tests__/confirmHelpers';
import { TicketDetailPage } from '../../tickets/TicketDetailPage';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket, JiraTicketDetail, TriageEntry } from '../../tickets/types';
import { GroupViewPage } from '../GroupViewPage';
import { useGroupStore } from '../groupStore';

const mockInvoke = vi.mocked(invoke);

function mkTicket(key: string): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      status: {
        name: 'Open',
        id: '1',
        statusCategory: { key: 'new' },
      } as JiraTicket['fields']['status'],
      priority: { name: 'High', id: '2' },
      assignee: null,
      created: '2026-01-01T10:00:00.000Z',
      updated: '2026-01-01T10:00:00.000Z',
    },
  };
}

function mkDetail(key: string): JiraTicketDetail {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      status: { name: 'Open', id: '1', statusCategory: { key: 'new' } },
      priority: { name: 'High', id: '2' },
      assignee: null,
      reporter: null,
      description: null,
      labels: [],
      components: [],
      fixVersions: [],
      comment: { comments: [] },
      attachment: [],
      subtasks: [],
      issuelinks: [],
      updated: '2026-01-01T10:00:00.000Z',
    },
  } as unknown as JiraTicketDetail;
}

const triage: Record<string, TriageEntry> = {
  'PROJ-1': { state: 'copied', copiedKey: 'CLD-9' },
  'PROJ-2': { state: 'ignored', copiedKey: 'CLD-7' },
};

/** Mirrors App.tsx: group row click selects the ticket, the shared detail page renders it. */
function openFromGroup(key: string) {
  const view = render(<GroupViewPage groupId={1} />);
  const card = screen.getByText(key).closest<HTMLElement>('[data-testid="ticket-card"]');
  if (!card) throw new Error(`no card for ${key}`);
  fireEvent.click(within(card).getByRole('button', { name: `Summary ${key}` }));
  const selected = useTicketStore.getState().selectedTicketKey;
  expect(selected).toBe(key);
  view.unmount();
  render(<TicketDetailPage issueKey={selected as string} onBack={vi.fn()} />);
}

describe('group view hands off to the shared detail triage actions (RLNK-04)', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === 'fetch_ticket_detail') {
        const { issueKey } = args as { issueKey: string };
        return Promise.resolve(mkDetail(issueKey) as never);
      }
      return Promise.resolve([] as never);
    });
    useConnectionStore.setState({
      serverConnection: {
        baseUrl: 'http://server.example.com',
        username: 'u',
        serverVersion: '9.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
      cloudConnection: {
        baseUrl: 'https://company.atlassian.net',
        username: 'c',
        serverVersion: '1000.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
    });
    useGroupStore.setState({ memberKeysByGroup: { 1: ['PROJ-1', 'PROJ-2'] }, hydrated: true });
    useTicketStore.setState({
      tickets: [mkTicket('PROJ-1'), mkTicket('PROJ-2')],
      triageMap: triage,
      selectedTicketKey: null,
    });
  });

  it('Linked ticket opened from a group shows Deny', async () => {
    openFromGroup('PROJ-1');
    expect(await screen.findByRole('button', { name: 'Deny' })).toBeVisible();
  });

  it('Deny from a group detail shows the confirmation dialog and writes nothing first', async () => {
    openFromGroup('PROJ-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));
    expect(await screen.findByRole('alertdialog')).toBeVisible();
    expect(mockInvoke.mock.calls.map((c) => c[0])).not.toContain('set_triage_state');
    await cancelConfirm();
    expect(mockInvoke.mock.calls.map((c) => c[0])).not.toContain('set_triage_state');
  });

  it('Denied ticket opened from a group shows Restore link and the hint', async () => {
    openFromGroup('PROJ-2');
    expect(await screen.findByRole('button', { name: 'Restore link to CLD-7' })).toBeVisible();
    expect(
      screen.getByText(
        (_, el) => el?.tagName === 'P' && el.textContent === 'Previously linked to CLD-7',
      ),
    ).toBeVisible();
  });
});
