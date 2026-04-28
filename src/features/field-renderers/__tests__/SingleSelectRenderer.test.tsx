import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SingleSelectRenderer } from '../renderers/SingleSelectRenderer';
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
  fieldId: 'priority',
  name: 'Priority',
  required: false,
  schema: { type: 'option' },
  allowedValues: [{ id: '1', value: 'High' }, { id: '2', value: 'Low' }],
};

describe('SingleSelectRenderer', () => {
  it('CTRL-03 renders option labels from allowedValues in dropdown', () => {
    render(<SingleSelectRenderer field={field} value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('CTRL-03 calls onChange with selected option when clicked', () => {
    const onChange = vi.fn();
    render(<SingleSelectRenderer field={field} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Low'));
    expect(onChange).toHaveBeenCalledWith({ id: '2', value: 'Low' });
  });

  it('CTRL-03 displays current value name in trigger when set', () => {
    render(<SingleSelectRenderer field={field} value={{ id: '1', value: 'High' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button').textContent).toMatch(/High/);
  });
});
