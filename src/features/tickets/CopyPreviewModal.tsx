import { invoke } from '@tauri-apps/api/core';
import { Loader2 } from 'lucide-react';
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
import type { FieldMappingRow } from '@/features/field-mapping/types';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import { DynamicTargetForm } from '@/features/field-renderers/DynamicTargetForm';
import { schemaCacheKey, useSchemaCacheStore } from '@/stores/schemaCacheStore';
import { useConnectionStore } from '../connections/connectionStore';
import { AllFieldsSection } from './AllFieldsSection';
import { computeGapFields } from './computeGapFields';
import { useCopyStore } from './copyStore';
import { DescriptionRenderer } from './DescriptionRenderer';
import { GapsSection } from './GapsSection';
import { IssueTypeChooser } from './IssueTypeChooser';
import { isOverrideValueFilled } from './isOverrideValueFilled';
import type { JiraUser } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopyPreviewModalProps {
  onOpenSettingsSection?: (section: 'field-mapping') => void;
}

// ---------------------------------------------------------------------------
// Source-column bespoke field list
// Fields excluded from AllFieldsSection because they have their own bespoke
// display in the source column (copy side-effect banners, description block).
// ---------------------------------------------------------------------------

const COPY_SOURCE_BESPOKE_FIELDS = [
  'description', // DescriptionRenderer below
  'subtasks', // banner below summarizes will-be-copied count
  'issuelinks', // banner below summarizes link list
  'attachment', // banner below summarizes will-be-copied count
  'comment', // banner below summarizes will-be-copied count
];

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
// Transformer kinds that can be prefilled directly from raw source field values.
// User / version / component require async resolution — they remain as gaps.
// Description is wiki_to_adf and handled server-side only.
// ---------------------------------------------------------------------------

const PREFILLABLE_KINDS = new Set(['identity', 'priority']);

// ---------------------------------------------------------------------------
// Fields that have their own bespoke store property and dedicated UI input.
// These must NEVER be seeded into overrideValues by the D-PREFILL loop,
// because confirmCopy merges overrideValues last and would overwrite the
// user-edited store value (e.g. targetSummary) with the original source value.
// ---------------------------------------------------------------------------

const PREFILL_EXCLUDED_TARGET_FIELDS = new Set(['summary']);

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

  // ── Tauri user-search wrapper (mirrors CopyPreviewPage.searchUsersForPicker) ──
  // Defined inside the component so it closes over sourceBaseUrl, which is
  // required by the search_jira_users_by_domain Rust command.
  const searchUsersForPicker = useCallback(
    async (q: string): Promise<JiraUser[]> => {
      const trimmed = q.trim();
      if (!trimmed) return [];
      const at = trimmed.lastIndexOf('@');
      const domain = at >= 0 ? trimmed.slice(at + 1) : trimmed;
      if (!domain) return [];
      try {
        const users = await invoke<JiraUser[]>('search_jira_users_by_domain', {
          baseUrl: sourceBaseUrl,
          domain,
        });
        return Array.isArray(users) ? users : [];
      } catch (e) {
        console.error('[CopyPreviewModal] search_jira_users_by_domain failed:', e);
        return [];
      }
    },
    [sourceBaseUrl],
  );

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

  // ── Prefill overrideValues from mapping rows (D-PREFILL) ──────────────────
  // Runs once when both mappingRows and sourceTicket are available.
  // Seeds overrideValues for identity/priority transformer rows using raw source
  // field values. Skips user/version/component kinds (require async resolution).
  // Does not overwrite values already set by the user.
  // Does not seed fields that have a bespoke store property (e.g. summary →
  // targetSummary) — those are emitted explicitly in confirmCopy after the
  // overrideValues spread, so seeding them here would cause the original source
  // value to overwrite the user's edits.
  // biome-ignore lint/correctness/useExhaustiveDependencies: overrideValues and setOverrideValue intentionally omitted — overrideValues in deps causes an infinite loop (setOverrideValue → overrideValues changes → effect fires again); setOverrideValue is a stable store action reference.
  useEffect(() => {
    if (!sourceTicket || mappingRows.length === 0) return;
    const sourceFields = sourceTicket.fields as Record<string, unknown>;
    for (const row of mappingRows) {
      if (!row.targetFieldId) continue;
      if (!PREFILLABLE_KINDS.has(row.transformerKind)) continue;
      // Skip fields managed by their own dedicated store property and UI input.
      if (PREFILL_EXCLUDED_TARGET_FIELDS.has(row.targetFieldId)) continue;
      // Do not overwrite values already set by the user.
      if (overrideValues[row.targetFieldId] !== undefined) continue;
      const rawValue = sourceFields[row.sourceFieldId];
      if (rawValue === null || rawValue === undefined) continue;
      setOverrideValue(row.targetFieldId, rawValue);
    }
  }, [mappingRows, sourceTicket]);

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

  // Gaps that the user has NOT yet filled in via the GapsSection inputs.
  // A gap with a non-empty override value is satisfied and must NOT block the
  // Copy button — the user has provided a value to send to the backend.
  const unfilledGapFields = useMemo(
    () => gapFields.filter((g) => !isOverrideValueFilled(overrideValues[g.fieldId], g.schema)),
    [gapFields, overrideValues],
  );

  const gapIds = useMemo(() => new Set(gapFields.map((g) => g.fieldId)), [gapFields]);
  const dynamicFormFields = useMemo(
    () =>
      resolvedTargetFields.filter(
        (f) =>
          f.fieldId !== 'summary' &&
          f.fieldId !== 'issuetype' &&
          f.fieldId !== 'project' &&
          !gapIds.has(f.fieldId),
      ),
    [resolvedTargetFields, gapIds],
  );

  // ── Email pre-fill (D-15, D-16) ───────────────────────────────────────────
  const initialQueriesByFieldId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (!sourceTicket) return out;
    const assigneeEmail = (sourceTicket.fields.assignee as { emailAddress?: string } | null)
      ?.emailAddress;
    const reporterEmail = (sourceTicket.fields.reporter as { emailAddress?: string } | null)
      ?.emailAddress;
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

  // ── previewCopyId — stable UUID generated when previewing opens ───────────
  // Mirrors the pattern in CopyPreviewPage (lines 138-148) so that the
  // log_preview_transformations rows and the write_copy_time_audit rows share
  // the same copyId group in the Audit Log's Field Transformations tab.
  const [previewCopyId, setPreviewCopyId] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== 'previewing') {
      setPreviewCopyId(null);
      return;
    }
    setPreviewCopyId(
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  }, [phase]);

  // ── Copy gating ───────────────────────────────────────────────────────────
  // A gap field gates the copy only while its override value is empty.
  // Once the user fills in the gap input (writing to overrideValues), the
  // gate opens — the entered value flows to the backend via copyStore.confirmCopy.
  const isGated = unfilledGapFields.length > 0;
  const isProjectMissing = !targetProjectKey;
  const isCopyDisabled = phase === 'copying' || isGated || !targetIssueTypeId || isProjectMissing;

  const isOpen = phase === 'loading_preview' || phase === 'previewing' || phase === 'copying';
  const renderedDescription = sourceTicket?.renderedFields?.description ?? null;
  const progressPercent = getProgressPercent(progressStep);

  const handleDiscard = () => {
    reset();
  };

  const handleConfirm = () => {
    confirmCopy(sourceBaseUrl, cloudBaseUrl, previewCopyId);
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

              {/* Dynamic source field list — all non-bespoke fields */}
              <AllFieldsSection
                fields={sourceTicket.fields as unknown as Record<string, unknown>}
                compact
                skip={COPY_SOURCE_BESPOKE_FIELDS}
                baseUrl={sourceBaseUrl}
              />

              {/* Side-effect banners: describe what the copy pipeline will do */}
              {sourceTicket.fields.attachment.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-brand-muted block mb-0.5">Attachments</span>
                  <span className="text-sm text-brand-text">
                    {sourceTicket.fields.attachment.length} file(s) will be copied
                  </span>
                </div>
              )}
              {sourceTicket.fields.comment.comments.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-brand-muted block mb-0.5">Comments</span>
                  <span className="text-sm text-brand-text">
                    {sourceTicket.fields.comment.comments.length} comment(s) will be copied
                  </span>
                </div>
              )}
              {sourceTicket.fields.subtasks.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-brand-muted block mb-0.5">Sub-tasks</span>
                  <span className="text-sm text-brand-text">
                    {sourceTicket.fields.subtasks.length} sub-task(s) will be created as child
                    issues:{' '}
                    {sourceTicket.fields.subtasks
                      .map((s) => `${s.key}: ${s.fields.summary}`)
                      .join(', ')}
                  </span>
                </div>
              )}
              {sourceTicket.fields.issuelinks.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-brand-muted block mb-0.5">Linked Issues</span>
                  <span className="text-sm text-brand-text">
                    {sourceTicket.fields.issuelinks
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
                  </span>
                </div>
              )}

              {/* Description (bespoke DescriptionRenderer handles ADF + wiki-rendered HTML) */}
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
                  onChange={(id) => {
                    void setTargetIssueTypeId(id);
                  }}
                  loading={isSchemaLoading}
                />
              )}

              {/* Summary (D-01, D-02) */}
              <div className="mb-3">
                <label
                  htmlFor="copy-target-summary-modal"
                  className="text-xs text-brand-muted block mb-1"
                >
                  Summary{' '}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
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
                  onMapLink={handleMapLink}
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
                    fields: unfilledGapFields.map((g) => g.name).join(', '),
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
