import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConnectionStore } from '../connections/connectionStore';
import { DynamicTargetForm } from '@/features/field-renderers/DynamicTargetForm';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
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

export interface CopyPreviewPageProps {
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
// Tauri user-search wrapper (D-17, PERS-03, T-22-15)
// ---------------------------------------------------------------------------

async function searchUsersForPicker(q: string): Promise<JiraUser[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  // The backend command expects a domain. If the query contains '@', extract
  // the domain after the last '@'. Otherwise pass the query as-is — Cloud's
  // domain search returns an empty array for unmatched domains rather than
  // failing, so name-only searches gracefully fall through to "no results"
  // without crashing the UI.
  const at = trimmed.lastIndexOf('@');
  const domain = at >= 0 ? trimmed.slice(at + 1) : trimmed;
  if (!domain) return [];
  try {
    const users = await invoke<JiraUser[]>('search_jira_users_by_domain', { domain });
    return Array.isArray(users) ? users : [];
  } catch (e) {
    console.error('[CopyPreviewPage] search_jira_users_by_domain failed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Transformer kinds that can be prefilled directly from raw source field values.
// User / version / component require async resolution — they remain as gaps.
// Description is wiki_to_adf and handled server-side only.
// ---------------------------------------------------------------------------

const PREFILLABLE_KINDS = new Set(['identity', 'priority']);

// ---------------------------------------------------------------------------
// CopyPreviewPage
// ---------------------------------------------------------------------------

export function CopyPreviewPage({ onOpenSettingsSection }: CopyPreviewPageProps = {}) {
  const { t } = useTranslation();

  // ── Store subscriptions ────────────────────────────────────────────────────
  const phase = useCopyStore((s) => s.phase);
  const sourceTicket = useCopyStore((s) => s.sourceTicket);
  const cloudMeta = useCopyStore((s) => s.cloudMeta);
  const targetSummary = useCopyStore((s) => s.targetSummary);
  const targetProjectKey = useCopyStore((s) => s.targetProjectKey);
  const setTargetSummary = useCopyStore((s) => s.setTargetSummary);
  const setTargetProjectKey = useCopyStore((s) => s.setTargetProjectKey);
  const reset = useCopyStore((s) => s.reset);
  const confirmCopy = useCopyStore((s) => s.confirmCopy);
  const progressStep = useCopyStore((s) => s.progressStep);

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

  // ── Mapping rows (fetched once per preview open) ───────────────────────────
  const [mappingRows, setMappingRows] = useState<FieldMappingRow[]>([]);

  useEffect(() => {
    if (phase !== 'previewing') return;
    invoke<FieldMappingRow[]>('get_field_mapping')
      .then((rows) => setMappingRows(Array.isArray(rows) ? rows : []))
      .catch(() => setMappingRows([]));
  }, [phase]);

  // ── Prefill overrideValues from mapping rows (D-PREFILL) ──────────────────
  // Runs once when both mappingRows and sourceTicket are available.
  // Seeds overrideValues for identity/priority transformer rows using raw source
  // field values. Skips user/version/component kinds (require async resolution).
  // Does not overwrite values already set by the user.
  useEffect(() => {
    if (!sourceTicket || mappingRows.length === 0) return;
    const sourceFields = sourceTicket.fields as Record<string, unknown>;
    for (const row of mappingRows) {
      if (!row.targetFieldId) continue;
      if (!PREFILLABLE_KINDS.has(row.transformerKind)) continue;
      // Do not overwrite values already set by the user.
      if (overrideValues[row.targetFieldId] !== undefined) continue;
      const rawValue = sourceFields[row.sourceFieldId];
      if (rawValue === null || rawValue === undefined) continue;
      setOverrideValue(row.targetFieldId, rawValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappingRows, sourceTicket]);
  // Intentionally omit overrideValues and setOverrideValue from deps:
  // overrideValues would cause an infinite loop (setOverrideValue → overrideValues changes → effect fires again).
  // setOverrideValue is a stable store action reference and does not need to be in deps.

  // ── Schema-loading visual ──────────────────────────────────────────────────
  const cache = useSchemaCacheStore((s) => s.cache);
  const isSchemaLoading = useMemo(() => {
    if (!targetProjectKey || !targetIssueTypeId) return false;
    const entry = cache[schemaCacheKey('target', targetProjectKey, targetIssueTypeId)];
    return entry?.status === 'loading';
  }, [cache, targetProjectKey, targetIssueTypeId]);

  // ── Gap fields derivation (D-07) ──────────────────────────────────────────
  const gapFields = useMemo(
    () => computeGapFields(resolvedTargetFields, mappingRows),
    [resolvedTargetFields, mappingRows],
  );

  // ── DynamicTargetForm field list (resolved minus summary minus gaps) ───────
  const gapIds = useMemo(() => new Set(gapFields.map((g) => g.fieldId)), [gapFields]);
  const dynamicFormFields = useMemo(
    () =>
      resolvedTargetFields.filter(
        (f) => f.fieldId !== 'summary' && !gapIds.has(f.fieldId),
      ),
    [resolvedTargetFields, gapIds],
  );

  // ── Email pre-fill for person pickers (D-15, D-16, PERS-02, PERS-04) ──────
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
      // Heuristic: name-based mapping for assignee / reporter; other user-typed
      // custom fields get no automatic pre-fill (PERS-04: picker stays empty and interactive).
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

  // ── Copy gating (OVRD-04) ─────────────────────────────────────────────────
  const isCopying = phase === 'copying';
  const isLoading = phase === 'loading_preview';
  const isProjectMissing = !targetProjectKey;
  const isGated = gapFields.length > 0;
  const isCopyDisabled = isCopying || isLoading || isProjectMissing || isGated;

  const renderedDescription = sourceTicket?.renderedFields?.description ?? null;
  const progressPercent = getProgressPercent(progressStep);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
          <Button variant="outline" onClick={handleDiscard} disabled={isCopying}>
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

        {/* Copy button with tooltip for gaps (OVRD-04, D-09) */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Span wrapper required when button is disabled to allow tooltip to fire */}
              <span className="inline-block">
                <Button
                  onClick={handleConfirm}
                  disabled={isCopyDisabled}
                  size="lg"
                  className="bg-brand hover:bg-brand/90 text-white font-semibold px-6"
                >
                  {isCopying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
                      {t('copy.preview.copying')}
                    </>
                  ) : isProjectMissing ? (
                    t('copy.preview.selectProject')
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

          {/* Vertical divider */}
          <div className="w-px bg-brand-border flex-shrink-0" />

          {/* Right: Target (editable) */}
          <div className="w-1/2 overflow-y-auto p-6 bg-brand-surface">
            <h2 className="text-sm font-semibold text-brand-text mb-4">
              {t('copy.preview.target')}
            </h2>

            {/* Target project selector — existing behavior */}
            <div className="mb-4">
              <label htmlFor="copy-target-project" className="text-xs text-brand-muted block mb-1">
                {t('copy.targetProject')}
              </label>
              <div className="[&_button]:min-h-9">
                <VirtualizedCombobox<{ key: string; name: string }>
                  items={cloudProjects}
                  value={cloudProjects.find((p) => p.key === targetProjectKey) ?? null}
                  onChange={(p) => setTargetProjectKey(p.key)}
                  displayLabel={(p) => `${p.name} (${p.key})`}
                  filterFn={(p, q) =>
                    p.name.toLowerCase().includes(q.toLowerCase()) ||
                    p.key.toLowerCase().includes(q.toLowerCase())
                  }
                  placeholder={t('settings.project.select')}
                  ariaLabel={t('copy.targetProject')}
                />
              </div>
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
            <div className="mb-4">
              <label htmlFor="copy-target-summary" className="text-xs text-brand-muted block mb-1">
                Summary <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <input
                id="copy-target-summary"
                type="text"
                value={targetSummary}
                onChange={(e) => setTargetSummary(e.target.value)}
                className="w-full bg-brand-bg border border-brand-border rounded px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
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

            {/* Mapped fields via DynamicTargetForm (excluding summary + already-shown gaps) */}
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
                onMapLink={handleMapLink}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
