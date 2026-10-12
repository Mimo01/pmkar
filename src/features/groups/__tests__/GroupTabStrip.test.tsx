import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(b.className).toContain('border-brand');
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
});
