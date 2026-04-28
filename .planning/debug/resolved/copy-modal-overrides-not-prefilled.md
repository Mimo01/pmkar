---
status: resolved
trigger: "After fixing field mapping schema seeds and suggestion persistence, values are still not prefilled in the copy modal"
created: 2026-04-29
updated: 2026-04-29
---

# Debug Session: copy-modal-overrides-not-prefilled

## Symptoms

- expected: Field override dropdowns in the copy modal should be pre-selected with mapped values based on the configured field mappings (source→target)
- actual: Override dropdowns in the copy modal are empty / not pre-populated — user has to manually select values
- scope: All mapped fields; never worked (not a regression)
- timeline: Never worked — the prefill has never happened
- reproduction: Configure field mappings in settings, open copy modal for any story, observe override dropdowns are empty

## Context

Previous debug session (copy-fields-not-mapped) diagnosed two pipeline bugs:
1. seed_defaults_if_empty stored NULL schemas → FieldSchemaType::Any → pipeline silently returned Null (FIXED)
2. handleAcceptSuggestion didn't persist to DB (FIXED)

But the copy modal override dropdowns being empty is a UI-layer issue — the override form needs to be initialized from the configured mappings when the modal opens. This is a separate code path from apply_mapping (which runs on copy execution).

## Current Focus

hypothesis: "overrideValues in copyStore starts as {} and is never seeded from field mapping rows."
test: "Confirmed: startPreview never reads get_field_mapping. CopyPreviewModal/Page fetch mappingRows locally but never write them to overrideValues. apply_mapping only runs server-side in copy_ticket_v2."
expecting: "overrideValues populated with mapped source field values when preview opens"
next_action: "FIXED — useEffect added to seed overrideValues from identity/priority mapping rows"
reasoning_checkpoint: "Fix is purely frontend. For identity+priority transformers, raw source field values can be fed directly into overrideValues because the field renderers accept the Jira read-shape (e.g. {id, value, self} for options — renderers extract .value or .name). User/version/component remain as gaps (need async resolution)."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29T00:00:00Z
  finding: "copyStore initialState sets overrideValues: {} — never seeded from mappings"
  file: src/features/tickets/copyStore.ts:59-78
  significance: Root cause confirmed — initial state is always empty

- timestamp: 2026-04-29T00:00:00Z
  finding: "startPreview in copyStore loads schema and sets resolvedTargetFields but never reads get_field_mapping or seeds overrideValues"
  file: src/features/tickets/copyStore.ts:83-171
  significance: The only place to centrally prefill, but it doesn't

- timestamp: 2026-04-29T00:00:00Z
  finding: "Both CopyPreviewModal and CopyPreviewPage fetch mappingRows via invoke('get_field_mapping') into local state — but never write them to overrideValues via setOverrideValue"
  file: src/features/tickets/CopyPreviewModal.tsx:143-150, src/features/tickets/CopyPreviewPage.tsx:142-147
  significance: Mapping data is fetched but goes nowhere — dead data

- timestamp: 2026-04-29T00:00:00Z
  finding: "DynamicTargetForm reads values[field.fieldId] which is always undefined for all mapped fields"
  file: src/features/field-renderers/DynamicTargetForm.tsx:51
  significance: Display layer is correct — the problem is upstream in the values object

- timestamp: 2026-04-29T00:00:00Z
  finding: "apply_mapping (Rust) only runs inside copy_ticket_v2 at copy execution time — there is no Tauri command to get pre-mapped field values for UI prefill"
  file: src-tauri/src/commands.rs:1518
  significance: No backend shortcut available — fix must be in the frontend

## Eliminated

- Backend apply_mapping bug: eliminated — the pipeline is not even called during preview
- Schema/field loading bug: eliminated — resolvedTargetFields populates correctly
- DynamicTargetForm rendering: eliminated — correctly reads from values prop

## Resolution

root_cause: "overrideValues in copyStore is initialized as {} and never seeded from field mapping configuration. When the copy modal opens, mappingRows are fetched into local component state but no code path reads sourceTicket.fields[row.sourceFieldId] and calls setOverrideValue(row.targetFieldId, value). The DynamicTargetForm dropdowns are all empty because overrideValues[fieldId] is undefined for every mapped field."

fix: "Added PREFILLABLE_KINDS constant {'identity', 'priority'} and a useEffect to both CopyPreviewModal.tsx and CopyPreviewPage.tsx. The effect runs when mappingRows and sourceTicket are both non-empty, iterates over mapping rows, and calls setOverrideValue(row.targetFieldId, rawSourceValue) for prefillable kinds only — skipping user/version/component (async resolution required) and not overwriting existing user-set values. overrideValues and setOverrideValue are intentionally excluded from deps to prevent infinite render loops."
