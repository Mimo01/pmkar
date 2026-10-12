import { render } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import type { JiraTicket } from '../../tickets/types';
import { selectGroupIdsForIssue, toGroupErrorCode, useGroupStore } from '../groupStore';

const initial = useGroupStore.getState();
const g = (id: number, position: number, color = 'blue') => ({
  id,
  name: `G${id}`,
  color,
  position,
  createdAt: 't',
  memberCount: 0,
});

function mockLists(groups: unknown[], memberships: unknown[]) {
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'list_groups') return groups;
    if (cmd === 'list_group_memberships') return memberships;
    return null;
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  useGroupStore.setState({
    ...initial,
    groups: [],
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: false,
    hydrateError: false,
  });
});

describe('groupStore', () => {
  it('hydrate sorts by position and builds indexes', async () => {
    mockLists(
      [g(2, 1), g(1, 0)],
      [
        { groupId: 1, issueKey: 'A-1' },
        { groupId: 2, issueKey: 'A-1' },
        { groupId: 2, issueKey: 'B-2' },
      ],
    );
    await useGroupStore.getState().hydrate();
    const s = useGroupStore.getState();
    expect(s.groups.map((x) => x.id)).toEqual([1, 2]);
    expect(s.groupIdsByIssue).toEqual({ 'A-1': [1, 2], 'B-2': [2] });
    expect(s.memberKeysByGroup).toEqual({ 1: ['A-1'], 2: ['A-1', 'B-2'] });
    expect(s.hydrated).toBe(true);
  });

  it('hydrate keeps last good state on rejection', async () => {
    mockLists([g(1, 0)], [{ groupId: 1, issueKey: 'A-1' }]);
    await useGroupStore.getState().hydrate();
    invokeMock.mockReset();
    invokeMock.mockRejectedValue(new Error('x'));
    await expect(useGroupStore.getState().hydrate()).resolves.toBeUndefined();
    const s = useGroupStore.getState();
    expect(s.groups.map((x) => x.id)).toEqual([1]);
    expect(s.memberKeysByGroup).toEqual({ 1: ['A-1'] });
    expect(s.groupIdsByIssue).toEqual({ 'A-1': [1] });
    expect(s.hydrated).toBe(true);
    expect(s.hydrateError).toBe(true);
  });

  it('first hydrate failure leaves empty state with hydrateError', async () => {
    invokeMock.mockRejectedValue(new Error('x'));
    await useGroupStore.getState().hydrate();
    const s = useGroupStore.getState();
    expect(s.groups).toEqual([]);
    expect(s.hydrated).toBe(true);
    expect(s.hydrateError).toBe(true);
  });

  it('successful hydrate clears hydrateError', async () => {
    invokeMock.mockRejectedValue(new Error('x'));
    await useGroupStore.getState().hydrate();
    mockLists([g(1, 0)], []);
    await useGroupStore.getState().hydrate();
    expect(useGroupStore.getState().hydrateError).toBe(false);
  });

  it('out-of-order hydrates: latest started wins', async () => {
    let resolveFirst: (v: unknown[]) => void = () => {};
    let call = 0;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_groups') {
        call += 1;
        if (call === 1) return new Promise<unknown[]>((r) => (resolveFirst = r));
        return [g(2, 0)];
      }
      return [];
    });
    const first = useGroupStore.getState().hydrate();
    await useGroupStore.getState().hydrate();
    resolveFirst([g(1, 0)]);
    await first;
    expect(useGroupStore.getState().groups.map((x) => x.id)).toEqual([2]);
  });

  it('stale rejection does not flag error', async () => {
    let rejectFirst: (e: unknown) => void = () => {};
    let call = 0;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_groups') {
        call += 1;
        if (call === 1) return new Promise<unknown[]>((_, rej) => (rejectFirst = rej));
        return [g(2, 0)];
      }
      return [];
    });
    const first = useGroupStore.getState().hydrate();
    await useGroupStore.getState().hydrate();
    rejectFirst(new Error('late'));
    await first;
    const s = useGroupStore.getState();
    expect(s.hydrateError).toBe(false);
    expect(s.groups.map((x) => x.id)).toEqual([2]);
  });

  it('memberships referencing unknown group ids are dropped', async () => {
    mockLists(
      [g(1, 0)],
      [
        { groupId: 1, issueKey: 'A-1' },
        { groupId: 9, issueKey: 'B-2' },
      ],
    );
    await useGroupStore.getState().hydrate();
    const s = useGroupStore.getState();
    expect(s.memberKeysByGroup).toEqual({ 1: ['A-1'] });
    expect(s.groupIdsByIssue).toEqual({ 'A-1': [1] });
  });

  it('success with empty lists resets to empty', async () => {
    mockLists([g(1, 0)], [{ groupId: 1, issueKey: 'A-1' }]);
    await useGroupStore.getState().hydrate();
    mockLists([], []);
    await useGroupStore.getState().hydrate();
    const s = useGroupStore.getState();
    expect(s.groups).toEqual([]);
    expect(s.hydrateError).toBe(false);
  });

  it('coerces invalid colors to slate', async () => {
    mockLists([g(1, 0, 'javascript:evil')], []);
    await useGroupStore.getState().hydrate();
    expect(useGroupStore.getState().groups[0].color).toBe('slate');
  });

  it('selector returns null for absent and stable ref for present', async () => {
    mockLists([g(1, 0)], [{ groupId: 1, issueKey: 'A-1' }]);
    await useGroupStore.getState().hydrate();
    expect(selectGroupIdsForIssue('Z-9')(useGroupStore.getState())).toBeNull();
    const a = selectGroupIdsForIssue('A-1')(useGroupStore.getState());
    const b = selectGroupIdsForIssue('A-1')(useGroupStore.getState());
    expect(Object.is(a, b)).toBe(true);
  });

  it('selector does not loop on render', () => {
    let renders = 0;
    function C() {
      renders++;
      useGroupStore(selectGroupIdsForIssue('Z-9'));
      return null;
    }
    render(createElement(C));
    expect(renders).toBe(1);
  });

  it('createGroup invokes and re-hydrates', async () => {
    mockLists([g(1, 0)], []);
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'create_group') return g(1, 0);
      if (cmd === 'list_groups') return [g(1, 0)];
      return [];
    });
    const r = await useGroupStore.getState().createGroup('X');
    expect(invokeMock).toHaveBeenCalledWith('create_group', { name: 'X', color: undefined });
    expect(r).toEqual({ ok: true, value: g(1, 0) });
    expect(invokeMock).toHaveBeenCalledWith('list_groups');
  });

  it('createGroup duplicate returns typed code and leaves state', async () => {
    invokeMock.mockRejectedValue({ code: 'duplicate' });
    const r = await useGroupStore.getState().createGroup('X');
    expect(r).toEqual({ ok: false, code: 'duplicate' });
    expect(useGroupStore.getState().hydrated).toBe(false);
  });

  it('toGroupErrorCode maps', () => {
    expect(toGroupErrorCode('boom')).toBe('internal');
    expect(toGroupErrorCode({ code: 'no_scope' })).toBe('no_scope');
    expect(toGroupErrorCode({ code: 'weird' })).toBe('internal');
  });

  it('addToGroup maps tickets', async () => {
    mockLists([], []);
    const t = { key: 'A-1', summary: 's' } as unknown as JiraTicket;
    await useGroupStore.getState().addToGroup(1, [t]);
    expect(invokeMock).toHaveBeenCalledWith('add_issues_to_group', {
      groupId: 1,
      issues: [{ issueKey: 'A-1', ticketJson: JSON.stringify(t) }],
    });
  });

  it('moveGroup invokes move_group', async () => {
    mockLists([], []);
    await useGroupStore.getState().moveGroup(1, 'right');
    expect(invokeMock).toHaveBeenCalledWith('move_group', { groupId: 1, direction: 'right' });
  });

  it('rehydrateAfter waits for persist', async () => {
    mockLists([], []);
    let resolve!: () => void;
    const persist = new Promise<void>((r) => {
      resolve = r;
    });
    const p = useGroupStore.getState().rehydrateAfter(persist);
    await Promise.resolve();
    expect(invokeMock).not.toHaveBeenCalledWith('list_groups');
    resolve();
    await p;
    expect(invokeMock).toHaveBeenCalledWith('list_groups');
    expect(invokeMock).toHaveBeenCalledWith('list_group_memberships');
  });

  it('rehydrateAfter hydrates even if persist rejects', async () => {
    mockLists([], []);
    await expect(
      useGroupStore.getState().rehydrateAfter(Promise.reject(new Error('x'))),
    ).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith('list_groups');
  });
});
