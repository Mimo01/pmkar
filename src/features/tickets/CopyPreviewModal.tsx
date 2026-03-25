import { invoke } from '@tauri-apps/api/core';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
import { DescriptionRenderer } from './DescriptionRenderer';
import { PriorityIcon } from './PriorityIcon';
import { StatusBadge } from './StatusBadge';
import { UserAvatar } from './UserAvatar';

function SourceFieldRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3">
      <span className="text-xs text-brand-muted block mb-0.5">{label}</span>
      {children ? (
        <div className="text-sm text-brand-text">{children}</div>
      ) : (
        <span className="text-sm text-brand-text">{value}</span>
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
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
  const targetProjectKey = useCopyStore((s) => s.targetProjectKey);
  const setTargetSummary = useCopyStore((s) => s.setTargetSummary);
  const setTargetDescription = useCopyStore((s) => s.setTargetDescription);
  const setTargetStatus = useCopyStore((s) => s.setTargetStatus);
  const setTargetPriorityId = useCopyStore((s) => s.setTargetPriorityId);
  const setTargetProjectKey = useCopyStore((s) => s.setTargetProjectKey);
  const toggleLabel = useCopyStore((s) => s.toggleLabel);
  const reset = useCopyStore((s) => s.reset);
  const confirmCopy = useCopyStore((s) => s.confirmCopy);

  const sourceBaseUrl = useConnectionStore((s) => s.serverConnection?.baseUrl ?? '');
  const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl ?? '');

  const [cloudProjects, setCloudProjects] = useState<Array<{ key: string; name: string }>>([]);

  useEffect(() => {
    if (phase !== 'previewing') return;
    invoke<Array<{ key: string; name: string }>>('fetch_cloud_projects')
      .then(setCloudProjects)
      .catch(() => setCloudProjects([]));
  }, [phase]);

  const handleDiscard = () => {
    reset();
  };

  const handleConfirm = () => {
    confirmCopy(sourceBaseUrl, cloudBaseUrl);
  };

  const isOpen = phase === 'loading_preview' || phase === 'previewing' || phase === 'copying';

  const renderedDescription = sourceTicket?.renderedFields?.description ?? null;

  const progressPercent = getProgressPercent(progressStep);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && phase !== 'copying') reset();
      }}
    >
      <DialogContent className="max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-base font-semibold">{t('copy.preview.title')}</DialogTitle>
        </DialogHeader>

        {/* Progress bar during copy */}
        {phase === 'copying' && (
          <div className="space-y-2 px-6 pt-4">
            <Progress value={progressPercent} className="h-1 transition-all duration-300" />
            <p className="text-xs text-brand-muted" aria-live="polite" aria-atomic="true">
              {progressStep}
            </p>
          </div>
        )}

        <Separator className="mt-4" />

        {/* Two-column content */}
        {sourceTicket && cloudMeta && (
          <div
            className={`flex flex-1 overflow-hidden ${phase === 'copying' ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {/* Left: Source (read-only) */}
            <div className="w-1/2 overflow-y-auto p-4 bg-brand-surface">
              <h3 className="text-base font-semibold mb-4">{t('copy.preview.source')}</h3>

              <SourceFieldRow label="Summary" value={sourceTicket.fields.summary} />
              <SourceFieldRow label="Status">
                <StatusBadge status={sourceTicket.fields.status.name} />
              </SourceFieldRow>
              <SourceFieldRow label="Priority">
                <PriorityIcon priority={sourceTicket.fields.priority.name} size="sm" />
              </SourceFieldRow>
              <SourceFieldRow label="Assignee">
                <span className="flex items-center gap-1.5">
                  <UserAvatar user={sourceTicket.fields.assignee} size="sm" />
                  {sourceTicket.fields.assignee?.displayName ?? 'Unassigned'}
                </span>
              </SourceFieldRow>
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

            {/* Divider */}
            <div className="w-px bg-brand-border flex-shrink-0" />

            {/* Right: Target (editable) */}
            <div className="w-1/2 overflow-y-auto p-4 bg-brand-surface">
              <h3 className="text-base font-semibold mb-4">{t('copy.preview.target')}</h3>

              {/* Target project dropdown */}
              <div className="mb-3">
                <label
                  htmlFor="copy-target-project"
                  className="text-xs text-brand-muted block mb-1"
                >
                  {t('copy.targetProject')}
                </label>
                <select
                  id="copy-target-project"
                  value={targetProjectKey}
                  onChange={(e) => setTargetProjectKey(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {!targetProjectKey && <option value="">{t('settings.project.select')}</option>}
                  {cloudProjects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </select>
              </div>

              {/* Summary (editable) */}
              <div className="mb-3">
                <label
                  htmlFor="copy-target-summary"
                  className="text-xs text-brand-muted block mb-1"
                >
                  Summary
                </label>
                <input
                  id="copy-target-summary"
                  type="text"
                  value={targetSummary}
                  onChange={(e) => setTargetSummary(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>

              {/* Assignee (read-only) */}
              <FieldRow label="Assignee" value="Current user" />

              {/* Status dropdown */}
              <div className="mb-3">
                <label htmlFor="copy-target-status" className="text-xs text-brand-muted block mb-1">
                  Status
                </label>
                <select
                  id="copy-target-status"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
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
                <label
                  htmlFor="copy-target-priority"
                  className="text-xs text-brand-muted block mb-1"
                >
                  Priority
                </label>
                <select
                  id="copy-target-priority"
                  value={targetPriorityId}
                  onChange={(e) => setTargetPriorityId(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
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
              <div className="mt-4">
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
                  rows={8}
                  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1.5 text-sm font-mono resize-y focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>
            </div>
          </div>
        )}

        <Separator />

        <DialogFooter className="px-6 py-4">
          <Button variant="ghost" onClick={handleDiscard} disabled={phase === 'copying'}>
            {t('copy.preview.discard')}
          </Button>
          <Button onClick={handleConfirm} disabled={phase === 'copying'}>
            {phase === 'copying' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                {t('copy.preview.copying')}
              </>
            ) : (
              t('copy.preview.confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
