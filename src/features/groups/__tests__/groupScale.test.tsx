import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { AppShell } from '../../../components/ui/AppShell';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import type { JiraTicket } from '../../tickets/types';
import { GroupChips } from '../GroupChips';
import { GroupPicker } from '../GroupPicker';
import { GroupTabStrip } from '../GroupTabStrip';
import { useGroupStore } from '../groupStore';
import type { Group } from '../types';

const initial = useGroupStore.getState();

const LONG_NAME = 'Abcdefghij Abcdefghij Abcdefghij Abcdefg'; // 40 chars
const SK_NAMES = ['Šťastné úlohy – ďaľší ťah', 'Žltý kôň č. 7', 'Úprava ľudských zdrojov'];

function make25(): Group[] {
  return Array.from({ length: 25 }, (_, i) => {
    let name = `Group ${i + 1}`;
    if (i === 3) name = LONG_NAME;
    if (i === 5) name = SK_NAMES[0];
    if (i === 9) name = SK_NAMES[1];
    if (i === 14) name = SK_NAMES[2];
    return {
      id: i + 1,
      name,
      color: 'blue',
      position: i,
      createdAt: 't',
      memberCount: i,
    } as Group;
  });
}

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

function seed(groups: Group[], groupIdsByIssue: Record<string, number[]> = {}) {
  useGroupStore.setState({
    ...initial,
    groups,
    memberKeysByGroup: {},
    groupIdsByIssue,
    hydrated: true,
    hydrateError: false,
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation(async () => null);
  scrollIntoViewMock.mockReset();
  scrollByMock.mockReset();
  seed(make25());
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

function renderShell(activeTab: 'new' | `group:${number}` = 'new') {
  return renderWithI18n(
    <AppShell
      activeTab={activeTab}
      onTabChange={vi.fn()}
      navExtension={<GroupTabStrip activeTab={activeTab} onTabChange={vi.fn()} />}
    >
      <div />
    </AppShell>,
  );
}

const arrow = (dir: 'left' | 'right') =>
  screen.queryByRole('button', { name: `Scroll tabs ${dir}` });

describe('25-group scale', () => {
  it('keeps core tabs in place and arrows inside the strip container when overflowing', () => {
    renderShell();
    const nav = screen.getByRole('navigation');
    const coreIndexes = () =>
      Array.from(nav.children)
        .map((c, i) => (c.hasAttribute('data-tab-id') ? i : -1))
        .filter((i) => i >= 0);
    const before = coreIndexes();
    expect(before).toEqual([0, 1, 2]);

    fireEvent.scroll(setOverflowMetrics(4000, 600, 0));
    expect(arrow('right')).toBeInTheDocument();
    expect(coreIndexes()).toEqual(before);

    const container = screen.getByTestId('group-tab-scroller').parentElement as HTMLElement;
    expect(container.className).toContain('relative flex-1 min-w-0');
    expect(container).toContainElement(arrow('right'));
    for (const core of nav.querySelectorAll('[data-tab-id]')) {
      expect(core).not.toContainElement(arrow('right'));
    }
  });

  it('shows arrows only in the overflowing direction', () => {
    renderShell();
    const scroller = setOverflowMetrics(4000, 600, 0);
    fireEvent.scroll(scroller);
    expect(arrow('left')).toBeNull();
    expect(arrow('right')).toBeInTheDocument();

    scroller.scrollLeft = 1500;
    fireEvent.scroll(scroller);
    expect(arrow('left')).toBeInTheDocument();
    expect(arrow('right')).toBeInTheDocument();

    scroller.scrollLeft = 3400;
    fireEvent.scroll(scroller);
    expect(arrow('left')).toBeInTheDocument();
    expect(arrow('right')).toBeNull();
  });

  it('scrolls an arrow click by 80% of the strip width', async () => {
    renderShell();
    fireEvent.scroll(setOverflowMetrics(4000, 600, 0));
    await userEvent.setup().click(arrow('right') as HTMLElement);
    expect(scrollByMock).toHaveBeenCalledWith(expect.objectContaining({ left: 480 }));
  });

  it('scrolls the active tab into view on switch and after a reorder', () => {
    const groups = make25();
    seed(groups);
    const { rerender } = renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    scrollIntoViewMock.mockClear();

    rerender(<GroupTabStrip activeTab="group:25" onTabChange={vi.fn()} />);
    const last = screen.getByRole('button', { name: /^Group 25, 24 issues$/ });
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
    expect(scrollIntoViewMock.mock.contexts).toContain(last);

    scrollIntoViewMock.mockClear();
    const reordered = [...groups];
    [reordered[23], reordered[24]] = [reordered[24], reordered[23]];
    act(() => {
      seed(reordered.map((g, i) => ({ ...g, position: i })));
    });
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock.mock.contexts).toContain(last);
  });

  it('truncates a 40-char name at 160px and exposes the full name via aria-label', () => {
    expect(LONG_NAME.length).toBe(40);
    renderWithI18n(<GroupTabStrip activeTab="new" onTabChange={vi.fn()} />);
    const tab = screen.getByRole('button', { name: `${LONG_NAME}, 3 issues` });
    expect(tab).toHaveAttribute('aria-label', `${LONG_NAME}, 3 issues`);
    const nameEl = Array.from(tab.querySelectorAll('span')).find(
      (s) => s.className.includes('truncate') && !s.className.includes('invisible'),
    ) as HTMLElement;
    expect(nameEl).toHaveTextContent(LONG_NAME);
    expect(nameEl.parentElement?.className).toContain('max-w-[160px]');
    for (const name of SK_NAMES) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}, `) })).toBeInTheDocument();
    }
  });

  it('picker filters 25 groups by diacritic substring, scrolls, and follows arrow keys', async () => {
    const user = userEvent.setup();
    const ticket = {
      id: 'P-1',
      key: 'P-1',
      fields: { summary: 's', status: { name: 'x' }, priority: null, assignee: null, updated: 'u' },
    } as unknown as JiraTicket;
    renderWithI18n(
      <GroupPicker
        mode="checkbox"
        issueKey="P-1"
        resolveTicket={() => ticket}
        open={true}
        onOpenChange={vi.fn()}
      >
        <button type="button">Groups</button>
      </GroupPicker>,
    );
    const input = await screen.findByRole('combobox', { name: 'Search groups' });
    const list = screen.getByRole('listbox');
    expect(list.className).toContain('max-h-60');
    expect(list.className).toContain('overflow-y-auto');
    expect(screen.getAllByRole('option')).toHaveLength(25);

    scrollIntoViewMock.mockClear();
    for (let i = 0; i < 10; i++) {
      await user.keyboard('{ArrowDown}');
      const activeId = input.getAttribute('aria-activedescendant') as string;
      const activeEl = document.getElementById(activeId) as HTMLElement;
      expect(scrollIntoViewMock).toHaveBeenLastCalledWith({ block: 'nearest' });
      expect(scrollIntoViewMock.mock.contexts[scrollIntoViewMock.mock.contexts.length - 1]).toBe(
        activeEl,
      );
    }
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(10);

    await user.type(input, 'stastne');
    const names = screen
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter((n) => !n?.startsWith('Create'));
    expect(names).toEqual([SK_NAMES[0]]);
  });

  it('chips show at most 2 groups plus a +N overflow', () => {
    seed(make25(), { 'P-1': [1, 2, 3, 4, 5] });
    render(<GroupChips issueKey="P-1" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });
});
