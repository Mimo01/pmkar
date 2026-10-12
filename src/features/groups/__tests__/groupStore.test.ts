import { render } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useConnectionStore } from '../../connections/connectionStore';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket } from '../../tickets/types';
import {
  expectedAddScope,
  selectGroupIdsForIssue,
  toGroupErrorCode,
  useGroupStore,
} from '../groupStore';
import type { Group } from '../types';

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

  it('superseded hydrate resolves only after the latest hydrate has applied', async () => {
    let resolveSecond: (v: unknown[]) => void = () => {};
    let call = 0;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'list_groups') {
        call += 1;
        if (call === 1) return [g(1, 0)];
        return new Promise<unknown[]>((r) => (resolveSecond = r));
      }
      return [];
    });
    let firstDone = false;
    const first = useGroupStore
      .getState()
      .hydrate()
      .then(() => {
        firstDone = true;
      });
    const second = useGroupStore.getState().hydrate();
    await new Promise((r) => setTimeout(r, 0));
    expect(firstDone).toBe(false);
    resolveSecond([g(1, 0), g(2, 1)]);
    await first;
    expect(useGroupStore.getState().groups.map((x) => x.id)).toEqual([1, 2]);
    await second;
  });

  it('createGroup resolves with the new group present despite a concurrent hydrate', async () => {
    let resolveCreateList: (v: unknown[]) => void = () => {};
    let resolveConcurrent: (v: unknown[]) => void = () => {};
    let listCalls = 0;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'create_group') return g(7, 0);
      if (cmd === 'list_groups') {
        listCalls += 1;
        if (listCalls === 1) return [];
        // Second list (from createGroup) is superseded by a third one.
        if (listCalls === 2) return new Promise<unknown[]>((r) => (resolveCreateList = r));
        return new Promise<unknown[]>((r) => (resolveConcurrent = r));
      }
      return [];
    });
    await useGroupStore.getState().hydrate();
    let createdDone = false;
    const created = useGroupStore
      .getState()
      .createGroup('G7')
      .then((r) => {
        createdDone = true;
        return r;
      });
    // Let createGroup's invoke settle and its hydrate start, then start a newer hydrate.
    await new Promise((r) => setTimeout(r, 0));
    expect(listCalls).toBe(2);
    const concurrent = useGroupStore.getState().hydrate();
    resolveCreateList([g(7, 0)]);
    await new Promise((r) => setTimeout(r, 0));
    // The superseded read was dropped; createGroup must not resolve yet.
    expect(createdDone).toBe(false);
    expect(useGroupStore.getState().groups).toEqual([]);
    resolveConcurrent([g(7, 0)]);
    const r = await created;
    expect(r.ok).toBe(true);
    expect(useGroupStore.getState().groups.map((x) => x.id)).toEqual([7]);
    await concurrent;
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

  it('not_found failure re-hydrates so the stale group is dropped', async () => {
    useGroupStore.setState({ groups: [g(1, 0), g(2, 1)] as Group[], hydrated: true });
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'delete_group') throw { code: 'not_found' };
      if (cmd === 'list_groups') return [g(2, 1)];
      if (cmd === 'list_group_memberships') return [];
      return null;
    });
    const r = await useGroupStore.getState().deleteGroup(1);
    expect(r).toEqual({ ok: false, code: 'not_found' });
    expect(useGroupStore.getState().groups.map((x) => x.id)).toEqual([2]);
  });

  it('other failures do not re-hydrate', async () => {
    invokeMock.mockRejectedValue({ code: 'internal' });
    await useGroupStore.getState().renameGroup(1, 'X');
    expect(invokeMock).not.toHaveBeenCalledWith('list_groups');
  });

  it('toGroupErrorCode maps', () => {
    expect(toGroupErrorCode('boom')).toBe('internal');
    expect(toGroupErrorCode({ code: 'no_scope' })).toBe('no_scope');
    expect(toGroupErrorCode({ code: 'weird' })).toBe('internal');
  });

  it('addToGroup maps tickets', async () => {
    mockLists([], []);
    const t = { key: 'A-1', summary: 's' } as unknown as JiraTicket;
    useConnectionStore.setState({
      serverConnection: {
        baseUrl: 'http://server.example.com',
        username: 'u',
        serverVersion: '9',
        lastTestedAt: '',
        status: 'ok',
      },
    });
    await useGroupStore.getState().addToGroup(1, [t]);
    expect(invokeMock).toHaveBeenCalledWith('add_issues_to_group', {
      groupId: 1,
      expectedBaseUrl: 'http://server.example.com',
      issues: [{ issueKey: 'A-1', ticketJson: JSON.stringify(t) }],
    });
    useConnectionStore.setState({ serverConnection: null });
  });

  it('addToGroup sends empty expectedBaseUrl without a connection', async () => {
    mockLists([], []);
    useConnectionStore.setState({ serverConnection: null });
    const t = { key: 'A-1', summary: 's' } as unknown as JiraTicket;
    await useGroupStore.getState().addToGroup(1, [t]);
    expect(invokeMock).toHaveBeenCalledWith(
      'add_issues_to_group',
      expect.objectContaining({ expectedBaseUrl: '' }),
    );
  });

  describe('WR-09: expected scope comes from the tickets, not just the current connection', () => {
    const conn = (baseUrl: string) => ({
      baseUrl,
      username: 'u',
      serverVersion: '9',
      lastTestedAt: '',
      status: 'ok' as const,
    });
    const tk = (key: string) => ({ key, fields: {} }) as unknown as JiraTicket;

    it('a list ticket still held after a switch carries its origin, so Rust can veto it', async () => {
      mockLists([], []);
      useConnectionStore.setState({ serverConnection: conn('http://a') });
      const fromA = tk('A-1');
      useTicketStore.getState().setTickets([fromA], {}, 1, false, null, 'http://a');
      useConnectionStore.setState({ serverConnection: conn('http://b') }); // list is reset
      expect(useTicketStore.getState().tickets).toEqual([]);
      await useGroupStore.getState().addToGroup(1, [fromA]); // stale reference
      expect(invokeMock).toHaveBeenCalledWith(
        'add_issues_to_group',
        expect.objectContaining({ expectedBaseUrl: 'http://a' }),
      );
      useConnectionStore.setState({ serverConnection: null });
    });

    it('tickets without a recorded origin (snapshot, detail) use the current server', () => {
      useConnectionStore.setState({ serverConnection: conn('http://b') });
      expect(expectedAddScope([tk('S-1')])).toBe('http://b');
      expect(expectedAddScope([])).toBe('http://b');
      useConnectionStore.setState({ serverConnection: null });
    });

    it('mixed origins fail closed with an empty expectation', () => {
      useConnectionStore.setState({ serverConnection: conn('http://b') });
      const fromA = tk('A-2');
      useTicketStore.getState().setTickets([fromA], {}, 1, false, null, 'http://a');
      expect(expectedAddScope([fromA, tk('S-2')])).toBe('');
      useConnectionStore.setState({ serverConnection: null });
    });
  });

  it('addToGroup maps scope_mismatch rejection', async () => {
    invokeMock.mockImplementation(async () => {
      throw { code: 'scope_mismatch' };
    });
    const t = { key: 'A-1', summary: 's' } as unknown as JiraTicket;
    const r = await useGroupStore.getState().addToGroup(1, [t]);
    expect(r).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(invokeMock).not.toHaveBeenCalledWith('list_groups');
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

  it('rehydrateAfter clears previous scope groups when the read fails', async () => {
    mockLists([g(1, 0)], [{ groupId: 1, issueKey: 'A-1' }]);
    await useGroupStore.getState().hydrate();
    invokeMock.mockReset();
    invokeMock.mockRejectedValue(new Error('x'));
    await useGroupStore.getState().rehydrateAfter(Promise.resolve());
    const s = useGroupStore.getState();
    expect(s.groups).toEqual([]);
    expect(s.memberKeysByGroup).toEqual({});
    expect(s.groupIdsByIssue).toEqual({});
    expect(s.hydrated).toBe(true);
    expect(s.hydrateError).toBe(true);
  });

  it('rehydrateAfter hydrates even if persist rejects', async () => {
    mockLists([], []);
    await expect(
      useGroupStore.getState().rehydrateAfter(Promise.reject(new Error('x'))),
    ).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith('list_groups');
  });
});

describe('groupStore.refreshSnapshots', () => {
  const tk = (key: string) => ({ id: key, key, fields: { summary: key } }) as unknown as JiraTicket;

  beforeEach(() => {
    useGroupStore.setState({ groupIdsByIssue: { 'AB-1': [1] }, snapshotRevision: 0 });
  });

  it('sends only member tickets in one call', async () => {
    invokeMock.mockResolvedValue(0);
    await useGroupStore
      .getState()
      .refreshSnapshots([tk('AB-1'), tk('AB-9')], 'http://server.example.com');
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('refresh_group_snapshots', {
      issues: [{ issueKey: 'AB-1', ticketJson: JSON.stringify(tk('AB-1')) }],
      expectedBaseUrl: 'http://server.example.com',
    });
  });

  it('skips the call when no ticket is a member', async () => {
    await useGroupStore.getState().refreshSnapshots([tk('AB-9')], 'http://server.example.com');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('bumps snapshotRevision only when rows changed', async () => {
    invokeMock.mockResolvedValueOnce(2);
    await useGroupStore.getState().refreshSnapshots([tk('AB-1')], 'http://server.example.com');
    expect(useGroupStore.getState().snapshotRevision).toBe(1);
    invokeMock.mockResolvedValueOnce(0);
    await useGroupStore.getState().refreshSnapshots([tk('AB-1')], 'http://server.example.com');
    expect(useGroupStore.getState().snapshotRevision).toBe(1);
  });

  it('swallows errors with a warning and never hydrates', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    invokeMock.mockRejectedValue({ code: 'internal' });
    await expect(
      useGroupStore.getState().refreshSnapshots([tk('AB-1')], 'http://server.example.com'),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(useGroupStore.getState().snapshotRevision).toBe(0);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).not.toHaveBeenCalledWith('list_groups');
    warn.mockRestore();
  });

  it('does not hydrate after a successful refresh', async () => {
    invokeMock.mockResolvedValue(1);
    await useGroupStore.getState().refreshSnapshots([tk('AB-1')], 'http://server.example.com');
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});
