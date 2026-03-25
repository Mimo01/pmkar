import { relaunch } from '@tauri-apps/plugin-process';
import type { check as checkFn } from '@tauri-apps/plugin-updater';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUpdateStore } from './updateStore';

type RawUpdate = Awaited<ReturnType<typeof checkFn>> & {
  downloadAndInstall: (
    handler: (event: {
      event: string;
      data: { contentLength?: number; chunkLength?: number };
    }) => void,
  ) => Promise<void>;
};

interface UpdateModalProps {
  open: boolean;
}

export function UpdateModal({ open }: UpdateModalProps) {
  const { t } = useTranslation();
  const status = useUpdateStore((s) => s.status);
  const updateInfo = useUpdateStore((s) => s.updateInfo);
  const progress = useUpdateStore((s) => s.progress);
  const errorMessage = useUpdateStore((s) => s.errorMessage);

  const isActive =
    status === 'downloading' || status === 'installing';

  async function handleUpdate() {
    const { updateInfo: info } = useUpdateStore.getState();
    if (!info?.rawUpdate) return;

    const update = info.rawUpdate as RawUpdate;
    useUpdateStore.getState().setDownloading();

    try {
      let downloaded = 0;
      let contentLength: number | undefined;

      await update.downloadAndInstall(
        (event: { event: string; data: { contentLength?: number; chunkLength?: number } }) => {
          if (event.event === 'Started') {
            contentLength = event.data.contentLength;
          }
          if (event.event === 'Progress') {
            downloaded += event.data.chunkLength ?? 0;
            const pct = contentLength ? Math.round((downloaded / contentLength) * 100) : 0;
            useUpdateStore.getState().setProgress(pct);
          }
          if (event.event === 'Finished') {
            useUpdateStore.getState().setInstalling();
          }
        },
      );

      await relaunch();
    } catch {
      useUpdateStore.getState().setError(t('update.modal.errorDownload'));
    }
  }

  function handleLater() {
    useUpdateStore.getState().dismiss();
  }

  function handleTryAgain() {
    handleUpdate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        // Only allow closing when not actively downloading/installing
        if (!isOpen && !isActive) {
          useUpdateStore.getState().dismiss();
        }
      }}
    >
      <DialogContent
        className="max-w-[480px]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Prevent escape during active download/install
          if (isActive) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t('update.modal.title')}
          </DialogTitle>
          {updateInfo && (
            <DialogDescription className="text-[13px] text-brand-text-secondary">
              {t('update.modal.subtitle', { version: updateInfo.version })}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Changelog */}
        {(status === 'available' || status === 'error') && (
          <ScrollArea className="max-h-60 rounded-md border border-brand-border p-3">
            <p className="text-sm font-normal text-brand-text-secondary leading-relaxed whitespace-pre-wrap">
              {updateInfo?.body ?? t('update.modal.noChangelog')}
            </p>
          </ScrollArea>
        )}

        {/* Progress area */}
        {(status === 'downloading' || status === 'installing') && (
          <div className="space-y-2">
            <Progress
              value={progress}
              className="h-2 transition-all duration-300"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            <p
              className="text-[13px] text-brand-muted"
              aria-live="polite"
              aria-atomic="true"
            >
              {status === 'installing'
                ? t('update.modal.installing')
                : t('update.modal.downloading')}
            </p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && errorMessage && (
          <p
            className="text-[13px] text-red-400"
            aria-live="polite"
            aria-atomic="true"
          >
            {errorMessage}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleLater}
            disabled={isActive}
          >
            {t('update.modal.later')}
          </Button>

          {status === 'error' ? (
            <Button onClick={handleTryAgain} disabled={isActive}>
              {t('update.modal.tryAgain')}
            </Button>
          ) : (
            <Button
              onClick={handleUpdate}
              disabled={isActive}
              className="bg-brand hover:bg-brand/90 text-white"
            >
              {t('update.modal.updateNow')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
