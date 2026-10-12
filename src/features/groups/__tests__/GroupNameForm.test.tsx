import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { GroupNameForm, groupNameErrorKey, useGroupNameForm } from '../GroupNameForm';
import { useGroupStore } from '../groupStore';

const initial = useGroupStore.getState();
const mk = (id: number, name: string) => ({
  id,
  name,
  color: 'blue',
  position: id,
  createdAt: 't',
  memberCount: 0,
});
const groups = [mk(1, 'Sprint 12'), mk(2, 'QA')];

let renameBehavior: () => Promise<unknown>;
let resetRef: ((n: string) => void) | null = null;

function Harness({ onResult }: { onResult?: (r: unknown) => void }) {
  const form = useGroupNameForm({
    action: 'rename',
    excludeGroupId: 1,
    originalName: 'Sprint 12',
  });
  const { reset } = form;
  const [ready, setReady] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only reset
  useEffect(() => {
    reset('Sprint 12');
    resetRef = reset;
    setReady(true);
  }, []);
  // Mount the input only after the prefill, like a popover opened after reset().
  if (!ready) return null;
  return (
    <GroupNameForm
      title="Rename group"
      submitLabel="Rename group"
      form={form}
      selectOnFocus
      onCancel={() => {}}
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await form.submit((d) => useGroupStore.getState().renameGroup(1, d));
        onResult?.(r);
      }}
    />
  );
}

beforeEach(() => {
  invokeMock.mockReset();
  resetRef = null;
  renameBehavior = async () => ({ ...groups[0], name: 'Renamed' });
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'rename_group') return renameBehavior();
    if (cmd === 'list_groups') return groups;
    if (cmd === 'list_group_memberships') return [];
    return null;
  });
  useGroupStore.setState({
    ...initial,
    groups: groups as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
});

const input = () => screen.getByLabelText('Group name') as HTMLInputElement;
const submitBtn = () => screen.getByRole('button', { name: 'Rename group' });
const alertText = () => screen.getByRole('alert').textContent;
const renameCalls = () => invokeMock.mock.calls.filter((c) => c[0] === 'rename_group');

describe('groupNameErrorKey', () => {
  it('maps codes per action', () => {
    expect(groupNameErrorKey('duplicate', 'create')).toBe('groups.error.duplicate');
    expect(groupNameErrorKey('not_found', 'rename')).toBe('groups.error.notFound');
    expect(groupNameErrorKey('internal', 'create')).toBe('groups.error.internal');
    expect(groupNameErrorKey('internal', 'rename')).toBe('groups.error.rename');
  });
});

describe('GroupNameForm (rename mode)', () => {
  it('selects the prefilled name on focus', async () => {
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe(9);
  });

  it('unchanged name disables submit silently', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    expect(submitBtn()).toBeDisabled();
    expect(alertText()).toBe('');
    await user.type(input(), '  ');
    expect(submitBtn()).toBeDisabled();
    expect(alertText()).toBe('');
  });

  it('case-only change of own name is allowed', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    await user.clear(input());
    await user.type(input(), 'sprint 12');
    expect(submitBtn()).toBeEnabled();
    expect(alertText()).toBe('');
  });

  it('duplicate of another group shows inline error', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    await user.clear(input());
    await user.type(input(), 'qa');
    expect(alertText()).toContain('A group with this name already exists');
    expect(submitBtn()).toBeDisabled();
  });

  it('reserved name shows the reserved message', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    await user.clear(input());
    await user.type(input(), 'New');
    expect(alertText()).toContain('This name is reserved for a built-in tab');
    expect(submitBtn()).toBeDisabled();
  });

  it('Rust duplicate is shown inline', async () => {
    renameBehavior = async () => {
      throw { code: 'duplicate' };
    };
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    await user.clear(input());
    await user.type(input(), 'Other{Enter}');
    await waitFor(() => expect(alertText()).toContain('A group with this name already exists'));
  });

  it('Rust not_found shows message and keeps submit disabled until the name changes', async () => {
    renameBehavior = async () => {
      throw { code: 'not_found' };
    };
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    await user.clear(input());
    await user.type(input(), 'Other{Enter}');
    await waitFor(() => expect(alertText()).toContain('This group no longer exists.'));
    expect(submitBtn()).toBeDisabled();
    await user.type(input(), 'x');
    expect(submitBtn()).toBeEnabled();
  });

  it('double submit invokes rename_group once', async () => {
    let release: (v: unknown) => void = () => {};
    renameBehavior = () => new Promise((r) => (release = r));
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    await user.clear(input());
    await user.type(input(), 'Other');
    await user.keyboard('{Enter}{Enter}');
    expect(renameCalls()).toHaveLength(1);
    release({ ...groups[0], name: 'Other' });
    await waitFor(() => expect(submitBtn()).toBeDisabled());
    expect(renameCalls()).toHaveLength(1);
  });

  it('reset while pending: late result is null and no error shows', async () => {
    let reject: (v: unknown) => void = () => {};
    renameBehavior = () => new Promise((_, r) => (reject = r));
    const results: unknown[] = [];
    const user = userEvent.setup();
    renderWithI18n(<Harness onResult={(r) => results.push(r)} />);
    await waitFor(() => expect(input()).toHaveValue('Sprint 12'));
    await user.clear(input());
    await user.type(input(), 'Other{Enter}');
    expect(renameCalls()).toHaveLength(1);
    act(() => resetRef?.('Sprint 12'));
    reject({ code: 'duplicate' });
    await waitFor(() => expect(results).toEqual([null]));
    expect(alertText()).toBe('');
  });
});
