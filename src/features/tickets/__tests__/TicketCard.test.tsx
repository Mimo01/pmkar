import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupStore } from '../../groups/groupStore';
import { NavigationContext } from '../../groups/NavigationContext';
import type { Group } from '../../groups/types';
import { TicketCard } from '../TicketCard';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket } from '../types';

const ticket: JiraTicket = {
  id: '1',
  key: 'P-1',
  fields: {
    summary: 'Card summary',
    status: {
      name: 'Open',
      id: '1',
      statusCategory: { key: 'new' },
    } as JiraTicket['fields']['status'],
    priority: { name: 'High', id: '2' },
    assignee: null,
    created: '2026-01-01T10:00:00.000Z',
    updated: '2026-01-02T10:00:00.000Z',
  },
};

function g(id: number, name: string): Group {
  return {
    id,
    name,
    color: 'blue',
    position: id,
    createdAt: '2026-01-01T00:00:00Z',
    memberCount: 1,
  };
}

const DEV = g(1, 'Dev');
const QA = g(2, 'QA');

function setup(props: Partial<React.ComponentProps<typeof TicketCard>> = {}) {
  const onClick = vi.fn();
  const navigateToGroup = vi.fn();
  const utils = render(
    <NavigationContext.Provider value={{ navigateToGroup }}>
      <TicketCard ticket={ticket} onClick={onClick} {...props} />
    </NavigationContext.Provider>,
  );
  return { onClick, navigateToGroup, user: userEvent.setup(), ...utils };
}

describe('TicketCard', () => {
  beforeEach(() => {
    useGroupStore.setState({
      groups: [DEV, QA],
      groupIdsByIssue: { 'P-1': [1, 2] },
      hydrated: true,
    });
  });

  it('root is a div and the primary button opens detail', async () => {
    const { onClick, user, container } = setup();
    const root = container.querySelector('[data-testid="ticket-card"]');
    expect(root?.tagName).toBe('DIV');
    await user.click(screen.getByRole('button', { name: 'Card summary' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no nested buttons with chips and an actionSlot', () => {
    const { container } = setup({ actionSlot: <button type="button">Restore</button> });
    expect(container.querySelectorAll('button button').length).toBe(0);
  });

  it('chip click navigates and does not open detail', async () => {
    const { onClick, navigateToGroup, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Go to group ‘QA’' }));
    expect(navigateToGroup).toHaveBeenCalledWith(2);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('actionSlot click does not open detail', async () => {
    const handler = vi.fn();
    const { onClick, user } = setup({
      actionSlot: (
        <button type="button" onClick={handler}>
          Restore
        </button>
      ),
    });
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('hideGroupId hides that chip', () => {
    setup({ hideGroupId: 1 });
    expect(screen.queryByRole('button', { name: 'Go to group ‘Dev’' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to group ‘QA’' })).toBeInTheDocument();
  });

  it('has no checkbox when select mode is off', () => {
    setup();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Card summary' })).not.toHaveAttribute(
      'aria-pressed',
    );
  });

  it('select mode: primary button exposes selected state via aria-pressed', () => {
    const { rerender } = setup({ selectMode: true, selected: false, onToggleSelect: vi.fn() });
    expect(screen.getByRole('button', { name: 'Card summary' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    rerender(
      <NavigationContext.Provider value={{ navigateToGroup: vi.fn() }}>
        <TicketCard
          ticket={ticket}
          onClick={vi.fn()}
          selectMode
          selected
          onToggleSelect={vi.fn()}
        />
      </NavigationContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Card summary' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('select mode: body and checkbox toggle without opening detail', async () => {
    const onToggleSelect = vi.fn();
    const { onClick, user } = setup({ selectMode: true, selected: false, onToggleSelect });
    const box = screen.getByRole('checkbox', { name: 'Select P-1' });
    expect(box).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('button', { name: 'Card summary' }));
    expect(onToggleSelect).toHaveBeenLastCalledWith(false);
    await user.click(box);
    expect(onToggleSelect).toHaveBeenLastCalledWith(false);
    expect(onToggleSelect).toHaveBeenCalledTimes(2);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('select mode: shift+click passes shift from body and checkbox', async () => {
    const onToggleSelect = vi.fn();
    const { user } = setup({ selectMode: true, onToggleSelect });
    await user.keyboard('{Shift>}');
    await user.click(screen.getByRole('button', { name: 'Card summary' }));
    expect(onToggleSelect).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('checkbox', { name: 'Select P-1' }));
    expect(onToggleSelect).toHaveBeenLastCalledWith(true);
    await user.keyboard('{/Shift}');
  });

  it('select mode: keyboard Space and Shift+Space on the primary button', async () => {
    const onToggleSelect = vi.fn();
    const { user } = setup({ selectMode: true, onToggleSelect });
    screen.getByRole('button', { name: 'Card summary' }).focus();
    await user.keyboard(' ');
    expect(onToggleSelect).toHaveBeenLastCalledWith(false);
    await user.keyboard('{Shift>}{ }{/Shift}');
    expect(onToggleSelect).toHaveBeenLastCalledWith(true);
  });

  it('select mode: chips still navigate', async () => {
    const onToggleSelect = vi.fn();
    const { navigateToGroup, user } = setup({ selectMode: true, onToggleSelect });
    await user.click(screen.getByRole('button', { name: 'Go to group ‘Dev’' }));
    expect(navigateToGroup).toHaveBeenCalledWith(1);
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it('changed badge tooltip opens on hover', async () => {
    useTicketStore.setState({ unseenChanges: { 'P-1': ['status', 'priority'] } });
    const { user } = setup();
    await user.hover(screen.getByText('Changed'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/status, priority/);
    useTicketStore.setState({ unseenChanges: {} });
  });

  it('selected shows aria-checked true and the marker class', () => {
    const { container } = setup({ selectMode: true, selected: true, onToggleSelect: vi.fn() });
    expect(screen.getByRole('checkbox', { name: 'Select P-1' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(container.querySelector('[data-testid="ticket-card"]')?.className).toContain(
      'inset_3px_0_0',
    );
  });
  describe('dimmed and footerSlot', () => {
    it('adds no opacity-60 without dimmed', () => {
      const { container } = setup();
      expect(container.innerHTML).not.toContain('opacity-60');
    });

    it('dims content but not chips, checkbox or footer', () => {
      const { container } = setup({
        dimmed: true,
        selectMode: true,
        onToggleSelect: vi.fn(),
        footerSlot: <button type="button">Footer btn</button>,
      });
      for (const text of ['P-1', 'Card summary']) {
        expect(screen.getByText(text).className).toContain('opacity-60');
      }
      const unDimmed = [
        screen.getByRole('button', { name: 'Go to group ‘Dev’' }),
        screen.getByRole('checkbox', { name: 'Select P-1' }),
        screen.getByRole('button', { name: 'Footer btn' }),
      ];
      for (const el of unDimmed) {
        let node: HTMLElement | null = el;
        while (node && node !== container) {
          expect(node.className).not.toContain('opacity-60');
          node = node.parentElement;
        }
      }
      expect(screen.getByRole('button', { name: 'Footer btn' }).parentElement?.className).toContain(
        'pl-14',
      );
    });

    it('footer clicks do not trigger onClick and root has data-ticket-key', async () => {
      const inner = vi.fn();
      const { onClick, user, container } = setup({
        footerSlot: (
          <button type="button" onClick={inner}>
            Footer btn
          </button>
        ),
      });
      await user.click(screen.getByRole('button', { name: 'Footer btn' }));
      expect(inner).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
      expect(container.querySelector('[data-ticket-key="P-1"]')).not.toBeNull();
    });
  });
});
