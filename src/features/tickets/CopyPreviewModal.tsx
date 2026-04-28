import { invoke } from '@tauri-apps/api/core';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConnectionStore } from '../connections/connectionStore';
import { DynamicTargetForm } from '@/features/field-renderers/DynamicTargetForm';
import type { FieldMappingRow } from '@/features/field-mapping/types';
import { useSchemaCacheStore, schemaCacheKey } from '@/stores/schemaCacheStore';
import { useCopyStore } from './copyStore';
import { computeGapFields } from './computeGapFields';
import { DescriptionRenderer } from './DescriptionRenderer';
import { GapsSection } from './GapsSection';
import { IssueTypeChooser } from './IssueTypeChooser';
import { PriorityIcon } from './PriorityIcon';
import { StatusBadge } from './StatusBadge';
import type { JiraUser } from './types';
import { UserAvatar } from './UserAvatar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopyPreviewModalProps {
  onOpenSettingsSection?: (section: 'field-mapping') => void;
}

// ---------------------------------------------------------------------------
// Source-side read-only row helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Progress percent helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tauri user-search wrapper (mirrors CopyPreviewPage.searchUsersForPicker)
// ---------------------------------------------------------------------------

async function searchUsersForPicker(q: string): Promise<JiraUser[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const at = trimmed.lastIndexOf('@');
  const domain = at >= 0 ? trimmed.slice(at + 1) : trimmed;
  if (!domain) return [];
  try {
    const users = await invoke<JiraUser[]>('search_jira_users_by_domain', { domain });
    return Array.isArray(users) ? users : [];
  } catch (e) {
    console.error('[CopyPreviewModal] search_jira_users_by_domain failed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// CopyPreviewModal
// ---------------------------------------------------------------------------

export function CopyPreviewModal({ onOpenSettingsSection }: CopyPreviewModalProps = {}) {
  const { t } = useTranslation();

  // ── Store subscriptions ────────────────────────────────────────────────────
  const phase = useCopyStore((s) => s.phase);
  const sourceTicket = useCopyStore((s) => s.sourceTicket);
  const cloudMeta = useCopyStore((s) => s.cloudMeta);
  const targetSummary = useCopyStore((s) => s.targetSummary);
  const targetProjectKey = useCopyStore((s) => s.targetProjectKey);
  const setTargetSummary = useCopyStore((s) => s.setTargetSummary);
  const setTargetProjectKey = useCopyStore((s) => s.setTargetProjectKey);
  const progressStep = useCopyStore((s) => s.progressStep);
  const reset = useCopyStore((s) => s.reset);
  const confirmCopy = useCopyStore((s) => s.confirmCopy);

  // Phase 22 override state (D-11)
  const targetIssueTypeId = useCopyStore((s) => s.targetIssueTypeId);
  const overrideValues = useCopyStore((s) => s.overrideValues);
  const resolvedTargetFields = useCopyStore((s) => s.resolvedTargetFields);
  const setTargetIssueTypeId = useCopyStore((s) => s.setTargetIssueTypeId);
  const setOverrideValue = useCopyStore((s) => s.setOverrideValue);

  const sourceBaseUrl = useConnectionStore((s) => s.serverConnection?.baseUrl ?? '');
  const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl ?? '');

  // ── Cloud projects ─────────────────────────────────────────────────────────
  const [cloudProjects, setCloudProjects] = useState<Array<{ key: string; name: string }>>([]);

  useEffect(() => {
    if (phase !== 'previewing') return;
    invoke<Array<{ key: string; name: string }>>('fetch_cloud_projects')
      .then(setCloudProjects)
      .catch(() => setCloudProjects([]));
  }, [phase]);

  // ── Mapping rows ───────────────────────────────────────────────────────────
  const [mappingRows, setMappingRows] = useState<FieldMappingRow[]>([]);

  useEffect(() => {
    if (phase !== 'previewing') return;
    invoke<FieldMappingRow[]>('get_field_mapping')
      .then((rows) => setMappingRows(Array.isArray(rows) ? rows : []))
      .catch(() => setMappingRows([]));
  }, [phase]);

  // ── Schema-loading visual ──────────────────────────────────────────────────
  const cache = useSchemaCacheStore((s) => s.cache);
  const isSchemaLoading = useMemo(() => {
    if (!targetProjectKey || !targetIssueTypeId) return false;
    const entry = cache[schemaCacheKey('target', targetProjectKey, targetIssueTypeId)];
    return entry?.status === 'loading';
  }, [cache, targetProjectKey, targetIssueTypeId]);

  // ── Gap fields ─────────────────────────────────────────────────────────────
  const gapFields = useMemo(
    () => computeGapFields(resolvedTargetFields, mappingRows),
    [resolvedTargetFields, mappingRows],
  );

  const gapIds = useMemo(() => new Set(gapFields.map((g) => g.fieldId)), [gapFields]);
  const dynamicFormFields = useMemo(
    () =>
      resolvedTargetFields.filter(
        (f) => f.fieldId !== 'summary' && !gapIds.has(f.fieldId),
      ),
    [resolvedTargetFields, gapIds],
  );

  // ── Email pre-fill (D-15, D-16) ───────────────────────────────────────────
  const initialQueriesByFieldId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (!sourceTicket) return out;
    const assigneeEmail = (sourceTicket.fields.assignee as { emailAddress?: string } | null)?.emailAddress;
    const reporterEmail = (sourceTicket.fields.reporter as { emailAddress?: string } | null)?.emailAddress;
    for (const f of resolvedTargetFields) {
      const isUser =
        f.schema.type === 'user' ||
        (f.schema.type === 'array' && (f.schema as { items?: string }).items === 'user');
      if (!isUser) continue;
      const lname = f.name.toLowerCase();
      if (lname.includes('assignee') && assigneeEmail) {
        out[f.fieldId] = assigneeEmail;
      } else if (lname.includes('reporter') && reporterEmail) {
        out[f.fieldId] = reporterEmail;
      }
    }
    return out;
  }, [sourceTicket, resolvedTargetFields]);

  // ── Map-link handler (D-08) ───────────────────────────────────────────────
  const handleMapLink = useCallback(() => {
    reset();
    onOpenSettingsSection?.('field-mapping');
  }, [reset, onOpenSettingsSection]);

  // ── Copy gating ───────────────────────────────────────────────────────────
  const isGated = gapFields.length > 0;
  const isCopyDisabled = phase === 'copying' || isGated;

  const isOpen = phase === 'loading_preview' || phase === 'previewing' || phase === 'copying';
  const renderedDescription = sourceTicket?.renderedFields?.description ?? null;
  const progressPercent = getProgressPercent(progressStep);

  const handleDiscard = () => {
    reset();
  };

  const handleConfirm = () => {
    confirmCopy(sourceBaseUrl, cloudBaseUrl);
  };

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
                        return `${link.type.outward}: ${link.outwardIssue.key} — ${link.outwardIssue.fields.summary}`;
                      }
                      if (link.inwardIssue) {
                        return `${link.type.inward}: ${link.inwardIssue.key} — ${link.inwardIssue.fields.summary}`;
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
                  htmlFor="copy-target-project-modal"
                  className="text-xs text-brand-muted block mb-1"
                >
                  {t('copy.targetProject')}
                </label>
                <select
                  id="copy-target-project-modal"
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

              {/* Issue-type chooser (D-03..D-06) */}
              {targetProjectKey && (
                <IssueTypeChooser
                  projectKey={targetProjectKey}
                  sourceIssueTypeName={sourceTicket.fields.issuetype?.name ?? ''}
                  value={targetIssueTypeId}
                  onChange={(id) => { void setTargetIssueTypeId(id); }}
                  loading={isSchemaLoading}
                />
              )}

              {/* Summary (D-01, D-02) */}
              <div className="mb-3">
                <label
                  htmlFor="copy-target-summary-modal"
                  className="text-xs text-brand-muted block mb-1"
                >
                  Summary <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <input
                  id="copy-target-summary-modal"
                  type="text"
                  value={targetSummary}
                  onChange={(e) => setTargetSummary(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>

              {/* Gaps section (D-07, D-08) */}
              <GapsSection
                gapFields={gapFields}
                overrideValues={overrideValues}
                onOverrideChange={setOverrideValue}
                onMapLink={handleMapLink}
                onSearchUsers={searchUsersForPicker}
              />

              {/* Mapped fields via DynamicTargetForm */}
              <div
                aria-busy={isSchemaLoading ? 'true' : undefined}
                className={isSchemaLoading ? 'opacity-50 pointer-events-none' : undefined}
              >
                <DynamicTargetForm
                  fields={dynamicFormFields}
                  values={overrideValues}
                  onChange={setOverrideValue}
                  searchCallbacks={{ onSearchUsers: searchUsersForPicker }}
                  initialQueries={initialQueriesByFieldId}
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
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button onClick={handleConfirm} disabled={isCopyDisabled}>
                    {phase === 'copying' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {t('copy.preview.copying')}
                      </>
                    ) : (
                      t('copy.preview.confirm', { name: targetProjectKey })
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {isGated && (
                <TooltipContent>
                  {t('copy.preview.missingFields', {
                    fields: gapFields.map((g) => g.name).join(', '),
                  })}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
