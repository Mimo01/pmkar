import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { RendererProps } from '../types';

interface OptionRef {
  id?: string;
  value?: string;
  name?: string;
}

function isOption(v: unknown): v is OptionRef {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.value === 'string' || typeof o.name === 'string' || typeof o.id === 'string';
}

function optLabel(o: OptionRef): string {
  return o.value ?? o.name ?? o.id ?? '';
}

function optKey(o: OptionRef): string {
  return o.id ?? o.value ?? o.name ?? '';
}

export function MultiSelectRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const { t } = useTranslation();
  const allItems: OptionRef[] = Array.isArray(field.allowedValues)
    ? (field.allowedValues.filter(isOption) as OptionRef[])
    : [];
  const selected: OptionRef[] = Array.isArray(value) ? (value.filter(isOption) as OptionRef[]) : [];
  const selectedKeys = new Set(selected.map(optKey));
  const remaining = allItems.filter((o) => !selectedKeys.has(optKey(o)));

  function add(o: OptionRef) {
    if (!selectedKeys.has(optKey(o))) onChange([...selected, o]);
  }

  function remove(idx: number) {
    onChange(selected.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((o, idx) => (
            <Badge key={optKey(o) || String(idx)} variant="secondary" className="gap-1.5">
              <span className="truncate max-w-[160px]">{optLabel(o)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(idx)}
                aria-label={t('fieldRenderer.removeItem', {
                  item: optLabel(o),
                  defaultValue: `Remove ${optLabel(o)}`,
                })}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <VirtualizedCombobox<OptionRef>
        items={remaining}
        value={null}
        onChange={add}
        displayLabel={optLabel}
        filterFn={(o, q) => optLabel(o).toLowerCase().includes(q.toLowerCase())}
        placeholder={t('fieldRenderer.placeholder.select')}
        disabled={disabled}
        ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
      />
    </div>
  );
}
