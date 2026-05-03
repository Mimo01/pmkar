---
quick_id: 260503-pht
slug: full-support-for-any-type-of-properties-in
description: Full support for any type of properties in copy window
date: 2026-05-03
status: complete
commit: 0d6be40
tags: [field-renderers, cascading-select, fallback-renderer, registry, i18n]
key_files:
  created:
    - src/features/field-renderers/renderers/CascadingSelectRenderer.tsx
    - src/features/field-renderers/renderers/AnyFieldFallbackRenderer.tsx
  modified:
    - src/features/field-renderers/registry.ts
    - src/features/field-renderers/__tests__/registry.test.ts
    - src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx
    - src/features/tickets/CopyPreviewPage.tsx
    - src/features/tickets/CopyPreviewModal.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - CascadingSelectRenderer uses onChange: (T) => void (not T | null) to match VirtualizedCombobox API
  - AnyFieldFallbackRenderer delegates to SingleSelectRenderer or StringRenderer — no new UI primitives
  - issuetype and project excluded from dynamicFormFields (pipeline-managed, have dedicated UI above the form)
metrics:
  duration: 12 min
  completed: 2026-05-03
  tasks: 5
  files: 9
---

# Quick Task 260503-pht: Full support for any type of properties in copy window

**One-liner:** Two new renderers (CascadingSelectRenderer, AnyFieldFallbackRenderer) eliminate the UnsupportedFieldHint for option-with-child and any schema types, and issuetype/project are excluded from the editable form.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | CascadingSelectRenderer for option-with-child | Done |
| 2 | AnyFieldFallbackRenderer for any type | Done |
| 3 | Update registry.ts (getRenderer + isEditableSchemaType) | Done |
| 4 | Exclude issuetype and project from dynamicFormFields | Done |
| 5 | Type-check and tests pass | Done |

## Commit

`0d6be40` — feat(field-renderers): add CascadingSelectRenderer and AnyFieldFallbackRenderer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] VirtualizedCombobox onChange signature mismatch**
- **Found during:** Task 1 (implementing CascadingSelectRenderer)
- **Issue:** The plan's code used `handleParentChange(p: CascadeOption | null)` but VirtualizedCombobox.onChange is typed `(selected: T) => void` (non-nullable). Calling with `null` would cause a type error.
- **Fix:** Changed `handleParentChange` and `handleChildChange` to accept `T` (non-nullable), matching the actual VirtualizedCombobox interface.
- **Files modified:** `src/features/field-renderers/renderers/CascadingSelectRenderer.tsx`

**2. [Rule 1 - Bug] Slovak translation contained Cyrillic character**
- **Found during:** Task 1 (adding i18n keys)
- **Issue:** Plan specified `"Vybrať podopcию…"` with a Cyrillic "и" character in an otherwise Slovak word.
- **Fix:** Used correct Slovak `"Vybrať podovoľbu…"` instead.
- **Files modified:** `src/i18n/locales/sk.json`

**3. [Rule 1 - Bug] Test suite had stale expectations for old registry behavior**
- **Found during:** Task 5 (running tests)
- **Issue:** `registry.test.ts` expected `type: 'any'` → `UnsupportedTypeRenderer` and `type: 'option-with-child'` → `UnsupportedTypeRenderer`. `DynamicTargetForm.test.tsx` expected `type: 'any'` to show the unsupported hint (no textbox).
- **Fix:** Updated tests to reflect new routing: `any` → `AnyFieldFallbackRenderer`, `option-with-child` → `CascadingSelectRenderer`. DynamicTargetForm test now asserts a textbox is present (StringRenderer fallback) for `type: 'any'` without allowedValues.
- **Files modified:** `src/features/field-renderers/__tests__/registry.test.ts`, `src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx`

## Pre-existing Failure (Fixed)

`CopyPreviewPage.test.tsx` had two pre-existing failures from commit `a1ed9d3`:
1. `search_jira_users_by_domain` assertion missing `baseUrl` (added in a1ed9d3, test not updated)
2. `schemaCacheStore` mock missing `preWarm` function → 16 unhandled TypeErrors per run

Both fixed in commit `6857ff4` (fix(tests): update CopyPreviewPage mock for baseUrl + preWarm).

## Self-Check: PASSED

- [x] `src/features/field-renderers/renderers/CascadingSelectRenderer.tsx` exists
- [x] `src/features/field-renderers/renderers/AnyFieldFallbackRenderer.tsx` exists
- [x] Commit `0d6be40` exists in git log
- [x] TypeScript type check: clean (no errors)
- [x] Test suite: 797/797 tests passing, 0 errors
