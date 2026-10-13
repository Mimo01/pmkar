/**
 * D-01 keyboard / focus-return matrix (GQA-02).
 *
 * Keyboard-only interactions (user-event keyboard) for every group menu,
 * popover and dialog, chips, select mode and range select.
 *
 * Cases already asserted elsewhere (not duplicated beyond a single smoke case):
 *  - GroupTabStrip.test.tsx L580            Escape on `…` menu -> `…` trigger
 *  - GroupTabStripOverlays.test.tsx L262    Escape on color popover -> `…` trigger
 *  - ChangeColorPopover.test.tsx L140       Escape closes without saving
 *  - ConfirmRemovePopover.test.tsx L78-83   Escape closes confirm
 *  - DeleteGroupDialog.test.tsx L116        Escape closes dialog
 *  - CreateGroupPopover.test.tsx L216/L231  Escape closes popover
 *  - GroupPicker.test.tsx L264              Escape closes picker -> trigger
 *  - GroupPicker.test.tsx (ArrowDown/Up/Home/End, Space only when search empty)
 *  - GroupViewPage.test.tsx (Esc on card checkbox exits select mode, Esc in Remove confirm)
 * This file re-asserts the focus-return target for each path against the real
 * mounted components so a regression in any one wiring is caught in one place.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../../tickets/fetchSignature';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket, JiraTicketDetail } from '../../tickets/types';
import { DetailGroupsRow } from '../DetailGroupsRow';
import { GroupTabStrip } from '../GroupTabStrip';
import { GroupViewPage } from '../GroupViewPage';
import { useGroupStore } from '../groupStore';
import type { TabId } from '../groupTabs';
import { NavigationContext } from '../NavigationContext';

const initial = useGroupStore.getState();

type G = {
  id: number;
  name: string;
  color: string;
  position: number;
  createdAt: string;
  memberCount: number;
};
const mkGroup = (id: number, name: string, position: number): G => ({
  id,
  name,
  color: 'blue',
  position,
  createdAt: 't',
  memberCount: 0,
});

function mkTicket(key: string, updated: string, summary = `Summary ${key}`): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { name: 'Open', id: '1', statusCategory: { key: 'new' } } as never,
      priority: { name: 'High', id: '2' },
      assignee: null,
      created: updated,
      updated,
    },
  };
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

let groups: G[];
let memberships: { groupId: number; issueKey: string }[];
let snapshots: JiraTicket[];

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
  groups = [mkGroup(1, 'Sprint', 0), mkGroup(2, 'QA', 1), mkGroup(3, 'Ops', 2)];
  memberships = [];
  snapshots = [];
  invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
    switch (cmd) {
      case 'list_groups':
        return groups.map((g) => ({ ...g }));
      case 'list_group_memberships':
        return memberships.map((m) => ({ ...m }));
      case 'get_group_members':
        return snapshots.map((m) => ({
          issueKey: m.key,
          ticketJson: JSON.stringify(m),
          addedAt: '',
        }));
      case 'remove_issues_from_group': {
        const rm = args.issueKeys as string[];
        memberships = memberships.filter(
          (m) => !(m.groupId === args.groupId && rm.includes(m.issueKey)),
        );
        return rm.length;
      }
      case 'add_issues_to_group': {
        const issues = args.issues as { issueKey: string }[];
        for (const i of issues) {
          memberships.push({ groupId: args.groupId as number, issueKey: i.issueKey });
        }
        return issues.length;
      }
      case 'delete_group':
        groups = groups.filter((g) => g.id !== args.groupId);
        return null;
      default:
        return null;
    }
  });
  useGroupStore.setState({
    ...initial,
    groups: groups.map((g) => ({ ...g })) as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
  useTicketStore.setState({
    tickets: [],
    triageMap: {},
    selectedTicketKey: null,
    lastCompleteFetchSignature: null,
    fetchStatus: 'idle',
  });
});

// ---------------------------------------------------------------------------
// Tab strip menus, popovers and dialogs
// ---------------------------------------------------------------------------

function StripWrapper({ initialTab }: { initialTab: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  return (
    <>
      <button type="button" data-tab-id="new">
        New
      </button>
      <GroupTabStrip activeTab={tab} onTabChange={setTab} />
    </>
  );
}

function setupStrip(initialTab: TabId) {
  const user = userEvent.setup();
  renderWithI18n(<StripWrapper initialTab={initialTab} />);
  return user;
}

const actionsBtn = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) });

async function openMenuWithKeyboard(user: ReturnType<typeof userEvent.setup>, name: string) {
  actionsBtn(name).focus();
  await user.keyboard('{Shift>}{F10}{/Shift}');
}

describe('Escape and focus return: tab strip overlays', () => {
  it('Escape closes the group menu and focuses the tab', async () => {
    const user = setupStrip('group:2');
    await openMenuWithKeyboard(user, 'QA');
    await screen.findByRole('menuitem', { name: 'Rename…' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Rename…' })).toBeNull());
    await waitFor(() => expect(actionsBtn('QA')).toHaveFocus());
  });

  it('Escape closes the rename popover and focuses the tab', async () => {
    const user = setupStrip('group:2');
    await openMenuWithKeyboard(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename…' }));
    const input = await screen.findByRole('textbox', { name: 'Group name' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Group name' })).toBeNull());
    await waitFor(() => expect(actionsBtn('QA')).toHaveFocus());
  });

  it('Escape closes the color popover and focuses the tab', async () => {
    const user = setupStrip('group:2');
    await openMenuWithKeyboard(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Change color…' }));
    await screen.findByRole('radio', { name: 'Purple' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('radio', { name: 'Purple' })).toBeNull());
    await waitFor(() => expect(actionsBtn('QA')).toHaveFocus());
  });

  it('Escape closes the delete dialog (Cancel focused on open) and focuses the tab', async () => {
    const user = setupStrip('group:2');
    await openMenuWithKeyboard(user, 'QA');
    await user.click(await screen.findByRole('menuitem', { name: 'Delete group…' }));
    await screen.findByRole('alertdialog');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Keep group' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(actionsBtn('QA')).toHaveFocus());
    expect(invokeMock.mock.calls.some((c) => c[0] === 'delete_group')).toBe(false);
  });

  it('Escape closes the create popover and focuses the New group trigger', async () => {
    const user = setupStrip('new');
    const trigger = screen.getByRole('button', { name: 'New group' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByLabelText('Group name');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByLabelText('Group name')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('Shift+F10 on a group tab opens its context menu and Escape refocuses the tab', async () => {
    const user = setupStrip('new');
    const tab = screen.getByRole('button', { name: /^Ops,/ });
    tab.focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    await screen.findByRole('menuitem', { name: 'Rename…' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Rename…' })).toBeNull());
    await waitFor(() => expect(tab).toHaveFocus());
  });
});

// ---------------------------------------------------------------------------
// Detail: picker and chips
// ---------------------------------------------------------------------------

const navigate = vi.fn();

function setupDetail() {
  navigate.mockReset();
  memberships = [
    { groupId: 3, issueKey: 'P-1' },
    { groupId: 1, issueKey: 'P-1' },
  ];
  useGroupStore.setState({ groupIdsByIssue: { 'P-1': [3, 1] } });
  const user = userEvent.setup();
  renderWithI18n(
    <NavigationContext.Provider value={{ navigateToGroup: navigate }}>
      <DetailGroupsRow issueKey="P-1" detail={detail} />
    </NavigationContext.Provider>,
  );
  return user;
}

describe('Escape and focus return: detail picker and chips', () => {
  it('Escape closes the picker (detail mode) and focuses the Groups button', async () => {
    const user = setupDetail();
    const groupsBtn = screen.getByRole('button', { name: 'Groups' });
    groupsBtn.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('combobox', { name: 'Search groups' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(groupsBtn).toHaveFocus();
  });

  it('picker: ArrowDown/ArrowUp move the active option; Space toggles membership', async () => {
    const user = setupDetail();
    screen.getByRole('button', { name: 'Groups' }).focus();
    await user.keyboard('{Enter}');
    const input = await screen.findByRole('combobox', { name: 'Search groups' });
    const opt = (n: string) => screen.getByRole('option', { name: new RegExp(n) });
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', opt('QA').id);
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', opt('Sprint').id);
    await user.keyboard('{ArrowDown} ');
    await waitFor(() => expect(opt('QA')).toHaveAttribute('aria-selected', 'true'));
  });

  it('Escape on the chip confirm closes it and focuses the chip x', async () => {
    const user = setupDetail();
    const x = screen.getByRole('button', { name: 'Remove from “Ops”' });
    x.focus();
    await user.keyboard('{Enter}');
    await screen.findByText('Remove from “Ops”?');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Remove from “Ops”?')).toBeNull());
    await waitFor(() => expect(x).toHaveFocus());
    expect(invokeMock.mock.calls.some((c) => c[0] === 'remove_issues_from_group')).toBe(false);
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s on the chip name navigates to the group', async (_label, keys) => {
    const user = setupDetail();
    screen.getByRole('button', { name: 'Go to group “Sprint”' }).focus();
    await user.keyboard(keys);
    expect(navigate).toHaveBeenCalledWith(1);
  });

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s on the chip x opens the remove confirm', async (_label, keys) => {
    const user = setupDetail();
    screen.getByRole('button', { name: 'Remove from “Sprint”' }).focus();
    await user.keyboard(keys);
    expect(await screen.findByText('Remove from “Sprint”?')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Group view: select mode, range select, bar, missing members
// ---------------------------------------------------------------------------

const KEYS = ['T-1', 'T-2', 'T-3', 'T-4', 'T-5'];
const LIVE = KEYS.map((k, i) => mkTicket(k, `2026-01-0${5 - i}T10:00:00.000Z`));

function setupView(opts: {
  keys?: string[];
  live?: JiraTicket[];
  missing?: JiraTicket[];
  eligible?: boolean;
}) {
  const keys = opts.keys ?? KEYS;
  memberships = keys.map((k) => ({ groupId: 2, issueKey: k }));
  snapshots = opts.missing ?? [];
  useGroupStore.setState({
    memberKeysByGroup: { 2: keys },
    groupIdsByIssue: Object.fromEntries(keys.map((k) => [k, [2]])),
  });
  useTicketStore.setState({ tickets: opts.live ?? LIVE });
  if (opts.eligible) {
    useTicketStore.setState({
      lastCompleteFetchSignature: computeFetchSignature(
        currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
      ),
    });
  }
  const user = userEvent.setup();
  renderWithI18n(<GroupViewPage groupId={2} />);
  return user;
}

const selectBtn = () => screen.getByRole('button', { name: 'Select' });
const box = (key: string) => screen.getByRole('checkbox', { name: `Select ${key}` });

async function enterSelectMode(user: ReturnType<typeof userEvent.setup>) {
  selectBtn().focus();
  await user.keyboard('{Enter}');
  expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
}

describe('Escape and focus return: select mode', () => {
  it('Escape on a card checkbox exits select mode and focuses the Select toggle', async () => {
    const user = setupView({});
    await enterSelectMode(user);
    box('T-2').focus();
    await user.keyboard('{Escape}');
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(selectBtn()).toHaveFocus());
  });

  it('Escape in the selection bar exits select mode and focuses the Select toggle', async () => {
    const user = setupView({});
    await enterSelectMode(user);
    box('T-1').focus();
    await user.keyboard(' ');
    const bar = await screen.findByRole('toolbar');
    // Add to group has no tooltip; a focused tooltip trigger (Clear) would consume the first Escape.
    within(bar)
      .getByRole('button', { name: /Add to group/ })
      .focus();
    await user.keyboard('{Escape}');
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(selectBtn()).toHaveFocus());
  });

  it('Escape inside the key filter input does not exit select mode', async () => {
    const user = setupView({});
    await enterSelectMode(user);
    const filter = screen.getByLabelText('Filter tickets by key');
    filter.focus();
    await user.keyboard('{Escape}');
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Shift range select by keyboard', () => {
  it.each([
    ['Space', ' '],
    ['Enter', '{Enter}'],
  ])('Shift+%s on a checkbox selects the range from the anchor', async (_label, key) => {
    const user = setupView({});
    await enterSelectMode(user);
    // DOM order follows sort (updated desc): T-1 .. T-5
    box('T-1').focus();
    await user.keyboard(key);
    expect(box('T-1')).toHaveAttribute('aria-checked', 'true');
    box('T-4').focus();
    await user.keyboard(`{Shift>}${key}{/Shift}`);
    for (const k of ['T-1', 'T-2', 'T-3', 'T-4']) {
      expect(box(k)).toHaveAttribute('aria-checked', 'true');
    }
    expect(box('T-5')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('4 selected');
  });

  it('plain Space toggles a single checkbox without range', async () => {
    const user = setupView({});
    await enterSelectMode(user);
    box('T-1').focus();
    await user.keyboard(' ');
    box('T-4').focus();
    await user.keyboard(' ');
    expect(screen.getByRole('status')).toHaveTextContent('2 selected');
    expect(box('T-2')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Escape and focus return: selection bar', () => {
  it('Escape closes the bar Add picker and focuses the Add to group trigger', async () => {
    const user = setupView({});
    await enterSelectMode(user);
    box('T-1').focus();
    await user.keyboard(' ');
    const add = await screen.findByRole('button', { name: /Add to group/ });
    add.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('option', { name: 'Sprint' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Sprint' })).toBeNull());
    await waitFor(() => expect(add).toHaveFocus());
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
  });

  it('Escape closes the bar Remove confirm and focuses its trigger', async () => {
    const user = setupView({});
    await enterSelectMode(user);
    box('T-1').focus();
    await user.keyboard(' ');
    const remove = await screen.findByRole('button', { name: 'Remove from group' });
    remove.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull());
    await waitFor(() => expect(remove).toHaveFocus());
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Escape and focus return: missing members', () => {
  const A1 = mkTicket('AB-1', '2026-01-01T10:00:00.000Z');
  const M2 = mkTicket('AB-2', '2026-01-02T10:00:00.000Z', 'Gone two');

  it('Escape closes the per-card missing Remove confirm and focuses that Remove button', async () => {
    const user = setupView({
      keys: ['AB-1', 'AB-2'],
      live: [A1],
      missing: [M2],
      eligible: true,
    });
    await screen.findByText('AB-2');
    const trigger = screen.getByRole('button', { name: 'Remove AB-2 from QA' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByText('Remove “AB-2” from “QA”?');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(invokeMock.mock.calls.some((c) => c[0] === 'remove_issues_from_group')).toBe(false);
  });

  it('Escape closes the Remove all missing confirm and focuses that button', async () => {
    const user = setupView({
      keys: ['AB-1', 'AB-2'],
      live: [A1],
      missing: [M2],
      eligible: true,
    });
    await screen.findByText('AB-2');
    const all = screen.getByRole('button', { name: 'Remove all missing' });
    all.focus();
    await user.keyboard('{Enter}');
    await screen.findByText(/It is no longer in results/);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull());
    await waitFor(() => expect(all).toHaveFocus());
    expect(invokeMock.mock.calls.some((c) => c[0] === 'remove_issues_from_group')).toBe(false);
  });
});
