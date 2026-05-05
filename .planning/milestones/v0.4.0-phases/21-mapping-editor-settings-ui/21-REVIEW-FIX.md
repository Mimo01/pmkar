---
phase: 21-mapping-editor-settings-ui
fixed_at: 2026-05-05T07:42:00Z
review_path: .planning/milestones/v0.4.0-phases/21-mapping-editor-settings-ui/21-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-05-05T07:42:00Z
**Source review:** `.planning/milestones/v0.4.0-phases/21-mapping-editor-settings-ui/21-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical + 5 Warnings)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Load failure is swallowed silently — no user-visible error feedback

**Files modified:** `src/features/field-mapping/FieldMappingSection.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/sk.json`
**Commit:** `4a5f826`
**Applied fix:**
- Added `const [loadError, setLoadError] = useState(false)` state to `FieldMappingSection`
- Replaced `console.error` in catch block with `setLoadError(true)`
- Added error UI rendered before the loading skeleton: `<p className="text-sm text-destructive py-4 text-center">{t('settings.fieldMapping.loadError')}</p>`
- Added i18n key `settings.fieldMapping.loadError` to both `en.json` and `sk.json`
- Removed now-unused `setLastRefreshed` subscription from `FieldMappingSection` (it's only needed in the header)

Note: WR-01 and WR-02 were applied in the same commit since they modify the same function.

---

### WR-01: `useEffect` dependency array is misleading

**Files modified:** `src/features/field-mapping/FieldMappingSection.tsx`
**Commit:** `4a5f826` (same commit as CR-01)
**Applied fix:**
- Updated the comment from `// mount only — intentional` to accurately describe that the effect re-runs when `targetProjectKey` changes (store hydration or user selection)
- Removed the misleading `// mount only` annotation; the dep array still lists all referenced stable Zustand refs to satisfy Biome's `useExhaustiveDependencies` rule (Biome does not honour `eslint-disable-next-line react-hooks/exhaustive-deps` for this rule)
- Final dep array: `[targetProjectKey, loadSchema, preWarm, setLoading, setMappingRows]`

---

### WR-02: `setLastRefreshed(Date.now())` called on initial data load

**Files modified:** `src/features/field-mapping/FieldMappingSection.tsx`
**Commit:** `4a5f826` (same commit as CR-01)
**Applied fix:**
- Removed `setLastRefreshed(Date.now())` call from inside `load()` in `FieldMappingSection`
- The only remaining call site is `FieldMappingSectionHeader.handleRefresh` (line ~126), which correctly sets it on user-initiated schema refresh
- Initial state `lastRefreshed: null` now correctly shows "Not yet refreshed" until the user explicitly refreshes

---

### WR-03: `FieldMappingRow.transformerKind` typed as `string` — diverges from `TransformerOption` value union

**Files modified:** `src/features/field-mapping/transformerOptions.ts`, `src/features/field-mapping/types.ts`
**Commit:** `b2491fb`
**Applied fix:**
- Exported `TransformerKind` union type from `transformerOptions.ts`
- Changed `TransformerOption.value` to use `TransformerKind` reference instead of inline literal union
- Imported `TransformerKind` in `types.ts` and changed `FieldMappingRow.transformerKind` from `string` to `TransformerKind`
- Updated JSDoc comment to reference the type alias instead of the stale inline list (which was missing `user_name`)

---

### WR-04: "Add Selected" button uses `aria-disabled` without `disabled`

**Files modified:** `src/features/connections/SettingsPage.tsx`
**Commit:** `06aabc7`
**Applied fix:**
- Replaced `aria-disabled={selectedAccountIds.size === 0}` with `disabled={selectedAccountIds.size === 0}` on the "Add selected" button in the domain search result panel
- The native `disabled` attribute now prevents click events from firing and activates the `disabled:opacity-40 disabled:cursor-not-allowed` Tailwind variants
- Removed `aria-disabled` since the native `disabled` attribute automatically sets the accessible disabled state in the accessibility tree

---

### WR-05: Synonym-loop fall-through creates latent cross-group match risk

**Files modified:** `src/features/field-mapping/heuristics.ts`
**Commit:** `d260255`
**Applied fix:**
- Changed the synonym loop body to use `return match ?? null` instead of `if (match) return match`
- When a source name belongs to a synonym group but no target field matches any form in that group, the function now returns `null` immediately rather than falling through to check subsequent synonym groups
- Added a comment explaining the exclusive-group semantics

---

_Fixed: 2026-05-05T07:42:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
