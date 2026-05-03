---
phase: 17-field-discovery-mock-schema-fidelity
plan: "03"
subsystem: typescript
tags: [typescript, zustand, field-schema, frontend, discriminated-union, vitest, tdd]

# Dependency graph
requires: []
provides:
  - "src/types/fieldSchema.ts: FieldSchemaType (11-variant discriminated union), FieldSchema, FieldSide, IssueTypeRef, CreatemetaResponse types + isOptionField/isCascadingField/isArrayField/isUserField/isPriorityField/isCustomField/isUnsupportedField narrowing helpers + parseFieldSchemas() runtime parser"
  - "src/stores/schemaCacheStore.ts: Zustand hook useSchemaCacheStore with loadSchema/preWarm/refresh/clearCache actions + schemaCacheKey() helper keyed by (side, projectKey, issuetypeId)"
affects:
  - 17-05-probe-banner-status-pill-wiring
  - phase-18-translation-pipeline
  - phase-19-mapping-db
  - phase-20-renderer-registry
  - phase-21-mapping-editor
  - phase-22-copy-preview

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union TypeScript type mirroring Rust serde #[serde(tag)] enum (no codegen)"
    - "parseFieldSchemas() coerces unknown schema.type to {type:'any'} — mirrors Rust #[serde(other)] Any"
    - "schemaCacheKey() uses __null__ sentinel to distinguish null from literal 'null' string"
    - "Zustand store non-fatal catch: never throws, sets error state on cache entry"
    - "TDD Red-Green cycle: test files committed first, then source files"

key-files:
  created:
    - src/types/fieldSchema.ts
    - src/types/fieldSchema.test.ts
    - src/stores/schemaCacheStore.ts
    - src/stores/schemaCacheStore.test.ts
  modified: []

key-decisions:
  - "BUG_PAGE_1 typed as unknown[] (not unknown) to allow array indexing in vitest tests — unknown[] preserves type safety while permitting indexing"
  - "schemaCacheKey uses __null__ sentinel string to distinguish null projectKey/issuetypeId from user-supplied 'null' string — cache collision prevention"
  - "loadSchema passes issuetypeId (not issueTypeId) as argument name to match Tauri command parameter naming convention"

patterns-established:
  - "Pattern: FieldSchemaType discriminated union — 11 variants covering all Rust serde serializations; future TypeScript consumers use switch(schema.type) for exhaustive matching"
  - "Pattern: schemaCacheKey format is 'side|projectKey|issuetypeId' with __null__ sentinels"

requirements-completed: [DISC-01, DISC-02]

# Metrics
duration: 3min
completed: 2026-04-27
---

# Phase 17 Plan 03: TypeScript FieldSchema Types and schemaCacheStore Summary

**TypeScript discriminated union mirroring Rust FieldSchemaType (11 variants) with Zustand cache store using (side, projectKey, issuetypeId) keyed cache entries and sentinel-safe null handling**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-27T14:37:37Z
- **Completed:** 2026-04-27T14:40:40Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created `src/types/fieldSchema.ts` with a 11-variant discriminated union `FieldSchemaType` exactly mirroring Rust serde output (`#[serde(tag = "type", rename_all = "kebab-case")]`), covering string, number, date, datetime, user, array, option, option-with-child, issuetype, priority, and any (catch-all)
- Created `src/stores/schemaCacheStore.ts` Zustand store with per-(side, projectKey, issuetypeId) cache map, four actions (loadSchema, preWarm, refresh, clearCache), and exported schemaCacheKey helper
- All 16 vitest tests pass, `npx tsc --noEmit` exits 0, no regressions in 559-test full suite

## Task Commits

1. **Task 1: Wave 0 — write failing vitest tests** - `d44ca72` (test)
2. **Task 2: Create src/types/fieldSchema.ts** - `33bfea3` (feat)
3. **Task 3: Create src/stores/schemaCacheStore.ts** - `6f84e17` (feat)

## Files Created/Modified

- `src/types/fieldSchema.ts` — FieldSchemaType, FieldSchema, FieldSide, IssueTypeRef, CreatemetaResponse types; narrowing helpers isOptionField, isCascadingField, isArrayField, isUserField, isPriorityField, isCustomField, isUnsupportedField; parseFieldSchemas() runtime parser
- `src/types/fieldSchema.test.ts` — 10 vitest tests covering parseFieldSchemas, isCustomField, isOptionField, isCascadingField, isArrayField, isUnsupportedField with Bug createmeta fixture and unknown type coercion
- `src/stores/schemaCacheStore.ts` — Zustand store with cache keyed by schemaCacheKey, loadSchema (target/source routing), preWarm, refresh, clearCache actions
- `src/stores/schemaCacheStore.test.ts` — 6 vitest store tests covering target/source dispatch, error state, cache key collision safety, preWarm IssueTypeRef storage, refresh entry deletion

## Decisions Made

- `BUG_PAGE_1` fixture typed as `unknown[]` rather than `unknown` — allows TypeScript array indexing while preserving "unverified JSON" semantics for the parser input
- `schemaCacheKey` uses `__null__` as sentinel (not `"null"`) so cache key `target|__null__|10001` never collides with a user project named `"null"`
- `loadSchema` parameter name `issuetypeId` (not `issueTypeId`) matches the Tauri command parameter convention used in Plan 04

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript array index on `unknown` type in test file**
- **Found during:** Task 2 (verifying `npx tsc --noEmit` after implementing fieldSchema.ts)
- **Issue:** `BUG_PAGE_1: unknown = [...]` caused TS18046 errors when the test accessed `BUG_PAGE_1[2]` — TypeScript does not allow indexing `unknown`
- **Fix:** Changed type annotation to `BUG_PAGE_1: unknown[]` — preserves intent (each element is of unknown shape) while permitting array access
- **Files modified:** `src/types/fieldSchema.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0; all 10 tests still pass
- **Committed in:** `33bfea3` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Minimal — single type annotation correction. Test semantics and behavior unchanged.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TypeScript type contracts (`src/types/fieldSchema.ts`) are ready for Plan 17-05 (probe banner) to import `FieldSide`
- `useSchemaCacheStore` is ready for Plan 17-05 to call `loadSchema`/`preWarm` after Tauri commands are registered by Plan 17-04
- Phases 20–22 can import these types directly when building the mapping editor, renderer registry, and copy preview

---
*Phase: 17-field-discovery-mock-schema-fidelity*
*Completed: 2026-04-27*
