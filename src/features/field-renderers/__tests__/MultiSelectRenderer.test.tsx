import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MultiSelectRenderer } from '../renderers/MultiSelectRenderer';
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
  fieldId: 'components',
  name: 'Components',
  required: false,
  schema: { type: 'array', items: 'option' },
  allowedValues: [
    { id: '1', value: 'Frontend' },
    { id: '2', value: 'Backend' },
    { id: '3', value: 'Database' },
  ],
};

describe('MultiSelectRenderer', () => {
  it('CTRL-03 renders Badge chips for each value in current array', () => {
    render(
      <MultiSelectRenderer
        field={field}
        value={[
          { id: '1', value: 'Frontend' },
          { id: '2', value: 'Backend' },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
  });

  it('CTRL-03 calls onChange with appended array when option selected', () => {
    const onChange = vi.fn();
    render(
      <MultiSelectRenderer
        field={field}
        value={[{ id: '1', value: 'Frontend' }]}
        onChange={onChange}
      />,
    );
    // Open dropdown (Backend and Database are still available)
    fireEvent.click(screen.getByRole('button', { name: /components/i }));
    fireEvent.click(screen.getByText('Backend'));
    expect(onChange).toHaveBeenCalledWith([
      { id: '1', value: 'Frontend' },
      { id: '2', value: 'Backend' },
    ]);
  });

  it('CTRL-03 calls onChange with filtered array when chip removed', () => {
    const onChange = vi.fn();
    render(
      <MultiSelectRenderer
        field={field}
        value={[
          { id: '1', value: 'Frontend' },
          { id: '2', value: 'Backend' },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Remove Frontend/i }));
    expect(onChange).toHaveBeenCalledWith([{ id: '2', value: 'Backend' }]);
  });
});
