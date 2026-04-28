import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MultiUserPickerRenderer } from '../renderers/MultiUserPickerRenderer';
import type { RendererProps } from '../types';
import type { JiraUser } from '@/features/tickets/types';

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
  fieldId: 'watchers',
  name: 'Watchers',
  required: false,
  schema: { type: 'array', items: 'user' },
};

const alice: JiraUser = { accountId: 'a1', displayName: 'Alice Anderson' };
const bob: JiraUser = { accountId: 'b1', displayName: 'Bob Brown' };

describe('MultiUserPickerRenderer', () => {
  it('CTRL-02 renders one chip per JiraUser in value array', () => {
    render(
      <MultiUserPickerRenderer
        field={field}
        value={[alice, bob]}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue([])}
      />,
    );
    expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
    expect(screen.getByText('Bob Brown')).toBeInTheDocument();
  });

  it('CTRL-02 calls onChange with new array when chip remove button clicked', () => {
    const onChange = vi.fn();
    render(
      <MultiUserPickerRenderer
        field={field}
        value={[alice, bob]}
        onChange={onChange}
        onSearch={vi.fn().mockResolvedValue([])}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Remove Alice Anderson/i }));
    expect(onChange).toHaveBeenCalledWith([bob]);
  });

  it('CTRL-02 ignores UnresolvedPerson values — renders only JiraUser shapes (D-02)', () => {
    const unresolved = { kind: 'unresolved', sourceUser: { name: 'foo' } };
    render(
      <MultiUserPickerRenderer
        field={field}
        value={[alice, unresolved]}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue([])}
      />,
    );
    // Alice chip rendered, no error, no chip for the malformed entry
    expect(screen.getByText('Alice Anderson')).toBeInTheDocument();
    expect(screen.queryByText(/foo/)).not.toBeInTheDocument();
  });

  it('CTRL-02 renders a combobox below chips for adding more users', () => {
    render(
      <MultiUserPickerRenderer
        field={field}
        value={[alice]}
        onChange={vi.fn()}
        onSearch={vi.fn().mockResolvedValue([])}
      />,
    );
    expect(screen.getByRole('button', { name: /watchers/i })).toBeInTheDocument();
  });
});
