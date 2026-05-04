import { cn } from '@/lib/utils';
import type { RendererProps } from '../types';

interface AllowedValue {
  id?: string;
  value?: string;
  name?: string;
}

function getOptionLabel(opt: unknown): string {
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object') {
    const o = opt as AllowedValue;
    return o.value ?? o.name ?? o.id ?? '';
  }
  return '';
}

export function CheckboxRenderer({ field, value, onChange, disabled }: RendererProps) {
  const allowed = Array.isArray(field.allowedValues) ? field.allowedValues : [];
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const labelId = `${field.fieldId}-label`;

  function toggle(optLabel: string, isOn: boolean) {
    if (isOn) {
      onChange([...selected, optLabel]);
    } else {
      onChange(selected.filter((v) => v !== optLabel));
    }
  }

  return (
    <fieldset aria-labelledby={labelId} className={cn('flex flex-col gap-1.5 border-0 p-0 m-0')}>
      {/* labelId is referenced by the field label rendered by DynamicTargetForm via the same id */}
      {allowed.map((opt, idx) => {
        const optLabel = getOptionLabel(opt);
        const checkboxId = `${field.fieldId}-${idx}`;
        const checked = selected.includes(optLabel);
        return (
          <label
            key={optLabel || String(idx)}
            htmlFor={checkboxId}
            className="flex items-center gap-2 text-sm"
          >
            <input
              id={checkboxId}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => toggle(optLabel, e.target.checked)}
              className="h-4 w-4 rounded border border-input"
            />
            <span>{optLabel}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
