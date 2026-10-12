import { invoke } from '@tauri-apps/api/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupStore } from '../../groups/groupStore';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket } from '../types';

/**
 * Shared select-mode / bulk-add cases for the three core list pages.
 * The calling test file must mock '@tauri-apps/api/core' and 'sonner'.
 */
export function mkCoreTicket(key: string, updated: string): JiraTicket {
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

export const CORE_TICKETS = [
  mkCoreTicket('P-1', '2026-01-03T10:00:00.000Z'),
  mkCoreTicket('P-2', '2026-01-02T10:00:00.000Z'),
  mkCoreTicket('P-3', '2026-01-01T10:00:00.000Z'),
];

const mkGroup = (id: number, name: string, position: number) => ({
  id,
  name,
  color: 'blue',
  position,
  createdAt: 't',
  memberCount: 0,
});

const callsOf = (cmd: string) => vi.mocked(invoke).mock.calls.filter((c) => c[0] === cmd);

export function defineCoreSelectionCases(
  name: string,
  opts: {
    /** Seed the ticket store with CORE_TICKETS visible on the page. */
    seed: () => void;
    page: () => React.ReactElement;
    /** Extra invoke handler for page-specific commands. */
    baseInvoke?: (cmd: string) => unknown;
  },
) {
  let addResult = 3;
  const initialGroups = useGroupStore.getState();

  describe(`${name} select mode and bulk add`, () => {
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
      vi.mocked(toast.success).mockClear();
      vi.mocked(toast.info).mockClear();
      vi.mocked(invoke).mockReset();
      addResult = 3;
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'list_groups') return [mkGroup(1, 'Sprint', 0), mkGroup(2, 'QA', 1)];
        if (cmd === 'list_group_memberships') return [];
        if (cmd === 'add_issues_to_group') return addResult;
        return opts.baseInvoke ? opts.baseInvoke(cmd) : undefined;
      });
      useGroupStore.setState({
        ...initialGroups,
        groups: [mkGroup(1, 'Sprint', 0), mkGroup(2, 'QA', 1)] as never,
        memberKeysByGroup: {},
        groupIdsByIssue: {},
        hydrated: true,
        hydrateError: false,
      });
      opts.seed();
    });

    const selectBtn = () => screen.getByRole('button', { name: 'Select' });
    const box = (key: string) => screen.getByRole('checkbox', { name: `Select ${key}` });

    function selectAllThree() {
      fireEvent.click(selectBtn());
      expect(selectBtn().getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(box('P-1'));
      fireEvent.click(box('P-3'), { shiftKey: true });
      expect(screen.getByRole('status').textContent).toBe('3 selected');
    }

    async function addToQa() {
      await userEvent.click(screen.getByRole('button', { name: /Add to group/ }));
      await userEvent.click(await screen.findByRole('option', { name: 'QA' }));
    }

    it('toggles select mode and supports shift-range selection without opening detail', () => {
      render(opts.page());
      expect(selectBtn().getAttribute('aria-pressed')).toBe('false');
      selectAllThree();
      expect(useTicketStore.getState().selectedTicketKey).toBeNull();
    });

    it('offers Add to group but never Remove from group', () => {
      render(opts.page());
      selectAllThree();
      expect(screen.getByRole('button', { name: /Add to group/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Remove from group' })).toBeNull();
    });

    it('bulk add makes one atomic call, toasts skips, ends select mode and refocuses Select', async () => {
      addResult = 1;
      render(opts.page());
      selectAllThree();
      await addToQa();
      await waitFor(() => expect(selectBtn().getAttribute('aria-pressed')).toBe('false'));
      const calls = callsOf('add_issues_to_group');
      expect(calls).toHaveLength(1);
      const args = calls[0][1] as { groupId: number; issues: unknown[] };
      expect(args.groupId).toBe(2);
      expect(args.issues).toHaveLength(3);
      expect(toast.success).toHaveBeenCalledWith('Added 1 issue to ‘QA’ (2 already in group)');
      expect(screen.queryByText('3 selected')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(selectBtn()));
    });

    it('reports when all selected issues are already members and ends select mode', async () => {
      addResult = 0;
      render(opts.page());
      selectAllThree();
      await addToQa();
      await waitFor(() =>
        expect(toast.info).toHaveBeenCalledWith('All selected issues are already in ‘QA’.'),
      );
      await waitFor(() => expect(selectBtn().getAttribute('aria-pressed')).toBe('false'));
    });
  });
}
