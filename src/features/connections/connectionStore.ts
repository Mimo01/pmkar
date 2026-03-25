import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { ConnectionMeta } from './types';

interface ConnectionState {
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
  saveProjectConfig: (source: string | null, target: string | null, sourceName?: string | null, targetName?: string | null) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverConnection: null,
  cloudConnection: null,
  sourceProjectKey: null,
  targetProjectKey: null,
  sourceProjectName: null,
  targetProjectName: null,
  setServerConnection: (meta) => set({ serverConnection: meta }),
  setCloudConnection: (meta) => set({ cloudConnection: meta }),
  clearConnections: () => set({ serverConnection: null, cloudConnection: null }),
  hasCompletedSetup: () => get().serverConnection !== null && get().cloudConnection !== null,
  setSourceProjectKey: (key) => set({ sourceProjectKey: key }),
  setTargetProjectKey: (key) => set({ targetProjectKey: key }),
  setSourceProjectName: (name) => set({ sourceProjectName: name }),
  setTargetProjectName: (name) => set({ targetProjectName: name }),
  loadProjectConfig: async () => {
    try {
      const config = await invoke<{ sourceProjectKey: string | null; targetProjectKey: string | null; sourceProjectName: string | null; targetProjectName: string | null }>('get_project_config');
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
}));
