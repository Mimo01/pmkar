import { cn } from '@/lib/utils';
import type { RendererProps } from '../types';

export function TextAreaRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const strValue = typeof value === 'string' ? value : '';
  return (
    <textarea
      id={field.fieldId}
      value={strValue}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-required={required}
      rows={4}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:opacity-50 disabled:pointer-events-none resize-y',
      )}
    />
  );
}
