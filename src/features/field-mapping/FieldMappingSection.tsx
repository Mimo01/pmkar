import { invoke } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { HelpCircle, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchemaCacheStore, schemaCacheKey } from '@/stores/schemaCacheStore';
import { useConnectionStore } from '@/features/connections/connectionStore';
import type { FieldSchema, FieldSchemaType } from '@/types/fieldSchema';
import type { FieldMappingRow } from './types';
import { MappingRow } from './MappingRow';
import { SuggestionsPanel, type Suggestion } from './SuggestionsPanel';
import { findNameMatchSuggestion } from './heuristics';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';

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
          {refreshing ? t('settings.fieldMapping.refreshing') : t('settings.fieldMapping.refreshSchema')}
        </span>
      </Button>
      <span
        className="text-[13px] text-muted-foreground"
        aria-label={relativeLabel}
      >
        {relativeLabel}
      </span>
    </div>
  );
}

// ─── FieldMappingSection ──────────────────────────────────────────────────────

/**
 * Body content: suggestions panel + column headers + mapping table + add row button.
 * Orchestrates data loading (get_field_mapping + source/target schema), drift detection,
 * and heuristic suggestions via useMemo.
 */
export function FieldMappingSection() {
  const { t } = useTranslation();
  const mappingRows = useMappingEditorStore((s) => s.mappingRows);
  const loading = useMappingEditorStore((s) => s.loading);
  const setMappingRows = useMappingEditorStore((s) => s.setMappingRows);
  const setLoading = useMappingEditorStore((s) => s.setLoading);
  const updateRow = useMappingEditorStore((s) => s.updateRow);
  const deleteRow = useMappingEditorStore((s) => s.deleteRow);
  const setLastRefreshed = useMappingEditorStore((s) => s.setLastRefreshed);

  const loadSchema = useSchemaCacheStore((s) => s.loadSchema);
  const preWarm = useSchemaCacheStore((s) => s.preWarm);
  const { sourceFields, targetFields, targetProjectKey, firstIssueTypeId } = useSchemaArrays();

  const [pendingAdd, setPendingAdd] = useState(false);

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
          const issueTypeId = useSchemaCacheStore.getState().prewarmedIssueTypes[targetProjectKey]?.[0]?.id;
          if (issueTypeId) {
            await loadSchema('target', targetProjectKey, issueTypeId);
          }
        }
        setLastRefreshed(Date.now());
      } catch (e) {
        console.error('Failed to load field mapping:', e);
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — intentional

  // ── Drift detection (MAP-05) ───────────────────────────────────────────────
  // Rows whose non-empty targetFieldId is NOT present in the target schema cache are drifted.
  // Rows with targetFieldId='' (dismissed sentinel) are explicitly NOT flagged.
  // Guard: skip drift check when target schema hasn't loaded (avoids false positives).
  const driftedSourceFieldIds = useMemo(() => {
    if (!firstIssueTypeId) return new Set<string>();
    const targetIds = new Set(targetFields.map((f) => f.fieldId));
    return new Set(
      mappingRows
        .filter((r) => r.targetFieldId !== '' && !targetIds.has(r.targetFieldId))
        .map((r) => r.sourceFieldId),
    );
  }, [mappingRows, targetFields, firstIssueTypeId]);

  // ── Heuristic suggestions (EDIT-02) ───────────────────────────────────────
  // Source fields that have NO mapping row (including no dismissed sentinel) with a
  // heuristic name-match against target fields.
  const suggestions = useMemo<Suggestion[]>(() => {
    const mappedSourceIds = new Set(mappingRows.map((r) => r.sourceFieldId));
    const out: Suggestion[] = [];
    for (const sf of sourceFields) {
      if (mappedSourceIds.has(sf.fieldId)) continue;
      const target = findNameMatchSuggestion(sf.fieldId, sf.name, targetFields);
      if (target) {
        out.push({
          sourceFieldId: sf.fieldId,
          sourceName: sf.name,
          sourceSchema: sf.schema,
          target,
        });
      }
    }
    return out;
  }, [mappingRows, sourceFields, targetFields]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleAcceptSuggestion(sourceFieldId: string, target: import('@/types/fieldSchema').FieldSchema) {
    const sf = sourceFields.find((f) => f.fieldId === sourceFieldId);
    const newRow: FieldMappingRow = {
      sourceFieldId,
      targetFieldId: target.fieldId,
      transformerKind: 'identity',
      sourceSchema: sf?.schema ?? ({ type: 'any' } as FieldSchemaType),
      targetSchema: target.schema,
    };
    updateRow(newRow);
  }

  function handleDismissSuggestion(sourceFieldId: string) {
    const sf = sourceFields.find((f) => f.fieldId === sourceFieldId);
    const dismissedRow: FieldMappingRow = {
      sourceFieldId,
      targetFieldId: '',
      transformerKind: 'identity',
      sourceSchema: sf?.schema ?? ({ type: 'any' } as FieldSchemaType),
      targetSchema: { type: 'any' } as FieldSchemaType,
    };
    updateRow(dismissedRow);
  }

  function handleAddRow() {
    setPendingAdd(true);
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
      {/* Suggestions panel (above table) */}
      <SuggestionsPanel
        suggestions={suggestions}
        onAccept={handleAcceptSuggestion}
        onDismiss={handleDismissSuggestion}
      />

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
      {mappingRows.length === 0 && !pendingAdd ? (
        <div className="py-8 text-center">
          <p className="text-sm text-brand-text font-medium">{t('settings.fieldMapping.emptyHeading')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('settings.fieldMapping.emptyBody')}</p>
        </div>
      ) : (
        <div>
          {mappingRows.map((row) => (
            <MappingRow
              key={row.sourceFieldId}
              row={row}
              sourceName={sourceFields.find((f) => f.fieldId === row.sourceFieldId)?.name}
              targetFields={targetFields}
              isDrifted={driftedSourceFieldIds.has(row.sourceFieldId)}
              onRowUpdate={updateRow}
              onRowDelete={deleteRow}
            />
          ))}

          {/* Inline pending row: source-field combobox for new mapping */}
          {pendingAdd && (
            <div className="grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 items-center min-h-[40px] py-2 border-b border-brand-border last:border-0">
              <div className="[&_button]:min-h-9">
                <VirtualizedCombobox<FieldSchema>
                  items={sourceFields.filter((sf) => !mappingRows.some((r) => r.sourceFieldId === sf.fieldId))}
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
    </div>
  );
}
