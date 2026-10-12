import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket } from '../../tickets/types';
import { useGroupStore } from '../groupStore';
import { isRenderableTicket, useGroupMembers } from '../useGroupMembers';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

function mk(key: string, summary = key): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { name: 'Open', id: '1' },
      priority: { name: 'High', id: '2' },
      assignee: null,
      created: '2026-01-10T10:00:00.000Z',
      updated: '2026-01-10T10:00:00.000Z',
    },
  };
}

const snap = (key: string, summary: string) => ({
  issueKey: key,
  ticketJson: JSON.stringify(mk(key, summary)),
  addedAt: '2026-01-01',
});

describe('useGroupMembers', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    mockInvoke.mockReset();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useGroupStore.setState({ memberKeysByGroup: {}, hydrated: true });
    useTicketStore.setState({ tickets: [], triageMap: {} });
  });
  afterEach(() => warn.mockRestore());

  it('no entry: keys null, no members, not loading', () => {
    const { result } = renderHook(() => useGroupMembers(1));
    expect(result.current).toEqual({ keys: null, members: [], loading: false });
  });

  it('prefers live ticket, falls back to snapshot, keeps order', async () => {
    useGroupStore.setState({ memberKeysByGroup: { 1: ['T-1', 'T-2'] } });
    useTicketStore.setState({ tickets: [mk('T-1', 'LIVE')] });
    mockInvoke.mockResolvedValue([snap('T-1', 'OLD'), snap('T-2', 'SNAP')]);
    const { result } = renderHook(() => useGroupMembers(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members.map((m) => m.key)).toEqual(['T-1', 'T-2']);
    expect(result.current.members[0].fields.summary).toBe('LIVE');
    expect(result.current.members[1].fields.summary).toBe('SNAP');
  });

  it('loading until snapshots resolve', async () => {
    useGroupStore.setState({ memberKeysByGroup: { 1: ['T-2'] } });
    let resolve: (v: unknown) => void = () => {};
    mockInvoke.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }) as never,
    );
    const { result } = renderHook(() => useGroupMembers(1));
    expect(result.current.loading).toBe(true);
    expect(result.current.members).toEqual([]);
    resolve([snap('T-2', 'S')]);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members).toHaveLength(1);
  });

  it('all live: not loading immediately', () => {
    useGroupStore.setState({ memberKeysByGroup: { 1: ['T-1'] } });
    useTicketStore.setState({ tickets: [mk('T-1')] });
    mockInvoke.mockResolvedValue([]);
    const { result } = renderHook(() => useGroupMembers(1));
    expect(result.current.loading).toBe(false);
  });

  it('skips unreadable snapshots with a warning', async () => {
    useGroupStore.setState({ memberKeysByGroup: { 1: ['T-1', 'T-2'] } });
    mockInvoke.mockResolvedValue([
      { issueKey: 'T-1', ticketJson: '{bad', addedAt: '' },
      { issueKey: 'T-2', ticketJson: '{"key":"T-2","fields":{"summary":"x"}}', addedAt: '' },
    ]);
    const { result } = renderHook(() => useGroupMembers(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('T-1'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('T-2'));
  });

  it('fetch failure: live members kept, warns', async () => {
    useGroupStore.setState({ memberKeysByGroup: { 1: ['T-1', 'T-2'] } });
    useTicketStore.setState({ tickets: [mk('T-1')] });
    mockInvoke.mockRejectedValue('boom');
    const { result } = renderHook(() => useGroupMembers(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members.map((m) => m.key)).toEqual(['T-1']);
    expect(warn).toHaveBeenCalled();
  });
});

describe('isRenderableTicket', () => {
  it('accepts a full ticket', () => expect(isRenderableTicket(mk('A-1'))).toBe(true));
  it('rejects malformed values', () => {
    const noPriority = mk('A-1') as unknown as { fields: Record<string, unknown> };
    delete noPriority.fields.priority;
    const noUpdated = mk('A-1') as unknown as { fields: Record<string, unknown> };
    delete noUpdated.fields.updated;
    const noKey = { ...mk('A-1') } as Record<string, unknown>;
    delete noKey.key;
    for (const v of [null, {}, noKey, noPriority, noUpdated]) {
      expect(isRenderableTicket(v)).toBe(false);
    }
  });
});
