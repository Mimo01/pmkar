import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UnsupportedTypeRenderer } from '../renderers/UnsupportedTypeRenderer';
import type { RendererProps } from '../types';

function makeField(type: string): RendererProps['field'] {
  return {
    fieldId: 'unknown',
    name: 'Unknown Field',
    required: false,
    // Cast to any to allow exotic types in tests; production uses FieldSchemaType union
    schema: { type } as RendererProps['field']['schema'],
  };
}

describe('UnsupportedTypeRenderer', () => {
  it('CTRL-07 renders read-only Badge with role="status"', () => {
    render(<UnsupportedTypeRenderer field={makeField('any')} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('CTRL-07 displays field.schema.type in label text for debugging', () => {
    render(<UnsupportedTypeRenderer field={makeField('issuetype')} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toMatch(/issuetype/);
  });

  it('CTRL-07 has no interactive input element', () => {
    render(<UnsupportedTypeRenderer field={makeField('any')} value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('CTRL-07 does not crash when given an unknown FieldSchemaType', () => {
    expect(() =>
      render(<UnsupportedTypeRenderer field={makeField('completely-unknown-type')} value={null} onChange={vi.fn()} />),
    ).not.toThrow();
  });

  it('CTRL-07 aria-label includes "Unsupported field type:" prefix', () => {
    render(<UnsupportedTypeRenderer field={makeField('priority')} value={null} onChange={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', expect.stringMatching(/Unsupported field type:/));
  });
});
