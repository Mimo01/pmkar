import { invoke } from '@tauri-apps/api/core';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { FieldSchema, FieldSchemaType } from '@/types/fieldSchema';
import { getTransformerOptions } from './transformerOptions';
import type { FieldMappingRow } from './types';

/** A heuristic suggestion: an unmapped source field paired with a recommended target field. */
export interface Suggestion {
  sourceFieldId: string;
  sourceName: string;
  sourceSchema: FieldSchemaType;
  target: FieldSchema;
}

export interface SuggestionsPanelProps {
  suggestions: Suggestion[];
  onAccept: (sourceFieldId: string, target: FieldSchema) => void;
  onDismiss: (sourceFieldId: string) => void;
}

/**
 * Collapsible panel of unmapped source fields with heuristic-matched target suggestions.
 * Per CONTEXT.md D-05/D-06/D-07/D-08: collapsible above the mapping table; Accept calls
 * set_field_mapping; Dismiss persists with empty-string targetFieldId sentinel.
 */
export function SuggestionsPanel({ suggestions, onAccept, onDismiss }: SuggestionsPanelProps) {
  const { t } = useTranslation();

  if (suggestions.length === 0) return null;

  async function handleAccept(s: Suggestion) {
    const row: FieldMappingRow = {
      sourceFieldId: s.sourceFieldId,
      targetFieldId: s.target.fieldId,
      transformerKind:
        getTransformerOptions(s.target.schema, t, s.sourceSchema)[0]?.value ?? 'identity',
      sourceSchema: s.sourceSchema,
      targetSchema: s.target.schema,
    };
    try {
      await invoke('set_field_mapping', { row });
      onAccept(s.sourceFieldId, s.target);
    } catch {
      toast.error(t('settings.fieldMapping.saveError'));
    }
  }

  async function handleDismiss(s: Suggestion) {
    // D-07: empty string sentinel persists dismissal in mapping.db
    const row: FieldMappingRow = {
      sourceFieldId: s.sourceFieldId,
      targetFieldId: '',
      transformerKind: 'identity',
      sourceSchema: s.sourceSchema,
      targetSchema: { type: 'any' },
    };
    try {
      await invoke('set_field_mapping', { row });
      onDismiss(s.sourceFieldId);
    } catch {
      toast.error(t('settings.fieldMapping.saveError'));
    }
  }

  return (
    <details
      open
      data-testid="suggestions-panel"
      className="mb-4 rounded-lg border border-brand-border bg-brand-surface-hover p-3"
    >
      <summary className="flex items-center gap-1.5 cursor-pointer list-none text-sm font-medium text-brand-text select-none">
        <ChevronRight
          className="h-4 w-4 transition-transform [details[open]_&]:rotate-90"
          aria-hidden="true"
        />
        {t('settings.fieldMapping.suggestions', { count: suggestions.length })}
      </summary>
      <div className="mt-2 divide-y divide-brand-border">
        {suggestions.map((s) => (
          <div key={s.sourceFieldId} className="flex items-center gap-2 py-1.5 text-sm">
            <div className="min-w-0">
              <span className="block truncate text-brand-text" title={s.sourceName}>
                {s.sourceName}
              </span>
              <span className="block text-[11px] text-brand-muted truncate" title={s.sourceFieldId}>
                {s.sourceFieldId}
              </span>
            </div>
            <span className="text-brand-muted px-1" aria-hidden="true">
              →
            </span>
            <span className="truncate text-brand-text" title={s.target.name}>
              {s.target.name}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleAccept(s)}
                className="h-7 px-2 text-xs text-brand"
                aria-label={`${t('settings.fieldMapping.accept')} ${s.sourceFieldId}`}
              >
                {t('settings.fieldMapping.accept')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleDismiss(s)}
                className="h-7 px-2 text-xs text-brand-muted hover:text-destructive"
                aria-label={`${t('settings.fieldMapping.dismiss')} ${s.sourceFieldId}`}
              >
                {t('settings.fieldMapping.dismiss')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
