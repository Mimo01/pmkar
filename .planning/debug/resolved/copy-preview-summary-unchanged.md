---
slug: copy-preview-summary-unchanged
status: resolved
trigger: "There seems to be a problem with copying of the ticket. When I have changed the 'Summary' text in the preview, it copied over the unchanged value"
created: 2026-05-06
updated: 2026-05-06
---

## Symptoms

- **Expected behavior:** When copying a ticket via the copy preview dialog, the copy should use the edited Summary text entered in the preview
- **Actual behavior:** The copied ticket uses the original (unchanged) Summary value, ignoring what was typed in the preview dialog
- **Location:** The edit happens in the copy preview dialog (before confirming the copy)
- **Frequency:** Seems to happen every time; unknown whether only Summary is affected or all fields
- **Error messages:** None reported
- **History:** Unknown — not sure if this ever worked
- **Reproduction:** Edit the Summary field in the copy preview dialog, confirm the copy, observe the copy has the original Summary

## Current Focus

hypothesis: The copy operation reads from the original ticket state rather than the edited preview form state
test: ""
expecting: ""
next_action: "resolved"
reasoning_checkpoint: ""

## Evidence

- timestamp: 2026-05-06
  file: src/features/tickets/copyStore.ts
  lines: 242-249
  note: "confirmCopy builds overrideValues with summary: state.targetSummary first, then ...state.overrideValues last — overrideValues spread overwrites user-edited summary"

- timestamp: 2026-05-06
  file: src/features/tickets/CopyPreviewModal.tsx
  lines: 158-170
  note: "D-PREFILL loop seeds overrideValues[summary] from source ticket for identity-transformer rows without excluding summary"

- timestamp: 2026-05-06
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 203-224
  note: "Same D-PREFILL loop, same omission — seeds overrideValues[summary] from source value"

## Eliminated

- The Summary input itself (it correctly calls setTargetSummary on change)
- The store's setTargetSummary action (it correctly sets targetSummary)
- The backend (the problem is entirely in the frontend merge logic)

## Resolution

root_cause: "In confirmCopy, the overrideValues spread appeared after summary: state.targetSummary, so any value in overrideValues['summary'] (seeded by the D-PREFILL effect from the original source ticket) overwrote the user's edited targetSummary. The D-PREFILL effect in both CopyPreviewModal and CopyPreviewPage was also seeding overrideValues['summary'] without excluding it, compounding the issue."
fix: "Three changes: (1) copyStore.ts — moved ...state.overrideValues before summary: state.targetSummary so the explicit bespoke fields always win. (2) CopyPreviewModal.tsx — added PREFILL_EXCLUDED_TARGET_FIELDS set containing 'summary' and guard in the D-PREFILL loop. (3) CopyPreviewPage.tsx — same PREFILL_EXCLUDED_TARGET_FIELDS guard added, with audit log entry for skipped rows."
verification: "tsc --noEmit passes clean. copyStore.test.ts and CopyPreviewModal.test.tsx pass. CopyPreviewPage.test.tsx: 1 pre-existing unrelated failure (searchUsersForPicker baseUrl test), all other tests pass including updated summary audit log assertion."
files_changed:
  - src/features/tickets/copyStore.ts
  - src/features/tickets/CopyPreviewModal.tsx
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
