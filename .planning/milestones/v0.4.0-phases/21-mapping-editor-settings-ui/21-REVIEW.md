---
phase: 21-mapping-editor-settings-ui
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/App.tsx
  - src/components/ui/sonner.tsx
  - src/features/connections/SettingsPage.tsx
  - src/features/field-mapping/DriftWarning.tsx
  - src/features/field-mapping/FieldMappingSection.tsx
  - src/features/field-mapping/MappingRow.tsx
  - src/features/field-mapping/SuggestionsPanel.tsx
  - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx
  - src/features/field-mapping/__tests__/MappingRow.test.tsx
  - src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx
  - src/features/field-mapping/__tests__/heuristics.test.ts
  - src/features/field-mapping/heuristics.ts
  - src/features/field-mapping/transformerOptions.ts
  - src/features/field-mapping/types.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The phase 21 implementation introduces the Field Mapping editor inside the Settings page, covering `FieldMappingSection`, `MappingRow`, `SuggestionsPanel`, `DriftWarning`, `heuristics`, `transformerOptions`, the updated `SettingsPage`, and supporting i18n keys for both `en` and `sk`. The architecture — module-scoped Zustand store, two-component header/body split, schema cache integration, and the empty-string sentinel for dismissed suggestions — is well-reasoned and clean.

Two blockers are present: a logic bug that leaves the in-memory Zustand store out of sync with the persisted database when accepting a suggestion, and an accessibility defect where the "Add Selected" button ignores its disabled state. Five warnings cover stale-closure captures in the initial load effect, a render-time Zustand store access in `App.tsx`, missing error feedback on initial load failure, a `'use client'` directive that is meaningless in a Tauri app, and a pattern-safety gap in the synonym lookup. Three informational items cover `window.prompt`, `console.error` left in production paths, and a test coverage gap.

---

## Critical Issues

### CR-01: Accept-suggestion writes `transformerKind: 'identity'` to Zustand but persists the schema-correct transformer to the database

**File:** `src/features/field-mapping/FieldMappingSection.tsx:248-252`

**Issue:** `SuggestionsPanel.handleAccept` (the click handler) correctly derives the best initial transformer via `getTransformerOptions(s.target.schema)[0]?.value` and persists it with `invoke('set_field_mapping', { row })` before calling `onAccept`. However, `FieldMappingSection.handleAcceptSuggestion` — the `onAccept` callback — constructs a new `FieldMappingRow` that always sets `transformerKind: 'identity'` and stores it in the Zustand store via `updateRow`.

For any target schema where the canonical first transformer is not `identity` (e.g., `user` → first option is `USER`; `priority` → first option is `PRIORITY`; `array` items `user`/`version`/`component` → `USER`/`VERSION`/`COMPONENT`), the in-memory row shown in the UI immediately shows `Identity` while the database holds the correct transformer. If the user then makes any change to the row (e.g., picks a different target field), `MappingRow.handleTargetChange` reads `row.transformerKind` from the stale in-memory row and re-persists `identity`, silently overwriting the correct value.

```tsx
// FieldMappingSection.tsx — current (WRONG)
function handleAcceptSuggestion(sourceFieldId: string, target: FieldSchema) {
  const sf = sourceFields.find((f) => f.fieldId === sourceFieldId);
  const newRow: FieldMappingRow = {
    sourceFieldId,
    targetFieldId: target.fieldId,
    transformerKind: 'identity',              // ← always identity, ignores target schema
    sourceSchema: sf?.schema ?? ({ type: 'any' } as FieldSchemaType),
    targetSchema: target.schema,
  };
  updateRow(newRow);
}

// Fix: derive the same transformer the panel persisted
function handleAcceptSuggestion(sourceFieldId: string, target: FieldSchema) {
  const sf = sourceFields.find((f) => f.fieldId === sourceFieldId);
  const newRow: FieldMappingRow = {
    sourceFieldId,
    targetFieldId: target.fieldId,
    transformerKind: getTransformerOptions(target.schema)[0]?.value ?? 'identity',
    sourceSchema: sf?.schema ?? ({ type: 'any' } as FieldSchemaType),
    targetSchema: target.schema,
  };
  updateRow(newRow);
}
```

**Fix:** Import `getTransformerOptions` in `FieldMappingSection.tsx` (it is already imported via `MappingRow`; add the import at the top) and mirror the derivation used in `SuggestionsPanel.handleAccept`.

---

### CR-02: "Add Selected" button uses `aria-disabled` but not `disabled`, allowing keyboard/click activation when no users are selected

**File:** `src/features/connections/SettingsPage.tsx:992-999`

**Issue:** The "Add Selected" button in the domain search result panel uses `aria-disabled={selectedAccountIds.size === 0}` but does **not** set the HTML `disabled` attribute. `aria-disabled` is an ARIA hint that must be paired with manual event suppression — the browser does not enforce it. When zero users are selected, clicking the button calls `handleAddDomainResults`, which returns early only because `newEntries.length === 0`, so no incorrect write occurs, but:

1. The button's visual state via the `disabled:opacity-40 disabled:cursor-not-allowed` CSS classes does **not** apply, because those Tailwind variants respond to the `disabled` attribute, not `aria-disabled`. The button therefore looks enabled even when no users are selected.
2. Keyboard users can Tab to it and press Enter — they receive no response and no error, violating the principle of least surprise.

```tsx
// Current (WRONG)
<button
  type="button"
  onClick={handleAddDomainResults}
  aria-disabled={selectedAccountIds.size === 0}
  className="... disabled:opacity-40 disabled:cursor-not-allowed"
>

// Fix: use the native disabled attribute
<button
  type="button"
  onClick={handleAddDomainResults}
  disabled={selectedAccountIds.size === 0}
  className="... disabled:opacity-40 disabled:cursor-not-allowed"
>
```

---

## Warnings

### WR-01: Initial load effect captures stale `targetProjectKey` / `firstIssueTypeId` due to empty dependency array with suppressed lint rule

**File:** `src/features/field-mapping/FieldMappingSection.tsx:187-206`

**Issue:** The `useEffect` that runs the initial load intentionally uses `[]` as its dependency array and suppresses the exhaustive-deps warning with `// eslint-disable-next-line react-hooks/exhaustive-deps`. The async function inside closes over `targetProjectKey` and `firstIssueTypeId`. These values come from `useSchemaArrays()` which subscribes to the connection store, but because the effect only runs on mount, it uses the values that existed at mount time.

If `FieldMappingSection` mounts while the connection store is still hydrating (which is possible — `App.tsx` sets `hydrated = true` before `loadProjectConfig` resolves, per line 68-72 of `App.tsx`), then `targetProjectKey` is `null` at mount and the target schema is never loaded. The `noIssueTypes` guard at line 301 would hide the component, but if the project key arrives after mount, the component stays hidden until the user manually refreshes.

The module-scoped `useMappingEditorStore` survives across navigations (it is module-scoped Zustand), so the missing load is never retried. Users who open Settings > Field Mapping before the project config finishes loading will see "No issue types prewarmed" and have to click Refresh to recover.

**Fix:** Either move the target-schema load out of the mount effect and into a separate effect that depends on `[targetProjectKey, firstIssueTypeId]` (guarded so it only fires when those become non-null), or wait for hydration in `App.tsx` before allowing navigation to Settings.

---

### WR-02: `App.tsx` reads `useUpdateStore.getState()` directly during render, bypassing React's subscription model

**File:** `src/App.tsx:122`

**Issue:**
```tsx
const showUpdateModal =
  updateStatus === 'available' ||
  updateStatus === 'downloading' ||
  updateStatus === 'installing' ||
  (updateStatus === 'error' && useUpdateStore.getState().updateInfo !== null);
```

The last condition calls `useUpdateStore.getState()` synchronously during the render function. `getState()` returns a snapshot at call time; it does not cause the component to re-render when `updateInfo` changes. If `updateInfo` changes after the initial render but `updateStatus` stays `'error'`, the `showUpdateModal` computation produces a stale value until the next unrelated re-render. The rest of `updateStatus` is correctly subscribed via `useUpdateStore((s) => s.status)`.

**Fix:** Subscribe `updateInfo` the same way as `status`:
```tsx
const updateInfo = useUpdateStore((s) => s.updateInfo);
const showUpdateModal =
  updateStatus === 'available' ||
  updateStatus === 'downloading' ||
  updateStatus === 'installing' ||
  (updateStatus === 'error' && updateInfo !== null);
```

---

### WR-03: Initial load failure in `FieldMappingSection` is swallowed silently — no user-visible error feedback

**File:** `src/features/field-mapping/FieldMappingSection.tsx:198-200`

**Issue:** When `invoke('get_field_mapping')` or `loadSchema` throws during the mount effect, the catch block only calls `console.error(...)` and then falls through to `setLoading(false)`. The component renders the empty-state message ("No field mappings yet") even though the failure reason was a network/backend error, not a genuinely empty mapping table. The user sees a misleading UI and no actionable guidance.

```ts
// Current
} catch (e) {
  console.error('Failed to load field mapping:', e);
} finally {
  setLoading(false);
}
```

**Fix:** Add an error state to `useMappingEditorStore` and render an explicit error UI with a retry action, consistent with how other data-loading components in this codebase handle errors (e.g., `ProjectSelector` renders `t('settings.project.error')` in red).

---

### WR-04: Synonym lookup can produce a false positive when the source name matches a synonym key but none of the target fields match any form in that synonym group

**File:** `src/features/field-mapping/heuristics.ts:41-47`

**Issue:** The synonym loop structure is:

```ts
for (const [canonical, syns] of Object.entries(SYNONYMS)) {
  const allForms = [canonical, ...syns];
  if (allForms.includes(lower)) {           // source matches this group
    const match = targetFields.find((f) => allForms.includes(normalize(f.name)));
    if (match) return match;
  }
}
```

If the source name is, say, `"body"` (a synonym for `description`), the outer `if` matches the `description` group. The inner `find` then searches target fields for any of `['description', 'desc', 'body', 'details']`. If the only target field named anything in that set is also named `body`, it matches — but so would a field named `description` or `desc` or `details`. This is intentional and correct.

The subtle issue is that the loop does not `break` or `return null` when the source matches a synonym group but no target field matches. It **falls through** to the next loop iteration. This means a source named `"body"` that fails to match any `description`-group target field will then continue scanning subsequent synonym entries — potentially matching the `priority` group if `body` happened to also be listed there. Currently the synonym table has no overlap, so this is a latent risk rather than an active bug, but extending `SYNONYMS` in Phase 22 (as mentioned in the comments) could create silent cross-group matches.

**Fix:** After the inner `if (match) return match;`, add an explicit `break` or a separate `return null` so that a source that belongs to a synonym group never falls through to subsequent groups:

```ts
for (const [canonical, syns] of Object.entries(SYNONYMS)) {
  const allForms = [canonical, ...syns];
  if (allForms.includes(lower)) {
    const match = targetFields.find((f) => allForms.includes(normalize(f.name)));
    return match ?? null; // explicit: either found or done
  }
}
```

---

### WR-05: `'use client'` directive in `sonner.tsx` is semantically incorrect for a Tauri application

**File:** `src/components/ui/sonner.tsx:1`

**Issue:** The file begins with `'use client';`, a Next.js-specific directive for the React Server Components architecture. This project is a Tauri desktop application — it does not use Next.js or RSC. The directive is a no-op string literal that is not processed by Vite/Rollup, so it causes no runtime error, but it is actively misleading: it signals to any reader that the component must run on the client to distinguish it from server components, which is not the component model in use here.

**Fix:** Remove the `'use client';` line. This is the only file in scope that carries it, suggesting it was cargo-culted from a shadcn/ui Next.js template snippet.

---

## Info

### IN-01: `window.prompt` used for "Add field mapping" input

**File:** `src/features/field-mapping/FieldMappingSection.tsx:271`

**Issue:** `handleAddRow` calls `window.prompt(t('settings.fieldMapping.addRowPrompt'))` to collect the source field ID. The in-code comment acknowledges this as a "minimalist approach" and flags it for a future combobox replacement. While not a correctness bug, `window.prompt` blocks the UI thread, does not respect the app's theme, and is not keyboard-navigable. On some platforms (e.g., macOS Tauri webview), native dialogs may not behave consistently with the app window.

**Fix:** Replace with an inline input or a modal dialog using the existing `VirtualizedCombobox` over `sourceFields`, as the comment itself suggests.

---

### IN-02: `console.error` calls left in production code paths

**Files:**
- `src/features/field-mapping/FieldMappingSection.tsx:199`
- `src/features/connections/SettingsPage.tsx:1303, 1307, 1355, 1368`

**Issue:** Five `console.error` calls are present in production code paths. While useful during development, they leak internal error details into the browser/webview console in production builds and are not surfaced to the user in any meaningful way. Notably, `SettingsPage.tsx:1355` chains `.catch(console.error)` directly, meaning any error object from `get_notification_prefs` is logged without any contextual label.

**Fix:** Either remove the console calls or replace them with a project-consistent error reporting mechanism. For user-impacting failures (poll frequency, notification prefs), show a toast error consistent with how the field-mapping errors are handled.

---

### IN-03: `FieldMappingSection.test.tsx` EDIT-02 suggestion test does not assert suggestion content — only panel presence

**File:** `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx:139-157`

**Issue:** The `[EDIT-02]` test seeds the schema cache with empty source fields (via `seedStores()`), then overrides `invoke('discover_source_fields')` to return two fields. It asserts that `suggestions-panel` is present in the DOM. However, the `schemaCacheStore.loadSchema` call during mount will call `discover_source_fields` and update the cache, but the test does not assert which suggestions were computed or that the correct source-to-target pairings appear in the panel. It is also sensitive to timing: if `loadSchema` resolves after the `waitFor` timeout, the panel will not appear and the test passes vacuously (returns early after the empty mapping rows leave nothing to wait for). A stronger assertion would verify specific source → target text in the panel.

**Fix:** After asserting `suggestions-panel` is present, add assertions for the expected source field IDs and target field names visible in the panel, and ensure the test explicitly waits for the schema load side-effect, not just the panel's presence.

---

_Reviewed: 2026-04-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
