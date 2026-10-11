---
phase: 27-add-static-value-mapping-to-configurable-field-mapping
plan: "03"
subsystem: field-mapping/i18n
tags: [typescript, i18n, types, wave-2, static-mapping, field-mapping]

requires:
  - phase: 27-add-static-value-mapping-to-configurable-field-mapping
    plan: "01"
    provides: Wave 0 React tests that reference staticValue field and deleteStaticAriaLabel i18n key

provides:
  - "FieldMappingRow.staticValue?: string optional field in TypeScript types"
  - "TransformerKind union extended with 'static' literal"
  - "11 new i18n keys in en.json and sk.json (9 fieldMapping.static* + 2 transformer.static.*)"
  - "Translation parity test passing with expanded key set"

affects:
  - 27-04 (UI components import FieldMappingRow.staticValue, TransformerKind 'static', and all 11 i18n keys)

tech-stack:
  added: []
  patterns:
    - "Optional field pattern: staticValue?: string mirrors Rust Option<String> + #[serde(default)]"
    - "Union extension: | 'static' added as last member; getTransformerOptions unchanged"
    - "Flat dotted-key i18n JSON: new keys appended after last existing block entry"

key-files:
  created: []
  modified:
    - src/features/field-mapping/types.ts
    - src/features/field-mapping/transformerOptions.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json

key-decisions:
  - "staticValue?: string placed after targetSchema as final optional field; JSDoc comment documents JSON-encoding semantics for option fields (pre-serialized write-shape)"
  - "| 'static' is the last union member in TransformerKind; getTransformerOptions not modified — static rows use StaticValueWidget not the transformer combobox"
  - "9 fieldMapping.static* keys appended after last fieldMapping.noIssueTypes entry; 2 transformer.static.* keys appended after transformer.userName.* block"

metrics:
  duration: ~2min
  completed: 2026-05-20
---

# Phase 27 Plan 03: TypeScript Types and i18n Foundation Summary

**FieldMappingRow extended with optional staticValue field, TransformerKind union extended with 'static', and all 11 new copy keys added to both en.json and sk.json with proper Slovak diacritics.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-20T12:31:07Z
- **Completed:** 2026-05-20T12:33:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended `FieldMappingRow` TypeScript interface with `staticValue?: string` as the final optional field, with docstring explaining JSON-encoding semantics for option-type fields
- Extended `TransformerKind` union with `| 'static'` as the last member; `getTransformerOptions` function body left unchanged per plan spec
- Added 9 `settings.fieldMapping.static*` keys immediately after the last existing `fieldMapping` entry in both locale files
- Added 2 `settings.transformer.static.*` keys near the existing transformer block in both locale files
- All Slovak translations use proper diacritics (ľ, ý, é, á, č, ž, ť, ú, ô, etc.)
- JSON valid in both files; translations parity test passes 5/5

## Task Commits

1. **Task 1: Extend TypeScript types** - `a12945f` (feat)
2. **Task 2: Add 11 i18n keys to EN + SK** - `ec2ba9d` (feat)

## Files Created/Modified

- `src/features/field-mapping/types.ts` — Added `staticValue?: string` with docstring as final field of `FieldMappingRow`
- `src/features/field-mapping/transformerOptions.ts` — Added `| 'static'` as last member of `TransformerKind` union; `getTransformerOptions` unchanged
- `src/i18n/locales/en.json` — Added 11 new keys (9 fieldMapping.static* + 2 transformer.static.*)
- `src/i18n/locales/sk.json` — Added same 11 keys with proper Slovak translations

## Verification Results

- `npx tsc --noEmit`: Pre-existing Wave 0 errors (StaticMappingRow, StaticValueWidget not yet created — Plan 04 scope); no new type errors introduced by this plan's changes
- `npx vitest run src/i18n/__tests__/translations.test.ts`: 5/5 PASS
- JSON validity: both files parse cleanly (node -e "JSON.parse(...)") — PASS
- Key counts: en.json 465 keys, sk.json 465 keys (11 new each, parity maintained)

## Deviations from Plan

None — plan executed exactly as written. The pre-existing tsc errors from Wave 0 test stubs (StaticMappingRow.test.tsx, StaticValueWidget.test.tsx importing Plan 04 components not yet created) are documented as expected behavior from Plan 01 scaffolding.

## Known Stubs

None — this plan adds only type definitions and translation strings. No UI is rendered, no data is wired. Plan 04 will wire all 11 i18n keys into actual component rendering.

## Threat Flags

None — i18n strings are static build-time copy, no PII or secrets. The `staticValue?: string` type extension is purely structural with no runtime security surface.

## Self-Check

- [x] `src/features/field-mapping/types.ts` exists and contains `staticValue?: string`
- [x] `src/features/field-mapping/transformerOptions.ts` contains `| 'static'`
- [x] `src/i18n/locales/en.json` contains `settings.fieldMapping.addStaticRow`
- [x] `src/i18n/locales/sk.json` contains `settings.fieldMapping.addStaticRow`
- [x] Commits `a12945f` and `ec2ba9d` exist in git log

## Self-Check: PASSED
