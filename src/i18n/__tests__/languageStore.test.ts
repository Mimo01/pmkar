import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { useLanguageStore, hydrateLanguage } from '../languageStore';
import i18n from '../index';

const mockInvoke = vi.mocked(invoke);

describe('languageStore', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    // Reset store to initial state
    useLanguageStore.setState({ language: 'en' });
    i18n.changeLanguage('en');
  });

  describe('initial state', () => {
    it('defaults to English', () => {
      expect(useLanguageStore.getState().language).toBe('en');
    });
  });

  describe('setLanguage', () => {
    it('updates store language to sk', () => {
      mockInvoke.mockResolvedValue(undefined);
      useLanguageStore.getState().setLanguage('sk');
      expect(useLanguageStore.getState().language).toBe('sk');
    });

    it('calls invoke with set_app_language and language sk', () => {
      mockInvoke.mockResolvedValue(undefined);
      useLanguageStore.getState().setLanguage('sk');
      expect(mockInvoke).toHaveBeenCalledWith('set_app_language', { language: 'sk' });
    });

    it('changes i18n language to sk', () => {
      mockInvoke.mockResolvedValue(undefined);
      useLanguageStore.getState().setLanguage('sk');
      expect(i18n.language).toBe('sk');
    });

    it('updates store language back to en', () => {
      mockInvoke.mockResolvedValue(undefined);
      useLanguageStore.getState().setLanguage('sk');
      useLanguageStore.getState().setLanguage('en');
      expect(useLanguageStore.getState().language).toBe('en');
    });
  });

  describe('hydrateLanguage', () => {
    it('sets language to sk when stored value is sk', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_app_language') return Promise.resolve('sk');
        return Promise.resolve(null);
      });
      await hydrateLanguage();
      expect(useLanguageStore.getState().language).toBe('sk');
    });

    it('sets language to en when stored value is en', async () => {
      // Start from sk to verify it switches back
      useLanguageStore.setState({ language: 'sk' });
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_app_language') return Promise.resolve('en');
        return Promise.resolve(null);
      });
      await hydrateLanguage();
      expect(useLanguageStore.getState().language).toBe('en');
    });

    it('sets language to sk when stored null and OS locale is sk-SK', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_app_language') return Promise.resolve(null);
        if (cmd === 'get_os_locale') return Promise.resolve('sk-SK');
        return Promise.resolve(null);
      });
      await hydrateLanguage();
      expect(useLanguageStore.getState().language).toBe('sk');
    });

    it('sets language to en when stored null and OS locale is en-US', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_app_language') return Promise.resolve(null);
        if (cmd === 'get_os_locale') return Promise.resolve('en-US');
        return Promise.resolve(null);
      });
      await hydrateLanguage();
      expect(useLanguageStore.getState().language).toBe('en');
    });

    it('ignores OS locale when stored language is en', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_app_language') return Promise.resolve('en');
        // get_os_locale should NOT be called if stored value exists
        if (cmd === 'get_os_locale') return Promise.resolve('sk-SK');
        return Promise.resolve(null);
      });
      await hydrateLanguage();
      // Should remain en, not switch to sk despite OS locale
      expect(useLanguageStore.getState().language).toBe('en');
    });

    it('defaults to en when stored null and OS locale is null', async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'get_app_language') return Promise.resolve(null);
        if (cmd === 'get_os_locale') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      await hydrateLanguage();
      expect(useLanguageStore.getState().language).toBe('en');
    });
  });
});
