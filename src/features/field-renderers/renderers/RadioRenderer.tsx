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

export function RadioRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const allowed = Array.isArray(field.allowedValues) ? field.allowedValues : [];
  const current = typeof value === 'string' ? value : '';
  const labelId = `${field.fieldId}-label`;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-required={required}
      className={cn('flex flex-col gap-1.5')}
    >
      {allowed.map((opt, idx) => {
        const optLabel = getOptionLabel(opt);
        const radioId = `${field.fieldId}-${idx}`;
        return (
          <label
            key={optLabel || String(idx)}
            htmlFor={radioId}
            className="flex items-center gap-2 text-sm"
          >
            <input
              id={radioId}
              type="radio"
              name={field.fieldId}
              value={optLabel}
              checked={current === optLabel}
              disabled={disabled}
              onChange={() => onChange(optLabel)}
              className="h-4 w-4 border border-input"
            />
            <span>{optLabel}</span>
          </label>
        );
      })}
    </div>
  );
}
