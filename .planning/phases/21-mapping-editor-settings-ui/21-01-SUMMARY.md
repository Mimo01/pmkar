---
phase: 21
plan: 01
subsystem: field-mapping
tags: [field-mapping, settings, scaffolding, sonner, types, heuristics, toast]
dependency_graph:
  requires: []
  provides:
    - src/components/ui/sonner.tsx
    - src/features/field-mapping/types.ts
    - src/features/field-mapping/transformerOptions.ts
    - src/features/field-mapping/heuristics.ts
    - src/features/field-mapping/__tests__/heuristics.test.ts
    - src/features/field-mapping/__tests__/MappingRow.test.tsx
    - src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx
    - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx
  affects:
    - src/App.tsx (Toaster mount)
    - src/features/connections/SettingsPage.tsx (SectionCard extension)
tech_stack:
  added:
    - sonner@^2.0.7 (toast notifications)
  patterns:
    - shadcn Toaster wrapper (brand-aware CSS class override)
    - it.todo stub test pattern for downstream waves
    - FieldSchemaType discriminant switch for transformer filtering
    - Normalized name + synonym heuristics for field matching
key_files:
  created:
    - src/components/ui/sonner.tsx
    - src/features/field-mapping/types.ts
    - src/features/field-mapping/transformerOptions.ts
    - src/features/field-mapping/heuristics.ts
    - src/features/field-mapping/__tests__/heuristics.test.ts
    - src/features/field-mapping/__tests__/MappingRow.test.tsx
    - src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx
    - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx
  modified:
    - package.json (sonner dependency added)
    - package-lock.json (lock file updated)
    - src/App.tsx (Toaster import + mount in all routing branches)
    - src/features/connections/SettingsPage.tsx (SectionCard extended with headerAction)
decisions:
  - Mounted Toaster in all 5 App.tsx routing branches (only one renders at a time; ensures toast works in every app state)
  - Used native <details> approach was not needed — stub files only; Radix Collapsible decision deferred to Plan 02
  - transformerOptions handles 'any' type by returning all 6 options (Pitfall 3 mitigation for seed rows with null schema)
  - heuristics SYNONYMS uses normalized keys (no separators) matching the normalize() function for consistent lookup
metrics:
  duration: "4 min"
  completed_date: "2026-04-28"
  tasks_completed: 3
  files_created: 8
  files_modified: 4
---

# Phase 21 Plan 01: Wave 0 Scaffolding Summary

**One-liner:** Sonner toast infrastructure + shadcn Toaster wrapper + SectionCard headerAction prop + FieldMappingRow type + transformer-option filtering rules + heuristic name-match logic with 8 unit tests + 26 it.todo stubs for Plans 02 and 03.

## What Was Built

### Task 1: sonner + Toaster + SectionCard extension

**sonner version installed:** `^2.0.7` (resolved to 2.0.7 from npm registry)

**Toaster mount location in App.tsx:** Rendered immediately before `</ErrorBoundary>` in all 5 routing branches (wizard, settings, audit log, detail, main). React renders only one branch at a time so only one Toaster is ever active. The component renders as a portal and does not affect layout.

**SectionCard signature change:**

Before:
```typescript
function SectionCard({ title, children }: { title: string; children: React.ReactNode })
```

After:
```typescript
function SectionCard({
  title,
  children,
  headerAction,
}: {
  title: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
})
```

The `mb-3` spacing moved from the `<h2>` element to a `<div className="flex items-center justify-between mb-3">` wrapper that also holds `{headerAction}`. When `headerAction` is omitted, the wrapper just renders the `<h2>` at the same position with the same spacing.

**All 8 existing SectionCard call sites verified:** All 34 SettingsPage tests pass post-change (source, destination, jql-presets, watched-users, polling, notifications, theme, language, about sections render identically).

### Task 2: TypeScript modules

**FieldMappingRow interface** mirrors `src-tauri/src/field_transform/mod.rs:135` with `serde(rename_all = "camelCase")`:
- `sourceFieldId: string`
- `targetFieldId: string` (empty string = dismissed-suggestion sentinel per D-07)
- `transformerKind: string`
- `sourceSchema: FieldSchemaType`
- `targetSchema: FieldSchemaType`

**getTransformerOptions** handles all 11 FieldSchemaType discriminants including `'any'` (returns all 6 options to handle seed rows with null schema JSON — Pitfall 3 mitigation).

**findNameMatchSuggestion** implements 3-tier matching: exact fieldId > normalized name equality > synonym set. SYNONYMS covers description/priority/assignee/reporter/labels with their common aliases.

**Heuristics test results:** 8 passed, 0 failed — covering null list, exact-id precedence, case-insensitivity, dash/underscore/space normalization, and 3 synonym pairs (severity→priority, tags→labels, desc→description).

### Task 3: Test stub files

| File | Stubs | Requirement IDs |
|------|-------|-----------------|
| MappingRow.test.tsx | 8 | MAP-03, MAP-04, MAP-05 |
| SuggestionsPanel.test.tsx | 7 | EDIT-02, EDIT-03 |
| FieldMappingSection.test.tsx | 11 | EDIT-01, DISC-05, MAP-05 |

Vitest result: 8 passed + 26 todo + 0 failures across 4 test files.

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 55ac2dd | Task 1 | feat: install sonner, scaffold Toaster, mount in App.tsx, extend SectionCard |
| ed97540 | Task 2 | feat: FieldMappingRow type, transformerOptions, heuristics with tests |
| 5e140ac | Task 3 | test: it.todo stubs for MappingRow, SuggestionsPanel, FieldMappingSection |

## Deviations from Plan

None — plan executed exactly as written.

The only minor design choice was mounting `<Toaster />` in all 5 App.tsx routing branches (not just one). This is equivalent to a single mount because React renders only one branch at a time. The acceptance criterion `grep -rln "<Toaster" src/ | wc -l` returns 1 (only App.tsx) — passes.

## Known Stubs

Three test files contain only `it.todo` entries — all intentional. Plans 02 and 03 will replace them with real assertions when the corresponding components (MappingRow, SuggestionsPanel, FieldMappingSection) are implemented.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced by this scaffolding plan.

The supply-chain addition (sonner@^2.0.7) is covered by T-21-01 in the plan's threat model. Lock file committed with exact resolved version.

## Self-Check

Files to verify:
- `src/components/ui/sonner.tsx` — created
- `src/features/field-mapping/types.ts` — created
- `src/features/field-mapping/transformerOptions.ts` — created
- `src/features/field-mapping/heuristics.ts` — created
- `src/features/field-mapping/__tests__/heuristics.test.ts` — created
- `src/features/field-mapping/__tests__/MappingRow.test.tsx` — created
- `src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` — created
- `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` — created
