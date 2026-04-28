import { describe, it } from 'vitest';

// Plan 03 will replace these stubs with real implementations.
// Imports to add in Plan 03:
//   import { fireEvent, screen, waitFor } from '@testing-library/react';
//   import { renderWithI18n } from '../../../test-utils/renderWithI18n';
//   import { FieldMappingSection } from '../FieldMappingSection';
//   import { useSchemaCacheStore } from '../../../stores/schemaCacheStore';
//   import { useConnectionStore } from '../../connections/connectionStore';
//   import { invoke } from '@tauri-apps/api/core';

describe('FieldMappingSection', () => {
  it.todo('[EDIT-01] On mount, calls invoke get_field_mapping and renders one MappingRow per row returned');
  it.todo('[EDIT-01] On mount, loads source schema via schemaCacheStore.loadSchema("source", null, null)');
  it.todo('[EDIT-01] On mount, loads target schema via schemaCacheStore.loadSchema("target", projectKey, firstIssueTypeId)');
  it.todo('[EDIT-01] Shows 3 Skeleton placeholders while loading=true, then table when loading=false');
  it.todo('[DISC-05] Clicking Refresh schema button calls schemaCacheStore.refresh for both sides then loadSchema for both sides');
  it.todo('[DISC-05] Refresh sets lastRefreshed to Date.now() on success and updates "Last refreshed Xm ago" copy');
  it.todo('[DISC-05] On refresh error, sonner toast.error is called with settings.fieldMapping.refreshError');
  it.todo('[DISC-05] While refreshing, button shows Loader2 icon and is disabled (aria-busy=true)');
  it.todo('[MAP-05] Rows whose targetFieldId is not in target cache field_id set are passed isDrifted=true');
  it.todo('[MAP-05] Rows with targetFieldId="" (dismissed sentinel) are NOT flagged as drifted');
  it.todo('[MAP-05] Drift detection re-runs after a successful refresh');
});
