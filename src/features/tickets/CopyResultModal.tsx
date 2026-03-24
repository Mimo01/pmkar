import { invoke } from '@tauri-apps/api/core';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCopyStore } from './copyStore';
import { useTicketStore } from './ticketStore';
import type { CopyStepResult } from './types';

export function CopyResultModal() {
  const { t } = useTranslation();
  const { phase, result, reset } = useCopyStore();

  const allPassed = result?.steps.every((s) => s.success) ?? false;
  const issueCreated = result?.steps.some((s) => s.step === 'create_issue' && s.success) ?? false;

  function stepLabel(step: CopyStepResult): string {
    if (step.step === 'create_issue') {
      return step.success ? t('copy.step.coreFields') : t('copy.step.coreFieldsFailed');
    }
    if (step.step === 'convert_description') {
      return step.success ? t('copy.step.descConverted') : t('copy.step.descFailed');
    }
    if (step.step.startsWith('upload_image')) {
      return step.success
        ? `${t('copy.step.imagesUploaded')}${step.detail ? ` (${step.detail})` : ''}`
        : t('copy.step.imagesFailed');
    }
    if (step.step === 'add_remote_link') {
      return step.success ? t('copy.step.remoteLinkAdded') : t('copy.step.remoteLinkFailed');
    }
    if (step.step.startsWith('attach:')) {
      const filename = step.step.slice('attach:'.length);
      return step.success
        ? t('copy.step.attached', { filename })
        : t('copy.step.attachFailed', { filename, detail: step.detail || 'attachment failed' });
    }
    if (step.step.startsWith('comment:')) {
      const n = step.step.slice('comment:'.length);
      return step.success
        ? t('copy.step.commentCopied', { n })
        : t('copy.step.commentFailed', { n, detail: step.detail || 'failed' });
    }
    if (step.step.startsWith('worklog:')) {
      const n = step.step.slice('worklog:'.length);
      return step.success
        ? t('copy.step.worklogCopied', { n })
        : t('copy.step.worklogFailed', { n, detail: step.detail || 'failed' });
    }
    if (step.step.startsWith('subtask:')) {
      const key = step.step.slice('subtask:'.length);
      return step.success
        ? t('copy.step.subtaskCreated', { key, detail: step.detail || 'created' })
        : t('copy.step.subtaskFailed', { key, detail: step.detail || 'creation failed' });
    }
    return step.step;
  }

  const handleOpenInJira = () => {
    if (result?.targetUrl) {
      invoke('open_external_url', { url: result.targetUrl });
    }
  };

  const handleClose = () => {
    // Refresh triage map so the ticket row shows the copied badge
    invoke<Record<string, import('./types').TriageEntry>>('get_triage_state')
      .then((map) => {
        useTicketStore.getState().hydrateTriageMap(map);
      })
      .catch(() => {})
      .finally(() => {
        reset();
      });
  };

  return (
    <Dialog
      open={phase === 'result'}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {allPassed ? t('copy.result.complete') : t('copy.result.withErrors')}
          </DialogTitle>
        </DialogHeader>

        {result && (
          <>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {result.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-1">
                    {step.success ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    )}
                    <div>
                      <span className="text-sm text-brand-text">{stepLabel(step)}</span>
                      {step.detail && !step.success && (
                        <p className="text-xs text-brand-muted mt-0.5">{step.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Target key display */}
            {result.targetKey && (
              <p className="text-xs text-brand-muted">Created: {result.targetKey}</p>
            )}
          </>
        )}

        <DialogFooter>
          {issueCreated && result?.targetUrl && (
            <Button variant="outline" onClick={handleOpenInJira}>
              {t('copy.result.openInJira')}
            </Button>
          )}
          <Button onClick={handleClose}>{t('copy.result.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
