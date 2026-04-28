import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import type { FieldSchema } from '../../../types/fieldSchema';
import type { FieldMappingRow } from '../types';
import { MappingRow } from '../MappingRow';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// VirtualizedCombobox uses ResizeObserver + @tanstack/react-virtual which are not
// available in jsdom. Mock the combobox to a simple select-based widget for unit tests.
vi.mock('@/features/field-renderers/components/VirtualizedCombobox', () => ({
  VirtualizedCombobox: <T,>({
    items,
    value,
    onChange,
    displayLabel,
    placeholder,
    ariaLabel,
  }: {
    items: T[];
    value: T | null;
    onChange: (item: T) => void;
    displayLabel: (item: T) => string;
    placeholder?: string;
    ariaLabel?: string;
  }) => (
    <select
      aria-label={ariaLabel ?? placeholder ?? 'combobox'}
      value={value ? displayLabel(value) : ''}
      onChange={(e) => {
        const selected = items.find((i) => displayLabel(i) === e.target.value);
        if (selected) onChange(selected);
      }}
    >
      <option value="">{placeholder ?? ''}</option>
      {items.map((item) => (
        <option key={displayLabel(item)} value={displayLabel(item)} role="option">
          {displayLabel(item)}
        </option>
      ))}
    </select>
  ),
}));

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
const mockInvoke = vi.mocked(invoke);
const mockToastError = vi.mocked(toast.error);

const baseRow: FieldMappingRow = {
  sourceFieldId: 'labels',
  targetFieldId: 'labels',
  transformerKind: 'identity',
  sourceSchema: { type: 'array', items: 'string' },
  targetSchema: { type: 'array', items: 'string' },
};

const targetFields: FieldSchema[] = [
  { fieldId: 'labels', name: 'Labels', required: false, schema: { type: 'array', items: 'string' } },
  { fieldId: 'custom_labels', name: 'Custom Labels', required: false, schema: { type: 'array', items: 'string' } },
];

beforeEach(() => {
  mockInvoke.mockReset();
  mockToastError.mockReset();
  mockInvoke.mockResolvedValue(undefined);
});

describe('MappingRow', () => {
  it('[MAP-04] renders source field id in the first column', () => {
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={false} onRowUpdate={vi.fn()} onRowDelete={vi.fn()} />,
    );
    expect(screen.getByText('labels')).toBeInTheDocument();
  });

  it('[MAP-04] clicking delete calls invoke delete_field_mapping with sourceFieldId', async () => {
    const onRowDelete = vi.fn();
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={false} onRowUpdate={vi.fn()} onRowDelete={onRowDelete} />,
    );
    // aria-label: t('settings.fieldMapping.deleteAriaLabel', { field: 'labels' }) → "Remove mapping for labels"
    const deleteBtn = screen.getByRole('button', { name: /Remove mapping for labels/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('delete_field_mapping', { sourceFieldId: 'labels' });
    });
    expect(onRowDelete).toHaveBeenCalledWith('labels');
  });

  it('[MAP-04] on delete invoke error, toast.error fires with deleteError key', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('boom'));
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={false} onRowUpdate={vi.fn()} onRowDelete={vi.fn()} />,
    );
    const deleteBtn = screen.getByRole('button', { name: /Remove mapping for labels/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });

  it('[MAP-05] when isDrifted=true, DriftWarning replaces target combobox', () => {
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={true} onRowUpdate={vi.fn()} onRowDelete={vi.fn()} />,
    );
    expect(screen.getByTestId('drift-warning-labels')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('[MAP-05] when isDrifted=true, clicking Remove inside DriftWarning calls delete_field_mapping', async () => {
    const onRowDelete = vi.fn();
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={true} onRowUpdate={vi.fn()} onRowDelete={onRowDelete} />,
    );
    // DriftWarning remove button text: t('settings.fieldMapping.driftRemove') → "Remove"
    const removeBtn = screen.getByRole('button', { name: /^Remove$/i });
    fireEvent.click(removeBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('delete_field_mapping', { sourceFieldId: 'labels' });
    });
  });

  it('[MAP-04] delete button has aria-label with translated deleteAriaLabel', () => {
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={false} onRowUpdate={vi.fn()} onRowDelete={vi.fn()} />,
    );
    // t('settings.fieldMapping.deleteAriaLabel', { field: 'labels' }) → "Remove mapping for labels"
    expect(screen.getByRole('button', { name: /Remove mapping for labels/i })).toBeInTheDocument();
  });

  it('[MAP-03] new row with empty targetFieldId renders combobox without crash', () => {
    const newRow: FieldMappingRow = {
      sourceFieldId: 'customfield_999',
      targetFieldId: '',
      transformerKind: 'identity',
      sourceSchema: { type: 'any' },
      targetSchema: { type: 'any' },
    };
    renderWithI18n(
      <MappingRow row={newRow} targetFields={targetFields} isDrifted={false} onRowUpdate={vi.fn()} onRowDelete={vi.fn()} />,
    );
    expect(screen.getByText('customfield_999')).toBeInTheDocument();
  });

  it('[MAP-04] target combobox onChange fires invoke set_field_mapping with new targetFieldId', async () => {
    const onRowUpdate = vi.fn();
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={false} onRowUpdate={onRowUpdate} onRowDelete={vi.fn()} />,
    );
    // Target combobox mocked as <select> with aria-label "<sourceFieldId> target"
    const targetSelect = screen.getByRole('combobox', { name: /labels target/i });
    fireEvent.change(targetSelect, { target: { value: 'Custom Labels' } });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'set_field_mapping',
        expect.objectContaining({
          row: expect.objectContaining({
            sourceFieldId: 'labels',
            targetFieldId: 'custom_labels',
          }),
        }),
      );
    });
    expect(onRowUpdate).toHaveBeenCalled();
  });

  it('[MAP-04] transformer combobox items reflect getTransformerOptions(targetSchema)', () => {
    renderWithI18n(
      <MappingRow row={baseRow} targetFields={targetFields} isDrifted={false} onRowUpdate={vi.fn()} onRowDelete={vi.fn()} />,
    );
    // Transformer combobox mocked as <select> with aria-label "<sourceFieldId> transformer"
    const transformerSelect = screen.getByRole('combobox', { name: /labels transformer/i });
    // For array items: 'string', only identity is available
    expect(transformerSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /identity/i })).toBeInTheDocument();
  });
});
