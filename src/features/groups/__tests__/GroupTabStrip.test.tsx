import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastErrorMock(...a) } }));

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { GroupTabStrip } from '../GroupTabStrip';
import { useGroupStore } from '../groupStore';

const initial = useGroupStore.getState();
const sprint = {
  id: 1,
  name: 'Sprint 12',
  color: 'blue',
  position: 0,
  createdAt: 't',
  memberCount: 3,
};
const qa = { id: 2, name: 'QA', color: 'teal', position: 1, createdAt: 't', memberCount: 1 };
const ops = { id: 3, name: 'Ops', color: 'slate', position: 2, createdAt: 't', memberCount: 0 };

const scrollIntoViewMock = vi.fn();
const scrollByMock = vi.fn();

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  Element.prototype.scrollBy = scrollByMock;
});

function seed(groups: unknown[]) {
  useGroupStore.setState({
    ...initial,
    groups: groups as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  scrollIntoViewMock.mockReset();
  scrollByMock.mockReset();
  toastErrorMock.mockReset();
  invokeMock.mockImplementation(async () => null);
  seed([]);
});

function setOverflowMetrics(scrollWidth: number, clientWidth: number, scrollLeft: number) {
  const scroller = screen.getByTestId('group-tab-scroller');
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(scroller, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: scrollLeft,
  });
  return scroller;
}

describe('GroupTabStrip', () => {
  it('with zero groups shows divider and the New group plus only', () => {
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    expect(screen.getByTestId('group-divider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New group' })).toBeInTheDocument();
    expect(screen.queryByTestId('group-tab-scroller')?.children.length).toBe(0);
  });

  it('renders tabs in order with dot color and count', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    const a = screen.getByRole('button', { name: 'Sprint 12, 3 issues' });
    const b = screen.getByRole('button', { name: 'QA, 1 issue' });
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const dot = a.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe('var(--color-group-blue)');
    expect(a).toHaveTextContent('3');
  });

  it('marks the active tab with aria-current and brand styling', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
    const b = screen.getByRole('button', { name: 'QA, 1 issue' });
    expect(b).toHaveAttribute('aria-current', 'page');
    expect(b.parentElement?.className).toContain('border-brand');
    expect(b.className).toContain('font-semibold');
    expect(screen.getByRole('button', { name: 'Sprint 12, 3 issues' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('clicking a tab calls onTabChange with the group tab id', async () => {
    seed([sprint, qa]);
    const spy = vi.fn();
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={spy} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
    expect(spy).toHaveBeenCalledWith('group:1');
  });

  it('truncates long names and shows full name in a tooltip on focus', async () => {
    seed([sprint]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    const tab = screen.getByRole('button', { name: 'Sprint 12, 3 issues' });
    const nameEl = Array.from(tab.querySelectorAll('span')).find(
      (s) => s.className.includes('truncate') && !s.className.includes('invisible'),
    ) as HTMLElement;
    expect(nameEl.className).toContain('truncate');
    expect(nameEl.parentElement?.className).toContain('max-w-[160px]');
    await userEvent.setup().tab();
    await userEvent.setup().hover(tab);
    await waitFor(() => expect(screen.getAllByText('Sprint 12').length).toBeGreaterThan(1));
  });

  it('shows the right arrow when overflowing right, left arrow after scrolling', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    fireEvent.scroll(scroller);
    expect(screen.getByRole('button', { name: 'Scroll tabs right' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scroll tabs left' })).toBeNull();
    scroller.scrollLeft = 400;
    fireEvent.scroll(scroller);
    expect(screen.getByRole('button', { name: 'Scroll tabs left' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scroll tabs right' })).toBeNull();
  });

  it('clicking the right arrow scrolls by 200', async () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    fireEvent.scroll(setOverflowMetrics(600, 200, 0));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Scroll tabs right' }));
    expect(scrollByMock).toHaveBeenCalledWith(expect.objectContaining({ left: 200 }));
  });

  it('renders no arrows when not overflowing', () => {
    seed([sprint]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    fireEvent.scroll(setOverflowMetrics(200, 200, 0));
    expect(screen.queryByRole('button', { name: 'Scroll tabs right' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll tabs left' })).toBeNull();
  });

  it('vertical wheel is converted to horizontal scroll only when overflowing', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    const over = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
    scroller.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    setOverflowMetrics(200, 200, 0);
    const under = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
    scroller.dispatchEvent(under);
    expect(under.defaultPrevented).toBe(false);
  });

  it('scroller reserves inline scroll padding so tabs are not hidden under the arrows', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    expect(screen.getByTestId('group-tab-scroller')).toHaveClass('scroll-px-10');
  });

  it('scrolls the active tab into view on mount', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ inline: 'nearest', block: 'nearest' }),
    );
    expect(scrollIntoViewMock.mock.contexts).toContain(
      screen.getByRole('button', { name: 'QA, 1 issue' }),
    );
  });

  it('after creating, switches to the new tab and focuses it', async () => {
    seed([sprint, qa]);
    let created = false;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'create_group') {
        created = true;
        return ops;
      }
      if (cmd === 'list_groups') return created ? [sprint, qa, ops] : [sprint, qa];
      if (cmd === 'list_group_memberships') return [];
      return null;
    });
    const spy = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={spy} />);
    await user.click(screen.getByRole('button', { name: 'New group' }));
    await user.type(await screen.findByLabelText('Group name'), 'Ops{Enter}');
    await waitFor(() => expect(spy).toHaveBeenCalledWith('group:3'));
    await act(async () => {});
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ops, 0 issues' })),
    );
  });

  it('create with failed follow-up hydrate does not switch tabs or steal focus later', async () => {
    seed([sprint, qa]);
    let created = false;
    let listFails = true;
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'create_group') {
        created = true;
        return ops;
      }
      if (cmd === 'list_groups') {
        if (created && listFails) throw new Error('hydrate failed');
        return created ? [sprint, qa, ops] : [sprint, qa];
      }
      if (cmd === 'list_group_memberships') return [];
      return null;
    });
    const spy = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={spy} />);
    const trigger = screen.getByRole('button', { name: 'New group' });
    await user.click(trigger);
    await user.type(await screen.findByLabelText('Group name'), 'Ops{Enter}');
    await waitFor(() => expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument());
    expect(spy).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    // A later successful hydrate that includes the group must not pull focus onto it.
    listFails = false;
    await act(async () => {
      await useGroupStore.getState().hydrate();
    });
    expect(screen.getByRole('button', { name: 'Ops, 0 issues' })).toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  describe('focusRequest', () => {
    it('focuses the requested group tab and reports handled', async () => {
      seed([sprint, qa]);
      const handled = vi.fn();
      renderWithI18n(
        <GroupTabStrip
          activeTab="group:2"
          onTabChange={vi.fn()}
          focusRequest={{ id: 2, seq: 1 }}
          onFocusRequestHandled={handled}
        />,
      );
      const b = screen.getByRole('button', { name: 'QA, 1 issue' });
      await waitFor(() => expect(document.activeElement).toBe(b));
      expect(handled).toHaveBeenCalledTimes(1);
    });

    it('ignores unknown groups but still reports handled', () => {
      seed([sprint, qa]);
      const handled = vi.fn();
      const before = document.activeElement;
      renderWithI18n(
        <GroupTabStrip
          activeTab="new"
          onTabChange={vi.fn()}
          focusRequest={{ id: 999, seq: 1 }}
          onFocusRequestHandled={handled}
        />,
      );
      expect(handled).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(before);
    });

    it('a new seq for the same id focuses again', async () => {
      seed([sprint, qa]);
      const handled = vi.fn();
      const ui = (seq: number) => (
        <GroupTabStrip
          activeTab="group:2"
          onTabChange={vi.fn()}
          focusRequest={{ id: 2, seq }}
          onFocusRequestHandled={handled}
        />
      );
      const { rerender } = renderWithI18n(ui(1));
      const b = screen.getByRole('button', { name: 'QA, 1 issue' });
      await waitFor(() => expect(document.activeElement).toBe(b));
      screen.getByRole('button', { name: 'Sprint 12, 3 issues' }).focus();
      rerender(ui(2));
      await waitFor(() => expect(document.activeElement).toBe(b));
    });
  });

  describe('group menu', () => {
    const three = [sprint, qa, ops];

    function mockServer(list: Array<Record<string, unknown>>, moveError?: string) {
      let server = list.map((g) => ({ ...g }));
      invokeMock.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
        if (cmd === 'move_group') {
          if (moveError) throw { code: moveError };
          const i = server.findIndex((g) => g.id === args?.groupId);
          const j = args?.direction === 'left' ? i - 1 : i + 1;
          if (i >= 0 && j >= 0 && j < server.length) {
            const next = [...server];
            [next[i], next[j]] = [next[j], next[i]];
            server = next.map((g, k) => ({ ...g, position: k }));
          }
          return server;
        }
        if (cmd === 'list_groups') return server;
        if (cmd === 'list_group_memberships') return [];
        return null;
      });
    }

    function tabOrder() {
      return screen
        .getAllByRole('button', { name: /, \d+ issues?$/ })
        .map((b) => b.getAttribute('aria-label')?.split(',')[0]);
    }

    it('only the active tab has a focusable `…` button; others are hidden but laid out', () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      const more = screen.getByRole('button', { name: 'Group actions for QA' });
      expect(more).toHaveAttribute('tabindex', '0');
      expect(screen.queryByRole('button', { name: 'Group actions for Sprint 12' })).toBeNull();
      const hidden = screen
        .getByTestId('group-tab-scroller')
        .querySelector('[aria-label="Group actions for Sprint 12"]') as HTMLElement;
      expect(hidden).toHaveAttribute('aria-hidden', 'true');
      expect(hidden).toHaveAttribute('tabindex', '-1');
      expect(hidden.className).toContain('invisible');
    });

    it('`…` and tab button are siblings in one wrapper', () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      const tab = screen.getByRole('button', { name: 'QA, 1 issue' });
      const more = screen.getByRole('button', { name: 'Group actions for QA' });
      expect(tab.contains(more)).toBe(false);
      expect(tab.parentElement).toBe(more.parentElement);
      const inactive = screen.getByRole('button', { name: 'Sprint 12, 3 issues' });
      expect(inactive.parentElement?.className).toContain('border-transparent');
    });

    it('keyboard Enter on `…` opens the menu', async () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      const more = screen.getByRole('button', { name: 'Group actions for QA' });
      more.focus();
      await userEvent.setup().keyboard('{Enter}');
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(screen.getAllByRole('menuitem')[0]).toHaveTextContent('Rename…');
      expect(more).toHaveAttribute('aria-expanded', 'true');
    });

    it('right-click opens the menu without switching tabs', async () => {
      seed(three);
      const spy = vi.fn();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={spy} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();
    });

    it('Shift+F10 and ContextMenu key open the menu without switching tabs', async () => {
      seed(three);
      const spy = vi.fn();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={spy} />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }), {
        key: 'F10',
        shiftKey: true,
      });
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      fireEvent.keyDown(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }), {
        key: 'ContextMenu',
      });
      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();
    });

    it('Move right from the active `…` menu reorders, announces, and refocuses', async () => {
      seed(three);
      mockServer(three);
      const spy = vi.fn();
      const user = userEvent.setup();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={spy} />);
      screen.getByRole('button', { name: 'Group actions for QA' }).focus();
      await user.keyboard('{Enter}');
      await user.click(await screen.findByRole('menuitem', { name: 'Move right' }));
      await waitFor(() =>
        expect(invokeMock).toHaveBeenCalledWith('move_group', { groupId: 2, direction: 'right' }),
      );
      expect(invokeMock.mock.calls.filter((c) => c[0] === 'move_group')).toHaveLength(1);
      await waitFor(() => expect(tabOrder()).toEqual(['Sprint 12', 'Ops', 'QA']));
      await waitFor(() =>
        expect(screen.getByTestId('group-move-status')).toHaveTextContent(
          '“QA” moved to position 3 of 3.',
        ),
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: 'Group actions for QA' }),
        ),
      );
      expect(scrollIntoViewMock).toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
    });

    it('Move right from a right-clicked inactive tab focuses its tab button', async () => {
      seed(three);
      mockServer(three);
      const user = userEvent.setup();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Move right' }));
      await waitFor(() => expect(tabOrder()).toEqual(['QA', 'Sprint 12', 'Ops']));
      await waitFor(() =>
        expect(screen.getByTestId('group-move-status')).toHaveTextContent(
          '“Sprint 12” moved to position 2 of 3.',
        ),
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: 'Sprint 12, 3 issues' }),
        ),
      );
    });

    it('disables Move left on the first group and Move right on the last', async () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      expect(await screen.findByRole('menuitem', { name: 'Move left' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('menuitem', { name: 'Move right' })).not.toHaveAttribute(
        'aria-disabled',
      );
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Ops, 0 issues' }));
      expect(await screen.findByRole('menuitem', { name: 'Move right' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('disables both moves for a single group', async () => {
      seed([sprint]);
      renderWithI18n(<GroupTabStrip activeTab="group:1" onTabChange={vi.fn()} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      expect(await screen.findByRole('menuitem', { name: 'Move left' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('menuitem', { name: 'Move right' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('shows a not-found toast when the move fails with not_found, with no announcement', async () => {
      seed(three);
      mockServer(three, 'not_found');
      const user = userEvent.setup();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Move right' }));
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith('This group no longer exists.'),
      );
      expect(screen.getByTestId('group-move-status')).toHaveTextContent('');
    });

    it('shows a generic toast for other move failures', async () => {
      seed(three);
      mockServer(three, 'boom');
      const user = userEvent.setup();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Move right' }));
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith('Could not move the group. Try again.'),
      );
      // Focus is restored to the trigger even though the move failed.
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: 'Sprint 12, 3 issues' }),
        ),
      );
    });

    it('live region is always mounted, polite and atomic', () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      const status = screen.getByTestId('group-move-status');
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('aria-atomic', 'true');
    });

    it('clears the announcement after 5 seconds', async () => {
      seed(three);
      mockServer(three);
      const user = userEvent.setup();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Move right' }));
      await waitFor(() =>
        expect(screen.getByTestId('group-move-status')).toHaveTextContent('moved to position'),
      );
      await waitFor(() => expect(screen.getByTestId('group-move-status')).toBeEmptyDOMElement(), {
        timeout: 6500,
      });
    }, 10000);

    it('Rename via right-click keeps the tab; a vanished group clears pending with a toast', async () => {
      seed(three);
      const spy = vi.fn();
      const user = userEvent.setup();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={spy} />);
      fireEvent.contextMenu(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Rename…' }));
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(spy).not.toHaveBeenCalled();
      act(() => {
        useGroupStore.setState({ groups: [qa, ops] as never });
      });
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith('This group no longer exists.'),
      );
    });

    it('Escape closing the `…` menu returns focus to the trigger', async () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      const more = screen.getByRole('button', { name: 'Group actions for QA' });
      more.focus();
      const user = userEvent.setup();
      await user.keyboard('{Enter}');
      await screen.findByRole('menu');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(more));
    });
  });
});
