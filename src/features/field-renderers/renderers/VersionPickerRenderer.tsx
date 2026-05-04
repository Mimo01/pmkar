import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { JiraVersion, RendererProps } from '../types';

function isVersion(v: unknown): v is JiraVersion {
  return Boolean(v && typeof v === 'object' && typeof (v as JiraVersion).name === 'string');
}

function versionKey(v: JiraVersion): string {
  return v.id ?? v.name;
}

export function VersionPickerRenderer({
  field,
  value,
  onChange,
  required,
  disabled,
}: RendererProps) {
  const { t } = useTranslation();
  const allItems: JiraVersion[] = Array.isArray(field.allowedValues)
    ? (field.allowedValues.filter(isVersion) as JiraVersion[])
    : [];
  const selected: JiraVersion[] = Array.isArray(value)
    ? (value.filter(isVersion) as JiraVersion[])
    : [];
  const selectedKeys = new Set(selected.map((v, i) => versionKey(v) || `__idx_${i}`));
  const remaining = allItems.filter((v) => !selectedKeys.has(versionKey(v)));

  function add(v: JiraVersion) {
    if (!selectedKeys.has(versionKey(v))) onChange([...selected, v]);
  }
  function remove(idx: number) {
    onChange(selected.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((v, idx) => (
            <Badge key={versionKey(v) || String(idx)} variant="secondary" className="gap-1.5">
              <span className="truncate max-w-[160px]">{v.name}</span>
              {v.archived && <span className="text-xs text-muted-foreground">(archived)</span>}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(idx)}
                aria-label={t('fieldRenderer.removeItem', {
                  item: v.name,
                  defaultValue: `Remove ${v.name}`,
                })}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <VirtualizedCombobox<JiraVersion>
        id={field.fieldId}
        items={remaining}
        value={null}
        onChange={add}
        displayLabel={(v) => v.name}
        filterFn={(v, q) => v.name.toLowerCase().includes(q.toLowerCase())}
        placeholder={t('fieldRenderer.placeholder.select')}
        disabled={disabled}
        ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
      />
    </div>
  );
}
