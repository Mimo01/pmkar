import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TextAreaRenderer } from '../renderers/TextAreaRenderer';
import type { RendererProps } from '../types';

const baseField: RendererProps['field'] = {
  fieldId: 'description',
  name: 'Description',
  required: false,
  schema: { type: 'string', system: 'description' },
};

describe('TextAreaRenderer', () => {
  it('CTRL-01 renders a textarea element with the current value', () => {
    render(<TextAreaRenderer field={baseField} value="Some text" onChange={vi.fn()} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect(textarea.value).toBe('Some text');
  });

  it('CTRL-01 calls onChange with new string when user types', () => {
    const onChange = vi.fn();
    render(<TextAreaRenderer field={baseField} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new content' } });
    expect(onChange).toHaveBeenCalledWith('new content');
  });

  it('CTRL-01 textarea has min-h-[80px] class', () => {
    render(<TextAreaRenderer field={baseField} value="" onChange={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.className).toContain('min-h-[80px]');
  });

  it('CTRL-01 sets aria-required when required prop is true', () => {
    render(<TextAreaRenderer field={baseField} value="" onChange={vi.fn()} required />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('CTRL-01 disables textarea when disabled prop is true', () => {
    render(<TextAreaRenderer field={baseField} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
