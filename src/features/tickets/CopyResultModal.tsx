import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useCopyStore } from './copyStore';
import { useTicketStore } from './ticketStore';
import type { CopyStepResult } from './types';

export function CopyResultModal() {
  const { t } = useTranslation();
  const { phase, result, reset } = useCopyStore();

  if (phase !== 'result' || !result) return null;

  const allPassed = result.steps.every(s => s.success);
  const title = allPassed ? t('copy.result.complete') : t('copy.result.withErrors');
  const issueCreated = result.steps.some(s => s.step === 'create_issue' && s.success);

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
    if (result.targetUrl) {
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-modal-title"
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 max-w-md w-full bg-brand-surface rounded-lg shadow-xl p-6 mx-4">
        <h2 id="result-modal-title" className="text-base font-semibold mb-4">
          {title}
        </h2>

        <div className="space-y-0">
          {result.steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 py-2 ${
                i < result.steps.length - 1 ? 'border-b border-brand-border' : ''
              }`}
            >
              {step.success ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-400 shrink-0"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-400 shrink-0"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              <div>
                <span className="text-sm">{stepLabel(step)}</span>
                {step.detail && !step.success && (
                  <p className="text-xs text-brand-muted mt-0.5">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Target key display */}
        {result.targetKey && (
          <p className="text-xs text-brand-muted mt-3">Created: {result.targetKey}</p>
        )}

        {/* Open in Company Jira */}
        {issueCreated && result.targetUrl && (
          <button
            onClick={handleOpenInJira}
            className="w-full mt-4 py-2 text-sm font-semibold text-brand hover:underline"
          >
            {t('copy.result.openInJira')}
          </button>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          className="w-full mt-2 py-2 text-sm text-brand-muted hover:text-brand-text"
        >
          {t('copy.result.close')}
        </button>
      </div>
    </div>
  );
}
