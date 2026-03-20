import { create } from 'zustand';
import type { ConnectionMeta } from './types';

interface ConnectionState {
  serverConnection: ConnectionMeta | null;
  cloudConnection: ConnectionMeta | null;
  setServerConnection: (meta: ConnectionMeta) => void;
  setCloudConnection: (meta: ConnectionMeta) => void;
  clearConnections: () => void;
  hasCompletedSetup: () => boolean;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverConnection: null,
  cloudConnection: null,
  setServerConnection: (meta) => set({ serverConnection: meta }),
  setCloudConnection: (meta) => set({ cloudConnection: meta }),
  clearConnections: () => set({ serverConnection: null, cloudConnection: null }),
  hasCompletedSetup: () => get().serverConnection !== null && get().cloudConnection !== null,
}));
