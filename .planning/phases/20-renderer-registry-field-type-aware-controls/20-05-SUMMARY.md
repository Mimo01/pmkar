---
phase: 20-renderer-registry-field-type-aware-controls
plan: "05"
subsystem: field-renderers
tags: [react-19, registry, discrimination, i18n, integration, tdd]
dependency_graph:
  requires:
    - "20-01 (RendererProps types.ts, SearchCallbacks)"
    - "20-02 (VirtualizedCombobox)"
    - "20-03 (StringRenderer, TextAreaRenderer, UrlRenderer, DateRenderer, DateTimeRenderer, NumberRenderer, CheckboxRenderer, RadioRenderer, UnsupportedTypeRenderer)"
    - "20-04 (UserPickerRenderer, MultiUserPickerRenderer, GroupPickerRenderer, SingleSelectRenderer, MultiSelectRenderer, LabelsRenderer, ComponentPickerRenderer, VersionPickerRenderer)"
  provides:
    - "getRenderer(schema: FieldSchemaType) discrimination function — src/features/field-renderers/registry.ts"
    - "DynamicTargetForm — stateless shell iterating FieldSchema[] — src/features/field-renderers/DynamicTargetForm.tsx"
    - "fieldRenderer.* i18n keys (7 keys) in en.json + sk.json"
  affects:
    - "Phase 22 (injects searchCallbacks into DynamicTargetForm)"
    - "Phase 21 (imports CheckboxRenderer + RadioRenderer re-exports for mapping editor override)"
tech_stack:
  added: []
  patterns:
    - "Discriminated-union switch dispatch pattern: getRenderer uses TypeScript switch on schema.type with nested switch on schema.items for array types"
    - "schema.custom Set lookup pattern: RADIO_CUSTOM_TYPES + CHECKBOX_CUSTOM_TYPES Sets checked before default routes (CTRL-06)"
    - "D-12 extension contract: one new renderer file + one new switch case, no DynamicTargetForm changes needed"
    - "D-05 user-only routing: isUserPicker boolean derived from field.schema.type in DynamicTargetForm before passing onSearch"
key_files:
  created:
    - src/features/field-renderers/registry.ts
    - src/features/field-renderers/DynamicTargetForm.tsx
    - src/features/field-renderers/__tests__/registry.test.ts
    - src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
key-decisions:
  - "CTRL-06 routing via schema.custom Sets (Option A): no new FieldSchemaType variants; existing option/array-option routes gain a pre-check against RADIO_CUSTOM_TYPES / CHECKBOX_CUSTOM_TYPES sets — adding new Jira custom field IDs requires only a set entry, not a switch case"
  - "D-12 extension contract preserved: DynamicTargetForm never imports renderer names; all dispatch is via getRenderer(); adding a new type = new file + one case"
  - "DynamicTargetForm label uses htmlFor + id pattern with labelId={fieldId}-label for ARIA association"
  - "CheckboxRenderer + RadioRenderer re-exported from registry.ts for Phase 21 mapping editor override use"
  - "Test deviation [Rule 1]: getByRole('textbox') replaced with getByLabelText(/summary/i) — LabelsRenderer also renders a text input so getByRole was ambiguous when both fields rendered together"
requirements-completed: [CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, CTRL-06, CTRL-07, CTRL-08]
duration: ~10min
completed: 2026-04-28
---

# Phase 20 Plan 05: Registry + DynamicTargetForm + i18n Summary

**getRenderer() discrimination function wiring all 17 renderers to FieldSchemaType variants with CTRL-06 schema.custom routing; DynamicTargetForm stateless shell with D-05 user-only onSearchUsers routing; 7 fieldRenderer.* i18n keys in both locales — 30 new passing tests completing the phase 20 test suite at 86 tests, zero pending.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-04-28
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `getRenderer()` dispatch function covers all 11 FieldSchemaType variants + 6 ArrayItemKind values + CTRL-06 schema.custom routing
- `DynamicTargetForm` iterates `fields[]`, calls `getRenderer(field.schema)` per field, routes `onSearchUsers` to user pickers only (D-05)
- 7 `fieldRenderer.*` i18n keys added to both `en.json` and `sk.json` — translations.test.ts parity assertion confirms identical key sets
- 24 registry test assertions covering every dispatch route (19 base + 5 CTRL-06 schema.custom cases)
- 6 DynamicTargetForm integration assertions covering iteration, onChange propagation, required asterisk, D-05 user routing, graceful undefined callbacks, CTRL-07 UnsupportedType routing
- Zero `it.todo` entries remaining in field-renderers test suite
- Full project suite: 659 tests passing across 64 test files — no regressions

## getRenderer Dispatch Table

| Schema | Dispatches To | Notes |
|--------|--------------|-------|
| `{type:'string'}` | StringRenderer | Default string |
| `{type:'string', system:'description'}` | TextAreaRenderer | D-11 system discrimination |
| `{type:'string', system:'url'}` | UrlRenderer | D-11 system discrimination |
| `{type:'number'}` | NumberRenderer | |
| `{type:'date'}` | DateRenderer | |
| `{type:'datetime'}` | DateTimeRenderer | |
| `{type:'user'}` | UserPickerRenderer | |
| `{type:'option'}` | SingleSelectRenderer | Default; falls through from CTRL-06 check |
| `{type:'option', custom:'...:radiobuttons'}` | RadioRenderer | CTRL-06 via RADIO_CUSTOM_TYPES Set |
| `{type:'array', items:'user'}` | MultiUserPickerRenderer | |
| `{type:'array', items:'option'}` | MultiSelectRenderer | Default; falls through from CTRL-06 check |
| `{type:'array', items:'option', custom:'...:multicheckboxes'}` | CheckboxRenderer | CTRL-06 via CHECKBOX_CUSTOM_TYPES Set |
| `{type:'array', items:'component'}` | ComponentPickerRenderer | |
| `{type:'array', items:'version'}` | VersionPickerRenderer | |
| `{type:'array', items:'string'}` | LabelsRenderer | |
| `{type:'array', items:'group'}` | GroupPickerRenderer | |
| `{type:'array', items:<unknown>}` | UnsupportedTypeRenderer | Default branch |
| `{type:'option-with-child'}` | UnsupportedTypeRenderer | CTRL-07 |
| `{type:'issuetype'}` | UnsupportedTypeRenderer | CTRL-07 |
| `{type:'priority'}` | UnsupportedTypeRenderer | CTRL-07 |
| `{type:'any'}` | UnsupportedTypeRenderer | CTRL-07 |

**CTRL-06 Sets (module scope in registry.ts):**
- `RADIO_CUSTOM_TYPES`: `{'com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons'}`
- `CHECKBOX_CUSTOM_TYPES`: `{'com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes'}`

## DynamicTargetForm Prop Interface

```typescript
export interface DynamicTargetFormProps {
  fields: FieldSchema[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, v: unknown) => void;
  searchCallbacks?: SearchCallbacks;
}
```

D-05 routing: `onSearch={isUserPicker ? searchCallbacks?.onSearchUsers : undefined}` — `isUserPicker` is `schema.type === 'user' || (schema.type === 'array' && schema.items === 'user')`.

## i18n Keys Added (Both Locales)

| Key | EN value | SK value |
|-----|----------|----------|
| `fieldRenderer.placeholder.select` | `Select…` | `Vybrať…` |
| `fieldRenderer.placeholder.searchUsers` | `Search users…` | `Hľadať používateľov…` |
| `fieldRenderer.placeholder.searching` | `Searching…` | `Hľadá sa…` |
| `fieldRenderer.noResults` | `No results found.` | `Žiadne výsledky.` |
| `fieldRenderer.unsupportedType` | `Unsupported: {{type}}` | `Nepodporovaný typ: {{type}}` |
| `fieldRenderer.required` | ` *` | ` *` |
| `fieldRenderer.removeItem` | `Remove {{item}}` | `Odstrániť {{item}}` |

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | registry.ts + DynamicTargetForm.tsx + i18n keys | 157c504 | registry.ts, DynamicTargetForm.tsx, en.json, sk.json |
| 2 | Replace registry + DynamicTargetForm it.todo stubs | c021ea1 | registry.test.ts, DynamicTargetForm.test.tsx |

## Test Coverage by Requirement ID

| Requirement | Test File | Test Count | Key Cases |
|-------------|-----------|-----------|-----------|
| CTRL-01 | registry.test.ts | 3 | string/description/url dispatch |
| CTRL-02 | registry.test.ts | 3 | user/multi-user/group dispatch |
| CTRL-03 | registry.test.ts | 4 | option/multi-option/labels dispatch |
| CTRL-04 | registry.test.ts | 2 | component/version dispatch |
| CTRL-05 | registry.test.ts | 3 | number/date/datetime dispatch |
| CTRL-06 | registry.test.ts | 5 | radiobuttons→RadioRenderer, multicheckboxes→CheckboxRenderer, fallback to Single/MultiSelect |
| CTRL-07 | registry.test.ts + DynamicTargetForm.test.tsx | 5+1 | any/issuetype/priority/option-with-child/unknown-items + integration role=status |
| CTRL-08 | VirtualizedCombobox.test.tsx | 10 (pre-existing) | Inherited from Plan 02 |
| D-04/D-05 | DynamicTargetForm.test.tsx | 6 | Iteration, onChange, required asterisk, user-only onSearch routing, graceful undefined |

**Phase 20 field-renderers total: 86 passing tests, 14 test files, 0 pending, 0 todo**

## Verification Results

- `npx tsc --noEmit --skipLibCheck` → 1 pre-existing error in `connectionStore.probe.test.ts` (unrelated to Plan 05 files); Plan 05 files type-check clean
- `npm test -- src/i18n/__tests__/translations.test.ts` → 5/5 passed (key parity, no empty values, SK differs from EN)
- `grep -rh "it.todo" src/features/field-renderers/__tests__/` → 0 (all stubs replaced)
- `npm test -- src/features/field-renderers` → 86/86 passed, 14 test files
- `npm test` (full suite) → 659/659 passed, 64 test files, 0 failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DynamicTargetForm test: `getByRole('textbox')` → `getByLabelText(/summary/i)`**
- **Found during:** Task 2 (DynamicTargetForm test execution)
- **Issue:** The plan's test for "iterates fields and renders one Renderer per field" used `screen.getByRole('textbox')` to find the StringRenderer input. When rendering `[summaryField, labelsField]` together, LabelsRenderer also renders a `<input type="text">` (the free-text entry input with `aria-label="Labels new label"`). This produced two textbox roles, causing a `Found multiple elements with the role "textbox"` failure.
- **Fix:** Changed assertion to `screen.getByLabelText(/summary/i)` which uses the `<label htmlFor="summary">Summary</label>` association in DynamicTargetForm — unambiguous and more semantically correct.
- **Files modified:** `src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx`
- **Commit:** c021ea1

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Zero — same assertion intent (StringRenderer value='Hello' confirmed); only query method changed.

## D-12 Extension Contract Confirmation

Adding a new field type to the registry requires:
1. Create `src/features/field-renderers/renderers/NewTypeRenderer.tsx`
2. Add one `import` and one `case` in `registry.ts`
3. No changes to `DynamicTargetForm.tsx`

This contract is structurally enforced: `DynamicTargetForm` never names a renderer; it only calls `getRenderer(field.schema)`.

## Known Stubs

None. Both `registry.ts` and `DynamicTargetForm.tsx` are fully wired. All 7 i18n keys have real translation values (no empty strings). No placeholder data flows to UI rendering.

## Threat Flags

No new threat surface beyond the plan's threat model. Confirmations:
- T-20-16: `{field.name}` in DynamicTargetForm label rendered as React text child — auto-escaped; no `dangerouslySetInnerHTML` present
- T-20-17: `registry.ts` default branch returns `UnsupportedTypeRenderer`; TypeScript discriminated union; never throws
- T-20-18: `translations.test.ts` parity assertion passes — en.json and sk.json have identical key sets

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `src/features/field-renderers/registry.ts` exists | FOUND |
| `src/features/field-renderers/DynamicTargetForm.tsx` exists | FOUND |
| `src/features/field-renderers/__tests__/registry.test.ts` exists | FOUND |
| `src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx` exists | FOUND |
| Commit 157c504 (Task 1) exists | FOUND |
| Commit c021ea1 (Task 2) exists | FOUND |
| `npm test` full suite passes (659 tests) | PASSED |
| `npm test -- src/i18n/__tests__/translations.test.ts` passes | PASSED |
| `grep -rh "it.todo" src/features/field-renderers/__tests__/` returns 0 | PASSED |

---
*Phase: 20-renderer-registry-field-type-aware-controls*
*Completed: 2026-04-28*
