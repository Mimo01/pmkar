import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));

import { GroupTabStrip } from '../../../features/groups/GroupTabStrip';
import { useGroupStore } from '../../../features/groups/groupStore';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { AppShell } from '../AppShell';

const initial = useGroupStore.getState();
const mk = (id: number, name: string) => ({
  id,
  name,
  color: 'blue',
  position: id,
  createdAt: 't',
  memberCount: 1,
});

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
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollBy = vi.fn();
});

beforeEach(() => {
  useGroupStore.setState({
    ...initial,
    groups: [mk(1, 'Alpha'), mk(2, 'Beta'), mk(3, 'Gamma')] as never,
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    hydrated: true,
    hydrateError: false,
  });
});

function setup() {
  const onTabChange = vi.fn();
  renderWithI18n(
    <AppShell
      activeTab="new"
      onTabChange={onTabChange}
      navExtension={<GroupTabStrip activeTab="new" onTabChange={onTabChange} />}
    >
      <div />
    </AppShell>,
  );
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-tab]'));
  return { onTabChange, tabs };
}

describe('AppShell tab strip arrow keys', () => {
  it('marks 4 core and 3 group tabs', () => {
    const { tabs } = setup();
    expect(tabs).toHaveLength(7);
  });

  it('ArrowRight moves through core tabs then into group tabs', async () => {
    const user = userEvent.setup();
    const { tabs } = setup();
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(tabs[3]).toHaveFocus();
  });

  it('ArrowLeft mirrors', async () => {
    const user = userEvent.setup();
    const { tabs } = setup();
    tabs[3].focus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs[2]).toHaveFocus();
  });

  it('Home and End jump to first and last', async () => {
    const user = userEvent.setup();
    const { tabs } = setup();
    tabs[2].focus();
    await user.keyboard('{End}');
    expect(tabs[6]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveFocus();
  });

  it('does not wrap at either end', async () => {
    const user = userEvent.setup();
    const { tabs } = setup();
    tabs[6].focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[6]).toHaveFocus();
    tabs[0].focus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs[0]).toHaveFocus();
  });

  it('does not activate on arrow keys', async () => {
    const user = userEvent.setup();
    const { tabs, onTabChange } = setup();
    tabs[0].focus();
    await user.keyboard('{ArrowRight}{End}{Home}');
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('ignores arrows with modifiers', async () => {
    const user = userEvent.setup();
    const { tabs } = setup();
    tabs[0].focus();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(tabs[0]).toHaveFocus();
  });

  it('leaves tabIndex untouched on tab buttons', () => {
    const { tabs } = setup();
    for (const t of tabs) expect(t.hasAttribute('tabindex')).toBe(false);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });
});

describe('AppShell core tabs', () => {
  function renderCore() {
    const onTabChange = vi.fn();
    renderWithI18n(
      <AppShell activeTab="new" onTabChange={onTabChange}>
        <div />
      </AppShell>,
    );
    return { onTabChange };
  }

  it('renders New, Dismissed, Already Linked, Watched in order', () => {
    renderCore();
    const ids = Array.from(document.querySelectorAll('[data-nav-tab]')).map((el) =>
      el.getAttribute('data-tab-id'),
    );
    expect(ids).toEqual(['new', 'not-mine', 'linked', 'watched']);
  });

  it('clicking Watched calls onTabChange', async () => {
    const user = userEvent.setup();
    const { onTabChange } = renderCore();
    await user.click(screen.getByRole('button', { name: 'Watched' }));
    expect(onTabChange).toHaveBeenCalledWith('watched');
  });

  it('End focuses the Watched tab', async () => {
    const user = userEvent.setup();
    renderCore();
    screen.getByRole('button', { name: 'New' }).focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Watched' })).toHaveFocus();
  });
});
