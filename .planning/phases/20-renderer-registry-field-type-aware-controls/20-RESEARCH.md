# Phase 20: Renderer Registry + Field-Type-Aware Controls - Research

**Researched:** 2026-04-27
**Domain:** React component registry, cmdk combobox, @tanstack/react-virtual virtualization, shadcn/ui field renderers
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** `UserPickerRenderer` and `MultiUserPickerRenderer` accept `onSearch: (q: string) => Promise<JiraUser[]>` as a required prop. Renderers never call `invoke` directly. Phase 22 injects the real Tauri call; tests pass a mock function.

**D-02:** `MultiUserPickerRenderer` renders only `JiraUser[]` it receives. Does NOT handle `UnresolvedPerson` gap variants. Phase 22 injects the "unresolved — search manually" chip.

**D-03:** `UserPickerRenderer` accepts `initialQuery?: string`. On mount it auto-triggers `onSearch(initialQuery)` if provided.

**D-04:** `DynamicTargetForm` is a stateless shell: `({ fields: FieldSchema[], values: Record<string, unknown>, onChange: (fieldId: string, v: unknown) => void, searchCallbacks?: SearchCallbacks })`.

**D-05:** Async callbacks flow through `SearchCallbacks` prop bag: `{ onSearchUsers?: (q: string) => Promise<JiraUser[]>; onFetchComponents?: () => Promise<JiraComponent[]>; onFetchVersions?: () => Promise<JiraVersion[]> }`. When omitted, renderers default to returning empty arrays.

**D-06:** All files live under `src/features/field-renderers/` with the exact structure defined in CONTEXT.md.

**D-07:** All pickers except user use static `allowedValues` from `FieldSchema` (already fetched by Phase 17 discovery). No async needed for non-user pickers.

**D-08:** All picker renderers use `VirtualizedCombobox` unconditionally — no branching on list size. cmdk + `@tanstack/react-virtual` with `useFlushSync: false` for React 19.

**D-09:** `VirtualizedCombobox<T>` is a shared base component. Accepts: `items: T[]`, `displayLabel: (item: T) => string`, `filterFn: (item: T, query: string) => boolean`, `value/onChange`, optional `onSearch` for async loading.

**D-10:** `getRenderer` is the single discrimination function. For `type === 'array'`, branches on `items`. Falls through to `UnsupportedTypeRenderer` for `type === 'any'` or unknown combination.

**D-11:** For `type === 'string'`, branches on `schema.system`: `'description'` → TextAreaRenderer, `'url'` → UrlRenderer, everything else → StringRenderer.

**D-12:** Adding a new field type = one new renderer file + one new case in `registry.ts`. No changes to `DynamicTargetForm`.

### Claude's Discretion

- Exact TypeScript generics for `VirtualizedCombobox<T>` internal hook wiring
- Whether `RendererProps` is one unified interface or per-renderer-type interfaces (unified with optional fields is simpler)
- Exact cmdk + @tanstack/react-virtual row height and overscan settings (UI-SPEC locks: 36px row height, 5 overscan)
- Whether `SearchCallbacks` interface lives in `types.ts` or `DynamicTargetForm.tsx`
- Debounce timing for user search (likely 300ms to match `TicketFilterBar` pattern)
- Exact label/style for `UnsupportedTypeRenderer` pill — should show field name + type for debugging

### Deferred Ideas (OUT OF SCOPE)

- UnresolvedPerson gap chips in Phase 20 (Phase 22 owns)
- Storybook for renderer visual catalog
- Per-copy-session version/component cache in renderer
- `searchCallbacks.onFetchVersions` / `onFetchComponents` as lazy loaders (Phase 20 uses static `allowedValues`)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTRL-01 | User sees a target control for: text, multi-line text, URL | StringRenderer, TextAreaRenderer, UrlRenderer — D-11 discriminates via `schema.system` |
| CTRL-02 | User sees a target control for: single user, multi user, group | UserPickerRenderer, MultiUserPickerRenderer (async `onSearch`), GroupPickerRenderer (static `allowedValues`) |
| CTRL-03 | User sees a target control for: single select, multi select, labels | SingleSelectRenderer, MultiSelectRenderer, LabelsRenderer — all use `VirtualizedCombobox` with `allowedValues` |
| CTRL-04 | User sees a target control for: components, versions | ComponentPickerRenderer, VersionPickerRenderer — `VirtualizedCombobox` with `allowedValues` |
| CTRL-05 | User sees a target control for: date, datetime, number | DateRenderer (`<input type="date">`), DateTimeRenderer (`<input type="datetime-local">`), NumberRenderer (`<input type="number">`) |
| CTRL-06 | User sees a target control for: checkboxes, radio | CheckboxRenderer (one `<input type="checkbox">` per allowed value), RadioRenderer (`role="radiogroup"`) |
| CTRL-07 | User sees read-only "Unsupported type" pill for unregistered types | UnsupportedTypeRenderer — Badge variant=outline with `role="status"`, never crashes |
| CTRL-08 | Combobox/picker with 5,000+ items has no observable lag | VirtualizedCombobox with `useVirtualizer` (fixed 36px row) + `useFlushSync: false` + `shouldFilter: false` on cmdk Command |
</phase_requirements>

---

## Summary

Phase 20 delivers a pure-frontend React component registry for Jira field types. The output is `getRenderer(schema: FieldSchemaType)` — a single function that maps every discriminant in the `FieldSchemaType` discriminated union to a dedicated React renderer component. A stateless shell `DynamicTargetForm` iterates a `FieldSchema[]` array, calls `getRenderer` per field, and renders each component. No Zustand state, no Tauri invokes live inside these components.

The central technical challenge is the `VirtualizedCombobox` base component: all picker renderers reuse it unconditionally, so it must work correctly whether it holds 5 items (static single-select) or 5,000+ items (components/versions). The solution is cmdk `1.1.1` (peer-compatible with React 19) with `shouldFilter={false}` so cmdk doesn't sort/filter its virtual children, combined with `@tanstack/react-virtual` `3.13.24` `useVirtualizer` at fixed 36px row height and `useFlushSync: false` — the React 19-required setting that stops the console warning from `flushSync` calls during scroll events. The cmdk `Command.List` receives one synthetic child wrapping the virtualizer output rather than individual `Command.Item` components, which means the accessibility ARIA roles must be set manually.

The remaining 14 renderer files are straightforward: simple HTML inputs (`<input type="date">`, `<input type="number">`, `<textarea>`, etc.) or thin wrappers around `VirtualizedCombobox` with domain-specific `displayLabel` and `filterFn`. The `UnsupportedTypeRenderer` is a read-only `Badge` pill — no `onChange`, no interactivity, `role="status"`. All user-facing strings go through `useTranslation()` with a new `fieldRenderer.*` key namespace.

**Primary recommendation:** Build `VirtualizedCombobox` first in Wave 1 (with full tests), then implement simple renderers and the registry in Wave 2 (with renderer isolation tests), then `DynamicTargetForm` and integration tests in Wave 3.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `getRenderer` discrimination logic | Frontend (component module) | — | Pure TypeScript function — no backend involvement |
| `DynamicTargetForm` layout shell | Frontend component | — | Stateless presentation; state owned by Phase 22 |
| `VirtualizedCombobox` base | Frontend component | — | Scroll virtualization is entirely client-side DOM |
| User search (async) | API / Backend (Phase 22) | Frontend UI only receives `onSearch` callback | Tauri invoke lives outside Phase 20 renderers |
| Picker `allowedValues` data | Backend (Phase 17 discovery) | Frontend reads from `FieldSchema.allowedValues` prop | Already fetched at copy time — no Phase 20 fetch |
| i18n translation strings | Frontend (i18next) | — | Existing i18next infrastructure; add `fieldRenderer.*` namespace |
| a11y / ARIA on custom combobox | Frontend component | — | cmdk handles keyboard nav; manual ARIA roles for virtual list |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cmdk | 1.1.1 | Combobox + command-palette primitive; keyboard nav, accessible | Peer-compatible with React 18 + 19; already referenced in project context as the project's combobox foundation |
| @tanstack/react-virtual | 3.13.24 | Row virtualization for 5,000+ item lists | Industry standard for large-list virtualization in React; `useFlushSync: false` option added for React 19 |

[VERIFIED: npm registry — `npm view cmdk version` → 1.1.1; `npm view @tanstack/react-virtual version` → 3.13.24]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-popover | 1.1.15 | Popover container for the VirtualizedCombobox dropdown | Required if using Radix popover for combobox trigger/content split; alternative is a CSS-positioned div |
| clsx + tailwind-merge (via `cn()`) | already installed | className composition | All new components use `cn()` from `src/lib/utils` |

[VERIFIED: npm registry — `npm view @radix-ui/react-popover version` → 1.1.15]

Note on `@radix-ui/react-popover`: The project already uses Radix primitives heavily but does NOT currently have `@radix-ui/react-popover` installed. [ASSUMED] The VirtualizedCombobox popover can be implemented as a CSS-positioned `div` with a `useClickOutside` hook instead of Radix Popover, avoiding an extra package. This is a planner decision — both approaches are valid; the CSS approach is zero-dependency but requires manual focus/dismiss logic, the Radix approach is more robust but requires `npm install @radix-ui/react-popover`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-virtual | react-window | react-window is older, less actively maintained, no useFlushSync option |
| cmdk for combobox | Radix Select | Radix Select has no search input; cmdk provides Command.Input built-in |
| Custom popover (CSS div) | @radix-ui/react-popover | Radix Popover handles focus trap, close-on-outside-click, portal — less hand-rolling |

**Installation (new packages):**

```bash
npm install cmdk @tanstack/react-virtual
# If choosing Radix Popover for combobox container:
npm install @radix-ui/react-popover
```

**Version verification:**

```
npm view cmdk version          → 1.1.1   (2024, React 18+19 peer deps)
npm view @tanstack/react-virtual version → 3.13.24 (2024, React 16-19 peer deps)
npm view @radix-ui/react-popover version → 1.1.15
```

[VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
FieldSchema[] (from Phase 17 discovery / Phase 19 mapping rows)
        │
        ▼
DynamicTargetForm (stateless shell)
        │ calls getRenderer(field.schema) per field
        ▼
registry.ts ─── getRenderer(schema: FieldSchemaType)
        │
        ├── type='string', system='description'  → TextAreaRenderer
        ├── type='string', system='url'           → UrlRenderer
        ├── type='string' (other)                 → StringRenderer
        ├── type='number'                         → NumberRenderer
        ├── type='date'                           → DateRenderer
        ├── type='datetime'                       → DateTimeRenderer
        ├── type='user'                           → UserPickerRenderer
        │                                              │ onSearch callback → Phase 22 injects invoke
        ├── type='option'                         → SingleSelectRenderer
        │                                              │ uses VirtualizedCombobox
        ├── type='array', items='user'            → MultiUserPickerRenderer
        ├── type='array', items='option'          → MultiSelectRenderer ──────┐
        ├── type='array', items='component'       → ComponentPickerRenderer ──┤
        ├── type='array', items='version'         → VersionPickerRenderer ────┤ all use
        ├── type='array', items='string'          → LabelsRenderer ────────────┤ VirtualizedCombobox
        ├── type='array', items='group'           → GroupPickerRenderer ───────┘
        ├── type='option-with-child'              → UnsupportedTypeRenderer
        ├── type='issuetype'                      → UnsupportedTypeRenderer
        ├── type='priority'                       → UnsupportedTypeRenderer
        └── type='any' / unknown                  → UnsupportedTypeRenderer

VirtualizedCombobox<T>
  ├── cmdk Command (shouldFilter=false)
  │     ├── Command.Input (search text, debounced for async)
  │     └── Command.List
  │           └── synthetic div (getTotalSize height, position:relative)
  │                 └── @tanstack/react-virtual getVirtualItems()
  │                       └── Command.Item per visible virtual row
  └── Trigger: Button variant=outline (full width, shows selection or placeholder)
```

### Recommended Project Structure

```
src/features/field-renderers/
  registry.ts                    # getRenderer(schema) → React component
  DynamicTargetForm.tsx          # stateless shell iterating fields
  types.ts                       # RendererProps, SearchCallbacks interfaces
  components/
    VirtualizedCombobox.tsx      # shared cmdk + @tanstack/react-virtual base
  renderers/
    StringRenderer.tsx
    TextAreaRenderer.tsx
    UrlRenderer.tsx
    UserPickerRenderer.tsx
    MultiUserPickerRenderer.tsx
    GroupPickerRenderer.tsx
    SingleSelectRenderer.tsx
    MultiSelectRenderer.tsx
    LabelsRenderer.tsx
    ComponentPickerRenderer.tsx
    VersionPickerRenderer.tsx
    DateRenderer.tsx
    DateTimeRenderer.tsx
    NumberRenderer.tsx
    CheckboxRenderer.tsx
    RadioRenderer.tsx
    UnsupportedTypeRenderer.tsx
  __tests__/
    registry.test.ts             # coverage test: every FieldSchemaType variant maps to a renderer
    VirtualizedCombobox.test.tsx
    StringRenderer.test.tsx
    TextAreaRenderer.test.tsx
    UserPickerRenderer.test.tsx
    MultiUserPickerRenderer.test.tsx
    SingleSelectRenderer.test.tsx
    MultiSelectRenderer.test.tsx
    LabelsRenderer.test.tsx
    CheckboxRenderer.test.tsx
    RadioRenderer.test.tsx
    UnsupportedTypeRenderer.test.tsx
    DynamicTargetForm.test.tsx
```

### Pattern 1: getRenderer — Discrimination Switch

**What:** A pure TypeScript function that takes `FieldSchemaType` and returns a React component constructor (not a rendered element). Callers render it with props. DynamicTargetForm is the only consumer.

**When to use:** Anywhere a field schema must be mapped to a UI control. Phase 21 (Mapping Editor) imports `getRenderer` to show a preview.

**Example:**

```typescript
// Source: CONTEXT.md D-10, D-11, D-12 (locked design)
import type { FieldSchemaType } from '@/types/fieldSchema';
import type { RendererProps } from './types';
import { StringRenderer } from './renderers/StringRenderer';
import { TextAreaRenderer } from './renderers/TextAreaRenderer';
import { UrlRenderer } from './renderers/UrlRenderer';
import { UserPickerRenderer } from './renderers/UserPickerRenderer';
import { MultiUserPickerRenderer } from './renderers/MultiUserPickerRenderer';
import { UnsupportedTypeRenderer } from './renderers/UnsupportedTypeRenderer';
// ... other imports

export function getRenderer(schema: FieldSchemaType): React.ComponentType<RendererProps> {
  switch (schema.type) {
    case 'string':
      if (schema.system === 'description') return TextAreaRenderer;
      if (schema.system === 'url') return UrlRenderer;
      return StringRenderer;
    case 'number': return NumberRenderer;
    case 'date': return DateRenderer;
    case 'datetime': return DateTimeRenderer;
    case 'user': return UserPickerRenderer;
    case 'option': return SingleSelectRenderer;
    case 'array':
      switch (schema.items) {
        case 'user': return MultiUserPickerRenderer;
        case 'option': return MultiSelectRenderer;
        case 'component': return ComponentPickerRenderer;
        case 'version': return VersionPickerRenderer;
        case 'string': return LabelsRenderer;
        case 'group': return GroupPickerRenderer;
        default: return UnsupportedTypeRenderer;
      }
    default:
      return UnsupportedTypeRenderer;
  }
}
```

### Pattern 2: VirtualizedCombobox with cmdk + @tanstack/react-virtual

**What:** A generic combobox that always virtualizes its list, regardless of item count. Built on cmdk `Command` + TanStack `useVirtualizer`. The key trick: set `shouldFilter={false}` on the cmdk `Command` so cmdk doesn't try to iterate virtual children as DOM nodes, then manually filter items before passing to the virtualizer.

**When to use:** All picker renderers. One fixed implementation — no branching based on item count.

**Critical React 19 detail:** `useFlushSync: false` is required in `useVirtualizer` to suppress the React 19 flushSync-during-render warning. The virtualizer still works correctly; React batches scroll updates naturally. [VERIFIED: TanStack Virtual docs via Context7 — confirmed `useFlushSync: boolean` option exists with default `true`; setting to `false` is the React 19 recommended approach]

**Example (core VirtualizedCombobox structure):**

```tsx
// Source: TanStack Virtual docs (Context7 /tanstack/virtual) + cmdk docs (Context7 /dip/cmdk)
import { Command } from 'cmdk';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState, useMemo } from 'react';

export function VirtualizedCombobox<T>({
  items,
  displayLabel,
  filterFn,
  value,
  onChange,
  placeholder = 'Select…',
  onSearch,  // optional: for async user pickers
}: VirtualizedComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Manual filter (shouldFilter=false on Command means cmdk won't auto-filter)
  const filtered = useMemo(
    () => (query ? items.filter(item => filterFn(item, query)) : items),
    [items, query, filterFn]
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 36,        // fixed row height — UI-SPEC locked at h-9 (36px)
    overscan: 5,
    useFlushSync: false,           // React 19 compatibility — CONTEXT.md Specifics
  });

  return (
    <>
      {/* Trigger button */}
      <Button variant="outline" className="w-full min-h-11" onClick={() => setOpen(o => !o)}>
        {value ? displayLabel(value) : placeholder}
      </Button>

      {/* Popover / positioned container */}
      {open && (
        <div className="absolute z-50 w-full bg-popover border border-border rounded-md shadow-md max-h-[320px]">
          <Command shouldFilter={false}>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
            />
            <Command.List>
              {filtered.length === 0 && (
                <Command.Empty>No results found.</Command.Empty>
              )}
              {/* Virtual container — single child of Command.List */}
              <div
                ref={listRef}
                style={{ height: `${Math.min(virtualizer.getTotalSize(), 280)}px`, overflow: 'auto' }}
              >
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {virtualizer.getVirtualItems().map(virtualRow => (
                    <Command.Item
                      key={virtualRow.key}
                      value={String(virtualRow.index)}
                      onSelect={() => { onChange(filtered[virtualRow.index]); setOpen(false); }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {displayLabel(filtered[virtualRow.index])}
                    </Command.Item>
                  ))}
                </div>
              </div>
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
```

**Known subtlety:** When virtualizing inside cmdk's `Command.List`, cmdk's keyboard navigation (arrow keys selecting `Command.Item`) works correctly only if the virtual items render real `Command.Item` elements in the DOM — the virtualizer ensures this for visible rows. Keyboard navigation will skip items that are not rendered (outside the viewport), which is expected behavior for a virtual list. [ASSUMED — based on cmdk + react-virtual community patterns; verify during implementation]

### Pattern 3: RendererProps Unified Interface

**What:** A single `RendererProps` interface with optional fields covers all renderer types. Simpler than per-renderer interfaces — Phase 22 always passes the full prop bag.

**Example:**

```typescript
// Source: CONTEXT.md D-01, D-03, D-04, D-05 — type shapes are locked
import type { FieldSchema } from '@/types/fieldSchema';
import type { JiraUser } from '@/features/tickets/types';

export interface SearchCallbacks {
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
  onFetchComponents?: () => Promise<JiraComponent[]>;
  onFetchVersions?: () => Promise<JiraVersion[]>;
}

export interface RendererProps {
  field: FieldSchema;                    // full schema + allowedValues + name
  value: unknown;                        // current value (managed by Phase 22)
  onChange: (v: unknown) => void;        // Phase 22 propagates up
  required?: boolean;                    // visual indicator only in Phase 20
  disabled?: boolean;                    // passthrough
  // async callbacks — only used by user/component/version pickers
  onSearch?: (q: string) => Promise<JiraUser[]>;
  initialQuery?: string;                 // D-03: UserPickerRenderer auto-triggers on mount
}
```

### Pattern 4: DynamicTargetForm — Stateless Shell

**What:** Iterates `FieldSchema[]`, calls `getRenderer` per field, renders the returned component with the right props extracted from `values` and `searchCallbacks`.

**Example:**

```tsx
// Source: CONTEXT.md D-04, D-05
export function DynamicTargetForm({ fields, values, onChange, searchCallbacks }: DynamicTargetFormProps) {
  return (
    <div className="flex flex-col gap-6">
      {fields.map(field => {
        const Renderer = getRenderer(field.schema);
        return (
          <div key={field.fieldId} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-foreground">
              {field.name}
              {field.required && <span className="text-destructive font-semibold ml-0.5"> *</span>}
            </label>
            <Renderer
              field={field}
              value={values[field.fieldId]}
              onChange={(v) => onChange(field.fieldId, v)}
              required={field.required}
              onSearch={searchCallbacks?.onSearchUsers}
            />
          </div>
        );
      })}
    </div>
  );
}
```

### Pattern 5: UserPickerRenderer — initialQuery Auto-trigger

**What:** On mount, if `initialQuery` is provided, call `onSearch(initialQuery)` in a `useEffect` to pre-populate the dropdown with the source assignee email match.

**Example:**

```tsx
// Source: CONTEXT.md D-03
useEffect(() => {
  if (initialQuery && onSearch) {
    onSearch(initialQuery).then(results => setSuggestions(results));
  }
}, []); // mount only — intentional empty dep array
```

### Anti-Patterns to Avoid

- **Direct `invoke` in renderer:** Phase 20 renderers must never call `invoke` directly. `onSearch` callback is the only async escape hatch. Violating this breaks testability (SC #4).
- **cmdk auto-filter with virtual items:** Setting `shouldFilter` to its default `true` means cmdk iterates all children to filter them — this defeats virtualization. Always set `shouldFilter={false}` when using a virtual list inside `Command.List`.
- **Dynamic row heights in virtualizer:** Using `measureElement` (dynamic sizing) for items that are actually fixed height adds unnecessary re-render overhead. Use `estimateSize: () => 36` (fixed) matching the locked 36px row height.
- **`useFlushSync: true` (default) with React 19:** Leaves the console warning "flushSync was called from inside a lifecycle method" intact. The ROADMAP explicitly calls out `useFlushSync: false`.
- **Branching on list size:** D-08 locks: all pickers use `VirtualizedCombobox` unconditionally. Don't add `if (items.length > 100) use virtual else use plain list` — creates two code paths to test and maintain.
- **`UnsupportedTypeRenderer` as text input fallback:** SC #2 says "never a silent fallback to text input". The fallback must be a read-only pill, not an editable input.
- **`issuetype` and `priority` with active renderers:** These types appear in `FieldSchemaType` but the registry should route them to `UnsupportedTypeRenderer` — they are managed by Phase 22's separate target issue type / priority selectors, not by the field renderer system.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard navigation in combobox | Arrow key state machine | cmdk `Command` + `Command.Item` | cmdk handles focus cycling, vim bindings, Escape, Enter, wrapping — 50+ edge cases |
| Row virtualization | Manual scroll + visible-range calc | `useVirtualizer` from @tanstack/react-virtual | Position math, overscan, dynamic measurement, scroll-to-index — all solved |
| ARIA listbox semantics | Manual role/aria-selected wiring | cmdk sets `role="option"`, `aria-selected` on `Command.Item` | cmdk is a tested accessible combobox primitive |
| CSS popover positioning | Hand-built absolutely-positioned div with z-index logic | `@radix-ui/react-popover` (if added) | Handles focus trap, escape-to-close, portal mounting, collision avoidance |
| i18n string management | Hardcoded English strings | `useTranslation()` from react-i18next (already installed) | Bilingual requirement (EN/SK) from PROJECT.md |
| className merging | String concatenation | `cn()` from `src/lib/utils` | Tailwind class conflict resolution — already established project pattern |

**Key insight:** The cmdk + @tanstack/react-virtual virtualized combobox is the hardest part of this phase — both are mature, peer-compatible with React 19, and the combination is well-documented. Hand-rolling either would introduce accessibility and performance regressions.

---

## Common Pitfalls

### Pitfall 1: cmdk shouldFilter Default Breaks Virtualization

**What goes wrong:** By default, `cmdk` with `shouldFilter={true}` (the default) internally iterates all its children to score and filter them. When the child is a virtual list with only a few DOM nodes visible, cmdk sees 5 items instead of 5,000 — filtering becomes inaccurate and items disappear.

**Why it happens:** cmdk's filtering works on rendered React children, not on the source data array. Virtual lists only render visible children.

**How to avoid:** Always set `shouldFilter={false}` on `<Command>` when virtualizing. Manage filtering yourself in a `useMemo` over the items array before passing to `useVirtualizer`. [VERIFIED: cmdk README via Context7 — `shouldFilter` option documented]

**Warning signs:** Items disappear when scrolling mid-way through a large list; "No results" shown incorrectly.

### Pitfall 2: React 19 flushSync Warning from useVirtualizer Default

**What goes wrong:** `@tanstack/react-virtual` defaults to `useFlushSync: true`, calling `flushSync` from inside scroll event handlers. React 19 warns (in dev mode) about `flushSync` calls inside event listeners managed by React's concurrent scheduler.

**Why it happens:** TanStack Virtual added `useFlushSync` to synchronously update the virtual window during scroll — useful for React 18 transition batching but conflicts with React 19's stricter scheduler.

**How to avoid:** Always pass `useFlushSync: false` to `useVirtualizer`. The virtualizer still updates correctly; React 19 batches scroll updates naturally. [VERIFIED: TanStack Virtual docs via Context7 — `useFlushSync: boolean` option confirmed]

**Warning signs:** Console warning "flushSync was called from inside a lifecycle method" during scroll in development mode.

### Pitfall 3: Fixed Row Height Must Match Rendered Height

**What goes wrong:** `estimateSize: () => 36` tells the virtualizer every row is 36px. If the rendered `Command.Item` is actually taller (because of text wrapping, padding changes, or Tailwind class conflicts), items overlap or have gaps.

**Why it happens:** Without `measureElement`, the virtualizer uses `estimateSize` as exact truth, not an estimate.

**How to avoid:** Enforce `h-9` (36px, Tailwind) on every `Command.Item` row. Set `overflow: hidden` on the item to prevent expansion. Do NOT use multi-line labels inside virtual rows. [VERIFIED: TanStack Virtual docs via Context7 — fixed-height pattern uses `estimateSize` as exact; dynamic sizing requires `measureElement`]

**Warning signs:** Items visually overlap; scroll position jumps when navigating.

### Pitfall 4: VirtualizedCombobox Scroll Container Must Have Explicit Height

**What goes wrong:** If the scroll container `div` passed to `getScrollElement` has no explicit height (CSS `height`), the virtualizer measures 0px and renders nothing.

**Why it happens:** TanStack Virtual requires the scroll element to have a defined height so it can calculate the visible window.

**How to avoid:** Set `max-h-[280px] overflow-auto` (or equivalent inline style `height: Xpx, overflow: 'auto'`) on the inner list container that serves as the scroll element. The outer popover container controls the visual max-height; the inner container is the scroll element. [VERIFIED: TanStack Virtual docs via Context7 — `getScrollElement` pattern requires a scrollable container]

**Warning signs:** Empty combobox dropdown even with items in the array.

### Pitfall 5: `option` Type vs Single vs Multi Confusion

**What goes wrong:** Jira's `type: 'option'` is used for both single-select fields and as the `items` discriminant in `type: 'array', items: 'option'` (multi-select). A naive renderer treats both as single-select.

**Why it happens:** The registry D-10 handles this correctly via the switch — `type: 'option'` → SingleSelectRenderer, `type: 'array', items: 'option'` → MultiSelectRenderer. But if someone adds an `option` catch-all before checking the array branch, both get routed to SingleSelectRenderer.

**How to avoid:** Always check `type === 'array'` branch first (before `type === 'option'`) in the switch. The TypeScript discriminated union ensures exhaustive checks if you use a `never` fallthrough. [VERIFIED: CONTEXT.md D-10 and fieldSchema.ts — `FieldSchemaType` union]

**Warning signs:** Multi-select fields (components, labels) only accept one value.

### Pitfall 6: i18next Keys Not Added to Both Locale Files

**What goes wrong:** `useTranslation()` with a missing key falls back to the key string. If `fieldRenderer.*` keys are added to `en.json` but not `sk.json`, Slovak users see raw key strings like `fieldRenderer.noResults`.

**Why it happens:** The project requires bilingual support (EN/SK). Both files must be updated together.

**How to avoid:** Add all `fieldRenderer.*` keys to both `src/i18n/locales/en.json` and `src/i18n/locales/sk.json` in the same task. Slovak translations: "Select…" → "Vybrať…", "Search users…" → "Hľadať používateľov…", "No results found." → "Žiadne výsledky.", etc. [ASSUMED — Slovak translation values; confirm with user if precise Slovak diacritics matter]

**Warning signs:** Slovak UI shows raw key strings.

### Pitfall 7: @radix-ui/react-popover Not Installed

**What goes wrong:** If the VirtualizedCombobox uses `@radix-ui/react-popover` for the dropdown container, the build fails with a module-not-found error — `@radix-ui/react-popover` is not in `package.json` currently.

**Why it happens:** The project has other Radix UI packages but not the Popover one.

**How to avoid:** Either (a) install `@radix-ui/react-popover` explicitly in Wave 0, or (b) implement the dropdown as a CSS-positioned `div` with a `useEffect` click-outside handler (matching the pattern from `TicketFilterBar.tsx`). Option (b) avoids the extra dependency but requires manual dismiss logic. [VERIFIED: `package.json` grep — `@radix-ui/react-popover` absent; all other Radix packages present]

---

## Code Examples

Verified patterns from official sources:

### useVirtualizer Fixed-Height List

```tsx
// Source: TanStack Virtual docs (Context7 /tanstack/virtual)
const rowVirtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 36,   // fixed 36px — matches h-9 Tailwind class
  overscan: 5,
  useFlushSync: false,      // React 19 compatibility
});

// In render:
<div ref={parentRef} style={{ height: '280px', overflow: 'auto' }}>
  <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
    {rowVirtualizer.getVirtualItems().map(virtualRow => (
      <div
        key={virtualRow.key}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        {items[virtualRow.index]}
      </div>
    ))}
  </div>
</div>
```

### cmdk shouldFilter={false} with Manual Filtering

```tsx
// Source: cmdk README (Context7 /dip/cmdk)
<Command shouldFilter={false}>
  <Command.Input value={query} onValueChange={setQuery} />
  <Command.List>
    {filteredItems.length === 0 && <Command.Empty>No results found.</Command.Empty>}
    {filteredItems.map(item => (
      <Command.Item key={item.id} value={item.id} onSelect={() => handleSelect(item)}>
        {item.label}
      </Command.Item>
    ))}
  </Command.List>
</Command>
```

### useVirtualizer Options Reference

```typescript
// Source: TanStack Virtual docs (Context7 /tanstack/virtual)
const virtualizer = useVirtualizer({
  count: number,                    // total items
  getScrollElement: () => HTMLElement,
  estimateSize: (index) => number,  // return fixed size for all rows
  enabled: boolean,                 // default: true
  overscan: number,                 // extra rows above/below viewport (default: 1)
  paddingStart: number,
  paddingEnd: number,
  gap: number,
  useFlushSync: boolean,            // default: true; set false for React 19
});
```

### UnsupportedTypeRenderer Badge

```tsx
// Source: CONTEXT.md Specifics + UI-SPEC
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

export function UnsupportedTypeRenderer({ field }: RendererProps) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={`Unsupported field type: ${field.schema.type}`}
      className="text-xs font-medium text-muted-foreground gap-1"
    >
      <AlertCircle className="w-3 h-3" aria-hidden="true" />
      {t('fieldRenderer.unsupportedType', { type: field.schema.type })}
    </Badge>
  );
}
```

### Renderer Test Pattern (isolation)

```tsx
// Source: established project pattern (DescriptionRenderer.test.tsx, TicketFilterBar.test.tsx)
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
// No Tauri mock needed — renderers don't call invoke (D-01)

import { StringRenderer } from '../renderers/StringRenderer';

describe('StringRenderer', () => {
  const baseProps = {
    field: { fieldId: 'summary', name: 'Summary', required: false, schema: { type: 'string' as const } },
    value: 'Hello',
    onChange: vi.fn(),
  };

  it('renders an input with the current value', () => {
    render(<StringRenderer {...baseProps} />);
    expect(screen.getByRole('textbox')).toHaveValue('Hello');
  });

  it('calls onChange when input changes', async () => {
    const onChange = vi.fn();
    render(<StringRenderer {...baseProps} onChange={onChange} />);
    // use userEvent or fireEvent
  });
});
```

### Registry Coverage Test Pattern

```typescript
// Source: CONTEXT.md D-12 (extension contract)
import { describe, it, expect } from 'vitest';
import { getRenderer } from '../registry';
import { UnsupportedTypeRenderer } from '../renderers/UnsupportedTypeRenderer';

describe('getRenderer registry coverage', () => {
  it('returns UnsupportedTypeRenderer for type=any', () => {
    expect(getRenderer({ type: 'any' })).toBe(UnsupportedTypeRenderer);
  });

  it('returns UnsupportedTypeRenderer for type=issuetype', () => {
    expect(getRenderer({ type: 'issuetype' })).toBe(UnsupportedTypeRenderer);
  });

  it('returns TextAreaRenderer for string with system=description', () => {
    const R = getRenderer({ type: 'string', system: 'description' });
    // ...
  });

  // One test per registry entry — ensures exhaustive coverage
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual scroll-event virtualization | `useVirtualizer` from @tanstack/react-virtual | ~2022 (v3 stable) | Correct position math, no layout thrash |
| `flushSync` by default in react-virtual | `useFlushSync: false` option | v3.x, ~2024 | Eliminates React 19 console warning |
| cmdk with React 18 only | cmdk 1.1.1 peer deps include React 19 | cmdk 1.0+ | No workarounds needed for React 19 |
| react-window (older virtualizer) | @tanstack/react-virtual | ~2022 | react-window no longer actively maintained |

**Deprecated/outdated:**
- `react-window`: No `useFlushSync` option, last major release 2020. Do not use.
- `react-virtualized`: Same vintage as react-window, not maintained. Do not use.
- cmdk versions < 1.0: Changed API significantly. `1.1.1` is the current stable.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | VirtualizedCombobox popover can be implemented as a CSS-positioned div (no Radix Popover) without major UX gaps | Standard Stack, Pitfall 7 | If focus-trap or portal behavior is required, @radix-ui/react-popover must be added — adds 1 install step |
| A2 | cmdk keyboard navigation works correctly with virtual children (Command.Item only for visible rows) — no known regressions | Pattern 2 | If cmdk's internal focus management breaks with virtual items, need to implement custom keyboard nav — significant complexity increase |
| A3 | Slovak translations for `fieldRenderer.*` keys (e.g. "Vybrať…" for "Select…") are acceptable approximations | Pitfall 6 | If user requires precise Slovak, translations must be reviewed by a native speaker before merge |
| A4 | `type: 'option-with-child'` routes to UnsupportedTypeRenderer (not a dedicated CascadingSelectRenderer) | Pattern 1 | If cascading selects exist in the target schema, they will show as unsupported — acceptable per CTRL-07, but noted |
| A5 | `type: 'priority'` and `type: 'issuetype'` route to UnsupportedTypeRenderer | Pattern 1 | If Phase 22 later needs these as editable renderers, the registry needs two new entries — low effort due to D-12 extension contract |

---

## Open Questions

1. **Popover implementation: Radix Popover vs CSS div**
   - What we know: `@radix-ui/react-popover` is not installed; CSS-positioned div pattern exists in `TicketFilterBar.tsx`
   - What's unclear: Whether portal mounting is required (to avoid z-index stacking inside a dialog/modal)
   - Recommendation: Since the `DynamicTargetForm` will render inside `CopyPreviewModal` (Phase 22), a CSS-positioned absolute div may be clipped by the modal's `overflow: hidden` boundary. Radix Popover uses a portal to escape this. Planner should decide: install `@radix-ui/react-popover` (safe) or use `position: fixed` coordinates (workable but fragile).

2. **cmdk keyboard nav with virtual children behavior under extreme scroll**
   - What we know: cmdk's arrow key handler iterates rendered `Command.Item` elements; virtualizer renders only visible items
   - What's unclear: Whether pressing ArrowDown past the last visible item scrolls the virtual list (cmdk would need to scroll its container)
   - Recommendation: Implement and test with a 500-item fixture in Wave 1. If arrow keys don't scroll past visible items, add a `scrollToIndex` call in the `Command.Item` `onSelect` for keyboard-triggered selection.

3. **`GroupPickerRenderer` allowedValues shape**
   - What we know: `type: 'array', items: 'group'` maps to GroupPickerRenderer; allowedValues presumably contains group objects
   - What's unclear: The exact shape of group objects from Phase 17 discovery (is it `{ name: string }` or `{ groupId: string; name: string }`)
   - Recommendation: Read `src-tauri/src/field_discovery.rs` before implementing `GroupPickerRenderer` to confirm the struct fields. [ASSUMED shape: `{ name: string }` based on Jira Server API knowledge]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | v25.8.2 | — |
| npm | package install | ✓ | 11.11.1 | — |
| cmdk | VirtualizedCombobox | ✗ (not installed) | — | No fallback — must install |
| @tanstack/react-virtual | VirtualizedCombobox | ✗ (not installed) | — | No fallback — must install |
| @radix-ui/react-popover | VirtualizedCombobox dropdown | ✗ (not installed) | — | CSS-positioned div alternative (see Open Question 1) |
| vitest + @testing-library/react | renderer tests | ✓ | vitest 4.1.1 | — |
| i18next / react-i18next | translation strings | ✓ | i18next 25.x | — |

**Missing dependencies with no fallback:**
- `cmdk` — install before Wave 1
- `@tanstack/react-virtual` — install before Wave 1

**Missing dependencies with fallback:**
- `@radix-ui/react-popover` — CSS-positioned div pattern available as alternative; planner should decide

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.1 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose src/features/field-renderers` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTRL-01 | StringRenderer renders input with value | unit | `npm test -- src/features/field-renderers/__tests__/StringRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-01 | TextAreaRenderer renders textarea | unit | `npm test -- src/features/field-renderers/__tests__/TextAreaRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-01 | UrlRenderer renders url input | unit | `npm test -- src/features/field-renderers/__tests__/StringRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-02 | UserPickerRenderer calls onSearch on mount with initialQuery | unit | `npm test -- src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-02 | MultiUserPickerRenderer renders chips for provided users | unit | `npm test -- src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-03 | SingleSelectRenderer / MultiSelectRenderer render options | unit | `npm test -- src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-03 | LabelsRenderer renders badge chips | unit | `npm test -- src/features/field-renderers/__tests__/LabelsRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-04 | ComponentPickerRenderer / VersionPickerRenderer render allowedValues | unit | (included in integration test) | ❌ Wave 0 |
| CTRL-05 | DateRenderer / DateTimeRenderer / NumberRenderer render native inputs | unit | `npm test -- src/features/field-renderers/__tests__/StringRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-06 | CheckboxRenderer renders one checkbox per allowedValue | unit | `npm test -- src/features/field-renderers/__tests__/CheckboxRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-06 | RadioRenderer renders radiogroup with options | unit | `npm test -- src/features/field-renderers/__tests__/RadioRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-07 | UnsupportedTypeRenderer renders read-only badge with role=status | unit | `npm test -- src/features/field-renderers/__tests__/UnsupportedTypeRenderer.test.tsx` | ❌ Wave 0 |
| CTRL-07 | getRenderer returns UnsupportedTypeRenderer for all unknown types | unit | `npm test -- src/features/field-renderers/__tests__/registry.test.ts` | ❌ Wave 0 |
| CTRL-08 | VirtualizedCombobox renders only visible rows for 1000-item list | unit | `npm test -- src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/features/field-renderers`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

All test files for this phase are new:
- [ ] `src/features/field-renderers/__tests__/registry.test.ts`
- [ ] `src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx`
- [ ] `src/features/field-renderers/__tests__/StringRenderer.test.tsx` (covers String + Url + Number + Date + DateTime)
- [ ] `src/features/field-renderers/__tests__/TextAreaRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/MultiSelectRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/LabelsRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/CheckboxRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/RadioRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/UnsupportedTypeRenderer.test.tsx`
- [ ] `src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx`
- [ ] Framework config: test infra already in place (`vitest.config.ts` + `src/test-setup.ts`) — no new setup needed

**Testing note:** `VirtualizedCombobox` uses `@tanstack/react-virtual` which relies on layout measurements (scroll container size, element offsets). jsdom does not implement layout. Tests for VirtualizedCombobox should verify: (1) the trigger button renders, (2) opening the dropdown renders items (mock virtualizer count), (3) selecting an item calls `onChange`. Performance virtualization behavior (only N rows rendered) cannot be asserted in jsdom — it is a browser-only behavior. Do not write tests that assert `getVirtualItems().length < items.length`.

---

## Security Domain

> `security_enforcement` not set to false in config.json — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in Phase 20 — renderers are pure UI |
| V3 Session Management | No | No session in Phase 20 |
| V4 Access Control | No | No access control decisions in Phase 20 |
| V5 Input Validation | Partial | No server-side validation here; `UrlRenderer` uses HTML5 `pattern="https?://.*"` for client-side hint only. No blocking validation in Phase 20 (by design). |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via displayLabel output | Tampering | React's JSX auto-escapes string content — never use `dangerouslySetInnerHTML` in renderer components |
| Open redirect via UrlRenderer | Tampering | UrlRenderer is an `<input type="url">` — it stores values, does NOT open URLs. No navigation risk in Phase 20. |
| PII in `initialQuery` (email address) | Information Disclosure | `initialQuery` is a source assignee email passed as a prop — it is already visible in the UI. No logging of `onSearch` query params inside Phase 20 renderers. |

**Phase 20 security posture:** Minimal attack surface. All renderers are pure controlled inputs with no network calls, no URL navigation, no HTML injection. The main risk is XSS from rendering arbitrary field names or allowedValues labels — mitigated by React's default JSX escaping.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/dip/cmdk` — cmdk API: shouldFilter, Command.Input, Command.List, Command.Item, Command.Empty, useCommandState
- Context7 `/tanstack/virtual` — useVirtualizer: count, getScrollElement, estimateSize, overscan, useFlushSync, getTotalSize, getVirtualItems
- `src/types/fieldSchema.ts` — FieldSchemaType discriminated union, ArrayItemKind, FieldSchema interface (Phase 17 output)
- `src/features/tickets/TicketFilterBar.tsx` — existing debounced user search pattern (250ms, invoke, suggestions state)
- `src/features/tickets/UserAvatar.tsx` — existing avatar component API (UserAvatarProps, size='sm'|'md')
- `src/components/ui/badge.tsx` — Badge variants (default, secondary, destructive, outline)
- `src/components/ui/button.tsx` — Button variants (outline, default, ghost), size (sm=h-9)
- `src/lib/utils.ts` — cn() utility
- `src/index.css` — Tailwind v4 token bridge: --color-ring, --color-muted, --color-border, --color-popover
- `vitest.config.ts` — test environment (jsdom), setupFiles, coverage thresholds
- `package.json` — confirmed cmdk and @tanstack/react-virtual NOT installed; @radix-ui/react-popover NOT installed

### Secondary (MEDIUM confidence)
- npm registry: `cmdk@1.1.1` peer deps `react@^18||^19`, `@tanstack/react-virtual@3.13.24` peer deps `react@^16-^19`, `@radix-ui/react-popover@1.1.15`
- WebSearch: `useFlushSync: false` is the React 19 recommended setting for @tanstack/react-virtual — confirmed via multiple search results and TanStack docs

### Tertiary (LOW confidence)
- A2 (Assumptions Log): cmdk keyboard navigation behavior with virtual children — community pattern, not officially documented

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified; peer deps confirmed React 19 compatible
- Architecture: HIGH — all decisions locked in CONTEXT.md; FieldSchemaType union read directly from source
- VirtualizedCombobox patterns: HIGH — verified via Context7 official docs for both cmdk and @tanstack/react-virtual
- Pitfalls: HIGH — Pitfall 1-4 verified via official docs; Pitfall 5-7 verified via codebase inspection
- Test patterns: HIGH — vitest.config.ts and existing test files read directly

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable libraries; cmdk and @tanstack/react-virtual release frequently but the APIs are stable)
