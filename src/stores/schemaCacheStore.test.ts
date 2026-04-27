import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @tauri-apps/api/core BEFORE importing the store
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useSchemaCacheStore, schemaCacheKey } from './schemaCacheStore';

describe('schemaCacheStore', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    // Reset Zustand store to initial state
    useSchemaCacheStore.setState({ cache: {}, prewarmedIssueTypes: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loadSchema(target, MYPROJ, 10001) calls get_target_field_schema_for_issuetype', async () => {
    invokeMock.mockResolvedValueOnce([
      { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
    ]);
    await useSchemaCacheStore.getState().loadSchema('target', 'MYPROJ', '10001');
    expect(invokeMock).toHaveBeenCalledWith('get_target_field_schema_for_issuetype', {
      projectKey: 'MYPROJ',
      issuetypeId: '10001',
    });
    const key = schemaCacheKey('target', 'MYPROJ', '10001');
    const entry = useSchemaCacheStore.getState().cache[key];
    expect(entry?.status).toBe('success');
    expect(entry?.fields).toHaveLength(1);
  });

  it('loadSchema(source, null, null) calls discover_source_fields', async () => {
    invokeMock.mockResolvedValueOnce([
      { fieldId: 'description', name: 'Description', required: false, schema: { type: 'string' } },
    ]);
    await useSchemaCacheStore.getState().loadSchema('source', null, null);
    expect(invokeMock).toHaveBeenCalledWith('discover_source_fields', {});
  });

  it('records error state without throwing when invoke rejects', async () => {
    invokeMock.mockRejectedValueOnce(new Error('HTTP 500'));
    await useSchemaCacheStore.getState().loadSchema('target', 'MYPROJ', '10001');
    const key = schemaCacheKey('target', 'MYPROJ', '10001');
    const entry = useSchemaCacheStore.getState().cache[key];
    expect(entry?.status).toBe('error');
    expect(entry?.error).toContain('HTTP 500');
  });

  it('schemaCacheKey distinguishes null projectKey from literal "null" string', () => {
    expect(schemaCacheKey('target', null, '10001')).not.toBe(
      schemaCacheKey('target', 'null', '10001'),
    );
  });

  it('preWarm calls pre_warm_target_issue_types and stores result', async () => {
    invokeMock.mockResolvedValueOnce([
      { id: '10001', name: 'Bug' },
      { id: '10002', name: 'Task' },
    ]);
    await useSchemaCacheStore.getState().preWarm('MYPROJ');
    expect(invokeMock).toHaveBeenCalledWith('pre_warm_target_issue_types', { projectKey: 'MYPROJ' });
    expect(useSchemaCacheStore.getState().prewarmedIssueTypes['MYPROJ']).toHaveLength(2);
  });

  it('refresh clears the cache entry then calls refresh_field_schema_cache', async () => {
    // Seed an existing entry
    const key = schemaCacheKey('target', 'MYPROJ', '10001');
    useSchemaCacheStore.setState({
      cache: { [key]: { status: 'success', fields: [] } },
      prewarmedIssueTypes: {},
    });
    invokeMock.mockResolvedValueOnce(undefined);
    await useSchemaCacheStore.getState().refresh('target', 'MYPROJ', '10001');
    expect(invokeMock).toHaveBeenCalledWith('refresh_field_schema_cache', {
      side: 'target',
      projectKey: 'MYPROJ',
      issuetypeId: '10001',
    });
    expect(useSchemaCacheStore.getState().cache[key]).toBeUndefined();
  });
});
