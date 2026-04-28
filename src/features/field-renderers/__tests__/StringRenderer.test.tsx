import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StringRenderer } from '../renderers/StringRenderer';
import type { RendererProps } from '../types';

const baseField: RendererProps['field'] = {
  fieldId: 'summary',
  name: 'Summary',
  required: false,
  schema: { type: 'string' },
};

describe('StringRenderer', () => {
  it('CTRL-01 renders an input[type=text] with the current string value', () => {
    render(<StringRenderer field={baseField} value="Hello" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.value).toBe('Hello');
  });

  it('CTRL-01 calls onChange with new string when user types', () => {
    const onChange = vi.fn();
    render(<StringRenderer field={baseField} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'updated' } });
    expect(onChange).toHaveBeenCalledWith('updated');
  });

  it('CTRL-01 sets aria-required when required prop is true', () => {
    render(<StringRenderer field={baseField} value="" onChange={vi.fn()} required />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('CTRL-01 disables input when disabled prop is true', () => {
    render(<StringRenderer field={baseField} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
