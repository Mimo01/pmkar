import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FieldSchema } from '@/types/fieldSchema';
import { getRenderer, isEditableSchemaType } from './registry';
import type { SearchCallbacks } from './types';

export interface DynamicTargetFormProps {
  fields: FieldSchema[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, v: unknown) => void;
  searchCallbacks?: SearchCallbacks;
  /** Phase 22 — per-field initial search query (used by user pickers for email pre-fill, D-15). */
  initialQueries?: Record<string, string>;
}

export function DynamicTargetForm({
  fields,
  values,
  onChange,
  searchCallbacks,
  initialQueries,
}: DynamicTargetFormProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      {fields.map((field) => {
        const Renderer = getRenderer(field.schema);
        const labelId = `${field.fieldId}-label`;
        const isEditable = isEditableSchemaType(field.schema);
        // Route onSearchUsers only to user/multi-user pickers (D-05)
        const isUserPicker =
          field.schema.type === 'user' ||
          (field.schema.type === 'array' && field.schema.items === 'user');
        return (
          <div key={field.fieldId} className="flex flex-col gap-1.5">
            <label
              id={labelId}
              htmlFor={field.fieldId}
              className="text-xs font-medium text-foreground"
            >
              {field.name}
              {field.required && (
                <span className="text-destructive font-semibold ml-0.5" aria-hidden="true">
                  {' *'}
                </span>
              )}
            </label>
            {isEditable ? (
              <Renderer
                field={field}
                value={values[field.fieldId]}
                onChange={(v) => onChange(field.fieldId, v)}
                required={field.required}
                onSearch={isUserPicker ? searchCallbacks?.onSearchUsers : undefined}
                initialQuery={initialQueries?.[field.fieldId]}
              />
            ) : (
              <div
                className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5"
                data-testid={`unsupported-field-${field.fieldId}`}
              >
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('copy.preview.unsupportedFieldHint')}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
