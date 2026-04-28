---
quick_id: 260428-abc
status: complete
commit: 4f1bf65
date: 2026-04-28
---

# Summary: Improve copy unsupported type warnings

## What changed

**Problem:** When copying with clean mapping rules, required fields with types like `priority` or `option-with-child` showed a cryptic badge: "Nepodporovaný typ: priority". Users didn't know if this was an error or what action to take.

**Fix:** In the GapsSection (copy preview), unsupported field types now show a friendly amber message:
> "Can't fill this field type here — use 'Map field' to copy it automatically."

The "Map field" button is also rendered with `variant="outline"` instead of `ghost` for unsupported rows, making it more visually prominent as the action to take.

## Files changed

| File | Change |
|------|--------|
| `src/features/field-renderers/registry.ts` | Added `isEditableSchemaType()` export |
| `src/features/tickets/GapsSection.tsx` | GapRow branches on editable vs unsupported |
| `src/i18n/locales/en.json` | Added `copy.preview.unsupportedGapHint` |
| `src/i18n/locales/sk.json` | Added Slovak translation |
| `src/features/tickets/__tests__/GapsSection.test.tsx` | 3 new tests, updated mock |

## Tests
12/12 GapsSection tests pass. 86/86 field-renderer tests pass.
