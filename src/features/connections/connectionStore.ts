import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { ConnectionMeta } from './types';

interface ConnectionState {
  serverConnection: ConnectionMeta | null;
  cloudConnection: ConnectionMeta | null;
  sourceProjectKey: string | null;
  targetProjectKey: string | null;
  setServerConnection: (meta: ConnectionMeta) => void;
  setCloudConnection: (meta: ConnectionMeta) => void;
  clearConnections: () => void;
  hasCompletedSetup: () => boolean;
  setSourceProjectKey: (key: string | null) => void;
  setTargetProjectKey: (key: string | null) => void;
  loadProjectConfig: () => Promise<void>;
  saveProjectConfig: (source: string | null, target: string | null) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverConnection: null,
  cloudConnection: null,
  sourceProjectKey: null,
  targetProjectKey: null,
  setServerConnection: (meta) => set({ serverConnection: meta }),
  setCloudConnection: (meta) => set({ cloudConnection: meta }),
  clearConnections: () => set({ serverConnection: null, cloudConnection: null }),
  hasCompletedSetup: () => get().serverConnection !== null && get().cloudConnection !== null,
  setSourceProjectKey: (key) => set({ sourceProjectKey: key }),
  setTargetProjectKey: (key) => set({ targetProjectKey: key }),
  loadProjectConfig: async () => {
    try {
      const config = await invoke<{ sourceProjectKey: string | null; targetProjectKey: string | null }>('get_project_config');
      set({
        sourceProjectKey: config.sourceProjectKey ?? null,
        targetProjectKey: config.targetProjectKey ?? null,
      });
    } catch {
      // Non-fatal: project config may not exist yet
    }
  },
  saveProjectConfig: async (source, target) => {
    try {
      await invoke('set_project_config', {
        sourceProjectKey: source,
        targetProjectKey: target,
      });
    } catch {
      // Non-fatal: best-effort persistence
    }
  },
}));
