import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
import type { JiraTicket } from '../../tickets/types';
import { pickDefaultColor } from '../colors';
import { GroupPicker } from '../GroupPicker';
import { useGroupStore } from '../groupStore';

const initial = useGroupStore.getState();

function mkGroup(id: number, name: string, position: number, color = 'blue') {
  return { id, name, color, position, createdAt: 't', memberCount: 0 };
}
function mkTicket(key: string): JiraTicket {
  return {
    id: key,
    key,
    fields: { summary: 's', status: { name: 'x' }, priority: null, assignee: null, updated: 'u' },
  } as unknown as JiraTicket;
}

const seedGroups = () => [mkGroup(1, 'Sprint 12', 0), mkGroup(2, 'Écrans', 1), mkGroup(3, 'QA', 2)];
const ticketP1 = mkTicket('P-1');

// Backend simulation
let backendGroups: ReturnType<typeof mkGroup>[];
let memberships: { groupId: number; issueKey: string }[];
let addBehavior: (args: { groupId: number; issues: { issueKey: string }[] }) => Promise<unknown>;
let removeBehavior: () => Promise<unknown>;
let createBehavior: (args: { name: string; color: string }) => Promise<unknown>;

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
  backendGroups = seedGroups();
  memberships = [{ groupId: 3, issueKey: 'P-1' }];
  addBehavior = async (args) => {
    for (const i of args.issues) memberships.push({ groupId: args.groupId, issueKey: i.issueKey });
    return args.issues.length;
  };
  removeBehavior = async () => 1;
  createBehavior = async (args) => {
    const g = mkGroup(10, args.name, backendGroups.length, args.color);
    backendGroups.push(g);
    return g;
  };
  invokeMock.mockImplementation(async (cmd: string, args: never) => {
    switch (cmd) {
      case 'list_groups':
        return backendGroups;
      case 'list_group_memberships':
        return memberships;
      case 'add_issues_to_group':
        return addBehavior(args);
      case 'remove_issues_from_group': {
        const a = args as { groupId: number; issueKeys: string[] };
        const r = await removeBehavior();
        memberships = memberships.filter(
          (m) => !(m.groupId === a.groupId && a.issueKeys.includes(m.issueKey)),
        );
        return r;
      }
      case 'create_group':
        return createBehavior(args);
      default:
        return null;
    }
  });
  const ids: Record<string, number[]> = { 'P-1': [3] };
  useGroupStore.setState({
    ...initial,
    groups: seedGroups() as never,
    memberKeysByGroup: {},
    groupIdsByIssue: ids,
    hydrated: true,
    hydrateError: false,
  });
});

const onOpenChange = vi.fn();

function CheckboxHarness() {
  const [open, setOpen] = useState(true);
  return (
    <GroupPicker
      mode="checkbox"
      issueKey="P-1"
      resolveTicket={() => ticketP1}
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        setOpen(o);
      }}
    >
      <button type="button">Groups</button>
    </GroupPicker>
  );
}

function ListHarness({ onAddSucceeded }: { onAddSucceeded: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <GroupPicker
      mode="list"
      tickets={[mkTicket('A-1'), mkTicket('A-2'), mkTicket('A-3')]}
      excludeGroupId={2}
      onAddSucceeded={onAddSucceeded}
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        setOpen(o);
      }}
    >
      <button type="button">Add</button>
    </GroupPicker>
  );
}

async function setupCheckbox() {
  const user = userEvent.setup();
  renderWithI18n(<CheckboxHarness />);
  const input = await screen.findByRole('combobox', { name: 'Search groups' });
  return { user, input };
}

const opt = (name: string) => screen.getByRole('option', { name: new RegExp(name) });
const addCalls = () => invokeMock.mock.calls.filter((c) => c[0] === 'add_issues_to_group');

describe('GroupPicker checkbox mode', () => {
  it('focuses search and lists groups in tab order with membership', async () => {
    const { input } = await setupCheckbox();
    expect(input).toHaveFocus();
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Sprint 12', 'Écrans', 'QA']);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    expect(opt('QA')).toHaveAttribute('aria-selected', 'true');
    expect(opt('Sprint 12')).toHaveAttribute('aria-selected', 'false');
  });

  it('filters ignoring case and diacritics', async () => {
    const { user, input } = await setupCheckbox();
    await user.type(input, 'ecr');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Écrans',
      expect.stringContaining('Create'),
    ]);
    await user.clear(input);
    await user.type(input, 'SPRINT');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Sprint 12',
      expect.stringContaining('Create'),
    ]);
  });

  it('adds immediately on click and stays open', async () => {
    const { user } = await setupCheckbox();
    await user.click(opt('Sprint 12'));
    await waitFor(() => expect(opt('Sprint 12')).toHaveAttribute('aria-selected', 'true'));
    expect(addCalls()).toHaveLength(1);
    expect(addCalls()[0][1]).toMatchObject({ groupId: 1 });
    expect((addCalls()[0][1] as { issues: { issueKey: string }[] }).issues).toHaveLength(1);
    expect((addCalls()[0][1] as { issues: { issueKey: string }[] }).issues[0].issueKey).toBe('P-1');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('status')).toHaveTextContent('Added to “Sprint 12”');
  });

  it('removes immediately without confirmation', async () => {
    const { user } = await setupCheckbox();
    await user.click(opt('QA'));
    await waitFor(() => expect(opt('QA')).toHaveAttribute('aria-selected', 'false'));
    const rm = invokeMock.mock.calls.find((c) => c[0] === 'remove_issues_from_group');
    expect(rm?.[1]).toEqual({ groupId: 3, issueKeys: ['P-1'] });
    expect(screen.getByRole('status')).toHaveTextContent('Removed from “QA”');
  });

  it('is not optimistic and guards double clicks per group', async () => {
    let release: (v: number) => void = () => {};
    addBehavior = (args) =>
      new Promise((resolve) => {
        release = (v) => {
          memberships.push({ groupId: args.groupId, issueKey: 'P-1' });
          resolve(v);
        };
      });
    const { user } = await setupCheckbox();
    await user.click(opt('Sprint 12'));
    expect(opt('Sprint 12')).toHaveAttribute('aria-selected', 'false');
    await user.click(opt('Sprint 12'));
    expect(addCalls()).toHaveLength(1);
    await act(async () => release(1));
    await waitFor(() => expect(opt('Sprint 12')).toHaveAttribute('aria-selected', 'true'));
  });

  it('shows an inline error on failure and leaves state unchanged', async () => {
    addBehavior = async () => {
      throw { code: 'not_found' };
    };
    const { user } = await setupCheckbox();
    await user.click(opt('Sprint 12'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This group no longer exists.');
    expect(opt('Sprint 12')).toHaveAttribute('aria-selected', 'false');
  });

  it('errors when ok result is not reflected in the store (Pitfall 6)', async () => {
    addBehavior = async () => 1; // does not record the membership
    const { user } = await setupCheckbox();
    await user.click(opt('Sprint 12'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update the group. Try again.',
    );
  });

  it('supports keyboard navigation and activation', async () => {
    const { user, input } = await setupCheckbox();
    expect(input).toHaveAttribute('aria-activedescendant', opt('Sprint 12').id);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', opt('Écrans').id);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', opt('QA').id);
    await user.keyboard('{Home}');
    expect(input).toHaveAttribute('aria-activedescendant', opt('Sprint 12').id);
    await user.keyboard('{End}');
    expect(input).toHaveAttribute('aria-activedescendant', opt('QA').id);
    await user.keyboard('{Home}{Enter}');
    await waitFor(() => expect(opt('Sprint 12')).toHaveAttribute('aria-selected', 'true'));
  });

  it('Space toggles only when the search is empty', async () => {
    const { user, input } = await setupCheckbox();
    await user.keyboard(' ');
    await waitFor(() => expect(opt('Sprint 12')).toHaveAttribute('aria-selected', 'true'));
    await user.type(input, 'a');
    await user.keyboard(' ');
    expect(input).toHaveValue('a ');
    expect(addCalls()).toHaveLength(1);
  });

  it('Esc closes and returns focus to the trigger', async () => {
    const { user } = await setupCheckbox();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Groups' })).toHaveFocus();
  });

  it('shows empty and no-match lines', async () => {
    useGroupStore.setState({ groups: [] as never, groupIdsByIssue: {} });
    const { unmount } = renderWithI18n(<CheckboxHarness />);
    expect(
      await screen.findByText('No groups yet. Type a name to create one.'),
    ).toBeInTheDocument();
    unmount();
    useGroupStore.setState({ groups: seedGroups() as never });
    const { user, input } = await setupCheckbox();
    await user.type(input, 'New');
    expect(screen.getByText('No groups match “New”')).toBeInTheDocument();
  });
});

describe('GroupPicker create row', () => {
  it('creates, adds the issue, stays open with the new group checked', async () => {
    const { user, input } = await setupCheckbox();
    await user.type(input, 'Release');
    const create = screen.getByRole('option', { name: 'Create “Release”' });
    expect(input).toHaveAttribute('aria-activedescendant', create.id);
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(opt('Release')).toHaveAttribute('aria-selected', 'true'));
    const created = invokeMock.mock.calls.find((c) => c[0] === 'create_group');
    expect(created?.[1]).toEqual({
      name: 'Release',
      color: pickDefaultColor(seedGroups().map((g) => g.color)),
    });
    expect(addCalls()).toHaveLength(1);
    expect(addCalls()[0][1]).toMatchObject({ groupId: 10 });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('hides Create for exact duplicates and selects the match', async () => {
    const { user, input } = await setupCheckbox();
    await user.type(input, 'qa');
    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-activedescendant', opt('QA').id);
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('disables Create for too_long names', async () => {
    const { user, input } = await setupCheckbox();
    await user.type(input, 'x'.repeat(41));
    expect(screen.getByRole('alert')).toHaveTextContent('Name can be at most 40 characters');
    const create = screen.getByRole('option', { name: /Create/ });
    expect(create).toHaveAttribute('aria-disabled', 'true');
    await user.click(create);
    expect(invokeMock.mock.calls.some((c) => c[0] === 'create_group')).toBe(false);
  });

  it('disables Create for reserved names', async () => {
    const { user, input } = await setupCheckbox();
    await user.type(input, 'New');
    expect(screen.getByRole('alert')).toHaveTextContent('This name is reserved for a built-in tab');
    expect(screen.getByRole('option', { name: /Create/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows no Create row for whitespace', async () => {
    const { user, input } = await setupCheckbox();
    await user.type(input, '   ');
    expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeEmptyDOMElement();
  });

  it('shows the duplicate error returned by Rust', async () => {
    createBehavior = async () => {
      throw { code: 'duplicate' };
    };
    const { user, input } = await setupCheckbox();
    await user.type(input, 'Release');
    await user.click(screen.getByRole('option', { name: /Create/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A group with this name already exists',
    );
  });

  it('keeps the new group when the add fails', async () => {
    addBehavior = async () => {
      throw { code: 'internal' };
    };
    const { user, input } = await setupCheckbox();
    await user.type(input, 'Release');
    await user.click(screen.getByRole('option', { name: /Create/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update the group. Try again.',
    );
    expect(useGroupStore.getState().groups.some((g) => g.name === 'Release')).toBe(true);
    expect(invokeMock.mock.calls.some((c) => c[0] === 'delete_group')).toBe(false);
  });

  it('creates only once on double Enter', async () => {
    let release: () => void = () => {};
    createBehavior = (args) =>
      new Promise((resolve) => {
        release = () => {
          const g = mkGroup(10, args.name, 3, args.color);
          backendGroups.push(g);
          resolve(g);
        };
      });
    const { user, input } = await setupCheckbox();
    await user.type(input, 'Release');
    await user.keyboard('{ArrowDown}{Enter}{Enter}');
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'create_group')).toHaveLength(1);
    await act(async () => release());
    await waitFor(() => expect(addCalls()).toHaveLength(1));
  });
});

describe('GroupPicker list mode', () => {
  async function setupList() {
    const user = userEvent.setup();
    const onAddSucceeded = vi.fn();
    renderWithI18n(<ListHarness onAddSucceeded={onAddSucceeded} />);
    await screen.findByRole('combobox', { name: 'Search groups' });
    return { user, onAddSucceeded };
  }

  it('excludes the group and has no selection semantics', async () => {
    await setupList();
    expect(screen.queryByRole('option', { name: /Écrans/ })).not.toBeInTheDocument();
    for (const o of screen.getAllByRole('option')) expect(o).not.toHaveAttribute('aria-selected');
    expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-multiselectable');
  });

  it('adds all tickets in one call, closes and reports success', async () => {
    const { user, onAddSucceeded } = await setupList();
    await user.click(opt('QA'));
    await waitFor(() => expect(onAddSucceeded).toHaveBeenCalledTimes(1));
    expect(addCalls()).toHaveLength(1);
    expect((addCalls()[0][1] as { issues: unknown[] }).issues).toHaveLength(3);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it('closes and toasts an error on failure', async () => {
    addBehavior = async () => {
      throw { code: 'internal' };
    };
    const { user, onAddSucceeded } = await setupList();
    await user.click(opt('QA'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onAddSucceeded).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('creates a group then adds all tickets once', async () => {
    const { user, onAddSucceeded } = await setupList();
    await user.type(screen.getByRole('combobox'), 'Release');
    await user.click(screen.getByRole('option', { name: /Create/ }));
    await waitFor(() => expect(onAddSucceeded).toHaveBeenCalledTimes(1));
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'create_group')).toHaveLength(1);
    expect(addCalls()).toHaveLength(1);
    expect((addCalls()[0][1] as { issues: unknown[] }).issues).toHaveLength(3);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
