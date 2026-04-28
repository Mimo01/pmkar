# Phase 21: Mapping Editor (Settings UI) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 21-mapping-editor-settings-ui
**Areas discussed:** Row editing UX, Suggestions section, Nav placement + layout, Save model + refresh placement

---

## Row Editing UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline combobox | Target field cell is a combobox showing current value. Click to search/change. Transformer shown as a small dropdown on the same row. Saves on blur or row-level confirm. | ✓ |
| Edit button per row | Click pencil icon to expand an edit zone with confirm/cancel per row. More explicit but two clicks to change a value. | |
| Always-visible inputs | Every row always shows combobox inputs. No click-to-activate. Simple but visually heavy. | |

**User's choice:** Inline combobox (Recommended)
**Notes:** Accepted the mockup showing `target: [labels ▼]  transformer: [identity ▼]  [×]` pattern.

### Transformer filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Filtered by field type | Show only valid transformers for the selected field type. Prevents invalid combos. | |
| Always show all | Simpler — user can pick any transformer. Risk of invalid combos. | |
| You decide | Leave strategy to Claude during planning. | ✓ |

**User's choice:** You decide

### Target field data source

| Option | Description | Selected |
|--------|-------------|----------|
| Schema cache only | Read from field_schema_cache (Phase 17). No extra Tauri call. Fast, offline-capable. | ✓ |
| Live fetch on open | Fresh from Jira Cloud every time. Always up-to-date but slow. | |
| Schema cache + refresh button | Cache by default; Refresh button updates it. | |

**User's choice:** Schema cache only (Recommended)

---

## Suggestions Section

| Option | Description | Selected |
|--------|-------------|----------|
| Separate section at top | Collapsible panel above the mapping table with [Accept] / [Dismiss] per row. | ✓ |
| Inline 'pending' rows in the table | Suggestions as tinted rows at the bottom of the main table. | |
| Dismissable banner | Compact banner; extra click to see suggestions. | |

**User's choice:** Separate section at top (Recommended)
**Notes:** Accepted mockup with `▼ Suggestions (N)` collapsible above the mapping table.

### Suggestion lifetime

| Option | Description | Selected |
|--------|-------------|----------|
| Any time unmapped fields exist | Show whenever source fields in cache have no mapping row. New fields after refresh = new suggestions. | ✓ |
| Only once after discovery | Track in mapping_meta; never show again after first interaction. | |
| You decide | Leave to Claude. | |

**User's choice:** Any time unmapped fields exist (Recommended)

---

## Nav Placement + Layout

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Copying' group | Between Fetching and Polling. Scales to Phase 22/23 copy settings. | |
| Under Connections group | Third item under Connections. | |
| You decide | Leave sidebar group placement to Claude. | ✓ |

**User's choice:** You decide

### Table layout

| Option | Description | Selected |
|--------|-------------|----------|
| Full width, flexible columns | Source ~35%, target ~35%, transformer ~20%, delete ~10%. | |
| You decide | Leave column layout to Claude. | ✓ |

**User's choice:** You decide

---

## Save Model + Refresh Placement

### Save model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row auto-save | Each change calls set_field_mapping / delete_field_mapping immediately. No Save button. Toast or inline check confirmation. | ✓ |
| Explicit 'Save changes' button | Changes held in local state; Save/Discard pair appears on dirty state. | |

**User's choice:** Per-row auto-save (Recommended)
**Notes:** Accepted the `✓ Saved` inline confirmation mockup.

### Refresh button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Section header area | Button + timestamp in top-right of the Field Mapping section title row. Visible without scrolling. | ✓ |
| Below the table | After mapping rows, near the Add Row button. Easy to miss on long lists. | |

**User's choice:** Section header area (Recommended)
**Notes:** Accepted mockup with `Field Mapping  [Refresh schema ↺]  Last refreshed 5m ago` header pattern.

### Timestamp storage

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from field_schema_cache.cached_at | MAX(cached_at) for target side. No new storage. | ✓ |
| Store in mapping_meta | Write 'last_schema_refresh_at' key on each refresh. | |
| You decide | Leave to Claude. | |

**User's choice:** Derive from field_schema_cache.cached_at (Recommended)

---

## Claude's Discretion

- Transformer kind filtering strategy per field type (filter recommended: valid transformers per schema type)
- Sidebar group placement (new "Copying" group between Fetching and Polling recommended)
- Dismissed suggestions persistence mechanism (mapping_meta, empty mapping row, or in-session only)
- Exact table column widths (~35%/35%/20%/10% suggested)
- Toast vs inline check for save confirmation
- Zustand store vs local component state for mapping editor

## Deferred Ideas

None recorded.
