import { useTranslation } from 'react-i18next';
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

export function SingleSelectRenderer({
  field,
  value,
  onChange,
  required,
  disabled,
}: RendererProps) {
  const { t } = useTranslation();
  const items: OptionRef[] = Array.isArray(field.allowedValues)
    ? (field.allowedValues.filter(isOption) as OptionRef[])
    : [];
  const selected = isOption(value) ? (value as OptionRef) : null;

  return (
    <VirtualizedCombobox<OptionRef>
      id={field.fieldId}
      items={items}
      value={selected}
      onChange={(o) => onChange(o)}
      displayLabel={optLabel}
      filterFn={(o, q) => optLabel(o).toLowerCase().includes(q.toLowerCase())}
      placeholder={t('fieldRenderer.placeholder.select')}
      disabled={disabled}
      ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
    />
  );
}
