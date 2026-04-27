---
phase: 20-renderer-registry-field-type-aware-controls
plan: 01
subsystem: ui
tags: [react-19, vitest, cmdk, tanstack-virtual, scaffold, field-renderers, typescript]

# Dependency graph
requires:
  - phase: 17-field-discovery-mock-schema-fidelity
    provides: FieldSchema/FieldSchemaType types that RendererProps.field is typed against
  - phase: 16-enhanced-watch-configuration
    provides: JiraUser interface that SearchCallbacks.onSearchUsers and RendererProps.onSearch return

provides:
  - cmdk@1.1.1 and @tanstack/react-virtual@3.13.24 installed in package.json
  - src/features/field-renderers/types.ts with RendererProps, SearchCallbacks, JiraComponent, JiraVersion
  - 13 it.todo test stub files under src/features/field-renderers/__tests__/ tagged by CTRL-01..08

affects:
  - 20-02: VirtualizedCombobox implementation consumes types.ts RendererProps
  - 20-03: StringRenderer/TextAreaRenderer/UrlRenderer implement RendererProps
  - 20-04: UserPicker/MultiUserPicker/GroupPicker/SelectRenderers implement RendererProps
  - 20-05: registry.ts + DynamicTargetForm implement RendererProps and SearchCallbacks
  - 21-mapping-editor: imports getRenderer for field-type preview per mapping row
  - 22-copy-preview-override: imports DynamicTargetForm, wires SearchCallbacks with real Tauri invokes

# Tech tracking
tech-stack:
  added:
    - cmdk@1.1.1 (combobox primitive, React 19 peer-compatible)
    - "@tanstack/react-virtual@3.13.24 (virtual list, useFlushSync: false for React 19)"
  patterns:
    - RendererProps unified interface (one prop bag, optional fields cover all renderer types)
    - SearchCallbacks prop bag (async callbacks injected by Phase 22, never called directly in renderers)
    - it.todo scaffold pattern (Wave 0 stubs tagged by requirement ID, replaced in Waves 1-3)

key-files:
  created:
    - src/features/field-renderers/types.ts
    - src/features/field-renderers/__tests__/registry.test.ts
    - src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx
    - src/features/field-renderers/__tests__/StringRenderer.test.tsx
    - src/features/field-renderers/__tests__/TextAreaRenderer.test.tsx
    - src/features/field-renderers/__tests__/UrlRenderer.test.tsx
    - src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx
    - src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx
    - src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx
    - src/features/field-renderers/__tests__/MultiSelectRenderer.test.tsx
    - src/features/field-renderers/__tests__/LabelsRenderer.test.tsx
    - src/features/field-renderers/__tests__/CheckboxRenderer.test.tsx
    - src/features/field-renderers/__tests__/RadioRenderer.test.tsx
    - src/features/field-renderers/__tests__/UnsupportedTypeRenderer.test.tsx
    - src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx
  modified:
    - package.json (added cmdk + @tanstack/react-virtual to dependencies)
    - package-lock.json (lockfile updated)

key-decisions:
  - "RendererProps uses import type for FieldSchema and JiraUser — no runtime import cost, types-only"
  - "SearchCallbacks interface placed in types.ts alongside RendererProps per CONTEXT.md D-05 (Claude's discretion)"
  - "JiraComponent and JiraVersion interfaces defined in types.ts as companion types for picker renderers"
  - "Pre-existing TS error in connectionStore.probe.test.ts (TS6133 unused afterEach) is out-of-scope — not caused by this plan"

patterns-established:
  - "Test stub pattern: import { describe, it } from 'vitest'; describe block + it.todo with CTRL-XX prefix"
  - "RendererProps unified interface: single optional field bag rather than per-renderer prop types"
  - "Named exports only — no export default in field-renderers/* files"

requirements-completed: [CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, CTRL-06, CTRL-07, CTRL-08]

# Metrics
duration: 3min
completed: 2026-04-28
---

# Phase 20 Plan 01: Renderer Registry Wave 0 Scaffold Summary

**cmdk@1.1.1 + @tanstack/react-virtual@3.13.24 installed; RendererProps/SearchCallbacks/JiraComponent/JiraVersion type contracts defined; 74 it.todo stubs across 13 test files cover all CTRL-01..08 requirements**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-27T22:41:47Z
- **Completed:** 2026-04-28T00:45:00Z
- **Tasks:** 2
- **Files modified:** 17 (2 package files + 1 types.ts + 14 test stubs)

## Accomplishments

- Installed cmdk@1.1.1 and @tanstack/react-virtual@3.13.24 with `--legacy-peer-deps` (required for i18next peerOptional TS conflict per Phase 10 decision)
- Created `src/features/field-renderers/types.ts` exporting exactly 4 interfaces: `RendererProps`, `SearchCallbacks`, `JiraComponent`, `JiraVersion` — shapes locked per CONTEXT.md D-01/D-03/D-04/D-05
- Created 13 test stub files (+ 1 registry stub = 14 total) with 74 `it.todo` entries, each tagged by requirement ID (CTRL-01..08), all reporting as pending with 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Install cmdk + @tanstack/react-virtual; create types.ts contract file** - `2506f1a` (feat)
2. **Task 2: Create 13 test stub files with it.todo entries tagged by requirement ID** - `22de60e` (test)

## Files Created/Modified

- `package.json` - Added cmdk@^1.1.1 and @tanstack/react-virtual@^3.13.24 to dependencies
- `package-lock.json` - Lockfile updated with 233 new package entries
- `src/features/field-renderers/types.ts` - 4 exported interfaces: RendererProps, SearchCallbacks, JiraComponent, JiraVersion
- `src/features/field-renderers/__tests__/registry.test.ts` - 19 it.todo entries covering all getRenderer discriminants (CTRL-01..07)
- `src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx` - 7 it.todo entries (CTRL-08)
- `src/features/field-renderers/__tests__/StringRenderer.test.tsx` - 4 it.todo entries (CTRL-01)
- `src/features/field-renderers/__tests__/TextAreaRenderer.test.tsx` - 3 it.todo entries (CTRL-01)
- `src/features/field-renderers/__tests__/UrlRenderer.test.tsx` - 3 it.todo entries (CTRL-01)
- `src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx` - 5 it.todo entries (CTRL-02)
- `src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx` - 4 it.todo entries (CTRL-02)
- `src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx` - 3 it.todo entries (CTRL-03)
- `src/features/field-renderers/__tests__/MultiSelectRenderer.test.tsx` - 3 it.todo entries (CTRL-03)
- `src/features/field-renderers/__tests__/LabelsRenderer.test.tsx` - 3 it.todo entries (CTRL-03)
- `src/features/field-renderers/__tests__/CheckboxRenderer.test.tsx` - 5 it.todo entries (CTRL-06)
- `src/features/field-renderers/__tests__/RadioRenderer.test.tsx` - 4 it.todo entries (CTRL-06)
- `src/features/field-renderers/__tests__/UnsupportedTypeRenderer.test.tsx` - 5 it.todo entries (CTRL-07)
- `src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx` - 6 it.todo entries (CTRL-01..08 integration)

## Exact Installed Versions

- `cmdk`: 1.1.1 (React 19 peer-compatible combobox primitive)
- `@tanstack/react-virtual`: 3.13.24 (virtual list with `useFlushSync: false` for React 19)

## Final types.ts Shape

```typescript
// RendererProps — unified prop bag for every renderer (D-04)
export interface RendererProps {
  field: FieldSchema;           // from @/types/fieldSchema
  value: unknown;
  onChange: (v: unknown) => void;
  required?: boolean;
  disabled?: boolean;
  onSearch?: (q: string) => Promise<JiraUser[]>;   // D-01: only User pickers consume
  initialQuery?: string;                            // D-03: UserPickerRenderer auto-triggers on mount
}

// SearchCallbacks — async callbacks injected by Phase 22 (D-05)
export interface SearchCallbacks {
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
  onFetchComponents?: () => Promise<JiraComponent[]>;
  onFetchVersions?: () => Promise<JiraVersion[]>;
}

// JiraComponent + JiraVersion — picker domain types
export interface JiraComponent { id?: string; name: string; }
export interface JiraVersion { id?: string; name: string; released?: boolean; archived?: boolean; }
```

## it.todo Count by Requirement ID

| Req ID | Count | Test Files |
|--------|-------|------------|
| CTRL-01 | 19 | registry, StringRenderer, TextAreaRenderer, UrlRenderer, DynamicTargetForm |
| CTRL-02 | 12 | registry, UserPickerRenderer, MultiUserPickerRenderer, DynamicTargetForm |
| CTRL-03 | 12 | registry, SingleSelectRenderer, MultiSelectRenderer, LabelsRenderer, DynamicTargetForm |
| CTRL-04 | 2 | registry |
| CTRL-05 | 3 | registry |
| CTRL-06 | 9 | CheckboxRenderer, RadioRenderer |
| CTRL-07 | 10 | registry, UnsupportedTypeRenderer |
| CTRL-08 | 7 | VirtualizedCombobox |
| **Total** | **74** | 14 files |

## Decisions Made

- `SearchCallbacks` interface placed in `types.ts` alongside `RendererProps` (CONTEXT.md gives Claude discretion; co-locating related types is cleaner than splitting across files)
- `JiraComponent` and `JiraVersion` companion types defined in `types.ts` alongside their consumer interface `SearchCallbacks`
- No `export default` used anywhere in `types.ts` — named exports only (per PATTERNS.md convention)

## Deviations from Plan

None - plan executed exactly as written.

**Notes:**
- Pre-existing TypeScript error `TS6133: 'afterEach' is declared but its value is never read` in `src/features/connections/__tests__/connectionStore.probe.test.ts` was present before this plan and is out of scope per deviation rules (not caused by this plan's changes). Logged to deferred items.

## Issues Encountered

- `npx tsc --noEmit --skipLibCheck` exits with code 2 due to the pre-existing `TS6133` error in `connectionStore.probe.test.ts`. This file was not modified by this plan. The `types.ts` file itself compiles cleanly (confirmed by filtering the pre-existing error from tsc output). The pre-existing error is tracked as a deferred item.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 contracts locked: `RendererProps`, `SearchCallbacks`, `JiraComponent`, `JiraVersion` in `types.ts`
- Plan 02 can now implement `VirtualizedCombobox` against `types.ts` and fill in `VirtualizedCombobox.test.tsx` stubs
- Plans 03-05 implement individual renderers against `RendererProps` and fill in their respective stub files
- Full test suite: 573 passing + 74 pending (stubs) + 0 failing — clean baseline for Wave 1

---
*Phase: 20-renderer-registry-field-type-aware-controls*
*Completed: 2026-04-28*
