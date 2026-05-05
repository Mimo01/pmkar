---
phase: 24-audit-log-copy-time-resolution
plan: "02"
subsystem: ui
tags:
  - audit-log
  - field-transformations
  - i18n
  - react
  - vitest
dependency_graph:
  requires:
    - phase: 24-01
      provides: copy-time audit rows with outcome='copied' written to mapping_audit_log
    - AuditLogPage.tsx badge outcome switch (pre-existing, ok/failed/skipped branches)
    - en.json + sk.json outcome i18n keys (pre-existing, ok/failed/skipped)
  provides:
    - Blue badge branch for outcome='copied' in AuditLogPage Field Transformations table
    - i18n keys audit.fields.outcome.copied in EN ("copied") and SK ("skopírované")
    - MappingAuditEntry.outcome union type extended with 'copied'
    - 3 new tests covering groupByCopyId counting, badge rendering, and summary header invariant
  affects:
    - AuditLogPage Field Transformations tab (copy-time rows now render correctly)
tech-stack:
  added: []
  patterns:
    - cn() conditional class pattern extended with new outcome branch (same pattern as existing ok/failed/skipped)
    - i18n key added after existing sibling key preserving alphabetical/semantic grouping

key-files:
  created: []
  modified:
    - src/features/tickets/AuditLogPage.tsx
    - src/features/tickets/types.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/tickets/__tests__/AuditLogPage.fieldGrouping.test.tsx

key-decisions:
  - "MappingAuditEntry.outcome type extended to include 'copied' — TypeScript union was 'ok' | 'failed' | 'skipped'; adding 'copied' required updating types.ts (Rule 2 deviation, missing from plan action list)"
  - "Test UUIDs use UUIDs with recognizable 8-char prefix (cccccccc / dddddddd) so findByRole with short-id pattern matches the aria-label rendered by AuditLogPage (shortId = copyId.slice(0, 8))"
  - "i18n resolves via real locale files in tests (test-setup.ts loads i18n/index.ts); badge badge text assertion uses 'copied' (EN value), not the raw key"

requirements-completed:
  - CUTV-04

duration: 12min
completed: "2026-05-05"
---

# Phase 24 Plan 02: 'copied' Outcome Badge and i18n Keys Summary

**Blue badge (bg-blue-500/15) for outcome='copied' in Field Transformations UI, EN/SK i18n keys, and 3 covering tests — copy-time audit rows now render correctly alongside preview-time rows**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-05T09:54:00Z
- **Completed:** 2026-05-05T10:00:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- AuditLogPage.tsx badge switch gains `row.outcome === 'copied'` branch with blue color classes (bg-blue-500/15 text-blue-400 border-blue-500/20), inserted after 'ok' and before 'failed'
- Both locale files now include `audit.fields.outcome.copied`: "copied" (EN) and "skopírované" (SK) immediately after the existing "skipped" key
- `MappingAuditEntry.outcome` TypeScript union extended from `'ok' | 'failed' | 'skipped'` to `'ok' | 'copied' | 'failed' | 'skipped'`
- Three new tests in AuditLogPage.fieldGrouping.test.tsx: groupByCopyId counting, badge text rendering via real i18n, and group summary header invariant (no failed/skipped text for 'copied' rows)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 'copied' badge branch to AuditLogPage and i18n keys to en.json + sk.json** - `4783fd1` (feat)
2. **Task 2: Add 'copied' outcome tests to AuditLogPage.fieldGrouping.test.tsx** - `07ef4ed` (test)

## Files Created/Modified

- `src/features/tickets/AuditLogPage.tsx` - Added 'copied' branch in Badge outcome cn() block
- `src/features/tickets/types.ts` - Extended MappingAuditEntry.outcome union with 'copied'
- `src/i18n/locales/en.json` - Added audit.fields.outcome.copied = "copied"
- `src/i18n/locales/sk.json` - Added audit.fields.outcome.copied = "skopírované"
- `src/features/tickets/__tests__/AuditLogPage.fieldGrouping.test.tsx` - 3 new tests in 'copied' outcome describe block

## Decisions Made

- MappingAuditEntry.outcome type extended to include 'copied' — TypeScript type was 'ok' | 'failed' | 'skipped'; adding 'copied' required updating types.ts so the badge comparison doesn't produce TS2367 ("no overlap" error). This was a Rule 2 fix not mentioned in the plan action list.
- Test UUIDs chosen with recognizable 8-char prefix (cccccccc / dddddddd) because AuditLogPage renders `shortId = copyId.slice(0, 8)` in the button aria-label; tests find the header via `findByRole('button', { name: /cccccccc/i })`.
- Badge text assertion uses real i18n value "copied" (not the raw key) because test-setup.ts loads the real i18n/index.ts with the real locale files, so the new en.json key resolves correctly in tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended MappingAuditEntry.outcome TypeScript union with 'copied'**
- **Found during:** Task 1 (tsc --noEmit check after badge branch added)
- **Issue:** `types.ts` typed `outcome` as `'ok' | 'failed' | 'skipped'` — adding `row.outcome === 'copied'` comparison produced TS2367 ("types have no overlap")
- **Fix:** Added `'copied'` to the union in `src/features/tickets/types.ts`
- **Files modified:** `src/features/tickets/types.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 4783fd1 (Task 1 commit)

**2. [Rule 1 - Bug] Test UUIDs use recognizable prefix for aria-label matching**
- **Found during:** Task 2 first test run (two tests failing with "Unable to find role='button' and name /copied-test-uuid/i")
- **Issue:** Plan's example test used `copyId: 'copied-test-uuid'` with `findByRole` matching `/copied-test-uuid/i`, but AuditLogPage renders `shortId = copyId.slice(0, 8)` in the aria-label. `'copied-test-uuid'.slice(0, 8) = 'copied-t'`, not 'copied-test-uuid'.
- **Fix:** Changed test copyIds to valid UUID-format strings with distinct 8-char prefixes (`'cccccccc-...'` and `'dddddddd-...'`); updated regex to `/cccccccc/i` and `/dddddddd/i`.
- **Files modified:** `src/features/tickets/__tests__/AuditLogPage.fieldGrouping.test.tsx`
- **Verification:** All 10 tests pass
- **Committed in:** 07ef4ed (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical type, 1 test assertion bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Known Stubs

None — badge color and i18n values are real, not placeholder data.

## Next Phase Readiness

- Plan 24-02 complete. All Field Transformations UI changes for 'copied' outcome are in place.
- End-to-end behavior: after Plan 01 writes copy-time audit rows with `outcome='copied'`, the Field Transformations tab will render them with a blue badge and the correct label "copied" (EN) / "skopírované" (SK), grouped under the same copyId as preview-time rows.
- Group header ("N fields · X failed · Y skipped") correctly excludes 'copied' rows from the named counters.

---
*Phase: 24-audit-log-copy-time-resolution*
*Completed: 2026-05-05*
