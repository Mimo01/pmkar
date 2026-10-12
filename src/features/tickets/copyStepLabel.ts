import type { TFunction } from 'i18next';
import type { CopyStepResult } from './types';

/**
 * Shared label resolver for copy-pipeline steps (CONI-01).
 * Matches the step ids emitted by Rust (copy_pipeline.rs / commands.rs).
 * Rust/Jira `detail` text is passed through unchanged; only surrounding labels
 * and former English fallbacks are translated.
 */
export function copyStepLabel(step: CopyStepResult, t: TFunction): string {
  const ok = step.success;
  const id = step.step;

  switch (id) {
    case 'fetch_source':
      return ok ? t('copy.step.fetchSource') : t('copy.step.fetchSourceFailed');
    case 'create_issue':
      return ok ? t('copy.step.coreFields') : t('copy.step.coreFieldsFailed');
    case 'convert_description':
      return ok ? t('copy.step.descConverted') : t('copy.step.descFailed');
    case 'add_remotelink':
      return ok ? t('copy.step.remoteLinkAdded') : t('copy.step.remoteLinkFailed');
    case 'update_triage':
      return ok ? t('copy.step.triageUpdated') : t('copy.step.triageUpdateFailed');
    // Must precede the generic `worklog:{n}` prefix handling below.
    case 'worklog:fetch':
      return ok ? t('copy.step.worklogFetched') : t('copy.step.worklogFetchFailed');
  }

  if (id.startsWith('upload_image')) {
    return ok
      ? `${t('copy.step.imagesUploaded')}${step.detail ? ` (${step.detail})` : ''}`
      : t('copy.step.imagesFailed');
  }

  const colon = id.indexOf(':');
  if (colon > 0) {
    const kind = id.slice(0, colon);
    const arg = id.slice(colon + 1);
    switch (kind) {
      case 'attach':
        return ok
          ? t('copy.step.attached', { filename: arg })
          : t('copy.step.attachFailed', {
              filename: arg,
              detail: step.detail || t('copy.step.fallback.attachment'),
            });
      case 'comment':
        return ok
          ? t('copy.step.commentCopied', { n: arg })
          : t('copy.step.commentFailed', {
              n: arg,
              detail: step.detail || t('copy.step.fallback.failed'),
            });
      case 'worklog':
        return ok
          ? t('copy.step.worklogCopied', { n: arg })
          : t('copy.step.worklogFailed', {
              n: arg,
              detail: step.detail || t('copy.step.fallback.failed'),
            });
      case 'subtask':
        return ok
          ? t('copy.step.subtaskCreated', {
              key: arg,
              detail: step.detail || t('copy.step.fallback.created'),
            })
          : t('copy.step.subtaskFailed', {
              key: arg,
              detail: step.detail || t('copy.step.fallback.creationFailed'),
            });
    }
  }

  return ok ? t('copy.step.unknown', { id }) : t('copy.step.unknownFailed', { id });
}
