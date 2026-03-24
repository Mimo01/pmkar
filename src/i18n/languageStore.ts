import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import i18n from './index';

export type Language = 'en' | 'sk';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    invoke('set_app_language', { language: lang }).catch(() => {});
    set({ language: lang });
  },
}));

export async function hydrateLanguage(): Promise<void> {
  const stored = await invoke<string | null>('get_app_language').catch(() => null);
  if (stored === 'en' || stored === 'sk') {
    i18n.changeLanguage(stored);
    useLanguageStore.setState({ language: stored });
  } else {
    // First launch: detect OS locale (per D-08, D-10)
    const locale = await invoke<string | null>('get_os_locale').catch(() => null);
    const lang: Language = locale?.startsWith('sk') ? 'sk' : 'en';
    i18n.changeLanguage(lang);
    useLanguageStore.setState({ language: lang });
    invoke('set_app_language', { language: lang }).catch(() => {});
  }
}
