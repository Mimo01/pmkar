import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DynamicTargetForm } from '../DynamicTargetForm';
import type { FieldSchema } from '@/types/fieldSchema';
import type { JiraUser } from '@/features/tickets/types';

const summaryField: FieldSchema = {
  fieldId: 'summary',
  name: 'Summary',
  required: true,
  schema: { type: 'string' },
};

const labelsField: FieldSchema = {
  fieldId: 'labels',
  name: 'Labels',
  required: false,
  schema: { type: 'array', items: 'string' },
  allowedValues: ['urgent', 'bug'],
};

const assigneeField: FieldSchema = {
  fieldId: 'assignee',
  name: 'Assignee',
  required: false,
  schema: { type: 'user' },
};

const unknownField: FieldSchema = {
  fieldId: 'cf_strange',
  name: 'Strange Custom',
  required: false,
  schema: { type: 'any' },
};

describe('DynamicTargetForm', () => {
  it('CTRL-01..08 iterates fields and renders one Renderer per field via getRenderer', () => {
    render(
      <DynamicTargetForm
        fields={[summaryField, labelsField]}
        values={{ summary: 'Hello' }}
        onChange={vi.fn()}
      />,
    );
    // StringRenderer for summary — use getByLabelText since multiple textboxes present
    expect(screen.getByLabelText(/summary/i)).toHaveValue('Hello');
    // Labels renderer (LabelsRenderer renders an aria-labeled new-label input)
    expect(screen.getByLabelText(/labels new label/i)).toBeInTheDocument();
  });

  it('CTRL-01..08 passes value + onChange to each Renderer (string change propagates)', () => {
    const onChange = vi.fn();
    render(
      <DynamicTargetForm fields={[summaryField]} values={{ summary: '' }} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated' } });
    expect(onChange).toHaveBeenCalledWith('summary', 'Updated');
  });

  it('CTRL-01..08 renders required asterisk for fields with required=true', () => {
    const { container } = render(
      <DynamicTargetForm fields={[summaryField]} values={{}} onChange={vi.fn()} />,
    );
    // Required asterisk is rendered next to the label
    expect(container.querySelector('label[for="summary"]')?.textContent).toMatch(/Summary\s*\*/);
  });

  it('CTRL-01..08 routes onSearchUsers callback to UserPicker only (D-05)', () => {
    const onSearchUsers = vi.fn().mockResolvedValue([] as JiraUser[]);
    render(
      <DynamicTargetForm
        fields={[summaryField, assigneeField]}
        values={{}}
        onChange={vi.fn()}
        searchCallbacks={{ onSearchUsers }}
      />,
    );
    // The user picker renders a button with the field name in its aria-label
    expect(screen.getByRole('button', { name: /assignee/i })).toBeInTheDocument();
    // String field is unaffected — no extra button trigger for it
    expect(screen.queryByRole('button', { name: /summary/i })).not.toBeInTheDocument();
  });

  it('CTRL-01..08 renders without crashing when searchCallbacks is undefined (D-05 graceful)', () => {
    expect(() =>
      render(
        <DynamicTargetForm
          fields={[summaryField, assigneeField]}
          values={{}}
          onChange={vi.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('CTRL-07 shows informational hint for unsupported types (no editable input, no error badge)', () => {
    render(
      <DynamicTargetForm fields={[unknownField]} values={{}} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId('unsupported-field-cf_strange')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
