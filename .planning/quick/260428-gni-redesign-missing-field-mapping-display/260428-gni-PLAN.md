---
quick_id: 260428-gni
slug: redesign-missing-field-mapping-display
date: 2026-04-28
status: complete
---

# Quick Task 260428-gni: Redesign missing field mapping display variants

## Goal
Unify the two visual states for required fields with missing mappings in the copy-story flow — editable and non-editable — so they share a consistent layout and integrate cleanly with the rest of the UI.

## Problem
- **Editable gap row**: `label | field input | [Map field button]`
- **Non-editable gap row**: `label | [heavy amber box with Map link inside]`

The non-editable state had double amber (amber section container + amber hint box inside), plus the "Map field" trigger was buried inside the hint box rather than in the consistent right-side position.

Additionally, `UnsupportedFieldHint` used in `DynamicTargetForm` for mapped-but-unsupported fields also used heavy amber styling that clashed with the neutral form area.

## Tasks

### T1 — Unify GapRow layout (GapsSection.tsx)
- Remove `UnsupportedFieldHint` import and usage from `GapRow`
- Remove the sr-only hidden button workaround
- Both editable and non-editable states now use: `label | content | [Map field button]`
- Non-editable content: clean muted disabled-input placeholder (`border-border/60 bg-muted/40`)
- `gap-map-link-{fieldId}` testid now on the real visible button for both states
- `gap-unsupported-{fieldId}` testid on the muted placeholder div

### T2 — Redesign UnsupportedFieldHint (UnsupportedFieldHint.tsx)
- Remove amber colors (`border-amber-500/40`, `bg-amber-500/10`, `text-amber-700`)
- Replace with neutral muted style (`border-border/60`, `bg-muted/40`, `text-muted-foreground`)
- Looks like a disabled form element — consistent with the rest of the form UI
- Map link button uses muted-foreground with hover state instead of amber

### T3 — Add translation key
- Add `copy.preview.fieldNoManualInput` to `en.json` and `sk.json`
- Used as inline placeholder text in non-editable gap rows
