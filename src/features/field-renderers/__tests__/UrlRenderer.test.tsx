import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UrlRenderer } from '../renderers/UrlRenderer';
import type { RendererProps } from '../types';

const baseField: RendererProps['field'] = {
  fieldId: 'url',
  name: 'URL',
  required: false,
  schema: { type: 'string', system: 'url' },
};

describe('UrlRenderer', () => {
  it('CTRL-01 renders an input[type=url] with the current value', () => {
    render(<UrlRenderer field={baseField} value="https://example.com" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('url');
    expect(input.value).toBe('https://example.com');
  });

  it('CTRL-01 input has pattern="https?://.*" attribute', () => {
    render(<UrlRenderer field={baseField} value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.pattern).toBe('https?://.*');
  });

  it('CTRL-01 calls onChange with new value when user types', () => {
    const onChange = vi.fn();
    render(<UrlRenderer field={baseField} value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://new.com' } });
    expect(onChange).toHaveBeenCalledWith('https://new.com');
  });

  it('CTRL-01 sets aria-required when required prop is true', () => {
    render(<UrlRenderer field={baseField} value="" onChange={vi.fn()} required />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('CTRL-01 disables input when disabled prop is true', () => {
    render(<UrlRenderer field={baseField} value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
