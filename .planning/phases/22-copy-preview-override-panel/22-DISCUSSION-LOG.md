# Phase 22: Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 22-copy-preview-override-panel
**Areas discussed:** Summary field handling, Issue-type chooser UI, Required-gap surfacing, Override store design

---

## Summary Field Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated input above the form | Summary stays as a standalone labeled text input at the top of the right column. DynamicTargetForm renders everything else below it. | ✓ |
| Flow through DynamicTargetForm | Summary field ID appears in createmeta fields list; rendered by StringRenderer inside DynamicTargetForm. | |

**User's choice:** Dedicated input above the form

**Follow-up — editability:**

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fill from source, always editable | Summary always shows source summary as default, always editable regardless of mapping row transformer. | ✓ |
| Pre-fill from source, read-only if mapping drives it | Input becomes read-only when the mapping has a transformer for summary. | |

**User's choice:** Pre-fill from source, always editable

---

## Issue-Type Chooser UI

| Option | Description | Selected |
|--------|-------------|----------|
| VirtualizedCombobox | Consistent with Phase 20/21 picker pattern — keyboard-navigable, searchable, handles 100+ issue types. | ✓ |
| Native `<select>` | Matches existing project picker in the same modal. Simpler, no search support. | |

**User's choice:** VirtualizedCombobox

**Follow-up — "defaulted" notice:**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline caption below the chooser | Small muted text: "Defaulted — no match for 'Story'" directly under the combobox. | ✓ |
| Amber badge inside the chooser | Amber '!' badge inside the combobox trigger. More visible but takes space. | |
| Toast notification | Brief sonner toast fires on modal open. Non-blocking. | |

**User's choice:** Inline caption below the chooser

**Follow-up — data source:**

| Option | Description | Selected |
|--------|-------------|----------|
| Use prewarmedIssueTypes from schemaCacheStore | No extra Tauri call — already populated from connection probe. Falls back to on-demand invoke if empty. | ✓ |
| Always fetch fresh on modal open | Calls pre_warm_target_issue_types every time the copy preview opens. Fresh but adds round-trip. | |

**User's choice:** Use prewarmedIssueTypes from schemaCacheStore

---

## Required-Gap Surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated "Gaps" section at the top | Highlighted section between summary and DynamicTargetForm, listing only required unmapped fields with fill-in inputs + "Map →" link. | ✓ |
| Inline in DynamicTargetForm | Required-but-unmapped fields appear in createmeta order with warning ring/banner. One consistent rendering path. | |

**User's choice:** Dedicated "Gaps" section at the top

**Follow-up — "Map →" link action:**

| Option | Description | Selected |
|--------|-------------|----------|
| Links to Settings > Field Mapping | Closes modal, navigates to Settings > Field Mapping for permanent mapping. | ✓ |
| Opens mapping editor inline | Popover/drawer over the copy preview for that specific field. More complex. | |
| Just a label, no action | Informational text only, no click handler. | |

**User's choice:** Links to Settings > Field Mapping

**Follow-up — Copy button communication:**

| Option | Description | Selected |
|--------|-------------|----------|
| Tooltip on disabled button | Hovering shows "Fill in required fields: {field1}, {field2}". Unobtrusive complement to the gap section. | ✓ |
| Inline error list below the footer | Missing field names always visible below Cancel/Copy buttons. More prominent. | |
| Nothing extra — gap section makes it obvious | Disabled button state sufficient; gap section already lists what's missing. | |

**User's choice:** Tooltip on disabled button

---

## Override Store Design

| Option | Description | Selected |
|--------|-------------|----------|
| Extend copyStore.ts | Add targetIssueTypeId, overrideValues, resolvedTargetFields to existing store. Single source of truth. | ✓ |
| Separate useCopyOverrideStore | New Zustand store for override state only; copyStore stays focused on lifecycle. | |

**User's choice:** Extend copyStore.ts

**Follow-up — confirmCopy backend call:**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the old copy_ticket call with existing fields | Phase 22 doesn't touch copy_ticket signature. DynamicTargetForm + overrideValues are UI-only; Phase 23 wires copy_ticket_v2 end-to-end. | ✓ |
| Pass overrideValues to copy_ticket as extra payload | Extend copy_ticket to accept an optional overrides map. More invasive in Phase 22. | |

**User's choice:** Keep the old copy_ticket call with existing fields

---

## Claude's Discretion

- Exact column widths and visual styling of the gap section (amber border, badge style)
- Loading spinner placement during issue-type-triggered schema refresh
- Whether resolvedTargetFields are loaded eagerly on modal open or lazily on first interaction
- Order of fields in DynamicTargetForm (follow createmeta order unless required fields appear first)
- i18n key naming for new gap-section strings

## Deferred Ideas

None — discussion stayed within phase scope.
