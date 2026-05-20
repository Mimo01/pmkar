import { invoke } from '@tauri-apps/api/core';
import { HelpCircle, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConnectionStore } from '@/features/connections/connectionStore';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import { schemaCacheKey, useSchemaCacheStore } from '@/stores/schemaCacheStore';
import type { FieldSchema, FieldSchemaType } from '@/types/fieldSchema';
import { MappingRow } from './MappingRow';
import { StaticMappingRow } from './StaticMappingRow';
import type { FieldMappingRow } from './types';

// ─── Module-scoped Zustand store ──────────────────────────────────────────────
// Both FieldMappingSection (body) and FieldMappingSectionHeader (header) share
// this state so they can coordinate without prop-drilling across renderContent.

interface MappingEditorState {
  mappingRows: FieldMappingRow[];
  loading: boolean;
  refreshing: boolean;
  lastRefreshed: number | null;
  setMappingRows: (rows: FieldMappingRow[]) => void;
  updateRow: (row: FieldMappingRow) => void;
  deleteRow: (sourceFieldId: string) => void;
  setLoading: (b: boolean) => void;
  setRefreshing: (b: boolean) => void;
  setLastRefreshed: (n: number | null) => void;
}

/** Module-scoped Zustand store; FieldMappingSection and FieldMappingSectionHeader share this state. */
export const useMappingEditorStore = create<MappingEditorState>((set, get) => ({
  mappingRows: [],
  loading: false,
  refreshing: false,
  lastRefreshed: null,
  setMappingRows: (mappingRows) => set({ mappingRows }),
  updateRow: (row) => {
    const idx = get().mappingRows.findIndex((r) => r.sourceFieldId === row.sourceFieldId);
    const next =
      idx === -1
        ? [...get().mappingRows, row]
        : get().mappingRows.map((r, i) => (i === idx ? row : r));
    set({ mappingRows: next });
  },
  deleteRow: (sourceFieldId) =>
    set({ mappingRows: get().mappingRows.filter((r) => r.sourceFieldId !== sourceFieldId) }),
  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),
  setLastRefreshed: (lastRefreshed) => set({ lastRefreshed }),
}));

// ─── Selector helpers ─────────────────────────────────────────────────────────

/** Derives source / target FieldSchema arrays from the global schema cache. */
function useSchemaArrays() {
  const cache = useSchemaCacheStore((s) => s.cache);
  const prewarmed = useSchemaCacheStore((s) => s.prewarmedIssueTypes);
  const targetProjectKey = useConnectionStore((s) => s.targetProjectKey);

  const firstIssueTypeId = useMemo(() => {
    const list = prewarmed[targetProjectKey ?? ''] ?? [];
    return list[0]?.id ?? null;
  }, [prewarmed, targetProjectKey]);

  const sourceFields = useMemo(() => {
    const key = schemaCacheKey('source', null, null);
    return cache[key]?.fields ?? [];
  }, [cache]);

  const targetFields = useMemo(() => {
    if (!targetProjectKey || !firstIssueTypeId) return [];
    const key = schemaCacheKey('target', targetProjectKey, firstIssueTypeId);
    return cache[key]?.fields ?? [];
  }, [cache, targetProjectKey, firstIssueTypeId]);

  return { sourceFields, targetFields, targetProjectKey, firstIssueTypeId };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a timestamp as relative copy ("just now" / "Xm ago" / "Not yet refreshed"). */
function formatRelative(
  ts: number | null,
  t: (k: string, p?: Record<string, unknown>) => string,
): string {
  if (ts === null) return t('settings.fieldMapping.lastRefreshedNever');
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return t('settings.fieldMapping.lastRefreshedNow');
  return t('settings.fieldMapping.lastRefreshed', { time: `${minutes}m` });
}

// ─── FieldMappingSectionHeader ────────────────────────────────────────────────

/**
 * Right-aligned section-header content: Refresh button + Last refreshed timestamp.
 * Passed to SectionCard.headerAction in SettingsPage renderContent case 'field-mapping'.
 */
export function FieldMappingSectionHeader() {
  const { t } = useTranslation();
  const refreshing = useMappingEditorStore((s) => s.refreshing);
  const lastRefreshed = useMappingEditorStore((s) => s.lastRefreshed);
  const setRefreshing = useMappingEditorStore((s) => s.setRefreshing);
  const setLastRefreshed = useMappingEditorStore((s) => s.setLastRefreshed);

  const refreshSchema = useSchemaCacheStore((s) => s.refresh);
  const loadSchema = useSchemaCacheStore((s) => s.loadSchema);
  const { targetProjectKey, firstIssueTypeId } = useSchemaArrays();

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshSchema('source', null, null);
      if (targetProjectKey && firstIssueTypeId) {
        await refreshSchema('target', targetProjectKey, firstIssueTypeId);
      }
      await loadSchema('source', null, null);
      if (targetProjectKey && firstIssueTypeId) {
        await loadSchema('target', targetProjectKey, firstIssueTypeId);
      }
      setLastRefreshed(Date.now());
    } catch {
      toast.error(t('settings.fieldMapping.refreshError'));
    } finally {
      setRefreshing(false);
    }
  }

  const relativeLabel = formatRelative(lastRefreshed, t);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={refreshing}
        aria-busy={refreshing}
        aria-label={t('settings.fieldMapping.refreshSchema')}
        data-testid="refresh-schema-btn"
        className="h-7 px-2 gap-1.5"
      >
        {refreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className="text-xs">
          {refreshing
            ? t('settings.fieldMapping.refreshing')
            : t('settings.fieldMapping.refreshSchema')}
        </span>
      </Button>
      <span className="text-[13px] text-muted-foreground">{relativeLabel}</span>
    </div>
  );
}

// ─── FieldMappingSection ──────────────────────────────────────────────────────

/**
 * Body content: column headers + mapping table + add row button.
 * Orchestrates data loading (get_field_mapping + source/target schema) and drift detection.
 */
export function FieldMappingSection() {
  const { t } = useTranslation();
  const mappingRows = useMappingEditorStore((s) => s.mappingRows);
  const loading = useMappingEditorStore((s) => s.loading);
  const setMappingRows = useMappingEditorStore((s) => s.setMappingRows);
  const setLoading = useMappingEditorStore((s) => s.setLoading);
  const updateRow = useMappingEditorStore((s) => s.updateRow);
  const deleteRow = useMappingEditorStore((s) => s.deleteRow);

  const loadSchema = useSchemaCacheStore((s) => s.loadSchema);
  const preWarm = useSchemaCacheStore((s) => s.preWarm);
  const { sourceFields, targetFields, targetProjectKey, firstIssueTypeId } = useSchemaArrays();

  const [pendingAdd, setPendingAdd] = useState(false);
  const [pendingStaticAdd, setPendingStaticAdd] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ── Initial load (mount only) ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rows = await invoke<FieldMappingRow[]>('get_field_mapping');
        setMappingRows(Array.isArray(rows) ? rows : []);
        await loadSchema('source', null, null);
        if (targetProjectKey) {
          // Populate issue types if not yet prewarmed (e.g. direct navigation to settings).
          if (!useSchemaCacheStore.getState().prewarmedIssueTypes[targetProjectKey]?.length) {
            await preWarm(targetProjectKey);
          }
          const issueTypeId =
            useSchemaCacheStore.getState().prewarmedIssueTypes[targetProjectKey]?.[0]?.id;
          if (issueTypeId) {
            await loadSchema('target', targetProjectKey, issueTypeId);
          }
        }
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    void load();
    // Re-runs on mount and when targetProjectKey changes (store hydration or user selection).
    // Stable Zustand setter refs (loadSchema, preWarm, setLoading, setMappingRows) are stable
    // references that never change identity, so listing them does not cause extra re-runs.
  }, [targetProjectKey, loadSchema, preWarm, setLoading, setMappingRows]);

  // ── Synthetic fields for StaticMappingRow target list ────────────────────
  // issuetype and priority are not returned by createmeta (or may be excluded) but are
  // valid static-only targets. Appended only when not already present (defensive dedup).
  const targetFieldsForStatic = useMemo<typeof targetFields>(() => {
    if (targetFields.length === 0) return targetFields;
    let result = targetFields;
    if (!result.some((f) => f.fieldId === 'issuetype')) {
      result = [
        ...result,
        {
          fieldId: 'issuetype',
          name: t('settings.fieldMapping.issuetypeFieldName'),
          required: true,
          schema: { type: 'issuetype' as const },
        },
      ];
    }
    if (!result.some((f) => f.fieldId === 'priority')) {
      result = [
        ...result,
        {
          fieldId: 'priority',
          name: t('settings.fieldMapping.priorityFieldName'),
          required: false,
          schema: { type: 'priority' as const },
        },
      ];
    }
    return result;
  }, [targetFields, t]);

  // ── Drift detection (MAP-05) ───────────────────────────────────────────────
  // Rows whose non-empty targetFieldId is NOT present in the target schema cache are drifted.
  // Rows with targetFieldId='' (dismissed sentinel) are explicitly NOT flagged.
  // Guard: skip drift check when target schema hasn't loaded (avoids false positives).
  // Use targetFieldsForStatic for drift check so a static issuetype mapping is not flagged as drifted.
  const driftedSourceFieldIds = useMemo(() => {
    if (!firstIssueTypeId) return new Set<string>();
    const targetIds = new Set(targetFieldsForStatic.map((f) => f.fieldId));
    return new Set(
      mappingRows
        .filter((r) => r.targetFieldId !== '' && !targetIds.has(r.targetFieldId))
        .map((r) => r.sourceFieldId),
    );
  }, [mappingRows, targetFieldsForStatic, firstIssueTypeId]);

  // ── Used target field IDs (DEDUP-01) ──────────────────────────────────────
  // Set of all target_field_ids currently in use. Excludes empty sentinel ('')
  // so the "no target selected" state does not block any real target selection.
  // Passed to each MappingRow so its target combobox can filter out taken targets
  // while keeping the row's OWN current target visible in the list.
  const usedTargetFieldIds = useMemo(
    () => new Set(mappingRows.map((r) => r.targetFieldId).filter((id) => id !== '')),
    [mappingRows],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAddRow() {
    setPendingAdd(true);
  }

  function handleAddStaticRow() {
    setPendingStaticAdd(true);
  }

  async function handleSelectNewSource(sf: FieldSchema) {
    const newRow: FieldMappingRow = {
      sourceFieldId: sf.fieldId,
      targetFieldId: '',
      transformerKind: 'identity',
      sourceSchema: sf.schema,
      targetSchema: { type: 'any' } as FieldSchemaType,
    };
    try {
      await invoke('set_field_mapping', { row: newRow });
      updateRow(newRow);
      setPendingAdd(false);
    } catch {
      toast.error(t('settings.fieldMapping.saveError'));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <p className="text-sm text-destructive py-4 text-center">
        {t('settings.fieldMapping.loadError')}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Table column headers */}
      <div className="grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 pb-2 mb-2 border-b border-brand-border text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
        <span>{t('settings.fieldMapping.colSource')}</span>
        <span>{t('settings.fieldMapping.colTarget')}</span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-default">
                {t('settings.fieldMapping.colTransformer')}
                <HelpCircle className="h-3 w-3 text-brand-muted/60" aria-hidden="true" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              {t('settings.fieldMapping.colTransformerHelp')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span aria-hidden="true" />
      </div>

      {/* Mapping rows or empty state */}
      {mappingRows.length === 0 && !pendingAdd && !pendingStaticAdd ? (
        <div className="py-8 text-center">
          <p className="text-sm text-brand-text font-medium">
            {t('settings.fieldMapping.emptyHeading')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('settings.fieldMapping.emptyBody')}
          </p>
        </div>
      ) : (
        <div>
          {mappingRows.map((row) =>
            row.sourceFieldId.startsWith('__static__') ? (
              <StaticMappingRow
                key={row.sourceFieldId}
                row={row}
                targetFields={targetFieldsForStatic}
                usedTargetFieldIds={usedTargetFieldIds}
                onRowUpdate={updateRow}
                onRowDelete={deleteRow}
              />
            ) : (
              <MappingRow
                key={row.sourceFieldId}
                row={row}
                sourceName={sourceFields.find((f) => f.fieldId === row.sourceFieldId)?.name}
                targetFields={targetFields}
                usedTargetFieldIds={usedTargetFieldIds}
                isDrifted={driftedSourceFieldIds.has(row.sourceFieldId)}
                onRowUpdate={updateRow}
                onRowDelete={deleteRow}
              />
            ),
          )}

          {/* Inline pending row: source-field combobox for new mapping */}
          {pendingAdd && (
            <div className="grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 items-center min-h-[40px] py-2 border-b border-brand-border last:border-0">
              <div className="[&_button]:min-h-9">
                <VirtualizedCombobox<FieldSchema>
                  items={sourceFields.filter(
                    (sf) => !mappingRows.some((r) => r.sourceFieldId === sf.fieldId),
                  )}
                  value={null}
                  onChange={handleSelectNewSource}
                  displayLabel={(f) => f.name}
                  filterFn={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
                  placeholder={t('settings.fieldMapping.sourcePlaceholder')}
                  ariaLabel="new source field"
                  renderItem={(f) => (
                    <span className="flex items-center justify-between w-full">
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{f.schema.type}</span>
                    </span>
                  )}
                />
              </div>
              <span className="text-sm text-muted-foreground pl-2">—</span>
              <span />
              <button
                type="button"
                onClick={() => setPendingAdd(false)}
                aria-label={t('settings.fieldMapping.cancelAdd')}
                className="flex items-center justify-center h-9 w-9 rounded hover:bg-brand-surface-hover text-brand-muted hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Inline pending static row: target-field combobox for new static mapping */}
          {pendingStaticAdd && (
            <StaticMappingRow
              key="__pending_static__"
              row={{
                sourceFieldId: '__static__',
                targetFieldId: '',
                transformerKind: 'static',
                sourceSchema: { type: 'any' },
                targetSchema: { type: 'any' },
                staticValue: undefined,
              }}
              targetFields={targetFieldsForStatic}
              usedTargetFieldIds={usedTargetFieldIds}
              onRowUpdate={(persisted) => {
                updateRow(persisted);
                setPendingStaticAdd(false);
              }}
              onRowDelete={() => {
                setPendingStaticAdd(false);
              }}
            />
          )}
        </div>
      )}

      {/* Add field mapping button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleAddRow}
        disabled={pendingAdd}
        className="mt-3 w-full justify-start text-brand-muted hover:text-brand-text gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t('settings.fieldMapping.addRow')}</span>
      </Button>

      {/* Add static value button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleAddStaticRow}
        disabled={pendingStaticAdd || pendingAdd}
        className="w-full justify-start text-brand-muted hover:text-brand-text gap-1.5"
        aria-label="Add static value mapping"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t('settings.fieldMapping.addStaticRow')}</span>
      </Button>
    </div>
  );
}
