# Phase 21: Mapping Editor (Settings UI) - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A new "Field Mapping" section in the existing Settings page. Users view, edit, and persist the global source→target field mapping — defaults from Phase 19 seeding + user-added custom rows — with heuristic name-match suggestions, a manual schema refresh, and per-row drift warnings. Relies entirely on Phase 19 backend (3 CRUD Tauri commands) and Phase 20 renderer registry.

**In scope:**
- `field-mapping` nav section added to `SettingsPage.tsx`
- `FieldMappingSection` component (or similar) with: mapping table, suggestions panel, section header with refresh button + timestamp
- Frontend TypeScript types for `FieldMappingRow` (mirroring Rust struct from Phase 18/19)
- Drift detection: compare `target_field_id` of each saved row against current target-side `field_schema_cache`; warn per affected row
- Heuristic name-match: case-insensitive equality + small synonym set against uncached/unmapped source fields

**Out of scope:**
- Per-copy override panel (Phase 22)
- `copy_ticket_v2` wiring (Phase 23)
- New Tauri commands — all 3 CRUD commands exist from Phase 19
- `DynamicTargetForm` wiring for copy preview (Phase 22)

</domain>

<decisions>
## Implementation Decisions

### Row Editing UX
- **D-01:** Each mapping row uses inline comboboxes — target field and transformer are always-accessible dropdowns. No "edit button" needed; clicking the combobox activates it directly.
- **D-02:** Target field combobox sources its list from `field_schema_cache` (target side) — already populated by Phase 17 discovery. No live Jira fetch on editor open. The "Refresh schema" button updates the cache, which updates the available options.
- **D-03:** Transformer kind filtering strategy left to Claude's discretion during planning. Recommended approach: filter to valid transformers per field type (e.g., string fields → `wiki_to_adf` + `identity`; user fields → `user` + `identity`) to prevent invalid combos.
- **D-04:** Table column layout and row width at Claude's discretion. Should use the existing 560px max-width constraint. Suggested column ratios: source name ~35%, target combobox ~35%, transformer ~20%, delete button ~10%.

### Suggestions Section
- **D-05:** Suggestions appear as a separate collapsible panel **above** the mapping table. Shows each unmapped source field with its heuristic-matched target suggestion. Each row has [Accept] and [Dismiss] buttons.
- **D-06:** The suggestions panel appears **any time there are unmapped source fields** in `field_schema_cache` that have no corresponding row in `field_mapping`. Not a one-time show — re-appears after a schema refresh that introduces new source fields.
- **D-07:** Dismissed suggestions are not re-surfaced. Persistence of dismissed state left to Claude's discretion (options: store in `mapping_meta`, or treat dismissed = a mapping row with empty target, or in-session only until refresh).
- **D-08:** Accepting a suggestion immediately calls `set_field_mapping` (per-row auto-save, D-09) and moves the row into the confirmed mapping table.

### Save Model
- **D-09:** Per-row auto-save. Every change (combobox selection, accept suggestion, delete row) immediately calls the corresponding Tauri command (`set_field_mapping` / `delete_field_mapping`). No "Save" button. Confirmation feedback via inline check or toast — matches how other Settings sections behave (e.g., polling frequency saves on click).

### Nav Placement
- **D-10:** Sidebar group placement left to Claude's discretion. Recommended: new "Copying" group between Fetching and Polling, with "Field Mapping" as its sole item. Scales to future Phase 22/23 copy settings.

### Refresh Schema
- **D-11:** "Refresh schema" button and "Last refreshed Xm ago" timestamp live in the **section header area** — same row as the "Field Mapping" section title, aligned right.
- **D-12:** "Last refreshed" timestamp is derived from `MAX(cached_at)` in `field_schema_cache` for the target side. No new storage needed — Phase 17 already populates `cached_at` on every cache write.
- **D-13:** Clicking "Refresh schema" calls the existing `refresh_field_schema_cache` Tauri command (Phase 17). After completion, the mapping table and suggestions panel re-evaluate against the fresh cache, and drift warnings update.

### Drift Warnings
- **D-14:** Drift detection runs on editor open (and after each schema refresh). For each saved mapping row, check if `target_field_id` exists in the current `field_schema_cache` for the target side. Missing = drifted.
- **D-15:** Drifted rows show an inline warning indicator (e.g., orange/amber badge or icon) with a one-click [Remove] action. The warning replaces the target combobox content (or renders alongside it) to make the problem unmissable.

### Claude's Discretion
- Transformer kind filtering strategy per field type (see D-03 note)
- Sidebar group placement (see D-10 note — "Copying" group recommended)
- Dismissed suggestions persistence mechanism (D-07)
- Exact row column widths and table layout (D-04)
- Toast vs inline check for save confirmation
- Zustand store vs local component state — other Settings sections use local state + direct `invoke`; a Zustand store for mapping editor is reasonable if row count makes state management complex

</decisions>

<specifics>
## Specific Ideas

- **Inline combobox mockup (accepted by user):**
  ```
  source: labels           target: [labels ▼]  transformer: [identity ▼]  [×]
  source: custom-field-123 target: [-- pick -- ▼]  transformer: [-- pick -- ▼]  [×]
  ```
- **Suggestions panel mockup (accepted by user):**
  ```
  ▼ Suggestions (3)
    source: custom-field-A  →  custom-field-A  [Accept] [Dismiss]
    source: custom-field-B  →  customfield-b   [Accept] [Dismiss]
    source: custom-field-C  →  Custom Field C  [Accept] [Dismiss]
  ```
- **Section header mockup (accepted by user):**
  ```
  Field Mapping                  [Refresh schema ↺]  Last refreshed 5m ago
  ─────────────────────────────────────────────────────────
  ▼ Suggestions (2)
    ...
  ─────────────
    source: labels  target: [labels ▼] ...
  ```
- **Auto-save mockup (accepted by user):**
  ```
  source: labels  target: [labels ▼]  transformer: [identity ▼]  [×]
                    ↓ user changes target to 'custom_labels'
                 ✓ Saved
  ```

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 19 persistence layer (primary backend dependency)
- `src-tauri/src/field_mapping_db.rs` — `FieldMappingDb` with `upsert_mapping_row`, `get_all_mapping_rows`, `delete_mapping_row`, `get_cached_schemas`, `get_cached_schema_hash`. Phase 21 calls the 3 Tauri commands that wrap these methods.
- `src-tauri/src/commands.rs` lines ~1331–1370 — `get_field_mapping`, `set_field_mapping`, `delete_field_mapping` Tauri commands. Phase 21's frontend invokes these directly.
- `src-tauri/src/field_transform/mod.rs` line ~135 — `FieldMappingRow` struct: `source_field_id`, `target_field_id`, `transformer_kind`, `source_schema: FieldSchemaType`, `target_schema: FieldSchemaType`. Frontend TypeScript mirror needed.

### Phase 17 schema cache + refresh (for target field list + drift)
- `src-tauri/src/commands.rs` line ~1299 — `refresh_field_schema_cache` command. Phase 21 "Refresh schema" button calls this.
- `src-tauri/src/field_mapping_db.rs` line ~159 — `get_cached_schemas` method (reads `field_schema_cache` by side/project/issuetype). Phase 21 uses this to populate target field combobox options and to derive the "Last refreshed" timestamp from `MAX(cached_at)`.

### Phase 20 renderer registry (for field type rendering)
- `src/features/field-renderers/registry.ts` — `getRenderer(schema: FieldSchemaType)` function. Phase 21 may use this to show a field-type chip/preview per mapping row.
- `src/features/field-renderers/types.ts` — `RendererProps`, `SearchCallbacks` interfaces.
- `src/types/fieldSchema.ts` — `FieldSchemaType` discriminated union, `FieldSchema` interface. Phase 21 TypeScript types for `FieldMappingRow` mirror these.

### Existing Settings UI (to extend)
- `src/features/connections/SettingsPage.tsx` — `ActiveSection` type (line 221), `SectionCard` component (line 232), `NavItem` function (line 553), sidebar nav groups (lines 1124–1184). Phase 21 adds `'field-mapping'` to `ActiveSection`, a new nav group or item, and a new `case 'field-mapping':` in `renderContent()`.

### Requirements
- `.planning/REQUIREMENTS.md` — DISC-05, MAP-03, MAP-04, MAP-05, EDIT-01, EDIT-02, EDIT-03 acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 21: Mapping Editor (Settings UI)" — Goal, success criteria SC #1–5 are non-negotiable.

### Project context
- `.planning/PROJECT.md` — shadcn/ui + Linear aesthetic, WCAG AA, React 19, bilingual EN/SK via i18next. Key constraint: "db-per-concern pattern" (mapping.db is separate from app.db).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SectionCard`** (`SettingsPage.tsx:232`): Renders a settings section with a title heading. Phase 21's "Field Mapping" section uses this wrapper — but will need to extend the header area to include the Refresh button + timestamp (requires a `headerAction?: React.ReactNode` prop or a dedicated wrapper).
- **`refresh_field_schema_cache` command** (`commands.rs:1299`): Existing Tauri command from Phase 17. Phase 21 calls this from the "Refresh schema" button without any new backend work.
- **`getRenderer`** (`src/features/field-renderers/registry.ts`): Can be used to show a field-type icon/chip per row (source and target sides) to help users understand what type they're mapping.
- **`VirtualizedCombobox`** (`src/features/field-renderers/components/VirtualizedCombobox.tsx`): Phase 20's shared combobox base (cmdk + @tanstack/react-virtual). Phase 21's target field combobox and transformer combobox should reuse this rather than building new combobox UI.
- **`invoke` pattern** (`SettingsPage.tsx` various): Direct `invoke` calls from component effects/handlers — no Zustand store. Phase 21 can follow the same pattern for simplicity.

### Established Patterns
- **`ActiveSection` union + `renderContent()` switch** (`SettingsPage.tsx:221, 583`): Phase 21 adds `| 'field-mapping'` to `ActiveSection` and one new `case 'field-mapping':` in the switch.
- **Sidebar nav group structure** (`SettingsPage.tsx:1124–1184`): Groups use `<p>` header + `<div className="space-y-0.5">` + `<NavItem>` children. Phase 21 adds a new group block following the same pattern.
- **i18next keys**: All user-facing strings use `t('settings.nav.*')`, `t('settings.group.*')`, `t('settings.section.*')`. Phase 21 adds new keys for "Field Mapping", "Suggestions", "Refresh schema", "Last refreshed", drift warning copy.
- **WCAG AA**: All interactive elements need accessible labels. Comboboxes need `aria-label` per row. Drift warning needs `role="alert"` or `aria-live` region.

### Integration Points
- **`field_schema_cache` for target options**: Call a new Tauri command (or extend existing `get_target_fields` at `commands.rs:1152`) to get `Vec<FieldSchema>` for the target side. Use `field_id` + `name` to populate the target combobox. Reuse `get_cached_schema_hash` to derive "Last refreshed" from `cached_at`.
- **`field_mapping` table for drift detection**: After loading all mapping rows via `get_field_mapping`, cross-reference each `target_field_id` against the set of `field_id` values from `get_cached_schemas(target side)`. Rows with no match = drifted.
- **Phase 22**: Will import this section's Zustand store (if one is created) or the same `get_field_mapping` invoke result to wire the saved mapping into the copy preview.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-mapping-editor-settings-ui*
*Context gathered: 2026-04-28*
