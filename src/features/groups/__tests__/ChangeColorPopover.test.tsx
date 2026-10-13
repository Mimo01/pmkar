import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { ChangeColorPopover } from '../ChangeColorPopover';
import { useGroupStore } from '../groupStore';
import type { Group } from '../types';

const initial = useGroupStore.getState();
const sprint: Group = {
  id: 1,
  name: 'Sprint 12',
  color: 'blue',
  position: 1,
  createdAt: 't',
  memberCount: 0,
};

let colorBehavior: () => Promise<unknown>;

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
      <ChangeColorPopover
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
  vi.mocked(toast.error).mockClear();
  colorBehavior = async () => ({ ...sprint, color: 'teal' });
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'set_group_color') return colorBehavior();
    if (cmd === 'list_groups') return [sprint];
    if (cmd === 'list_group_memberships') return [];
    return null;
  });
  useGroupStore.setState({
    ...initial,
    groups: [sprint],
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
});

describe('ChangeColorPopover', () => {
  it('shows 8 swatches with the current color checked and focused', async () => {
    renderWithI18n(<Harness />);
    expect(await screen.findByRole('heading', { name: 'Change color' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Color' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(8);
    const blue = screen.getByRole('radio', { name: 'Blue' });
    expect(blue).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(blue).toHaveFocus());
  });

  it('arrows move focus only; Enter applies and closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Change color' });
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Blue' })).toHaveFocus());
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Teal' })).toHaveFocus();
    expect(invokeMock).not.toHaveBeenCalledWith('set_group_color', expect.anything());
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('set_group_color', { groupId: 1, color: 'teal' }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('click applies and closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Change color' });
    await user.click(screen.getByRole('radio', { name: 'Purple' }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('set_group_color', { groupId: 1, color: 'purple' }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('picking the current color just closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Change color' });
    await user.click(screen.getByRole('radio', { name: 'Blue' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invokeMock).not.toHaveBeenCalledWith('set_group_color', expect.anything());
  });

  it('Esc closes with no change', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Change color' });
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invokeMock).not.toHaveBeenCalledWith('set_group_color', expect.anything());
  });

  it('calls onReturnFocus after close', async () => {
    const onReturnFocus = vi.fn();
    const { rerender } = renderWithI18n(<Harness onReturnFocus={onReturnFocus} />);
    await screen.findByRole('heading', { name: 'Change color' });
    rerender(<Harness open={false} onReturnFocus={onReturnFocus} />);
    await waitFor(() => expect(onReturnFocus).toHaveBeenCalled());
  });

  it('not_found closes and toasts', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    colorBehavior = async () => {
      throw { code: 'not_found' };
    };
    renderWithI18n(<Harness onOpenChange={onOpenChange} />);
    await screen.findByRole('heading', { name: 'Change color' });
    await user.click(screen.getByRole('radio', { name: 'Teal' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This group no longer exists.'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('internal error toasts the color message', async () => {
    const user = userEvent.setup();
    colorBehavior = async () => {
      throw { code: 'internal' };
    };
    renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Change color' });
    await user.click(screen.getByRole('radio', { name: 'Teal' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not change the color. Try again.'),
    );
  });

  it('shows no in-use markers', async () => {
    renderWithI18n(<Harness />);
    await screen.findByRole('heading', { name: 'Change color' });
    expect(screen.queryByText(/in use/i)).toBeNull();
  });
});
