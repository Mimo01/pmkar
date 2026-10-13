import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../../tickets/fetchSignature';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket, JiraTicketDetail } from '../../tickets/types';
import { DetailGroupsRow } from '../DetailGroupsRow';
import { GroupPicker } from '../GroupPicker';
import { GroupTabStrip } from '../GroupTabStrip';
import { GroupViewPage } from '../GroupViewPage';
import { useGroupStore } from '../groupStore';
import type { TabId } from '../groupTabs';
import { NavigationContext } from '../NavigationContext';
import { SelectionBar } from '../SelectionBar';

/*
 * GQA-02: axe-core over every D-01 key state. Always runs on document.body because Radix
 * popovers, menus and dialogs render in a portal outside the render container.
 *
 * color-contrast is disabled globally in this file: jsdom cannot compute layout or resolved
 * colors, so contrast is verified at the token level by contrast.test.ts instead.
 *
 * region is disabled as a confirmed fragment false positive: it is a whole-page rule ("all page
 * content must be inside landmarks") and these tests mount isolated components with no app shell
 * (no <main>/<header>), so it fires on every state. App-level landmarks are outside GQA-02 scope.
 */
const AXE_OPTIONS = {
  rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
};

async function expectNoViolations() {
  const results = await axe(document.body, AXE_OPTIONS);
  expect(results).toHaveNoViolations();
}

const initial = useGroupStore.getState();
const groupsSeed = [
  { id: 1, name: 'Sprint 12', color: 'blue', position: 0, createdAt: 't', memberCount: 3 },
  { id: 2, name: 'QA', color: 'teal', position: 1, createdAt: 't', memberCount: 1 },
  { id: 3, name: 'Ops', color: 'slate', position: 2, createdAt: 't', memberCount: 0 },
];

function mkTicket(key: string, summary = `Summary ${key}`): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { name: 'Open', id: '1', statusCategory: { key: 'new' } },
      priority: { name: 'High', id: '2' },
      assignee: null,
      created: '2026-01-01T10:00:00.000Z',
      updated: '2026-01-01T10:00:00.000Z',
    },
  } as unknown as JiraTicket;
}

const detail = {
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
} as unknown as JiraTicketDetail;

let memberships: { groupId: number; issueKey: string }[] = [];
let snapshots: { issueKey: string; ticketJson: string; addedAt: string }[] = [];

function seedStore(overrides: Record<string, unknown> = {}) {
  useGroupStore.setState({
    ...initial,
    groups: groupsSeed.map((g) => ({ ...g })) as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
    ...overrides,
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
  vi.clearAllMocks();
  invokeMock.mockReset();
  memberships = [];
  snapshots = [];
  invokeMock.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case 'list_groups':
        return groupsSeed.map((g) => ({ ...g }));
      case 'list_group_memberships':
        return memberships;
      case 'list_group_snapshots':
      case 'get_group_snapshots':
        return snapshots;
      default:
        return [];
    }
  });
  seedStore();
  useTicketStore.setState({
    tickets: [],
    triageMap: {},
    selectedTicketKey: null,
    lastCompleteFetchSignature: null,
  });
});

function TabStripHarness({ initialTab }: { initialTab: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  return <GroupTabStrip activeTab={tab} onTabChange={setTab} />;
}

async function openActions(user: ReturnType<typeof userEvent.setup>, name: string) {
  screen.getByRole('button', { name: new RegExp(`^${name},`) }).focus();
  await user.keyboard('{Shift>}{F10}{/Shift}');
}

describe('group UI axe (D-01 key states)', () => {
  it('1. tab strip with 3 groups including an active one', async () => {
    renderWithI18n(<TabStripHarness initialTab="group:1" />);
    await expectNoViolations();
  });

  it('2. open actions menu', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TabStripHarness initialTab="group:1" />);
    await openActions(user, 'Sprint 12');
    await screen.findByRole('menuitem', { name: 'Rename…' });
    await expectNoViolations();
  });

  it('3. rename popover', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TabStripHarness initialTab="group:1" />);
    await openActions(user, 'Sprint 12');
    await user.click(await screen.findByRole('menuitem', { name: 'Rename…' }));
    await screen.findByRole('textbox', { name: 'Group name' });
    await expectNoViolations();
  });

  it('4. change-color popover', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TabStripHarness initialTab="group:1" />);
    await openActions(user, 'Sprint 12');
    const item = await screen.findByRole('menuitem', { name: /color/i });
    await user.click(item);
    await screen.findAllByRole('radio');
    await expectNoViolations();
  });

  it('5. delete alertdialog', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TabStripHarness initialTab="group:1" />);
    await openActions(user, 'Sprint 12');
    await user.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await screen.findByRole('alertdialog');
    await expectNoViolations();
  });

  it('6. create popover', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TabStripHarness initialTab="new" />);
    await user.click(screen.getByRole('button', { name: /New group/i }));
    await screen.findByRole('textbox');
    await expectNoViolations();
  });

  it('7. picker detail (checkbox) mode', async () => {
    memberships = [{ groupId: 2, issueKey: 'P-1' }];
    seedStore({ groupIdsByIssue: { 'P-1': [2] } });
    renderWithI18n(
      <GroupPicker
        mode="checkbox"
        issueKey="P-1"
        resolveTicket={() => mkTicket('P-1')}
        open
        onOpenChange={vi.fn()}
      >
        <button type="button">Groups</button>
      </GroupPicker>,
    );
    await screen.findByRole('listbox');
    await expectNoViolations();
  });

  it('8. picker bar (list) mode', async () => {
    renderWithI18n(
      <GroupPicker
        mode="list"
        tickets={[mkTicket('A-1'), mkTicket('A-2')]}
        onAddSucceeded={vi.fn()}
        open
        onOpenChange={vi.fn()}
      >
        <button type="button">Add</button>
      </GroupPicker>,
    );
    await screen.findByRole('listbox');
    await expectNoViolations();
  });

  it('9. select mode with 2 selected cards and the selection bar', async () => {
    const user = userEvent.setup();
    const T1 = mkTicket('T-1');
    const T2 = mkTicket('T-2');
    seedStore({ memberKeysByGroup: { 1: ['T-1', 'T-2'] } });
    useTicketStore.setState({ tickets: [T1, T2] });
    memberships = [
      { groupId: 1, issueKey: 'T-1' },
      { groupId: 1, issueKey: 'T-2' },
    ];
    render(<GroupViewPage groupId={1} />);
    await user.click(screen.getByRole('button', { name: 'Select' }));
    const card = (k: string) =>
      within(
        screen.getByText(k).closest<HTMLElement>('[data-testid="ticket-card"]') as HTMLElement,
      );
    await user.click(card('T-1').getByRole('button', { name: 'Summary T-1' }));
    await user.click(card('T-2').getByRole('button', { name: 'Summary T-2' }));
    await screen.findByText('2 selected', { selector: '[aria-hidden="true"]' });
    await expectNoViolations();
  });

  it('10. group view empty', async () => {
    seedStore({ memberKeysByGroup: { 1: [] } });
    render(<GroupViewPage groupId={1} />);
    await screen.findByText('No issues in this group yet');
    await expectNoViolations();
  });

  it('11. group view populated', async () => {
    seedStore({ memberKeysByGroup: { 1: ['T-1', 'T-2'] }, groupIdsByIssue: { 'T-1': [1, 2] } });
    useTicketStore.setState({ tickets: [mkTicket('T-1'), mkTicket('T-2')] });
    render(<GroupViewPage groupId={1} />);
    await screen.findByText('T-1');
    await expectNoViolations();
  });

  it('12. group view with a missing block', async () => {
    seedStore({ memberKeysByGroup: { 1: ['T-1', 'GONE-1'] } });
    useTicketStore.setState({ tickets: [mkTicket('T-1')] });
    useTicketStore.setState({
      lastCompleteFetchSignature: computeFetchSignature(
        currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
      ),
    });
    snapshots = [
      { issueKey: 'GONE-1', ticketJson: JSON.stringify(mkTicket('GONE-1')), addedAt: '' },
    ];
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_groups') return groupsSeed;
      if (cmd === 'list_group_memberships') return memberships;
      return snapshots;
    });
    await act(async () => {
      render(<GroupViewPage groupId={1} />);
    });
    await screen.findByText('GONE-1');
    await expectNoViolations();
  });

  it('13. detail groups row with chips', async () => {
    seedStore({ groupIdsByIssue: { 'P-1': [1, 3] } });
    renderWithI18n(
      <NavigationContext.Provider value={{ navigateToGroup: vi.fn() }}>
        <DetailGroupsRow issueKey="P-1" detail={detail} />
      </NavigationContext.Provider>,
    );
    await screen.findByRole('button', { name: 'Go to group “Sprint 12”' });
    await expectNoViolations();
  });

  it('14. chip remove confirm popover', async () => {
    const user = userEvent.setup();
    seedStore({ groupIdsByIssue: { 'P-1': [1, 3] } });
    renderWithI18n(
      <NavigationContext.Provider value={{ navigateToGroup: vi.fn() }}>
        <DetailGroupsRow issueKey="P-1" detail={detail} />
      </NavigationContext.Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Remove from “Ops”' }));
    await screen.findByText('Remove from “Ops”?');
    await expectNoViolations();
  });

  it('15. selection bar renders a status live region', async () => {
    renderWithI18n(
      <SelectionBar
        selectedTickets={[mkTicket('P-1'), mkTicket('P-2')]}
        onClear={vi.fn()}
        onActionSucceeded={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('2 selected');
    await expectNoViolations();
  });
});

function expectNoDotsAndNamedColor() {
  expect(document.body.querySelectorAll('[style*="background-color"]').length).toBe(0);
  const colored = document.body.querySelectorAll<HTMLElement>('[style*="--group-color"]');
  expect(colored.length).toBeGreaterThan(0);
  for (const el of colored) {
    expect(`${el.getAttribute('aria-label') ?? ''}${el.textContent ?? ''}`.trim()).not.toBe('');
  }
}

describe('group colour is never the only signal', () => {
  it('tab accessible name contains name and count; no colour dots, colour carriers show the name', () => {
    renderWithI18n(<TabStripHarness initialTab="group:1" />);
    for (const g of groupsSeed) {
      const tab = screen.getByRole('button', { name: new RegExp(`^${g.name},`) });
      expect(tab.getAttribute('aria-label') ?? tab.textContent).toContain(g.name);
      expect(tab.getAttribute('aria-label') ?? tab.textContent).toMatch(/\d/);
    }
    expectNoDotsAndNamedColor();
  });

  it('chips: no colour dots, colour carriers show the name and buttons carry the group name', () => {
    seedStore({ groupIdsByIssue: { 'P-1': [1, 3] } });
    renderWithI18n(
      <NavigationContext.Provider value={{ navigateToGroup: vi.fn() }}>
        <DetailGroupsRow issueKey="P-1" detail={detail} />
      </NavigationContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Go to group “Sprint 12”' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to group “Ops”' })).toBeInTheDocument();
    expectNoDotsAndNamedColor();
  });

  it('picker rows: no dots and option names contain the group name', async () => {
    renderWithI18n(
      <GroupPicker
        mode="list"
        tickets={[mkTicket('A-1')]}
        onAddSucceeded={vi.fn()}
        open
        onOpenChange={vi.fn()}
      >
        <button type="button">Add</button>
      </GroupPicker>,
    );
    for (const g of groupsSeed) {
      expect(await screen.findByRole('option', { name: new RegExp(g.name) })).toBeInTheDocument();
    }
    expectNoDotsAndNamedColor();
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0));
  });
});
