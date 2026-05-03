# Phase 22: Copy Preview Override Panel - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 5 (CopyPreviewModal, copyStore, IssueTypeChooser, GapsSection, integration wiring)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/tickets/CopyPreviewModal.tsx` | component | request-response | itself (existing file, right column replaced) | exact |
| `src/features/tickets/copyStore.ts` | store | CRUD | itself (existing file, extended with override state) | exact |
| `src/features/tickets/IssueTypeChooser.tsx` (new) | component | request-response | `src/features/field-mapping/MappingRow.tsx` | role-match |
| `src/features/tickets/GapsSection.tsx` (new) | component | request-response | `src/features/field-mapping/SuggestionsPanel.tsx` | role-match |
| Integration wiring (DynamicTargetForm, searchCallbacks, email pre-fill) | component | request-response | `src/features/field-renderers/DynamicTargetForm.tsx` | exact |

---

## Pattern Assignments

### `src/features/tickets/CopyPreviewModal.tsx` (right column replacement)

**Analog:** itself — existing file whose right column (`w-1/2 overflow-y-auto p-4`) is replaced.

**Existing imports pattern** (lines 1–21 of CopyPreviewModal.tsx):
```typescript
import { invoke } from '@tauri-apps/api/core';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
```

**New imports to add** (pattern from MappingRow.tsx, FieldMappingSection.tsx):
```typescript
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchemaCacheStore, schemaCacheKey } from '@/stores/schemaCacheStore';
import { DynamicTargetForm } from '@/features/field-renderers/DynamicTargetForm';
import type { FieldMappingRow } from '@/features/field-mapping/types';
import { IssueTypeChooser } from './IssueTypeChooser';
import { GapsSection } from './GapsSection';
```

**Copy button disabled + tooltip pattern** (from `src/features/tickets/TicketCard.tsx` lines 41–59):
```tsx
// Wrap the confirm Button in a TooltipProvider when gaps exist
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      {/* Button must be wrapped in a <span> when disabled to allow tooltip to fire */}
      <span>
        <Button
          onClick={handleConfirm}
          disabled={phase === 'copying' || gapFields.length > 0}
        >
          {t('copy.preview.confirm')}
        </Button>
      </span>
    </TooltipTrigger>
    {gapFields.length > 0 && (
      <TooltipContent>
        {t('copy.preview.gapTooltip', { fields: gapFields.map((f) => f.name).join(', ') })}
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

**Right column structure** — replace lines 222–345 in CopyPreviewModal.tsx with:
```tsx
{/* Right: Target (editable) */}
<div className="w-1/2 overflow-y-auto p-4 bg-brand-surface">
  <h3 className="text-base font-semibold mb-4">{t('copy.preview.target')}</h3>

  {/* Issue-type chooser (D-03, D-04, D-05, D-06) */}
  <IssueTypeChooser
    projectKey={targetProjectKey}
    sourceIssueTypeName={sourceTicket.fields.issuetype?.name ?? ''}
    value={targetIssueTypeId}
    onChange={setTargetIssueTypeId}
  />

  {/* Summary (D-01, D-02) */}
  <div className="mb-3 mt-3">
    <label htmlFor="copy-target-summary" className="text-xs text-brand-muted block mb-1">
      {t('copy.preview.summary')} <span className="text-destructive" aria-hidden="true">*</span>
    </label>
    <input
      id="copy-target-summary"
      type="text"
      value={targetSummary}
      onChange={(e) => setTargetSummary(e.target.value)}
      className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
    />
  </div>

  {/* Gaps section (D-07, D-08, D-09) */}
  <GapsSection
    gapFields={gapFields}
    overrideValues={overrideValues}
    onOverrideChange={setOverrideValue}
    onMapLink={() => { reset(); /* navigate to Settings field-mapping — see navigation pattern */ }}
  />

  {/* DynamicTargetForm for mapped fields */}
  <DynamicTargetForm
    fields={resolvedTargetFields.filter(f => !gapFields.some(g => g.fieldId === f.fieldId) && f.fieldId !== 'summary')}
    values={overrideValues}
    onChange={setOverrideValue}
    searchCallbacks={{ onSearchUsers }}
  />
</div>
```

**Navigation pattern for "Map ->" link** — App.tsx uses `useState` flags, not a router. SettingsPage takes `onClose` + opens section via `initialSection` prop. The "Map ->" click should call `reset()` (closes modal) and then call a callback that sets `showSettings(true)` in App.tsx with initial section `'field-mapping'`. Pattern from `src/App.tsx` lines 139–156:
```typescript
// App.tsx passes a callback prop to CopyPreviewModal:
// onOpenSettings?: (section: ActiveSection) => void
// CopyPreviewModal passes it down to GapsSection as onMapLink
// onMapLink calls: reset(); onOpenSettings?.('field-mapping');

// SettingsPage needs initialSection prop added to SettingsPageProps:
// interface SettingsPageProps { onClose: () => void; onEdit?: ...; initialSection?: ActiveSection; }
// useState initialised from: useState<ActiveSection>(initialSection ?? 'source')
```

---

### `src/features/tickets/copyStore.ts` (store extension)

**Analog:** itself — existing Zustand store, extend with new fields following the same `create<CopyState>((set, get) => ...)` pattern.

**Existing store shape pattern** (lines 1–61 of copyStore.ts):
```typescript
import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useConnectionStore } from '../connections/connectionStore';
import type { CloudMeta, CopyPhase, CopyTicketResult, JiraTicketDetail } from './types';
// ^^^ Add: import type { FieldSchema } from '@/types/fieldSchema';

interface CopyState {
  // ... existing fields stay unchanged ...

  // NEW fields (D-11):
  targetIssueTypeId: string | null;
  overrideValues: Record<string, unknown>;
  resolvedTargetFields: FieldSchema[];

  // NEW actions (D-11):
  setTargetIssueTypeId: (id: string) => void;
  setOverrideValue: (fieldId: string, v: unknown) => void;
  clearOverrides: () => void;
}
```

**initialState extension pattern** — follow lines 46–61 pattern, add new zero-values:
```typescript
const initialState = {
  // ... existing ...
  // NEW:
  targetIssueTypeId: null,
  overrideValues: {},
  resolvedTargetFields: [],
};
```

**New action implementations** — follow `setTargetSummary` pattern (line 119):
```typescript
setTargetIssueTypeId: (id) => set({ targetIssueTypeId: id }),

setOverrideValue: (fieldId, v) =>
  set({ overrideValues: { ...get().overrideValues, [fieldId]: v } }),

clearOverrides: () =>
  set({ targetIssueTypeId: null, overrideValues: {}, resolvedTargetFields: [] }),
```

**reset() must include new fields** — replace line 171:
```typescript
reset: () => set(initialState),  // already clears all because initialState includes new zero-values
```

**startPreview extension** — after setting phase='previewing', load prewarmed issue types and set initial targetIssueTypeId (pattern from `src/features/field-mapping/FieldMappingSection.tsx` lines 187–206):
```typescript
// Inside startPreview, after set({ phase: 'previewing', cloudMeta: meta, ... }):
const prewarmed = useSchemaCacheStore.getState().prewarmedIssueTypes[savedTargetProjectKey] ?? [];
if (prewarmed.length === 0) {
  await useSchemaCacheStore.getState().preWarm(savedTargetProjectKey);
}
const freshList = useSchemaCacheStore.getState().prewarmedIssueTypes[savedTargetProjectKey] ?? [];
const sourceTypeName = ticket.fields.issuetype?.name ?? '';
const matched = freshList.find(
  (it) => it.name.toLowerCase() === sourceTypeName.toLowerCase()
);
const defaultTypeId = matched?.id ?? freshList[0]?.id ?? null;
if (defaultTypeId) {
  await useSchemaCacheStore.getState().loadSchema('target', savedTargetProjectKey, defaultTypeId);
}
set({
  targetIssueTypeId: defaultTypeId,
  resolvedTargetFields: defaultTypeId
    ? (useSchemaCacheStore.getState().cache[
        schemaCacheKey('target', savedTargetProjectKey, defaultTypeId)
      ]?.fields ?? [])
    : [],
});
```

---

### `src/features/tickets/IssueTypeChooser.tsx` (new component)

**Analog:** `src/features/field-mapping/MappingRow.tsx` — uses VirtualizedCombobox with `[&_button]:min-h-9` compactness wrapper; also `src/features/field-renderers/renderers/UserPickerRenderer.tsx` for async pattern.

**Imports pattern** (from MappingRow.tsx lines 1–11):
```typescript
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import { useSchemaCacheStore, schemaCacheKey } from '@/stores/schemaCacheStore';
import type { IssueTypeRef } from '@/types/fieldSchema';
```

**Compactness wrapper pattern** (from MappingRow.tsx line 88):
```tsx
// VirtualizedCombobox in compact rows uses [&_button]:min-h-9 wrapper
<div className="[&_button]:min-h-9">
  <VirtualizedCombobox<IssueTypeRef>
    items={issueTypes}
    value={selected}
    onChange={(it) => onChange(it.id)}
    displayLabel={(it) => it.name}
    filterFn={(it, q) => it.name.toLowerCase().includes(q.toLowerCase())}
    placeholder={t('copy.preview.issueTypePlaceholder')}
    ariaLabel={t('copy.preview.issueTypeAriaLabel')}
  />
</div>
```

**Default-with-no-match caption** (D-06) — new pattern, closest visual analog is the muted caption used in SourceFieldRow:
```tsx
// Below the combobox, show only when defaulted (not yet manually picked):
{isDefaulted && (
  <p className="text-xs text-brand-muted mt-0.5">
    {t('copy.preview.issueTypeDefaulted', { sourceTypeName })}
  </p>
)}
```

**Issue type load / cache pattern** (from FieldMappingSection.tsx `useSchemaArrays`, lines 59–81):
```typescript
// Inside IssueTypeChooser or called from parent:
const prewarmed = useSchemaCacheStore((s) => s.prewarmedIssueTypes);
const issueTypes = useMemo(
  () => prewarmed[projectKey ?? ''] ?? [],
  [prewarmed, projectKey]
);
// On issue type change, trigger schema reload:
const loadSchema = useSchemaCacheStore((s) => s.loadSchema);
async function handleChange(id: string) {
  onChange(id);
  await loadSchema('target', projectKey, id);
  // parent reads updated resolvedTargetFields from cache and updates store
}
```

---

### `src/features/tickets/GapsSection.tsx` (new component)

**Analog:** `src/features/field-mapping/SuggestionsPanel.tsx` — amber-bordered section with per-row fill-in; also DynamicTargetForm for rendering typed inputs per FieldSchema.

**Imports pattern** (from SuggestionsPanel + DynamicTargetForm):
```typescript
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRenderer } from '@/features/field-renderers/registry';
import type { FieldSchema } from '@/types/fieldSchema';
```

**Amber section header pattern** — new visual, but amber border is established in MappingRow drift pattern (lines 75–79 of MappingRow.tsx):
```tsx
// MappingRow drifted style: 'border-l-2 border-l-amber-500 pl-2'
// GapsSection adapts this to a section-level amber treatment:
<div className="mb-3">
  <div className="flex items-center gap-1.5 mb-2 text-amber-600 dark:text-amber-400">
    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span className="text-xs font-semibold">{t('copy.preview.gapsSectionHeading')}</span>
  </div>
  <div className="border border-amber-300 dark:border-amber-700 rounded-md divide-y divide-amber-200 dark:divide-amber-800">
    {gapFields.map((field) => (
      <GapRow
        key={field.fieldId}
        field={field}
        value={overrideValues[field.fieldId]}
        onChange={(v) => onOverrideChange(field.fieldId, v)}
        onMapLink={onMapLink}
      />
    ))}
  </div>
</div>
```

**Per-row fill-in + "Map ->" link pattern** — typed input via renderer registry (DynamicTargetForm lines 20–50):
```tsx
function GapRow({ field, value, onChange, onMapLink }: GapRowProps) {
  const { t } = useTranslation();
  const Renderer = getRenderer(field.schema);
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="text-xs font-medium text-brand-text min-w-[100px] shrink-0">
        {field.name}
        <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
      </span>
      <div className="flex-1 [&_button]:min-h-9">
        <Renderer
          field={field}
          value={value}
          onChange={onChange}
          required={true}
        />
      </div>
      <button
        type="button"
        onClick={onMapLink}
        className="text-xs text-brand-link hover:underline shrink-0 whitespace-nowrap"
      >
        {t('copy.preview.mapLink')}
      </button>
    </div>
  );
}
```

**Gap computation pattern** — `useMemo` joining mapping rows against resolvedTargetFields (pattern from FieldMappingSection.tsx `driftedSourceFieldIds`, lines 210–218):
```typescript
// In CopyPreviewModal or a custom hook:
const gapFields = useMemo<FieldSchema[]>(() => {
  if (!resolvedTargetFields.length) return [];
  const mappedTargetIds = new Set(mappingRows.map((r) => r.targetFieldId).filter(Boolean));
  return resolvedTargetFields.filter(
    (f) =>
      f.required &&
      !f.hasDefaultValue &&
      !mappedTargetIds.has(f.fieldId) &&
      f.fieldId !== 'summary'  // summary always has dedicated input
  );
}, [resolvedTargetFields, mappingRows]);
```

---

### Integration: DynamicTargetForm + searchCallbacks wiring

**Analog:** `src/features/field-renderers/DynamicTargetForm.tsx` (lines 1–53) + `src/features/field-renderers/types.ts`.

**SearchCallbacks pattern** (types.ts lines 28–32):
```typescript
// SearchCallbacks is already defined in field-renderers/types.ts:
export interface SearchCallbacks {
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
  onFetchComponents?: () => Promise<JiraComponent[]>;
  onFetchVersions?: () => Promise<JiraVersion[]>;
}
```

**onSearchUsers wiring** — invoke `search_jira_users_by_domain` (Phase 16 command). Pattern follows how MappingRow invokes Tauri (lines 34–50 of MappingRow.tsx):
```typescript
// Inside CopyPreviewModal, define the callback and pass to DynamicTargetForm:
const onSearchUsers = useCallback(async (q: string): Promise<JiraUser[]> => {
  try {
    return await invoke<JiraUser[]>('search_jira_users_by_domain', { query: q });
  } catch {
    return [];
  }
}, []);

// Then pass as searchCallbacks:
<DynamicTargetForm
  fields={resolvedMappedFields}
  values={overrideValues}
  onChange={setOverrideValue}
  searchCallbacks={{ onSearchUsers }}
/>
```

**Person picker email pre-fill pattern** (D-15, D-16) — UserPickerRenderer accepts `initialQuery` prop (types.ts line 53). Pre-fill via `initialQuery` set to source user's `emailAddress`:
```typescript
// DynamicTargetForm passes initialQuery to user pickers only.
// Extension: DynamicTargetForm needs an initialValues prop (or pass via values):
// For pre-fill, CopyPreviewModal sets overrideValues for user fields from email match.
// In startPreview, after resolvedTargetFields are known:
const emailPrefillValues: Record<string, unknown> = {};
for (const field of resolvedFields) {
  if (field.schema.type === 'user' && sourceTicket.fields.assignee?.emailAddress) {
    // The value shown in VirtualizedCombobox needs to be a JiraUser object.
    // Set initialQuery instead: pass email as the initial search query via a
    // separate map: initialQueries: Record<fieldId, string>
    // DynamicTargetForm already passes initialQuery={initialQuery} to UserPickerRenderer
    // (see types.ts line 53 — this prop already exists)
  }
}
```

---

## Shared Patterns

### Zustand Store — `create<T>((set, get) => ...)` pattern
**Source:** `src/features/tickets/copyStore.ts` lines 63–172
**Apply to:** `copyStore.ts` extension
```typescript
export const useCopyStore = create<CopyState>((set, get) => ({
  ...initialState,
  someAction: (arg) => set({ someField: arg }),
  complexAction: async () => {
    const state = get();
    // ... async work ...
    set({ phase: 'newPhase' });
  },
  reset: () => set(initialState),
}));
```

### schemaCacheKey + loadSchema pattern
**Source:** `src/features/field-mapping/FieldMappingSection.tsx` lines 9, 59–81; `src/stores/schemaCacheStore.ts` lines 24–29
**Apply to:** `IssueTypeChooser.tsx`, `copyStore.ts` extension
```typescript
import { useSchemaCacheStore, schemaCacheKey } from '@/stores/schemaCacheStore';

// Read from cache:
const key = schemaCacheKey('target', projectKey, issuetypeId);
const fields = cache[key]?.fields ?? [];

// Trigger load:
await useSchemaCacheStore.getState().loadSchema('target', projectKey, issuetypeId);
```

### VirtualizedCombobox compactness wrapper
**Source:** `src/features/field-mapping/MappingRow.tsx` lines 88, 108
**Apply to:** `IssueTypeChooser.tsx`, `GapsSection.tsx` (any combobox inside a form row)
```tsx
<div className="[&_button]:min-h-9">
  <VirtualizedCombobox<T> ... />
</div>
```

### Tooltip on disabled button (required-field gating)
**Source:** `src/features/tickets/TicketCard.tsx` lines 41–59; `src/components/ui/tooltip.tsx`
**Apply to:** Copy button in `CopyPreviewModal.tsx` when `gapFields.length > 0`
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      <span>  {/* span wrapper required when button is disabled */}
        <Button disabled={gapFields.length > 0} onClick={handleConfirm}>
          {t('copy.preview.confirm')}
        </Button>
      </span>
    </TooltipTrigger>
    <TooltipContent>
      {t('copy.preview.gapTooltip', { fields: gapFields.map((f) => f.name).join(', ') })}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Tauri invoke + try/catch pattern
**Source:** `src/features/field-mapping/MappingRow.tsx` lines 34–50; `src/features/tickets/copyStore.ts` lines 134–168
**Apply to:** All new Tauri invoke calls
```typescript
try {
  const result = await invoke<ReturnType>('command_name', { arg1, arg2 });
  // handle success
} catch (err) {
  // handle error — toast.error() for user-visible errors, or silent fail
  console.error('[context] command failed:', err);
}
```

### useTranslation i18n pattern
**Source:** `src/features/tickets/CopyPreviewModal.tsx` line 70; `src/features/field-mapping/FieldMappingSection.tsx` line 48
**Apply to:** All new components
```typescript
const { t } = useTranslation();
// Usage: t('copy.preview.someKey')
// New keys needed in translation files:
//   copy.preview.issueTypeLabel
//   copy.preview.issueTypeDefaulted (with {{ sourceTypeName }} interpolation)
//   copy.preview.gapsSectionHeading
//   copy.preview.mapLink
//   copy.preview.gapTooltip (with {{ fields }} interpolation)
```

### Test file structure (copyStore)
**Source:** `src/features/tickets/__tests__/copyStore.test.ts` lines 1–10, 63–68
**Apply to:** Extended copyStore tests
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { useCopyStore } from '../copyStore';

describe('copyStore', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    useCopyStore.setState(initialState);  // always reset to initial before each test
  });
  // ...
});
```

### Test file structure (modal component)
**Source:** `src/features/tickets/CopyPreviewModal.test.tsx` lines 1–107
**Apply to:** Updated CopyPreviewModal tests
```typescript
// Key mock pattern — mutable currentStoreState controlled per-test:
let currentStoreState: Record<string, unknown> = {};

vi.mock('./copyStore', () => ({
  useCopyStore: Object.assign(
    (selector: (s: unknown) => unknown) => selector(currentStoreState),
    { getState: () => currentStoreState },
  ),
}));

// Also mock schemaCacheStore for new fields:
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: (selector: (s: unknown) => unknown) => selector({ cache: {}, prewarmedIssueTypes: {} }),
  schemaCacheKey: (side: string, pk: string, it: string) => `${side}|${pk}|${it}`,
}));
```

---

## No Analog Found

No files in Phase 22 are entirely without analog. All components have close matches in the existing codebase.

---

## Metadata

**Analog search scope:** `src/features/tickets/`, `src/features/field-mapping/`, `src/features/field-renderers/`, `src/stores/`, `src/types/`, `src/components/ui/`, `src/App.tsx`
**Files scanned:** 17 source files read in full
**Pattern extraction date:** 2026-04-28
