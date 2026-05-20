// Phase 27 — static mapping row. See 27-UI-SPEC.md for layout and 27-CONTEXT.md for the sentinel sourceFieldId pattern.

import { invoke } from '@tauri-apps/api/core';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import type { FieldSchema } from '@/types/fieldSchema';
import { StaticValueWidget } from './StaticValueWidget';
import type { FieldMappingRow } from './types';

export interface StaticMappingRowProps {
  row: FieldMappingRow;
  targetFields: FieldSchema[];
  usedTargetFieldIds: Set<string>;
  onRowUpdate: (row: FieldMappingRow) => void;
  onRowDelete: (sourceFieldId: string) => void;
}

export function StaticMappingRow({
  row,
  targetFields,
  usedTargetFieldIds,
  onRowUpdate,
  onRowDelete,
}: StaticMappingRowProps) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<'saved' | null>(null);

  const targetField = targetFields.find((f) => f.fieldId === row.targetFieldId) ?? null;

  const availableTargetFields = targetFields.filter(
    (f) => !usedTargetFieldIds.has(f.fieldId) || f.fieldId === row.targetFieldId,
  );

  async function handleTargetChange(newTarget: FieldSchema) {
    const sentinelId = `__static__${newTarget.fieldId}`;
    const updated: FieldMappingRow = {
      sourceFieldId: sentinelId,
      targetFieldId: newTarget.fieldId,
      transformerKind: 'static',
      sourceSchema: { type: 'any' },
      targetSchema: newTarget.schema,
      staticValue: undefined,
    };
    try {
      await invoke('set_field_mapping', { row: updated });
      onRowUpdate(updated);
    } catch {
      toast.error(t('settings.fieldMapping.saveError'));
    }
  }

  async function handleValueChange(newValue: string) {
    const updated: FieldMappingRow = { ...row, staticValue: newValue };
    try {
      await invoke('set_field_mapping', { row: updated });
      onRowUpdate(updated);
      setFeedback('saved');
      setTimeout(() => setFeedback(null), 1500);
    } catch {
      toast.error(t('settings.fieldMapping.saveError'));
    }
  }

  async function handleDelete() {
    try {
      await invoke('delete_field_mapping', { sourceFieldId: row.sourceFieldId });
      onRowDelete(row.sourceFieldId);
    } catch {
      toast.error(t('settings.fieldMapping.deleteError'));
    }
  }

  return (
    <div className="grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 items-center min-h-[40px] py-2 border-b border-brand-border last:border-0">
      {/* Col 1: Static badge */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="img"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold text-brand bg-brand/10 border border-brand/30 cursor-default"
              aria-label="Static mapping — no source field"
            >
              {t('settings.fieldMapping.staticBadge')}
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('settings.fieldMapping.staticBadgeTooltip')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Col 2: Target combobox */}
      <div className="[&_button]:min-h-9">
        <VirtualizedCombobox<FieldSchema>
          items={availableTargetFields}
          value={targetField}
          onChange={handleTargetChange}
          displayLabel={(f) => f.name}
          filterFn={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
          placeholder={t('settings.fieldMapping.staticTargetPlaceholder')}
          ariaLabel="Static mapping target"
          renderItem={(f) => (
            <span className="flex items-center justify-between w-full">
              <span className="truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{f.schema.type}</span>
            </span>
          )}
        />
      </div>

      {/* Col 3: Value widget */}
      {targetField ? (
        <StaticValueWidget
          field={targetField}
          value={row.staticValue}
          onChange={handleValueChange}
        />
      ) : (
        <span className="text-brand-muted">—</span>
      )}

      {/* Col 4: Saved indicator + delete button */}
      <div className="flex items-center justify-end gap-1">
        {feedback === 'saved' && (
          <span aria-live="polite" className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('settings.fieldMapping.saved')}</span>
          </span>
        )}
        <button
          type="button"
          onClick={handleDelete}
          aria-label={t('settings.fieldMapping.deleteStaticAriaLabel', {
            field: targetField?.name ?? row.targetFieldId,
          })}
          className="flex items-center justify-center h-9 w-9 rounded hover:bg-brand-surface-hover text-brand-muted hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
