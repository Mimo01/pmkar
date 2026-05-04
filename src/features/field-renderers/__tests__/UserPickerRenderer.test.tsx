import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JiraUser } from '@/features/tickets/types';
import { UserPickerRenderer } from '../renderers/UserPickerRenderer';
import type { RendererProps } from '../types';

// cmdk uses ResizeObserver internally; jsdom does not implement it — mock globally
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// @tanstack/react-virtual needs a scroll container with non-zero offsetHeight and clientHeight.
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

const field: RendererProps['field'] = {
  fieldId: 'assignee',
  name: 'Assignee',
  required: true,
  schema: { type: 'user' },
};

const alice: JiraUser = {
  accountId: 'a1',
  displayName: 'Alice Anderson',
  emailAddress: 'alice@example.com',
};

describe('UserPickerRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('CTRL-02 renders the selected user displayName when value is set', () => {
    render(
      <UserPickerRenderer
        field={field}
        value={alice}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue([])}
      />,
    );
    expect(screen.getByRole('button', { name: /assignee/i }).textContent).toMatch(/Alice Anderson/);
  });

  it('CTRL-02 calls onSearch(initialQuery) on mount when initialQuery is provided (D-03)', async () => {
    const onSearch = vi.fn().mockResolvedValue([alice]);
    render(
      <UserPickerRenderer
        field={field}
        value={null}
        onChange={vi.fn()}
        onSearch={onSearch}
        initialQuery="alice@example.com"
      />,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(onSearch).toHaveBeenCalledWith('alice@example.com');
  });

  it('CTRL-02 calls onSearch with debounced query when user types', async () => {
    const onSearch = vi.fn().mockResolvedValue([alice]);
    render(
      <UserPickerRenderer field={field} value={null} onChange={vi.fn()} onSearch={onSearch} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /assignee/i }));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alice' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });
    expect(onSearch).toHaveBeenCalledWith('alice');
  });

  it('CTRL-02 calls onChange with selected JiraUser when option clicked', async () => {
    const onChange = vi.fn();
    const onSearch = vi.fn().mockResolvedValue([alice]);
    render(
      <UserPickerRenderer field={field} value={null} onChange={onChange} onSearch={onSearch} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /assignee/i }));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'alice' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });
    fireEvent.click(screen.getByText('Alice Anderson'));
    expect(onChange).toHaveBeenCalledWith(alice);
  });

  it('CTRL-02 does not log onSearch query params (security: PII initialQuery)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSearch = vi.fn().mockResolvedValue([]);
    render(
      <UserPickerRenderer
        field={field}
        value={null}
        onChange={vi.fn()}
        onSearch={onSearch}
        initialQuery="secret@example.com"
      />,
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    // Verify no console output contains the email
    const allCalls = [...consoleSpy.mock.calls, ...consoleErr.mock.calls]
      .flat()
      .map(String)
      .join(' ');
    expect(allCalls).not.toContain('secret@example.com');
    consoleSpy.mockRestore();
    consoleErr.mockRestore();
  });
});
