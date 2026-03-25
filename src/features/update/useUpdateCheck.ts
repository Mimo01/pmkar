import { check } from '@tauri-apps/plugin-updater';
import { useEffect, useRef } from 'react';
import { useUpdateStore } from './updateStore';

export function useUpdateCheck() {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    // D-04: Silent, non-blocking check on launch
    const doCheck = async () => {
      try {
        const update = await check();
        if (update) {
          useUpdateStore.getState().setAvailable({
            version: update.version,
            body: update.body ?? null,
            rawUpdate: update,
          });
        }
      } catch {
        // Silently ignore on launch check per D-04
        console.warn('Update check failed silently on launch');
      }
    };

    doCheck();
  }, []);
}
