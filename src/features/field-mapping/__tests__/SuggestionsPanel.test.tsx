import { describe, it } from 'vitest';

// Plan 02 will replace these stubs with real implementations.
// Imports to add in Plan 02:
//   import { fireEvent, screen, waitFor } from '@testing-library/react';
//   import { renderWithI18n } from '../../../test-utils/renderWithI18n';
//   import { SuggestionsPanel } from '../SuggestionsPanel';
//   import { invoke } from '@tauri-apps/api/core';

describe('SuggestionsPanel', () => {
  it.todo('[EDIT-02] Renders one row per unmapped source field with a heuristic-matched target suggestion');
  it.todo('[EDIT-02] Panel is hidden entirely when suggestions array is empty');
  it.todo('[EDIT-02] Panel header text matches t("settings.fieldMapping.suggestions") with count substitution');
  it.todo('[EDIT-03] Clicking Accept calls invoke set_field_mapping with the suggested target and returns row to confirmed table');
  it.todo('[EDIT-03] Clicking Dismiss calls invoke set_field_mapping with targetFieldId="" sentinel (D-07)');
  it.todo('[EDIT-03] On invoke error, sonner toast.error is called with settings.fieldMapping.saveError');
  it.todo('[EDIT-03] After accepting, the suggestion is removed from the panel without re-fetch');
});
