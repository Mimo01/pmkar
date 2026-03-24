import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: 'light' | 'dark';
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return getSystemTheme();
  return mode;
}

function persistMode(mode: ThemeMode) {
  try {
    localStorage.setItem('pmkar-theme', mode);
  } catch {}
}

function loadMode(): ThemeMode {
  try {
    const stored = localStorage.getItem('pmkar-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

const initialMode = loadMode();

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  resolved: resolveTheme(initialMode),
  setMode: (mode) => {
    persistMode(mode);
    set({ mode, resolved: resolveTheme(mode) });
  },
}));

// Listen for system theme changes
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState();
    if (state.mode === 'system') {
      useThemeStore.setState({ resolved: getSystemTheme() });
    }
  });
}
