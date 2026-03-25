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
      } catch (err) {
        // Silently ignore on launch — endpoint may 404 between releases
        console.debug('Update check skipped:', err instanceof Error ? err.message : err);
      }
    };

    doCheck();
  }, []);
}
