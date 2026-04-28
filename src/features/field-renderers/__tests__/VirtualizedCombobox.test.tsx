import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedCombobox } from '../components/VirtualizedCombobox';

// cmdk uses ResizeObserver internally; jsdom does not implement it — mock globally
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// @tanstack/react-virtual needs a scroll container with non-zero offsetHeight and clientHeight.
// jsdom returns 0 for all layout measurements, so we override them to allow getVirtualItems()
// to compute visible rows (280px viewport / 36px per row = ~7 rows visible).
vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
  bottom: 280,
  height: 280,
  left: 0,
  right: 300,
  top: 0,
  width: 300,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect);
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    return 280;
  },
});
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return 280;
  },
});

interface TestItem {
  id: string;
  label: string;
}

const sampleItems: TestItem[] = [
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
  { id: '3', label: 'Cherry' },
];

const baseProps = {
  items: sampleItems,
  value: null as TestItem | null,
  displayLabel: (i: TestItem) => i.label,
  filterFn: (i: TestItem, q: string) => i.label.toLowerCase().includes(q.toLowerCase()),
};

describe('VirtualizedCombobox', () => {
  it('CTRL-08 renders trigger button with placeholder when no value selected', () => {
    render(<VirtualizedCombobox {...baseProps} onChange={vi.fn()} placeholder="Pick fruit" />);
    expect(screen.getByRole('button', { name: /pick fruit/i })).toBeInTheDocument();
  });

  it('CTRL-08 renders trigger button with displayLabel(value) when value is set', () => {
    render(
      <VirtualizedCombobox
        {...baseProps}
        value={sampleItems[1]}
        onChange={vi.fn()}
        placeholder="Pick fruit"
      />,
    );
    expect(screen.getByRole('button', { name: /banana/i })).toBeInTheDocument();
  });

  it('CTRL-08 opens popover with cmdk Command on trigger click', async () => {
    const user = userEvent.setup();
    render(<VirtualizedCombobox {...baseProps} onChange={vi.fn()} placeholder="Pick fruit" />);
    await user.click(screen.getByRole('button', { name: /pick fruit/i }));
    // cmdk Command.Input renders as an input
    expect(screen.getByPlaceholderText(/pick fruit/i)).toBeInTheDocument();
  });

  it('CTRL-08 filters items via filterFn when query is typed (sync mode)', async () => {
    const user = userEvent.setup();
    render(<VirtualizedCombobox {...baseProps} onChange={vi.fn()} placeholder="Pick fruit" />);
    await user.click(screen.getByRole('button', { name: /pick fruit/i }));
    const input = screen.getByPlaceholderText(/pick fruit/i);
    await user.type(input, 'app');
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
  });

  it('CTRL-08 calls onChange with selected item when option clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<VirtualizedCombobox {...baseProps} onChange={onChange} placeholder="Pick fruit" />);
    await user.click(screen.getByRole('button', { name: /pick fruit/i }));
    await user.click(screen.getByText('Apple'));
    expect(onChange).toHaveBeenCalledWith(sampleItems[0]);
  });

  it('CTRL-08 shows "No results found." when filter returns empty', async () => {
    const user = userEvent.setup();
    render(<VirtualizedCombobox {...baseProps} onChange={vi.fn()} placeholder="Pick fruit" />);
    await user.click(screen.getByRole('button', { name: /pick fruit/i }));
    await user.type(screen.getByPlaceholderText(/pick fruit/i), 'zzz');
    // The text key may be "fieldRenderer.noResults" if i18n not yet wired in Wave 1; accept either rendered string
    expect(
      screen.queryByText(/no results/i) ?? screen.queryByText(/fieldRenderer.noResults/),
    ).toBeTruthy();
  });

  it('CTRL-08 closes popover on outside mousedown', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Outside</button>
        <VirtualizedCombobox {...baseProps} onChange={vi.fn()} placeholder="Pick fruit" />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /pick fruit/i }));
    expect(screen.getByPlaceholderText(/pick fruit/i)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByPlaceholderText(/pick fruit/i)).not.toBeInTheDocument();
  });

  describe('async (onSearch) mode', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('CTRL-08 invokes onSearch (debounced 300ms) when query changes', async () => {
      const onSearch = vi.fn().mockResolvedValue([]);
      render(
        <VirtualizedCombobox
          {...baseProps}
          onChange={vi.fn()}
          onSearch={onSearch}
          placeholder="Search"
        />,
      );
      const trigger = screen.getByRole('button', { name: /search/i });
      fireEvent.click(trigger);
      const input = screen.getByPlaceholderText(/search/i);
      fireEvent.change(input, { target: { value: 'foo' } });
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });
      expect(onSearch).toHaveBeenCalledWith('foo');
    });

    it('CTRL-08 calls onSearch(initialQuery) once on mount when initialQuery is set (D-03)', async () => {
      const onSearch = vi.fn().mockResolvedValue([]);
      render(
        <VirtualizedCombobox
          {...baseProps}
          onChange={vi.fn()}
          onSearch={onSearch}
          initialQuery="hello@example.com"
          placeholder="Search"
        />,
      );
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(onSearch).toHaveBeenCalledWith('hello@example.com');
      expect(onSearch).toHaveBeenCalledTimes(1);
    });
  });

  it('CTRL-08 disables trigger when disabled prop is true', () => {
    render(
      <VirtualizedCombobox
        {...baseProps}
        onChange={vi.fn()}
        placeholder="Pick fruit"
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: /pick fruit/i })).toBeDisabled();
  });
});
