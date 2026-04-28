import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CheckboxRenderer } from '../renderers/CheckboxRenderer';
import type { RendererProps } from '../types';

const field: RendererProps['field'] = {
  fieldId: 'flags',
  name: 'Flags',
  required: false,
  schema: { type: 'array', items: 'string' },
  allowedValues: ['alpha', 'beta', 'gamma'],
};

describe('CheckboxRenderer', () => {
  it('CTRL-06 renders one input[type=checkbox] per allowedValues entry', () => {
    render(<CheckboxRenderer field={field} value={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('CTRL-06 each checkbox checked when value array includes its option', () => {
    render(<CheckboxRenderer field={field} value={['beta']} onChange={vi.fn()} />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes[0].checked).toBe(false);
    expect(boxes[1].checked).toBe(true);
    expect(boxes[2].checked).toBe(false);
  });

  it('CTRL-06 calls onChange with appended array when checkbox toggled on', () => {
    const onChange = vi.fn();
    render(<CheckboxRenderer field={field} value={['alpha']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    expect(onChange).toHaveBeenCalledWith(['alpha', 'beta']);
  });

  it('CTRL-06 calls onChange with filtered array when checkbox toggled off', () => {
    const onChange = vi.fn();
    render(<CheckboxRenderer field={field} value={['alpha', 'beta']} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onChange).toHaveBeenCalledWith(['beta']);
  });

  it('CTRL-06 group has role="group" with aria-labelledby pointing to field name', () => {
    render(<CheckboxRenderer field={field} value={[]} onChange={vi.fn()} />);
    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-labelledby', 'flags-label');
  });
});
