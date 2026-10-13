import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastErrorMock(...a),
    success: (...a: unknown[]) => toastSuccessMock(...a),
  },
}));

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../../tickets/fetchSignature';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket } from '../../tickets/types';
import { GroupTabStrip } from '../GroupTabStrip';
import { useGroupStore } from '../groupStore';
import type { TabId } from '../groupTabs';

const initial = useGroupStore.getState();
type G = {
  id: number;
  name: string;
  color: string;
  position: number;
  createdAt: string;
  memberCount: number;
};
const sprint: G = {
  id: 1,
  name: 'Sprint 12',
  color: 'blue',
  position: 0,
  createdAt: 't',
  memberCount: 3,
};
const qa: G = { id: 2, name: 'QA', color: 'teal', position: 1, createdAt: 't', memberCount: 1 };
const ops: G = { id: 3, name: 'Ops', color: 'slate', position: 2, createdAt: 't', memberCount: 0 };

let server: G[] = [];
let deleteError: unknown = null;

function seed(groups: G[]) {
  server = groups.map((g) => ({ ...g }));
  useGroupStore.setState({
    ...initial,
    groups: server.map((g) => ({ ...g })) as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
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
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollBy = vi.fn();
});

beforeEach(() => {
  invokeMock.mockReset();
  toastErrorMock.mockReset();
  deleteError = null;
  invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
    switch (cmd) {
      case 'list_groups':
        return server.map((g) => ({ ...g }));
      case 'list_group_memberships':
        return [];
      case 'rename_group': {
        const g = server.find((x) => x.id === args.groupId);
        if (g) g.name = args.name as string;
        return g;
      }
      case 'set_group_color': {
        const g = server.find((x) => x.id === args.groupId);
        if (g) g.color = args.color as string;
        return g;
      }
      case 'delete_group':
        if (deleteError) throw deleteError;
        server = server.filter((x) => x.id !== args.groupId);
        return null;
      default:
        return null;
    }
  });
  seed([sprint, qa, ops]);
});

function Wrapper({ initialTab, spy }: { initialTab: TabId; spy: (t: TabId) => void }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  return (
    <>
      <button type="button" data-tab-id="new">
        New
      </button>
      <GroupTabStrip
        activeTab={tab}
        onTabChange={(t) => {
          spy(t);
          setTab(t);
        }}
      />
    </>
  );
}

function setup(initialTab: TabId) {
  const spy = vi.fn();
  renderWithI18n(<Wrapper initialTab={initialTab} spy={spy} />);
  return { spy, user: userEvent.setup() };
}

async function openMoreMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  tabButton(name).focus();
  await user.keyboard('{Shift>}{F10}{/Shift}');
}

function tabButton(name: string) {
  return screen.getByRole('button', { name: new RegExp(`^${name},`) });
}

const tk = (key: string) => ({ id: key, key, fields: {} }) as unknown as JiraTicket;

function seedMissing(eligible = true) {
  useGroupStore.setState({ memberKeysByGroup: { 1: ['AB-1', 'AB-2'], 2: ['AB-1'] } });
  useTicketStore.setState({ tickets: [tk('AB-1')], lastCompleteFetchSignature: null });
  if (eligible) {
    useTicketStore.setState({
      lastCompleteFetchSignature: computeFetchSignature(
        currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
      ),
    });
  }
}

describe('GroupTabStrip remove all missing', () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
  });

  it('menu item opens the confirm; Cancel returns focus to the tab', async () => {
    seedMissing();
    const { user } = setup('group:1');
    await openMoreMenu(user, 'Sprint 12');
    await user.click(await screen.findByRole('menuitem', { name: 'Remove all missing (1)' }));
    expect(
      await screen.findByText('Remove 1 issue from “Sprint 12”? It is no longer in results.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(tabButton('Sprint 12')).toHaveFocus());
    expect(invokeMock.mock.calls.some((c) => c[0] === 'remove_issues_from_group')).toBe(false);
  });

  it('Remove makes one call, toasts and returns focus to the tab', async () => {
    seedMissing();
    const { user } = setup('new');
    fireEvent.contextMenu(tabButton('Sprint 12'));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove all missing (1)' }));
    await screen.findByText(/Remove 1 issue/);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('remove_issues_from_group', {
        groupId: 1,
        issueKeys: ['AB-2'],
      }),
    );
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'remove_issues_from_group')).toHaveLength(
      1,
    );
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    await waitFor(() => expect(tabButton('Sprint 12')).toHaveFocus());
  });

  it('has no item when the gate is off', async () => {
    seedMissing(false);
    const { user } = setup('group:1');
    await openMoreMenu(user, 'Sprint 12');
    await screen.findByRole('menuitem', { name: 'Rename…' });
    expect(screen.queryByRole('menuitem', { name: /Remove all missing/ })).toBeNull();
  });

  it('has no item when all members are present', async () => {
    seedMissing();
    const { user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await screen.findByRole('menuitem', { name: 'Rename…' });
    expect(screen.queryByRole('menuitem', { name: /Remove all missing/ })).toBeNull();
  });
});

describe('GroupTabStrip overlays', () => {
  it('Rename opens focused popover, saves, and refocuses the renamed tab', async () => {
    const { user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename…' }));
    const input = await screen.findByRole('textbox', { name: 'Group name' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('QA');
    expect(document.body.style.pointerEvents).not.toBe('none');
    await user.clear(input);
    await user.type(input, 'QA team{Enter}');
    await waitFor(() => expect(tabButton('QA team')).toBeInTheDocument());
    await waitFor(() => expect(tabButton('QA team')).toHaveFocus());
  });

  it('Rename cancel from a right-clicked inactive tab refocuses the tab, no tab switch', async () => {
    const { spy, user } = setup('group:2');
    fireEvent.contextMenu(tabButton('Sprint 12'));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename…' }));
    await screen.findByRole('textbox', { name: 'Group name' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(tabButton('Sprint 12')).toHaveFocus());
    expect(spy).not.toHaveBeenCalled();
  });

  it('Change color updates the tab color and refocuses the tab', async () => {
    const { user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Change color…' }));
    await user.click(await screen.findByRole('radio', { name: 'Purple' }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('set_group_color', { groupId: 2, color: 'purple' }),
    );
    await waitFor(() => {
      expect(tabButton('QA').parentElement?.style.getPropertyValue('--group-color')).toBe(
        'var(--color-group-purple)',
      );
    });
    await waitFor(() => expect(tabButton('QA')).toHaveFocus());
  });

  it('Change color Esc returns focus without saving', async () => {
    const { user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Change color…' }));
    await screen.findByRole('radio', { name: 'Purple' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(tabButton('QA')).toHaveFocus());
    expect(invokeMock.mock.calls.some((c) => c[0] === 'set_group_color')).toBe(false);
  });

  it('closes the rename popover and toasts when the group vanishes', async () => {
    const { user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename…' }));
    await screen.findByRole('textbox', { name: 'Group name' });
    act(() => {
      useGroupStore.setState({ groups: [sprint, ops] as never });
    });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Group name' })).toBeNull());
    expect(toastErrorMock).toHaveBeenCalledWith('This group no longer exists.');
  });

  it('deleting the active group writes new and focuses the New core tab', async () => {
    const { spy, user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete “QA”?');
    expect(dialog).toHaveTextContent('1 issue is in this group.');
    await user.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('delete_group', { groupId: 2 }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('new'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^QA,/ })).toBeNull());
    await waitFor(() => expect(document.querySelector('[data-tab-id="new"]')).toHaveFocus());
  });

  it('deleting the last inactive group focuses its left neighbour', async () => {
    const { spy, user } = setup('new');
    fireEvent.contextMenu(tabButton('Ops'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(tabButton('QA')).toHaveFocus());
    expect(spy).not.toHaveBeenCalled();
  });

  it('deleting the first inactive group focuses its right neighbour', async () => {
    const { user } = setup('new');
    fireEvent.contextMenu(tabButton('Sprint 12'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(tabButton('QA')).toHaveFocus());
  });

  it('deleting the only group focuses the New group plus', async () => {
    seed([ops]);
    const { user } = setup('new');
    fireEvent.contextMenu(tabButton('Ops'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'New group' })).toHaveFocus());
  });

  it('Keep group deletes nothing and refocuses the tab', async () => {
    const { user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Keep group' }));
    await waitFor(() => expect(tabButton('QA')).toHaveFocus());
    expect(invokeMock.mock.calls.some((c) => c[0] === 'delete_group')).toBe(false);
    expect(tabButton('QA')).toBeInTheDocument();
  });

  it('freezes the member count captured at open', async () => {
    const { user } = setup('new');
    fireEvent.contextMenu(tabButton('Sprint 12'));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('3 issues');
    act(() => {
      useGroupStore.setState({ groups: [{ ...sprint, memberCount: 7 }, qa, ops] as never });
    });
    expect(dialog).toHaveTextContent('3 issues');
    expect(dialog).not.toHaveTextContent('7 issues');
  });

  it('keeps the dialog open with an error when delete fails', async () => {
    deleteError = { code: 'internal' };
    const { spy, user } = setup('group:2');
    await openMoreMenu(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Delete group' }));
    expect(await screen.findByText('Could not delete the group. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
