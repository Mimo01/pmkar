---
status: root_cause_found
trigger: "In the copy modal prefill, only identity transformer kind works. Priority transformer kind does not prefill the dropdown."
created: 2026-04-29
updated: 2026-04-29
---

# Debug Session: priority-prefill-not-working

## Symptoms

- expected: When a priority→priority field mapping is configured, opening the copy modal should pre-select the priority dropdown with the source ticket's priority value
- actual: Priority dropdown remains empty — identity mappings prefill correctly but priority does not
- scope: Only priority transformer kind affected; identity works
- timeline: Since the copy modal prefill useEffect was added (ae1b047)
- reproduction: Configure a priority field mapping in settings, open copy modal for a story with a priority set, observe priority dropdown is empty

## Context

Recent fix (ae1b047) added a useEffect to CopyPreviewModal.tsx and CopyPreviewPage.tsx:
- PREFILLABLE_KINDS = new Set(['identity', 'priority'])
- Seeds overrideValues from sourceTicket.fields[row.sourceFieldId] for matching transformer kinds
- Identity works, priority does not

Two leading hypotheses to investigate:
1. The transformerKind stored in the DB for priority rows is NOT literally 'priority' — maybe it's a different string, so the PREFILLABLE_KINDS.has() check fails
2. The raw priority field value shape from sourceTicket.fields doesn't match what the priority field renderer expects to render in the dropdown (e.g. renderer expects just an ID string but raw value is {id, name, iconUrl, self})

## Current Focus

hypothesis: "TWO compounding bugs. (1) The registry routes type:'priority' to UnsupportedTypeRenderer, so the priority field never renders a selectable dropdown regardless of overrideValues. (2) isEditableSchemaType() returns false for type:'priority', so the field shows as unsupported. The prefill useEffect does set overrideValues correctly (transformerKind 'priority' is in PREFILLABLE_KINDS and the raw value {id,name} is set), but the value is never displayed because the renderer is wrong."
test: ""
expecting: ""
next_action: "Fix: (A) Create PriorityRenderer.tsx that renders a VirtualizedCombobox over field.allowedValues using {id,name} objects — same shape as SingleSelectRenderer but for priority schema. (B) Add 'priority' case to getRenderer() in registry.ts returning PriorityRenderer. (C) Add 'priority' case to isEditableSchemaType() returning true. The prefill value written by the useEffect is already correct — the raw source value {id,name} is exactly the shape allowedValues entries use, so match-by-id in PriorityRenderer will work."
reasoning_checkpoint: "Hypothesis 1 eliminated: transformer_kind 'priority' IS stored correctly in DB (confirmed in field_mapping_db.rs tests and seed data). Hypothesis 2 is the real issue but goes deeper than shape mismatch — there is NO PriorityRenderer at all. The registry falls through type:'priority' to UnsupportedTypeRenderer (registry.ts line 94-97). isEditableSchemaType() also returns false for priority. So the prefill useEffect writes overrideValues[targetFieldId] = {id:'2',name:'High'} correctly, but the DynamicTargetForm renders it as an unsupported hint (greyed out) rather than a selectable dropdown."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29T00:00:00Z
  finding: "transformer_kind 'priority' is stored correctly in DB — field_mapping_db.rs seed at line 159-161 and test at line 717 confirms transformer_kind='priority'"
  file: src-tauri/src/field_mapping_db.rs
  lines: "159-161, 717"
  eliminated: hypothesis-1

- timestamp: 2026-04-29T00:00:00Z
  finding: "registry.ts getRenderer() routes type:'priority' to UnsupportedTypeRenderer (lines 94-97). No PriorityRenderer exists. The renderers/ directory lists 17 renderers, none named PriorityRenderer."
  file: src/features/field-renderers/registry.ts
  lines: "94-97"

- timestamp: 2026-04-29T00:00:00Z
  finding: "isEditableSchemaType() returns false for type:'priority' (falls through to default:false). This causes DynamicTargetForm to render UnsupportedFieldHint instead of any interactive control."
  file: src/features/field-renderers/registry.ts
  lines: "106-130"

- timestamp: 2026-04-29T00:00:00Z
  finding: "priority allowedValues shape in fixtures: [{id:'1',name:'Highest'},{id:'2',name:'High'},...]. Source ticket priority shape: {name:'High',id:'2'}. These are compatible — a PriorityRenderer can match by id."
  file: src-tauri/src/fixtures.rs
  lines: "1637-1643"

- timestamp: 2026-04-29T00:00:00Z
  finding: "PREFILLABLE_KINDS includes 'priority' and the prefill useEffect correctly writes overrideValues[targetFieldId]={id:'2',name:'High'} from sourceTicket.fields.priority. The bug is purely in the renderer layer."
  file: src/features/tickets/CopyPreviewModal.tsx
  lines: "109, 165-178"

## Eliminated

- hypothesis-1: transformer_kind string mismatch — DB stores 'priority' correctly, PREFILLABLE_KINDS includes 'priority', check passes fine

## Resolution

root_cause: "No PriorityRenderer exists. registry.ts routes type:'priority' to UnsupportedTypeRenderer, and isEditableSchemaType() returns false for priority. The prefill useEffect correctly writes the value to overrideValues but the field is rendered as an unsupported hint (not a combobox), so the user sees nothing."

fix: "Create PriorityRenderer.tsx (VirtualizedCombobox over field.allowedValues, matching {id,name} items). Add 'priority' case to getRenderer() → PriorityRenderer. Add 'priority' to isEditableSchemaType() → true. No changes needed to the prefill useEffect — it already writes the correct value shape."
