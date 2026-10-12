import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import i18n from '../../../i18n/index';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { DeleteGroupDialog, type DeleteGroupTarget } from '../DeleteGroupDialog';
import { useGroupStore } from '../groupStore';

const initial = useGroupStore.getState();
const target: DeleteGroupTarget = { id: 1, name: 'Sprint 12', memberCount: 3 };

let deleteBehavior: () => Promise<unknown>;

beforeEach(() => {
  invokeMock.mockReset();
  deleteBehavior = async () => null;
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'delete_group') return deleteBehavior();
    if (cmd === 'list_groups') return [];
    if (cmd === 'list_group_memberships') return [];
    return null;
  });
  useGroupStore.setState({
    ...initial,
    groups: [
      { id: 1, name: 'Sprint 12', color: 'blue', position: 0, createdAt: 't', memberCount: 3 },
    ] as never,
    hydrated: true,
    hydrateError: false,
  });
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

function setup(t: DeleteGroupTarget = target) {
  const onOpenChange = vi.fn();
  const onDeleted = vi.fn();
  const onReturnFocus = vi.fn();
  const ui = (tg: DeleteGroupTarget | null) => (
    <DeleteGroupDialog
      target={tg}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      onReturnFocus={onReturnFocus}
    />
  );
  const view = renderWithI18n(ui(t));
  return { user: userEvent.setup(), onOpenChange, onDeleted, onReturnFocus, view, ui };
}

const deleteCalls = () => invokeMock.mock.calls.filter((c) => c[0] === 'delete_group');

describe('DeleteGroupDialog', () => {
  it('renders an alertdialog with title, body and Keep focused', async () => {
    setup();
    const dlg = await screen.findByRole('alertdialog', { name: 'Delete “Sprint 12”?' });
    expect(dlg.textContent).toContain(
      '3 issues are in this group. The issues themselves are not affected.',
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep group' })),
    );
  });

  it('uses singular, empty and Slovak plural copy', async () => {
    const one = setup({ ...target, memberCount: 1 });
    expect((await screen.findByRole('alertdialog')).textContent).toContain(
      '1 issue is in this group.',
    );
    one.view.unmount();

    const zero = setup({ ...target, memberCount: 0 });
    expect((await screen.findByRole('alertdialog')).textContent).toContain('This group is empty.');
    zero.view.unmount();

    await act(async () => {
      await i18n.changeLanguage('sk');
    });
    const sk3 = setup({ ...target, memberCount: 3 });
    expect((await screen.findByRole('alertdialog')).textContent).toContain(
      'V tejto skupine sú 3 úlohy. Samotné úlohy sa nezmenia.',
    );
    sk3.view.unmount();
    setup({ ...target, memberCount: 5 });
    expect((await screen.findByRole('alertdialog')).textContent).toContain(
      'V tejto skupine je 5 úloh.',
    );
  });

  it('has no Close button', async () => {
    setup();
    await screen.findByRole('alertdialog');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('Keep group dismisses without deleting', async () => {
    const { user, onOpenChange, onReturnFocus, view, ui } = setup();
    await user.click(await screen.findByRole('button', { name: 'Keep group' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    view.rerender(ui(null));
    await waitFor(() => expect(onReturnFocus).toHaveBeenCalledWith(false));
    expect(deleteCalls()).toHaveLength(0);
  });

  it('Esc dismisses without deleting', async () => {
    const { user, onOpenChange } = setup();
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(deleteCalls()).toHaveLength(0);
  });

  it('confirm deletes, reports onDeleted, then returns focus with true', async () => {
    const { user, onOpenChange, onDeleted, onReturnFocus, view, ui } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete group' }));
    expect(invokeMock).toHaveBeenCalledWith('delete_group', { groupId: 1 });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    view.rerender(ui(null));
    await waitFor(() => expect(onReturnFocus).toHaveBeenCalledWith(true));
  });

  it('shows not_found inline and stays open', async () => {
    deleteBehavior = async () => {
      throw { code: 'not_found' };
    };
    const { user, onDeleted } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete group' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('This group no longer exists.'),
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('shows generic error for other failures', async () => {
    deleteBehavior = async () => {
      throw { code: 'internal' };
    };
    const { user, onDeleted } = setup();
    await user.click(await screen.findByRole('button', { name: 'Delete group' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Could not delete the group. Try again.',
      ),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('disables buttons while pending and does not double-invoke', async () => {
    let resolve!: (v: unknown) => void;
    deleteBehavior = () => new Promise((r) => (resolve = r));
    const { user } = setup();
    const del = await screen.findByRole('button', { name: 'Delete group' });
    await user.click(del);
    await waitFor(() => expect((del as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole('button', { name: 'Keep group' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.click(del);
    expect(deleteCalls()).toHaveLength(1);
    await act(async () => {
      resolve(null);
    });
  });

  it('keeps the snapshot count when the store changes', async () => {
    setup();
    await screen.findByRole('alertdialog');
    act(() => {
      useGroupStore.setState({
        groups: [
          { id: 1, name: 'Sprint 12', color: 'blue', position: 0, createdAt: 't', memberCount: 9 },
        ] as never,
      });
    });
    expect(screen.getByRole('alertdialog').textContent).toContain('3 issues');
  });
});
