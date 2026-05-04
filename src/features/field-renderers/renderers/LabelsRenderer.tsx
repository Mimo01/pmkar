import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { RendererProps } from '../types';

export function LabelsRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const { t } = useTranslation();
  const allItems: string[] = Array.isArray(field.allowedValues)
    ? field.allowedValues.filter((v): v is string => typeof v === 'string')
    : [];
  const selected: string[] = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
  const selectedSet = new Set(selected);
  const remaining = allItems.filter((s) => !selectedSet.has(s));
  const [pending, setPending] = useState('');

  function add(label: string) {
    const trimmed = label.trim();
    if (!trimmed || selectedSet.has(trimmed)) return;
    onChange([...selected, trimmed]);
  }

  function remove(idx: number) {
    onChange(selected.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((label, idx) => (
            <Badge key={label || String(idx)} variant="outline" className="gap-1.5">
              <span className="truncate max-w-[160px]">{label}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(idx)}
                aria-label={t('fieldRenderer.removeItem', {
                  item: label,
                  defaultValue: `Remove ${label}`,
                })}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={pending}
          disabled={disabled}
          aria-label={`${field.name} new label`}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pending.trim()) {
              e.preventDefault();
              add(pending);
              setPending('');
            }
          }}
          placeholder={t('fieldRenderer.placeholder.select')}
          className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {remaining.length > 0 && (
        <VirtualizedCombobox<string>
          items={remaining}
          value={null}
          onChange={(s) => add(s)}
          displayLabel={(s) => s}
          filterFn={(s, q) => s.toLowerCase().includes(q.toLowerCase())}
          placeholder={t('fieldRenderer.placeholder.select')}
          disabled={disabled}
          ariaLabel={`${field.name}${required ? ' (required)' : ''} suggestions`}
        />
      )}
    </div>
  );
}
