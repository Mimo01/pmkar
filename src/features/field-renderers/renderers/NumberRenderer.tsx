import { cn } from '@/lib/utils';
import type { RendererProps } from '../types';

export function NumberRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const strValue =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'string'
        ? value
        : '';
  return (
    <input
      id={field.fieldId}
      type="number"
      step="any"
      value={strValue}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        // If parse fails (NaN), pass the raw string upward — Phase 22 validates
        onChange(Number.isFinite(parsed) ? parsed : raw);
      }}
      disabled={disabled}
      aria-required={required}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:opacity-50 disabled:pointer-events-none',
      )}
    />
  );
}
