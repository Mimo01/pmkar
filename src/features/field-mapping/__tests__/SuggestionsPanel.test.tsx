import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import type { FieldSchema } from '../../../types/fieldSchema';
import { type Suggestion, SuggestionsPanel } from '../SuggestionsPanel';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

const mockInvoke = vi.mocked(invoke);
const mockToastError = vi.mocked(toast.error);

const targetA: FieldSchema = {
  fieldId: 'priority',
  name: 'Priority',
  required: false,
  schema: { type: 'priority' },
};
const targetB: FieldSchema = {
  fieldId: 'labels',
  name: 'Labels',
  required: false,
  schema: { type: 'array', items: 'string' },
};

const sampleSuggestions: Suggestion[] = [
  {
    sourceFieldId: 'severity',
    sourceName: 'Severity',
    sourceSchema: { type: 'priority' },
    target: targetA,
  },
  {
    sourceFieldId: 'tags',
    sourceName: 'Tags',
    sourceSchema: { type: 'array', items: 'string' },
    target: targetB,
  },
];

beforeEach(() => {
  mockInvoke.mockReset();
  mockToastError.mockReset();
  mockInvoke.mockResolvedValue(undefined);
});

describe('SuggestionsPanel', () => {
  it('[EDIT-02] renders one suggestion row per item', () => {
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText('severity')).toBeInTheDocument();
    expect(screen.getByText('tags')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Labels')).toBeInTheDocument();
  });

  it('[EDIT-02] header text shows suggestion count', () => {
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );
    // t('settings.fieldMapping.suggestions', { count: 2 }) → "Suggestions (2)"
    expect(screen.getByText(/Suggestions \(2\)/i)).toBeInTheDocument();
  });

  it('[EDIT-02] returns null when suggestions array is empty (panel hidden)', () => {
    const { container } = renderWithI18n(
      <SuggestionsPanel suggestions={[]} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="suggestions-panel"]')).toBeNull();
  });

  it('[EDIT-03] clicking Accept calls invoke set_field_mapping with target fieldId', async () => {
    const onAccept = vi.fn();
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={onAccept} onDismiss={vi.fn()} />,
    );
    // aria-label: t('settings.fieldMapping.accept') + ' severity' → 'Accept severity'
    const acceptBtn = screen.getByRole('button', { name: /Accept severity/i });
    fireEvent.click(acceptBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'set_field_mapping',
        expect.objectContaining({
          row: expect.objectContaining({
            sourceFieldId: 'severity',
            targetFieldId: 'priority',
          }),
        }),
      );
    });
    expect(onAccept).toHaveBeenCalledWith('severity', targetA);
  });

  it('[EDIT-03] clicking Dismiss calls invoke set_field_mapping with empty-string targetFieldId sentinel (D-07)', async () => {
    const onDismiss = vi.fn();
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={vi.fn()} onDismiss={onDismiss} />,
    );
    // aria-label: t('settings.fieldMapping.dismiss') + ' severity' → 'Dismiss severity'
    const dismissBtn = screen.getByRole('button', { name: /Dismiss severity/i });
    fireEvent.click(dismissBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'set_field_mapping',
        expect.objectContaining({
          row: expect.objectContaining({
            sourceFieldId: 'severity',
            targetFieldId: '',
          }),
        }),
      );
    });
    expect(onDismiss).toHaveBeenCalledWith('severity');
  });

  it('[EDIT-03] on invoke error during accept, toast.error fires with saveError key', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('boom'));
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Accept severity/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });

  it('[EDIT-03] on invoke error during dismiss, toast.error fires', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('boom'));
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dismiss severity/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });

  it('[EDIT-02] each suggestion has accessible Accept and Dismiss buttons', () => {
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Accept severity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss severity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept tags/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dismiss tags/i })).toBeInTheDocument();
  });

  it('[EDIT-03] clicking Accept fires onAccept callback with sourceFieldId and target', async () => {
    const onAccept = vi.fn();
    renderWithI18n(
      <SuggestionsPanel suggestions={sampleSuggestions} onAccept={onAccept} onDismiss={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Accept tags/i }));
    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledWith('tags', targetB);
    });
  });
});
