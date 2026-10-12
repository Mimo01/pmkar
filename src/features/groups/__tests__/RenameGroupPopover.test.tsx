import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useGroupStore } from '../groupStore';
import { RenameGroupPopover } from '../RenameGroupPopover';
import type { Group } from '../types';

const initial = useGroupStore.getState();
const mk = (id: number, name: string): Group => ({
  id,
  name,
  color: 'blue',
  position: id,
  createdAt: 't',
  memberCount: 0,
});
const sprint = mk(1, 'Sprint 12');
const groups = [sprint, mk(2, 'QA')];

let renameBehavior: () => Promise<unknown>;

function Harness({
  open = true,
  onOpenChange = () => {},
  onReturnFocus = () => {},
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  onReturnFocus?: () => void;
}) {
  const ref = createRef<HTMLDivElement>();
  return (
    <TooltipProvider>
      <div ref={ref}>anchor</div>
      <RenameGroupPopover
        group={sprint}
        open={open}
        anchorRef={ref}
        onOpenChange={onOpenChange}
        onReturnFocus={onReturnFocus}
      />
    </TooltipProvider>
  );
}

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
  renameBehavior = async () => ({ ...sprint, name: 'Sprint 13' });
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'rename_group') return renameBehavior();
    if (cmd === 'list_groups') return groups;
    if (cmd === 'list_group_memberships') return [];
    return null;
  });
  useGroupStore.setState({
    ...initial,
    groups,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
});

const input = () => screen.getByRole('textbox', { name: 'Group name' }) as HTMLInputElement;
const submitBtn = () => screen.getByRole('button', { name: 'Rename group' });

describe('RenameGroupPopover', () => {
  it('shows title, prefilled focused selected input, no swatches', async () => {
    renderWithI18n(<Harness />);
    expect(await screen.findByRole('heading', { name: 'Rename group' })).toBeInTheDocument();
    await waitFor(() => expect(input()).toHaveFocus());
    expect(input().value).toBe('Sprint 12');
    await waitFor(() => {
      expect(input().selectionStart).toBe(0);
      expect(input().selectionEnd).toBe('Sprint 12'.length);
    });
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('disables submit silently while unchanged', async () => {
    renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Rename group' });
    expect(submitBtn()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('');
  });

  it('Enter submits the new name, closes, and returns focus', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onReturnFocus = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} onReturnFocus={onReturnFocus} />);
    await screen.findByRole('heading', { name: 'Rename group' });
    await user.clear(input());
    await user.type(input(), 'Sprint 13{Enter}');
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('rename_group', { groupId: 1, name: 'Sprint 13' }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('calls onReturnFocus after the popover closes', async () => {
    const onReturnFocus = vi.fn();
    const { rerender } = renderWithI18n(<Harness onReturnFocus={onReturnFocus} />);
    await screen.findByRole('heading', { name: 'Rename group' });
    rerender(<Harness open={false} onReturnFocus={onReturnFocus} />);
    await waitFor(() => expect(onReturnFocus).toHaveBeenCalled());
  });

  it('allows a case-only change', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Rename group' });
    await user.clear(input());
    await user.type(input(), 'sprint 12');
    expect(submitBtn()).toBeEnabled();
  });

  it('shows the duplicate message for another group name', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Rename group' });
    await user.clear(input());
    await user.type(input(), 'QA');
    expect(screen.getByRole('alert')).toHaveTextContent('A group with this name already exists');
    expect(submitBtn()).toBeDisabled();
  });

  it('shows Rust reserved error inline and stays open', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Rename group' });
    renameBehavior = async () => {
      throw { code: 'reserved' };
    };
    await user.clear(input());
    await user.type(input(), 'Zed');
    await user.click(submitBtn());
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This name is reserved for a built-in tab',
      ),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('not_found shows message and disables submit', async () => {
    const user = userEvent.setup();
    renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Rename group' });
    renameBehavior = async () => {
      throw { code: 'not_found' };
    };
    await user.clear(input());
    await user.type(input(), 'Zed');
    await user.click(submitBtn());
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('This group no longer exists.'),
    );
    expect(submitBtn()).toBeDisabled();
  });

  it('Cancel closes without invoking rename_group', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Rename group' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invokeMock).not.toHaveBeenCalledWith('rename_group', expect.anything());
  });

  it('Esc closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Rename group' });
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invokeMock).not.toHaveBeenCalledWith('rename_group', expect.anything());
  });

  it('reopening resets input and clears error', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Rename group' });
    await user.clear(input());
    await user.type(input(), 'QA');
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
    await act(async () => {
      rerender(<Harness open={false} />);
    });
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    await act(async () => {
      rerender(<Harness open />);
    });
    await screen.findByRole('heading', { name: 'Rename group' });
    await waitFor(() => expect(input().value).toBe('Sprint 12'));
    expect(screen.getByRole('alert')).toHaveTextContent('');
  });

  it('selects the whole existing name when reopened after a different edit', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Rename group' });
    await user.clear(input());
    await user.type(input(), 'Q');
    await act(async () => {
      rerender(<Harness open={false} />);
    });
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    await act(async () => {
      rerender(<Harness open />);
    });
    await waitFor(() => expect(input()).toHaveFocus());
    // The input mounts already seeded, so select-on-focus covers the full name.
    expect(input().value).toBe('Sprint 12');
    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe('Sprint 12'.length);
  });

  it('mounts the input with the group name already seeded', async () => {
    const seen: string[] = [];
    const { rerender } = renderWithI18n(<Harness open={false} />);
    const orig = HTMLInputElement.prototype.select;
    const spy = vi.spyOn(HTMLInputElement.prototype, 'select').mockImplementation(function (
      this: HTMLInputElement,
    ) {
      seen.push(this.value);
      orig.call(this);
    });
    await act(async () => {
      rerender(<Harness open />);
    });
    await waitFor(() => expect(input()).toHaveFocus());
    spy.mockRestore();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((v) => v === 'Sprint 12')).toBe(true);
  });
});
