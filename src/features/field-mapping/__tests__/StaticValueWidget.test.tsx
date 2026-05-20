// PHASE 27 — Wave 0; components implemented in Plan 04.
// These tests import ../StaticValueWidget which does not exist until Plan 04 creates it.
// Running this file will fail at import resolution — that is expected and proves the
// tests are wired up in the runner's discovery scope.

import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { StaticValueWidget } from '../StaticValueWidget';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

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

describe('StaticValueWidget', () => {
  it('renders a VirtualizedCombobox for option-type fields', () => {
    // STATIC-UI-02 — option-type target: VirtualizedCombobox (mocked as <select>)
    renderWithI18n(
      <StaticValueWidget
        field={{
          fieldId: 'customfield_10050',
          name: 'Priority Level',
          required: false,
          schema: { type: 'option' },
          allowedValues: [{ id: '10001', value: 'Blocker' }],
        }}
        value=""
        onChange={vi.fn()}
      />,
    );
    // VirtualizedCombobox mocked as <select> renders as a combobox role
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders a text input for string-type fields', () => {
    // STATIC-UI-02 — string-type target: plain text input
    renderWithI18n(
      <StaticValueWidget
        field={{
          fieldId: 'customfield_10060',
          name: 'Description',
          required: false,
          schema: { type: 'string' },
        }}
        value=""
        onChange={vi.fn()}
      />,
    );
    // Placeholder uses i18n key settings.fieldMapping.staticValuePlaceholder → "Enter value"
    const input = screen.getByPlaceholderText('Enter value');
    expect(input.tagName.toLowerCase()).toBe('input');
    expect((input as HTMLInputElement).type).toBe('text');
  });

  it('renders a comma-separated text input with hint for array-of-string fields', () => {
    // STATIC-UI-02 — array of string (Labels): text input + comma-separation hint
    renderWithI18n(
      <StaticValueWidget
        field={{
          fieldId: 'labels',
          name: 'Labels',
          required: false,
          schema: { type: 'array', items: 'string' },
        }}
        value=""
        onChange={vi.fn()}
      />,
    );
    // Hint text uses i18n key settings.fieldMapping.staticMultiHint → "Separate values with commas"
    expect(screen.getByText('Separate values with commas')).toBeInTheDocument();
    // An input element is also rendered
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a disabled input for unsupported user-type fields', () => {
    // STATIC-UI-02 — user-type target: disabled input with "Not supported in this phase" placeholder
    renderWithI18n(
      <StaticValueWidget
        field={{
          fieldId: 'assignee',
          name: 'Assignee',
          required: false,
          schema: { type: 'user' },
        }}
        value=""
        onChange={vi.fn()}
      />,
    );
    // Placeholder uses i18n key settings.fieldMapping.staticUnsupported → "Not supported in this phase"
    const input = screen.getByPlaceholderText('Not supported in this phase');
    expect(input).toBeDisabled();
  });
});
