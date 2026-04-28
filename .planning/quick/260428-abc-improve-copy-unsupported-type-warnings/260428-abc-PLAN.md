---
quick_id: 260428-abc
slug: improve-copy-unsupported-type-warnings
date: 2026-04-28
status: complete
---

# Quick Task 260428-abc: Improve copy unsupported type warnings

## Goal
Replace confusing "Nepodporovaný typ: priority" / "Nepodporovaný typ: option-with-child" badges in the copy gaps section with clear, actionable messages.

## Tasks

### Task 1: Add isEditableSchemaType helper to renderer registry
- File: `src/features/field-renderers/registry.ts`
- Action: Export `isEditableSchemaType(schema)` that returns false for types with no manual input
- Done: Returns false for priority, option-with-child, issuetype, any

### Task 2: Update GapsSection to show friendly hint for unsupported types
- File: `src/features/tickets/GapsSection.tsx`
- Action: In GapRow, use isEditableSchemaType to branch on editable vs unsupported
- Done: Unsupported rows show amber info message + outline Map field button

### Task 3: Add translation keys
- Files: `src/i18n/locales/en.json`, `src/i18n/locales/sk.json`
- Action: Add `copy.preview.unsupportedGapHint` in EN and SK
- Done

### Task 4: Add tests for unsupported gap rows
- File: `src/features/tickets/__tests__/GapsSection.test.tsx`
- Action: Update registry mock to include isEditableSchemaType, add 3 new test cases
- Done: 12/12 tests pass
