# Phase 20: Renderer Registry + Field-Type-Aware Controls - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure frontend React component registry. Delivers a `getRenderer(schema)` function + 15+ renderer components + a `DynamicTargetForm` shell — all living in `src/features/field-renderers/`. This directory becomes the shared dependency for Phase 21 (Mapping Editor) and Phase 22 (Copy Preview Override Panel).

**In scope:**
- `src/features/field-renderers/registry.ts` — `getRenderer(schema: FieldSchemaType)` function, discrimination by `type` + `items` + `system`
- `src/features/field-renderers/DynamicTargetForm.tsx` — stateless shell that iterates `FieldSchema[]`, calls `getRenderer`, renders each control
- `src/features/field-renderers/components/VirtualizedCombobox.tsx` — shared cmdk + `@tanstack/react-virtual` base, used by all pickers
- `src/features/field-renderers/renderers/` — one file per renderer (StringRenderer, TextAreaRenderer, UrlRenderer, UserPickerRenderer, MultiUserPickerRenderer, GroupPickerRenderer, SingleSelectRenderer, MultiSelectRenderer, LabelsRenderer, ComponentPickerRenderer, VersionPickerRenderer, DateRenderer, DateTimeRenderer, NumberRenderer, CheckboxRenderer, RadioRenderer, UnsupportedTypeRenderer)
- New packages: `cmdk`, `@tanstack/react-virtual` (neither installed yet)
- Unit tests for each renderer in isolation + a registry coverage test

**Out of scope:**
- Tauri wiring / Zustand state (Phase 22 wires real invokes and manages form state)
- Required-field gating UI (Phase 22 — renderers receive `required?: boolean` as a passthrough prop but do not block on it)
- UnresolvedPerson gap-chip rendering (Phase 22 injects it alongside the renderer output)
- Mapping Editor UI (Phase 21)
- `copy_ticket_v2` command (Phase 23)
- Storybook (not in the project)

</domain>

<decisions>
## Implementation Decisions

### User Picker Coupling

- **D-01:** `UserPickerRenderer` and `MultiUserPickerRenderer` accept `onSearch: (q: string) => Promise<JiraUser[]>` as a required prop. Renderers never call `invoke` directly. Phase 22 injects the real Tauri call; tests pass a mock function. This satisfies ROADMAP SC #4 (testable in isolation via the registry).
- **D-02:** `MultiUserPickerRenderer` renders only the `JiraUser[]` values it has been given. It does NOT handle `UnresolvedPerson` gap variants. Phase 22 is responsible for injecting an "unresolved — search manually" chip alongside the renderer output for each gap. Renderer stays simple.
- **D-03:** `UserPickerRenderer` accepts `initialQuery?: string`. On mount it auto-triggers `onSearch(initialQuery)` if provided. Phase 22 passes the source assignee email as `initialQuery` to implement the email-match pre-fill (PROJECT.md requirement). The renderer has no knowledge of where the email comes from.

### DynamicTargetForm

- **D-04:** `DynamicTargetForm` is a stateless shell. Signature: `({ fields: FieldSchema[], values: Record<string, unknown>, onChange: (fieldId: string, v: unknown) => void, searchCallbacks?: SearchCallbacks })`. Iterates `fields`, calls `getRenderer(field.schema)` for each, renders the component. No `useState` or Zustand inside. Phase 22 owns the value state.
- **D-05:** Async callbacks flow through a `SearchCallbacks` prop bag: `{ onSearchUsers?: (q: string) => Promise<JiraUser[]>; onFetchComponents?: () => Promise<JiraComponent[]>; onFetchVersions?: () => Promise<JiraVersion[]> }`. `DynamicTargetForm` extracts the relevant callback per renderer type and passes it in. Phase 22 provides the full bag with real invokes; tests pass mocks. When omitted, renderers default to returning empty arrays (graceful degradation).
- **D-06:** All files live under `src/features/field-renderers/`. Structure:
  ```
  src/features/field-renderers/
    registry.ts
    DynamicTargetForm.tsx
    types.ts              ← RendererProps, SearchCallbacks interfaces
    components/
      VirtualizedCombobox.tsx
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
  ```

### Option / Picker Data Source

- **D-07:** All pickers except user use **static `allowedValues`** from `FieldSchema` (already fetched by Phase 17 discovery at copy time). This covers: single-select, multi-select, labels (`array<string>`), components (`array<component>`), versions (`array<version>`), group, radio, checkbox. No async needed for these — data is in the prop.
- **D-08:** All picker renderers use `VirtualizedCombobox` unconditionally — no branching on list size. One code path regardless of whether `allowedValues` has 5 or 5,000 items. cmdk + `@tanstack/react-virtual` with `useFlushSync: false` for React 19 (ROADMAP SC #3, locked).
- **D-09:** `VirtualizedCombobox<T>` is a shared base component in `src/features/field-renderers/components/`. Accepts: `items: T[]`, `displayLabel: (item: T) => string`, `filterFn: (item: T, query: string) => boolean`, `value/onChange`, optional `onSearch` for async loading (user picker). Each picker wraps it with domain-specific item types and display logic. Fixes for virtualization bugs (row height, overscan) land in one place.

### Registry Key Scheme

- **D-10:** `getRenderer` is the single discrimination function. `DynamicTargetForm` calls `getRenderer(field.schema)` and never branches on type itself. This satisfies ROADMAP SC #4. For `type === 'array'`, `getRenderer` branches on `items` (`'user'` → MultiUserPickerRenderer, `'option'` → MultiSelectRenderer, `'component'` → ComponentPickerRenderer, `'version'` → VersionPickerRenderer, `'string'` → LabelsRenderer, `'group'` → GroupPickerRenderer). Falls through to `UnsupportedTypeRenderer` for `type === 'any'` or any unknown combination.
- **D-11:** For `type === 'string'`, `getRenderer` branches on `schema.system`: `'description'` → TextAreaRenderer (multi-line), `'url'` → UrlRenderer (link input), everything else → StringRenderer (single-line). The `system` field is already present in `FieldSchemaType` (Phase 17).
- **D-12:** Adding a new field type = one new renderer file in `renderers/` + one new case in `getRenderer` in `registry.ts`. No changes to `DynamicTargetForm`. This is the extension contract enforced by Phase 20's design.

### Claude's Discretion

- Exact TypeScript generics for `VirtualizedCombobox<T>` internal hook wiring
- Whether `RendererProps` is one unified interface or per-renderer-type interfaces (unified with optional fields is simpler)
- Exact cmdk + @tanstack/react-virtual row height and overscan settings
- Whether `SearchCallbacks` interface lives in `types.ts` or `DynamicTargetForm.tsx`
- Debounce timing for user search (likely 300ms to match `TicketFilterBar` pattern)
- Exact label/style for `UnsupportedTypeRenderer` pill — should show field name + type for debugging during development

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 17 TypeScript types (primary dependency)
- `src/types/fieldSchema.ts` — `FieldSchemaType` discriminated union, `ArrayItemKind`, `FieldSchema` interface. Phase 20's `getRenderer` maps these types to renderer components. **Read the full file** — especially the `system?: string` field on string variants and `items: ArrayItemKind` on array variants.
- `src/types/fieldSchema.test.ts` — Existing type tests; Phase 20 must not break them.

### Requirements
- `.planning/REQUIREMENTS.md` — CTRL-01 through CTRL-08 acceptance criteria. Phase 20 covers all eight.
- `.planning/ROADMAP.md` §"Phase 20: Renderer Registry + Field-Type-Aware Controls" — Goal, dependencies, success criteria (SC #1–4 are non-negotiable).

### Project context
- `.planning/PROJECT.md` — Key decisions: "person picker always visible with email-match pre-fill", "block copy on unmapped required target fields" (Phase 22 uses this, Phase 20 exposes the signal), shadcn/ui + Linear aesthetic, WCAG AA, React 19, bilingual EN/SK via i18next.

### Prior phase context
- `.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md` — Phase 17 decisions: `FieldSchema.allowedValues` shape (populated by createmeta API), `FieldSide` enum, mock fixture shapes.
- `.planning/phases/19-mapping-persistence-crud-commands/19-CONTEXT.md` — `FieldMappingRow` shape: `source_schema: FieldSchemaType`, `target_schema: FieldSchemaType`. Phase 20's renderers are selected using the `target_schema` of each mapping row.

### Existing code patterns to follow
- `src/features/tickets/TicketFilterBar.tsx` — Existing user search pattern: debounced `invoke`, suggestions state machine, keyboard navigation, UserAvatar display. Reference for user picker interaction model (but Phase 20 replaces direct invoke with `onSearch` callback).
- `src-tauri/src/field_discovery.rs` — Rust source of truth for `FieldSchemaType` — TypeScript mirror in `fieldSchema.ts` must stay 1-to-1.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FieldSchema` / `FieldSchemaType` / `ArrayItemKind`** (`src/types/fieldSchema.ts`): Phase 17's types are Phase 20's primary input. `getRenderer` consumes `FieldSchemaType` directly — no mapping or transformation needed before calling it.
- **`search_jira_users` Tauri command** (`src/features/tickets/TicketFilterBar.tsx:74`): Phase 16 command for searching Cloud Jira users. Phase 22 injects it as `onSearch` into `UserPickerRenderer`. Phase 20 only needs to define the callback signature, not call the command.
- **shadcn/ui primitives** (`src/components/ui/`): Available: `badge`, `button`, `scroll-area`, `separator`, `skeleton`, `switch`, `tabs`, `tooltip`, `dialog`, `progress`. No `select`, `combobox`, or `command` — Phase 20 adds cmdk as the combobox foundation.
- **`UserAvatar`** (`src/features/tickets/UserAvatar.tsx`): Existing avatar component; `UserPickerRenderer` can reuse it for displaying selected user chips.

### Established Patterns
- **i18next**: All user-facing strings use `useTranslation()` — applies to picker placeholders, "Unsupported type" label, error states.
- **WCAG AA + keyboard nav**: cmdk provides keyboard navigation out of the box for comboboxes. Date/number/text inputs use standard HTML semantics. All interactive elements need `aria-label` or visible labels.
- **Vitest + RTL**: All renderer tests use `@testing-library/react` + `vitest`. No Playwright. Renderer isolation is testable by passing mock props (no Tauri mocking needed, per D-01).
- **shadcn/ui aesthetic**: New components follow the existing `cn()` utility for className merging and the project's Tailwind config.

### Integration Points
- **Phase 21 (Mapping Editor)**: Will import `getRenderer` to show a field-type preview per mapping row. Will import `DynamicTargetForm` if it needs to render a live sample.
- **Phase 22 (Copy Preview Override Panel)**: Will import `DynamicTargetForm` and wire it into `CopyPreviewModal` with `searchCallbacks` populated from real Tauri invokes and `values` / `onChange` managed by Zustand. Also injects gap chips for `UnresolvedPerson` variants from Phase 18's pipeline.
- **Phase 22 required-field gating**: `FieldSchema.required` is already in the type. Phase 20 renderers should pass `required` as a prop (for visual indicator) but not enforce gating. Phase 22 reads `values` and `fields[].required` to control the Copy button.

</code_context>

<specifics>
## Specific Ideas

- **`VirtualizedCombobox` with `useFlushSync: false`**: The ROADMAP explicitly calls out `useFlushSync: false` for React 19 compatibility. This is a known React 19 + cmdk + @tanstack/react-virtual gotcha — implement it from the start in the shared base component.
- **`UnsupportedTypeRenderer` is read-only**: ROADMAP SC #2 says "read-only 'Unsupported type' pill — never a crash, never a silent fallback to text input." Renders a `Badge` pill with the field name + type for visibility during development. No `onChange`.
- **`initialQuery` on mount**: `UserPickerRenderer` triggers `onSearch(initialQuery)` in a `useEffect` on mount when `initialQuery` is set, auto-populating the dropdown. Phase 22 passes source assignee email here.
- **`DynamicTargetForm` passes `required` through**: Even though Phase 20 doesn't gate on `required`, the prop should be wired through so Phase 22 doesn't have to refactor the interface. Renderers can show a visual indicator (asterisk label) if `required` is true.

</specifics>

<deferred>
## Deferred Ideas

- **UnresolvedPerson gap chips in Phase 20**: Considered adding the "search manually" chip inline in `MultiUserPickerRenderer`. Deferred — Phase 22 injects it (D-02). Keeps Phase 20's renderer simple and Phase 22's wiring clean.
- **Storybook for renderer visual catalog**: Would be useful for Phase 21/22 development. Not in the project currently — adding Storybook is a separate decision.
- **Per-copy-session version/component cache in renderer**: Components/versions use static `allowedValues` from discovery (D-07). If a user wants fresh data mid-session, Phase 22 could add a "Refresh" action. Deferred.
- **`searchCallbacks.onFetchVersions` / `onFetchComponents` as lazy loaders**: Phase 20's design uses static `allowedValues`. The `SearchCallbacks` type includes `onFetchComponents` and `onFetchVersions` slots for Phase 22 to use if it needs to refresh options live. Phase 20 renderers use `allowedValues` and ignore these slots.

</deferred>

---

*Phase: 20-renderer-registry-field-type-aware-controls*
*Context gathered: 2026-04-27*
