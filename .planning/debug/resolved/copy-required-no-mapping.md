---
slug: copy-required-no-mapping
status: resolved
trigger: "When I am copying a story and field is required but doesn't have a mapping, it should still allow me to fill in the value and allow the copy"
created: 2026-04-29
updated: 2026-04-29
---

# Debug Session: copy-required-no-mapping

## Symptoms

- expected: When copying a story to a target where a required target field has NO mapping configured, the copy screen should still let the user manually enter a value for that field and proceed with the copy.
- actual: Copy was blocked. The user could type into the gap-row input (GapsSection wrote to `overrideValues`), but the Copy button stayed disabled because gating only checked `gapFields.length > 0` and ignored whether the user had supplied values.
- scope: Copy story flow — both `CopyPreviewPage` and `CopyPreviewModal`.
- error_messages: tooltip on disabled Copy button: `Fill in required fields: {names}`
- timeline: Phase 22 (gap-fields work).
- reproduction: Open copy screen for a story, target a project/issue type where some required field is not covered by a mapping. The field appears in GapsSection. Type a value. The Copy button stays disabled.

## Current Focus

hypothesis: "`CopyPreviewPage.tsx:240` defines `isGated = gapFields.length > 0` — gating ignores `overrideValues`. Even after the user fills a gap field, the gate stays closed because it only checks list length. Same bug at `CopyPreviewModal.tsx:222`."
test: "Repro confirmed by code inspection. Submit path (`copyStore.confirmCopy`) already forwards `overrideValues` to `copy_ticket_v2`, so backend wiring is fine — gating is the only blocker."
expecting: "Treat a gap as 'still missing' only when its override value is empty/undefined."
next_action: "(complete)"
reasoning_checkpoint: ""
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29 / file: src/features/tickets/CopyPreviewPage.tsx:240
  observation: |
    ```ts
    const isGated = gapFields.length > 0;
    const isCopyDisabled = isCopying || isLoading || isProjectMissing || isGated;
    ```
    Gate ignored overrideValues entirely.

- timestamp: 2026-04-29 / file: src/features/tickets/CopyPreviewModal.tsx:222
  observation: Same broken gating duplicated in modal variant.

- timestamp: 2026-04-29 / file: src/features/tickets/GapsSection.tsx:104
  observation: GapsSection routes input into `overrideValues[fieldId]` via onOverrideChange — values were stored, just not consulted.

- timestamp: 2026-04-29 / file: src/features/tickets/copyStore.ts:239
  observation: confirmCopy forwards `overrideValues` to `copy_ticket_v2` (`overrideValues: { summary, ...state.overrideValues }`). Backend wiring already correct.

- timestamp: 2026-04-29 / file: src/features/tickets/__tests__/CopyPreviewPage.test.tsx:240
  observation: Existing test asserted the broken behavior; updated + extended.

## Eliminated

- Backend / `copy_ticket_v2` wiring — overrideValues already round-trip correctly.
- `computeGapFields` itself — correctly identifies required-without-mapping fields.
- Sibling debug session `copy-mandatory-field-warning` (SQLite UNIQUE INDEX) — unrelated.

## Resolution

root_cause: "The Copy button's gating in `CopyPreviewPage` and `CopyPreviewModal` was a length check (`gapFields.length > 0`) and never inspected `overrideValues`. Required-without-mapping fields appear in `gapFields` and stay there for the lifetime of the preview, so even after the user typed values into the GapsSection inputs, the gate kept the button disabled — making the copy impossible whenever a required field had no mapping."
fix: |
  - Added a small predicate `isOverrideValueFilled(value, schema)` (`src/features/tickets/isOverrideValueFilled.ts`) that treats undefined/null, empty/whitespace strings, empty arrays, and empty objects as 'unfilled'.
  - In both `CopyPreviewPage.tsx` and `CopyPreviewModal.tsx`, derived `unfilledGapFields = gapFields.filter(g => !isOverrideValueFilled(overrideValues[g.fieldId], g.schema))` and switched `isGated = unfilledGapFields.length > 0`.
  - Tooltip on disabled Copy button now lists only the truly-unfilled fields.
verification: |
  - cargo test: all 200+ tests pass.
  - vitest: 764 passed (was 757 on main); the 9 remaining failures are pre-existing in CopyPreviewModal.test.tsx and SettingsPage.test.tsx and unrelated to this change.
  - tsc --noEmit: clean.
  - New unit test `isOverrideValueFilled.test.ts` (12 cases) covers edge cases.
  - Updated `CopyPreviewPage.test.tsx`: renamed prior test, added 'enabled once a gap field has been filled in via override' and 'stays disabled when override value is whitespace-only'.
files_changed:
  - src/features/tickets/isOverrideValueFilled.ts (new)
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/CopyPreviewModal.tsx
  - src/features/tickets/__tests__/isOverrideValueFilled.test.ts (new)
  - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
