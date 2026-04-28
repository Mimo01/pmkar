import { useTranslation } from 'react-i18next';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { RendererProps } from '../types';

interface GroupRef {
  name: string;
  groupId?: string;
}

function isGroupRef(v: unknown): v is GroupRef {
  return Boolean(v && typeof v === 'object' && typeof (v as GroupRef).name === 'string');
}

export function GroupPickerRenderer({ field, value, onChange, required, disabled }: RendererProps) {
  const { t } = useTranslation();
  const items: GroupRef[] = Array.isArray(field.allowedValues)
    ? field.allowedValues.filter(isGroupRef)
    : [];
  const selected = isGroupRef(value) ? value : null;

  return (
    <VirtualizedCombobox<GroupRef>
      items={items}
      value={selected}
      onChange={(g) => onChange(g)}
      displayLabel={(g) => g.name}
      filterFn={(g, q) => g.name.toLowerCase().includes(q.toLowerCase())}
      placeholder={t('fieldRenderer.placeholder.select')}
      disabled={disabled}
      ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
    />
  );
}
