import { invoke } from '@tauri-apps/api/core';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TriageEntry, TriageState } from '../types';

// Fake persisted DB behind the mocked Tauri bridge (RQA-01).
let db: Record<string, TriageEntry> = {};
let failNext = false;

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
const toastError = vi.fn();
const toastFn = vi.fn();
const toastDismiss = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign((...a: unknown[]) => toastFn(...a), {
    error: (...a: unknown[]) => toastError(...a),
    dismiss: (...a: unknown[]) => toastDismiss(...a),
  }),
}));

import { useConnectionStore } from '../../connections/connectionStore';
import { groupBadgeKey } from '../../groups/groupBadge';
import { useCopyStore } from '../copyStore';
import {
  isLinkedCandidate,
  isNewCandidate,
  isNotMineCandidate,
  isWatchedCandidate,
} from '../ticketListUtils';
import { useTicketStore } from '../ticketStore';
import { denyTicket, linkTicket, markHandled, restoreTicket, watchTicket } from '../triageActions';
import type { JiraTicket } from '../types';
import { useCoreTabCounts } from '../useCoreTabCounts';

const flush = () => new Promise((r) => setTimeout(r, 0));

function mkTicket(key: string, done: boolean): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: 's',
      status: { name: 'Open', statusCategory: { key: done ? 'done' : 'indeterminate' } },
    },
  } as unknown as JiraTicket;
}

const DONE_KEYS = new Set(['D-1', 'D-2', 'D-3']);
const KEYS = ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6', 'A-7', 'A-8', 'A-9', 'D-1', 'D-2', 'D-3'];
const NON_DONE_COUNT = 9;

function fixtureMap(): Record<string, TriageEntry> {
  const e = (state: TriageState, copiedKey: string | null = null): TriageEntry => ({
    state,
    copiedKey,
  });
  return {
    'A-1': e('new'),
    'A-2': e('seen'),
    'A-3': e('copied', 'CL-3'),
    'A-4': e('copied', 'CL-4'),
    'A-5': e('ignored', 'CL-5'),
    'A-6': e('ignored'),
    'A-7': e('handled', 'CL-7'),
    'A-8': e('watched', 'CL-8'),
    'A-9': e('watched'),
    'D-1': e('copied', 'CL-9'),
    'D-2': e('new'),
    'D-3': e('watched', 'CL-10'),
  };
}

function lists() {
  const { tickets, triageMap } = useTicketStore.getState();
  const keysOf = (pred: typeof isNewCandidate) =>
    tickets.filter((t) => pred(t, triageMap)).map((t) => t.key);
  return {
    newList: keysOf(isNewCandidate),
    notMine: keysOf(isNotMineCandidate),
    linked: keysOf(isLinkedCandidate),
    watched: keysOf(isWatchedCandidate),
  };
}

function assertInvariant() {
  const { tickets, triageMap, newCount } = useTicketStore.getState();
  const { newList, notMine, linked, watched } = lists();
  for (const t of tickets) {
    const tabs = [
      isNewCandidate(t, triageMap) ? 'nav.new' : null,
      isNotMineCandidate(t, triageMap) ? 'nav.notMine' : null,
      isLinkedCandidate(t, triageMap) ? 'nav.linked' : null,
      isWatchedCandidate(t, triageMap) ? 'nav.watched' : null,
    ].filter((x): x is string => x !== null);
    if (DONE_KEYS.has(t.key)) {
      expect(tabs, `${t.key} done`).toEqual([]);
      expect(groupBadgeKey(t, triageMap)).toBe('groups.badge.done');
    } else {
      expect(tabs, `${t.key} tabs`).toHaveLength(1);
      expect(groupBadgeKey(t, triageMap)).toBe(tabs[0]);
    }
  }
  for (const l of [newList, notMine, linked, watched]) expect(new Set(l).size).toBe(l.length);
  expect(newList.length + notMine.length + linked.length + watched.length).toBe(NON_DONE_COUNT);
  const badge = (k: string) => tickets.filter((t) => groupBadgeKey(t, triageMap) === k).length;
  expect(badge('nav.new')).toBe(newList.length);
  expect(badge('nav.notMine')).toBe(notMine.length);
  expect(badge('nav.linked')).toBe(linked.length);
  expect(badge('nav.watched')).toBe(watched.length);
  // Only the Watched tab carries a count; it equals the Watched page list (D-01, D-02).
  const counts = renderHook(() => useCoreTabCounts());
  expect(counts.result.current).toEqual({ watched: watched.length });
  counts.unmount();
  // newCount counts raw 'new' entries (including done tickets), not the New tab list.
  expect(newCount).toBe(Object.values(triageMap).filter((e) => e.state === 'new').length);
}

function assertStoreMatchesDb() {
  const { triageMap } = useTicketStore.getState();
  for (const k of KEYS) {
    expect(triageMap[k], `${k} store vs db`).toEqual(db[k]);
  }
}

async function check() {
  await flush();
  assertInvariant();
  assertStoreMatchesDb();
}

function lastUndo(): (() => void) | null {
  const call = toastFn.mock.calls[toastFn.mock.calls.length - 1];
  const onClick = call?.[1]?.action?.onClick as (() => void) | undefined;
  return onClick ?? null;
}

let startPreview: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  failNext = false;
  db = fixtureMap();
  invokeMock.mockReset();
  toastError.mockReset();
  toastFn.mockReset();
  toastDismiss.mockReset();
  invokeMock.mockImplementation(async (cmd: string, args: Record<string, unknown>) => {
    const key = args?.ticketKey as string | undefined;
    switch (cmd) {
      case 'set_triage_state': {
        if (failNext) {
          failNext = false;
          throw new Error('db');
        }
        db[key as string] = {
          state: args.state as TriageState,
          copiedKey: db[key as string]?.copiedKey ?? null,
        };
        return undefined;
      }
      case 'relink_ticket': {
        if (failNext) {
          failNext = false;
          throw new Error('db');
        }
        const ck = db[key as string]?.copiedKey ?? null;
        if (ck) db[key as string].state = 'copied';
        return ck;
      }
      case 'get_triage_state':
        return structuredClone(db);
      case 'fetch_ticket_detail':
        throw new Error('no detail');
      default:
        return undefined;
    }
  });
  useConnectionStore.setState({
    serverConnection: { baseUrl: 'http://srv' },
    cloudConnection: { baseUrl: 'http://cld' },
  } as never);
  startPreview = vi.spyOn(useCopyStore.getState(), 'startPreview').mockResolvedValue(undefined);
  useTicketStore.setState({ tickets: KEYS.map((k) => mkTicket(k, DONE_KEYS.has(k))) });
  useTicketStore.getState().hydrateTriageMap(fixtureMap());
});
afterEach(() => {
  startPreview.mockRestore();
});

describe('triage consistency invariant (RQA-01)', () => {
  it('holds on the seeded fixture', () => {
    assertInvariant();
    assertStoreMatchesDb();
    expect(lists()).toEqual({
      newList: ['A-1', 'A-2'],
      notMine: ['A-5', 'A-6', 'A-7'],
      linked: ['A-3', 'A-4'],
      watched: ['A-8', 'A-9'],
    });
  });

  it('deny moves Linked to Not mine', async () => {
    await denyTicket('A-3');
    await check();
    const l = lists();
    expect(l.linked).toEqual(['A-4']);
    expect(l.notMine).toContain('A-3');
  });

  it('undo returns a denied ticket to Linked with its DB key', async () => {
    await denyTicket('A-4');
    await check();
    const undo = lastUndo();
    expect(undo).not.toBeNull();
    undo?.();
    await check();
    expect(lists().linked).toContain('A-4');
    expect(useTicketStore.getState().triageMap['A-4']).toEqual({
      state: 'copied',
      copiedKey: 'CL-4',
    });
  });

  it('relinks a remembered ignored ticket', async () => {
    expect(await linkTicket('A-5')).toBe('relinked');
    await check();
    expect(lists().linked).toContain('A-5');
  });

  it('does not relink a ticket without a remembered key', async () => {
    const r = await linkTicket('A-6');
    expect(r).not.toBe('relinked');
    await check();
    expect(lists().notMine.filter((k) => k === 'A-6')).toHaveLength(1);
  });

  it('restore moves handled to New and relinks denied tickets with a remembered key', async () => {
    await restoreTicket('A-7');
    await check();
    expect(lists().newList).toContain('A-7');
    expect(useTicketStore.getState().triageMap['A-7'].copiedKey).toBe('CL-7');
    await denyTicket('A-5');
    await check();
    await restoreTicket('A-5');
    await check();
    expect(lists().linked).toContain('A-5');
    expect(useTicketStore.getState().triageMap['A-5']).toEqual({
      state: 'copied',
      copiedKey: 'CL-5',
    });
    // No remembered key: plain restore to New/seen.
    await restoreTicket('A-6');
    await check();
    expect(lists().newList).toContain('A-6');
  });

  it('markHandled moves Linked to Not mine', async () => {
    await markHandled('A-3');
    await check();
    expect(lists().notMine).toContain('A-3');
    expect(lists().linked).not.toContain('A-3');
  });

  it('rolls back a failing set_triage_state and a failing relink', async () => {
    failNext = true;
    expect(await denyTicket('A-4')).toBe(false);
    await check();
    expect(lists().linked).toContain('A-4');
    failNext = true;
    expect(await linkTicket('A-5')).toBe('failed');
    await check();
    expect(lists().notMine).toContain('A-5');
  });

  it('watch moves Linked and Dismissed to Watched and keeps the remembered key', async () => {
    await watchTicket('A-3');
    await check();
    await watchTicket('A-5');
    await check();
    const l = lists();
    expect(l.watched).toEqual(expect.arrayContaining(['A-3', 'A-5', 'A-8', 'A-9']));
    expect(l.linked).not.toContain('A-3');
    expect(l.notMine).not.toContain('A-5');
    expect(useTicketStore.getState().triageMap['A-3'].copiedKey).toBe('CL-3');
  });

  it('Watched -> Dismissed -> Watched round trips with Undo and stays in exactly one tab', async () => {
    await denyTicket('A-8');
    await check();
    expect(lists().notMine).toContain('A-8');
    expect(lists().watched).not.toContain('A-8');
    lastUndo()?.();
    await check();
    expect(lists().watched).toContain('A-8');
    expect(useTicketStore.getState().triageMap['A-8']).toEqual({
      state: 'watched',
      copiedKey: 'CL-8',
    });
  });

  it('Watched restore relinks nothing and returns to New; Watched -> Linked via link', async () => {
    await restoreTicket('A-8');
    await check();
    expect(lists().newList).toContain('A-8');
    expect(lists().watched).not.toContain('A-8');
    expect(await linkTicket('A-9')).not.toBe('relinked');
    await check();
    await watchTicket('A-3');
    await check();
    expect(await linkTicket('A-3')).toBe('relinked');
    await check();
    expect(lists().linked).toContain('A-3');
  });

  it('keeps done tickets out of every tab', async () => {
    await denyTicket('D-1');
    await check();
    await restoreTicket('D-2');
    await check();
    await watchTicket('D-1');
    await check();
    expect(lists().watched).not.toContain('D-1');
    expect(lists().watched).not.toContain('D-3');
    expect(lists().newList).not.toContain('D-2');
    expect(lists().notMine).not.toContain('D-1');
  });

  it('survives a seeded random sequence and a hydrate round-trip', async () => {
    let a = 37;
    const rand = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < 200; i++) {
      const key = KEYS[Math.floor(rand() * KEYS.length)];
      const action = Math.floor(rand() * 6);
      if (action === 0) await denyTicket(key);
      else if (action === 1) lastUndo()?.();
      else if (action === 2) await linkTicket(key);
      else if (action === 3) await restoreTicket(key);
      else if (action === 4) await markHandled(key);
      else await watchTicket(key);
      await check();
    }

    const snapshot = lists();
    useTicketStore.getState().hydrateTriageMap({});
    await invoke<Record<string, TriageEntry>>('get_triage_state').then((m) =>
      useTicketStore.getState().hydrateTriageMap(m),
    );
    assertInvariant();
    assertStoreMatchesDb();
    expect(lists()).toEqual(snapshot);
  });
});
