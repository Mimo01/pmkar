// Phase 27 — smart static value widget. Dispatch table in 27-UI-SPEC.md. Single-option stores pre-serialized JSON write-shape (pipeline passes through); array types store raw comma-separated text (pipeline splits per 27-CONTEXT.md D-06).

import { useTranslation } from 'react-i18next';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import type { FieldSchema } from '@/types/fieldSchema';

export interface StaticValueWidgetProps {
  field: FieldSchema;
  value: string | undefined;
  onChange: (newValue: string) => void;
}

interface AllowedValueItem {
  id: string;
  value: string;
}

export function StaticValueWidget({ field, value, onChange }: StaticValueWidgetProps) {
  const { t } = useTranslation();
  const schema = field.schema;

  // ── Option / single-select — stores pre-serialized JSON write-shape per RESEARCH.md ──
  if (schema.type === 'option' || schema.type === 'option-with-child') {
    const items = (field.allowedValues ?? []) as AllowedValueItem[];

    // Parse the existing value (if any) to find the currently-selected item.
    // Stored as JSON write-shape: {"id":"10001"}. Legacy bare-id values fall back to null.
    let selectedId: string | null = null;
    if (value) {
      try {
        const parsed = JSON.parse(value) as { id?: string };
        selectedId = parsed.id ?? null;
      } catch {
        // Legacy bare-id fallback: value might be a bare id string like "10001"
        selectedId = null;
      }
    }
    const selectedItem =
      selectedId !== null ? (items.find((i) => i.id === selectedId) ?? null) : null;

    return (
      <div className="[&_button]:min-h-9">
        <VirtualizedCombobox<AllowedValueItem>
          items={items}
          value={selectedItem}
          onChange={(opt) => onChange(JSON.stringify({ id: opt.id }))}
          displayLabel={(o) => o.value}
          filterFn={(o, q) => o.value.toLowerCase().includes(q.toLowerCase())}
          placeholder={t('settings.fieldMapping.staticOptionPlaceholder')}
          ariaLabel={`${field.name} static value`}
        />
      </div>
    );
  }

  // ── Array — comma-separated text input (pipeline splits on copy) ──
  if (schema.type === 'array') {
    // User arrays are unsupported — render disabled input
    if ('items' in schema && schema.items === 'user') {
      return (
        <input
          type="text"
          className="min-h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          placeholder={t('settings.fieldMapping.staticUnsupported')}
          disabled
          aria-label={`${field.name} static value`}
        />
      );
    }

    // Choose placeholder by item kind
    const placeholder =
      'items' in schema && schema.items === 'option'
        ? t('settings.fieldMapping.staticOptionArrayPlaceholder')
        : t('settings.fieldMapping.staticValuePlaceholder');

    return (
      <div>
        <input
          type="text"
          className="min-h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={`${field.name} static value`}
        />
        <span className="text-xs text-brand-muted block mt-1">
          {t('settings.fieldMapping.staticMultiHint')}
        </span>
      </div>
    );
  }

  // ── User or priority — disabled placeholder (not supported) ──
  if (schema.type === 'user' || schema.type === 'priority') {
    return (
      <input
        type="text"
        className="min-h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        placeholder={t('settings.fieldMapping.staticUnsupported')}
        disabled
        aria-label={`${field.name} static value`}
      />
    );
  }

  // ── Default: plain text input for string, number, date, datetime, any, unknown ──
  return (
    <input
      type="text"
      className="min-h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('settings.fieldMapping.staticValuePlaceholder')}
      aria-label={`${field.name} static value`}
    />
  );
}
