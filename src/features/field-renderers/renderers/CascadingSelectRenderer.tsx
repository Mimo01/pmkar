import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { RendererProps } from '../types';

interface CascadeOption {
  id?: string;
  value?: string;
  children?: CascadeOption[];
}

function optLabel(o: CascadeOption): string {
  return o.value ?? o.id ?? '';
}

export function CascadingSelectRenderer({
  field,
  value,
  onChange,
  required,
  disabled,
}: RendererProps) {
  const { t } = useTranslation();
  const parentItems = useMemo<CascadeOption[]>(
    () => (Array.isArray(field.allowedValues) ? (field.allowedValues as CascadeOption[]) : []),
    [field.allowedValues],
  );

  // Hydrate selected parent from current value
  const currentValue = value as Record<string, unknown> | null | undefined;
  const initialParent = useMemo(() => {
    if (!currentValue || typeof currentValue !== 'object') return null;
    const id = currentValue.id as string | undefined;
    const val = currentValue.value as string | undefined;
    return parentItems.find((p) => (id && p.id === id) || (val && p.value === val)) ?? null;
  }, [currentValue, parentItems]);

  const [selectedParent, setSelectedParent] = useState<CascadeOption | null>(initialParent);

  // Hydrate selected child from current value
  const childItems = useMemo<CascadeOption[]>(
    () => (Array.isArray(selectedParent?.children) ? selectedParent!.children! : []),
    [selectedParent],
  );

  const initialChild = useMemo(() => {
    if (!currentValue?.child || typeof currentValue.child !== 'object') return null;
    const childVal = currentValue.child as Record<string, unknown>;
    const id = childVal.id as string | undefined;
    const val = childVal.value as string | undefined;
    return childItems.find((c) => (id && c.id === id) || (val && c.value === val)) ?? null;
  }, [currentValue, childItems]);

  const [selectedChild, setSelectedChild] = useState<CascadeOption | null>(initialChild);

  const handleParentChange = (p: CascadeOption) => {
    setSelectedParent(p);
    setSelectedChild(null);
    onChange({ value: p.value, id: p.id });
  };

  const handleChildChange = (c: CascadeOption) => {
    setSelectedChild(c);
    if (!selectedParent) return;
    onChange({
      value: selectedParent.value,
      id: selectedParent.id,
      child: { value: c.value, id: c.id },
    });
  };

  const hasChildren =
    childItems.length > 0 || (selectedParent !== null && Array.isArray(selectedParent.children));

  return (
    <div className="flex flex-col gap-2">
      <VirtualizedCombobox<CascadeOption>
        items={parentItems}
        value={selectedParent}
        onChange={handleParentChange}
        displayLabel={optLabel}
        filterFn={(o, q) => optLabel(o).toLowerCase().includes(q.toLowerCase())}
        placeholder={t('fieldRenderer.placeholder.select')}
        disabled={disabled}
        ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
      />
      {hasChildren && (
        <VirtualizedCombobox<CascadeOption>
          items={childItems}
          value={selectedChild}
          onChange={handleChildChange}
          displayLabel={optLabel}
          filterFn={(o, q) => optLabel(o).toLowerCase().includes(q.toLowerCase())}
          placeholder={t('fieldRenderer.placeholder.selectChild')}
          disabled={disabled || !selectedParent}
          ariaLabel={`${field.name} — child option${required ? ' (required)' : ''}`}
        />
      )}
    </div>
  );
}
