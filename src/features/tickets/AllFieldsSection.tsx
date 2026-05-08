/**
 * AllFieldsSection — shared dynamic field display component (260429-ev2).
 *
 * Used by both OverviewTab (non-compact grid) and CopyPreviewModal source column (compact stack).
 * Joins raw fields from JiraTicketDetail with FieldSchema[] from the source schema cache,
 * filters noise, and renders each row using renderSourceFieldValue.
 */

import { useEffect, useRef } from 'react';
import { renderSourceFieldValue } from '@/features/field-renderers/sourceValueDisplay';
import { schemaCacheKey, useSchemaCacheStore } from '@/stores/schemaCacheStore';
import type { FieldSchema } from '@/types/fieldSchema';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AllFieldsSectionProps {
  /** Raw fields object from JiraTicketDetail.fields cast to Record<string, unknown>. */
  fields: Record<string, unknown>;
  /** Compact mode for narrow columns (copy-modal source column). */
  compact?: boolean;
  /** List of fieldIds to skip (bespoke layouts handle these separately). */
  skip?: string[];
  /** Optional baseUrl passthrough for renderers that need it. */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a Jira fieldId to a human-readable label when no schema entry is found.
 *   'customfield_10001' → 'Custom field 10001'
 *   'fixVersions'       → 'fix versions'
 *   'aggregateprogress' → 'aggregate progress'
 */
function prettifyKey(k: string): string {
  const m = k.match(/^customfield_(\d+)$/);
  if (m) return `Custom field ${m[1]}`;
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

// Fields that always sort first (required system fields) in a stable order
const PRIORITY_FIELDS = ['summary', 'status', 'priority', 'assignee', 'reporter'];

function sortOrder(entry: {
  schema: FieldSchema | null;
  fieldId: string;
}): [number, number, string] {
  const priorityIdx = PRIORITY_FIELDS.indexOf(entry.fieldId);
  const isSystem = entry.schema !== null && !entry.fieldId.startsWith('customfield_');
  const isCustom = entry.fieldId.startsWith('customfield_');
  // Tier 0: priority fields
  if (priorityIdx !== -1) return [0, priorityIdx, entry.fieldId];
  // Tier 1: other system fields alphabetically
  if (isSystem) return [1, 0, entry.fieldId];
  // Tier 2: custom fields alphabetically
  if (isCustom) return [2, 0, entry.fieldId];
  // Tier 3: any other (synthesized schema for unknown fields)
  return [3, 0, entry.fieldId];
}

function compareSortOrder(
  a: { schema: FieldSchema | null; fieldId: string; label: string },
  b: { schema: FieldSchema | null; fieldId: string; label: string },
): number {
  const [ta, ia, la] = sortOrder(a);
  const [tb, ib, lb] = sortOrder(b);
  if (ta !== tb) return ta - tb;
  if (ia !== ib) return ia - ib;
  return la.localeCompare(lb);
}

// ---------------------------------------------------------------------------
// AllFieldsSection
// ---------------------------------------------------------------------------

export function AllFieldsSection({
  fields,
  compact = false,
  skip,
  baseUrl,
}: AllFieldsSectionProps) {
  const cache = useSchemaCacheStore((s) => s.cache);
  const loadSchema = useSchemaCacheStore((s) => s.loadSchema);

  const key = schemaCacheKey('source', null, null);
  const entry = cache[key];

  // Trigger schema load once on mount if not already in cache.
  // Use a ref to avoid re-fires; check the store synchronously to avoid
  // the effect dependency on `entry` (which would re-fire on every render).
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const currentEntry = useSchemaCacheStore.getState().cache[schemaCacheKey('source', null, null)];
    if (!currentEntry || currentEntry.status === 'error') {
      void loadSchema('source', null, null);
    }
  }, [loadSchema]);

  // Build schema map from cache entry
  const schemaMap = new Map<string, FieldSchema>();
  if (entry?.status === 'success' && Array.isArray(entry.fields)) {
    for (const f of entry.fields as FieldSchema[]) {
      schemaMap.set(f.fieldId, f);
    }
  }

  // Build rows
  const rows: Array<{
    fieldId: string;
    label: string;
    schema: FieldSchema | null;
    node: React.ReactNode;
  }> = [];

  for (const fieldId of Object.keys(fields)) {
    // Apply skip list
    if (skip?.includes(fieldId)) continue;
    // Skip internal Jira fields
    if (fieldId.startsWith('_')) continue;

    const value = fields[fieldId];
    const fieldSchema = schemaMap.get(fieldId) ?? null;

    // Synthesize a schema entry if not found (unknown field → treat as 'any')
    const effectiveSchema: FieldSchema = fieldSchema ?? {
      fieldId,
      name: prettifyKey(fieldId),
      required: false,
      schema: { type: 'any' },
    };

    const node = renderSourceFieldValue(effectiveSchema.schema, value, { fieldId, baseUrl });
    if (node === null) continue;

    rows.push({
      fieldId,
      label: effectiveSchema.name,
      schema: fieldSchema,
      node,
    });
  }

  // Sort rows
  rows.sort(compareSortOrder);

  if (rows.length === 0) return null;

  if (compact) {
    return (
      <div className="space-y-3">
        {rows.map(({ fieldId, label, node }) => (
          <div key={fieldId}>
            <span className="text-xs text-brand-muted block mb-0.5">{label}</span>
            <div className="text-sm text-brand-text">{node}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
      {rows.map(({ fieldId, label, node }) => (
        <div key={fieldId}>
          <div className="text-xs font-semibold text-brand-muted mb-1">{label}</div>
          <div className="text-sm text-brand-text-secondary">{node}</div>
        </div>
      ))}
    </div>
  );
}
