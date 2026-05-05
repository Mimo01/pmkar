---
phase: 25-preview-time-resolution
plan: "02"
subsystem: frontend
tags: [react, async-effect, tauri-invoke, tdd, phase-25, copy-preview]
dependency_graph:
  requires:
    - src-tauri/src/commands.rs (resolve_description_to_adf, resolve_users_preview — built in 25-01)
    - src-tauri/src/main.rs (invoke_handler registration — built in 25-01)
    - src/features/tickets/CopyPreviewPage.tsx (pre-fill useEffect, dynamicFormFields, target panel JSX)
    - src/features/tickets/copyStore.ts (overrideValues, confirmCopy — unchanged, passes through)
  provides:
    - Async pre-fill effect invoking resolve_description_to_adf + resolve_users_preview at preview-open
    - Read-only description block in target panel (shown when resolved ADF is in overrideValues)
    - description field excluded from DynamicTargetForm editable field list
    - Phase 25 i18n keys for read-only description display (EN + SK)
  affects:
    - src/features/tickets/__tests__/CopyPreviewPage.test.tsx (3 new Phase 25 tests + existing test updated)
    - src/features/tickets/__tests__/copyStore.test.ts (PREV-04 test added)
tech_stack:
  added: []
  patterns:
    - TDD red/green cycle for async pre-fill extension
    - async IIFE with cancelled guard (unmount safety pattern, matching DescriptionRenderer)
    - Promise.all([descPromise, usersPromise]) for parallel async resolution before audit log flush
    - FieldSchemaType discriminated union narrowing via 'system' in r.sourceSchema
key_files:
  created: []
  modified:
    - src/features/tickets/CopyPreviewPage.tsx
    - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
    - src/features/tickets/__tests__/copyStore.test.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - async IIFE with cancelled guard used instead of top-level async useEffect — matches existing DescriptionRenderer pattern; prevents state updates after unmount
  - Promise.all([descPromise, usersPromise]) awaited before log_preview_transformations — ensures all outcomes captured in single audit batch
  - description excluded from DynamicTargetForm (f.fieldId !== 'description' filter) — ADF editor deferred post-v0.4.0; read-only display in target panel replaces editable field
  - 'system' in r.sourceSchema narrowing used for FieldSchemaType union safety — system property absent from issuetype/priority/any variants
  - resolvedUser?.accountId (optional chaining) preferred over resolvedUser && resolvedUser.accountId — biome suggestion applied
  - Existing log_preview_transformations test updated — user rows now go through async resolution path; test assertion for user outcome removed as stale
metrics:
  duration: 7
  completed_date: "2026-05-05"
  tasks_completed: 2
  files_changed: 5
---

# Phase 25 Plan 02: Async pre-fill for wiki_to_adf and user resolution in CopyPreviewPage

Pre-fill `useEffect` in `CopyPreviewPage` converted to async IIFE invoking `resolve_description_to_adf` for wiki_to_adf rows and `resolve_users_preview` for user-kind rows, with description shown read-only in target panel and excluded from `DynamicTargetForm`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Failing tests for Phase 25 async pre-fill (PREV-01/02/03/04) | f51454b | CopyPreviewPage.test.tsx, copyStore.test.ts |
| GREEN | Extend CopyPreviewPage pre-fill effect + description read-only + i18n | 589cd6f | CopyPreviewPage.tsx, CopyPreviewPage.test.tsx, en.json, sk.json |

## What Was Built

### Async pre-fill useEffect

The synchronous `useEffect` body was replaced with an `async IIFE` with a `cancelled` guard:

1. **Identity/priority rows** (synchronous, unchanged) — same as before
2. **wiki_to_adf row** (async) — finds the description mapping row by `transformerKind === 'wiki_to_adf'`, invokes `resolve_description_to_adf({ html: renderedDescription })`, stores the returned ADF object in `overrideValues.description`
3. **user rows** (async) — collects all `transformerKind === 'user'` (or `sourceSchema.type === 'user'`) rows, extracts `{ username, email }` entries from source ticket fields, batches them into a single `resolve_users_preview` call, and stores resolved Cloud user objects in `overrideValues[targetFieldId]`
4. Awaits `Promise.all([descPromise, usersPromise])` before calling `log_preview_transformations` to ensure all outcomes are in the batch

### Description exclusion from DynamicTargetForm

Added `f.fieldId !== 'description' &&` to the `dynamicFormFields` filter predicate. This prevents the description field from appearing as an editable form field since it is shown read-only in the panel above.

### Read-only description block

When `overrideValues.description !== undefined` and `renderedDescription` is available, a read-only description block renders in the target panel between GapsSection and DynamicTargetForm:
- Greyed out (`opacity-75`) and non-interactive (`pointer-events-none`)
- Capped height (`max-h-40 overflow-hidden`) to prevent very long descriptions from dominating the panel
- Two i18n keys: `copy.preview.descriptionReadOnly` and `copy.preview.descriptionReadOnlyHint`

### i18n keys

Added to both `en.json` and `sk.json`:
- `copy.preview.descriptionReadOnly` — "Description (will be copied)" / "Popis (bude skopírovaný)"
- `copy.preview.descriptionReadOnlyHint` — "Resolved description will be copied as formatted content." / "Preložený popis bude skopírovaný ako formátovaný obsah."

### Tests

| Test | File | Validates |
|------|------|-----------|
| PREV-01 pre-fill invokes resolve_description_to_adf for wiki_to_adf row | CopyPreviewPage.test.tsx | invoke called with `{ html }`, setOverrideValue called with ADF object |
| PREV-02 pre-fill invokes resolve_users_preview for user rows | CopyPreviewPage.test.tsx | invoke called with `{ users, cloudBaseUrl }`, setOverrideValue called with Cloud user |
| PREV-03 description excluded from DynamicTargetForm fields | CopyPreviewPage.test.tsx | capturedFormProps.fields has no entry with fieldId === 'description' |
| PREV-04 confirmCopy invoke args contain Phase 25 override values | copyStore.test.ts | copy_ticket_v2 args.overrideValues.description (ADF) + assignee (accountId) |

All 807 frontend tests pass. Full test suite: 0 regressions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FieldSchemaType discriminated union access via 'in' narrowing**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `r.sourceSchema?.system === 'description'` caused `TS2339: Property 'system' does not exist on type 'FieldSchemaType'` because the `issuetype`, `priority`, and `any` variants lack the `system` property
- **Fix:** Changed to `'system' in r.sourceSchema && r.sourceSchema.system === 'description'` for type-safe narrowing
- **Files modified:** `src/features/tickets/CopyPreviewPage.tsx`
- **Commit:** 589cd6f

**2. [Rule 1 - Bug] Updated stale test assertion for user row audit outcome**
- **Found during:** Task 1 GREEN phase — existing test failure
- **Issue:** The existing `logs preview transformations` test expected `byField.assignee?.outcome` to be `'skipped'` (old synchronous path). With Phase 25 changes, user rows go through async `resolve_users_preview` — the mock sourceTicket has `assignee: { displayName: 'Alice', emailAddress }` with no `name` field, so no user entry is created and no log entry is emitted for assignee
- **Fix:** Removed the stale assertion and updated the comment to document the new async path behavior
- **Files modified:** `src/features/tickets/__tests__/CopyPreviewPage.test.tsx`
- **Commit:** 589cd6f

**3. [Rule 1 - Bug] Biome formatter fixes**
- **Found during:** Task 1 biome check
- **Issue:** Two biome style issues — (a) `isCopyDisabled` line too long for formatter, (b) `resolvedUser && resolvedUser.accountId` should use optional chaining
- **Fix:** Applied both — line break and `resolvedUser?.accountId`
- **Files modified:** `src/features/tickets/CopyPreviewPage.tsx`
- **Commit:** 589cd6f

## TDD Gate Compliance

- RED gate: commit f51454b (`test(25-02)`) — 4 tests written before implementation; 3 CopyPreviewPage tests failed, PREV-04 passed immediately (copyStore already passes overrideValues through)
- GREEN gate: commit 589cd6f (`feat(25-02)`) — implementation written; all 4 tests + all 807 existing tests pass

## Known Stubs

None — description ADF is stored in overrideValues and flows to copy_ticket_v2 via the existing override spread in confirmCopy.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. The pre-fill effect uses the same Tauri invoke boundary as the rest of the app. T-25-05 through T-25-07 from the plan's threat model all apply and are accepted/mitigated per plan spec.

## Self-Check: PASSED
