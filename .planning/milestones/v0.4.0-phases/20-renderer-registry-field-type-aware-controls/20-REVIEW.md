---
phase: 20-renderer-registry-field-type-aware-controls
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - src/features/field-renderers/types.ts
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
  - src/features/field-renderers/registry.ts
  - src/features/field-renderers/DynamicTargetForm.tsx
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
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 2
  warning: 9
  info: 5
  total: 16
status: issues_found
---

# Phase 20: Code Review Report (Supersedes 2026-04-28 review)

**Reviewed:** 2026-05-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

This review covers the full Phase 20 file set including 13 per-renderer test files added since the prior pass (2026-04-28). The renderer architecture is sound: single-dispatch registry, controlled inputs, CTRL-06 checkbox/radio routing via schema.custom, and graceful degradation on missing callbacks. The i18n coverage is complete with parity between en.json and sk.json for all fieldRenderer keys.

Two blockers were found. First, `CheckboxRenderer` and `RadioRenderer` emit raw display-label strings while all Select-family renderers emit structured option objects, producing an inconsistent value contract for the same Jira schema types — Phase 22 will receive either shape depending on schema.custom with no way to distinguish. Second, `DynamicTargetForm` has no `disabled` prop and never passes `disabled` to renderers; any Phase 22 form-freezing during submission is silently non-functional.

Nine warnings were carried forward or newly identified: a `React.ReactNode` namespace reference without an import (tsc failure), an async search race condition, an over-broad `isOption` type guard, a dangling `htmlFor` for all combobox-based renderers, a dangling `htmlFor` for `LabelsRenderer`, a stale `initialQuery` effect that re-fires on every `onSearch` reference change, `optKey` returning empty string breaking deduplication, a misleading `isEditableSchemaType` docstring, and the async search race condition also applies to the `initialQuery` auto-trigger path. Five info items cover dead code, an orphan i18n key, a copy-paste test scaffold, an English-only aria-label, and an unmount-time debounce leak.

---

## Critical Issues

### CR-01: `CheckboxRenderer` and `RadioRenderer` emit strings; Select-family renderers emit objects — inconsistent value contract for identical Jira schema types

**Files:** `src/features/field-renderers/renderers/RadioRenderer.tsx:47`, `src/features/field-renderers/renderers/CheckboxRenderer.tsx:25-29`

**Issue:** `RadioRenderer` calls `onChange(optLabel)` (a plain string). `CheckboxRenderer` appends `optLabel` (a plain string) to the selected array. Both `type: 'option'` and `type: 'array', items: 'option'` fields can be routed to either the checkbox/radio renderers or the select renderers depending on `schema.custom`. `SingleSelectRenderer` emits the full `OptionRef` object; `MultiSelectRenderer` emits `OptionRef[]`. Phase 22 receives either a string or an object for the same Jira field type depending solely on a custom field marker it has already consumed at the routing layer, with no signal in the value itself about which shape it is.

Beyond the inconsistency, Jira's REST API for custom option fields typically requires `{ "id": "..." }` objects — not bare label strings — to match an option when writing back. Submitting a string will likely result in a Jira API validation error at submission time.

**Fix for `RadioRenderer`:** Emit the full option object instead of its label string:
```tsx
// Instead of: onChange(() => onChange(optLabel))
onChange={() => onChange(opt)}  // emit the original allowedValue object

// Update checked comparison to match by reconstructed label:
checked={getOptionLabel(value) === optLabel}
```

**Fix for `CheckboxRenderer`:** Store and emit the original option objects:
```tsx
// selected must hold original objects, not strings:
const selected = Array.isArray(value) ? value : [];

function toggle(opt: unknown, optLabel: string, isOn: boolean) {
  if (isOn) {
    onChange([...selected, opt]);
  } else {
    onChange((selected as unknown[]).filter((v) => getOptionLabel(v) !== optLabel));
  }
}

// In the map:
const checked = (selected as unknown[]).some((v) => getOptionLabel(v) === optLabel);
onChange={(e) => toggle(opt, optLabel, e.target.checked)}
```

---

### CR-02: `DynamicTargetForm` has no `disabled` prop and never passes `disabled` to renderers

**File:** `src/features/field-renderers/DynamicTargetForm.tsx:6-56`

**Issue:** `DynamicTargetFormProps` does not include a `disabled` field. The `<Renderer>` invocation at lines 49-56 passes `field`, `value`, `onChange`, `required`, `onSearch`, and `initialQuery` — but not `disabled`. Every renderer accepts `disabled?: boolean` via `RendererProps`, but there is no path by which a form-level consumer can disable all fields. Phase 22 needs this to freeze inputs during submission (while the copy is in flight). Without it, all inputs remain interactive regardless of caller intent.

**Fix:**
```tsx
export interface DynamicTargetFormProps {
  fields: FieldSchema[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, v: unknown) => void;
  searchCallbacks?: SearchCallbacks;
  initialQueries?: Record<string, string>;
  onMapLink?: () => void;
  disabled?: boolean;   // add
}

export function DynamicTargetForm({
  // ...
  disabled,             // add
}: DynamicTargetFormProps) {
  // ...
  <Renderer
    field={field}
    value={values[field.fieldId]}
    onChange={(v) => onChange(field.fieldId, v)}
    required={field.required}
    disabled={disabled}   // add
    onSearch={isUserPicker ? searchCallbacks?.onSearchUsers : undefined}
    initialQuery={initialQueries?.[field.fieldId]}
  />
```

---

## Warnings

### WR-01: `React.ReactNode` used without importing the `React` namespace

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:20`

**Issue:** The `renderItem` prop is typed as `(item: T) => React.ReactNode`. The file imports named hooks from `'react'` but never imports the `React` namespace. With `"jsx": "react-jsx"` the JSX runtime is auto-injected, but the `React` namespace type is not in scope at the type level. This is a TypeScript error (`'React' refers to a UMD global`) that will fail `tsc --noEmit` in CI.

**Fix:**
```tsx
// Option A — type-only namespace import
import type React from 'react';

// Option B — inline ReactNode
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
// then on line 20:
  renderItem?: (item: T) => ReactNode;
```

---

### WR-02: Async search race condition — out-of-order responses overwrite correct results

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:123-128`

**Issue:** Each debounced keystroke fires an independent `onSearch` promise. If a slow response from an earlier query arrives after a faster response from a later query has already set `asyncItems`, the stale response overwrites the correct state. The component has no request-sequence guard.

**Fix:**
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

### WR-03: `isOption` type guard accepts any non-null object — includes arrays, JiraUser values, and Dates

**Files:** `src/features/field-renderers/renderers/SingleSelectRenderer.tsx:11-12`, `src/features/field-renderers/renderers/MultiSelectRenderer.tsx:13-14`

**Issue:**
```ts
function isOption(v: unknown): v is OptionRef {
  return Boolean(v && typeof v === 'object');
}
```
This passes for arrays, `JiraUser` objects, `Date` instances, and any other non-null reference. When `value` contains a `JiraUser` (which has no `value`/`name`/`id` matching the option shape), `isOption` returns `true` and `optLabel` returns `""`, producing an invisible blank item that can be selected without error. This is especially risky when the field schema changes between `user` and `option` types in the same form session.

**Fix:**
```ts
function isOption(v: unknown): v is OptionRef {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o['value'] === 'string' ||
    typeof o['name'] === 'string' ||
    typeof o['id'] === 'string'
  );
}
```

---

### WR-04: `DynamicTargetForm` label's `htmlFor` is dangling for all combobox-based renderers

**File:** `src/features/field-renderers/DynamicTargetForm.tsx:38`

**Issue:** The `<label htmlFor={field.fieldId}>` requires an element with `id={field.fieldId}` in the subtree. Simple input renderers (String, TextArea, URL, Date, DateTime, Number) correctly set `id={field.fieldId}` on their `<input>`. However, `VirtualizedCombobox` has no `id` prop and its trigger `<Button>` is never assigned `id={field.fieldId}`. The label is therefore disconnected from its control for every combobox-based renderer: UserPicker, MultiUserPicker, GroupPicker, SingleSelect, MultiSelect, ComponentPicker, VersionPicker. Clicking the label text does not activate the combobox. Screen readers announce the label as an orphan.

**Fix:** Add an `id` prop to `VirtualizedComboboxProps` and apply it to the trigger `<Button>`:
```tsx
// In VirtualizedComboboxProps:
id?: string;

// On the Button:
<Button id={id} ref={triggerRef} ...>

// In each picker renderer:
<VirtualizedCombobox<JiraUser>
  id={field.fieldId}
  ...
/>
```

---

### WR-05: `LabelsRenderer` free-text `<input>` has no `id` — `htmlFor` is dangling

**File:** `src/features/field-renderers/renderers/LabelsRenderer.tsx:54`

**Issue:** The free-text input in `LabelsRenderer` has `aria-label` but no `id` attribute. The outer `<label htmlFor={field.fieldId}>` in `DynamicTargetForm` targets nothing. Clicking the field label does not focus the input.

**Fix:**
```tsx
<input
  id={field.fieldId}
  type="text"
  value={pending}
  ...
/>
```

---

### WR-06: `initialQuery` effect re-fires on every `onSearch` reference change, not only on mount

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:105-112`

**Issue:**
```ts
useEffect(() => {
  if (initialQuery && onSearch) {
    onSearch(initialQuery)
      .then((result) => setAsyncItems(result))
      .catch(() => setAsyncItems([]));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialQuery, onSearch]); // mount only — intentional empty dep array
```
The comment says "mount only — intentional empty dep array" but the dependency array is `[initialQuery, onSearch]` — it is not empty. Whenever a parent re-renders and passes a new `onSearch` reference (which happens with every inline arrow function), the effect re-executes, firing an extra API call for the initial query. The `eslint-disable` comment suppresses the warning that would catch this. The comment and the code disagree on intent.

**Fix (run only once, re-run only if `initialQuery` changes):**
```ts
const onSearchRef = useRef(onSearch);
useEffect(() => { onSearchRef.current = onSearch; });

useEffect(() => {
  if (initialQuery && onSearchRef.current) {
    onSearchRef.current(initialQuery)
      .then((result) => setAsyncItems(result))
      .catch(() => setAsyncItems([]));
  }
}, [initialQuery]); // stable: onSearch accessed via ref
```

---

### WR-07: `optKey` / `componentKey` / `versionKey` return `""` when all identifier fields are absent — breaks deduplication and React key stability

**Files:** `src/features/field-renderers/renderers/MultiSelectRenderer.tsx:21-23`, `src/features/field-renderers/renderers/ComponentPickerRenderer.tsx:11-12`, `src/features/field-renderers/renderers/VersionPickerRenderer.tsx:11-12`

**Issue:** All three key functions fall back to `""`:
```ts
function optKey(o: OptionRef): string {
  return o.id ?? o.value ?? o.name ?? '';
}
```
If Jira returns items with no identifier fields, every such item maps to key `""`. The `selectedKeys` Set then treats all identifier-less items as a single entry, incorrectly blocking all but the first from being selected. React's `key` prop on badges also collapses, causing reconciliation errors.

**Fix:** Require at least one identifier string in `isOption` (see WR-03), which removes the source of the problem. As a defence-in-depth fallback, use index when all identifiers are absent:
```ts
const selectedKeys = new Set(selected.map((o, i) => optKey(o) || `__idx_${i}`));
```

---

### WR-08: `isEditableSchemaType` docstring falsely lists `priority`, `any`, and `option-with-child` as returning `false`

**File:** `src/features/field-renderers/registry.ts:107-108`

**Issue:** The JSDoc comment reads: "Types that fall through to UnsupportedTypeRenderer (priority, option-with-child, issuetype, any, unknown array items) return false." The actual implementation at lines 118-120 returns `true` for `option-with-child`, `any`, and `priority`. These types are correctly routed to dedicated renderers — none fall through to `UnsupportedTypeRenderer`. The comment is a leftover from an earlier design and now actively misleads developers reading the function.

**Fix:**
```ts
/**
 * Returns true when a schema type has an editable renderer in GapsSection.
 * Returns false only for types with no dedicated renderer: unknown array items
 * (e.g. items: 'issuetype') and the default branch.
 */
```

---

### WR-09: `loading` prop in `VirtualizedCombobox` is dead code — no renderer passes it

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:21`, lines 151-155

**Issue:** The `loading` prop controls a `Loader2` spinner replacing the `ChevronDown` chevron. No renderer currently passes `loading=true`, so the spinner branch is unreachable dead code. The `onSearch` in-flight state is not surfaced to callers either (no `loading` setter is exported), so the user has no visual feedback while results are being fetched.

**Fix:** Either wire `loading` from renderers by tracking async search state (e.g., expose a callback `onLoadingChange` or track in-flight state inside `VirtualizedCombobox` and apply `loading` automatically), or remove the prop and the conditional branch until it is needed.

---

## Info

### IN-01: `React.ReactNode` namespace import missing — existing finding from prior review; still present

This is the same as WR-01 above; elevated to Warning in this pass since it is a compile-time failure.

---

### IN-02: `fieldRenderer.required` i18n key is defined in both locale files but never consumed

**Files:** `src/i18n/locales/en.json:332`, `src/i18n/locales/sk.json:332`

**Issue:** Both locale files include `"fieldRenderer.required": " *"`. The required asterisk in `DynamicTargetForm` is a hardcoded `{' *'}` literal (line 43), not a `t('fieldRenderer.required')` call. The key is dead.

**Fix:** Either replace the hardcoded literal with `t('fieldRenderer.required')` or remove the key from both locale files.

---

### IN-03: `UnsupportedTypeRenderer` `aria-label` is hardcoded English and not i18n'd

**File:** `src/features/field-renderers/renderers/UnsupportedTypeRenderer.tsx:14`

**Issue:** The visible `<span>` uses `t('fieldRenderer.unsupportedType', ...)` correctly. The `aria-label` attribute is a hardcoded template literal `\`Unsupported field type: ${typeStr}\`` that is not translated. Screen readers in Slovak locale announce English text.

**Fix:**
```tsx
aria-label={t('fieldRenderer.unsupportedType', { type: typeStr })}
```

---

### IN-04: Debounce timer in `VirtualizedCombobox` not cancelled on unmount

**File:** `src/features/field-renderers/components/VirtualizedCombobox.tsx:118-127`

**Issue:** `debounceRef.current = setTimeout(...)` is set in `handleQueryChange` but no cleanup effect clears it on unmount. If the component unmounts within the 300ms debounce window, `setAsyncItems` is called on an unmounted instance. React 18 no longer warns, but the timer is a resource leak.

**Fix:**
```ts
useEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
}, []);
```

---

### IN-05: ResizeObserver mock and layout measurement overrides are copy-pasted across five test files

**Files:**
- `src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx:8-40`
- `src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx:8-38`
- `src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx:8-38`
- `src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx:8-38`
- `src/features/field-renderers/__tests__/MultiSelectRenderer.test.tsx:8-38`

**Issue:** The identical `MockResizeObserver` class, `vi.stubGlobal`, `getBoundingClientRect` spy, and `offsetHeight`/`clientHeight` property overrides appear verbatim across five test files. Any change to the virtualizer's layout requirements must be replicated across all five.

**Fix:** Extract to a shared test utility:
```ts
// src/features/field-renderers/__tests__/testUtils.ts
export function setupVirtualizerMocks() {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: 280, height: 280, left: 0, right: 300,
    top: 0, width: 300, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true, get() { return 280; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true, get() { return 280; },
  });
}
```

---

_Reviewed: 2026-05-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
