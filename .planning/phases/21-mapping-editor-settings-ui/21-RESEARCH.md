# Phase 21: Mapping Editor (Settings UI) — Research

**Researched:** 2026-04-28
**Domain:** React 19 / Tauri 2 / shadcn/ui — Settings extension + field mapping CRUD UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Each mapping row uses inline comboboxes — target field and transformer are always-accessible dropdowns. No "edit button" needed.
- **D-02:** Target field combobox sources from `field_schema_cache` (target side) via existing Phase 17 commands. No live Jira fetch on editor open.
- **D-03:** Transformer kind filtering strategy left to Claude's discretion (recommended: filter by target field type).
- **D-04:** Column ratios ~35%/35%/20%/10% within 560px max-width.
- **D-05:** Suggestions appear as a collapsible panel above the mapping table; shows unmapped source fields with heuristic-matched target suggestions. Each row has [Accept] and [Dismiss] buttons.
- **D-06:** Suggestions panel appears any time there are unmapped source fields in `field_schema_cache` with no corresponding row. Re-appears after a schema refresh that adds new source fields.
- **D-07:** Dismissed suggestions persistence: store as mapping row with `target_field_id = ""` (empty string sentinel) in `field_mapping` table via `set_field_mapping`.
- **D-08:** Accepting a suggestion immediately calls `set_field_mapping` (per-row auto-save, D-09).
- **D-09:** Per-row auto-save. Every mutation immediately calls the corresponding Tauri command. No "Save" button.
- **D-10:** New "Copying" nav group between Fetching and Polling, with "Field Mapping" as sole item.
- **D-11:** "Refresh schema" button and "Last refreshed Xm ago" timestamp live in the section header area, aligned right.
- **D-12:** "Last refreshed" timestamp derived from `MAX(cached_at)` in `field_schema_cache` for the target side.
- **D-13:** Clicking "Refresh schema" calls `refresh_field_schema_cache` (clears SQLite cache), then re-fetches via `get_target_field_schema_for_issuetype`.
- **D-14:** Drift detection runs on editor open and after each schema refresh. Missing `target_field_id` in current target cache = drifted.
- **D-15:** Drifted rows show an inline amber warning with one-click [Remove]. Warning replaces target combobox content.

### Claude's Discretion

- Transformer kind filtering strategy per field type (D-03)
- Sidebar group placement (D-10 — "Copying" group recommended)
- Dismissed suggestions persistence mechanism (D-07 — empty string sentinel decided in UI-SPEC)
- Exact row column widths and table layout (D-04 — specified in UI-SPEC)
- Toast vs inline check for save confirmation (specified in UI-SPEC: inline check for success, toast for error)
- Zustand store vs local component state

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-05 | User can manually refresh the schema cache via a button in Settings | `refresh_field_schema_cache` Tauri command exists (clears cache); `schemaCacheStore.refresh()` + `loadSchema()` combo re-fetches; UI-SPEC section header layout specified |
| MAP-03 | User can add custom-field mappings on top of the defaults | `set_field_mapping` Tauri command (upsert by `source_field_id`); "Add field mapping" row button; `VirtualizedCombobox` for target field selection |
| MAP-04 | User can edit or remove any default mapping | `set_field_mapping` (upsert replaces existing); `delete_field_mapping` (idempotent delete); inline comboboxes always accessible |
| MAP-05 | System warns when a saved mapping references a target field no longer in schema | Drift detection: cross-reference `target_field_id` set from `get_field_mapping` against `field_id` set from `get_target_field_schema_for_issuetype`; `DriftWarning` component with amber indicator |
| EDIT-01 | User can open a "Field Mapping" section in Settings showing the current mapping | Add `'field-mapping'` to `ActiveSection` union + `renderContent()` switch + nav group in `SettingsPage.tsx` |
| EDIT-02 | User sees heuristic name-match suggestions for unmapped source fields | Compare source-side `field_schema_cache` fields against `field_mapping` rows; case-insensitive equality + synonym set; `SuggestionsPanel` component |
| EDIT-03 | User can save mapping changes; changes persist across app restarts | `set_field_mapping` / `delete_field_mapping` per-row auto-save; mapping.db SQLite persistence confirmed from Phase 19 |

</phase_requirements>

---

## Summary

Phase 21 is a pure frontend build with zero new backend code. All persistence infrastructure (3 Tauri commands: `get_field_mapping`, `set_field_mapping`, `delete_field_mapping`), the schema cache commands (`discover_source_fields`, `get_target_field_schema_for_issuetype`, `refresh_field_schema_cache`), and the `schemaCacheStore` Zustand store are already implemented by Phases 17–19. Phase 21 extends `SettingsPage.tsx` with a new `'field-mapping'` section and introduces four new React components (`FieldMappingSection`, `MappingRow`, `SuggestionsPanel`, `DriftWarning`) in a new `src/features/field-mapping/` directory.

Two shadcn components that the UI-SPEC requires are not yet installed: **Sonner** (toast notifications) and **Collapsible** (for the suggestions panel). Both need to be added in Wave 0. The `@radix-ui/react-collapsible` package and `sonner` package must be installed and shadcn components scaffolded. Alternatively, the suggestions panel can use a native `<details>`/`<summary>` element to avoid a dependency; the UI-SPEC permits this.

One significant gap: there is no Tauri command to retrieve `MAX(cached_at)` from `field_schema_cache`. The UI-SPEC's "Last refreshed" timestamp requires either a new Tauri command (`get_schema_last_refreshed`) or deriving it from the frontend refresh call timestamp. Given the "no new Tauri commands" scope constraint from CONTEXT.md (out-of-scope: "New Tauri commands — all 3 CRUD commands exist from Phase 19"), the planner should use a **frontend timestamp**: record `Date.now()` when `schemaCacheStore.refresh()` completes successfully. This is simpler, does not require a backend change, and accurately reflects "when the user last refreshed."

**Primary recommendation:** Build `FieldMappingSection` as the orchestrator component that reads from `schemaCacheStore` (target schema) and invokes the 3 CRUD commands directly. Use `schemaCacheStore.refresh()` for the Refresh schema button flow. Track last-refreshed timestamp in local component state (Date.now() on successful refresh).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field mapping CRUD persistence | Rust/SQLite (FieldMappingDb) | — | mapping.db, 3 Tauri commands already exist |
| Schema cache read (target fields) | React (schemaCacheStore) | Rust (FieldMappingDb) | schemaCacheStore.loadSchema() is cache-first read |
| Schema cache refresh (clear + re-fetch) | React (schemaCacheStore.refresh) | Rust (refresh_field_schema_cache) | Frontend orchestrates: clear then load |
| Drift detection | React (FieldMappingSection) | — | Pure set-intersection logic; no new backend |
| Heuristic name-match suggestions | React (FieldMappingSection) | — | Pure string-comparison; no ML or backend |
| Nav routing (ActiveSection) | React (SettingsPage.tsx) | — | Existing switch/case pattern |
| Auto-save feedback (inline check / toast) | React (MappingRow) | — | Client-side UI state; Tauri invoke result |
| i18n strings | React (i18next keys) | — | en.json + sk.json flat-key additions |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.0.0 | Component model | [VERIFIED: package.json] |
| Tauri invoke | @tauri-apps/api ^2.10.1 | IPC to Rust backend | [VERIFIED: package.json] |
| i18next + react-i18next | ^25 / ^16 | Bilingual strings | [VERIFIED: package.json] |
| cmdk + @tanstack/react-virtual | ^1.1.1 / ^3.13.24 | VirtualizedCombobox (already in Phase 20) | [VERIFIED: package.json] |
| lucide-react | ^1.6.0 | Icons (AlertTriangle, RefreshCw, Check, Plus, X, Loader2, ChevronDown/Right) | [VERIFIED: package.json] |
| shadcn/ui (Button, Separator, Skeleton) | already installed | UI primitives | [VERIFIED: src/components/ui/] |

### To Install (Wave 0)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| sonner | 2.0.7 | Toast notifications for auto-save error + refresh error | [VERIFIED: npm registry — not yet in package.json] |
| @radix-ui/react-collapsible | 1.1.12 | Collapsible suggestions panel | [VERIFIED: npm registry — not in package.json] OR use native `<details>` |

**Important:** The UI-SPEC lists both `Collapsible` (shadcn) and `Sonner` (toast) in the Registry Safety section as "not required" — meaning they may be added without a registry safety review. But they are genuinely NEW additions to the codebase.

**Alternative for Collapsible:** The suggestions panel can use native `<details>`/`<summary>` elements styled with Tailwind, which avoids installing `@radix-ui/react-collapsible`. This is simpler and removes a dependency. The UI-SPEC says "Collapsible via shadcn `Collapsible` or native `<details>`" — so this is explicitly permitted.

**Recommendation:** Use native `<details>` for the suggestions panel, and install `sonner` only. This minimizes new dependencies.

**Installation (if Collapsible chosen):**
```bash
npm install sonner @radix-ui/react-collapsible
npx shadcn@latest add sonner collapsible
```

**Installation (minimal — native details):**
```bash
npm install sonner
npx shadcn@latest add sonner
```

### Existing Components Reused

| Component | Location | Usage |
|-----------|----------|-------|
| `VirtualizedCombobox` | `src/features/field-renderers/components/VirtualizedCombobox.tsx` | Target field + transformer comboboxes in each mapping row |
| `SectionCard` | `SettingsPage.tsx:232` | Wrap Field Mapping section — needs `headerAction?: React.ReactNode` prop added |
| `NavItem` | `SettingsPage.tsx:553` | Add `'field-mapping'` item under new "Copying" group |
| `Separator` | `src/components/ui/separator.tsx` | Between nav groups |
| `Skeleton` | `src/components/ui/skeleton.tsx` | Loading state (3 skeleton rows while data loads) |
| `schemaCacheStore` | `src/stores/schemaCacheStore.ts` | `loadSchema`, `refresh` for target field data |

---

## Architecture Patterns

### System Architecture Diagram

```
SettingsPage.tsx
  activeSection: 'field-mapping'
       │
       ▼
FieldMappingSection.tsx  (mount)
  ├── invoke('get_field_mapping')
  │         └── mapping.db → Vec<FieldMappingRow>
  │
  ├── schemaCacheStore.loadSchema('source', null, null)
  │         └── discover_source_fields → Vec<FieldSchema>
  │
  ├── schemaCacheStore.loadSchema('target', projectKey, issueTypeId)
  │         └── get_target_field_schema_for_issuetype → Vec<FieldSchema>
  │
  ├── [Drift detection] rows × target cache → driftedSourceFieldIds: Set<string>
  ├── [Suggestions] (source fields − mapped fields) × target fields → suggestions[]
  │
  ├── SuggestionsPanel
  │       [Accept] → invoke('set_field_mapping') → update rows
  │       [Dismiss] → invoke('set_field_mapping', {target_field_id: ""}) → update rows
  │
  ├── MappingRow (per row)
  │       target combobox → invoke('set_field_mapping') + inline "Saved" check
  │       transformer combobox → invoke('set_field_mapping') + inline "Saved" check
  │       [×] delete → invoke('delete_field_mapping') + remove from rows
  │       DriftWarning [Remove] → invoke('delete_field_mapping')
  │
  ├── [+ Add field mapping] → append blank row (new source_field_id)
  │
  └── Section header: [↺ Refresh schema]
            click → schemaCacheStore.refresh('target', projectKey, issueTypeId)
                  → schemaCacheStore.refresh('source', null, null)
                  → schemaCacheStore.loadSchema(…) re-fetches both
                  → re-run drift detection + suggestions
                  → setLastRefreshed(Date.now())
```

### Recommended Project Structure

```
src/
├── features/
│   ├── field-mapping/                   # NEW — Phase 21
│   │   ├── FieldMappingSection.tsx      # Orchestrator
│   │   ├── MappingRow.tsx               # Single row with comboboxes + auto-save
│   │   ├── SuggestionsPanel.tsx         # Collapsible suggestions above table
│   │   ├── DriftWarning.tsx             # Inline amber warning per drifted row
│   │   ├── transformerOptions.ts        # transformer filtering rule + option list
│   │   ├── heuristics.ts                # case-insensitive + synonym name match
│   │   ├── types.ts                     # FieldMappingRow TS type (mirrors Rust struct)
│   │   └── __tests__/
│   │       ├── FieldMappingSection.test.tsx
│   │       ├── MappingRow.test.tsx
│   │       ├── SuggestionsPanel.test.tsx
│   │       └── heuristics.test.ts
│   └── connections/
│       └── SettingsPage.tsx             # MODIFIED — add nav group + section case
├── types/
│   └── fieldSchema.ts                   # EXISTING (no changes needed)
├── stores/
│   └── schemaCacheStore.ts              # EXISTING (no changes needed)
└── i18n/locales/
    ├── en.json                          # MODIFIED — add settings.fieldMapping.* keys
    └── sk.json                          # MODIFIED — add Slovak translations
```

### Pattern 1: FieldMappingRow TypeScript Type

The Rust `FieldMappingRow` struct uses `#[serde(rename_all = "camelCase")]`. The TypeScript mirror:

```typescript
// Source: src-tauri/src/field_transform/mod.rs:135 (verified)
// src/features/field-mapping/types.ts
import type { FieldSchemaType } from '@/types/fieldSchema';

export interface FieldMappingRow {
  sourceFieldId: string;
  targetFieldId: string;    // "" = dismissed suggestion sentinel
  transformerKind: string;  // "identity" | "user" | "version" | "component" | "wiki_to_adf"
  sourceSchema: FieldSchemaType;
  targetSchema: FieldSchemaType;
}
```

[VERIFIED: field_transform/mod.rs:135 — serde(rename_all = "camelCase") confirmed]

### Pattern 2: Extending SectionCard with headerAction

`SectionCard` at `SettingsPage.tsx:232` currently only takes `title` + `children`. It needs a `headerAction` prop to host the Refresh button + timestamp on the right side:

```typescript
// Source: SettingsPage.tsx:232 (verified structure)
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
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        {children}
      </div>
    </div>
  );
}
```

[VERIFIED: existing SectionCard lacks headerAction — verified from SettingsPage.tsx:232–241]

### Pattern 3: ActiveSection Extension

```typescript
// Source: SettingsPage.tsx:221 (verified)
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
  | 'field-mapping'; // ADD THIS
```

Then add to `renderContent()` switch and to the sidebar nav.

### Pattern 4: VirtualizedCombobox usage for target field combobox

```typescript
// Source: VirtualizedCombobox.tsx:9–23 (verified interface)
// Usage in MappingRow.tsx:
<VirtualizedCombobox<FieldSchema>
  items={targetFields}
  value={selectedTarget}
  onChange={(field) => handleTargetChange(field)}
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
```

[VERIFIED: VirtualizedCombobox.tsx — all used props confirmed in interface]

### Pattern 5: Invoke pattern (matches existing SettingsPage pattern)

```typescript
// Source: SettingsPage.tsx various (verified — no Zustand store, direct invoke)
async function handleTargetChange(sourceFieldId: string, newTarget: FieldSchema) {
  try {
    await invoke('set_field_mapping', {
      row: {
        sourceFieldId,
        targetFieldId: newTarget.fieldId,
        transformerKind: defaultTransformer(newTarget.schema),
        sourceSchema: row.sourceSchema,
        targetSchema: newTarget.schema,
      } satisfies FieldMappingRow,
    });
    setFeedback('saved');
    setTimeout(() => setFeedback(null), 1500);
  } catch {
    toast.error(t('settings.fieldMapping.saveError'));
  }
}
```

[VERIFIED: commands.rs:1344 — set_field_mapping takes `row: FieldMappingRow`]

### Pattern 6: Refresh schema flow using schemaCacheStore

```typescript
// Source: schemaCacheStore.ts:78–88 (verified)
// FieldMappingSection.tsx — handleRefresh
async function handleRefresh() {
  setRefreshing(true);
  try {
    // 1. Clear SQLite cache entries
    await schemaCacheStore.refresh('source', null, null);
    await schemaCacheStore.refresh('target', projectKey, issueTypeId);
    // 2. Re-fetch (cache miss triggers live HTTP fetch via get_or_fetch_*)
    await schemaCacheStore.loadSchema('source', null, null);
    await schemaCacheStore.loadSchema('target', projectKey, issueTypeId);
    // 3. Record frontend timestamp (no backend command for MAX(cached_at))
    setLastRefreshed(Date.now());
    // 4. Re-derive drift + suggestions (happens from store subscription)
  } catch {
    toast.error(t('settings.fieldMapping.refreshError'));
  } finally {
    setRefreshing(false);
  }
}
```

[VERIFIED: schemaCacheStore.ts:78–91 — refresh clears in-memory cache + calls refresh_field_schema_cache]

### Pattern 7: Heuristic name matching

```typescript
// src/features/field-mapping/heuristics.ts
// ASSUMED pattern — standard case-insensitive + synonym approach
const SYNONYMS: Record<string, string[]> = {
  description: ['desc', 'body', 'details'],
  priority: ['severity', 'importance', 'urgency'],
  assignee: ['assigned_to', 'owner'],
  reporter: ['created_by', 'author', 'submitter'],
  labels: ['tags', 'label'],
};

export function findNameMatchSuggestion(
  sourceFieldId: string,
  sourceName: string,
  targetFields: FieldSchema[],
): FieldSchema | null {
  const lower = sourceName.toLowerCase().replace(/[-_ ]/g, '');
  // 1. Exact match on field_id
  const byId = targetFields.find(f => f.fieldId === sourceFieldId);
  if (byId) return byId;
  // 2. Case-insensitive name match (normalized)
  const byName = targetFields.find(f => f.name.toLowerCase().replace(/[-_ ]/g, '') === lower);
  if (byName) return byName;
  // 3. Synonym check
  for (const [canonical, syns] of Object.entries(SYNONYMS)) {
    if (lower === canonical || syns.includes(lower)) {
      const match = targetFields.find(f => {
        const fn = f.name.toLowerCase().replace(/[-_ ]/g, '');
        return fn === canonical || syns.includes(fn);
      });
      if (match) return match;
    }
  }
  return null;
}
```

[ASSUMED — CONTEXT.md specifies "case-insensitive equality + a small synonym set"; exact synonyms are Claude's discretion]

### Anti-Patterns to Avoid

- **Storing large schema arrays in FieldMappingSection local state:** Source + target schemas should stay in `schemaCacheStore` — only derive computed data (driftedIds, suggestions) in local state or useMemo.
- **Calling `set_field_mapping` with stale `sourceSchema`/`targetSchema` when only updating `targetFieldId`:** Always pass the latest schema objects from the cache — seed rows have `FieldSchemaType::Any` / `source_schema: null`; read the current cache value for the new target schema.
- **Re-opening the combobox dropdown after auto-save:** The `VirtualizedCombobox` controls its own open/close state; the parent should not try to reset it on save — it auto-closes on `onChange`.
- **Drift check against stale in-memory schema:** Run drift detection inside a `useMemo` that depends on both `mappingRows` and `targetFields` from the store — not in a useEffect that only runs on mount.
- **Using `discover_source_fields` for "source fields" in the editor:** Source field discovery hits the live Jira API. Use `schemaCacheStore.loadSchema('source', null, null)` which is cache-first — same command, same cache store, but only fetches if cache is empty.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualized combobox for target field | Custom dropdown | `VirtualizedCombobox` from Phase 20 | Already handles 5000+ items, keyboard nav, outside-click, search |
| Toast notifications | Custom alert | `sonner` (new install) | shadcn standard; handles stacking, accessibility, timing |
| Collapsible suggestions | Custom toggle | Native `<details>` or shadcn Collapsible | CSS-only collapse; no JS state needed for basic functionality |
| Transformer option list | Hardcoded in component | `transformerOptions.ts` module | Keeps filtering rule testable and reusable by Phase 22 |
| Heuristic matching | Inline in component | `heuristics.ts` module | Must be unit-tested independently; reusable in Phase 22 |
| Schema cache management | Direct invoke calls | `schemaCacheStore` | Already handles loading states, error states, cache-key logic |

**Key insight:** The `schemaCacheStore` already implements the full refresh flow. Phase 21 should subscribe to it rather than duplicating invoke logic.

---

## Common Pitfalls

### Pitfall 1: refresh_field_schema_cache only CLEARS — it does not re-fetch

**What goes wrong:** Clicking "Refresh schema" calls `refresh_field_schema_cache` (which just deletes SQLite rows), sees the cache as empty, and the UI shows no fields.
**Why it happens:** The command is `clear_cache_for` under the hood — it empties the SQLite table for the given side/project/issuetype tuple. A re-fetch requires calling `get_target_field_schema_for_issuetype` / `discover_source_fields` after clearing.
**How to avoid:** Always follow `schemaCacheStore.refresh(…)` with `schemaCacheStore.loadSchema(…)`. The `refresh` method in schemaCacheStore already clears in-memory state AND calls `refresh_field_schema_cache`; `loadSchema` re-fetches.
**Warning signs:** Target field combobox shows empty list after clicking refresh.

[VERIFIED: field_discovery.rs:490–528 — get_or_fetch_target_schema returns cache hit OR live fetch; commands.rs:1299 — refresh_field_schema_cache only calls clear_cache_for]

### Pitfall 2: No Tauri command for MAX(cached_at) — "Last refreshed" timestamp

**What goes wrong:** CONTEXT.md D-12 says "derived from `MAX(cached_at)` in `field_schema_cache`" but there is no Tauri command exposing this value. Attempting to add a new Tauri command is out-of-scope for Phase 21.
**Why it happens:** Phase 17 stores `cached_at` per row in SQLite but did not expose an aggregate query command.
**How to avoid:** Track `lastRefreshed` as a `useState<number | null>` in `FieldMappingSection`. Initialize from `null` (shows nothing until first successful load). On initial mount, set it to `Date.now()` after the first successful `loadSchema`. On each Refresh button click, set it to `Date.now()` after the refresh+reload completes.
**Warning signs:** If a "get_max_cached_at" command is not found at implementation time — this is expected. Use frontend timestamp.

[VERIFIED: commands.rs full scan — no command exposing cached_at; field_mapping_db.rs — only private get_cached_schemas method that omits cached_at from return type]

### Pitfall 3: Seed rows have null source/target schema JSON

**What goes wrong:** The 5 seeded defaults (`description`, `labels`, `priority`, `assignee`, `reporter`) were inserted with `source_schema_json = NULL` and `target_schema_json = NULL`. When loaded via `get_field_mapping`, these map to `FieldSchemaType::Any`.
**Why it happens:** Phase 19 seed function uses `NULL` for schema columns (field_mapping_db.rs:75–81).
**How to avoid:** When displaying transformer options for a seed row, fall back gracefully — `FieldSchemaType::Any` rows should show the full transformer list (all options available). The `transformerOptions.ts` module should handle `type: 'any'` by returning all known transformers.
**Warning signs:** Seed rows' transformer combobox shows empty list.

[VERIFIED: field_mapping_db.rs:65–82 — seed defaults use NULL for schema JSON columns; get_all_mapping_rows:305–327 — falls back to FieldSchemaType::Any]

### Pitfall 4: issueTypeId is not stored in connectionStore or any global state

**What goes wrong:** `get_target_field_schema_for_issuetype` requires both `projectKey` and `issuetypeId`. `targetProjectKey` is available in `connectionStore`. But `issuetypeId` has no persistent store — it is only transient in `CopyPreviewModal`.
**Why it happens:** Phase 17/19 designed the schema cache per `(project_key, issuetype_id)` tuple. For the global editor view, there is no "current issue type" concept.
**How to avoid:** The Mapping Editor should use `issuetypeId = null` (global source fields) for source, and for target: use `null` issuetype if available (source global has null tuple; target can be queried with null issuetype for the non-createmeta path). However, `get_target_field_schema_for_issuetype` REQUIRES a non-null issuetype. Use `prewarmedIssueTypes` from `schemaCacheStore` to get the first available issue type for the target project, then load that schema. Alternatively: use the first issue type from `prewarmedIssueTypes[projectKey]?.[0]?.id`.
**Warning signs:** `invoke('get_target_field_schema_for_issuetype', { projectKey, issuetypeId: null })` returns an error.

[VERIFIED: commands.rs:1184–1208 — issuetype_id is a required String parameter; field_discovery.rs:490 — function signature requires &str for issuetype_id; schemaCacheStore.ts:15 — prewarmedIssueTypes: Record<string, IssueTypeRef[]> available]

**Recommended approach:** In `FieldMappingSection`, use `useSchemaCacheStore(s => s.prewarmedIssueTypes[projectKey ?? ''])` to get issue types, pick the first one, and call `loadSchema('target', projectKey, firstIssueTypeId)`. Show a "Select an issue type" prompt if no issue types are prewarmed (edge case).

### Pitfall 5: VirtualizedCombobox trigger button has min-h-11 (44px) — tall for table rows

**What goes wrong:** The existing `VirtualizedCombobox` has `className="w-full justify-between min-h-11"` on the trigger button (44px height). In a compact mapping table row (min-height 40px from UI-SPEC), this causes overflow.
**Why it happens:** Phase 20 designed comboboxes for form layouts, not compact tables.
**How to avoid:** Wrap the combobox in a container that overrides the button height. Either add a `compact` prop or override via `className` if the component accepts it. The `Button` component used inside accepts `size="sm"` — the `VirtualizedCombobox` already passes `size="sm"` to the trigger Button. The `min-h-11` is baked into the Button's className string in VirtualizedCombobox.tsx:128. For Phase 21, override with a wrapper `<div className="[&_button]:min-h-9">` or fork a compact variant of the trigger.
**Warning signs:** Table rows are noticeably taller than the 40px min-height specified.

[VERIFIED: VirtualizedCombobox.tsx:128 — `className={cn('w-full justify-between min-h-11')}`]

### Pitfall 6: Sonner Toaster must be mounted once in the app root

**What goes wrong:** `toast.error(…)` calls fail silently if `<Toaster />` is not rendered in the component tree.
**Why it happens:** Sonner requires exactly one `<Toaster />` mount point globally.
**How to avoid:** Add `<Toaster />` to `App.tsx` (or the main layout) once during Wave 0. It renders as a portal so it does not affect layout.
**Warning signs:** toast calls execute without visible notifications.

[VERIFIED: sonner npm registry documentation; package not yet installed — confirmed from package.json]

### Pitfall 7: ActiveSection type must be extended for TypeScript to compile

**What goes wrong:** Adding `case 'field-mapping':` to `renderContent()` without adding `'field-mapping'` to the `ActiveSection` union causes a TypeScript error on the `NavItem` component which types `section` as `ActiveSection`.
**Why it happens:** `NavItem` at SettingsPage.tsx:553 takes `section: ActiveSection` — strict union type.
**How to avoid:** Add `| 'field-mapping'` to the `ActiveSection` type FIRST (or in the same commit).
**Warning signs:** TypeScript error on `<NavItem section="field-mapping" …>`.

[VERIFIED: SettingsPage.tsx:221–230, 553 — ActiveSection union type and NavItem both verified]

---

## Code Examples

### Loading sequence in FieldMappingSection

```typescript
// Source: schemaCacheStore.ts verified API, get_field_mapping command verified
useEffect(() => {
  async function load() {
    setLoading(true);
    try {
      // 1. Load mapping rows
      const rows = await invoke<FieldMappingRow[]>('get_field_mapping');
      setMappingRows(rows);
      // 2. Load source schema (cache-first)
      const sourceKey = schemaCacheKey('source', null, null);
      if (!schemaCache[sourceKey] || schemaCache[sourceKey].status === 'error') {
        await loadSchema('source', null, null);
      }
      // 3. Load target schema (cache-first, needs issueTypeId)
      if (projectKey && issueTypeId) {
        const targetKey = schemaCacheKey('target', projectKey, issueTypeId);
        if (!schemaCache[targetKey] || schemaCache[targetKey].status === 'error') {
          await loadSchema('target', projectKey, issueTypeId);
        }
      }
      setLastRefreshed(Date.now());
    } finally {
      setLoading(false);
    }
  }
  void load();
}, []);
```

### Transformer filtering rule

```typescript
// src/features/field-mapping/transformerOptions.ts
// Source: UI-SPEC transformer filtering rule (verified from 21-UI-SPEC.md)
export interface TransformerOption {
  value: string;
  label: string;
}

export function getTransformerOptions(schema: FieldSchemaType): TransformerOption[] {
  const identity = { value: 'identity', label: 'Identity' };
  switch (schema.type) {
    case 'string':
      return [identity, { value: 'wiki_to_adf', label: 'Wiki → ADF' }];
    case 'user':
      return [{ value: 'user', label: 'User' }, identity];
    case 'array':
      if (schema.items === 'user') return [{ value: 'user', label: 'User' }, identity];
      return [identity];
    case 'priority':
      return [{ value: 'priority', label: 'Priority' }, identity];
    case 'number':
    case 'date':
    case 'datetime':
    case 'option':
    case 'option-with-child':
    case 'issuetype':
    case 'any':
    default:
      return [identity];
  }
}
```

### Drift detection

```typescript
// src/features/field-mapping/FieldMappingSection.tsx
// Source: derived from D-14 (CONTEXT.md) and verified command shapes
const driftedSourceFieldIds = useMemo(() => {
  const targetFieldIds = new Set(targetFields.map(f => f.fieldId));
  return new Set(
    mappingRows
      .filter(r => r.targetFieldId !== '' && !targetFieldIds.has(r.targetFieldId))
      .map(r => r.sourceFieldId)
  );
}, [mappingRows, targetFields]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global toast in SettingsPage | Sonner portal (app-root mount) | Phase 21 (new) | Single install; all future components use it |
| SectionCard: title + children only | SectionCard: title + children + headerAction | Phase 21 (extend) | Backward-compat — headerAction is optional |

**Not deprecated for this phase:** The existing `invoke` direct call pattern in SettingsPage sections is correct to follow — no need for a Zustand store for Phase 21.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The synonym set for heuristic matching (desc/severity/etc.) covers the primary use cases | Pattern 7 / Heuristics | Suggestions misses some common matches; low risk — user can accept/dismiss manually |
| A2 | Using frontend `Date.now()` for "Last refreshed" timestamp is acceptable given no backend command | Pitfall 2 / Refresh pattern | If user expects the timestamp to reflect actual SQLite `cached_at`, could be slightly off (by the time it takes to write to DB vs record in JS); practically negligible |
| A3 | The first issue type from `prewarmedIssueTypes` is sufficient for the global mapping editor view | Pitfall 4 | If the user has a project with multiple issue types and the first has a different schema, some target fields may be missing from the combobox; acceptable for Phase 21 scope |
| A4 | Native `<details>/<summary>` is acceptable for the Suggestions panel instead of Radix Collapsible | Standard Stack | If the team prefers Radix for style consistency, collapsible needs installing; low risk |

---

## Open Questions

1. **Which issue type to use for the target field combobox?**
   - What we know: `get_target_field_schema_for_issuetype` requires a non-null `issuetype_id`. `prewarmedIssueTypes[projectKey]` holds the list from Phase 17 pre-warm.
   - What's unclear: Should the editor show a union of all issue types' fields, or just the first one?
   - Recommendation: Use the first prewarmed issue type for Phase 21. Phase 22 (per-copy override) will let users select the issue type at copy time. Document this limitation in the UI (empty state hint).

2. **State management: local state vs Zustand store?**
   - What we know: Other SettingsPage sections use local state + direct `invoke`. CONTEXT.md says "Zustand store for mapping editor is reasonable if row count makes state management complex."
   - What's unclear: Row count could realistically be 5–20 rows (5 defaults + custom fields). Not complex.
   - Recommendation: Use local `useState` in `FieldMappingSection` for `mappingRows`, `loading`, `lastRefreshed`, `refreshing`. Read target fields from `useSchemaCacheStore`. This matches the existing Settings pattern and avoids store proliferation.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 21 is a pure frontend TypeScript build. No new CLI tools, external services, or runtimes beyond the existing project toolchain (Node, npm, Rust/Cargo for the Tauri backend). The Tauri backend changes are zero. All required npm packages verified via `npm view`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=dot src/features/field-mapping` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-05 | Refresh schema button calls refresh + loadSchema | unit | `npm test -- src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` | ❌ Wave 0 |
| MAP-03 | Add row → invoke set_field_mapping with new source_field_id | unit | `npm test -- src/features/field-mapping/__tests__/MappingRow.test.tsx` | ❌ Wave 0 |
| MAP-04 | Edit combobox → invoke set_field_mapping; delete row → invoke delete_field_mapping | unit | `npm test -- src/features/field-mapping/__tests__/MappingRow.test.tsx` | ❌ Wave 0 |
| MAP-05 | Rows with target_field_id not in target schema show DriftWarning | unit | `npm test -- src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` | ❌ Wave 0 |
| EDIT-01 | Clicking "Field Mapping" nav item shows field mapping content | unit | `npm test -- src/features/connections/__tests__/SettingsPage.test.tsx` | ✅ exists (needs new test added) |
| EDIT-02 | Suggestions panel shows for unmapped source fields with name-match suggestions | unit | `npm test -- src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` | ❌ Wave 0 |
| EDIT-03 | Accept suggestion calls set_field_mapping; dismiss calls set_field_mapping with empty target | unit | `npm test -- src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --reporter=dot src/features/field-mapping`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` — covers DISC-05, MAP-05
- [ ] `src/features/field-mapping/__tests__/MappingRow.test.tsx` — covers MAP-03, MAP-04
- [ ] `src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` — covers EDIT-02, EDIT-03
- [ ] `src/features/field-mapping/__tests__/heuristics.test.ts` — covers matching logic (pure function, easy to test)
- [ ] `src/features/connections/__tests__/SettingsPage.test.tsx` — add test: clicking Field Mapping nav renders field mapping section (EDIT-01)
- [ ] Sonner install: `npm install sonner` + `npx shadcn@latest add sonner` + `<Toaster />` in App.tsx

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes; credentials managed by existing keychain layer |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | Single-user desktop app; no multi-user access control |
| V5 Input Validation | yes | Combobox values are typed selections from known schema (not free-text injection). `target_field_id` is validated against known field IDs from cache. Empty string sentinel for dismissed suggestions is intentional. |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Storing malformed `transformer_kind` | Tampering | Transformer options built from a closed enum (`transformerOptions.ts`); Rust backend validates transformer_kind at apply time |
| Schema injection via field_name | Tampering | Field names are display-only labels from authenticated Jira API; combobox selection enforces typed FieldSchema objects, not raw strings |
| Tauri IPC payload crafting | Tampering | Tauri 2.x commands use typed deserialization; FieldMappingRow serde(rename_all="camelCase") — malformed payloads return Err, never execute |

---

## Sources

### Primary (HIGH confidence)

- `src-tauri/src/field_mapping_db.rs` — FieldMappingDb: table schemas, seed logic, all CRUD methods verified
- `src-tauri/src/commands.rs:1299–1365` — refresh_field_schema_cache, get_field_mapping, set_field_mapping, delete_field_mapping — verified signatures
- `src-tauri/src/field_transform/mod.rs:135` — FieldMappingRow struct + serde attributes verified
- `src-tauri/src/field_discovery.rs:490–558` — get_or_fetch_target_schema and get_or_fetch_source_global cache-first patterns verified
- `src/features/connections/SettingsPage.tsx` — ActiveSection union (line 221), SectionCard (232), NavItem (553), sidebar groups (1124–1184) verified
- `src/features/field-renderers/components/VirtualizedCombobox.tsx` — full interface and implementation verified
- `src/features/field-renderers/registry.ts` — getRenderer function verified
- `src/types/fieldSchema.ts` — FieldSchema, FieldSchemaType verified
- `src/stores/schemaCacheStore.ts` — full store API verified (loadSchema, refresh, preWarm, clearCache)
- `package.json` — all dependency versions verified
- `src/components/ui/` — skeleton, separator, button confirmed present; sonner, collapsible confirmed absent
- `.planning/phases/21-mapping-editor-settings-ui/21-CONTEXT.md` — all decisions D-01 through D-15 verified
- `.planning/phases/21-mapping-editor-settings-ui/21-UI-SPEC.md` — full design contract verified
- `npm view sonner version` → 2.0.7 [VERIFIED]
- `npm view @radix-ui/react-collapsible version` → 1.1.12 [VERIFIED]

### Secondary (MEDIUM confidence)

- Sonner usage pattern (mount Toaster in App.tsx root) — standard documented pattern, not yet in codebase

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all library versions verified from package.json and npm registry
- Architecture: HIGH — all Tauri commands, store APIs, and component interfaces verified from source
- Pitfalls: HIGH — each pitfall verified directly from source code
- Heuristic synonym set: LOW — exact synonym list is Claude's discretion; functional approach verified

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable stack, 30 days)
