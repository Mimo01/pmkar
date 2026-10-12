import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { fireEvent } from '@testing-library/react';
import { IgnoredTicketsPage } from '../../tickets/IgnoredTicketsPage';
import { TicketListPage } from '../../tickets/TicketListPage';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket, TriageEntry } from '../../tickets/types';
import { useGroupStore } from '../groupStore';
import { NavigationContext } from '../NavigationContext';

function mk(key: string, updated: string): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      status: { name: 'Open', id: '1', statusCategory: { key: 'new' } } as never,
      priority: { name: 'High', id: '2' },
      assignee: null,
      created: updated,
      updated,
    },
  };
}

const P1 = mk('P-1', '2026-01-02T10:00:00.000Z');
const P2 = mk('P-2', '2026-01-01T10:00:00.000Z');

const mkGroup = (id: number, name: string, position: number) => ({
  id,
  name,
  color: 'blue',
  position,
  createdAt: 't',
  memberCount: 0,
});

const GROUPS = [mkGroup(1, 'Sprint', 0), mkGroup(2, 'QA', 1)];
let memberships: { groupId: number; issueKey: string }[];

const initialGroups = useGroupStore.getState();

function cardFor(key: string): HTMLElement {
  const el = screen.getByText(key).closest<HTMLElement>('[data-testid="ticket-card"]');
  if (!el) throw new Error(`no card for ${key}`);
  return el;
}

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

beforeEach(() => {
  invokeMock.mockReset();
  memberships = [
    { groupId: 1, issueKey: 'P-1' },
    { groupId: 2, issueKey: 'P-1' },
    { groupId: 2, issueKey: 'P-2' },
  ];
  invokeMock.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case 'list_groups':
        return GROUPS;
      case 'list_group_memberships':
        return memberships;
      case 'add_issues_to_group':
        memberships = [...memberships, { groupId: 1, issueKey: 'P-2' }];
        return 1;
      case 'get_triage_state':
        return {};
      default:
        return undefined;
    }
  });
  useGroupStore.setState({
    ...initialGroups,
    groups: GROUPS as never,
    memberKeysByGroup: { 1: ['P-1'], 2: ['P-1', 'P-2'] },
    groupIdsByIssue: { 'P-1': [1, 2], 'P-2': [2] },
    hydrated: true,
    hydrateError: false,
  });
  useTicketStore.setState({
    tickets: [P1, P2],
    triageMap: { 'P-2': { state: 'ignored', copiedKey: null } },
    selectedTicketKey: null,
    fetchStatus: 'idle',
  });
});

describe('membership regression (GMEM-01, D-20)', () => {
  it('keeps a multi-group issue in the New list with all of its chips', () => {
    render(<TicketListPage />);
    const card = cardFor('P-1');
    expect(within(card).getByRole('button', { name: 'Go to group ‘Sprint’' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Go to group ‘QA’' })).toBeTruthy();
    expect(screen.queryByText('P-2')).toBeNull();
  });

  it('keeps a grouped dismissed issue in the Dismissed list with its chip', () => {
    render(<IgnoredTicketsPage />);
    const card = cardFor('P-2');
    expect(within(card).getByRole('button', { name: 'Go to group ‘QA’' })).toBeTruthy();
    expect(screen.queryByText('P-1')).toBeNull();
  });

  it('adding to a group never changes triage state or tab placement', async () => {
    const before = JSON.parse(JSON.stringify(useTicketStore.getState().triageMap)) as Record<
      string,
      TriageEntry
    >;
    const r = await useGroupStore.getState().addToGroup(1, [P2]);
    expect(r.ok).toBe(true);
    await waitFor(() => expect(useGroupStore.getState().groupIdsByIssue['P-2']).toContain(1));
    expect(useTicketStore.getState().triageMap).toEqual(before);

    const { unmount } = render(<IgnoredTicketsPage />);
    expect(screen.getByText('P-2')).toBeInTheDocument();
    unmount();
    render(<TicketListPage />);
    expect(screen.queryByText('P-2')).toBeNull();
  });

  it('clicking a chip on a core-list card navigates to that group without opening detail', () => {
    const spy = vi.fn();
    render(
      <NavigationContext.Provider value={{ navigateToGroup: spy }}>
        <TicketListPage />
      </NavigationContext.Provider>,
    );
    fireEvent.click(within(cardFor('P-1')).getByRole('button', { name: 'Go to group ‘QA’' }));
    expect(spy).toHaveBeenCalledWith(2);
    expect(useTicketStore.getState().selectedTicketKey).toBeNull();
  });
});
