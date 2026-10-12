import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicketDetail } from '../../tickets/types';
import { DetailGroupsRow } from '../DetailGroupsRow';
import { useGroupStore } from '../groupStore';
import { NavigationContext } from '../NavigationContext';
import { isRenderableTicket } from '../useGroupMembers';

const initial = useGroupStore.getState();

function mkGroup(id: number, name: string, position: number) {
  return { id, name, color: 'blue', position, createdAt: 't', memberCount: 0 };
}

const detail: JiraTicketDetail = {
  id: '1',
  key: 'P-1',
  fields: {
    summary: 'S',
    status: { name: 'Open' },
    priority: { name: 'High', id: '2' },
    assignee: null,
    reporter: null,
    description: 'x',
    labels: [],
    components: [],
    fixVersions: [],
    comment: { comments: [] },
    attachment: [],
    subtasks: [],
    issuelinks: [],
    updated: '2024-06-01T00:00:00.000Z',
  },
};

let backendGroups: ReturnType<typeof mkGroup>[];
let memberships: { groupId: number; issueKey: string }[];
let removeBehavior: () => Promise<unknown>;
const navigate = vi.fn();

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  invokeMock.mockReset();
  useTicketStore.setState({ tickets: [] });
  backendGroups = [mkGroup(1, 'Sprint', 0), mkGroup(2, 'QA', 1), mkGroup(3, 'Docs', 2)];
  memberships = [
    { groupId: 3, issueKey: 'P-1' },
    { groupId: 1, issueKey: 'P-1' },
  ];
  removeBehavior = async () => 1;
  invokeMock.mockImplementation(async (cmd: string, args: never) => {
    switch (cmd) {
      case 'list_groups':
        return backendGroups;
      case 'list_group_memberships':
        return memberships;
      case 'add_issues_to_group': {
        const a = args as { groupId: number; issues: { issueKey: string }[] };
        for (const i of a.issues) memberships.push({ groupId: a.groupId, issueKey: i.issueKey });
        return a.issues.length;
      }
      case 'remove_issues_from_group': {
        const a = args as { groupId: number; issueKeys: string[] };
        const r = await removeBehavior();
        memberships = memberships.filter(
          (m) => !(m.groupId === a.groupId && a.issueKeys.includes(m.issueKey)),
        );
        return r;
      }
      default:
        return null;
    }
  });
  useGroupStore.setState({
    ...initial,
    groups: backendGroups as never,
    memberKeysByGroup: {},
    groupIdsByIssue: { 'P-1': [3, 1] },
    hydrated: true,
    hydrateError: false,
  });
});

function setup() {
  const user = userEvent.setup();
  renderWithI18n(
    <NavigationContext.Provider value={{ navigateToGroup: navigate }}>
      <DetailGroupsRow issueKey="P-1" detail={detail} />
    </NavigationContext.Provider>,
  );
  return user;
}

const removeCalls = () => invokeMock.mock.calls.filter((c) => c[0] === 'remove_issues_from_group');
const addCalls = () => invokeMock.mock.calls.filter((c) => c[0] === 'add_issues_to_group');

describe('DetailGroupsRow', () => {
  it('renders Groups button then chips in tab order with name and remove buttons', () => {
    setup();
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual([
      'Groups',
      'Go to group ‘Sprint’',
      'Remove from ‘Sprint’',
      'Go to group ‘Docs’',
      'Remove from ‘Docs’',
    ]);
  });

  it('renders only the Groups button without memberships', () => {
    useGroupStore.setState({ groupIdsByIssue: {} });
    setup();
    expect(screen.getByRole('button', { name: 'Groups' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove from/ })).toBeNull();
  });

  it('opens the picker, adds immediately and shows the new chip', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Groups' }));
    const input = await screen.findByRole('combobox', { name: 'Search groups' });
    expect(input).toHaveFocus();
    expect(screen.getByRole('option', { name: /Sprint/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /Docs/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: /QA/ }));
    await waitFor(() => expect(addCalls()).toHaveLength(1));
    expect(addCalls()[0][1]).toMatchObject({ groupId: 2 });
    expect((addCalls()[0][1] as { issues: { issueKey: string }[] }).issues[0].issueKey).toBe('P-1');
    expect(await screen.findByRole('button', { name: 'Remove from ‘QA’' })).toBeInTheDocument();
  });

  it('unchecking in the picker removes immediately without confirm', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Groups' }));
    await screen.findByRole('combobox', { name: 'Search groups' });
    await user.click(screen.getByRole('option', { name: /Sprint/ }));
    await waitFor(() => expect(removeCalls()).toHaveLength(1));
    expect(removeCalls()[0][1]).toEqual({ groupId: 1, issueKeys: ['P-1'] });
    expect(screen.queryByText('Remove from ‘Sprint’?')).toBeNull();
  });

  it('chip x opens confirm with Cancel focused; Cancel restores focus without invoking', async () => {
    const user = setup();
    const x = screen.getByRole('button', { name: 'Remove from ‘Docs’' });
    await user.click(x);
    expect(await screen.findByText('Remove from ‘Docs’?')).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.click(cancel);
    await waitFor(() => expect(screen.queryByText('Remove from ‘Docs’?')).toBeNull());
    expect(removeCalls()).toHaveLength(0);
    await waitFor(() => expect(x).toHaveFocus());
  });

  it('confirming removes the chip and moves focus to Groups', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Remove from ‘Docs’' }));
    await screen.findByText('Remove from ‘Docs’?');
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(removeCalls()).toHaveLength(1));
    expect(removeCalls()[0][1]).toEqual({ groupId: 3, issueKeys: ['P-1'] });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Go to group ‘Docs’' })).toBeNull(),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Groups' })).toHaveFocus());
  });

  it('shows an error toast and closes the confirm on not_found', async () => {
    removeBehavior = async () => {
      throw { code: 'not_found' };
    };
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Remove from ‘Docs’' }));
    await screen.findByText('Remove from ‘Docs’?');
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This group no longer exists.'));
    await waitFor(() => expect(screen.queryByText('Remove from ‘Docs’?')).toBeNull());
  });

  it('chip name navigates to the group', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Go to group ‘Sprint’' }));
    expect(navigate).toHaveBeenCalledWith(1);
  });

  it('sends a renderable snapshot when the issue is not in the ticket store', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Groups' }));
    await screen.findByRole('combobox', { name: 'Search groups' });
    await user.click(screen.getByRole('option', { name: /QA/ }));
    await waitFor(() => expect(addCalls()).toHaveLength(1));
    const issue = (addCalls()[0][1] as { issues: { ticketJson: string }[] }).issues[0];
    expect(isRenderableTicket(JSON.parse(issue.ticketJson))).toBe(true);
  });
});
