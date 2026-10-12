import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isNewCandidate } from '../../tickets/ticketListUtils';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket, TriageEntry } from '../../tickets/types';
import { GroupViewPage } from '../GroupViewPage';
import { useGroupStore } from '../groupStore';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';

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
  const el = screen.getByText(key).closest('button');
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
    fireEvent.click(cardFor('T-1'));
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
