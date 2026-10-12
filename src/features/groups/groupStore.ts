import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { JiraTicket } from '../tickets/types';
import { type GroupColorToken, isGroupColorToken } from './colors';
import type {
  Group,
  GroupErrorCode,
  GroupMember,
  GroupMembership,
  GroupResult,
  MoveDirection,
} from './types';

const ERROR_CODES: readonly GroupErrorCode[] = [
  'empty',
  'too_long',
  'duplicate',
  'reserved',
  'no_scope',
  'not_found',
  'invalid_color',
  'invalid_issue_key',
  'invalid_ticket',
  'internal',
];

export function toGroupErrorCode(err: unknown): GroupErrorCode {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === 'string' && (ERROR_CODES as readonly string[]).includes(code)) {
      return code as GroupErrorCode;
    }
  }
  return 'internal';
}

interface GroupState {
  groups: Group[];
  memberKeysByGroup: Record<number, string[]>;
  groupIdsByIssue: Record<string, number[]>;
  hydrated: boolean;
  hydrateError: boolean;
  hydrate: () => Promise<void>;
  rehydrateAfter: (persist: Promise<unknown>) => Promise<void>;
  createGroup: (name: string, color?: GroupColorToken) => Promise<GroupResult<Group>>;
  renameGroup: (groupId: number, name: string) => Promise<GroupResult<Group>>;
  setGroupColor: (groupId: number, color: GroupColorToken) => Promise<GroupResult<Group>>;
  moveGroup: (groupId: number, direction: MoveDirection) => Promise<GroupResult<Group[]>>;
  deleteGroup: (groupId: number) => Promise<GroupResult<null>>;
  addToGroup: (groupId: number, tickets: readonly JiraTicket[]) => Promise<GroupResult<number>>;
  removeFromGroup: (groupId: number, issueKeys: readonly string[]) => Promise<GroupResult<number>>;
  getGroupMembers: (groupId: number) => Promise<GroupResult<GroupMember[]>>;
}

export const useGroupStore = create<GroupState>((set, get) => {
  async function mutate<T>(
    command: string,
    args: Record<string, unknown>,
  ): Promise<GroupResult<T>> {
    let value: T;
    try {
      value = await invoke<T>(command, args);
    } catch (err) {
      return { ok: false, code: toGroupErrorCode(err) };
    }
    await get().hydrate();
    return { ok: true, value };
  }

  let hydrateSeq = 0;

  return {
    groups: [],
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: false,
    hydrateError: false,

    rehydrateAfter: async (persist) => {
      try {
        await persist;
      } catch {
        // Rust state is read as-is regardless of persistence outcome.
      }
      await get().hydrate();
    },

    hydrate: async () => {
      const seq = ++hydrateSeq;
      try {
        const [rawGroups, rawMemberships] = await Promise.all([
          invoke<Group[]>('list_groups'),
          invoke<GroupMembership[]>('list_group_memberships'),
        ]);
        // A newer hydrate started; drop this stale response.
        if (seq !== hydrateSeq) return;
        if (!Array.isArray(rawGroups) || !Array.isArray(rawMemberships)) {
          throw new Error('unexpected group payload');
        }
        const groups = rawGroups
          .map((g) => ({
            ...g,
            color: isGroupColorToken(g.color) ? g.color : ('slate' as GroupColorToken),
          }))
          .sort((a, b) => a.position - b.position);
        const memberKeysByGroup: Record<number, string[]> = {};
        const groupIdsByIssue: Record<string, number[]> = {};
        const knownIds = new Set(groups.map((g) => g.id));
        for (const m of rawMemberships) {
          if (!knownIds.has(m.groupId)) continue;
          if (!memberKeysByGroup[m.groupId]) memberKeysByGroup[m.groupId] = [];
          memberKeysByGroup[m.groupId].push(m.issueKey);
          if (!groupIdsByIssue[m.issueKey]) groupIdsByIssue[m.issueKey] = [];
          groupIdsByIssue[m.issueKey].push(m.groupId);
        }
        set({ groups, memberKeysByGroup, groupIdsByIssue, hydrated: true, hydrateError: false });
      } catch {
        if (seq !== hydrateSeq) return;
        // Keep the last good state so tabs never vanish on a transient failure.
        set({ hydrated: true, hydrateError: true });
      }
    },

    createGroup: (name, color) => mutate<Group>('create_group', { name, color }),
    renameGroup: (groupId, name) => mutate<Group>('rename_group', { groupId, name }),
    setGroupColor: (groupId, color) => mutate<Group>('set_group_color', { groupId, color }),
    moveGroup: (groupId, direction) => mutate<Group[]>('move_group', { groupId, direction }),
    deleteGroup: (groupId) => mutate<null>('delete_group', { groupId }),
    addToGroup: (groupId, tickets) =>
      mutate<number>('add_issues_to_group', {
        groupId,
        issues: tickets.map((t) => ({ issueKey: t.key, ticketJson: JSON.stringify(t) })),
      }),
    removeFromGroup: (groupId, issueKeys) =>
      mutate<number>('remove_issues_from_group', { groupId, issueKeys }),

    getGroupMembers: async (groupId) => {
      try {
        const value = await invoke<GroupMember[]>('get_group_members', { groupId });
        return { ok: true, value };
      } catch (err) {
        return { ok: false, code: toGroupErrorCode(err) };
      }
    },
  };
});

export const selectGroupIdsForIssue =
  (issueKey: string) =>
  (s: GroupState): number[] | null =>
    s.groupIdsByIssue[issueKey] ?? null;
