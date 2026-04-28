import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getRenderer, isEditableSchemaType } from '@/features/field-renderers/registry';
import type { FieldSchema, FieldSchemaType } from '@/types/fieldSchema';
import type { JiraUser } from './types';

export interface GapsSectionProps {
  gapFields: FieldSchema[];
  overrideValues: Record<string, unknown>;
  onOverrideChange: (fieldId: string, value: unknown) => void;
  onMapLink: () => void;
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
}

function isUserSchema(s: FieldSchemaType): boolean {
  if (s.type === 'user') return true;
  if (s.type === 'array' && s.items === 'user') return true;
  return false;
}

interface GapRowProps {
  field: FieldSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  onMapLink: () => void;
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
}

function GapRow({ field, value, onChange, onMapLink, onSearchUsers }: GapRowProps) {
  const { t } = useTranslation();
  const Renderer = getRenderer(field.schema);
  const isUser = isUserSchema(field.schema);
  const isEditable = isEditableSchemaType(field.schema);

  return (
    <div
      className="flex items-start gap-2 px-3 py-2"
      data-testid={`gap-row-${field.fieldId}`}
    >
      <label
        htmlFor={isEditable ? `gap-input-${field.fieldId}` : undefined}
        className="text-sm text-brand-text min-w-[110px] shrink-0 pt-1.5"
      >
        {field.name}
        <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
      </label>
      {isEditable ? (
        <div className="flex-1 [&_button]:min-h-9">
          <Renderer
            field={field}
            value={value}
            onChange={onChange}
            required={true}
            onSearch={isUser ? onSearchUsers : undefined}
          />
        </div>
      ) : (
        <div
          className="flex-1 flex items-center rounded border border-border/60 bg-muted/40 px-3 h-9"
          data-testid={`gap-unsupported-${field.fieldId}`}
          aria-disabled="true"
        >
          <span className="text-xs text-muted-foreground">
            {t('copy.preview.fieldNoManualInput')}
          </span>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onMapLink}
        className="text-xs h-9 gap-1 shrink-0 whitespace-nowrap"
        data-testid={`gap-map-link-${field.fieldId}`}
      >
        <ExternalLink className="w-3 h-3" aria-hidden="true" />
        {t('copy.preview.mapLink')}
      </Button>
    </div>
  );
}

/**
 * Phase 22 — Required-but-unmapped fields panel (D-07, D-08, D-09).
 */
export function GapsSection({
  gapFields,
  overrideValues,
  onOverrideChange,
  onMapLink,
  onSearchUsers,
}: GapsSectionProps) {
  const { t } = useTranslation();

  if (gapFields.length === 0) return null;

  return (
    <section
      role="region"
      aria-label={t('copy.preview.gapsHeader')}
      className="mb-4 rounded border-l-2 border-amber-500 bg-amber-500/5 p-3"
      data-testid="gaps-section"
    >
      <div className="flex items-center gap-1.5 mb-2 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="text-[13px] font-medium">
          {t('copy.preview.gapsHeader')}
        </span>
      </div>
      <div className="divide-y divide-amber-200/60 dark:divide-amber-800/60">
        {gapFields.map((field) => (
          <GapRow
            key={field.fieldId}
            field={field}
            value={overrideValues[field.fieldId]}
            onChange={(v) => onOverrideChange(field.fieldId, v)}
            onMapLink={onMapLink}
            onSearchUsers={onSearchUsers}
          />
        ))}
      </div>
    </section>
  );
}
