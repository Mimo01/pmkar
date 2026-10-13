import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
let resizeCallback: (() => void) | null = null;

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resizeCallback = cb;
      }
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
  resizeCallback = null;
  invokeMock.mockReset();
  scrollIntoViewMock.mockReset();
  scrollByMock.mockReset();
  toastErrorMock.mockReset();
  invokeMock.mockImplementation(async () => null);
  seed([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const el of document.body.querySelectorAll(':scope > [data-tab-id]')) el.remove();
});

function mockRect(el: Element, left: number, right: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    right,
    top: 0,
    bottom: 32,
    width: right - left,
    height: 32,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function expectFocusVisible(scroller: HTMLElement) {
  const focused = document.activeElement;
  const leftArrow = screen.queryByRole('button', { name: 'Scroll tabs left' });
  const rightArrow = screen.queryByRole('button', { name: 'Scroll tabs right' });
  if (focused !== null && (focused === leftArrow || focused === rightArrow)) return;
  expect(focused).not.toBeNull();
  expect(focused).not.toBe(document.body);
  const f = (focused as Element).getBoundingClientRect();
  const r = scroller.getBoundingClientRect();
  expect(f.left).toBeGreaterThanOrEqual(r.left);
  expect(f.right).toBeLessThanOrEqual(r.right);
}

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

  it('renders tabs in order with group color and count pill', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    const a = screen.getByRole('button', { name: 'Sprint 12, 3 issues' });
    const b = screen.getByRole('button', { name: 'QA, 1 issue' });
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(a.parentElement?.style.getPropertyValue('--group-color')).toBe(
      'var(--color-group-blue)',
    );
    expect(a.querySelector('[style*="background-color"]')).toBeNull();
    const pill = Array.from(a.querySelectorAll('span[aria-hidden="true"]')).find(
      (el) => el.textContent === '3',
    );
    expect(pill).toBeTruthy();
    expect(pill?.className).toContain('tabular-nums');
  });

  it('marks the active tab with aria-current and brand styling', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
    const b = screen.getByRole('button', { name: 'QA, 1 issue' });
    expect(b).toHaveAttribute('aria-current', 'page');
    expect(b.className.split(/\s+/)).toContain('border-(--group-color)');
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

  it('clicking the right arrow scrolls by 80% of the viewport', async () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    fireEvent.scroll(setOverflowMetrics(600, 200, 0));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Scroll tabs right' }));
    expect(scrollByMock).toHaveBeenCalledWith(expect.objectContaining({ left: 160 }));
  });

  it('clicking the left arrow scrolls back by 80% of the viewport', async () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    fireEvent.scroll(setOverflowMetrics(600, 200, 300));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Scroll tabs left' }));
    expect(scrollByMock).toHaveBeenCalledWith(expect.objectContaining({ left: -160 }));
  });

  function setupRightEndHandoff() {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:1" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    fireEvent.scroll(scroller);
    mockRect(scroller, 0, 200);
    screen.getByRole('button', { name: 'Scroll tabs right' }).focus();
    mockRect(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }), -400, -320);
    mockRect(screen.getByRole('button', { name: 'QA, 1 issue' }), -320, -240);
    scroller.scrollLeft = 400;
    return scroller;
  }

  it('hands focus to the left arrow when the focused right arrow disappears at the right end', () => {
    const scroller = setupRightEndHandoff();
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'Scroll tabs right' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Scroll tabs left' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Sprint 12, 3 issues' })).not.toHaveFocus();
    expectFocusVisible(scroller);
  });

  it('hands focus to the right arrow when the focused left arrow disappears at the left end', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 400);
    fireEvent.scroll(scroller);
    mockRect(scroller, 0, 200);
    screen.getByRole('button', { name: 'Scroll tabs left' }).focus();
    mockRect(screen.getByRole('button', { name: 'QA, 1 issue' }), 520, 600);
    scroller.scrollLeft = 0;
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'Scroll tabs left' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Scroll tabs right' })).toHaveFocus();
    expectFocusVisible(scroller);
  });

  it('focuses the opposite arrow with preventScroll', () => {
    const scroller = setupRightEndHandoff();
    const spy = vi.spyOn(HTMLElement.prototype, 'focus');
    fireEvent.scroll(scroller);
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ preventScroll: true }));
    expect(spy.mock.contexts[spy.mock.contexts.length - 1]).toBe(
      screen.getByRole('button', { name: 'Scroll tabs left' }),
    );
  });

  it('does not hand off focus or open a tooltip when the right arrow was clicked with a pointer', async () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:1" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    fireEvent.scroll(scroller);
    const right = screen.getByRole('button', { name: 'Scroll tabs right' });
    await userEvent.setup().click(right);
    expect(right).toHaveFocus();
    scroller.scrollLeft = 400;
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'Scroll tabs right' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Scroll tabs left' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Sprint 12, 3 issues' })).not.toHaveFocus();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('hands off again once the clicked arrow is used from the keyboard', async () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:1" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    fireEvent.scroll(scroller);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Scroll tabs right' }));
    await user.keyboard('{Enter}');
    scroller.scrollLeft = 400;
    fireEvent.scroll(scroller);
    expect(screen.getByRole('button', { name: 'Scroll tabs left' })).toHaveFocus();
  });

  it('falls back to the current active group tab when overflow vanishes on resize', () => {
    seed([sprint, qa]);
    const view = renderWithI18n(<GroupTabStrip activeTab="group:1" onTabChange={vi.fn()} />);
    view.rerender(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    fireEvent.scroll(scroller);
    screen.getByRole('button', { name: 'Scroll tabs right' }).focus();
    setOverflowMetrics(200, 200, 0);
    mockRect(scroller, 0, 200);
    mockRect(screen.getByRole('button', { name: 'Sprint 12, 3 issues' }), 0, 80);
    mockRect(screen.getByRole('button', { name: 'QA, 1 issue' }), 80, 160);
    act(() => resizeCallback?.());
    expect(screen.queryByRole('button', { name: 'Scroll tabs right' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll tabs left' })).toBeNull();
    expect(screen.getByRole('button', { name: 'QA, 1 issue' })).toHaveFocus();
    expectFocusVisible(scroller);
  });

  it('falls back to a core active tab when overflow vanishes on resize', () => {
    seed([sprint, qa]);
    const core = document.createElement('button');
    core.setAttribute('data-tab-id', 'new');
    document.body.appendChild(core);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    fireEvent.scroll(scroller);
    screen.getByRole('button', { name: 'Scroll tabs right' }).focus();
    setOverflowMetrics(200, 200, 0);
    const spy = vi.spyOn(HTMLElement.prototype, 'focus');
    act(() => resizeCallback?.());
    expect(core).toHaveFocus();
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ preventScroll: true }));
  });

  it('does not steal focus when an unfocused arrow disappears', () => {
    seed([sprint, qa]);
    renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
    const scroller = setOverflowMetrics(600, 200, 0);
    fireEvent.scroll(scroller);
    scroller.scrollLeft = 400;
    fireEvent.scroll(scroller);
    expect(screen.getByRole('button', { name: 'QA, 1 issue' })).not.toHaveFocus();
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

    it('has no `…` button; the menu is reached by right-click or keyboard only', () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /Group actions/ })).toBeNull();
      const tab = screen.getByRole('button', { name: 'QA, 1 issue' });
      const inactive = screen.getByRole('button', { name: 'Sprint 12, 3 issues' });
      // Inactive tabs keep a faint group-color underline so colors read at a glance.
      expect(inactive.className.split(/\s+/)).toContain('border-(--group-color)/35');
      expect(tab.className.split(/\s+/)).toContain('border-(--group-color)');
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

    it('Move right from the active tab menu reorders, announces, and refocuses', async () => {
      seed(three);
      mockServer(three);
      const spy = vi.fn();
      const user = userEvent.setup();
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={spy} />);
      screen.getByRole('button', { name: 'QA, 1 issue' }).focus();
      await user.keyboard('{Shift>}{F10}{/Shift}');
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
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /^QA,/ })),
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

    it('Escape closing a keyboard-opened menu returns focus to the tab', async () => {
      seed(three);
      renderWithI18n(<GroupTabStrip activeTab="group:2" onTabChange={vi.fn()} />);
      const more = screen.getByRole('button', { name: 'QA, 1 issue' });
      more.focus();
      const user = userEvent.setup();
      await user.keyboard('{Shift>}{F10}{/Shift}');
      await screen.findByRole('menu');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(more));
    });
  });
});
