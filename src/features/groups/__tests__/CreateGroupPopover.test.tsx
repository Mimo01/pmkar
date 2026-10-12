import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { CreateGroupPopover } from '../CreateGroupPopover';
import { useGroupStore } from '../groupStore';

const initial = useGroupStore.getState();
const sprint = {
  id: 1,
  name: 'Sprint',
  color: 'blue',
  position: 0,
  createdAt: 't',
  memberCount: 0,
};

let createBehavior: () => Promise<unknown>;
let createdGroup: unknown = null;
let listBehavior: () => Promise<unknown>;

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

beforeEach(() => {
  invokeMock.mockReset();
  createBehavior = async () => ({ ...sprint, id: 5, name: 'QA' });
  createdGroup = null;
  listBehavior = async () => (createdGroup ? [sprint, createdGroup] : [sprint]);
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'create_group') {
      const g = await createBehavior();
      createdGroup = g;
      return g;
    }
    if (cmd === 'list_groups') return listBehavior();
    if (cmd === 'list_group_memberships') return [];
    return null;
  });
  useGroupStore.setState({
    ...initial,
    groups: [sprint] as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
});

async function setup() {
  const user = userEvent.setup();
  const onCreated = vi.fn();
  renderWithI18n(
    <TooltipProvider>
      <CreateGroupPopover onCreated={onCreated} />
    </TooltipProvider>,
  );
  const trigger = screen.getByRole('button', { name: 'New group' });
  await user.click(trigger);
  const input = await screen.findByLabelText('Group name');
  return { user, onCreated, trigger, input };
}

const createButton = () => screen.getByRole('button', { name: 'Create' });
const alertText = () => screen.getByRole('alert').textContent;
const createCalls = () => invokeMock.mock.calls.filter((c) => c[0] === 'create_group');

describe('CreateGroupPopover', () => {
  it('trigger has dialog semantics and toggles aria-expanded', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <TooltipProvider>
        <CreateGroupPopover onCreated={vi.fn()} />
      </TooltipProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'New group' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows title and autofocuses the input on open', async () => {
    const { input } = await setup();
    expect(screen.getByRole('heading', { name: 'New group' })).toBeVisible();
    expect(document.activeElement).toBe(input);
  });

  it('whitespace-only disables Create silently', async () => {
    const { user, input } = await setup();
    await user.type(input, '   ');
    expect(createButton()).toBeDisabled();
    expect(alertText()).toBe('');
  });

  it('duplicate shows inline error, disables Create, wires aria', async () => {
    const { user, input } = await setup();
    await user.type(input, 'sprint');
    expect(alertText()).toContain('A group with this name already exists');
    expect(createButton()).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });

  it('reserved and too long names show messages', async () => {
    const { user, input } = await setup();
    await user.type(input, 'Dismissed');
    expect(alertText()).toContain('This name is reserved for a built-in tab');
    await user.clear(input);
    await user.type(input, 'a'.repeat(41));
    expect(alertText()).toContain('Name can be at most 40 characters');
    expect(createButton()).toBeDisabled();
  });

  it('zero-width space does not defeat duplicate detection', async () => {
    const { user, input } = await setup();
    await user.type(input, 'Sprint\u200B');
    expect(alertText()).toContain('A group with this name already exists');
  });

  it('valid name + Enter creates, closes, calls onCreated, does not refocus trigger', async () => {
    const { user, input, onCreated, trigger } = await setup();
    await user.type(input, 'QA{Enter}');
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(5));
    expect(invokeMock).toHaveBeenCalledWith(
      'create_group',
      expect.objectContaining({ name: 'QA' }),
    );
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(trigger);
  });

  it('create succeeds but follow-up hydrate fails: no onCreated, focus returns to trigger', async () => {
    listBehavior = async () => {
      if (createdGroup) throw new Error('hydrate failed');
      return [sprint];
    };
    const { user, input, onCreated, trigger } = await setup();
    await user.type(input, 'QA{Enter}');
    await waitFor(() => expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument());
    expect(useGroupStore.getState().hydrateError).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('double Enter invokes create_group once', async () => {
    let release: (v: unknown) => void = () => {};
    createBehavior = () => new Promise((r) => (release = r));
    const { user, input, onCreated } = await setup();
    await user.type(input, 'QA');
    await user.keyboard('{Enter}{Enter}');
    expect(createCalls()).toHaveLength(1);
    release({ ...sprint, id: 5, name: 'QA' });
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createCalls()).toHaveLength(1);
  });

  it('no_scope rejection shows its message and stays open; typing clears it', async () => {
    createBehavior = async () => {
      throw { code: 'no_scope' };
    };
    const { user, input } = await setup();
    await user.type(input, 'QA{Enter}');
    await waitFor(() =>
      expect(alertText()).toContain('No project scope is selected. Choose one in Settings'),
    );
    expect(screen.getByLabelText('Group name')).toBeInTheDocument();
    await user.type(input, 'x');
    expect(alertText()).toBe('');
  });

  it('duplicate rejection from Rust shows duplicate message', async () => {
    createBehavior = async () => {
      throw { code: 'duplicate' };
    };
    const { user, input } = await setup();
    await user.type(input, 'QA{Enter}');
    await waitFor(() => expect(alertText()).toContain('A group with this name already exists'));
  });

  it('unknown code and plain Error fall back to generic message', async () => {
    createBehavior = async () => {
      throw { code: 'weird' };
    };
    const { user, input } = await setup();
    await user.type(input, 'QA{Enter}');
    await waitFor(() => expect(alertText()).toContain('Could not create the group. Try again.'));
    createBehavior = async () => {
      throw new Error('boom');
    };
    await user.type(input, 'x');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(alertText()).toContain('Could not create the group. Try again.'));
    expect(alertText()).not.toContain('boom');
  });

  it('Esc closes, returns focus to trigger, reopen is reset', async () => {
    const { user, input, trigger } = await setup();
    await user.type(input, 'Sprint');
    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    const again = await screen.findByLabelText('Group name');
    expect(again).toHaveValue('');
    expect(alertText()).toBe('');
  });

  it('Cancel closes without invoking create_group', async () => {
    const { user, input } = await setup();
    await user.type(input, 'QA');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument();
    expect(createCalls()).toHaveLength(0);
  });
});
