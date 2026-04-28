import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import type { FieldSchema } from '@/types/fieldSchema';
import type { FieldMappingRow } from './types';
import { DriftWarning } from './DriftWarning';
import { getTransformerOptions, type TransformerOption } from './transformerOptions';

export interface MappingRowProps {
  row: FieldMappingRow;
  sourceName?: string;
  targetFields: FieldSchema[];
  isDrifted: boolean;
  onRowUpdate: (row: FieldMappingRow) => void;
  onRowDelete: (sourceFieldId: string) => void;
}

export function MappingRow({ row, sourceName, targetFields, isDrifted, onRowUpdate, onRowDelete }: MappingRowProps) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState<'saved' | null>(null);

  // Resolve current target FieldSchema from cache (null if drifted or empty sentinel)
  const targetField =
    row.targetFieldId === '' ? null : targetFields.find((f) => f.fieldId === row.targetFieldId) ?? null;

  // Transformer combobox items derived from current target schema (Pitfall 3 — Any returns all)
  const transformerItems = getTransformerOptions(row.targetSchema, t);
  const currentTransformer: TransformerOption | null =
    transformerItems.find((o) => o.value === row.transformerKind) ?? null;

  async function handleTargetChange(newTarget: FieldSchema) {
    const updated: FieldMappingRow = {
      sourceFieldId: row.sourceFieldId,
      targetFieldId: newTarget.fieldId,
      transformerKind: getTransformerOptions(newTarget.schema, t)[0]?.value ?? 'identity',
      sourceSchema: row.sourceSchema,
      targetSchema: newTarget.schema,
    };
    try {
      await invoke('set_field_mapping', { row: updated });
      onRowUpdate(updated);
      setFeedback('saved');
      setTimeout(() => setFeedback(null), 1500);
    } catch {
      toast.error(t('settings.fieldMapping.saveError'));
    }
  }

  async function handleTransformerChange(opt: TransformerOption) {
    const updated: FieldMappingRow = { ...row, transformerKind: opt.value };
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
    <div
      className={cn(
        'grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 items-center min-h-[40px] py-2 border-b border-brand-border last:border-0',
        isDrifted && 'border-l-2 border-l-amber-500 pl-2',
      )}
    >
      <div className="min-w-0">
        <span className="block text-sm text-brand-text truncate" title={sourceName ?? row.sourceFieldId}>
          {sourceName ?? row.sourceFieldId}
        </span>
        {sourceName && (
          <span className="block text-[11px] text-brand-muted truncate" title={row.sourceFieldId}>
            {row.sourceFieldId}
          </span>
        )}
      </div>

      {/* Target column: combobox OR DriftWarning */}
      {isDrifted ? (
        <DriftWarning sourceFieldId={row.sourceFieldId} onRemove={handleDelete} />
      ) : (
        <div className="[&_button]:min-h-9">
          <VirtualizedCombobox<FieldSchema>
            items={targetFields}
            value={targetField}
            onChange={handleTargetChange}
            displayLabel={(f) => f.name}
            filterFn={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
            placeholder={t('settings.fieldMapping.targetPlaceholder')}
            ariaLabel={`${row.sourceFieldId} target`}
            renderItem={(f) => (
              <span className="flex items-center justify-between w-full">
                <span className="truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{f.schema.type}</span>
              </span>
            )}
          />
        </div>
      )}

      {/* Transformer column */}
      <div className="[&_button]:min-h-9">
        <VirtualizedCombobox<TransformerOption>
          items={transformerItems}
          value={currentTransformer}
          onChange={handleTransformerChange}
          displayLabel={(o) => o.label}
          filterFn={(o, q) => o.label.toLowerCase().includes(q.toLowerCase())}
          placeholder={t('settings.fieldMapping.transformerPlaceholder')}
          ariaLabel={`${row.sourceFieldId} transformer`}
          align="end"
          itemHeight={52}
          renderItem={(o) => (
            <div className="py-0.5">
              <span className="text-sm">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.description}</span>
            </div>
          )}
        />
      </div>

      {/* Delete column + inline saved indicator */}
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
          aria-label={t('settings.fieldMapping.deleteAriaLabel', { field: row.sourceFieldId })}
          className="flex items-center justify-center h-9 w-9 rounded hover:bg-brand-surface-hover text-brand-muted hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
