import { cn } from '@/lib/utils';
import type { RendererProps } from '../types';

export function UrlRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const strValue = typeof value === 'string' ? value : '';
  return (
    <input
      id={field.fieldId}
      type="url"
      inputMode="url"
      // HTML5 hint only — no blocking validation in Phase 20 (UI-SPEC: Component Inventory > UrlRenderer)
      pattern="https?://.*"
      value={strValue}
      onChange={(e) => onChange(e.target.value)}
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
