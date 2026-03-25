import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
import { DescriptionRenderer } from './DescriptionRenderer';

function SourceFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <span className="text-xs text-brand-muted block mb-0.5">{label}</span>
      <span className="text-sm text-brand-text">{value}</span>
    </div>
  );
}

// Map progress step strings to percentage values
function getProgressPercent(progressStep: string): number {
  if (!progressStep) return 0;
  if (progressStep.includes('creating') || progressStep.includes('create')) return 20;
  if (progressStep.includes('description')) return 40;
  if (progressStep.includes('attachment') || progressStep.includes('image')) return 60;
  if (progressStep.includes('comment') || progressStep.includes('worklog')) return 80;
  if (
    progressStep.includes('done') ||
    progressStep.includes('complete') ||
    progressStep.includes('link')
  )
    return 100;
  return 20;
}

export function CopyPreviewPage() {
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

  const isCopying = phase === 'copying';
  const isLoading = phase === 'loading_preview';
  const renderedDescription = sourceTicket?.renderedFields?.description ?? null;
  const progressPercent = getProgressPercent(progressStep);

  const handleDiscard = () => {
    reset();
  };

  const handleConfirm = () => {
    confirmCopy(sourceBaseUrl, cloudBaseUrl);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border bg-brand-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={isCopying}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {t('copy.preview.discard')}
          </Button>
          {sourceTicket && (
            <span className="text-xs font-mono text-brand-muted">{sourceTicket.key}</span>
          )}
        </div>

        <h1 className="text-sm font-semibold text-brand-text absolute left-1/2 -translate-x-1/2">
          {t('copy.preview.title')}
        </h1>

        <Button
          onClick={handleConfirm}
          disabled={isCopying || isLoading}
          size="lg"
          className="bg-brand hover:bg-brand/90 text-white font-semibold px-6"
        >
          {isCopying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
              {t('copy.preview.copying')}
            </>
          ) : (
            t('copy.preview.confirm')
          )}
        </Button>
      </div>

      {/* Progress bar during copy */}
      {isCopying && (
        <div className="space-y-1.5 px-6 py-3 border-b border-brand-border bg-brand-surface flex-shrink-0">
          <Progress value={progressPercent} className="h-1 transition-all duration-300" />
          <p className="text-xs text-brand-muted" aria-live="polite" aria-atomic="true">
            {progressStep}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-brand-muted" aria-label="Loading preview" />
        </div>
      )}

      {/* Two-column content */}
      {sourceTicket && cloudMeta && !isLoading && (
        <div
          className={`flex flex-1 overflow-hidden min-h-0 ${isCopying ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {/* Left: Source (read-only) */}
          <div className="w-1/2 overflow-y-auto p-6 bg-brand-surface">
            <h2 className="text-sm font-semibold text-brand-text mb-4">
              {t('copy.preview.source')}
            </h2>

            <SourceFieldRow label="Summary" value={sourceTicket.fields.summary} />
            <SourceFieldRow label="Status" value={sourceTicket.fields.status.name} />
            <SourceFieldRow label="Priority" value={sourceTicket.fields.priority.name} />
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
                value={`${sourceTicket.fields.subtasks.length} sub-task(s) will be created as child issues: ${sourceTicket.fields.subtasks.map((s) => `${s.key}: ${s.fields.summary}`).join(', ')}`}
              />
            )}
            {sourceTicket.fields.issuelinks.length > 0 && (
              <SourceFieldRow
                label="Linked Issues"
                value={sourceTicket.fields.issuelinks
                  .map((link) => {
                    if (link.outwardIssue) {
                      return `${link.type.outward}: ${link.outwardIssue.key} \u2014 ${link.outwardIssue.fields.summary}`;
                    }
                    if (link.inwardIssue) {
                      return `${link.type.inward}: ${link.inwardIssue.key} \u2014 ${link.inwardIssue.fields.summary}`;
                    }
                    return '';
                  })
                  .filter(Boolean)
                  .join(', ')}
              />
            )}

            <div className="mt-4">
              <span className="text-xs text-brand-muted">Description</span>
              <div className="mt-2">
                <DescriptionRenderer
                  description={sourceTicket.fields.description}
                  renderedHtml={renderedDescription ?? undefined}
                  baseUrl={sourceBaseUrl}
                />
              </div>
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px bg-brand-border flex-shrink-0" />

          {/* Right: Target (editable) */}
          <div className="w-1/2 overflow-y-auto p-6 bg-brand-surface">
            <h2 className="text-sm font-semibold text-brand-text mb-4">
              {t('copy.preview.target')}
            </h2>

            {/* Summary (editable) */}
            <div className="mb-4">
              <label htmlFor="copy-target-summary" className="text-xs text-brand-muted block mb-1">
                Summary
              </label>
              <input
                id="copy-target-summary"
                type="text"
                value={targetSummary}
                onChange={(e) => setTargetSummary(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              />
            </div>

            {/* Assignee (read-only) */}
            <div className="mb-4">
              <span className="text-xs text-brand-muted block mb-0.5">Assignee</span>
              <span className="text-sm text-brand-text">Current user</span>
            </div>

            {/* Status dropdown */}
            <div className="mb-4">
              <label htmlFor="copy-target-status" className="text-xs text-brand-muted block mb-1">
                Status
              </label>
              <select
                id="copy-target-status"
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {cloudMeta.availableStatuses.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority dropdown */}
            <div className="mb-4">
              <label htmlFor="copy-target-priority" className="text-xs text-brand-muted block mb-1">
                Priority
              </label>
              <select
                id="copy-target-priority"
                value={targetPriorityId}
                onChange={(e) => setTargetPriorityId(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                {cloudMeta.availablePriorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Labels checkboxes */}
            <div className="mb-4">
              <span className="text-xs text-brand-muted block mb-1">Labels</span>
              {targetLabels.length === 0 ? (
                <p className="text-sm text-brand-muted">No labels on source ticket</p>
              ) : (
                targetLabels.map((label) => (
                  <label key={label} className="flex items-center gap-2 py-1 text-sm">
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
            <div className="mt-2">
              <label
                htmlFor="copy-target-description"
                className="text-xs text-brand-muted block mb-1"
              >
                Description
              </label>
              <textarea
                id="copy-target-description"
                value={targetDescription}
                onChange={(e) => setTargetDescription(e.target.value)}
                rows={12}
                className="w-full bg-brand-bg border border-brand-border rounded px-2 py-1.5 text-sm font-mono resize-y focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
