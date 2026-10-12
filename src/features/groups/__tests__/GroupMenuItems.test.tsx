import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { GroupMenuItems, type GroupMenuItemsProps } from '../GroupMenuItems';

function handlers() {
  return {
    onRename: vi.fn(),
    onChangeColor: vi.fn(),
    onMoveLeft: vi.fn(),
    onMoveRight: vi.fn(),
    onDelete: vi.fn(),
  };
}

function renderDropdown(over: Partial<GroupMenuItemsProps> = {}) {
  const h = handlers();
  renderWithI18n(
    <DropdownMenu open>
      <DropdownMenuContent>
        <GroupMenuItems variant="dropdown" canMoveLeft canMoveRight {...h} {...over} />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  return h;
}

const LABELS = ['Rename…', 'Change color…', 'Move left', 'Move right', 'Delete group…'];
const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('GroupMenuItems', () => {
  it('renders items in order with two separators (dropdown)', () => {
    renderDropdown();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((e) => e.textContent)).toEqual(LABELS);
    const seps = screen.getAllByRole('separator');
    expect(seps).toHaveLength(2);
    expect(items[1].compareDocumentPosition(seps[0]) & FOLLOWING).toBeTruthy();
    expect(seps[0].compareDocumentPosition(items[2]) & FOLLOWING).toBeTruthy();
    expect(items[3].compareDocumentPosition(seps[1]) & FOLLOWING).toBeTruthy();
    expect(seps[1].compareDocumentPosition(items[4]) & FOLLOWING).toBeTruthy();
  });

  it('disables Move left / Move right at the edges', () => {
    renderDropdown({ canMoveLeft: false, canMoveRight: false });
    expect(screen.getByRole('menuitem', { name: 'Move left' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Move right' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('disabled items do not call their handlers', async () => {
    const h = renderDropdown({ canMoveLeft: false });
    await userEvent.setup().click(screen.getByRole('menuitem', { name: 'Move left' }));
    expect(h.onMoveLeft).not.toHaveBeenCalled();
  });

  it('styles Delete group as destructive', () => {
    renderDropdown();
    expect(screen.getByRole('menuitem', { name: 'Delete group…' })).toHaveClass('text-destructive');
  });

  it('selecting each enabled item calls exactly its handler once', async () => {
    const h = renderDropdown();
    const user = userEvent.setup();
    await user.click(screen.getByRole('menuitem', { name: 'Rename…' }));
    expect(h.onRename).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('menuitem', { name: 'Change color…' }));
    expect(h.onChangeColor).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('menuitem', { name: 'Move left' }));
    expect(h.onMoveLeft).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('menuitem', { name: 'Move right' }));
    expect(h.onMoveRight).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('menuitem', { name: 'Delete group…' }));
    expect(h.onDelete).toHaveBeenCalledTimes(1);
  });

  it('context variant renders the same labels in order', () => {
    const h = handlers();
    renderWithI18n(
      <ContextMenu>
        <ContextMenuTrigger>
          <div data-testid="t">target</div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <GroupMenuItems variant="context" canMoveLeft canMoveRight {...h} />
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByTestId('t'));
    expect(screen.getAllByRole('menuitem').map((e) => e.textContent)).toEqual(LABELS);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });
});
