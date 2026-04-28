import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RadioRenderer } from '../renderers/RadioRenderer';
import type { RendererProps } from '../types';

const field: RendererProps['field'] = {
  fieldId: 'choice',
  name: 'Choice',
  required: true,
  schema: { type: 'option' },
  allowedValues: [{ value: 'one' }, { value: 'two' }, { value: 'three' }],
};

describe('RadioRenderer', () => {
  it('CTRL-06 renders div with role="radiogroup" and aria-labelledby', () => {
    render(<RadioRenderer field={field} value="" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-labelledby', 'choice-label');
  });

  it('CTRL-06 renders one input[type=radio] per allowedValues entry', () => {
    render(<RadioRenderer field={field} value="" onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('CTRL-06 only one radio is checked at a time (matching value)', () => {
    render(<RadioRenderer field={field} value="two" onChange={vi.fn()} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.filter((r) => r.checked)).toHaveLength(1);
    expect(radios[1].checked).toBe(true);
  });

  it('CTRL-06 calls onChange with selected option string when radio clicked', () => {
    const onChange = vi.fn();
    render(<RadioRenderer field={field} value="" onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('radio')[2]);
    expect(onChange).toHaveBeenCalledWith('three');
  });
});
