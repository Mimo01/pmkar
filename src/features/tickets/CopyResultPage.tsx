import { invoke } from '@tauri-apps/api/core';
import { Check, ExternalLink, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
import { useTicketStore } from './ticketStore';
import type { CopyStepResult } from './types';

export function CopyResultPage() {
  const { t } = useTranslation();
  const { result, reset } = useCopyStore();
  const targetProjectName = useConnectionStore((s) => s.targetProjectName);

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-surface flex-shrink-0">
        <h1 className="text-lg font-semibold text-brand-text">
          {allPassed ? t('copy.result.complete') : t('copy.result.withErrors')}
        </h1>
        <div className="flex items-center gap-3">
          {issueCreated && result?.targetUrl && (
            <Button variant="outline" size="lg" onClick={handleOpenInJira}>
              <ExternalLink className="w-4 h-4 mr-1.5" aria-hidden="true" />
              {t('copy.result.openInJira', { name: targetProjectName || t('wizard.destination.subtitle') })}
            </Button>
          )}
          <Button size="lg" onClick={handleClose}>
            {t('copy.result.close')}
          </Button>
        </div>
      </div>

      {/* Result steps */}
      {result && (
        <div className="flex-1 overflow-y-auto p-6">
          {result.targetKey && (
            <p className="text-sm text-brand-muted mb-6">
              Created: <span className="font-mono font-semibold text-brand-text">{result.targetKey}</span>
            </p>
          )}

          <div className="space-y-2 max-w-2xl">
            {result.steps.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are immutable copy result items, index is stable
              <div
                key={i}
                className="flex items-start gap-3 py-2.5 px-3 rounded-md bg-brand-bg border border-brand-border"
              >
                {step.success ? (
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="text-sm text-brand-text">{stepLabel(step)}</span>
                  {step.detail && !step.success && (
                    <p className="text-xs text-brand-muted mt-1">{step.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
