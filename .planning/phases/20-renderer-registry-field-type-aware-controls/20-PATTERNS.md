# Phase 20: Renderer Registry + Field-Type-Aware Controls - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 22 new files
**Analogs found:** 19 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/field-renderers/types.ts` | types | — | `src/features/tickets/types.ts` | role-match |
| `src/features/field-renderers/registry.ts` | utility | transform | `src/types/fieldSchema.ts` (parseSchemaType) | partial-match |
| `src/features/field-renderers/DynamicTargetForm.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (target column) | role-match |
| `src/features/field-renderers/components/VirtualizedCombobox.tsx` | component | event-driven | `src/features/tickets/TicketFilterBar.tsx` (assignee autocomplete) | partial-match |
| `src/features/field-renderers/renderers/StringRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (summary input) | exact |
| `src/features/field-renderers/renderers/TextAreaRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (description textarea) | exact |
| `src/features/field-renderers/renderers/UrlRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (summary input) | role-match |
| `src/features/field-renderers/renderers/UserPickerRenderer.tsx` | component | event-driven | `src/features/tickets/TicketFilterBar.tsx` (assignee autocomplete) | role-match |
| `src/features/field-renderers/renderers/MultiUserPickerRenderer.tsx` | component | event-driven | `src/features/tickets/TicketFilterBar.tsx` (assignee autocomplete) | role-match |
| `src/features/field-renderers/renderers/GroupPickerRenderer.tsx` | component | request-response | `src/features/tickets/TicketFilterBar.tsx` (assignee autocomplete) | role-match |
| `src/features/field-renderers/renderers/SingleSelectRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (status select) | role-match |
| `src/features/field-renderers/renderers/MultiSelectRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (labels checkboxes) | role-match |
| `src/features/field-renderers/renderers/LabelsRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (labels checkboxes) | role-match |
| `src/features/field-renderers/renderers/ComponentPickerRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (labels checkboxes) | role-match |
| `src/features/field-renderers/renderers/VersionPickerRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (labels checkboxes) | role-match |
| `src/features/field-renderers/renderers/DateRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (summary input) | role-match |
| `src/features/field-renderers/renderers/DateTimeRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (summary input) | role-match |
| `src/features/field-renderers/renderers/NumberRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (summary input) | role-match |
| `src/features/field-renderers/renderers/CheckboxRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (labels checkboxes) | exact |
| `src/features/field-renderers/renderers/RadioRenderer.tsx` | component | request-response | `src/features/tickets/CopyPreviewModal.tsx` (labels checkboxes) | role-match |
| `src/features/field-renderers/renderers/UnsupportedTypeRenderer.tsx` | component | — | `src/components/ui/badge.tsx` + `src/features/tickets/StatusBadge.tsx` | role-match |
| `src/features/field-renderers/__tests__/*.test.tsx` | test | — | `src/features/tickets/__tests__/DescriptionRenderer.test.tsx` | exact |
| `src/i18n/locales/en.json` (modified) | config | — | `src/i18n/locales/en.json` (existing) | exact |
| `src/i18n/locales/sk.json` (modified) | config | — | `src/i18n/locales/sk.json` (existing) | exact |

---

## Pattern Assignments

### `src/features/field-renderers/types.ts` (types)

**Analog:** `src/features/tickets/types.ts`

**Imports pattern** (lines 1-0 — no imports; pure type declarations):
```typescript
// No imports — pure TypeScript interfaces and type aliases only.
// Types are imported by consumers via: import type { RendererProps, SearchCallbacks } from './types';
```

**Core type pattern** — follows the shape of `JiraUser` (line 11), `JiraComponent` (line 64), `JiraFixVersion` (line 69) in `src/features/tickets/types.ts`:
```typescript
// src/features/tickets/types.ts lines 11-17 — JiraUser shape (referenced by RendererProps)
export interface JiraUser {
  name?: string;
  accountId?: string;
  displayName: string;
  avatarUrls?: Record<string, string>;
  emailAddress?: string;
}
```

**RendererProps / SearchCallbacks shape** — locked by CONTEXT.md D-01/D-03/D-04/D-05. Copy this exact structure:
```typescript
import type { FieldSchema } from '@/types/fieldSchema';
import type { JiraUser } from '@/features/tickets/types';

export interface JiraComponent {
  id?: string;
  name: string;
}

export interface JiraVersion {
  id?: string;
  name: string;
  released?: boolean;
  archived?: boolean;
}

export interface SearchCallbacks {
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
  onFetchComponents?: () => Promise<JiraComponent[]>;
  onFetchVersions?: () => Promise<JiraVersion[]>;
}

export interface RendererProps {
  field: FieldSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  required?: boolean;
  disabled?: boolean;
  onSearch?: (q: string) => Promise<JiraUser[]>;
  initialQuery?: string;
}
```

---

### `src/features/field-renderers/registry.ts` (utility, transform)

**Analog:** `src/types/fieldSchema.ts` — the `parseSchemaType` switch (lines 150-185)

**The discrimination switch pattern** (lines 160-185 of `src/types/fieldSchema.ts`):
```typescript
// src/types/fieldSchema.ts lines 160-185 — switch on schema.type
switch (t) {
  case 'array': {
    const items = ...
    return { type: 'array', items, ... };
  }
  case 'issuetype':
    return { type: 'issuetype' };
  case 'priority':
    return { type: 'priority' };
  case 'any':
    return { type: 'any' };
  case 'string':
  case 'number':
  // ...
    return { type: t, system, custom, customId };
  default:
    return { type: 'any' };
}
```

**Imports pattern** — mirror the import block from `src/types/fieldSchema.ts` (no external imports needed; all types are local):
```typescript
import type { FieldSchemaType } from '@/types/fieldSchema';
import type { RendererProps } from './types';
import type React from 'react';
// One import per renderer file — follow the same named-export pattern
import { StringRenderer } from './renderers/StringRenderer';
// ...all other renderers...
```

**Key implementation note:** `getRenderer` returns a `React.ComponentType<RendererProps>` (a component class/function reference), NOT a rendered JSX element. The switch structure nests identically to `parseSchemaType`: check `type === 'array'` first (inner switch on `items`), then scalar types, then `default: return UnsupportedTypeRenderer`. Match `FieldSchemaType`'s exhaustive `type` variants: `'string'`, `'number'`, `'date'`, `'datetime'`, `'user'`, `'array'`, `'option'`, `'option-with-child'`, `'issuetype'`, `'priority'`, `'any'`.

---

### `src/features/field-renderers/DynamicTargetForm.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — the right-side target column (lines 222-346)

**Imports pattern** (lines 1-21 of `CopyPreviewModal.tsx`):
```typescript
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { FieldSchema } from '@/types/fieldSchema';
import { getRenderer } from './registry';
import type { SearchCallbacks } from './types';
```

**Stateless field iteration pattern** — extract from CopyPreviewModal's target column (lines 226-346):
```tsx
// CopyPreviewModal.tsx lines 229-247 — label + input field row pattern
<div className="mb-3">
  <label
    htmlFor="copy-target-summary"
    className="text-xs text-brand-muted block mb-1"
  >
    Summary
  </label>
  <input
    id="copy-target-summary"
    type="text"
    value={targetSummary}
    onChange={(e) => setTargetSummary(e.target.value)}
    className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
  />
</div>
```

**DynamicTargetForm iterates this pattern** — one `<div>` per field with a `<label>` + rendered component:
```tsx
// Pattern: label wrapper + Renderer component, called with getRenderer(field.schema)
// key={field.fieldId} on the outer div for React reconciliation
// required asterisk: <span className="text-destructive font-semibold ml-0.5"> *</span>
// Follow the label className from CopyPreviewModal: "text-xs text-brand-muted block mb-1"
```

---

### `src/features/field-renderers/components/VirtualizedCombobox.tsx` (component, event-driven)

**Analog:** `src/features/tickets/TicketFilterBar.tsx` — assignee autocomplete section (lines 31-216)

**Click-outside pattern** (lines 43-56 of `TicketFilterBar.tsx`):
```typescript
// TicketFilterBar.tsx lines 43-56 — useEffect click-outside close
useEffect(() => {
  function handleMouseDown(e: MouseEvent) {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(e.target as Node) &&
      inputRef.current &&
      !inputRef.current.contains(e.target as Node)
    ) {
      setShowSuggestions(false);
    }
  }
  document.addEventListener('mousedown', handleMouseDown);
  return () => document.removeEventListener('mousedown', handleMouseDown);
}, []);
```

**Dropdown open/close state pattern** (lines 33-40 of `TicketFilterBar.tsx`):
```typescript
// TicketFilterBar.tsx lines 33-40 — state for suggestions dropdown
const [userQuery, setUserQuery] = useState('');
const [suggestions, setSuggestions] = useState<JiraUser[]>([]);
const [showSuggestions, setShowSuggestions] = useState(false);
const [noResults, setNoResults] = useState(false);
const [selectedIdx, setSelectedIdx] = useState(-1);
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const inputRef = useRef<HTMLInputElement>(null);
const dropdownRef = useRef<HTMLDivElement>(null);
```

**Dropdown container CSS pattern** (lines 182-188 of `TicketFilterBar.tsx`):
```tsx
// TicketFilterBar.tsx lines 182-188 — dropdown absolute positioning
<div
  ref={dropdownRef}
  role="listbox"
  className="absolute top-full left-0 right-0 mt-1 bg-brand-surface border border-brand-border shadow-lg rounded-md max-h-48 overflow-y-auto z-50"
>
```

**Critical VirtualizedCombobox differences from TicketFilterBar:**
- VirtualizedCombobox uses `cmdk` `Command` + `Command.Input` instead of raw `<input>`. Set `shouldFilter={false}` on `<Command>`.
- Inner list div (`ref={listRef}`) is the scroll element for `useVirtualizer`. Must have `style={{ height: '280px', overflow: 'auto' }}`.
- `useVirtualizer({ count: filtered.length, getScrollElement: () => listRef.current, estimateSize: () => 36, overscan: 5, useFlushSync: false })`.
- Virtual items render as `Command.Item` with absolute positioning: `style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: virtualRow.size, transform: translateY(virtualRow.start) }}`.
- `Button variant="outline"` from `@/components/ui/button` (lines 39-48 of `button.tsx`) as the trigger — `size="sm"` gives `h-9` (36px, matching locked row height).
- Generic `<T>` parameter; `displayLabel: (item: T) => string` and `filterFn: (item: T, query: string) => boolean` props.
- `onSearch?: (q: string) => Promise<T[]>` for async user search; debounce pattern copied from TicketFilterBar's `debounceRef` + `setTimeout` at 250ms (line 71).

**Button import for trigger** (lines 1-4 of `button.tsx`):
```typescript
// src/components/ui/button.tsx lines 1-4
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';
```

---

### `src/features/field-renderers/renderers/StringRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — summary input (lines 249-265)

**Input pattern** (lines 249-265 of `CopyPreviewModal.tsx`):
```tsx
// CopyPreviewModal.tsx lines 249-265 — text input with brand styling
<input
  id="copy-target-summary"
  type="text"
  value={targetSummary}
  onChange={(e) => setTargetSummary(e.target.value)}
  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
/>
```

**Controlled input pattern for all simple renderers:**
- Import: `import { useTranslation } from 'react-i18next'; import { cn } from '@/lib/utils';`
- Props: destructure `{ field, value, onChange, required, disabled }` from `RendererProps`
- Cast value: `const strValue = typeof value === 'string' ? value : ''`
- Render `<input type="text" value={strValue} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-required={required} />`
- No `useState` — fully controlled from `RendererProps.value` + `onChange`

---

### `src/features/field-renderers/renderers/TextAreaRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — description textarea (lines 331-345)

**Textarea pattern** (lines 331-345 of `CopyPreviewModal.tsx`):
```tsx
// CopyPreviewModal.tsx lines 331-345 — textarea with brand styling
<textarea
  id="copy-target-description"
  value={targetDescription}
  onChange={(e) => setTargetDescription(e.target.value)}
  rows={8}
  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1.5 text-sm font-mono resize-y focus-visible:ring-2 focus-visible:ring-brand"
/>
```

TextAreaRenderer uses `<textarea>` instead of `<input type="text">`. Drop `font-mono` (description is code; summary/general text fields are not). Add `rows={4}` as the default (not 8).

---

### `src/features/field-renderers/renderers/UrlRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — summary input (lines 249-265)

Same pattern as StringRenderer but `type="url"` and `inputMode="url"`. Add `pattern="https?://.*"` for HTML5 client-side hint only. No additional imports needed.

---

### `src/features/field-renderers/renderers/UserPickerRenderer.tsx` (component, event-driven)

**Analog:** `src/features/tickets/TicketFilterBar.tsx` — assignee autocomplete (lines 31-216)

**Debounce + async search pattern** (lines 58-87 of `TicketFilterBar.tsx`):
```typescript
// TicketFilterBar.tsx lines 58-87 — debounced invoke (adapt: replace invoke with onSearch callback)
function handleUserQueryChange(value: string) {
  setUserQuery(value);
  setSelectedIdx(-1);
  setNoResults(false);

  if (debounceRef.current) clearTimeout(debounceRef.current);

  if (value.trim().length === 0) {
    setSuggestions([]);
    setShowSuggestions(false);
    return;
  }

  debounceRef.current = setTimeout(async () => {
    // ADAPT: replace invoke('search_jira_users', ...) with props.onSearch(value.trim())
    try {
      const users = await invoke<JiraUser[]>('search_jira_users', {
        baseUrl: serverConn.baseUrl,
        query: value.trim(),
      });
      setSuggestions(users);
      setNoResults(users.length === 0);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
      setNoResults(false);
      setShowSuggestions(false);
    }
  }, 250);
}
```

**Key adaptations from TicketFilterBar:**
- Replace `invoke('search_jira_users', ...)` with `await onSearch(value.trim())`. No `serverConn` access — no Zustand in renderers.
- Add `initialQuery` useEffect: `useEffect(() => { if (initialQuery && onSearch) { onSearch(initialQuery).then(setSuggestions); } }, [])` — empty dep array intentional (mount only, D-03).
- Selected user display chip reuses `UserAvatar` from `src/features/tickets/UserAvatar.tsx` (same import in TicketFilterBar line 7).
- All state stays local: `[suggestions, setSuggestions]`, `[showSuggestions, setShowSuggestions]`, `[selectedIdx, setSelectedIdx]`, `[noResults, setNoResults]`.
- Use VirtualizedCombobox as the dropdown rather than the hand-rolled listbox in TicketFilterBar — `UserPickerRenderer` is a thin wrapper that injects `items={suggestions}`, `onSearch={onSearch}` (triggers debounced search), `displayLabel={(u) => u.displayName}`, `filterFn={(u, q) => u.displayName.toLowerCase().includes(q.toLowerCase())}`.

**UserAvatar reuse** (lines 1-2 of `UserAvatar.tsx`):
```typescript
// src/features/tickets/UserAvatar.tsx lines 1-7
import { useState } from 'react';
import type { JiraUser } from './types';
// Usage: <UserAvatar user={selectedUser} size="sm" />
// Props: user: JiraUser | null, size?: 'sm' | 'md'
```

---

### `src/features/field-renderers/renderers/MultiUserPickerRenderer.tsx` (component, event-driven)

**Analog:** `src/features/tickets/TicketFilterBar.tsx` + selected chip pattern (lines 149-165)

**Selected chip pattern** (lines 149-165 of `TicketFilterBar.tsx`):
```tsx
// TicketFilterBar.tsx lines 149-165 — selected assignee chip with remove button
<span className="inline-flex items-center gap-1 bg-brand/10 text-brand text-sm rounded-full px-2.5 py-0.5 h-8">
  <UserAvatar user={selectedUser} size="sm" />
  <span className="truncate max-w-[140px]">{assigneeFilter}</span>
  <button
    type="button"
    onClick={() => { onAssigneeChange(''); setSelectedUser(null); }}
    aria-label={t('tickets.filter.clearAssignee')}
    className="shrink-0 text-brand/70 hover:text-brand transition-colors duration-150"
  >
    <X className="w-3 h-3" aria-hidden="true" />
  </button>
</span>
```

MultiUserPickerRenderer renders an array of these chips (one per `JiraUser` in `value as JiraUser[]`) plus VirtualizedCombobox to add more. No UnresolvedPerson handling (D-02). `onChange` replaces the entire array.

---

### `src/features/field-renderers/renderers/GroupPickerRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/TicketFilterBar.tsx` dropdown pattern

Thin wrapper around `VirtualizedCombobox` with static `allowedValues` from `field.allowedValues` (cast to `Array<{ name: string }>`). `displayLabel={(g) => g.name}`, `filterFn={(g, q) => g.name.toLowerCase().includes(q.toLowerCase())}`. No `onSearch`. Single-select.

---

### `src/features/field-renderers/renderers/SingleSelectRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — status select (lines 270-286)

**Static select pattern** (lines 270-286 of `CopyPreviewModal.tsx`):
```tsx
// CopyPreviewModal.tsx lines 270-286 — <select> with brand styling
<select
  id="copy-target-status"
  value={targetStatus}
  onChange={(e) => setTargetStatus(e.target.value)}
  className="w-full bg-brand-surface border border-brand-border rounded px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-brand"
>
  {cloudMeta.availableStatuses.map((s) => (
    <option key={s.id} value={s.name}>
      {s.name}
    </option>
  ))}
</select>
```

However, SingleSelectRenderer uses `VirtualizedCombobox` instead of `<select>` (D-08). The analog shows the value-driven controlled pattern. `allowedValues` come from `field.allowedValues` cast to `Array<{ id?: string; name: string; value?: string }>`. `displayLabel={(opt) => opt.name ?? opt.value ?? String(opt)}`.

---

### `src/features/field-renderers/renderers/MultiSelectRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — labels checkboxes (lines 311-328)

**Checkbox list pattern** (lines 311-328 of `CopyPreviewModal.tsx`):
```tsx
// CopyPreviewModal.tsx lines 311-328 — label checkboxes controlled by selected array
{targetLabels.map((label) => (
  <label key={label} className="flex items-center gap-2 py-1 text-sm">
    <input
      type="checkbox"
      checked={selectedLabels.includes(label)}
      onChange={() => toggleLabel(label)}
    />
    {label}
  </label>
))}
```

MultiSelectRenderer uses `VirtualizedCombobox` with multi-select support (D-08). `value` is `unknown[]`; `onChange` receives the updated array. Selected items render as chips (similar to MultiUserPickerRenderer chip pattern) above the combobox trigger. Each chip has an `×` remove button.

---

### `src/features/field-renderers/renderers/LabelsRenderer.tsx` (component, request-response)

Same pattern as MultiSelectRenderer. `allowedValues` contains `string[]` for label suggestions. `displayLabel={(s) => s}`, `filterFn={(s, q) => s.toLowerCase().includes(q.toLowerCase())}`. `value` is `string[]`. Free-text entry is also acceptable — user can type a new label and press Enter to add it.

---

### `src/features/field-renderers/renderers/ComponentPickerRenderer.tsx` (component, request-response)

Same pattern as MultiSelectRenderer. `allowedValues` contains `Array<{ id?: string; name: string }>`. `displayLabel={(c) => c.name}`. Multi-select; renders chips.

---

### `src/features/field-renderers/renderers/VersionPickerRenderer.tsx` (component, request-response)

Same pattern as MultiSelectRenderer. `allowedValues` contains `Array<{ id?: string; name: string; released?: boolean; archived?: boolean }>`. `displayLabel={(v) => v.name}`. Multi-select; renders chips.

---

### `src/features/field-renderers/renderers/DateRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — summary input (lines 249-265)

Same controlled input pattern as StringRenderer but `type="date"`. Value is `string` in `YYYY-MM-DD` format. Cast: `const dateValue = typeof value === 'string' ? value : ''`.

---

### `src/features/field-renderers/renderers/DateTimeRenderer.tsx` (component, request-response)

Same as DateRenderer but `type="datetime-local"`. Value in `YYYY-MM-DDTHH:mm` format.

---

### `src/features/field-renderers/renderers/NumberRenderer.tsx` (component, request-response)

Same as StringRenderer but `type="number"`. Cast: `const numValue = typeof value === 'number' ? String(value) : ''`. `onChange` calls `onChange(Number(e.target.value))`.

---

### `src/features/field-renderers/renderers/CheckboxRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — labels checkboxes (lines 311-328)

**Checkbox group pattern** (lines 311-328 of `CopyPreviewModal.tsx`) — used directly. One `<input type="checkbox">` per entry in `field.allowedValues`. `value` is `string[]` of selected option values. `onChange` propagates the updated `string[]`.

---

### `src/features/field-renderers/renderers/RadioRenderer.tsx` (component, request-response)

**Analog:** `src/features/tickets/CopyPreviewModal.tsx` — status select (lines 270-286)

Similar to CheckboxRenderer but mutually exclusive. Render `<div role="radiogroup">` containing one `<label><input type="radio"> {option.name}</label>` per `allowedValues` entry. `value` is `string` (single selection). `onChange` propagates the selected option value string.

---

### `src/features/field-renderers/renderers/UnsupportedTypeRenderer.tsx` (component, display)

**Analog:** `src/components/ui/badge.tsx` + `src/features/tickets/StatusBadge.tsx`

**Badge variant pattern** (lines 29-31 of `badge.tsx`):
```tsx
// src/components/ui/badge.tsx lines 29-31 — Badge component with cn()
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

**Imports for UnsupportedTypeRenderer:**
```typescript
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import type { RendererProps } from '../types';
```

No `onChange`. `role="status"`. Read-only pill — `variant="outline"`. `aria-label` includes `field.schema.type`. No interactivity.

---

### `src/features/field-renderers/__tests__/*.test.tsx` (tests)

**Analog:** `src/features/tickets/__tests__/DescriptionRenderer.test.tsx` (full file)

**Test file structure** (lines 1-64 of `DescriptionRenderer.test.tsx`):
```typescript
// DescriptionRenderer.test.tsx lines 1-8 — test file header pattern
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { DescriptionRenderer } from '../DescriptionRenderer';
```

**Critical difference for Phase 20 renderer tests:** Phase 20 renderers do NOT call `invoke` directly (D-01). No Tauri mock needed in renderer tests. The `vi.mock('@tauri-apps/api/core', ...)` line is NOT required. Tests pass mock props directly:
```typescript
// CORRECT pattern for Phase 20 renderers (no Tauri mock needed)
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StringRenderer } from '../renderers/StringRenderer';

const baseProps = {
  field: { fieldId: 'summary', name: 'Summary', required: false, schema: { type: 'string' as const } },
  value: 'Hello',
  onChange: vi.fn(),
};
```

**i18n in tests:** The project's `src/test-setup.ts` (line 2) imports `./i18n/index` globally so `useTranslation()` works in all tests without a wrapper. Use plain `render()`, not `renderWithI18n()`, unless the test specifically needs to check translated strings in a non-default locale.

**Async test pattern with fake timers** (from `TicketFilterBar.test.tsx` lines 229-278):
```typescript
// For UserPickerRenderer tests that test debounced onSearch:
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('calls onSearch after debounce when typing', async () => {
  const onSearch = vi.fn().mockResolvedValue([]);
  render(<UserPickerRenderer {...baseProps} onSearch={onSearch} />);
  // fire change...
  await act(async () => {
    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();
  });
  expect(onSearch).toHaveBeenCalledWith('query');
});
```

**Act + async pattern** (lines 269-271 of `TicketFilterBar.test.tsx`):
```typescript
await act(async () => {
  vi.advanceTimersByTime(300);
  await vi.runAllTimersAsync();
});
```

---

### `src/i18n/locales/en.json` and `sk.json` (modified, config)

**Analog:** Existing `src/i18n/locales/en.json` flat-key structure (lines 1-50+)

**Key format pattern** (flat dot-notation, lines 1-10 of `en.json`):
```json
{
  "nav.tickets": "Tickets",
  "common.loading": "Loading...",
  "tickets.filter.keyPlaceholder": "Filter by key..."
}
```

**New keys to add** — both files must be updated together (translations.test.ts line 9 enforces identical key sets):
```json
// en.json additions:
"fieldRenderer.select": "Select…",
"fieldRenderer.searchUsers": "Search users…",
"fieldRenderer.noResults": "No results found.",
"fieldRenderer.unsupportedType": "Unsupported type: {{type}}",
"fieldRenderer.loading": "Loading…",
"fieldRenderer.clearSelection": "Clear selection",
"fieldRenderer.removeItem": "Remove {{item}}"

// sk.json additions (Slovak):
"fieldRenderer.select": "Vybrať…",
"fieldRenderer.searchUsers": "Hľadať používateľov…",
"fieldRenderer.noResults": "Žiadne výsledky.",
"fieldRenderer.unsupportedType": "Nepodporovaný typ: {{type}}",
"fieldRenderer.loading": "Načítava sa…",
"fieldRenderer.clearSelection": "Zrušiť výber",
"fieldRenderer.removeItem": "Odstrániť {{item}}"
```

**Translation parity requirement** — `translations.test.ts` line 9 asserts `en.json` and `sk.json` have identical key sets. Adding a key to `en.json` without adding it to `sk.json` will fail the test suite.

---

## Shared Patterns

### `cn()` — className merging
**Source:** `src/lib/utils.ts` (full file, 6 lines)
**Apply to:** All component files in `src/features/field-renderers/`
```typescript
// src/lib/utils.ts lines 1-6
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
// Import as: import { cn } from '@/lib/utils';
```

### `useTranslation()` — i18n strings
**Source:** `src/features/tickets/TicketFilterBar.tsx` line 4 + `src/features/tickets/CopyPreviewModal.tsx` line 5
**Apply to:** All renderer components with user-facing text (placeholders, labels, error states)
```typescript
import { useTranslation } from 'react-i18next';
// Usage in component:
const { t } = useTranslation();
// Then: placeholder={t('fieldRenderer.select')}
```

### Tailwind brand color tokens
**Source:** `src/features/tickets/CopyPreviewModal.tsx` className patterns throughout
**Apply to:** All renderer component className strings
```
bg-brand-surface        — control background
border-brand-border     — control border
text-brand-text         — primary text
text-brand-muted        — placeholder/secondary text
focus-visible:ring-2 focus-visible:ring-brand  — focus ring (WCAG AA)
text-destructive        — required-field asterisk color
bg-brand/10 text-brand  — selected chip background (UserAvatar chip pattern)
```

### Controlled-input `value` cast pattern
**Source:** `src/features/tickets/CopyPreviewModal.tsx` — all inputs use `.value` from store state
**Apply to:** StringRenderer, TextAreaRenderer, UrlRenderer, DateRenderer, DateTimeRenderer, NumberRenderer
```typescript
// Pattern: cast unknown prop value to the expected primitive before passing to input
const strValue = typeof value === 'string' ? value : '';
// For number:
const numValue = typeof value === 'number' ? String(value) : '';
// For arrays:
const arrValue = Array.isArray(value) ? value : [];
```

### Error handling (graceful degradation)
**Source:** `src/features/tickets/TicketFilterBar.tsx` lines 80-86 + `src/stores/schemaCacheStore.ts` lines 52-59
**Apply to:** UserPickerRenderer (async `onSearch`), VirtualizedCombobox (`onSearch` prop)
```typescript
// TicketFilterBar.tsx lines 80-86 — catch and reset state, no re-throw
} catch {
  setSuggestions([]);
  setNoResults(false);
  setShowSuggestions(false);
}
// Also from schemaCacheStore.ts — graceful empty fallback:
// set({ cache: { ...get().cache, [key]: { status: 'error', error: msg } } });
```

### Named export (not default export)
**Source:** All existing feature components: `TicketFilterBar.tsx` line 19 (`export function TicketFilterBar`), `UserAvatar.tsx` line 33 (`export function UserAvatar`), `CopyPreviewModal.tsx` line 69 (`export function CopyPreviewModal`)
**Apply to:** All files in `src/features/field-renderers/` — use named exports only, never `export default`

### `@/` path alias
**Source:** `vitest.config.ts` alias `"@": path.resolve(__dirname, "./src")`, used throughout codebase
**Apply to:** All imports across `src/features/field-renderers/` — use `@/` for cross-feature imports:
```typescript
import { cn } from '@/lib/utils';
import type { FieldSchema, FieldSchemaType } from '@/types/fieldSchema';
import type { JiraUser } from '@/features/tickets/types';
import { UserAvatar } from '@/features/tickets/UserAvatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
```
Within the `field-renderers` feature, use relative imports: `'./registry'`, `'../types'`, `'./renderers/StringRenderer'`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/features/field-renderers/registry.ts` (full `getRenderer` function) | utility | transform | No registry/dispatcher pattern exists in the codebase yet. The `parseSchemaType` switch in `fieldSchema.ts` is the closest structural analog but returns data, not components. |
| `src/features/field-renderers/components/VirtualizedCombobox.tsx` | component | event-driven | No cmdk or @tanstack/react-virtual usage exists yet. TicketFilterBar is a partial analog (dropdown + click-outside + debounce) but hand-rolls all list rendering. |

For these two files, use the code examples in RESEARCH.md Pattern 1 (getRenderer switch) and Pattern 2 (VirtualizedCombobox with cmdk + useVirtualizer) as the primary reference — they are locked designs from CONTEXT.md D-10/D-11 and D-08/D-09.

---

## Metadata

**Analog search scope:** `src/features/tickets/`, `src/components/ui/`, `src/lib/`, `src/types/`, `src/stores/`, `src/i18n/`
**Files scanned:** 14 analog files read in full
**Pattern extraction date:** 2026-04-27
