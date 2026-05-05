---
phase: 21-mapping-editor-settings-ui
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/components/ui/sonner.tsx
  - src/features/field-mapping/types.ts
  - src/features/field-mapping/transformerOptions.ts
  - src/features/field-mapping/heuristics.ts
  - src/features/field-mapping/__tests__/heuristics.test.ts
  - src/features/field-mapping/__tests__/MappingRow.test.tsx
  - src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx
  - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx
  - src/features/field-mapping/FieldMappingSection.tsx
  - src/features/connections/SettingsPage.tsx
  - src/App.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: fixed
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase covers the mapping editor settings UI: toast plumbing (sonner), field-mapping types, transformer option helpers, name-match heuristics, the FieldMappingSection/FieldMappingSectionHeader components, DriftWarning, MappingRow, SuggestionsPanel, SettingsPage integration, and i18n locale files. The overall architecture is sound: the module-scoped Zustand store pairing FieldMappingSection with FieldMappingSectionHeader, the schema-cache drift detection, the empty-string sentinel for dismissed suggestions, and the heuristic synonym lookup are all well-reasoned.

One blocker remains: initial load failure is swallowed silently with only a `console.error`, leaving users staring at a misleading "No field mappings yet" empty state when a backend error occurred. Five warnings cover a misleading `useEffect` dependency comment that masks unintended re-run behavior, `setLastRefreshed` being called on initial data load (poisoning the "not yet refreshed" UX), a loose `string` type for `transformerKind` that diverges from the `TransformerOption` union, an `aria-disabled`-only button that looks and fires incorrectly when no users are selected, and a synonym-loop fall-through that is a latent correctness risk when synonyms are extended. Three informational items cover `console.error` in production paths, a gap in `getTransformerOptions` test coverage, and a stale inline comment.

---

## Critical Issues

### CR-01: Load failure is swallowed silently — no user-visible error feedback

**File:** `src/features/field-mapping/FieldMappingSection.tsx:208–210`

**Issue:** The `load()` async function inside the mount `useEffect` catches all errors and calls `console.error`, then falls through to `setLoading(false)`. The component then renders the empty-state UI ("No field mappings yet — Defaults are seeded on first discovery"). A user cannot distinguish a genuine empty database from a backend/network failure. Any rows that exist in the database but failed to load are invisible, and the user may start adding duplicate mappings. This is a user-facing correctness failure.

```ts
// Current (WRONG)
} catch (e) {
  console.error('Failed to load field mapping:', e);
} finally {
  setLoading(false);
}
```

**Fix:** Track load failure with a state variable and render an explicit error UI:

```tsx
const [loadError, setLoadError] = useState(false);

// in load():
} catch (e) {
  setLoadError(true);
} finally {
  setLoading(false);
}

// in render, before the empty-state check:
if (loadError) {
  return (
    <p className="text-sm text-destructive py-4 text-center">
      {t('settings.fieldMapping.loadError')}
    </p>
  );
}
```

Add the missing i18n key to both locale files:
- `en.json`: `"settings.fieldMapping.loadError": "Failed to load field mappings. Check your connection and try again."`
- `sk.json`: `"settings.fieldMapping.loadError": "Nepodarilo sa načítať mapovania polí. Skontrolujte pripojenie a skúste znova."`

---

## Warnings

### WR-01: `useEffect` dependency array is misleading — "mount only" comment contradicts actual behavior

**File:** `src/features/field-mapping/FieldMappingSection.tsx:215–216`

**Issue:** The ESLint suppression comment reads `// mount only — intentional`, but the dependency array is `[loadSchema, preWarm, setLastRefreshed, setLoading, setMappingRows, targetProjectKey]`. The effect will re-fire whenever `targetProjectKey` changes — for example, when the Zustand connection store hydrates asynchronously after mount (which it does, per `App.tsx:68–72`). This means:

1. The effect is not mount-only: it re-runs on any `targetProjectKey` change, calling `setLoading(true)` and resetting `mappingRows`, which discards any in-progress user edits.
2. The comment misleads future maintainers about the intended lifecycle.

The Zustand setter references (`loadSchema`, `preWarm`, `setLastRefreshed`, `setLoading`, `setMappingRows`) are stable references and do not cause re-runs in practice, but listing them obscures the only value that actually matters: `targetProjectKey`.

**Fix:** Either genuinely restrict to mount-only by reading `targetProjectKey` from the store inside the effect (bypassing React's closure capture), or acknowledge the reactivity and document it accurately:

```tsx
// Re-runs on mount and when targetProjectKey changes (store hydration or user selection).
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [targetProjectKey]);
```

And remove the stable setter references from the array — the lint suppression already covers them.

---

### WR-02: `setLastRefreshed(Date.now())` called on initial data load, not on user-initiated schema refresh

**File:** `src/features/field-mapping/FieldMappingSection.tsx:207`

**Issue:** The mount-time `load()` function calls `setLastRefreshed(Date.now())` after successfully loading mapping rows and schemas. This means `FieldMappingSectionHeader` immediately displays "Last refreshed just now" every time the user navigates to the field-mapping section — even before they have ever clicked the Refresh button. The label is semantically tied to schema cache freshness from a user-initiated flush, not to the component hydrating from the database.

**Fix:** Remove the `setLastRefreshed(Date.now())` call from inside `load()` in `FieldMappingSection`. The only correct call site is in `FieldMappingSectionHeader.handleRefresh` (line 126), which already sets it. The initial state `lastRefreshed: null` will then correctly show "Not yet refreshed" until the user explicitly refreshes.

---

### WR-03: `FieldMappingRow.transformerKind` typed as `string` — diverges from the `TransformerOption` value union

**File:** `src/features/field-mapping/types.ts:15–16` / `src/features/field-mapping/transformerOptions.ts:4`

**Issue:** `FieldMappingRow.transformerKind` is declared as `string`. `TransformerOption.value` is a union of seven string literals. At the usage site in `MappingRow.tsx:50`:

```ts
const currentTransformer: TransformerOption | null =
  transformerItems.find((o) => o.value === row.transformerKind) ?? null;
```

This compiles because `string === literal` is valid, but the types are not aligned. When `row.transformerKind` arrives from the Rust backend carrying a value outside the seven known literals (e.g., a newly added transformer), the combobox falls back to `null` silently — the user sees no transformer selected. Additionally, the inline comment on `types.ts:15` lists only six values and omits `user_name`, which is present in the union.

**Fix:** Introduce a shared type alias and reference it from both files:

```ts
// transformerOptions.ts — add export
export type TransformerKind =
  | 'identity'
  | 'user'
  | 'user_name'
  | 'version'
  | 'component'
  | 'wiki_to_adf'
  | 'priority';

// types.ts
import type { TransformerKind } from './transformerOptions';

export interface FieldMappingRow {
  // ...
  /** One of the TransformerKind literals. */
  transformerKind: TransformerKind;
}
```

---

### WR-04: "Add Selected" button uses `aria-disabled` without `disabled` — click handler fires when zero users are selected

**File:** `src/features/connections/SettingsPage.tsx:1000–1008`

**Issue:** The "Add selected" button in the domain search result panel sets `aria-disabled={selectedAccountIds.size === 0}` but not the HTML `disabled` attribute:

```tsx
<button
  type="button"
  onClick={handleAddDomainResults}
  aria-disabled={selectedAccountIds.size === 0}
  className="... disabled:opacity-40 disabled:cursor-not-allowed"
>
```

`aria-disabled` is a purely semantic ARIA annotation — it does not prevent click events from firing. Consequences:
1. The `disabled:opacity-40 disabled:cursor-not-allowed` Tailwind variants never apply (they respond to the `disabled` HTML attribute, not `aria-disabled`). The button looks fully enabled when zero users are selected.
2. Clicking the button when zero users are selected calls `handleAddDomainResults`, which bails out at `if (newEntries.length === 0) return` without error — a silent no-op that appears broken to the user.
3. Keyboard users pressing Enter on the focused button receive no feedback.

**Fix:**

```tsx
<button
  type="button"
  onClick={handleAddDomainResults}
  disabled={selectedAccountIds.size === 0}
  className="... disabled:opacity-40 disabled:cursor-not-allowed"
>
```

The `aria-disabled` attribute can be removed when the native `disabled` attribute is used, as browsers expose it automatically in the accessibility tree.

---

### WR-05: Synonym-loop fall-through creates latent cross-group match risk when `SYNONYMS` is extended

**File:** `src/features/field-mapping/heuristics.ts:41–47`

**Issue:** The synonym lookup loop:

```ts
for (const [canonical, syns] of Object.entries(SYNONYMS)) {
  const allForms = [canonical, ...syns];
  if (allForms.includes(lower)) {
    const match = targetFields.find((f) => allForms.includes(normalize(f.name)));
    if (match) return match;
    // NO break/return here — falls through to next synonym group
  }
}
```

When a source name matches a synonym group but no target field matches any form in that group, the loop continues to subsequent groups. If a future Phase 22 extension of `SYNONYMS` introduces a synonym that overlaps between two groups (e.g., a field name shared between two entries), the first matching group that has a target field will win — not the most-specific match. Currently the synonym table has no overlaps, so this is latent, but the code comment explicitly says "Phase 22 may extend this."

**Fix:** Return null immediately when the source belongs to a synonym group but no target match is found — matching a synonym group is exclusive:

```ts
for (const [canonical, syns] of Object.entries(SYNONYMS)) {
  const allForms = [canonical, ...syns];
  if (allForms.includes(lower)) {
    const match = targetFields.find((f) => allForms.includes(normalize(f.name)));
    return match ?? null; // found or explicitly not found — do not continue
  }
}
```

---

## Info

### IN-01: `console.error` left in production code paths

**Files:**
- `src/features/field-mapping/FieldMappingSection.tsx:209`
- `src/features/connections/SettingsPage.tsx:1309, 1313`

**Issue:** Three `console.error` calls remain in production code. The one in `FieldMappingSection.tsx` is the companion to CR-01 (silence on load failure). The two in `SettingsPage.tsx` (inside `handleFrequencyChange` and `PollingSection`) log poll-frequency and notification-pref save failures without surfacing them to the user. The app otherwise surfaces errors through `toast.error` consistently.

**Fix:** Once CR-01 is addressed, remove the `console.error` in `FieldMappingSection`. For `SettingsPage.tsx`, replace with `toast.error` for user-impacting failures, consistent with the field-mapping error handling pattern already in place.

---

### IN-02: `getTransformerOptions` has no unit tests despite 11 distinct branches

**File:** `src/features/field-mapping/transformerOptions.ts`

**Issue:** `getTransformerOptions` contains an `isUserSource` guard (2 branches), a `user→string` early-return path, and a `switch` with 9 cases (including a default that returns all options for `{type: 'any'}`). The `heuristics.ts` module has thorough test coverage. `transformerOptions.ts` has none. The `user→string` → `[USER_NAME]` path, the `{type: 'any'}` → all-options path, and the priority/array-items paths are all untested.

**Fix:** Add `transformerOptions.test.ts` covering at minimum:
- `schema={type:'string'}`, `sourceSchema={type:'user'}` → only `USER_NAME`
- `schema={type:'string'}`, no sourceSchema → `[IDENTITY, WIKI_TO_ADF]`
- `schema={type:'user'}` → `[USER, IDENTITY]`
- `schema={type:'any'}` → all seven options
- `schema={type:'array', items:'component'}` → `[COMPONENT, IDENTITY]`
- `schema={type:'priority'}` → `[PRIORITY, IDENTITY]`

---

### IN-03: Stale inline comment on `FieldMappingRow.transformerKind` omits `user_name`

**File:** `src/features/field-mapping/types.ts:15`

**Issue:** The comment reads `"One of: "identity" | "user" | "version" | "component" | "wiki_to_adf" | "priority"."` — six values. The canonical union in `transformerOptions.ts` has seven, including `user_name`. This will mislead any developer reading the type definition.

**Fix:** Update the comment (or, better, remove it in favor of the `TransformerKind` type alias suggested in WR-03):

```ts
/** One of: "identity" | "user" | "user_name" | "version" | "component" | "wiki_to_adf" | "priority". */
transformerKind: string;
```

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
