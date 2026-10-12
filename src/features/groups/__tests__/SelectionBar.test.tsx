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
import i18n from '../../../i18n/index';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import type { JiraTicket } from '../../tickets/types';
import { useGroupStore } from '../groupStore';
import { SelectionBar } from '../SelectionBar';

const initial = useGroupStore.getState();

function mkGroup(id: number, name: string, position: number) {
  return { id, name, color: 'blue', position, createdAt: 't', memberCount: 0 };
}
function mkTicket(key: string): JiraTicket {
  return {
    id: key,
    key,
    fields: { summary: 's', status: { name: 'x' }, priority: null, assignee: null, updated: 'u' },
  } as unknown as JiraTicket;
}
const tickets = (n: number) => Array.from({ length: n }, (_, i) => mkTicket(`P-${i + 1}`));

const seedGroups = () => [mkGroup(1, 'Sprint', 0), mkGroup(2, 'QA', 1), mkGroup(3, 'Docs', 2)];
const qa = seedGroups()[1];

let removeBehavior: () => Promise<unknown>;
let addBehavior: () => Promise<unknown>;

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

beforeEach(async () => {
  vi.clearAllMocks();
  invokeMock.mockReset();
  await i18n.changeLanguage('en');
  addBehavior = async () => 3;
  removeBehavior = async () => 3;
  invokeMock.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case 'list_groups':
        return seedGroups();
      case 'list_group_memberships':
        return [];
      case 'add_issues_to_group':
        return addBehavior();
      case 'remove_issues_from_group':
        return removeBehavior();
      default:
        return null;
    }
  });
  useGroupStore.setState({
    ...initial,
    groups: seedGroups() as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
});

const callsOf = (cmd: string) => invokeMock.mock.calls.filter((c) => c[0] === cmd);

describe('SelectionBar', () => {
  it('renders only an empty live region with 0 tickets', () => {
    renderWithI18n(
      <SelectionBar selectedTickets={[]} onClear={vi.fn()} onActionSucceeded={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Add to group/ })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('shows count, add and clear but no remove without a group', () => {
    renderWithI18n(
      <SelectionBar selectedTickets={tickets(3)} onClear={vi.fn()} onActionSucceeded={vi.fn()} />,
    );
    expect(screen.getByRole('status').textContent).toBe('3 selected');
    expect(screen.getByRole('button', { name: /Add to group/ }).getAttribute('aria-haspopup')).toBe(
      'dialog',
    );
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove from group' })).toBeNull();
  });

  it('uses Slovak plurals', async () => {
    await i18n.changeLanguage('sk');
    const { rerender } = renderWithI18n(
      <SelectionBar selectedTickets={tickets(1)} onClear={vi.fn()} onActionSucceeded={vi.fn()} />,
    );
    expect(screen.getByRole('status').textContent).toBe('1 vybraná');
    rerender(
      <SelectionBar selectedTickets={tickets(5)} onClear={vi.fn()} onActionSucceeded={vi.fn()} />,
    );
    expect(screen.getByRole('status').textContent).toBe('5 vybraných');
  });

  it('calls onClear', async () => {
    const onClear = vi.fn();
    renderWithI18n(
      <SelectionBar selectedTickets={tickets(2)} onClear={onClear} onActionSucceeded={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('adds all tickets atomically via the picker', async () => {
    const onDone = vi.fn();
    renderWithI18n(
      <SelectionBar selectedTickets={tickets(3)} onClear={vi.fn()} onActionSucceeded={onDone} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Add to group/ }));
    expect(await screen.findByRole('option', { name: 'Sprint' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Docs' })).toBeTruthy();
    await userEvent.click(screen.getByRole('option', { name: 'QA' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const calls = callsOf('add_issues_to_group');
    expect(calls).toHaveLength(1);
    expect(calls[0][1].groupId).toBe(2);
    expect(calls[0][1].issues).toHaveLength(3);
    expect(toast.success).toHaveBeenCalled();
  });

  it('excludes the current group from Add and shows Remove in a group view', async () => {
    renderWithI18n(
      <SelectionBar
        selectedTickets={tickets(3)}
        group={qa as never}
        onClear={vi.fn()}
        onActionSucceeded={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove from group' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Add to group/ }));
    expect(await screen.findByRole('option', { name: 'Sprint' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'QA' })).toBeNull();
  });

  it('confirm popover focuses Cancel and Cancel does not invoke', async () => {
    renderWithI18n(
      <SelectionBar
        selectedTickets={tickets(3)}
        group={qa as never}
        onClear={vi.fn()}
        onActionSucceeded={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
    expect(await screen.findByText('Remove 3 issues from “QA”?')).toBeTruthy();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await userEvent.click(cancel);
    await waitFor(() => expect(screen.queryByText('Remove 3 issues from “QA”?')).toBeNull());
    expect(callsOf('remove_issues_from_group')).toHaveLength(0);
  });

  it('confirming Remove makes one atomic call and reports success', async () => {
    const onDone = vi.fn();
    renderWithI18n(
      <SelectionBar
        selectedTickets={tickets(3)}
        group={qa as never}
        onClear={vi.fn()}
        onActionSucceeded={onDone}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const calls = callsOf('remove_issues_from_group');
    expect(calls).toHaveLength(1);
    expect(calls[0][1].groupId).toBe(2);
    expect(calls[0][1].issueKeys).toEqual(['P-1', 'P-2', 'P-3']);
  });

  it('Remove failure toasts an error, keeps selection and closes the popover', async () => {
    removeBehavior = async () => {
      throw 'not_found';
    };
    const onDone = vi.fn();
    renderWithI18n(
      <SelectionBar
        selectedTickets={tickets(3)}
        group={qa as never}
        onClear={vi.fn()}
        onActionSucceeded={onDone}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Remove 3 issues from “QA”?')).toBeNull());
  });

  it('Add failure does not report success', async () => {
    addBehavior = async () => {
      throw 'db_error';
    };
    const onDone = vi.fn();
    renderWithI18n(
      <SelectionBar selectedTickets={tickets(3)} onClear={vi.fn()} onActionSucceeded={onDone} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Add to group/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'QA' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('double-clicking Remove issues one invoke', async () => {
    let release!: () => void;
    removeBehavior = () => new Promise((res) => (release = () => res(3)));
    renderWithI18n(
      <SelectionBar
        selectedTickets={tickets(3)}
        group={qa as never}
        onClear={vi.fn()}
        onActionSucceeded={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
    const btn = await screen.findByRole('button', { name: 'Remove' });
    await userEvent.dblClick(btn);
    release();
    await waitFor(() => expect(callsOf('remove_issues_from_group')).toHaveLength(1));
  });

  describe('Esc containment (OQ4)', () => {
    it('Esc in the Add picker closes it without an unhandled event reaching the page', async () => {
      const spy = vi.fn();
      renderWithI18n(
        // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper
        <div onKeyDown={spy}>
          <SelectionBar
            selectedTickets={tickets(3)}
            onClear={vi.fn()}
            onActionSucceeded={vi.fn()}
          />
        </div>,
      );
      await userEvent.click(screen.getByRole('button', { name: /Add to group/ }));
      await screen.findByRole('option', { name: 'QA' });
      spy.mockClear();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'QA' })).toBeNull());
      for (const [e] of spy.mock.calls) {
        if (e.key === 'Escape') expect(e.defaultPrevented).toBe(true);
      }
    });

    it('Esc in the Remove confirm closes it without an unhandled event reaching the page', async () => {
      const spy = vi.fn();
      renderWithI18n(
        // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper
        <div onKeyDown={spy}>
          <SelectionBar
            selectedTickets={tickets(3)}
            group={qa as never}
            onClear={vi.fn()}
            onActionSucceeded={vi.fn()}
          />
        </div>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Remove from group' }));
      await screen.findByText('Remove 3 issues from “QA”?');
      spy.mockClear();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByText('Remove 3 issues from “QA”?')).toBeNull());
      for (const [e] of spy.mock.calls) {
        if (e.key === 'Escape') expect(e.defaultPrevented).toBe(true);
      }
    });
  });
});
