// PHASE 27 — Wave 0; components implemented in Plan 04.
// These tests import ../StaticMappingRow which does not exist until Plan 04 creates it.
// Running this file will fail at import resolution — that is expected and proves the
// tests are wired up in the runner's discovery scope.

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import type { FieldSchema } from '../../../types/fieldSchema';
import type { FieldMappingRow } from '../types';
import { StaticMappingRow } from '../StaticMappingRow';

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
        <option key={displayLabel(item)} value={displayLabel(item)}>
          {displayLabel(item)}
        </option>
      ))}
    </select>
  ),
}));

import { invoke } from '@tauri-apps/api/core';

const baseStaticRow: FieldMappingRow = {
  sourceFieldId: '__static__customfield_10050',
  targetFieldId: 'customfield_10050',
  transformerKind: 'static',
  sourceSchema: { type: 'any' },
  targetSchema: { type: 'option' },
  // staticValue: '10001' — Plan 03 adds this field to FieldMappingRow
};

const targetFields: FieldSchema[] = [
  {
    fieldId: 'customfield_10050',
    name: 'Priority Level',
    required: false,
    schema: { type: 'option' },
    allowedValues: [
      { id: '10001', value: 'Blocker' },
      { id: '10002', value: 'High' },
    ],
  },
  {
    fieldId: 'customfield_10051',
    name: 'Story Points',
    required: false,
    schema: { type: 'number' },
  },
];

const usedTargetFieldIds = new Set<string>(['customfield_10050']);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(invoke).mockResolvedValue(undefined);
});

describe('StaticMappingRow', () => {
  it('renders the Static badge and target combobox', () => {
    // STATIC-UI-01 — renders Static badge and target combobox
    renderWithI18n(
      <StaticMappingRow
        row={baseStaticRow}
        targetFields={targetFields}
        usedTargetFieldIds={usedTargetFieldIds}
        onRowUpdate={vi.fn()}
        onRowDelete={vi.fn()}
      />,
    );
    // Badge uses i18n key settings.fieldMapping.staticBadge → "Static"
    expect(screen.getByText('Static')).toBeInTheDocument();
    // Target combobox rendered (mocked as <select>)
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('persists value changes via set_field_mapping', async () => {
    // STATIC-UI-03 — saves value changes by calling set_field_mapping
    renderWithI18n(
      <StaticMappingRow
        row={baseStaticRow}
        targetFields={targetFields}
        usedTargetFieldIds={usedTargetFieldIds}
        onRowUpdate={vi.fn()}
        onRowDelete={vi.fn()}
      />,
    );
    // The smart value widget for option-type fields renders a combobox (mocked as <select>)
    // aria-label derived from target field name: "Priority Level static value"
    const input = screen.getByRole('combobox', { name: /Priority Level static value/i });
    fireEvent.change(input, { target: { value: 'High' } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'set_field_mapping',
        expect.objectContaining({
          row: expect.objectContaining({
            staticValue: '10002',
            transformerKind: 'static',
          }),
        }),
      ),
    );
  });

  it('deletes via delete_field_mapping with sentinel sourceFieldId', async () => {
    // STATIC-UI-04 — delete invokes delete_field_mapping with the __static__ sentinel id
    const onRowDelete = vi.fn();
    renderWithI18n(
      <StaticMappingRow
        row={baseStaticRow}
        targetFields={targetFields}
        usedTargetFieldIds={usedTargetFieldIds}
        onRowUpdate={vi.fn()}
        onRowDelete={onRowDelete}
      />,
    );
    // Delete button aria-label uses i18n key settings.fieldMapping.deleteStaticAriaLabel
    const deleteBtn = screen.getByRole('button', {
      name: /Delete static mapping for Priority Level/i,
    });
    fireEvent.click(deleteBtn);
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('delete_field_mapping', {
        sourceFieldId: '__static__customfield_10050',
      }),
    );
    expect(onRowDelete).toHaveBeenCalledWith('__static__customfield_10050');
  });
});
