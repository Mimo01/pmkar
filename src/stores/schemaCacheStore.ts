import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { FieldSchema, FieldSide, IssueTypeRef } from '@/types/fieldSchema';

export type CacheEntryStatus = 'loading' | 'success' | 'error';

export interface SchemaCacheEntry {
  status: CacheEntryStatus;
  fields?: FieldSchema[];
  error?: string;
}

interface SchemaCacheState {
  cache: Record<string, SchemaCacheEntry>;
  prewarmedIssueTypes: Record<string, IssueTypeRef[]>;
  loadSchema: (
    side: FieldSide,
    projectKey: string | null,
    issuetypeId: string | null,
  ) => Promise<void>;
  preWarm: (projectKey: string) => Promise<void>;
  refresh: (
    side: FieldSide,
    projectKey: string | null,
    issuetypeId: string | null,
  ) => Promise<void>;
  clearCache: () => void;
}

const NULL_SENTINEL = '__null__';

export function schemaCacheKey(
  side: FieldSide,
  projectKey: string | null,
  issuetypeId: string | null,
): string {
  return `${side}|${projectKey ?? NULL_SENTINEL}|${issuetypeId ?? NULL_SENTINEL}`;
}

export const useSchemaCacheStore = create<SchemaCacheState>((set, get) => ({
  cache: {},
  prewarmedIssueTypes: {},

  loadSchema: async (side, projectKey, issuetypeId) => {
    // Source schema is global — project/issuetype are irrelevant.
    // Normalise to null so all source calls share a single cache entry
    // regardless of what project/issuetype the caller passed in.
    const effectiveProjectKey = side === 'source' ? null : projectKey;
    const effectiveIssuetypeId = side === 'source' ? null : issuetypeId;
    const key = schemaCacheKey(side, effectiveProjectKey, effectiveIssuetypeId);
    set({ cache: { ...get().cache, [key]: { status: 'loading' } } });
    try {
      const fields = await (side === 'source'
        ? invoke<FieldSchema[]>('discover_source_fields', {})
        : invoke<FieldSchema[]>('get_target_field_schema_for_issuetype', {
            projectKey: effectiveProjectKey,
            issuetypeId: effectiveIssuetypeId,
          }));
      set({
        cache: {
          ...get().cache,
          [key]: { status: 'success', fields: Array.isArray(fields) ? fields : [] },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
      set({
        cache: { ...get().cache, [key]: { status: 'error', error: msg } },
      });
    }
  },

  preWarm: async (projectKey) => {
    try {
      const list = await invoke<IssueTypeRef[]>('pre_warm_target_issue_types', { projectKey });
      set({
        prewarmedIssueTypes: {
          ...get().prewarmedIssueTypes,
          [projectKey]: Array.isArray(list) ? list : [],
        },
      });
    } catch {
      // Silent fail per Open Question 3 — probe already verified endpoint reachable.
      set({
        prewarmedIssueTypes: { ...get().prewarmedIssueTypes, [projectKey]: [] },
      });
    }
  },

  refresh: async (side, projectKey, issuetypeId) => {
    const key = schemaCacheKey(side, projectKey, issuetypeId);
    const next = { ...get().cache };
    delete next[key];
    set({ cache: next });
    try {
      await invoke('refresh_field_schema_cache', { side, projectKey, issuetypeId });
    } catch {
      // Non-fatal: proceed to reload regardless.
    }
    // Reload immediately so the cache is never transiently empty — callers
    // should not need to call loadSchema separately after refresh.
    await get().loadSchema(side, projectKey, issuetypeId);
  },

  clearCache: () => set({ cache: {}, prewarmedIssueTypes: {} }),
}));
