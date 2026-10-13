import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profiler } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupColorVar } from '../colors';
import { GroupChips } from '../GroupChips';
import { useGroupStore } from '../groupStore';
import { NavigationContext } from '../NavigationContext';
import type { Group } from '../types';

function g(id: number, name: string, color: Group['color'] = 'blue'): Group {
  return { id, name, color, position: id, createdAt: '2026-01-01T00:00:00Z', memberCount: 1 };
}

const A = g(1, 'A');
const B = g(2, 'B');
const C = g(3, 'C');
const D = g(4, 'D');

function seed(groupIdsByIssue: Record<string, number[]>, groups: Group[] = [A, B, C, D]) {
  useGroupStore.setState({ groups, groupIdsByIssue, hydrated: true });
}

describe('GroupChips', () => {
  beforeEach(() => {
    seed({});
  });

  it('renders chips in tab order, not membership order', () => {
    seed({ 'P-1': [3, 1] });
    render(<GroupChips issueKey="P-1" />);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Go to group “A”', 'Go to group “C”']);
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('renders every group chip in tab order with no +N pill', () => {
    seed({ 'P-1': [1, 2, 3, 4] });
    render(<GroupChips issueKey="P-1" />);
    const names = screen.getAllByRole('button').map((btn) => btn.getAttribute('aria-label'));
    expect(names).toEqual([
      'Go to group “A”',
      'Go to group “B”',
      'Go to group “C”',
      'Go to group “D”',
    ]);
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more group/ })).not.toBeInTheDocument();
  });

  it('navigates from a previously hidden chip without bubbling', async () => {
    seed({ 'P-1': [1, 2, 3, 4] });
    const spy = vi.fn();
    const parent = vi.fn();
    const user = userEvent.setup();
    render(
      <NavigationContext.Provider value={{ navigateToGroup: spy }}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: test wrapper */}
        <div onClick={parent}>
          <GroupChips issueKey="P-1" />
        </div>
      </NavigationContext.Provider>,
    );
    await user.click(screen.getByRole('button', { name: 'Go to group “D”' }));
    expect(spy).toHaveBeenCalledWith(4, { focusTab: false });
    expect(parent).not.toHaveBeenCalled();
  });

  it('wraps chips right-aligned instead of shrinking', () => {
    seed({ 'P-1': [1, 2, 3, 4] });
    render(<GroupChips issueKey="P-1" />);
    const container = screen.getByRole('button', { name: 'Go to group “A”' }).parentElement;
    expect(container).toHaveClass('flex-wrap');
    expect(container).toHaveClass('justify-end');
    expect(container).not.toHaveClass('shrink-0');
  });

  it('hides the current group and does not count it', () => {
    seed({ 'P-1': [1, 2, 3] });
    render(<GroupChips issueKey="P-1" hideGroupId={1} />);
    expect(screen.queryByRole('button', { name: 'Go to group “A”' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to group “B”' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to group “C”' })).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it('renders nothing when only the hidden group remains', () => {
    seed({ 'P-1': [1] });
    const { container } = render(<GroupChips issueKey="P-1" hideGroupId={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the issue has no entry', () => {
    const { container } = render(<GroupChips issueKey="P-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is render-stable for many cards without entries', () => {
    let commits = 0;
    render(
      <Profiler id="x" onRender={() => commits++}>
        {Array.from({ length: 50 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static test list
          <GroupChips key={i} issueKey={`MISSING-${i}`} />
        ))}
      </Profiler>,
    );
    expect(commits).toBeLessThan(5);
  });

  it('navigates on click, Enter and Space and does not bubble', async () => {
    seed({ 'P-1': [3] });
    const spy = vi.fn();
    const parent = vi.fn();
    const user = userEvent.setup();
    render(
      <NavigationContext.Provider value={{ navigateToGroup: spy }}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: test wrapper */}
        <div onClick={parent}>
          <GroupChips issueKey="P-1" />
        </div>
      </NavigationContext.Provider>,
    );
    const chip = screen.getByRole('button', { name: 'Go to group “C”' });
    await user.click(chip);
    expect(spy).toHaveBeenCalledWith(3, { focusTab: false });
    expect(parent).not.toHaveBeenCalled();
    spy.mockClear();
    chip.focus();
    await user.keyboard('{Enter}');
    expect(spy).toHaveBeenCalledWith(3, { focusTab: true });
    spy.mockClear();
    await user.keyboard(' ');
    expect(spy).toHaveBeenCalledWith(3, { focusTab: true });
  });

  it('truncates long names and keeps the full name in the DOM', () => {
    const long = 'X'.repeat(40);
    seed({ 'P-1': [9] }, [g(9, long)]);
    render(<GroupChips issueKey="P-1" />);
    const nameEl = screen.getByText(long);
    expect(nameEl).toHaveClass('max-w-[160px]');
    expect(nameEl).toHaveClass('truncate');
  });

  it('renders a group-tinted chip with a group-color tag with the group color var and no dot', () => {
    seed({ 'P-1': [1] }, [g(1, 'A', 'green')]);
    const { container } = render(<GroupChips issueKey="P-1" />);
    const chip = screen.getByRole('button', { name: /A/ });
    expect(chip.style.getPropertyValue('--group-color')).toBe(groupColorVar('green'));
    const classes = chip.className.split(/\s+/);
    expect(classes).toContain('group-chip');
    expect(classes).toContain('text-brand-text');
    expect(classes).toContain('rounded-md');
    expect(chip.querySelector('svg')?.getAttribute('class')).toContain('fill-(--group-color)');
    expect(container.querySelector('[style*="background-color"]')).toBeNull();
  });
});
