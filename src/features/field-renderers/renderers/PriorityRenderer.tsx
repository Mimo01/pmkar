import { useTranslation } from 'react-i18next';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { RendererProps } from '../types';

interface PriorityItem {
  id: string;
  name: string;
}

function isPriority(v: unknown): v is PriorityItem {
  return Boolean(v && typeof v === 'object' && 'id' in (v as object));
}

export function PriorityRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const { t } = useTranslation();
  const items: PriorityItem[] = Array.isArray(field.allowedValues)
    ? (field.allowedValues.filter(isPriority) as PriorityItem[])
    : [];
  const selected = isPriority(value) ? value : null;

  return (
    <VirtualizedCombobox<PriorityItem>
      items={items}
      value={selected}
      onChange={(p) => onChange(p)}
      displayLabel={(p) => p.name}
      filterFn={(p, q) => p.name.toLowerCase().includes(q.toLowerCase())}
      placeholder={t('fieldRenderer.placeholder.select')}
      disabled={disabled}
      ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
    />
  );
}
