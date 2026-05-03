---
phase: 20-renderer-registry-field-type-aware-controls
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/features/field-renderers/types.ts
  - src/features/field-renderers/registry.ts
  - src/features/field-renderers/DynamicTargetForm.tsx
  - src/features/field-renderers/components/VirtualizedCombobox.tsx
  - src/features/field-renderers/renderers/StringRenderer.tsx
  - src/features/field-renderers/renderers/TextAreaRenderer.tsx
  - src/features/field-renderers/renderers/UrlRenderer.tsx
  - src/features/field-renderers/renderers/DateRenderer.tsx
  - src/features/field-renderers/renderers/DateTimeRenderer.tsx
  - src/features/field-renderers/renderers/NumberRenderer.tsx
  - src/features/field-renderers/renderers/CheckboxRenderer.tsx
  - src/features/field-renderers/renderers/RadioRenderer.tsx
  - src/features/field-renderers/renderers/UnsupportedTypeRenderer.tsx
  - src/features/field-renderers/renderers/UserPickerRenderer.tsx
  - src/features/field-renderers/renderers/MultiUserPickerRenderer.tsx
  - src/features/field-renderers/renderers/GroupPickerRenderer.tsx
  - src/features/field-renderers/renderers/SingleSelectRenderer.tsx
  - src/features/field-renderers/renderers/MultiSelectRenderer.tsx
  - src/features/field-renderers/renderers/LabelsRenderer.tsx
  - src/features/field-renderers/renderers/ComponentPickerRenderer.tsx
  - src/features/field-renderers/renderers/VersionPickerRenderer.tsx
  - src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx
  - src/features/field-renderers/__tests__/registry.test.ts
  - src/features/field-renderers/__tests__/DynamicTargetForm.test.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - package.json
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

The renderer registry, all 16 renderer components, `DynamicTargetForm`, `VirtualizedCombobox`, tests, and i18n files were reviewed. The overall architecture is sound: the discriminated-union registry, the controlled-input pattern, and the D-01/D-05 wiring conventions are well-executed. No security vulnerabilities or data-loss risks were found.

Seven warnings were identified. Three are correctness issues that will surface as bugs: a `React.ReactNode` type reference with no namespace import, a semantic value-shape inconsistency between the Radio/Checkbox and Select renderer families, and an async search race condition that can display wrong results. The remaining four warnings cover missing accessibility wiring and a missing `disabled` pass-through that Phase 22 will need. Five info items cover dead code, unused i18n keys, and a filterFn reference-stability gap.

---

## Warnings

### WR-01: `React.ReactNode` used without importing the `React` namespace

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:20`
**Issue:** The `renderItem` prop is typed as `(item: T) => React.ReactNode`. The file imports named hooks from `'react'` but never imports the `React` namespace (`import React from 'react'` or `import type { ReactNode } from 'react'`). With `"jsx": "react-jsx"` the runtime is auto-injected, but the `React` namespace type is still not in scope at the type level. This causes a TypeScript error (`'React' refers to a UMD global`) at strict type-check time and will fail `tsc` in CI.

**Fix:**
```tsx
// Option A — add a type-only namespace import
import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';

// Option B — inline the ReactNode import and update the prop type
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
// then on line 20:
  renderItem?: (item: T) => ReactNode;
```

---

### WR-02: Async search race condition — out-of-order responses corrupt displayed results

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:107-111`
**Issue:** Each keystroke after the 300 ms debounce fires an independent `onSearch` promise. If the network response for an earlier, slower query arrives after a later, faster query has already populated `asyncItems`, the earlier result overwrites the correct one. The component has no per-request sequence counter, cancellation token, or AbortController to discard stale responses.

**Fix:** Track an incrementing request ID and only commit the result when the response belongs to the most-recent request:
```tsx
const latestReqRef = useRef(0);

debounceRef.current = setTimeout(() => {
  const reqId = ++latestReqRef.current;
  onSearch(next.trim())
    .then((result) => {
      if (reqId === latestReqRef.current) setAsyncItems(result);
    })
    .catch(() => {
      if (reqId === latestReqRef.current) setAsyncItems([]);
    });
}, 300);
```

---

### WR-03: `isOption` type guard accepts any object — includes arrays and arbitrary shapes

**File:** `src/features/field-renderers/renderers/SingleSelectRenderer.tsx:11-13` and `src/features/field-renderers/renderers/MultiSelectRenderer.tsx:13-15`
**Issue:** `isOption` returns `true` for any truthy non-null object, including arrays, `JiraUser` objects, `Date` instances, etc. When `field.allowedValues` contains unexpected shapes (or when `value` is an array of objects from a different field type), the guard silently passes them through as `OptionRef`. `optLabel` then returns `''` for objects that lack `value`/`name`/`id`, producing invisible blank options that can be selected.

**Fix:** Require at least one identifying string property:
```tsx
function isOption(v: unknown): v is OptionRef {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.value === 'string' ||
    typeof o.name === 'string' ||
    typeof o.id === 'string'
  );
}
```

---

### WR-04: Radio/Checkbox renderers emit strings; Select renderers emit objects — inconsistent value contract for the same Jira schema types

**File:** `src/features/field-renderers/renderers/RadioRenderer.tsx:43`, `src/features/field-renderers/renderers/CheckboxRenderer.tsx:25-28`
**Issue:** `RadioRenderer` calls `onChange(optLabel)` (a `string`). `CheckboxRenderer` calls `onChange([...selected, optLabel])` (a `string[]`). However, `SingleSelectRenderer` calls `onChange(o)` (an `OptionRef` object) and `MultiSelectRenderer` calls `onChange([...selected, o])` (an `OptionRef[]`). Both routing paths can be reached from the same Jira schema types (`type: 'option'` and `type: 'array', items: 'option'`) — they are only discriminated by `schema.custom`. Phase 22 will receive either a string or an object depending on how the custom field marker was configured, and has no way to know which shape to expect without re-inspecting `schema.custom` itself.

**Fix:** Unify the emitted value shape. RadioRenderer should emit the full option object so that Phase 22 receives a consistent `OptionRef | null` for single-select and `OptionRef[]` for multi-select regardless of routing:
```tsx
// RadioRenderer.tsx — emit the full option object
onChange(() => {
  const match = allowed.find((o) => getOptionLabel(o) === optLabel);
  onChange(match ?? optLabel);   // fallback to string only if no object found
}}
```
A simpler alternative is to document the contract explicitly in `RendererProps` and have Phase 22 accept both shapes, but that pushes complexity downstream.

---

### WR-05: `DynamicTargetForm` label's `htmlFor` is dangling for all VirtualizedCombobox-based renderers

**File:** `src/features/field-renderers/DynamicTargetForm.tsx:31`
**Issue:** The `<label htmlFor={field.fieldId}>` requires an element with `id={field.fieldId}` to exist in the subtree. Simple inputs (String, TextArea, URL, Date, DateTime, Number) set `id={field.fieldId}` correctly. But `VirtualizedCombobox` has no `id` prop and its trigger `<Button>` never receives `id={field.fieldId}`. This means the `<label>` is disconnected from its control for every picker renderer (UserPicker, MultiUserPicker, GroupPicker, SingleSelect, MultiSelect, ComponentPicker, VersionPicker). Clicking the label does not focus or activate the combobox trigger. Screen readers announce the label as an orphan.

**Fix:** Add an `id` prop to `VirtualizedComboboxProps` and apply it to the trigger `<Button>`:
```tsx
// VirtualizedComboboxProps
id?: string;

// Button in VirtualizedCombobox
<Button id={id} ref={triggerRef} ... >
```
Then pass `id={field.fieldId}` from each picker renderer:
```tsx
<VirtualizedCombobox<JiraUser>
  id={field.fieldId}
  ...
/>
```

---

### WR-06: `LabelsRenderer` free-text input has no `id={field.fieldId}` — `htmlFor` is dangling

**File:** `src/features/field-renderers/renderers/LabelsRenderer.tsx:51-65`
**Issue:** Similar to WR-05 but specific to `LabelsRenderer`. The free-text `<input>` has `aria-label` but no `id`. The parent label in `DynamicTargetForm` sets `htmlFor={field.fieldId}`, which targets nothing. The `<input>` would also benefit from `id={field.fieldId}` for click-to-focus behavior.

**Fix:**
```tsx
<input
  id={field.fieldId}
  type="text"
  ...
/>
```

---

### WR-07: `DynamicTargetFormProps` has no top-level `disabled` prop — Phase 22 cannot lock the form during submission

**File:** `src/features/field-renderers/DynamicTargetForm.tsx:5-10`
**Issue:** Every renderer accepts a `disabled` prop but `DynamicTargetForm` has no mechanism to pass it. Phase 22 needs to freeze the entire form while a ticket copy is in flight. Without this prop, Phase 22 must either reach into the form state directly (coupling), or each renderer must independently watch a context value (not established). The absence creates an API gap that will require a breaking change to `DynamicTargetFormProps` when Phase 22 wires submission.

**Fix:**
```tsx
export interface DynamicTargetFormProps {
  fields: FieldSchema[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, v: unknown) => void;
  searchCallbacks?: SearchCallbacks;
  disabled?: boolean;   // propagated to every Renderer
}

// In the render:
<Renderer
  field={field}
  value={values[field.fieldId]}
  onChange={(v) => onChange(field.fieldId, v)}
  required={field.required}
  disabled={disabled}
  onSearch={isUserPicker ? searchCallbacks?.onSearchUsers : undefined}
/>
```

---

## Info

### IN-01: `loading` prop in `VirtualizedCombobox` is dead — never passed by any renderer

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:21` and `src/features/field-renderers/components/VirtualizedCombobox.tsx:132-136`
**Issue:** The `loading` prop controls whether a `Loader2` spinner replaces the `ChevronDown` chevron. No renderer currently passes `loading`, so the spinner path (`line 132-134`) is unreachable dead code.
**Fix:** Either wire `loading` from renderers (e.g., while `onSearch` is in-flight) or remove the prop and the conditional until it is needed.

---

### IN-02: `SearchCallbacks.onFetchComponents` and `onFetchVersions` are defined but never routed

**File:** `src/features/field-renderers/types.ts:28-32`, `src/features/field-renderers/DynamicTargetForm.tsx:23-26`
**Issue:** `SearchCallbacks` declares `onFetchComponents` and `onFetchVersions`, but `DynamicTargetForm` only routes `onSearchUsers`. `ComponentPickerRenderer` and `VersionPickerRenderer` currently use static `field.allowedValues` only. If these callbacks are intended for Phase 22, they are dead interface surface that misleads callers. If they are future-facing, a TODO comment should note when they will be wired.
**Fix:** Remove the two callbacks from `SearchCallbacks` now and re-add them in Phase 22, or add a `// TODO(phase-22): route to ComponentPickerRenderer / VersionPickerRenderer` comment to explain the gap.

---

### IN-03: `fieldRenderer.required` i18n key is defined in both locale files but never consumed

**File:** `src/i18n/locales/en.json:332`, `src/i18n/locales/sk.json:332`
**Issue:** Both locale files include `"fieldRenderer.required": " *"`. The required asterisk in `DynamicTargetForm` is a hardcoded `{' *'}` string literal (line 37), not a `t('fieldRenderer.required')` call. The key is dead.
**Fix:** Either replace the hardcoded literal with `t('fieldRenderer.required')` or remove the key from both locale files.

---

### IN-04: `UnsupportedTypeRenderer` `aria-label` is hardcoded English and not i18n'd

**File:** `src/features/field-renderers/renderers/UnsupportedTypeRenderer.tsx:14`
**Issue:** The visible `<span>` text uses `t('fieldRenderer.unsupportedType', ...)` correctly. The `aria-label` attribute is a hardcoded `\`Unsupported field type: ${typeStr}\`` template literal that is not translated. Screen readers in Slovak locale will announce English text.
**Fix:**
```tsx
aria-label={t('fieldRenderer.unsupportedType', { type: typeStr })}
```

---

### IN-05: `filterFn` prop creates a new function reference on every render, defeating `useMemo` in `VirtualizedCombobox`

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:50-58`, multiple renderers
**Issue:** All callers declare `filterFn` as an inline arrow function (e.g. `filterFn={(o, q) => optLabel(o).toLowerCase().includes(q.toLowerCase())}`). Because no renderer uses `useCallback`, a new function reference is produced on every render. `useMemo` in `VirtualizedCombobox` lists `filterFn` as a dependency, so the filtered list is recomputed on every render of the caller — negating the memo.
**Fix:** Declare `filterFn` with `useCallback` in callers that change often, or remove it from the `useMemo` dependency array if the function is stable in practice (add an eslint-disable comment with rationale). For renderers where `filterFn` is truly stable (pure function of fixed closure), `useCallback` with an empty dep array is sufficient.

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
