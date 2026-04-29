---
quick_id: 260429-ev2
phase: quick
plan: 260429-ev2
subsystem: frontend/field-display
tags: [field-display, jira-fields, dynamic-rendering, read-only, schema-cache]
status: complete
completed: "2026-04-29"
duration: "~13 min"
tasks_completed: 2
files_changed: 9
commits:
  - b09f48b
  - 54c64cf
decisions:
  - "Read-only display is a parallel surface to the editable registry — intentionally NOT extending RendererProps"
  - "any/default branch renders plain string/number values directly (not JSON-quoted) for better readability"
  - "Status-shaped detection requires statusCategory to be present — plain {name:string} objects fall through to string rendering"
  - "AllFieldsSection triggers loadSchema once on mount via hasLoadedRef guard + getState() check to avoid exhaustive-deps lint"
---

# Quick Task 260429-ev2: Show All Source Jira Fields Dynamically Summary

One-liner: Shared `AllFieldsSection` renders every non-empty source Jira field on both OverviewTab and CopyPreviewModal source column using a new read-only formatter (`renderSourceFieldValue`) that discriminates on FieldSchemaType with graceful JSON fallback for unknown types.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| T1 | Read-only source-value formatter (sourceValueDisplay) | b09f48b | sourceValueDisplay.tsx, sourceValueDisplay.test.tsx, en.json, sk.json |
| T2 | AllFieldsSection + OverviewTab + CopyPreviewModal wiring | 54c64cf | AllFieldsSection.tsx, AllFieldsSection.test.tsx, OverviewTab.tsx, CopyPreviewModal.tsx, OverviewTab.test.tsx, TicketDetailPage.test.tsx, CopyPreviewModal.test.tsx |

## Files Changed

### Created
- `src/features/field-renderers/sourceValueDisplay.tsx` — Read-only formatter accepting (FieldSchemaType, value). Discriminates on schema.type; falls back to JSON truncated to 200 chars with "raw" tag.
- `src/features/field-renderers/__tests__/sourceValueDisplay.test.tsx` — 33 assertions covering all 19 behavior tests from the plan.
- `src/features/tickets/AllFieldsSection.tsx` — Shared section component. Joins raw fields with source schema cache, filters noise via `isNoiseValue`, sorts (priority system fields first, then system alphabetically, then custom alphabetically), renders via `renderSourceFieldValue`.
- `src/features/tickets/__tests__/AllFieldsSection.test.tsx` — 10 tests covering loading/success state, filtering, unknown fields, compact layout, ordering, skip list, and integration.

### Modified
- `src/features/tickets/tabs/OverviewTab.tsx` — Replaced hardcoded 7-field grid with `<AllFieldsSection skip={OVERVIEW_BESPOKE_FIELDS}>`. Bespoke sections (Description, Sub-tasks, Linked Issues) retained below.
- `src/features/tickets/CopyPreviewModal.tsx` — Replaced hardcoded `SourceFieldRow` stack with `<AllFieldsSection compact skip={COPY_SOURCE_BESPOKE_FIELDS}>`. Side-effect banners (attachments/comments/subtasks/issuelinks counts) and Description retained.
- `src/i18n/locales/en.json` + `sk.json` — Added `fieldDisplay.raw`, `fieldDisplay.empty`, `fieldDisplay.unknownFieldType` keys.
- `src/features/tickets/__tests__/OverviewTab.test.tsx` — Added schemaCacheStore mock; updated status fixture to include `statusCategory` for StatusBadge detection.
- `src/features/tickets/__tests__/TicketDetailPage.test.tsx` — Added schemaCacheStore mock + `statusCategory` fixture (Rule 1 fix for test failures introduced by OverviewTab change).
- `src/features/tickets/CopyPreviewModal.test.tsx` — Added schemaCacheStore mock + `statusCategory` fixture (Rule 1 fix for 1 new test failure introduced by CopyPreviewModal change).

## Schema-Type Variants Handled

| Schema Type | Rendering |
|-------------|-----------|
| `string` | `<span>` with value; description system field truncated at 240 chars |
| `number` | `<span>` with String(value); 0 is not noise |
| `date` | `formatDate` with date-only options |
| `datetime` | `formatDate` with date+time options |
| `user` | `<UserAvatar>` + displayName; graceful fallback to name/accountId |
| `option` | Extracts `value.value ?? value.name ?? String(value)` |
| `option-with-child` | `"Parent / Child"` format |
| `priority` | `<PriorityIcon>` |
| `issuetype` | `<img src={iconUrl}>` + name (img omitted when absent) |
| `array/string` | Comma-joined strings |
| `array/user` | Flex row of `<UserAvatar>` + names |
| `array/option` | Comma-joined `value.value ?? value.name` |
| `array/component` | Comma-joined `name` |
| `array/version` | Comma-joined `name` |
| `array/group` | Comma-joined `name ?? groupId` |
| `array/<unknown>` | JSON fallback per item |
| `any` (status-shaped: has `statusCategory`) | `<StatusBadge>` |
| `any` (plain string/number) | `<span>` directly |
| `any` / default | JSON truncated at 200 chars + `<code>` block + "raw" tag |

## Filter Rules Applied (`isNoiseValue`)

- `null` / `undefined`
- Empty string `''`
- Empty array `[]`
- Empty plain object `{}`
- `workratio === -1` (Jira internal sentinel)
- `progress.progress === 0 && progress.total === 0` (zero-progress fields)
- Fields with `fieldId.startsWith('_')` (Jira internal fields, skipped in AllFieldsSection)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TicketDetailPage tests broke after OverviewTab wiring**
- **Found during:** Task 2 full-suite run
- **Issue:** `TicketDetailPage.test.tsx` didn't mock `schemaCacheStore`; `AllFieldsSection` (via new `OverviewTab`) tried to invoke Tauri `discover_source_fields` in jsdom. Status fixture also lacked `statusCategory` needed for StatusBadge detection.
- **Fix:** Added `schemaCacheStore` mock to `TicketDetailPage.test.tsx`; added `statusCategory` to status fixture.
- **Files modified:** `src/features/tickets/__tests__/TicketDetailPage.test.tsx`
- **Commit:** 54c64cf

**2. [Rule 1 - Bug] renderSourceFieldValue any-branch: plain strings JSON-quoted unreadably**
- **Found during:** Task 2 Test 4 (unknown field shows plain string value)
- **Issue:** `JSON.stringify('mystery value')` produces `"mystery value"` with quotes; `getByText('mystery value')` fails since text node is `"mystery value"`.
- **Fix:** Added early return in `any/default` branch for `typeof value === 'string'` and `typeof value === 'number'` — renders directly as `<span>` rather than JSON-quoting.
- **Files modified:** `src/features/field-renderers/sourceValueDisplay.tsx`
- **Commit:** 54c64cf

**3. [Rule 2 - Pre-existing] CopyPreviewModal.test.tsx had 5 pre-existing failures**
- These tests were already failing before 260429-ev2 (tested via git stash): "renders editable target fields", "populates status/priority dropdowns", "renders label checkboxes", "shows No labels on source ticket".
- Per scope boundary rule: pre-existing failures in unrelated areas are out of scope. Logged to `deferred-items.md`.
- One new failure introduced by my changes ("renders source fields") was fixed by adding the schemaCacheStore mock.

## Potential Follow-up Patterns

- **Target-side read-only display:** If a read-only view of resolved target field values becomes needed (e.g., copy result confirmation screen), `renderSourceFieldValue` can be reused as-is — it's schema-agnostic (works with any `FieldSchemaType`).
- **AllFieldsSection on target side:** The same component could display resolved target field values before copy confirmation, with `skip` set to fields already shown in `DynamicTargetForm`.
- **Status shape detection robustness:** Currently requires `statusCategory` to be present. Future: detect `{name: string, id: string}` shapes as status-like if `fieldId === 'status'`.

## Self-Check: PASSED

- `src/features/field-renderers/sourceValueDisplay.tsx` — FOUND
- `src/features/field-renderers/__tests__/sourceValueDisplay.test.tsx` — FOUND
- `src/features/tickets/AllFieldsSection.tsx` — FOUND
- `src/features/tickets/__tests__/AllFieldsSection.test.tsx` — FOUND
- Commit b09f48b — FOUND
- Commit 54c64cf — FOUND
- Tests: 33 (T1) + 10 (T2 AllFieldsSection) + 13 (OverviewTab) + 14 (TicketDetailPage) = 70 new/updated tests pass
- Pre-existing CopyPreviewModal.test.tsx 5 failures: same count as before this PR
