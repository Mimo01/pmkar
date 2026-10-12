import type { TFunction } from 'i18next';
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
import type { JiraTicket } from '../../tickets/types';
import { useGroupStore } from '../groupStore';
import {
  addIssuesWithFeedback,
  membershipErrorKey,
  removeIssuesWithFeedback,
} from '../membershipActions';

const initial = useGroupStore.getState();
const group = { id: 3, name: 'QA' };
let t: TFunction;

function ticket(n: number): JiraTicket {
  return {
    id: String(n),
    key: `P-${n}`,
    fields: { summary: 's', status: { name: 'x' }, priority: null, assignee: null, updated: 'u' },
  } as unknown as JiraTicket;
}
const tickets = (n: number) => Array.from({ length: n }, (_, i) => ticket(i + 1));

let mutationResult: () => Promise<unknown>;

beforeAll(async () => {
  await i18n.changeLanguage('en');
  t = i18n.t.bind(i18n) as unknown as TFunction;
});

beforeEach(() => {
  vi.clearAllMocks();
  invokeMock.mockReset();
  mutationResult = async () => 0;
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'add_issues_to_group' || cmd === 'remove_issues_from_group') {
      return mutationResult();
    }
    if (cmd === 'list_groups') return [];
    if (cmd === 'list_group_memberships') return [];
    return null;
  });
  useGroupStore.setState({ ...initial, hydrated: true });
});

describe('membershipErrorKey', () => {
  it('maps not_found and everything else', () => {
    expect(membershipErrorKey('not_found')).toBe('groups.error.notFound');
    expect(membershipErrorKey('internal')).toBe('groups.error.membership');
  });
});

describe('addIssuesWithFeedback', () => {
  it('toasts the added count', async () => {
    mutationResult = async () => 3;
    expect(await addIssuesWithFeedback(group, tickets(3), t)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Added 3 issues to ‘QA’');
  });

  it('mentions skipped issues', async () => {
    mutationResult = async () => 3;
    expect(await addIssuesWithFeedback(group, tickets(5), t)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Added 3 issues to ‘QA’ (2 already in group)');
  });

  it('treats all-already-in as success with an info toast', async () => {
    mutationResult = async () => 0;
    expect(await addIssuesWithFeedback(group, tickets(2), t)).toBe(true);
    expect(toast.info).toHaveBeenCalledWith('All selected issues are already in ‘QA’.');
  });

  it('reports not_found', async () => {
    mutationResult = async () => {
      throw { code: 'not_found' };
    };
    expect(await addIssuesWithFeedback(group, tickets(1), t)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('This group no longer exists.');
  });

  it('reports internal errors', async () => {
    mutationResult = async () => {
      throw { code: 'internal' };
    };
    expect(await addIssuesWithFeedback(group, tickets(1), t)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Could not update the group. Try again.');
  });

  it('makes exactly one atomic call with all tickets', async () => {
    mutationResult = async () => 4;
    await addIssuesWithFeedback(group, tickets(4), t);
    const calls = invokeMock.mock.calls.filter((c) => c[0] === 'add_issues_to_group');
    expect(calls).toHaveLength(1);
    expect((calls[0][1] as { issues: unknown[] }).issues).toHaveLength(4);
  });
});

describe('removeIssuesWithFeedback', () => {
  it('toasts the removed count', async () => {
    mutationResult = async () => 4;
    expect(await removeIssuesWithFeedback(group, ['A-1', 'A-2', 'A-3', 'A-4'], t)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Removed 4 issues from ‘QA’');
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'remove_issues_from_group')).toHaveLength(
      1,
    );
  });

  it('toasts an error on failure', async () => {
    mutationResult = async () => {
      throw { code: 'internal' };
    };
    expect(await removeIssuesWithFeedback(group, ['A-1'], t)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Could not update the group. Try again.');
  });
});
