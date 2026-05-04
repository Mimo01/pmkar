import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useSchemaCacheStore } from '@/stores/schemaCacheStore';
import type { ConnectionMeta } from './types';

export type ProbeStatus = 'idle' | 'ok' | 'failed' | 'skipped';

export interface ProbeResult {
  ok: boolean;
  endpointUrl: string;
  statusCode: number | null;
  hint: string | null;
}

interface ConnectionState {
  // ─── Existing ─────────────────────────────────────────────────────────────
  serverConnection: ConnectionMeta | null;
  cloudConnection: ConnectionMeta | null;
  sourceProjectKey: string | null;
  targetProjectKey: string | null;
  sourceProjectName: string | null;
  targetProjectName: string | null;
  setServerConnection: (meta: ConnectionMeta) => void;
  setCloudConnection: (meta: ConnectionMeta) => void;
  clearConnections: () => void;
  hasCompletedSetup: () => boolean;
  setSourceProjectKey: (key: string | null) => void;
  setTargetProjectKey: (key: string | null) => void;
  setSourceProjectName: (name: string | null) => void;
  setTargetProjectName: (name: string | null) => void;
  loadProjectConfig: () => Promise<void>;
  saveProjectConfig: (
    source: string | null,
    target: string | null,
    sourceName?: string | null,
    targetName?: string | null,
  ) => Promise<void>;

  // ─── Phase 17 probe (D-05/D-07/D-08) ──────────────────────────────────────
  probeStatus: ProbeStatus;
  probeError: string | null;
  probeEndpointUrl: string | null;
  probeStatusCode: number | null;
  probeBannerDismissed: boolean;
  runProbe: () => Promise<void>;
  dismissProbeBanner: () => void;
  prewarmIssueTypes: () => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverConnection: null,
  cloudConnection: null,
  sourceProjectKey: null,
  targetProjectKey: null,
  sourceProjectName: null,
  targetProjectName: null,

  // ─── Phase 17 probe initial state ──────────────────────────────────────────
  probeStatus: 'idle',
  probeError: null,
  probeEndpointUrl: null,
  probeStatusCode: null,
  probeBannerDismissed: false,

  setServerConnection: (meta) => set({ serverConnection: meta }),
  setCloudConnection: (meta) => set({ cloudConnection: meta }),
  clearConnections: () =>
    set({
      serverConnection: null,
      cloudConnection: null,
      probeStatus: 'idle',
      probeError: null,
      probeEndpointUrl: null,
      probeStatusCode: null,
      probeBannerDismissed: false,
    }),
  hasCompletedSetup: () => get().serverConnection !== null && get().cloudConnection !== null,
  setSourceProjectKey: (key) => set({ sourceProjectKey: key }),
  setTargetProjectKey: (key) => set({ targetProjectKey: key }),
  setSourceProjectName: (name) => set({ sourceProjectName: name }),
  setTargetProjectName: (name) => set({ targetProjectName: name }),
  loadProjectConfig: async () => {
    try {
      const config = await invoke<{
        sourceProjectKey: string | null;
        targetProjectKey: string | null;
        sourceProjectName: string | null;
        targetProjectName: string | null;
      }>('get_project_config');
      set({
        sourceProjectKey: config.sourceProjectKey ?? null,
        targetProjectKey: config.targetProjectKey ?? null,
        sourceProjectName: config.sourceProjectName ?? null,
        targetProjectName: config.targetProjectName ?? null,
      });
    } catch {
      // Non-fatal: project config may not exist yet
    }
  },
  saveProjectConfig: async (source, target, sourceName, targetName) => {
    try {
      await invoke('set_project_config', {
        sourceProjectKey: source,
        targetProjectKey: target,
        sourceProjectName: sourceName ?? null,
        targetProjectName: targetName ?? null,
      });
    } catch {
      // Non-fatal: best-effort persistence
    }
  },

  runProbe: async () => {
    const target = get().targetProjectKey;
    if (!target) {
      set({
        probeStatus: 'skipped',
        probeError: null,
        probeEndpointUrl: null,
        probeStatusCode: null,
      });
      return;
    }
    try {
      const result = await invoke<ProbeResult>('probe_createmeta');
      if (result.ok) {
        set({
          probeStatus: 'ok',
          probeError: null,
          probeEndpointUrl: result.endpointUrl,
          probeStatusCode: result.statusCode,
        });
        // Fire D-01 pre-warm (best effort, non-blocking)
        await get().prewarmIssueTypes();
      } else {
        set({
          probeStatus: 'failed',
          probeError: result.hint,
          probeEndpointUrl: result.endpointUrl,
          probeStatusCode: result.statusCode,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
      set({
        probeStatus: 'failed',
        probeError: `Probe call rejected: ${msg}`,
        probeEndpointUrl: null,
        probeStatusCode: null,
      });
    }
  },

  dismissProbeBanner: () => set({ probeBannerDismissed: true }),

  prewarmIssueTypes: async () => {
    const target = get().targetProjectKey;
    if (!target) return;
    await useSchemaCacheStore.getState().preWarm(target);
  },
}));
