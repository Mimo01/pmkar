import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { CircleCheck, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpdateStore } from './updateStore';

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function AboutSection() {
  const { t } = useTranslation();
  const status = useUpdateStore((s) => s.status);
  const errorMessage = useUpdateStore((s) => s.errorMessage);
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt);

  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(null));
  }, []);

  async function handleCheckForUpdates() {
    const store = useUpdateStore.getState();
    store.setChecking();
    try {
      const update = await check();
      if (update) {
        store.setAvailable({
          version: update.version,
          body: update.body ?? null,
          rawUpdate: update,
        });
      } else {
        store.setUpToDate();
      }
    } catch {
      store.setError(t('update.modal.errorCheck'));
    }
  }

  return (
    <div className="space-y-4">
      {/* Version row */}
      <div>
        <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-1">
          {t('about.version')}
        </p>
        {appVersion !== null ? (
          <p className="text-[13px] font-normal text-brand-muted">{appVersion}</p>
        ) : (
          <Skeleton className="h-4 w-16" />
        )}
      </div>

      {/* Last checked row */}
      <div>
        <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-1">
          {t('about.lastChecked')}
        </p>
        <p className="text-[13px] font-normal text-brand-muted">
          {lastCheckedAt ? formatRelativeTime(lastCheckedAt) : t('about.lastChecked.never')}
        </p>
      </div>

      {/* Status feedback */}
      {status === 'checking' && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-48" />
        </div>
      )}

      {status === 'up-to-date' && (
        <div className="flex items-center gap-2">
          <CircleCheck className="w-4 h-4 text-green-500" aria-hidden="true" />
          <span className="text-[13px] text-brand-text-secondary">{t('about.upToDate')}</span>
        </div>
      )}

      {status === 'available' && (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-brand text-white text-[11px] font-semibold">
            {t('about.updateAvailable')}
          </Badge>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div>
          <p className="text-[13px] text-red-400">{errorMessage}</p>
          <button
            type="button"
            onClick={handleCheckForUpdates}
            className="text-[11px] text-brand hover:underline mt-1"
          >
            {t('update.modal.tryAgain')}
          </button>
        </div>
      )}

      {/* Check for updates button */}
      {status !== 'available' && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckForUpdates}
          disabled={status === 'checking' || status === 'downloading' || status === 'installing'}
          aria-busy={status === 'checking' ? 'true' : 'false'}
          className="flex items-center gap-2"
        >
          {status === 'checking' && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          )}
          {status === 'checking' ? t('about.checking') : t('about.checkForUpdates')}
        </Button>
      )}
    </div>
  );
}
