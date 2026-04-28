import { describe, it } from 'vitest';

// Plan 02 will replace these stubs with real implementations.
// Imports to add in Plan 02:
//   import { fireEvent, screen, waitFor } from '@testing-library/react';
//   import { renderWithI18n } from '../../../test-utils/renderWithI18n';
//   import { MappingRow } from '../MappingRow';
//   import { invoke } from '@tauri-apps/api/core';

describe('MappingRow', () => {
  it.todo('[MAP-03] Add row with new sourceFieldId calls invoke set_field_mapping with the new row payload');
  it.todo('[MAP-04] Changing target combobox calls invoke set_field_mapping with updated targetFieldId and targetSchema');
  it.todo('[MAP-04] Changing transformer combobox calls invoke set_field_mapping with updated transformerKind');
  it.todo('[MAP-04] Clicking delete button calls invoke delete_field_mapping with the row sourceFieldId');
  it.todo('[MAP-04] After successful save, "Saved" inline check is rendered for ~1500ms');
  it.todo('[MAP-04] On invoke error, sonner toast.error is called with settings.fieldMapping.saveError');
  it.todo('[MAP-05] When isDrifted=true, target combobox is replaced by DriftWarning component');
  it.todo('[MAP-04] Transformer combobox options are filtered by getTransformerOptions(targetSchema)');
});
