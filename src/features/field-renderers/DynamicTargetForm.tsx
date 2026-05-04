import type { FieldSchema } from '@/types/fieldSchema';
import { getRenderer, isEditableSchemaType } from './registry';
import type { SearchCallbacks } from './types';
import { UnsupportedFieldHint } from './UnsupportedFieldHint';

export interface DynamicTargetFormProps {
  fields: FieldSchema[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, v: unknown) => void;
  searchCallbacks?: SearchCallbacks;
  /** Phase 22 — per-field initial search query (used by user pickers for email pre-fill, D-15). */
  initialQueries?: Record<string, string>;
  onMapLink?: () => void;
  /** Disables all field renderers (e.g. while a copy is in flight). */
  disabled?: boolean;
}

export function DynamicTargetForm({
  fields,
  values,
  onChange,
  searchCallbacks,
  initialQueries,
  onMapLink,
  disabled,
}: DynamicTargetFormProps) {
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
                disabled={disabled}
                onSearch={isUserPicker ? searchCallbacks?.onSearchUsers : undefined}
                initialQuery={initialQueries?.[field.fieldId]}
              />
            ) : (
              <UnsupportedFieldHint
                data-testid={`unsupported-field-${field.fieldId}`}
                onMapLink={onMapLink}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
