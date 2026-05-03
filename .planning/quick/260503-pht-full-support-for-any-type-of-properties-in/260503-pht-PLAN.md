---
quick_id: 260503-pht
slug: full-support-for-any-type-of-properties-in
description: Full support for any type of properties in copy window
date: 2026-05-03
status: planned
must_haves:
  truths:
    - CascadingSelectRenderer renders option-with-child fields as two-level comboboxes
    - option-with-child is editable in DynamicTargetForm and GapsSection (no UnsupportedFieldHint)
    - any-type fields render with a fallback renderer (no UnsupportedFieldHint shown)
    - issuetype and project are excluded from dynamicFormFields in both CopyPreviewPage and CopyPreviewModal
  artifacts:
    - src/features/field-renderers/renderers/CascadingSelectRenderer.tsx
    - src/features/field-renderers/renderers/AnyFieldFallbackRenderer.tsx
  key_links:
    - src/features/field-renderers/registry.ts
    - src/features/tickets/CopyPreviewPage.tsx
    - src/features/tickets/CopyPreviewModal.tsx
---

# Quick Task 260503-pht: Full support for any type of properties in copy window

## Goal
Remove the "Tento typ poľa sa nedá nastaviť manuálne" warning for all field types
by adding renderers for `option-with-child` (cascading select) and `any` (unknown
type fallback), and excluding pipeline-managed fields from the editable form.

## Context

Currently `isEditableSchemaType` returns false for:
- `option-with-child` (cascading select) → UnsupportedFieldHint shown
- `issuetype` → pipeline-managed, should be excluded from form
- `any` → truly unknown type → UnsupportedFieldHint shown

The UnsupportedFieldHint is displayed in:
- `DynamicTargetForm` (src/features/field-renderers/DynamicTargetForm.tsx)
- `GapsSection` (src/features/tickets/GapsSection.tsx)

`option-with-child` fields have `allowedValues` with shape:
`[{ id, value, children: [{ id, value }] }]`

The value shape when reading/writing is:
`{ value: "Parent", id: "1", child: { value: "Child", id: "2" } }`

---

## Task 1: Add CascadingSelectRenderer for option-with-child

**File:** `src/features/field-renderers/renderers/CascadingSelectRenderer.tsx`

Create a renderer with two stacked VirtualizedCombobox components:
- Parent combobox: items from `field.allowedValues` (typed as `{ id?: string; value?: string; children?: ParentChild[] }[]`)
- Child combobox: items from `selectedParent.children` (disabled when no parent selected)
- Initial value hydration: find matching parent by `id` or `value` in `allowedValues`; find matching child in `parent.children`
- On parent change: clear child selection, emit `{ value: parent.value, id: parent.id }`
- On child change: emit `{ value: parent.value, id: parent.id, child: { value: child.value, id: child.id } }`
- When parent has no children array or empty children: don't render child combobox
- Use `fieldRenderer.placeholder.select` for both dropdowns
- Disable child combobox when no parent is selected (and children exist)

```tsx
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

export function CascadingSelectRenderer({ field, value, onChange, required, disabled }: RendererProps) {
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

  const handleParentChange = (p: CascadeOption | null) => {
    setSelectedParent(p);
    setSelectedChild(null);
    onChange(p ? { value: p.value, id: p.id } : null);
  };

  const handleChildChange = (c: CascadeOption | null) => {
    setSelectedChild(c);
    if (!selectedParent) return;
    onChange(
      c
        ? { value: selectedParent.value, id: selectedParent.id, child: { value: c.value, id: c.id } }
        : { value: selectedParent.value, id: selectedParent.id },
    );
  };

  const hasChildren = childItems.length > 0 || (selectedParent !== null && Array.isArray(selectedParent.children));

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
```

Add translation key `fieldRenderer.placeholder.selectChild` to `src/i18n/locales/en.json` and `src/i18n/locales/sk.json`:
- EN: `"fieldRenderer.placeholder.selectChild": "Select sub-option…"`
- SK: `"fieldRenderer.placeholder.selectChild": "Vybrať podopcию…"` (or similar)

**Done when:** CascadingSelectRenderer file exists and renders without errors.

---

## Task 2: Add AnyFieldFallbackRenderer for unknown types

**File:** `src/features/field-renderers/renderers/AnyFieldFallbackRenderer.tsx`

For `any` type fields (unknown schema type from Jira), provide best-effort editing:
- If `field.allowedValues?.length > 0`: render like `SingleSelectRenderer` (option objects)
- Otherwise: render like `StringRenderer` (plain text input)

```tsx
import { SingleSelectRenderer } from './SingleSelectRenderer';
import { StringRenderer } from './StringRenderer';
import type { RendererProps } from '../types';

export function AnyFieldFallbackRenderer(props: RendererProps) {
  if (Array.isArray(props.field.allowedValues) && props.field.allowedValues.length > 0) {
    return <SingleSelectRenderer {...props} />;
  }
  return <StringRenderer {...props} />;
}
```

**Done when:** File exists, no type errors.

---

## Task 3: Update registry.ts

**File:** `src/features/field-renderers/registry.ts`

Changes:
1. Import `CascadingSelectRenderer` from `./renderers/CascadingSelectRenderer`
2. Import `AnyFieldFallbackRenderer` from `./renderers/AnyFieldFallbackRenderer`
3. In `getRenderer`:
   - `case 'option-with-child': return CascadingSelectRenderer;`
   - Replace `case 'any': return UnsupportedTypeRenderer;` (was in default) → `case 'any': return AnyFieldFallbackRenderer;`
4. In `isEditableSchemaType`:
   - Add `case 'option-with-child': return true;` (before existing default)
   - Add `case 'any': return true;` (before existing default)
   - Remove `issuetype` if it was there (it shouldn't be but double-check)

The `default` case in `getRenderer` stays as `UnsupportedTypeRenderer` for safety.

**Done when:** registry.ts compiles, `option-with-child` and `any` map to editable renderers.

---

## Task 4: Exclude pipeline-managed fields from dynamicFormFields

**Files:**
- `src/features/tickets/CopyPreviewPage.tsx`
- `src/features/tickets/CopyPreviewModal.tsx`

In both files, update `dynamicFormFields` useMemo to also exclude `issuetype` and `project`:

```typescript
const dynamicFormFields = useMemo(
  () =>
    resolvedTargetFields.filter(
      (f) => f.fieldId !== 'summary' && f.fieldId !== 'issuetype' && f.fieldId !== 'project' && !gapIds.has(f.fieldId),
    ),
  [resolvedTargetFields, gapIds],
);
```

This prevents showing a confusing editable form entry for `issuetype` (which already has its own IssueTypeChooser above) and `project` (which is set by the target project dropdown).

**Done when:** Both files updated.

---

## Task 5: Run type-check and tests

```bash
cd /Users/mimo/Documents/Projects/pmkar
npm run type-check 2>&1 | tail -20
npm test -- --reporter=verbose 2>&1 | tail -30
```

Fix any type errors before committing.

**Done when:** Type-check passes, test suite still green.
