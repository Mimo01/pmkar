# Phase 22: Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the hardcoded right column of `CopyPreviewModal` with a `DynamicTargetForm` driven by the saved mapping, layered with per-copy in-memory overrides, reactive required-field gating, an issue-type chooser, and an always-visible person picker with email-match pre-fill.

**In scope:**
- Issue-type chooser at the top of the right column (VirtualizedCombobox, defaults to source-name match)
- Dedicated summary input above DynamicTargetForm (always visible, always editable)
- Dedicated "Gaps" section listing required-but-unmapped target fields with fill-in inputs + "Map" link
- `DynamicTargetForm` rendering mapped fields driven by saved mapping + per-copy override values
- Person picker (Phase 20 renderer) always visible for person/multi-person fields, with email-match pre-fill
- Required-field gating: Copy button disabled + tooltip until all gaps are filled
- Per-copy override state in copyStore.ts — cleared on modal close (OVRD-06)
- `confirmCopy` continues to call `copy_ticket` with existing fixed fields (Phase 23 wires copy_ticket_v2)

**Out of scope:**
- `copy_ticket_v2` Tauri command (Phase 23)
- Inline mapping editor inside the copy preview (Phase 23 territory)
- Mutating the global saved mapping from within the copy preview
- ADF rich-text editor for description (deferred post-v0.4.0)

</domain>

<decisions>
## Implementation Decisions

### Summary Field
- **D-01:** Summary stays as a **dedicated text input above DynamicTargetForm**, not inside it. Always visible at the top of the right column below the issue-type chooser.
- **D-02:** Summary input pre-fills from the source ticket's summary (same as today) and is always editable regardless of whether the mapping has a `summary → wiki_to_adf` row. The mapping row drives the backend transformer; the display/edit value remains plain text.

### Issue-Type Chooser
- **D-03:** Use **VirtualizedCombobox** (consistent with Phase 20/21 picker pattern — keyboard-navigable, searchable, handles 100+ issue types). Appears at the top of the right column before the summary input.
- **D-04:** Source data: use `schemaCacheStore.prewarmedIssueTypes[projectKey]` — already populated by `pre_warm_target_issue_types` from the connection probe. Fall back to an on-demand `pre_warm_target_issue_types` invoke if the cache is empty (e.g., first run before probe completes).
- **D-05:** Default selection: exact name match (case-insensitive) against source issue type name. When no match, default to the target project's first issue type.
- **D-06:** "Defaulted" notice: **inline muted caption below the chooser** — `"Defaulted — no match for '{sourceTypeName}'"`. Disappears once the user picks manually.

### Required-Gap Surfacing
- **D-07:** Required-but-unmapped fields appear in a **dedicated "Gaps" section** at the top of the right column, between the summary input and DynamicTargetForm. The section has an amber `⚠` header: "Required fields with no mapping". Each row shows the field name + a fill-in input (typed per field schema) + a "Map →" link.
- **D-08:** "Map →" link navigates to **Settings > Field Mapping** (closes the modal, opens Settings). No inline mapping editor inside the copy preview.
- **D-09:** Copy button disabled state uses a **tooltip listing missing fields**: `"Fill in required fields: {field1}, {field2}"`. The gap section itself already shows what's missing; the tooltip is a quick reminder without additional visual noise.
- **D-10:** Required-field evaluation re-runs whenever the user changes the target issue type (fresh createmeta fetch → recalculate gaps). OVRD-02 locked by requirement.

### Override Store Design
- **D-11:** Extend **existing `copyStore.ts`** with new fields:
  ```ts
  targetIssueTypeId: string | null;
  overrideValues: Record<string, unknown>;   // per-copy override map, keyed by fieldId
  resolvedTargetFields: FieldSchema[];        // createmeta fields for selected issue type
  setTargetIssueTypeId: (id: string) => void;
  setOverrideValue: (fieldId: string, v: unknown) => void;
  clearOverrides: () => void;
  ```
  Single source of truth for the copy lifecycle. `reset()` clears all override state (OVRD-06 enforcement).
- **D-12:** `confirmCopy` continues to call `copy_ticket` with the **existing fixed field payload** (targetPriorityId, targetLabels, targetDescription, etc.). The new `overrideValues` and `resolvedTargetFields` are displayed in the UI but not yet wired to the backend — Phase 23 replaces this call with `copy_ticket_v2` end-to-end.
- **D-13:** The old right-column UI state (targetStatus, targetPriorityId, targetLabels, selectedLabels, targetDescription) stays in the store but is de-emphasized in the UI. DynamicTargetForm + overrideValues own the visible form; the old fields remain for the Phase 22 → Phase 23 handoff seam.

### Person Picker
- **D-14:** Person picker rendered by Phase 20's UserPickerRenderer / MultiUserPickerRenderer for every `user` / `array[user]` field — always visible even when an email match is found (PERS-01 locked by requirement).
- **D-15:** Pre-fill via exact-email match: when source user has `emailAddress`, search target users by that email, pre-populate the picker value with a green-check visual (value shown as selected). Picker remains open/interactive (PERS-02).
- **D-16:** No pre-fill (and no error) when source user has no `emailAddress` due to Cloud privacy mode (PERS-04). Picker renders empty and interactive.
- **D-17:** User can search by name or email via the Phase 16 `search_jira_users_by_domain` command (PERS-03), wired through `DynamicTargetForm`'s `searchCallbacks.onSearchUsers`.

### Claude's Discretion
- Exact column widths and visual styling of the gap section (amber border, badge style, etc.)
- Loading spinner placement during issue-type-triggered schema refresh
- Whether `resolvedTargetFields` are loaded eagerly on modal open or lazily on first user interaction with the right column
- Order of fields in DynamicTargetForm (follow createmeta order unless required fields appear first)
- i18n key naming for new gap-section strings

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PERS-01…PERS-04, §OVRD-01…OVRD-06 — locked requirements for Phase 22

### Prior Phase Decisions
- `.planning/phases/21-mapping-editor-settings-ui/21-CONTEXT.md` — Phase 21 decisions: row editing UX, save model (per-row auto-save), VirtualizedCombobox compactness wrapper pattern
- `.planning/phases/20-renderer-registry-field-type-aware-controls/` — Phase 20: DynamicTargetForm, renderer registry, VirtualizedCombobox

### Existing Code to Read Before Planning
- `src/features/tickets/CopyPreviewModal.tsx` — full existing modal (the right column is replaced in this phase)
- `src/features/tickets/copyStore.ts` — store to extend with override state
- `src/features/field-renderers/DynamicTargetForm.tsx` — the form component to integrate
- `src/stores/schemaCacheStore.ts` — `prewarmedIssueTypes`, `loadSchema`, `schemaCacheKey`
- `src/types/fieldSchema.ts` — `FieldSchema`, `IssueTypeRef`, `FieldSchemaType`
- `src/features/field-mapping/FieldMappingSection.tsx` — patterns for consuming schemaCacheStore + mapping rows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DynamicTargetForm` (`src/features/field-renderers/DynamicTargetForm.tsx`): takes `fields`, `values`, `onChange`, `searchCallbacks` — ready to drop into right column
- `VirtualizedCombobox` (`src/features/field-renderers/VirtualizedCombobox.tsx`): Phase 20 shared base, use for issue-type chooser
- `schemaCacheStore.prewarmedIssueTypes` — already holds `IssueTypeRef[]` per target project key, no extra fetch needed normally
- `search_jira_users_by_domain` — Phase 16 Tauri command already wired for user picker search
- `useMappingEditorStore` in `FieldMappingSection.tsx` — pattern for co-located Zustand store; same approach can be used for override UI state if needed

### Established Patterns
- Per-row auto-save (Phase 21 D-09): no "Save" button; changes invoke Tauri commands immediately. Override values are in-memory only — no Tauri call needed for overrides.
- VirtualizedCombobox compactness: `[&_button]:min-h-9` wrapper applied in Phase 21's MappingRow — apply same in copy preview pickers
- `schemaCacheKey(side, projectKey, issuetypeId)` pattern for cache lookup — use for loading target-side fields per selected issue type
- Phase 21 `useSchemaArrays()` pattern: derive source/target field arrays from cache using `useMemo` — mirror for copy preview right column

### Integration Points
- `CopyPreviewModal.tsx` right column (`w-1/2 overflow-y-auto p-4`) — replace its content with: issue-type chooser + summary input + gaps section + DynamicTargetForm
- `copyStore.startPreview()` — extend to also load `prewarmedIssueTypes` and set initial `targetIssueTypeId`; trigger `loadSchema('target', projectKey, issueTypeId)` for initial field set
- `copyStore.reset()` — must clear `targetIssueTypeId`, `overrideValues`, `resolvedTargetFields` (OVRD-06)
- Saved mapping rows: read via `get_field_mapping` Tauri command (Phase 19) on modal open — join against `resolvedTargetFields` to compute gaps

</code_context>

<specifics>
## Specific Ideas

- **Right column structure accepted by user:**
  ```
  Target
  ────────────────────────────────
  Issue type
  [📌 Story                      ▾]
    └→ Defaulted — no match for 'Bug'   ← muted caption, only when defaulted

  Summary *
  [PROJ-123 source summary ___________]

  ⚠ Required fields with no mapping
  ┃ Components *  [ fill in ▾ ]  → Map
  ┃ Environment * [ fill in  ]   → Map
  ──────
  [Assignee picker          ]
  [Priority      ▾]
  [Labels        ▾]
  ...
  ```

- **Copy button disabled tooltip:** `"Fill in required fields: Components, Environment"`

- **"Map →" link behavior:** clicks close the modal and navigate to Settings > Field Mapping (no inline mapping editor in copy preview)

- **Person picker pre-fill with green check:** source email matched → picker shows the matched user as selected with a green check indicator; picker remains visible and interactive

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-copy-preview-override-panel*
*Context gathered: 2026-04-28*
