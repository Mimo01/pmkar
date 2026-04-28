import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LabelsRenderer } from '../renderers/LabelsRenderer';
import type { RendererProps } from '../types';

const labelsField: RendererProps['field'] = {
  fieldId: 'labels',
  name: 'Labels',
  required: false,
  schema: { type: 'array', items: 'string' },
  allowedValues: ['urgent', 'bug', 'feature'],
};

describe('LabelsRenderer', () => {
  it('CTRL-03 renders Badge variant=outline chips per current label', () => {
    render(<LabelsRenderer field={labelsField} value={['urgent', 'bug']} onChange={vi.fn()} />);
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('CTRL-03 calls onChange appending new label when typed and Enter pressed', () => {
    const onChange = vi.fn();
    render(<LabelsRenderer field={labelsField} value={['urgent']} onChange={onChange} />);
    const input = screen.getByLabelText(/labels new label/i);
    fireEvent.change(input, { target: { value: 'custom-label' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['urgent', 'custom-label']);
  });

  it('CTRL-03 calls onChange with filtered array when label chip removed', () => {
    const onChange = vi.fn();
    render(<LabelsRenderer field={labelsField} value={['urgent', 'bug']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove urgent/i }));
    expect(onChange).toHaveBeenCalledWith(['bug']);
  });
});
