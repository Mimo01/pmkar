import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../../tickets/fetchSignature';
import { isNewCandidate } from '../../tickets/ticketListUtils';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket, TriageEntry } from '../../tickets/types';
import { GroupViewPage } from '../GroupViewPage';
import { useGroupStore } from '../groupStore';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

const mockInvoke = vi.mocked(invoke);

function mk(
  key: string,
  updated: string,
  opts: { done?: boolean; assignee?: string; summary?: string } = {},
): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: opts.summary ?? `Summary ${key}`,
      status: {
        name: opts.done ? 'Done' : 'Open',
        id: '1',
        statusCategory: { key: opts.done ? 'done' : 'new' },
      } as JiraTicket['fields']['status'],
      priority: { name: 'High', id: '2' },
      assignee: opts.assignee ? ({ displayName: opts.assignee } as never) : null,
      created: updated,
      updated,
    },
  };
}

const T1 = mk('T-1', '2026-01-01T10:00:00.000Z', { assignee: 'Alice' });
const T2 = mk('T-2', '2026-01-02T10:00:00.000Z', { assignee: 'Bob' });
const T3 = mk('T-3', '2026-01-03T10:00:00.000Z');
const T4 = mk('T-4', '2026-01-04T10:00:00.000Z');
const T5 = mk('T-5', '2026-01-05T10:00:00.000Z', { done: true });

const triage: Record<string, TriageEntry> = {
  'T-2': { state: 'ignored', copiedKey: null },
  'T-3': { state: 'handled', copiedKey: null },
  'T-4': { state: 'copied', copiedKey: 'DEST-9' },
};

function seed(
  memberKeysByGroup: Record<number, string[]>,
  tickets: JiraTicket[] = [T1, T2, T3, T4, T5],
  triageMap: Record<string, TriageEntry> = triage,
) {
  useGroupStore.setState({ memberKeysByGroup, hydrated: true });
  useTicketStore.setState({ tickets, triageMap, selectedTicketKey: null });
}

function cardFor(key: string): HTMLElement {
  const el = screen.getByText(key).closest<HTMLElement>('[data-testid="ticket-card"]');
  if (!el) throw new Error(`no card for ${key}`);
  return el;
}

describe('GroupViewPage', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue([]);
  });

  it('shows empty state with no add control when group has no entry', () => {
    seed({});
    render(<GroupViewPage groupId={1} />);
    expect(screen.getByText('No issues in this group yet')).toBeInTheDocument();
    expect(screen.getByText(/Add to group/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to group/i })).not.toBeInTheDocument();
    expect(screen.queryByText('T-1')).not.toBeInTheDocument();
  });

  it('shows empty state for an empty member list', () => {
    seed({ 1: [] });
    render(<GroupViewPage groupId={1} />);
    expect(screen.getByText('No issues in this group yet')).toBeInTheDocument();
  });

  it('renders pills, badges and actions per triage state', () => {
    seed({ 1: ['T-1', 'T-2', 'T-3', 'T-4', 'T-5'] });
    render(<GroupViewPage groupId={1} />);
    expect(within(cardFor('T-1')).getByText('New')).toBeInTheDocument();
    expect(within(cardFor('T-2')).getByText('Dismissed')).toBeInTheDocument();
    expect(within(cardFor('T-3')).getByText('Dismissed')).toBeInTheDocument();
    expect(within(cardFor('T-3')).getByText('Handled')).toBeInTheDocument();
    expect(within(cardFor('T-4')).getByText('Already Linked')).toBeInTheDocument();
    expect(within(cardFor('T-4')).getByText('DEST-9')).toBeInTheDocument();
    expect(within(cardFor('T-5')).getAllByText('Done')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Restore' })).toHaveLength(2);
  });

  it('shows the remembered-link hint before Restore on ignored members with a key', () => {
    seed({ 1: ['T-1', 'T-2', 'T-3', 'T-4'] }, [T1, T2, T3, T4], {
      'T-2': { state: 'ignored', copiedKey: 'CLD-9' },
      'T-3': { state: 'handled', copiedKey: 'CLD-9' },
      'T-4': { state: 'copied', copiedKey: 'DEST-9' },
    });
    render(<GroupViewPage groupId={1} />);
    const card = cardFor('T-2');
    expect(card).toHaveTextContent(/Previously linked to CLD-9/);
    const hint = within(card).getByText('CLD-9').parentElement as HTMLElement;
    const restore = within(card).getByRole('button', { name: 'Restore' });
    expect(hint.compareDocumentPosition(restore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cardFor('T-3')).not.toHaveTextContent(/Previously linked/);
    expect(within(cardFor('T-4')).getByText('DEST-9')).toBeInTheDocument();
    expect(cardFor('T-4')).not.toHaveTextContent(/Previously linked/);
    expect(cardFor('T-1')).not.toHaveTextContent(/Previously linked/);
  });

  it('shows no hint for ignored members without a remembered key', () => {
    seed({ 1: ['T-1', 'T-2'] });
    render(<GroupViewPage groupId={1} />);
    expect(cardFor('T-2')).not.toHaveTextContent(/Previously linked/);
  });

  it('renders snapshot-only members as normal cards', async () => {
    seed({ 1: ['T-1', 'GONE-1'] }, [T1]);
    mockInvoke.mockResolvedValue([
      {
        issueKey: 'GONE-1',
        ticketJson: JSON.stringify(mk('GONE-1', '2026-01-09T10:00:00.000Z')),
        addedAt: '',
      },
    ]);
    render(<GroupViewPage groupId={1} />);
    await waitFor(() => expect(screen.getByText('GONE-1')).toBeInTheDocument());
    expect(screen.getByText('T-1')).toBeInTheDocument();
    expect(within(cardFor('GONE-1')).getByText('New')).toBeInTheDocument();
  });

  it('Restore sets state to seen without opening detail', () => {
    seed({ 1: ['T-1', 'T-2'] });
    render(<GroupViewPage groupId={1} />);
    fireEvent.click(within(cardFor('T-2')).getByRole('button', { name: 'Restore' }));
    expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
      ticketKey: 'T-2',
      state: 'seen',
    });
    const st = useTicketStore.getState();
    expect(st.triageMap['T-2'].state).toBe('seen');
    expect(isNewCandidate(T2, st.triageMap)).toBe(true);
    expect(st.selectedTicketKey).toBeNull();
    expect(within(cardFor('T-2')).getByText('New')).toBeInTheDocument();
  });

  it('reflects external triage changes live', () => {
    seed({ 1: ['T-1'] });
    render(<GroupViewPage groupId={1} />);
    expect(within(cardFor('T-1')).getByText('New')).toBeInTheDocument();
    act(() => {
      useTicketStore.setState({
        triageMap: { ...triage, 'T-1': { state: 'ignored', copiedKey: null } },
      });
    });
    expect(within(cardFor('T-1')).getByText('Dismissed')).toBeInTheDocument();
  });

  it('clicking a card selects the ticket', () => {
    seed({ 1: ['T-1'] });
    render(<GroupViewPage groupId={1} />);
    fireEvent.click(within(cardFor('T-1')).getByRole('button', { name: 'Summary T-1' }));
    expect(useTicketStore.getState().selectedTicketKey).toBe('T-1');
  });

  it('sorts by updated desc by default and toggles', () => {
    seed({ 1: ['T-1', 'T-2', 'T-4'] });
    render(<GroupViewPage groupId={1} />);
    const order = () => screen.getAllByText(/^T-\d$/).map((e) => e.textContent);
    expect(order()).toEqual(['T-4', 'T-2', 'T-1']);
    fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }));
    expect(order()).toEqual(['T-1', 'T-2', 'T-4']);
  });

  it('search narrows the list and resets on remount', () => {
    seed({ 1: ['T-1', 'T-2', 'T-4'] });
    const { unmount } = render(<GroupViewPage groupId={1} />);
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), { target: { value: 'T-2' } });
    expect(screen.queryByText('T-1')).not.toBeInTheDocument();
    expect(screen.getByText('T-2')).toBeInTheDocument();
    unmount();
    render(<GroupViewPage groupId={1} />);
    expect(screen.getByLabelText('Filter tickets by key')).toHaveValue('');
    expect(screen.getByText('T-1')).toBeInTheDocument();
  });

  it('shows a no-results state when the filter excludes every member', () => {
    seed({ 1: ['T-1', 'T-2'] });
    render(<GroupViewPage groupId={1} />);
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), { target: { value: 'ZZZ' } });
    expect(screen.getByText('No issues match the current filter')).toBeInTheDocument();
    expect(screen.queryByText('No issues in this group yet')).not.toBeInTheDocument();
  });

  it('shows an inline load error with Retry when snapshots fail to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seed({ 1: ['T-1', 'X-9'] });
    mockInvoke.mockRejectedValueOnce('boom');
    render(<GroupViewPage groupId={1} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Some issues in this group could not be loaded.');
    expect(screen.getByText('T-1')).toBeInTheDocument();
    mockInvoke.mockResolvedValue([
      { issueKey: 'X-9', ticketJson: JSON.stringify(mk('X-9', '2026-01-09T10:00:00.000Z')) },
    ]);
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await screen.findByText('X-9');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('has no fetch control', () => {
    seed({ 1: ['T-1'] });
    render(<GroupViewPage groupId={1} />);
    expect(screen.queryByRole('button', { name: /fetch/i })).not.toBeInTheDocument();
  });
});

describe('GroupViewPage selection', () => {
  const QA = { id: 7, name: 'QA', color: 'blue', position: 0, createdAt: 't', memberCount: 5 };
  const SPRINT = {
    id: 8,
    name: 'Sprint',
    color: 'green',
    position: 1,
    createdAt: 't',
    memberCount: 1,
  };
  let removeFails = false;

  function memberships() {
    return [
      ...['T-1', 'T-2', 'T-3', 'T-4', 'T-5'].map((k) => ({ groupId: 7, issueKey: k })),
      { groupId: 8, issueKey: 'T-1' },
    ];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    removeFails = false;
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((async (cmd: string) => {
      switch (cmd) {
        case 'list_groups':
          return [QA, SPRINT];
        case 'list_group_memberships':
          return memberships();
        case 'remove_issues_from_group':
          if (removeFails) throw 'boom';
          return 3;
        case 'add_issues_to_group':
          return 3;
        default:
          return [];
      }
    }) as never);
    useGroupStore.setState({
      groups: [QA, SPRINT] as never,
      memberKeysByGroup: { 7: ['T-1', 'T-2', 'T-3', 'T-4', 'T-5'], 8: ['T-1'] },
      groupIdsByIssue: { 'T-1': [7, 8], 'T-2': [7], 'T-3': [7], 'T-4': [7], 'T-5': [7] },
      hydrated: true,
    });
    useTicketStore.setState({
      tickets: [T1, T2, T3, T4, T5],
      triageMap: {},
      selectedTicketKey: null,
    });
  });

  const selectBtn = () => screen.getByRole('button', { name: 'Select' });
  const cardBody = (key: string) =>
    within(cardFor(key)).getByRole('button', { name: `Summary ${key}` });
  const callsOf = (cmd: string) => mockInvoke.mock.calls.filter((c) => c[0] === cmd);

  async function selectT1toT3() {
    await userEvent.click(selectBtn());
    await userEvent.click(cardBody('T-1'));
    fireEvent.click(cardBody('T-3'), { shiftKey: true });
    await screen.findByText('3 selected', { selector: '[aria-hidden="true"]' });
  }

  it('shows Select toggle, hides own group chip and keeps other chips', () => {
    render(<GroupViewPage groupId={7} />);
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'false');
    expect(within(cardFor('T-1')).getByText('Sprint')).toBeInTheDocument();
    expect(within(cardFor('T-1')).queryByText('QA')).not.toBeInTheDocument();
  });

  it('selects with click and shift-range without opening detail', async () => {
    render(<GroupViewPage groupId={7} />);
    await userEvent.click(selectBtn());
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    await userEvent.click(cardBody('T-1'));
    expect(screen.getByRole('status')).toHaveTextContent('1 selected');
    expect(useTicketStore.getState().selectedTicketKey).toBeNull();
    fireEvent.click(cardBody('T-3'), { shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('3 selected');
  });

  it('offers Remove and an Add picker that excludes the current group', async () => {
    render(<GroupViewPage groupId={7} />);
    await selectT1toT3();
    expect(screen.getByRole('button', { name: 'Remove from group' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Add to group/ }));
    expect(await screen.findByRole('option', { name: 'Sprint' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'QA' })).not.toBeInTheDocument();
  });

  it('removes the confirmed selection in one call and ends select mode', async () => {
    render(<GroupViewPage groupId={7} />);
    await selectT1toT3();
    await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
    expect(callsOf('remove_issues_from_group')).toHaveLength(0);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(callsOf('remove_issues_from_group')).toHaveLength(1));
    const args = callsOf('remove_issues_from_group')[0][1] as {
      groupId: number;
      issueKeys: string[];
    };
    expect(args.groupId).toBe(7);
    expect(args.issueKeys).toHaveLength(3);
    await waitFor(() => expect(selectBtn()).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(toast.success).toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(selectBtn()));
  });

  it('keeps the selection when remove fails', async () => {
    removeFails = true;
    render(<GroupViewPage groupId={7} />);
    await selectT1toT3();
    await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('3 selected');
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds the selection to another group and ends select mode', async () => {
    render(<GroupViewPage groupId={7} />);
    await selectT1toT3();
    await userEvent.click(screen.getByRole('button', { name: /Add to group/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Sprint' }));
    await waitFor(() => expect(callsOf('add_issues_to_group')).toHaveLength(1));
    const args = callsOf('add_issues_to_group')[0][1] as { groupId: number; issues: unknown[] };
    expect(args.groupId).toBe(8);
    expect(args.issues).toHaveLength(3);
    await waitFor(() => expect(selectBtn()).toHaveAttribute('aria-pressed', 'false'));
  });

  it('drops selected issues hidden by a search', async () => {
    render(<GroupViewPage groupId={7} />);
    await selectT1toT3();
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), {
      target: { value: 'T-1' },
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 selected'));
  });

  it('Esc on a card checkbox exits select mode and focuses the toggle', async () => {
    render(<GroupViewPage groupId={7} />);
    await userEvent.click(selectBtn());
    screen.getAllByRole('checkbox')[0].focus();
    await userEvent.keyboard('{Escape}');
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(document.activeElement).toBe(selectBtn()));
  });

  it('Esc inside the Remove confirm only closes it', async () => {
    render(<GroupViewPage groupId={7} />);
    await selectT1toT3();
    await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
    await screen.findByRole('button', { name: 'Remove' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument(),
    );
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('3 selected');
  });

  it('discards the selection on remount', async () => {
    const { unmount } = render(<GroupViewPage groupId={7} />);
    await selectT1toT3();
    unmount();
    render(<GroupViewPage groupId={7} />);
    expect(selectBtn()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('Restore in select mode does not toggle selection', async () => {
    useTicketStore.setState({ triageMap: triage });
    render(<GroupViewPage groupId={7} />);
    await userEvent.click(selectBtn());
    await userEvent.click(within(cardFor('T-2')).getByRole('button', { name: 'Restore' }));
    expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
      ticketKey: 'T-2',
      state: 'seen',
    });
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
});

describe('GroupViewPage missing members', () => {
  const QA = { id: 7, name: 'QA', color: 'blue', position: 0, createdAt: 't', memberCount: 4 };
  const A1 = mk('AB-1', '2026-01-01T10:00:00.000Z');
  const A3 = mk('AB-3', '2026-01-03T10:00:00.000Z');
  const M2 = mk('AB-2', '2026-01-02T10:00:00.000Z', { summary: 'Gone two alpha' });
  const M4 = mk('AB-4', '2026-01-04T10:00:00.000Z', { summary: 'Gone four beta' });
  let removeFails = false;
  let memberKeys: string[] = [];

  function makeEligible() {
    useTicketStore.setState({
      lastCompleteFetchSignature: computeFetchSignature(
        currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
      ),
    });
  }

  function setup(opts: { eligible: boolean; keys: string[]; live: JiraTicket[] }) {
    memberKeys = [...opts.keys];
    useGroupStore.setState({
      groups: [QA] as never,
      memberKeysByGroup: { 7: opts.keys },
      hydrated: true,
    });
    useTicketStore.setState({
      tickets: opts.live,
      triageMap: {},
      selectedTicketKey: null,
      lastCompleteFetchSignature: null,
      fetchStatus: 'idle',
    });
    if (opts.eligible) makeEligible();
  }

  const callsOf = (cmd: string) => mockInvoke.mock.calls.filter((c) => c[0] === cmd);
  const order = () => screen.getAllByText(/^AB-\d$/).map((e) => e.textContent);

  beforeEach(() => {
    vi.clearAllMocks();
    removeFails = false;
    Element.prototype.scrollIntoView = vi.fn();
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((async (cmd: string, args: unknown) => {
      switch (cmd) {
        case 'get_group_members':
          return [M2, M4].map((m) => ({
            issueKey: m.key,
            ticketJson: JSON.stringify(m),
            addedAt: '',
          }));
        case 'list_groups':
          return [QA];
        case 'list_group_memberships':
          return memberKeys.map((k) => ({ groupId: 7, issueKey: k }));
        case 'remove_issues_from_group': {
          if (removeFails) throw 'boom';
          const rm = (args as { issueKeys: string[] }).issueKeys;
          memberKeys = memberKeys.filter((k) => !rm.includes(k));
          return rm.length;
        }
        default:
          return [];
      }
    }) as never);
  });

  it('renders absent members undimmed with no missing UI when hints are gated off', async () => {
    setup({ eligible: false, keys: ['AB-1', 'AB-2'], live: [A1] });
    const { container } = render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    expect(container.innerHTML).not.toContain('opacity-70');
    expect(screen.queryByText(/No longer in results/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove AB-2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('shows present first, then a labelled missing block; count includes missing', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    const region = screen.getByRole('group', { name: 'No longer in results (1)' });
    expect(within(region).getByText('AB-2')).toBeInTheDocument();
    expect(within(region).queryByText('AB-1')).not.toBeInTheDocument();
    expect(within(cardFor('AB-2')).getByText('No longer in results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove AB-2 from QA' })).toBeInTheDocument();
    expect(screen.getByText(/^2 /)).toBeInTheDocument();
  });

  it('orders present then missing, each in the chosen sort', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-3', 'AB-4'], live: [A1, A3] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    expect(order()).toEqual(['AB-3', 'AB-1', 'AB-4', 'AB-2']);
    fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }));
    expect(order()).toEqual(['AB-1', 'AB-3', 'AB-2', 'AB-4']);
  });

  it('search narrows the missing block and its count', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-4'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), { target: { value: 'AB-2' } });
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('No longer in results (1)');
    expect(screen.queryByText('AB-4')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), { target: { value: 'AB-1' } });
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('a missing card is still clickable and opens detail', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    fireEvent.click(within(cardFor('AB-2')).getByRole('button', { name: 'Gone two alpha' }));
    expect(useTicketStore.getState().selectedTicketKey).toBe('AB-2');
  });

  it('per-card Remove: Cancel does nothing, Remove calls once without success toast', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Remove AB-2 from QA' }));
    expect(await screen.findByText('Remove “AB-2” from “QA”?')).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await userEvent.click(cancel);
    expect(callsOf('remove_issues_from_group')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Remove AB-2 from QA' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(callsOf('remove_issues_from_group')).toHaveLength(1));
    expect(callsOf('remove_issues_from_group')[0][1]).toEqual({ groupId: 7, issueKeys: ['AB-2'] });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('per-card Remove failure toasts and keeps the member', async () => {
    removeFails = true;
    setup({ eligible: true, keys: ['AB-1', 'AB-2'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Remove AB-2 from QA' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('AB-2')).toBeInTheDocument();
  });

  it('focus moves to the next missing card after a successful removal', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-4'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    // updated desc: missing order is AB-4, AB-2; remove AB-4, focus AB-2
    await userEvent.click(screen.getByRole('button', { name: 'Remove AB-4 from QA' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(cardFor('AB-2')).getByRole('button', { name: 'Gone two alpha' }),
      ),
    );
  });

  it('Remove all missing uses the group-wide count and one call', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-4'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), { target: { value: 'AB-2' } });
    await userEvent.click(screen.getByRole('button', { name: 'Remove all missing' }));
    expect(
      await screen.findByText('Remove 2 issues from “QA”? They are no longer in results.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(callsOf('remove_issues_from_group')).toHaveLength(1));
    const args = callsOf('remove_issues_from_group')[0][1] as { issueKeys: string[] };
    expect([...args.issueKeys].sort()).toEqual(['AB-2', 'AB-4']);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('WR-08: while a fetch is loading, Remove triggers stay visible but disabled with a hint', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2'], live: [A1] });
    act(() => useTicketStore.setState({ fetchStatus: 'loading' }));
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    const hint = 'Refreshing results… Remove is available when the fetch finishes.';
    const perCard = screen.getByRole('button', { name: 'Remove AB-2 from QA' });
    const all = screen.getByRole('button', { name: 'Remove all missing' });
    expect(perCard).toBeDisabled();
    expect(perCard).toHaveAttribute('title', hint);
    expect(all).toBeDisabled();
    expect(all).toHaveAttribute('title', hint);
    act(() => useTicketStore.setState({ fetchStatus: 'idle' }));
    expect(screen.getByRole('button', { name: 'Remove AB-2 from QA' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Remove all missing' })).toBeEnabled();
  });

  it('WR-08: a fetch starting while the confirm is open disables Remove instead of a silent no-op', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Remove AB-2 from QA' }));
    await screen.findByText('Remove “AB-2” from “QA”?');
    act(() => useTicketStore.setState({ fetchStatus: 'loading' }));
    expect(screen.getByText(/Refreshing results/)).toBeInTheDocument();
    const remove = screen.getByRole('button', { name: 'Remove' });
    expect(remove).toBeDisabled();
    await userEvent.click(remove);
    expect(callsOf('remove_issues_from_group')).toHaveLength(0);
    // Popover stays open; once the fetch settles the user can confirm.
    act(() => useTicketStore.setState({ fetchStatus: 'idle' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(callsOf('remove_issues_from_group')).toHaveLength(1));
  });

  it('Remove all missing removes nothing when gating flips off before confirm', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Remove all missing' }));
    await screen.findByText(/It is no longer in results/);
    act(() => useTicketStore.getState().markFetchIncomplete());
    // The missing block (and its popover) unmounts when hints are no longer eligible.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument(),
    );
    expect(callsOf('remove_issues_from_group')).toHaveLength(0);
  });

  it('per-card confirm does not re-open when the member returns and goes missing again', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-4'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Remove AB-2 from QA' }));
    expect(await screen.findByText('Remove “AB-2” from “QA”?')).toBeInTheDocument();
    act(() => useTicketStore.setState({ tickets: [A1, M2] }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument(),
    );
    act(() => useTicketStore.setState({ tickets: [A1] }));
    await screen.findByRole('button', { name: 'Remove AB-2 from QA' });
    expect(screen.queryByText('Remove “AB-2” from “QA”?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('per-card confirm does not re-open after a filter hides and restores the card', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-4'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Remove AB-2 from QA' }));
    await screen.findByText('Remove “AB-2” from “QA”?');
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), { target: { value: 'AB-4' } });
    await waitFor(() => expect(screen.queryByText('AB-2')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Filter tickets by key'), { target: { value: '' } });
    await screen.findByText('AB-2');
    expect(screen.queryByText('Remove “AB-2” from “QA”?')).not.toBeInTheDocument();
  });

  it('Remove all missing confirm does not re-open when the block disappears and reappears', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-4'], live: [A1] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Remove all missing' }));
    await screen.findByText(/They are no longer in results/);
    act(() => useTicketStore.setState({ tickets: [A1, M2, M4] }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove all missing' })).not.toBeInTheDocument(),
    );
    act(() => useTicketStore.setState({ tickets: [A1] }));
    await screen.findByRole('button', { name: 'Remove all missing' });
    expect(screen.queryByText(/They are no longer in results/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('select mode: shift-range follows present-then-missing DOM order', async () => {
    setup({ eligible: true, keys: ['AB-1', 'AB-2', 'AB-3', 'AB-4'], live: [A1, A3] });
    render(<GroupViewPage groupId={7} />);
    await screen.findByText('AB-2');
    await userEvent.click(screen.getByRole('button', { name: 'Select' }));
    // DOM order: AB-3, AB-1, AB-4, AB-2
    await userEvent.click(within(cardFor('AB-1')).getByRole('checkbox'));
    fireEvent.click(within(cardFor('AB-4')).getByRole('checkbox'), { shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('2 selected');
  });
});
