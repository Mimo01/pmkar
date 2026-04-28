import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { JiraComponent, RendererProps } from '../types';

function isComponent(v: unknown): v is JiraComponent {
  return Boolean(v && typeof v === 'object' && typeof (v as JiraComponent).name === 'string');
}

function componentKey(c: JiraComponent): string {
  return c.id ?? c.name;
}

export function ComponentPickerRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const { t } = useTranslation();
  const allItems: JiraComponent[] = Array.isArray(field.allowedValues)
    ? (field.allowedValues.filter(isComponent) as JiraComponent[])
    : [];
  const selected: JiraComponent[] = Array.isArray(value) ? (value.filter(isComponent) as JiraComponent[]) : [];
  const selectedKeys = new Set(selected.map(componentKey));
  const remaining = allItems.filter((c) => !selectedKeys.has(componentKey(c)));

  function add(c: JiraComponent) {
    if (!selectedKeys.has(componentKey(c))) onChange([...selected, c]);
  }
  function remove(idx: number) {
    onChange(selected.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((c, idx) => (
            <Badge key={`${componentKey(c)}-${idx}`} variant="secondary" className="gap-1.5">
              <span className="truncate max-w-[160px]">{c.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(idx)}
                aria-label={t('fieldRenderer.removeItem', { item: c.name, defaultValue: `Remove ${c.name}` })}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <VirtualizedCombobox<JiraComponent>
        items={remaining}
        value={null}
        onChange={add}
        displayLabel={(c) => c.name}
        filterFn={(c, q) => c.name.toLowerCase().includes(q.toLowerCase())}
        placeholder={t('fieldRenderer.placeholder.select')}
        disabled={disabled}
        ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
      />
    </div>
  );
}
