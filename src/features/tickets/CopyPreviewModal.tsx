import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCopyStore } from './copyStore';
import { DescriptionRenderer } from './DescriptionRenderer';
import { useConnectionStore } from '../connections/connectionStore';

function SourceFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <span className="text-xs font-semibold text-brand-muted block mb-0.5">{label}</span>
      <span className="text-sm text-brand-text-secondary">{value}</span>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <span className="text-xs font-semibold text-brand-muted block mb-0.5">{label}</span>
      <span className="text-sm text-brand-text-secondary">{value}</span>
    </div>
  );
}

export function CopyPreviewModal() {
  const { t } = useTranslation();
  const phase = useCopyStore((s) => s.phase);
  const sourceTicket = useCopyStore((s) => s.sourceTicket);
  const cloudMeta = useCopyStore((s) => s.cloudMeta);
  const targetSummary = useCopyStore((s) => s.targetSummary);
  const targetDescription = useCopyStore((s) => s.targetDescription);
  const targetStatus = useCopyStore((s) => s.targetStatus);
  const targetPriorityId = useCopyStore((s) => s.targetPriorityId);
  const targetLabels = useCopyStore((s) => s.targetLabels);
  const selectedLabels = useCopyStore((s) => s.selectedLabels);
  const progressStep = useCopyStore((s) => s.progressStep);
  const setTargetSummary = useCopyStore((s) => s.setTargetSummary);
  const setTargetDescription = useCopyStore((s) => s.setTargetDescription);
  const setTargetStatus = useCopyStore((s) => s.setTargetStatus);
  const setTargetPriorityId = useCopyStore((s) => s.setTargetPriorityId);
  const toggleLabel = useCopyStore((s) => s.toggleLabel);
  const reset = useCopyStore((s) => s.reset);
  const confirmCopy = useCopyStore((s) => s.confirmCopy);

  const sourceBaseUrl = useConnectionStore((s) => s.serverConnection?.baseUrl ?? '');
  const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl ?? '');

  const discardButtonRef = useRef<HTMLButtonElement>(null);

  // Focus first interactive element on mount
  useEffect(() => {
    if (discardButtonRef.current) {
      discardButtonRef.current.focus();
    }
  }, []);

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleDiscard();
    }
  };

  const handleDiscard = () => {
    reset();
  };

  const handleConfirm = () => {
    confirmCopy(sourceBaseUrl, cloudBaseUrl);
  };

  if (phase !== 'previewing' && phase !== 'copying') {
    return null;
  }

  if (!sourceTicket || !cloudMeta) {
    return null;
  }

  const renderedDescription =
    sourceTicket.renderedFields?.description ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex flex-col"
      onKeyDown={handleEscape}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleDiscard}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-brand-surface border-b border-brand-border">
          <h2
            id="preview-modal-title"
            className="text-[13px] font-semibold"
          >
            {t('copy.preview.title')}
          </h2>
          <div className="flex items-center gap-3">
            <button
              ref={discardButtonRef}
              type="button"
              onClick={handleDiscard}
              className="text-brand-muted hover:text-brand-text text-sm"
            >
              {t('copy.preview.discard')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={phase === 'copying'}
              className="px-3 py-1 rounded text-sm font-semibold text-white bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('copy.preview.confirm')}
            </button>
          </div>
        </div>

        {/* Progress bar (visible during copying phase) */}
        {phase === 'copying' && (
          <div className="w-full">
            <div
              className="h-1 bg-brand animate-pulse"
              role="progressbar"
              aria-label={t('copy.preview.copying')}
            />
            <p className="text-center text-xs text-brand-muted py-1">
              {progressStep}
            </p>
          </div>
        )}

        {/* Two columns */}
        <div
          className={`flex flex-1 overflow-hidden ${phase === 'copying' ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* Left: Source (read-only) */}
          <div className="w-1/2 overflow-y-auto p-4 bg-brand-surface">
            <h3 className="text-base font-semibold mb-4">{t('copy.preview.source')}</h3>

            <SourceFieldRow
              label="Summary"
              value={sourceTicket.fields.summary}
            />
            <SourceFieldRow
              label="Status"
              value={sourceTicket.fields.status.name}
            />
            <SourceFieldRow
              label="Priority"
              value={sourceTicket.fields.priority.name}
            />
            <SourceFieldRow
              label="Assignee"
              value={sourceTicket.fields.assignee?.displayName ?? 'Unassigned'}
            />
            <SourceFieldRow
              label="Labels"
              value={
                sourceTicket.fields.labels.length > 0
                  ? sourceTicket.fields.labels.join(', ')
                  : 'None'
              }
            />
            {sourceTicket.fields.attachment.length > 0 && (
              <SourceFieldRow
                label="Attachments"
                value={`${sourceTicket.fields.attachment.length} file(s) will be copied`}
              />
            )}
            {sourceTicket.fields.comment.comments.length > 0 && (
              <SourceFieldRow
                label="Comments"
                value={`${sourceTicket.fields.comment.comments.length} comment(s) will be copied`}
              />
            )}
            {sourceTicket.fields.subtasks.length > 0 && (
              <SourceFieldRow
                label="Sub-tasks"
                value={`${sourceTicket.fields.subtasks.length} sub-task(s) will be created as child issues: ${sourceTicket.fields.subtasks.map(s => `${s.key}: ${s.fields.summary}`).join(', ')}`}
              />
            )}
            {sourceTicket.fields.issuelinks.length > 0 && (
              <SourceFieldRow
                label="Linked Issues"
                value={sourceTicket.fields.issuelinks.map(link => {
                  if (link.outwardIssue) {
                    return `${link.type.outward}: ${link.outwardIssue.key} \u2014 ${link.outwardIssue.fields.summary}`;
                  }
                  if (link.inwardIssue) {
                    return `${link.type.inward}: ${link.inwardIssue.key} \u2014 ${link.inwardIssue.fields.summary}`;
                  }
                  return '';
                }).filter(Boolean).join(', ')}
              />
            )}

            <div className="mt-4">
              <span className="text-xs font-semibold text-brand-muted">
                Description
              </span>
              <div className="mt-2">
                <DescriptionRenderer
                  description={sourceTicket.fields.description}
                  renderedHtml={renderedDescription ?? undefined}
                  baseUrl={sourceBaseUrl}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-brand-border flex-shrink-0" />

          {/* Right: Target (editable) */}
          <div className="w-1/2 overflow-y-auto p-4 bg-brand-surface">
            <h3 className="text-base font-semibold mb-4">{t('copy.preview.target')}</h3>

            {/* Summary (editable) */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-brand-muted block mb-1">
                Summary
              </label>
              <input
                type="text"
                value={targetSummary}
                onChange={(e) => setTargetSummary(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm"
              />
            </div>

            {/* Assignee (read-only) */}
            <FieldRow label="Assignee" value="Current user" />

            {/* Status dropdown */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-brand-muted block mb-1">
                Status
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm"
              >
                {cloudMeta.availableStatuses.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority dropdown */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-brand-muted block mb-1">
                Priority
              </label>
              <select
                value={targetPriorityId}
                onChange={(e) => setTargetPriorityId(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm"
              >
                {cloudMeta.availablePriorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Labels checkboxes */}
            <div className="mb-3">
              <label className="text-xs font-semibold text-brand-muted block mb-1">
                Labels
              </label>
              {targetLabels.length === 0 ? (
                <p className="text-sm text-brand-muted">
                  No labels on source ticket
                </p>
              ) : (
                targetLabels.map((label) => (
                  <label
                    key={label}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLabels.includes(label)}
                      onChange={() => toggleLabel(label)}
                    />
                    {label}
                  </label>
                ))
              )}
            </div>

            {/* Description (editable) */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-brand-muted block mb-1">
                Description
              </label>
              <textarea
                value={targetDescription}
                onChange={(e) => setTargetDescription(e.target.value)}
                rows={8}
                className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1.5 text-sm font-mono resize-y"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
