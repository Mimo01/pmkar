import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from '../themeStore';
import type { ThemeMode } from '../themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    // Use vi.stubGlobal to set up a localStorage mock for jsdom
    const storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
    });
    useThemeStore.setState({
      mode: 'system',
      resolved: 'light', // jsdom defaults to light (no dark mode media query)
    });
  });

  describe('initial state', () => {
    it('has a valid ThemeMode value', () => {
      const validModes: ThemeMode[] = ['light', 'dark', 'system'];
      expect(validModes).toContain(useThemeStore.getState().mode);
    });

    it('has resolved as light or dark', () => {
      const resolved = useThemeStore.getState().resolved;
      expect(['light', 'dark']).toContain(resolved);
    });
  });

  describe('setMode', () => {
    it('updates mode to light', () => {
      useThemeStore.getState().setMode('light');
      expect(useThemeStore.getState().mode).toBe('light');
    });

    it('updates mode to dark', () => {
      useThemeStore.getState().setMode('dark');
      expect(useThemeStore.getState().mode).toBe('dark');
    });

    it('updates mode to system', () => {
      useThemeStore.setState({ mode: 'light' });
      useThemeStore.getState().setMode('system');
      expect(useThemeStore.getState().mode).toBe('system');
    });

    it('resolves to light when mode is light', () => {
      useThemeStore.getState().setMode('light');
      expect(useThemeStore.getState().resolved).toBe('light');
    });

    it('resolves to dark when mode is dark', () => {
      useThemeStore.getState().setMode('dark');
      expect(useThemeStore.getState().resolved).toBe('dark');
    });

    it('persists mode to localStorage', () => {
      useThemeStore.getState().setMode('dark');
      expect(localStorage.getItem('pmkar-theme')).toBe('dark');
    });

    it('persists light mode to localStorage', () => {
      useThemeStore.getState().setMode('light');
      expect(localStorage.getItem('pmkar-theme')).toBe('light');
    });

    it('persists system mode to localStorage', () => {
      useThemeStore.getState().setMode('system');
      expect(localStorage.getItem('pmkar-theme')).toBe('system');
    });
  });

  describe('resolved theme', () => {
    it('resolved is always light or dark (never system)', () => {
      const modes: ThemeMode[] = ['light', 'dark', 'system'];
      for (const mode of modes) {
        useThemeStore.getState().setMode(mode);
        expect(['light', 'dark']).toContain(useThemeStore.getState().resolved);
      }
    });
  });
});
