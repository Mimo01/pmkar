import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu';

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

function DropdownHarness() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>First</DropdownMenuItem>
        <DropdownMenuItem disabled>Second</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive>Third</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu wrapper', () => {
  it('opens with Enter, supports arrow navigation skipping disabled, and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);

    // Keyboard open focuses the first item; ArrowDown skips the disabled one.
    expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Third' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('marks disabled items with aria-disabled and data-disabled', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);
    screen.getByRole('button', { name: 'Open' }).focus();
    await user.keyboard('{Enter}');
    const disabled = await screen.findByRole('menuitem', { name: 'Second' });
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(disabled).toHaveAttribute('data-disabled');
  });

  it('applies destructive styling without leaking the prop to the DOM', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);
    screen.getByRole('button', { name: 'Open' }).focus();
    await user.keyboard('{Enter}');
    const item = await screen.findByRole('menuitem', { name: 'Third' });
    expect(item).toHaveClass('text-destructive-text');
    expect(item).not.toHaveAttribute('destructive');
  });
});

describe('ContextMenu wrapper', () => {
  it('opens on contextmenu and fires onSelect then closes', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ContextMenu>
        <ContextMenuTrigger>Area</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onSelect}>Do it</ContextMenuItem>
          <ContextMenuItem destructive>Remove</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText('Area'));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Remove' })).toHaveClass('text-destructive-text');

    await user.click(screen.getByRole('menuitem', { name: 'Do it' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
