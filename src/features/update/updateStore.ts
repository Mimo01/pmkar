import { create } from 'zustand';

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'installing'
  | 'error';

interface UpdateInfo {
  version: string;
  body: string | null;
  // Store the raw Update object from the plugin for later downloadAndInstall
  rawUpdate: unknown;
}

interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: number;
  errorMessage: string | null;
  lastCheckedAt: string | null;

  setChecking: () => void;
  setAvailable: (info: UpdateInfo) => void;
  setUpToDate: () => void;
  setDownloading: () => void;
  setInstalling: () => void;
  setProgress: (pct: number) => void;
  setError: (message: string) => void;
  dismiss: () => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateState>()((set) => ({
  status: 'idle',
  updateInfo: null,
  progress: 0,
  errorMessage: null,
  lastCheckedAt: null,

  setChecking: () => set({ status: 'checking', errorMessage: null }),
  setAvailable: (info) =>
    set({ status: 'available', updateInfo: info, lastCheckedAt: new Date().toISOString() }),
  setUpToDate: () =>
    set({ status: 'up-to-date', updateInfo: null, lastCheckedAt: new Date().toISOString() }),
  setDownloading: () => set({ status: 'downloading', progress: 0 }),
  setInstalling: () => set({ status: 'installing', progress: 100 }),
  setProgress: (pct) => set({ progress: pct }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  dismiss: () => set({ status: 'idle' }),
  reset: () => set({ status: 'idle', updateInfo: null, progress: 0, errorMessage: null }),
}));
