import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { FieldMappingRow } from '@/features/field-mapping/types';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import { DynamicTargetForm } from '@/features/field-renderers/DynamicTargetForm';
import { schemaCacheKey, useSchemaCacheStore } from '@/stores/schemaCacheStore';
import { useConnectionStore } from '../connections/connectionStore';
import { computeGapFields } from './computeGapFields';
import { useCopyStore } from './copyStore';
import { DescriptionRenderer } from './DescriptionRenderer';
import { GapsSection } from './GapsSection';
import { IssueTypeChooser } from './IssueTypeChooser';
import { isOverrideValueFilled } from './isOverrideValueFilled';
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
// Transformer kinds that can be prefilled directly from raw source field values.
// User / version / component require async resolution — they remain as gaps.
// Description is wiki_to_adf and handled server-side only.
// ---------------------------------------------------------------------------

const PREFILLABLE_KINDS = new Set(['identity', 'priority']);

// ---------------------------------------------------------------------------
// Fields that have their own bespoke store property and dedicated UI input.
// These must NEVER be seeded into overrideValues by the D-PREFILL loop,
// because confirmCopy emits them after the overrideValues spread and they
// would overwrite the user-edited store value (e.g. targetSummary) with the
// original source value.
// ---------------------------------------------------------------------------

const PREFILL_EXCLUDED_TARGET_FIELDS = new Set(['summary']);

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

  // ── Preview audit copy id (quick task 260430-0tj) ──────────────────────────
  // One uuid per preview-open. Reset each time phase enters 'previewing' so a
  // re-open produces a fresh batch of audit rows distinguishable from the prior.
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

  // ── Pre-warm + set default issue type when target project changes mid-preview ──
  useEffect(() => {
    if (!targetProjectKey || useCopyStore.getState().phase !== 'previewing') return;
    void (async () => {
      const cacheStore = useSchemaCacheStore.getState();
      let types = cacheStore.prewarmedIssueTypes[targetProjectKey];
      if (!types || types.length === 0) {
        await cacheStore.preWarm(targetProjectKey);
        types = useSchemaCacheStore.getState().prewarmedIssueTypes[targetProjectKey];
      }
      if (!types || types.length === 0) return;
      const currentId = useCopyStore.getState().targetIssueTypeId;
      if (currentId && types.some((it) => it.id === currentId)) return;
      const srcName = useCopyStore.getState().sourceTicket?.fields.issuetype?.name ?? '';
      const matched = srcName
        ? types.find((it) => it.name.toLowerCase() === srcName.toLowerCase())
        : null;
      const id = matched?.id ?? types[0]?.id ?? null;
      if (id) await setTargetIssueTypeId(id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetProjectKey, setTargetIssueTypeId]);

  // ── Prefill overrideValues from mapping rows (D-PREFILL) ──────────────────
  // Runs once when both mappingRows and sourceTicket are available.
  // Seeds overrideValues for identity/priority transformer rows using raw source
  // field values. Phase 25: also invokes resolve_description_to_adf for wiki_to_adf
  // rows and resolve_users_preview for user-kind rows.
  // Does not overwrite values already set by the user.
  // Does not seed fields that have a bespoke store property (e.g. summary →
  // targetSummary) — those are emitted explicitly in confirmCopy after the
  // overrideValues spread, so seeding them here would cause the original source
  // value to overwrite the user's edits.
  // Quick task 260430-0tj — also batches a per-row audit entry describing what
  // the pre-fill did (or didn't) and emits log_preview_transformations once at
  // the end so the user can inspect outcomes from the Audit Log page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: overrideValues and setOverrideValue intentionally omitted — overrideValues in deps causes an infinite loop (setOverrideValue → overrideValues changes → effect fires again); setOverrideValue is a stable store action reference.
  useEffect(() => {
    if (!sourceTicket || mappingRows.length === 0 || !previewCopyId) return;
    let cancelled = false;

    void (async () => {
      const sourceFields = sourceTicket.fields as Record<string, unknown>;

      type LogEntry = {
        targetFieldId: string;
        sourceFieldId: string;
        transformerKind: string;
        outcome: 'ok' | 'failed' | 'skipped';
        failureReason: string | null;
        wasOverridden: boolean;
        gapKind: string | null;
        sourceValue: unknown;
        targetValue: unknown;
      };
      const logEntries: LogEntry[] = [];

      // ── 1. Identity / priority rows (synchronous — unchanged) ──────────────
      for (const row of mappingRows) {
        if (!row.targetFieldId) continue;
        if (!PREFILLABLE_KINDS.has(row.transformerKind)) continue;
        // Skip fields that have a dedicated store property and UI input (e.g.
        // summary → targetSummary). Seeding overrideValues for these would
        // cause confirmCopy to overwrite the user's edited value with the
        // original source value.
        if (PREFILL_EXCLUDED_TARGET_FIELDS.has(row.targetFieldId)) {
          logEntries.push({
            targetFieldId: row.targetFieldId,
            sourceFieldId: row.sourceFieldId,
            transformerKind: row.transformerKind,
            outcome: 'skipped',
            failureReason: 'field has dedicated store property — managed outside overrideValues',
            wasOverridden: false,
            gapKind: null,
            sourceValue: sourceFields[row.sourceFieldId] ?? null,
            targetValue: null,
          });
          continue;
        }
        const rawValue = (sourceFields[row.sourceFieldId] ?? null) as unknown;
        const userAlreadyHasValue = overrideValues[row.targetFieldId] !== undefined;

        let outcome: 'ok' | 'failed' | 'skipped' = 'skipped';
        let failureReason: string | null = null;
        let targetValue: unknown = null;

        if (rawValue === null || rawValue === undefined) {
          outcome = 'skipped';
          failureReason = 'source value missing';
        } else if (userAlreadyHasValue) {
          outcome = 'ok';
          targetValue = overrideValues[row.targetFieldId];
        } else {
          setOverrideValue(row.targetFieldId, rawValue);
          outcome = 'ok';
          targetValue = rawValue;
        }

        logEntries.push({
          targetFieldId: row.targetFieldId,
          sourceFieldId: row.sourceFieldId,
          transformerKind: row.transformerKind,
          outcome,
          failureReason,
          wasOverridden: userAlreadyHasValue,
          gapKind: null,
          sourceValue: rawValue,
          targetValue,
        });
      }

      // ── 2. wiki_to_adf row (description — async, read-only in preview) ────
      // Design decision D-01 (Phase 25): description is SHOWN READ-ONLY in the
      // preview modal. The ADF value stored in overrideValues flows verbatim to
      // copy_ticket_v2 via the override merge. No TextAreaRenderer involved.
      const descRow = mappingRows.find(
        (r) =>
          r.transformerKind === 'wiki_to_adf' ||
          (r.targetFieldId === 'description' &&
            'system' in r.sourceSchema &&
            r.sourceSchema.system === 'description'),
      );
      const descHtml = sourceTicket.renderedFields?.description ?? null;

      let descPromise: Promise<void> = Promise.resolve();
      if (descRow && descHtml) {
        descPromise = invoke<unknown>('resolve_description_to_adf', { html: descHtml })
          .then((adf) => {
            if (cancelled || !adf) return;
            setOverrideValue(descRow.targetFieldId, adf);
            logEntries.push({
              targetFieldId: descRow.targetFieldId,
              sourceFieldId: descRow.sourceFieldId,
              transformerKind: descRow.transformerKind,
              outcome: 'ok',
              failureReason: null,
              wasOverridden: useCopyStore.getState().overrideValues[descRow.targetFieldId] !== undefined,
              gapKind: null,
              sourceValue: descHtml,
              targetValue: adf,
            });
          })
          .catch(() => {
            if (cancelled) return;
            logEntries.push({
              targetFieldId: descRow.targetFieldId,
              sourceFieldId: descRow.sourceFieldId,
              transformerKind: descRow.transformerKind,
              outcome: 'skipped',
              failureReason: 'resolve_description_to_adf failed',
              wasOverridden: false,
              gapKind: null,
              sourceValue: descHtml,
              targetValue: null,
            });
          });
      } else if (descRow) {
        // No rendered HTML — skip and log
        logEntries.push({
          targetFieldId: descRow.targetFieldId,
          sourceFieldId: descRow.sourceFieldId,
          transformerKind: descRow.transformerKind,
          outcome: 'skipped',
          failureReason: 'source rendered description missing',
          wasOverridden: false,
          gapKind: null,
          sourceValue: null,
          targetValue: null,
        });
      }

      // ── 3. user rows (all user-kind mappings — async) ─────────────────────
      const userRows = mappingRows.filter(
        (r) =>
          r.transformerKind === 'user' ||
          r.sourceSchema?.type === 'user' ||
          (r.sourceSchema?.type === 'array' && r.sourceSchema?.items === 'user'),
      );

      // user_name transformer: extract displayName directly from source — no Cloud lookup needed.
      const userNameRows = userRows.filter((r) => r.transformerKind === 'user_name');
      const cloudUserRows = userRows.filter((r) => r.transformerKind !== 'user_name');

      for (const row of userNameRows) {
        const fieldVal = sourceFields[row.sourceFieldId];
        const sourceVal = fieldVal ?? null;
        if (!fieldVal || typeof fieldVal !== 'object' || Array.isArray(fieldVal)) {
          logEntries.push({
            targetFieldId: row.targetFieldId,
            sourceFieldId: row.sourceFieldId,
            transformerKind: row.transformerKind,
            outcome: 'skipped',
            failureReason: 'source user field missing or not an object',
            wasOverridden: false,
            gapKind: null,
            sourceValue: sourceVal,
            targetValue: null,
          });
          continue;
        }
        const val = fieldVal as Record<string, unknown>;
        const displayName =
          (val.displayName as string | undefined) ?? (val.name as string | undefined) ?? null;
        if (!displayName) {
          logEntries.push({
            targetFieldId: row.targetFieldId,
            sourceFieldId: row.sourceFieldId,
            transformerKind: row.transformerKind,
            outcome: 'skipped',
            failureReason: 'source user: displayName and name both missing',
            wasOverridden: false,
            gapKind: null,
            sourceValue: sourceVal,
            targetValue: null,
          });
          continue;
        }
        if (useCopyStore.getState().overrideValues[row.targetFieldId] === undefined) {
          setOverrideValue(row.targetFieldId, displayName);
        }
        logEntries.push({
          targetFieldId: row.targetFieldId,
          sourceFieldId: row.sourceFieldId,
          transformerKind: row.transformerKind,
          outcome: 'ok',
          failureReason: null,
          wasOverridden: useCopyStore.getState().overrideValues[row.targetFieldId] !== undefined,
          gapKind: null,
          sourceValue: sourceVal,
          targetValue: displayName,
        });
      }

      // Build the user entries list from source ticket fields.
      // Each entry: { username: string, email: string | null }
      type UserEntry = { username: string; email: string | null };
      const userEntries: UserEntry[] = [];
      const rowsWithEntry: Array<{ row: (typeof cloudUserRows)[0]; entryIndex: number }> = [];

      for (const row of cloudUserRows) {
        const fieldVal = sourceFields[row.sourceFieldId];
        if (!fieldVal || typeof fieldVal !== 'object') {
          // Source user field is missing or not an object — log as skipped before continuing.
          logEntries.push({
            targetFieldId: row.targetFieldId,
            sourceFieldId: row.sourceFieldId,
            transformerKind: row.transformerKind,
            outcome: 'skipped',
            failureReason: 'source user field missing',
            wasOverridden: false,
            gapKind: null,
            sourceValue: fieldVal ?? null,
            targetValue: null,
          });
          continue;
        }
        // Array user field (e.g. type=array, items=user): extract first element.
        if (Array.isArray(fieldVal)) {
          const firstItem = fieldVal[0] as Record<string, unknown> | null | undefined;
          const arrayUsername =
            (firstItem?.name as string | undefined) ??
            (firstItem?.key as string | undefined) ??
            null;
          if (!arrayUsername) {
            logEntries.push({
              targetFieldId: row.targetFieldId,
              sourceFieldId: row.sourceFieldId,
              transformerKind: row.transformerKind,
              outcome: 'skipped',
              failureReason: 'array user field: username not extractable',
              wasOverridden: false,
              gapKind: null,
              sourceValue: fieldVal,
              targetValue: null,
            });
            continue;
          }
          const arrayEmail = (firstItem?.emailAddress as string | undefined) ?? null;
          const arrayEntryIndex = userEntries.length;
          userEntries.push({ username: arrayUsername, email: arrayEmail });
          rowsWithEntry.push({ row, entryIndex: arrayEntryIndex });
          continue;
        }
        const val = fieldVal as Record<string, unknown>;
        // Single user: { name, emailAddress }
        const username =
          (val.name as string | undefined) ?? (val.key as string | undefined) ?? null;
        if (!username) continue;
        const email = (val.emailAddress as string | undefined) ?? null;
        const entryIndex = userEntries.length;
        userEntries.push({ username, email });
        rowsWithEntry.push({ row, entryIndex });
      }

      let usersPromise: Promise<void> = Promise.resolve();
      if (userEntries.length > 0) {
        usersPromise = invoke<(Record<string, unknown> | null)[]>('resolve_users_preview', {
          users: userEntries,
          cloudBaseUrl,
        })
          .then((resolved) => {
            if (cancelled) return;
            for (const { row, entryIndex } of rowsWithEntry) {
              const resolvedUser = resolved[entryIndex] ?? null;
              const sourceVal = sourceFields[row.sourceFieldId];
              if (resolvedUser?.accountId) {
                // WR-03: guard against overwriting a user-entered override value.
                if (useCopyStore.getState().overrideValues[row.targetFieldId] === undefined) {
                  setOverrideValue(row.targetFieldId, resolvedUser);
                }
                logEntries.push({
                  targetFieldId: row.targetFieldId,
                  sourceFieldId: row.sourceFieldId,
                  transformerKind: row.transformerKind,
                  outcome: 'ok',
                  failureReason: null,
                  // WR-02: read live state instead of stale closure snapshot.
                  wasOverridden: useCopyStore.getState().overrideValues[row.targetFieldId] !== undefined,
                  gapKind: null,
                  sourceValue: sourceVal,
                  targetValue: resolvedUser,
                });
              } else {
                logEntries.push({
                  targetFieldId: row.targetFieldId,
                  sourceFieldId: row.sourceFieldId,
                  transformerKind: row.transformerKind,
                  outcome: 'skipped',
                  failureReason: 'user not resolved in Cloud',
                  wasOverridden: false,
                  gapKind: 'person',
                  sourceValue: sourceVal,
                  targetValue: null,
                });
              }
            }
          })
          .catch(() => {
            if (cancelled) return;
            for (const { row } of rowsWithEntry) {
              logEntries.push({
                targetFieldId: row.targetFieldId,
                sourceFieldId: row.sourceFieldId,
                transformerKind: row.transformerKind,
                outcome: 'skipped',
                failureReason: 'resolve_users_preview failed',
                wasOverridden: false,
                gapKind: null,
                sourceValue: sourceFields[row.sourceFieldId] ?? null,
                targetValue: null,
              });
            }
          });
      } else {
        // No user rows to resolve — log skipped for any non-prefillable, non-wiki_to_adf rows
        for (const row of mappingRows) {
          if (!row.targetFieldId) continue;
          if (PREFILLABLE_KINDS.has(row.transformerKind)) continue;
          if (row.transformerKind === 'wiki_to_adf') continue;
          if (userRows.some((r) => r.targetFieldId === row.targetFieldId)) continue;
          const rawValue = sourceFields[row.sourceFieldId] ?? null;
          logEntries.push({
            targetFieldId: row.targetFieldId,
            sourceFieldId: row.sourceFieldId,
            transformerKind: row.transformerKind,
            outcome: 'skipped',
            failureReason: `${row.transformerKind} requires async resolution — runs at copy time`,
            wasOverridden: false,
            gapKind: null,
            sourceValue: rawValue,
            targetValue: null,
          });
        }
      }

      // Wait for both async resolution paths before flushing the audit log.
      await Promise.all([descPromise, usersPromise]);

      if (!cancelled && logEntries.length > 0) {
        invoke('log_preview_transformations', {
          copyId: previewCopyId,
          entries: logEntries,
        }).catch((err: unknown) => {
          console.error('[CopyPreviewPage] log_preview_transformations failed:', err);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mappingRows, sourceTicket, previewCopyId]);

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

  // Gaps that the user has NOT yet filled in via the GapsSection inputs.
  // A gap with a non-empty override value is satisfied and must NOT block the
  // Copy button — the user has provided a value to send to the backend.
  const unfilledGapFields = useMemo(
    () => gapFields.filter((g) => !isOverrideValueFilled(overrideValues[g.fieldId], g.schema)),
    [gapFields, overrideValues],
  );

  // ── DynamicTargetForm field list (resolved minus summary minus gaps) ───────
  const gapIds = useMemo(() => new Set(gapFields.map((g) => g.fieldId)), [gapFields]);
  const dynamicFormFields = useMemo(
    () =>
      resolvedTargetFields.filter(
        (f) =>
          f.fieldId !== 'summary' &&
          f.fieldId !== 'issuetype' &&
          f.fieldId !== 'project' &&
          f.fieldId !== 'description' &&
          !gapIds.has(f.fieldId),
      ),
    [resolvedTargetFields, gapIds],
  );

  // ── Email pre-fill for person pickers (D-15, D-16, PERS-02, PERS-04) ──────
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

  // ── Tauri user-search wrapper (D-17, PERS-03, T-22-15) ───────────────────
  // Defined inside the component so it closes over sourceBaseUrl, which is
  // required by the search_jira_users_by_domain Rust command. The module-level
  // version was missing this argument, causing the "missing required key baseUrl"
  // runtime error.
  const searchUsersForPicker = useCallback(
    async (q: string): Promise<JiraUser[]> => {
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
        const users = await invoke<JiraUser[]>('search_jira_users_by_domain', {
          baseUrl: sourceBaseUrl,
          domain,
        });
        return Array.isArray(users) ? users : [];
      } catch (e) {
        console.error('[CopyPreviewPage] search_jira_users_by_domain failed:', e);
        return [];
      }
    },
    [sourceBaseUrl],
  );

  // ── Copy gating (OVRD-04) ─────────────────────────────────────────────────
  // A gap field gates the copy only while its override value is empty.
  // Once the user fills in the gap input (writing to overrideValues), the
  // gate opens — the entered value flows to the backend via copyStore.confirmCopy.
  const isCopying = phase === 'copying';
  const isLoading = phase === 'loading_preview';
  const isProjectMissing = !targetProjectKey;
  const isIssueTypeMissing = !targetIssueTypeId;
  const isGated = unfilledGapFields.length > 0;
  // Mirror CopyPreviewModal: gate on missing issue type so the backend confirmCopy guard
  // never fires silently with null targetIssueTypeId (D-11 parity).
  const isCopyDisabled =
    isCopying || isLoading || isProjectMissing || isIssueTypeMissing || isGated;

  const renderedDescription = sourceTicket?.renderedFields?.description ?? null;
  const progressPercent = getProgressPercent(progressStep);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDiscard = () => {
    reset();
  };

  const handleConfirm = () => {
    confirmCopy(sourceBaseUrl, cloudBaseUrl, previewCopyId);
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
            {(isGated || isIssueTypeMissing) && (
              <TooltipContent>
                {isGated
                  ? t('copy.preview.missingFields', {
                      fields: unfilledGapFields.map((g) => g.name).join(', '),
                    })
                  : t('copy.preview.issueTypePlaceholder')}
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
              <PriorityIcon priority={sourceTicket.fields.priority?.name ?? ''} size="sm" />
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
                onChange={(id) => {
                  void setTargetIssueTypeId(id);
                }}
                loading={isSchemaLoading}
              />
            )}

            {/* Summary (D-01, D-02) */}
            <div className="mb-4">
              <label htmlFor="copy-target-summary" className="text-xs text-brand-muted block mb-1">
                Summary{' '}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
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

            {/* Description — read-only (Phase 25, D-01: ADF editor deferred post-v0.4.0) */}
            {overrideValues.description !== undefined && renderedDescription && (
              <div className="mb-4">
                <span className="text-xs text-brand-muted block mb-1">
                  {t('copy.preview.descriptionReadOnly', 'Description (will be copied)')}
                </span>
                <div className="rounded border border-brand-border bg-brand-bg p-3 text-sm opacity-75 pointer-events-none overflow-hidden max-h-40">
                  <DescriptionRenderer
                    description={sourceTicket?.fields.description}
                    renderedHtml={renderedDescription ?? undefined}
                    baseUrl={sourceBaseUrl}
                  />
                </div>
                <p className="text-xs text-brand-muted mt-1">
                  {t(
                    'copy.preview.descriptionReadOnlyHint',
                    'Resolved description will be copied as formatted content.',
                  )}
                </p>
              </div>
            )}

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
