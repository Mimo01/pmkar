---
quick_id: 260428-abc
status: complete
commit: 7959d56
date: 2026-04-28
---

# Summary: Improve copy unsupported type warnings

## Problem

When copying with clean mapping rules, fields with types like `priority` or
`option-with-child` showed a cryptic badge: "Nepodporovaný typ: priority".
Users had no idea if this was an error or what to do about it.

## What was built

A shared `UnsupportedFieldHint` component that replaces the badge everywhere
an unsupported field type appears in the copy flow. Renders an amber info box
(same `amber-500/{opacity}` tokens as `DriftWarning` and `GapsSection`) with
an `Info` icon, an explanatory message, and a **Map field →** link.

The fix covers both surfaces:
- **GapsSection** — required fields with no mapping (field can't be filled, needs mapping)
- **DynamicTargetForm** — mapped/optional fields (field is handled by copy process)

Both now look identical. `DynamicTargetForm` gained an `onMapLink` prop so
`CopyPreviewModal` and `CopyPreviewPage` can thread the handler through.

## Files changed

| File | Change |
|------|--------|
| `src/features/field-renderers/UnsupportedFieldHint.tsx` | New shared component |
| `src/features/field-renderers/registry.ts` | Added `isEditableSchemaType()` |
| `src/features/field-renderers/DynamicTargetForm.tsx` | Uses shared component + `onMapLink` prop |
| `src/features/tickets/GapsSection.tsx` | Uses shared component |
| `src/features/tickets/CopyPreviewModal.tsx` | Passes `onMapLink` to DynamicTargetForm |
| `src/features/tickets/CopyPreviewPage.tsx` | Passes `onMapLink` to DynamicTargetForm |
| `src/i18n/locales/en.json` | Single unified key `copy.preview.unsupportedFieldHint` |
| `src/i18n/locales/sk.json` | Slovak translation |
| `src/features/tickets/__tests__/GapsSection.test.tsx` | 3 new tests, updated mock |
| `src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx` | Updated CTRL-07 test |

## Tests
18/18 across GapsSection and DynamicTargetForm test suites.
