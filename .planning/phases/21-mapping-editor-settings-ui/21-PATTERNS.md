# Phase 21: Mapping Editor (Settings UI) — Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/connections/SettingsPage.tsx` | component (modify) | request-response | self | exact |
| `src/features/field-mapping/types.ts` | model | — | `src/types/fieldSchema.ts` | role-match |
| `src/features/field-mapping/FieldMappingSection.tsx` | component (orchestrator) | CRUD | `src/features/connections/SettingsPage.tsx` (PollingSection / NotificationsSection) | exact |
| `src/features/field-mapping/MappingRow.tsx` | component | CRUD | `src/features/connections/SettingsPage.tsx` (ProjectSelector) | role-match |
| `src/features/field-mapping/SuggestionsPanel.tsx` | component | event-driven | `src/features/connections/SettingsPage.tsx` (watched-users add flow) | role-match |
| `src/features/field-mapping/DriftWarning.tsx` | component (utility UI) | — | lucide-react + inline warning patterns in SettingsPage | partial |
| `src/features/field-mapping/transformerOptions.ts` | utility | transform | `src/features/field-renderers/registry.ts` (switch on FieldSchemaType) | role-match |
| `src/features/field-mapping/heuristics.ts` | utility | transform | no existing analog — pure string logic | none |
| `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` | test | — | `src/features/connections/__tests__/SettingsPage.test.tsx` | exact |
| `src/features/field-mapping/__tests__/MappingRow.test.tsx` | test | — | `src/features/connections/__tests__/SettingsPage.test.tsx` | exact |
| `src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` | test | — | `src/features/connections/__tests__/SettingsPage.test.tsx` | exact |
| `src/features/field-mapping/__tests__/heuristics.test.ts` | test | — | `src/features/field-renderers/__tests__/StringRenderer.test.tsx` | role-match |
| `src/i18n/locales/en.json` | config (modify) | — | self | exact |
| `src/i18n/locales/sk.json` | config (modify) | — | self | exact |

---

## Pattern Assignments

### `src/features/connections/SettingsPage.tsx` (modify)

**What changes:**
1. Add `| 'field-mapping'` to `ActiveSection` union.
2. Add a new "Copying" nav group in the sidebar between Fetching and Polling.
3. Add `case 'field-mapping':` in `renderContent()`.
4. Extend `SectionCard` with an optional `headerAction` prop.
5. Add `<Toaster />` import from `sonner` in app root (`App.tsx` or layout).

**ActiveSection union** (`SettingsPage.tsx` lines 221–230 — verified):
```typescript
type ActiveSection =
  | 'source'
  | 'destination'
  | 'jql-presets'
  | 'watched-users'
  | 'polling'
  | 'notifications'
  | 'theme'
  | 'language'
  | 'about'
  | 'field-mapping'; // ADD — Phase 21
```

**SectionCard extension** (`SettingsPage.tsx` lines 232–241 — verified current shape; extend to):
```typescript
// CURRENT (lines 232–241):
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-3">
        {title}
      </h2>
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">{children}</div>
    </div>
  );
}

// EXTEND TO (add headerAction prop — backward-compatible because optional):
function SectionCard({
  title,
  children,
  headerAction,
}: {
  title: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
          {title}
        </h2>
        {headerAction}
      </div>
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">{children}</div>
    </div>
  );
}
```

**New nav group pattern** (`SettingsPage.tsx` lines 1124–1184 — copy this block structure):
```tsx
{/* Copying group — NEW (Phase 21) — insert between Fetching group and Polling group */}
<Separator className="my-2" />
<div className="mb-4">
  <p className="text-[10px] font-semibold text-brand-muted/70 uppercase tracking-widest mb-1.5 px-3">
    {t('settings.group.copying')}
  </p>
  <div className="space-y-0.5">
    <NavItem section="field-mapping" label={t('settings.nav.fieldMapping')} />
  </div>
</div>
```

**New renderContent case** (insert after the `'notifications'` case):
```tsx
case 'field-mapping':
  return (
    <SectionCard
      title={t('settings.section.fieldMapping')}
      headerAction={<FieldMappingSectionHeader />}
    >
      <FieldMappingSection />
    </SectionCard>
  );
```

**NavItem component** (`SettingsPage.tsx` lines 553–568 — no changes needed, reads `ActiveSection` type):
```tsx
function NavItem({ section, label }: { section: ActiveSection; label: string }) {
  const isActive = activeSection === section;
  return (
    <button
      type="button"
      onClick={() => setActiveSection(section)}
      className={cn(
        'w-full text-left px-3 py-1.5 text-sm rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none',
        isActive
          ? 'font-semibold text-brand-text border-l-2 border-brand'
          : 'font-normal text-brand-muted hover:text-brand-text border-l-2 border-transparent',
      )}
    >
      {label}
    </button>
  );
}
```

---

### `src/features/field-mapping/types.ts` (new, model)

**Analog:** `src/types/fieldSchema.ts`

**Imports pattern** (`src/types/fieldSchema.ts` lines 1–10):
```typescript
import type { FieldSchemaType } from '@/types/fieldSchema';
```

**Core type definition** (mirrors `src-tauri/src/field_transform/mod.rs:135` with `serde(rename_all="camelCase")`):
```typescript
// src/features/field-mapping/types.ts
import type { FieldSchemaType } from '@/types/fieldSchema';

export interface FieldMappingRow {
  sourceFieldId: string;
  targetFieldId: string;    // "" = dismissed suggestion sentinel (D-07)
  transformerKind: string;  // "identity" | "user" | "version" | "component" | "wiki_to_adf"
  sourceSchema: FieldSchemaType;
  targetSchema: FieldSchemaType;
}
```

No state, no functions — pure type file. Follow the same JSDoc comment style as `src/types/fieldSchema.ts` (source-of-truth comment pointing to Rust struct).

---

### `src/features/field-mapping/FieldMappingSection.tsx` (new, orchestrator component)

**Analog:** `src/features/connections/SettingsPage.tsx` — `PollingSection` (lines 1244–1298) and `NotificationsSection` (lines 1314–1345) for invoke + local state pattern.

**Imports pattern** (modeled on SettingsPage.tsx imports + schemaCacheStore):
```typescript
import { invoke } from '@tauri-apps/api/core';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchemaCacheStore, schemaCacheKey } from '@/stores/schemaCacheStore';
import { useConnectionStore } from '@/features/connections/connectionStore';
import type { FieldMappingRow } from './types';
import { MappingRow } from './MappingRow';
import { SuggestionsPanel } from './SuggestionsPanel';
import { findNameMatchSuggestion } from './heuristics';
```

**Local state pattern** (from PollingSection + NotificationsSection — local useState, no Zustand store):
```typescript
// D-09 pattern: local state for rows + loading flags; NO Zustand store needed for Phase 21
const [mappingRows, setMappingRows] = useState<FieldMappingRow[]>([]);
const [loading, setLoading] = useState(false);
const [refreshing, setRefreshing] = useState(false);
const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
```

**Store subscriptions** (`schemaCacheStore.ts` lines 1–91 — verified API):
```typescript
// Read target schema from schemaCacheStore (cache-first, no duplication of invoke logic)
const schemaCache = useSchemaCacheStore((s) => s.cache);
const loadSchema = useSchemaCacheStore((s) => s.loadSchema);
const refreshSchema = useSchemaCacheStore((s) => s.refresh);
const prewarmedIssueTypes = useSchemaCacheStore((s) => s.prewarmedIssueTypes);
const targetProjectKey = useConnectionStore((s) => s.targetProjectKey);
```

**Initial data load pattern** (modeled on SettingsPage.tsx useEffect at lines 304–311):
```typescript
useEffect(() => {
  async function load() {
    setLoading(true);
    try {
      const rows = await invoke<FieldMappingRow[]>('get_field_mapping');
      setMappingRows(rows);
      // Load source schema (cache-first)
      await loadSchema('source', null, null);
      // Load target schema — pick first prewarmed issue type (Pitfall 4 mitigation)
      const issueTypes = prewarmedIssueTypes[targetProjectKey ?? ''] ?? [];
      const firstIssueTypeId = issueTypes[0]?.id ?? null;
      if (targetProjectKey && firstIssueTypeId) {
        await loadSchema('target', targetProjectKey, firstIssueTypeId);
      }
      setLastRefreshed(Date.now());
    } finally {
      setLoading(false);
    }
  }
  void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // mount only — intentional
```

**Refresh handler pattern** (`schemaCacheStore.ts` lines 78–88 — verified refresh/loadSchema API):
```typescript
// D-13: Refresh schema button handler
async function handleRefresh() {
  setRefreshing(true);
  try {
    const issueTypes = prewarmedIssueTypes[targetProjectKey ?? ''] ?? [];
    const firstIssueTypeId = issueTypes[0]?.id ?? null;
    await refreshSchema('source', null, null);
    if (targetProjectKey && firstIssueTypeId) {
      await refreshSchema('target', targetProjectKey, firstIssueTypeId);
    }
    await loadSchema('source', null, null);
    if (targetProjectKey && firstIssueTypeId) {
      await loadSchema('target', targetProjectKey, firstIssueTypeId);
    }
    setLastRefreshed(Date.now());
  } catch {
    toast.error(t('settings.fieldMapping.refreshError'));
  } finally {
    setRefreshing(false);
  }
}
```

**Drift detection pattern** (D-14 — useMemo keyed on both rows + targetFields):
```typescript
// D-14: Never run in useEffect — use useMemo for derived state (anti-pattern avoidance)
const targetFields = useMemo(() => {
  if (!targetProjectKey) return [];
  const issueTypes = prewarmedIssueTypes[targetProjectKey] ?? [];
  const firstIssueTypeId = issueTypes[0]?.id ?? null;
  if (!firstIssueTypeId) return [];
  const key = schemaCacheKey('target', targetProjectKey, firstIssueTypeId);
  return schemaCache[key]?.fields ?? [];
}, [schemaCache, targetProjectKey, prewarmedIssueTypes]);

const driftedSourceFieldIds = useMemo(() => {
  const targetFieldIds = new Set(targetFields.map((f) => f.fieldId));
  return new Set(
    mappingRows
      .filter((r) => r.targetFieldId !== '' && !targetFieldIds.has(r.targetFieldId))
      .map((r) => r.sourceFieldId),
  );
}, [mappingRows, targetFields]);
```

**Error handling** (from PollingSection lines 1256–1273 — console.error + silent fail for non-critical):
```typescript
// Non-critical load error: silent (same as PollingSection/NotificationsSection pattern)
} catch (e) {
  console.error('Failed to load field mapping:', e);
} finally {
  setLoading(false);
}
// User-triggered action error: toast (D-09 + Pitfall 6)
} catch {
  toast.error(t('settings.fieldMapping.saveError'));
}
```

**Skeleton loading state** (from SettingsPage.tsx — `Skeleton` component imported at line 20):
```tsx
{loading ? (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
) : (
  /* mapping table content */
)}
```

---

### `src/features/field-mapping/MappingRow.tsx` (new, component)

**Analog:** `src/features/connections/SettingsPage.tsx` — `ProjectSelector` component (lines 45–165) for invoke + local feedback state pattern.

**Imports pattern:**
```typescript
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import type { FieldSchema } from '@/types/fieldSchema';
import type { FieldMappingRow } from './types';
import { DriftWarning } from './DriftWarning';
import { getTransformerOptions } from './transformerOptions';
```

**Per-row auto-save feedback state** (D-09 — inline check, no "Save" button):
```typescript
// Local per-row feedback — matches "inline check or toast" decision
const [feedback, setFeedback] = useState<'saving' | 'saved' | 'error' | null>(null);
```

**Auto-save invoke pattern** (modeled on PollingSection `handleFrequencyChange` lines 1256–1273):
```typescript
async function handleTargetChange(newTarget: FieldSchema) {
  setFeedback('saving');
  try {
    await invoke('set_field_mapping', {
      row: {
        sourceFieldId: row.sourceFieldId,
        targetFieldId: newTarget.fieldId,
        transformerKind: getTransformerOptions(newTarget.schema)[0]?.value ?? 'identity',
        sourceSchema: row.sourceSchema,
        targetSchema: newTarget.schema,
      } satisfies FieldMappingRow,
    });
    onRowUpdate({ ...row, targetFieldId: newTarget.fieldId, targetSchema: newTarget.schema });
    setFeedback('saved');
    setTimeout(() => setFeedback(null), 1500);
  } catch {
    setFeedback('error');
    toast.error(t('settings.fieldMapping.saveError'));
  }
}

async function handleDelete() {
  try {
    await invoke('delete_field_mapping', { sourceFieldId: row.sourceFieldId });
    onRowDelete(row.sourceFieldId);
  } catch {
    toast.error(t('settings.fieldMapping.deleteError'));
  }
}
```

**VirtualizedCombobox usage** (`src/features/field-renderers/components/VirtualizedCombobox.tsx` lines 9–23 — full props interface verified):
```tsx
// Pitfall 5 mitigation: wrap in [&_button]:min-h-9 override for compact table rows
<div className="[&_button]:min-h-9">
  <VirtualizedCombobox<FieldSchema>
    items={targetFields}
    value={targetField}
    onChange={handleTargetChange}
    displayLabel={(f) => f.name}
    filterFn={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
    placeholder={t('settings.fieldMapping.targetPlaceholder')}
    ariaLabel={`${row.sourceFieldId} ${t('settings.fieldMapping.targetAriaLabel')}`}
    renderItem={(f) => (
      <span className="flex items-center justify-between w-full">
        <span className="truncate">{f.name}</span>
        <span className="text-xs text-muted-foreground ml-2">{f.schema.type}</span>
      </span>
    )}
  />
</div>
```

**Row layout** (D-04 column ratios 35/35/20/10 within 560px max-width):
```tsx
// grid-cols with percentage-based column sizing
<div className="grid grid-cols-[35fr_35fr_20fr_10fr] gap-2 items-center min-h-[40px] py-1">
  <span className="text-sm text-brand-text truncate">{row.sourceFieldId}</span>
  {isDrifted ? (
    <DriftWarning sourceFieldId={row.sourceFieldId} onRemove={handleDelete} />
  ) : (
    <div className="[&_button]:min-h-9">{/* target combobox */}</div>
  )}
  <div className="[&_button]:min-h-9">{/* transformer combobox */}</div>
  <button
    type="button"
    onClick={handleDelete}
    aria-label={t('settings.fieldMapping.deleteRow', { source: row.sourceFieldId })}
    className="flex items-center justify-center h-9 w-9 rounded hover:bg-brand-surface-hover text-brand-muted hover:text-red-400 transition-colors"
  >
    <X className="h-4 w-4" aria-hidden="true" />
  </button>
</div>
```

---

### `src/features/field-mapping/SuggestionsPanel.tsx` (new, component)

**Analog:** `src/features/connections/SettingsPage.tsx` — watched-users add flow (lines 780–870) for an action list pattern with Accept/Dismiss buttons.

**Imports pattern:**
```typescript
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { FieldSchema } from '@/types/fieldSchema';
import type { FieldMappingRow } from './types';
```

**Collapsible via native `<details>/<summary>`** (RESEARCH.md recommendation — no @radix-ui/react-collapsible dependency):
```tsx
// D-05: collapsible panel above table; native <details> avoids Radix dependency
<details open className="mb-4">
  <summary className="flex items-center gap-1.5 cursor-pointer list-none text-sm font-medium text-brand-text select-none">
    <ChevronDown className="h-4 w-4 transition-transform details-open:rotate-0 details-closed:-rotate-90" aria-hidden="true" />
    {t('settings.fieldMapping.suggestions.heading', { count: suggestions.length })}
  </summary>
  <div className="mt-2 rounded-lg border border-brand-border bg-brand-surface/50 divide-y divide-brand-border">
    {suggestions.map((s) => (
      <SuggestionRow key={s.sourceFieldId} suggestion={s} onAccept={onAccept} onDismiss={onDismiss} />
    ))}
  </div>
</details>
```

**Accept/Dismiss pattern** (D-08: accept calls `set_field_mapping`; D-07: dismiss calls `set_field_mapping` with empty `targetFieldId`):
```typescript
async function handleAccept(sourceFieldId: string, target: FieldSchema) {
  try {
    await invoke('set_field_mapping', {
      row: {
        sourceFieldId,
        targetFieldId: target.fieldId,
        transformerKind: 'identity',
        sourceSchema: { type: 'any' },
        targetSchema: target.schema,
      } satisfies FieldMappingRow,
    });
    onAccept(sourceFieldId, target);
  } catch {
    toast.error(t('settings.fieldMapping.saveError'));
  }
}

async function handleDismiss(sourceFieldId: string) {
  try {
    // D-07: empty string sentinel persists dismissal in mapping.db
    await invoke('set_field_mapping', {
      row: {
        sourceFieldId,
        targetFieldId: '',
        transformerKind: 'identity',
        sourceSchema: { type: 'any' },
        targetSchema: { type: 'any' },
      } satisfies FieldMappingRow,
    });
    onDismiss(sourceFieldId);
  } catch {
    toast.error(t('settings.fieldMapping.saveError'));
  }
}
```

---

### `src/features/field-mapping/DriftWarning.tsx` (new, utility UI component)

**Analog:** `src/features/connections/SettingsPage.tsx` — inline warning patterns using `AlertTriangle` from lucide-react (line 11 import verified) + amber styling.

**Imports pattern:**
```typescript
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
```

**Core pattern** (D-15 — replaces target combobox content; amber/orange; role="alert"):
```tsx
// D-15: Warning replaces target combobox content, unmissable; role="alert" for WCAG AA
export function DriftWarning({
  sourceFieldId,
  onRemove,
}: {
  sourceFieldId: string;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{t('settings.fieldMapping.drift.warning')}</span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="ml-auto h-6 px-2 text-xs"
      >
        {t('settings.fieldMapping.drift.remove')}
      </Button>
    </div>
  );
}
```

---

### `src/features/field-mapping/transformerOptions.ts` (new, utility)

**Analog:** `src/features/field-renderers/registry.ts` — switch on `FieldSchemaType` discriminant (lines 1–100 verified).

**Imports pattern** (`src/features/field-renderers/registry.ts` lines 1–3):
```typescript
import type { FieldSchemaType } from '@/types/fieldSchema';
```

**Core switch pattern** (D-03 — mirrors registry.ts discriminant switch style):
```typescript
export interface TransformerOption {
  value: string;
  label: string;
}

// D-03: Filter to valid transformers per target field type. 'any' type → all options.
// Pitfall 3 mitigation: 'any' case returns all options so seeded rows with null schema
// show the full transformer list.
export function getTransformerOptions(schema: FieldSchemaType): TransformerOption[] {
  const identity: TransformerOption = { value: 'identity', label: 'Identity' };
  switch (schema.type) {
    case 'string':
      return [identity, { value: 'wiki_to_adf', label: 'Wiki → ADF' }];
    case 'user':
      return [{ value: 'user', label: 'User' }, identity];
    case 'array':
      if (schema.items === 'user') return [{ value: 'user', label: 'User' }, identity];
      if (schema.items === 'version') return [{ value: 'version', label: 'Version' }, identity];
      if (schema.items === 'component') return [{ value: 'component', label: 'Component' }, identity];
      return [identity];
    case 'priority':
      return [{ value: 'priority', label: 'Priority' }, identity];
    case 'any':
    default:
      // Pitfall 3: seed rows have FieldSchemaType::Any — must show all options
      return [
        identity,
        { value: 'wiki_to_adf', label: 'Wiki → ADF' },
        { value: 'user', label: 'User' },
        { value: 'version', label: 'Version' },
        { value: 'component', label: 'Component' },
        { value: 'priority', label: 'Priority' },
      ];
  }
}
```

---

### `src/features/field-mapping/heuristics.ts` (new, utility)

**Analog:** None in codebase — pure string logic with no existing equivalent.

**Core pattern** (CONTEXT.md D-EDIT-02 — case-insensitive equality + synonym set; from RESEARCH.md Pattern 7):
```typescript
import type { FieldSchema } from '@/types/fieldSchema';

const SYNONYMS: Record<string, string[]> = {
  description: ['desc', 'body', 'details'],
  priority: ['severity', 'importance', 'urgency'],
  assignee: ['assignedto', 'owner'],
  reporter: ['createdby', 'author', 'submitter'],
  labels: ['tags', 'label'],
};

// Normalize: lowercase + strip separators for comparison
function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_ ]/g, '');
}

export function findNameMatchSuggestion(
  sourceFieldId: string,
  sourceName: string,
  targetFields: FieldSchema[],
): FieldSchema | null {
  // 1. Exact field_id match
  const byId = targetFields.find((f) => f.fieldId === sourceFieldId);
  if (byId) return byId;
  // 2. Case-insensitive normalized name match
  const lower = normalize(sourceName);
  const byName = targetFields.find((f) => normalize(f.name) === lower);
  if (byName) return byName;
  // 3. Synonym lookup
  for (const [canonical, syns] of Object.entries(SYNONYMS)) {
    const allForms = [canonical, ...syns];
    if (allForms.includes(lower)) {
      const match = targetFields.find((f) => allForms.includes(normalize(f.name)));
      if (match) return match;
    }
  }
  return null;
}
```

---

### Test files

#### `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` and `MappingRow.test.tsx`

**Analog:** `src/features/connections/__tests__/SettingsPage.test.tsx` (lines 1–94)

**Test file header pattern** (lines 1–17 — mocking `@tauri-apps/api/core`):
```typescript
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useSchemaCacheStore } from '../../../stores/schemaCacheStore';
import { useConnectionStore } from '../../connections/connectionStore';
import { FieldMappingSection } from '../FieldMappingSection';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);
```

**beforeEach reset pattern** (lines 30–39):
```typescript
beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue(undefined);
  // Seed store state so component can render
  useConnectionStore.setState({ targetProjectKey: 'TGT' });
  useSchemaCacheStore.setState({
    cache: {},
    prewarmedIssueTypes: { TGT: [{ id: 'issuetype-1', name: 'Bug' }] },
  });
});
```

**Navigation click test pattern** (lines 66–85 — click nav item, assert content renders):
```typescript
it('clicking Field Mapping nav item renders field mapping section', async () => {
  renderWithI18n(<SettingsPage onClose={vi.fn()} />);
  const navItem = screen.getByRole('button', { name: /Field Mapping/i });
  fireEvent.click(navItem);
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /field mapping/i })).toBeInTheDocument();
  });
});
```

#### `src/features/field-mapping/__tests__/heuristics.test.ts`

**Analog:** `src/features/field-renderers/__tests__/StringRenderer.test.tsx` (lines 1–38 — pure unit test, no render):
```typescript
import { describe, expect, it } from 'vitest';
import type { FieldSchema } from '../../../types/fieldSchema';
import { findNameMatchSuggestion } from '../heuristics';

const makeField = (fieldId: string, name: string): FieldSchema => ({
  fieldId,
  name,
  required: false,
  schema: { type: 'string' },
});

describe('findNameMatchSuggestion', () => {
  it('returns null for empty target list', () => {
    expect(findNameMatchSuggestion('summary', 'Summary', [])).toBeNull();
  });

  it('matches by exact fieldId', () => {
    const field = makeField('summary', 'Summary Field');
    expect(findNameMatchSuggestion('summary', 'something-else', [field])).toBe(field);
  });

  it('matches case-insensitively on name', () => {
    const field = makeField('f1', 'Summary');
    expect(findNameMatchSuggestion('f2', 'SUMMARY', [field])).toBe(field);
  });

  it('matches via synonym', () => {
    const field = makeField('f1', 'Priority');
    expect(findNameMatchSuggestion('f2', 'severity', [field])).toBe(field);
  });
});
```

---

### `src/i18n/locales/en.json` and `sk.json` (modify)

**Analog:** Self — existing key groups at lines 58–71, 245–265.

**Key pattern to follow** (flat dot-notation, group prefix):
```json
// INSERT after "settings.group.about" block
"settings.group.copying": "Copying",
"settings.nav.fieldMapping": "Field Mapping",
"settings.section.fieldMapping": "Field Mapping",
"settings.fieldMapping.targetPlaceholder": "Select target field",
"settings.fieldMapping.targetAriaLabel": "target field",
"settings.fieldMapping.transformerPlaceholder": "Transformer",
"settings.fieldMapping.transformerAriaLabel": "transformer",
"settings.fieldMapping.deleteRow": "Remove mapping for {{source}}",
"settings.fieldMapping.addRow": "Add field mapping",
"settings.fieldMapping.saveError": "Failed to save mapping",
"settings.fieldMapping.deleteError": "Failed to delete mapping",
"settings.fieldMapping.refreshError": "Failed to refresh schema",
"settings.fieldMapping.refresh": "Refresh schema",
"settings.fieldMapping.refreshing": "Refreshing...",
"settings.fieldMapping.lastRefreshed": "Last refreshed {{time}}",
"settings.fieldMapping.neverRefreshed": "Not yet refreshed",
"settings.fieldMapping.suggestions.heading": "Suggestions ({{count}})",
"settings.fieldMapping.suggestions.accept": "Accept",
"settings.fieldMapping.suggestions.dismiss": "Dismiss",
"settings.fieldMapping.suggestions.empty": "No suggestions",
"settings.fieldMapping.drift.warning": "Target field removed from schema",
"settings.fieldMapping.drift.remove": "Remove",
"settings.fieldMapping.empty": "No field mappings yet",
"settings.fieldMapping.noIssueTypes": "No issue types prewarmed — open a ticket to populate the field list"
```

---

## Shared Patterns

### Tauri Invoke
**Source:** `src/features/connections/SettingsPage.tsx` lines 56–68 (ProjectSelector), 1256–1273 (PollingSection)
**Apply to:** `FieldMappingSection`, `MappingRow`, `SuggestionsPanel`
```typescript
// Pattern: invoke + local loading flag + catch console.error (non-interactive) or toast.error (interactive)
invoke<T>(commandName, args)
  .then((result) => {
    setState(result);
  })
  .catch(() => {
    setError(true); // or toast.error(...)
  });

// OR async/await form (preferred for multi-step):
try {
  const result = await invoke<T>(commandName, args);
  // ...
} catch {
  toast.error(t('...errorKey'));
}
```

### i18n
**Source:** `src/features/connections/SettingsPage.tsx` line 244, all string renders
**Apply to:** All new components
```typescript
const { t } = useTranslation();
// All user-facing strings via t(key) — no hardcoded English strings in JSX
```

### WCAG AA / Accessibility
**Source:** `src/features/connections/SettingsPage.tsx` lines 553–568 (`NavItem` focus-visible ring), 1281–1292 (aria-pressed pattern)
**Apply to:** All interactive elements in new components
```typescript
// Pattern: focus-visible ring + aria attributes
className="focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
// For comboboxes: aria-label per row (D-WCAG requirement)
ariaLabel={`${row.sourceFieldId} ${t('settings.fieldMapping.targetAriaLabel')}`}
// For drift warning: role="alert" (screen reader announcement)
role="alert"
// For suggestions dismiss: aria-label with source field name
aria-label={t('settings.fieldMapping.suggestions.dismiss', { source: s.sourceFieldId })}
```

### Lucide Icons
**Source:** `src/features/connections/SettingsPage.tsx` lines 3–16
**Apply to:** All new components that use icons
```typescript
// All icons imported from lucide-react; decorative icons get aria-hidden="true"
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, Plus, RefreshCw, X } from 'lucide-react';
<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
```

### cn() utility
**Source:** `src/features/connections/SettingsPage.tsx` line 22; `src/features/field-renderers/components/VirtualizedCombobox.tsx` line 8
**Apply to:** All new components with conditional classNames
```typescript
import { cn } from '@/lib/utils';
className={cn('base-classes', condition && 'conditional-class')}
```

### Skeleton loading state
**Source:** `src/features/connections/SettingsPage.tsx` line 20 (import)
**Apply to:** `FieldMappingSection` — 3 skeleton rows while `loading === true`
```tsx
import { Skeleton } from '@/components/ui/skeleton';
<div className="space-y-2">
  <Skeleton className="h-10 w-full" />
  <Skeleton className="h-10 w-full" />
  <Skeleton className="h-10 w-full" />
</div>
```

### Sonner Toast (new install)
**Source:** RESEARCH.md Pitfall 6 — `<Toaster />` must be mounted once in App root
**Apply to:** `App.tsx` (Wave 0 install step); then `toast.error()` in all new components
```typescript
// App.tsx — add once:
import { Toaster } from 'sonner';
// ...
<Toaster />

// Any component:
import { toast } from 'sonner';
toast.error(t('settings.fieldMapping.saveError'));
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/features/field-mapping/heuristics.ts` | utility | transform | No existing string-matching/heuristic utility in codebase. Pure function — use RESEARCH.md Pattern 7 directly. |

---

## Metadata

**Analog search scope:** `src/features/connections/`, `src/features/field-renderers/`, `src/stores/`, `src/types/`, `src/i18n/locales/`
**Files read:** 9 source files
**Pattern extraction date:** 2026-04-28
