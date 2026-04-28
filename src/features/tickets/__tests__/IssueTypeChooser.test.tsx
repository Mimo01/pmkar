import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock i18n: t() returns key OR formats template literally.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'copy.preview.issueTypeDefaulted' && params) {
        return `Defaulted — no match for '${String(params.sourceTypeName ?? '')}'`;
      }
      if (key === 'copy.preview.issueType') return 'Issue type';
      if (key === 'copy.preview.issueTypePlaceholder') return 'Select issue type';
      if (key === 'copy.preview.issueTypeAriaLabel') return 'Target issue type';
      if (key === 'copy.preview.issueTypeEmpty') return 'No issue types';
      return key;
    },
  }),
}));

// Mock VirtualizedCombobox: simple <select> proxy that calls onChange with full item object.
vi.mock('@/features/field-renderers/components/VirtualizedCombobox', () => ({
  VirtualizedCombobox: ({ items, value, onChange, ariaLabel, disabled }: any) => (
    <select
      aria-label={ariaLabel}
      disabled={disabled}
      value={value?.id ?? ''}
      data-testid="vcombo-select"
      onChange={(e) => {
        const item = items.find((it: any) => it.id === e.target.value);
        if (item) onChange(item);
      }}
    >
      {items.length === 0 && <option value="">{disabled ? 'no items' : ''}</option>}
      {items.map((it: any) => (
        <option key={it.id} value={it.id}>
          {it.name}
        </option>
      ))}
    </select>
  ),
}));

// Mock schemaCacheStore selector.
let prewarmedIssueTypes: Record<string, Array<{ id: string; name: string }>> = {};
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: (selector: (s: unknown) => unknown) =>
    selector({ prewarmedIssueTypes }),
  schemaCacheKey: () => 'k',
}));

import { IssueTypeChooser } from '../IssueTypeChooser';

describe('IssueTypeChooser', () => {
  beforeEach(() => {
    prewarmedIssueTypes = {};
  });

  it('renders selected issue-type name in trigger', () => {
    prewarmedIssueTypes = {
      PROJ: [
        { id: 'it-1', name: 'Task' },
        { id: 'it-2', name: 'Bug' },
      ],
    };
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="Task"
        value="it-2"
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByTestId('vcombo-select') as HTMLSelectElement;
    expect(select.value).toBe('it-2');
  });

  it('shows defaulted notice when source name has no match in the list', () => {
    prewarmedIssueTypes = { PROJ: [{ id: 'it-1', name: 'Task' }] };
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="Story"
        value="it-1"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('issue-type-defaulted-notice')).toHaveTextContent(
      "Defaulted — no match for 'Story'",
    );
  });

  it('hides defaulted notice when selected matches source name (case-insensitive)', () => {
    prewarmedIssueTypes = { PROJ: [{ id: 'it-1', name: 'Task' }] };
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="task"
        value="it-1"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('issue-type-defaulted-notice')).toBeNull();
  });

  it('hides defaulted notice when user manually picked a non-matching item but match exists in list', () => {
    prewarmedIssueTypes = {
      PROJ: [
        { id: 'it-1', name: 'Task' },
        { id: 'it-2', name: 'Bug' },
      ],
    };
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="Task"
        value="it-2"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('issue-type-defaulted-notice')).toBeNull();
  });

  it('renders Loader2 spinner when loading=true', () => {
    prewarmedIssueTypes = { PROJ: [{ id: 'it-1', name: 'Task' }] };
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="Task"
        value="it-1"
        onChange={vi.fn()}
        loading
      />,
    );
    expect(screen.getByTestId('issue-type-loader')).toBeInTheDocument();
  });

  it('hides Loader2 when loading=false', () => {
    prewarmedIssueTypes = { PROJ: [{ id: 'it-1', name: 'Task' }] };
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="Task"
        value="it-1"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('issue-type-loader')).toBeNull();
  });

  it('disables combobox when no issue types are available', () => {
    prewarmedIssueTypes = {};
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="Task"
        value={null}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByTestId('vcombo-select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('calls onChange with the issue-type id (string), not the object', () => {
    prewarmedIssueTypes = {
      PROJ: [
        { id: 'it-1', name: 'Task' },
        { id: 'it-2', name: 'Bug' },
      ],
    };
    const onChange = vi.fn();
    render(
      <IssueTypeChooser
        projectKey="PROJ"
        sourceIssueTypeName="Task"
        value="it-1"
        onChange={onChange}
      />,
    );
    const select = screen.getByTestId('vcombo-select');
    fireEvent.change(select, { target: { value: 'it-2' } });
    expect(onChange).toHaveBeenCalledWith('it-2');
  });
});
