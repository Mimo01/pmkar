---
phase: 20-renderer-registry-field-type-aware-controls
plan: "02"
subsystem: field-renderers
tags: [react-19, cmdk, tanstack-virtual, virtualization, combobox, tdd]
dependency_graph:
  requires: [20-01]
  provides: [VirtualizedCombobox]
  affects: [20-04, 20-05]
tech_stack:
  added:
    - cmdk@^1.1.1 (combobox primitive with shouldFilter, Command.Input, Command.List, Command.Empty, Command.Item)
    - "@tanstack/react-virtual@^3.13.24 (useVirtualizer with useFlushSync: false for React 19)"
  patterns:
    - Generic TypeScript component (VirtualizedCombobox<T>) with two modes: sync filterFn and async onSearch
    - useVirtualizer fixed-height pattern (estimateSize: () => 36, no measureElement)
    - mousedown outside-click pattern from TicketFilterBar
    - jsdom layout mock (offsetHeight + clientHeight = 280px) to enable useVirtualizer in tests
key_files:
  created:
    - src/features/field-renderers/components/VirtualizedCombobox.tsx
    - (updated) src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx
  modified: []
decisions:
  - Used CSS-positioned absolute div for popover (no @radix-ui/react-popover) per Open Question 1 resolution in RESEARCH.md
  - jsdom layout mock (offsetHeight/clientHeight = 280px on HTMLElement.prototype) added to test file to enable useVirtualizer to compute getVirtualItems()
  - ResizeObserver globally stubbed in test file (cmdk requires it, jsdom omits it)
  - ariaLabel prop defaults to triggerLabel when not explicitly provided (accessibility improvement over plan spec)
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-28"
  tasks_completed: 2
  files_created: 2
---

# Phase 20 Plan 02: VirtualizedCombobox<T> Base Component Summary

Generic cmdk + @tanstack/react-virtual combobox base mitigating all four documented pitfalls (shouldFilter=false, useFlushSync=false, fixed 36px estimateSize, explicit scroll container height) with 10 passing unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement VirtualizedCombobox.tsx | 191e2eb | src/features/field-renderers/components/VirtualizedCombobox.tsx |
| 2 | Replace test stubs with real assertions | 8822063 | src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx |

## Exported Interface

```typescript
export interface VirtualizedComboboxProps<T> {
  items: T[];
  value: T | null;
  onChange: (selected: T) => void;
  displayLabel: (item: T) => string;
  filterFn: (item: T, query: string) => boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  onSearch?: (q: string) => Promise<T[]>;
  initialQuery?: string;
  renderItem?: (item: T) => React.ReactNode;
  loading?: boolean;
  ariaLabel?: string;
}

export function VirtualizedCombobox<T>(props: VirtualizedComboboxProps<T>): JSX.Element;
```

## Pitfall Mitigations (All Four Confirmed)

| Pitfall | Mitigation | Location | Grep Match |
|---------|------------|----------|-----------|
| 1: cmdk auto-filter breaks virtualization | `shouldFilter={false}` on `<Command>` | Line 124 | `grep "shouldFilter={false}"` = 2 |
| 2: React 19 flushSync warning | `useFlushSync: false` in useVirtualizer options | Line 67 | `grep "useFlushSync: false"` = 2 |
| 3: Fixed row height must match rendered height | `estimateSize: () => 36` + `h-9` class on Command.Item | Line 65 | `grep "estimateSize: () => 36"` = 1 |
| 4: Scroll container needs explicit height | Inline `style={{ height: ..., overflow: 'auto' }}` on scrollRef div | Line 136 | `style={{ height: \`${...}px\` ` = 1 |

## Test Coverage

**10 tests passing, 0 skipped, 0 todo, 13 `expect()` assertions:**

| Test | Behavior | Result |
|------|----------|--------|
| 1 | Trigger shows placeholder when value=null | PASS |
| 2 | Trigger shows displayLabel(value) when value set | PASS |
| 3 | Click trigger opens popover (Command.Input visible) | PASS |
| 4 | Typing in input filters via filterFn (sync mode) | PASS |
| 5 | Clicking option calls onChange(item) | PASS |
| 6 | Empty filter shows "No results found." (or i18n key) | PASS |
| 7 | Mousedown outside closes popover | PASS |
| 8 | Query change calls onSearch debounced 300ms | PASS |
| 9 | initialQuery triggers onSearch on mount (D-03) | PASS |
| 10 | disabled prop disables trigger button | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] jsdom layout mock for useVirtualizer**
- **Found during:** Task 2 test execution
- **Issue:** `@tanstack/react-virtual` uses `offsetHeight` and `clientHeight` of the scroll container to compute visible rows. jsdom returns 0 for all layout properties, causing `getVirtualItems()` to return empty and items to not render in tests.
- **Fix:** Added `Object.defineProperty(HTMLElement.prototype, 'offsetHeight', ...)` and `clientHeight` mock (280px) at module level in the test file. Also added `getBoundingClientRect` spy.
- **Files modified:** `src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx`
- **Commit:** 8822063

**2. [Rule 3 - Blocking Issue] ResizeObserver mock for cmdk**
- **Found during:** Task 2 first test run
- **Issue:** cmdk uses `ResizeObserver` internally (to track list container size). jsdom v20+ does not implement `ResizeObserver`, throwing `ReferenceError: ResizeObserver is not defined` and failing all tests that open the popover.
- **Fix:** Added `vi.stubGlobal('ResizeObserver', MockResizeObserver)` at module level in the test file with a no-op mock class.
- **Files modified:** `src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx`
- **Commit:** 8822063

**3. [Rule 2 - Missing Critical Functionality] ariaLabel defaults to triggerLabel**
- **Found during:** Task 1 implementation review
- **Issue:** Plan spec shows `aria-label={ariaLabel}` but the trigger button text is in a `<span>` child, not the button's direct text content. Without an aria-label, the button accessibility name comes from the icon SVG labels. This would make `getByRole('button', { name: /pick fruit/i })` fail because the accessible name would be derived from SVG aria-hidden elements.
- **Fix:** Changed `aria-label={ariaLabel}` to `aria-label={ariaLabel ?? triggerLabel}` so the trigger always has a computed accessible name even when `ariaLabel` is not explicitly provided.
- **Files modified:** `src/features/field-renderers/components/VirtualizedCombobox.tsx`
- **Commit:** 191e2eb

## Known Stubs

None. The component is fully implemented with both sync and async modes wired. No placeholder data flows to UI rendering.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model (T-20-03 through T-20-06). Confirmed:
- No `dangerouslySetInnerHTML` in component
- All string renders via React JSX (auto-escaped)
- No `console.log` of onSearch query params
- No Tauri invoke calls

## Self-Check: PASSED

- [x] `src/features/field-renderers/components/VirtualizedCombobox.tsx` exists
- [x] `src/features/field-renderers/__tests__/VirtualizedCombobox.test.tsx` exists
- [x] Commit `191e2eb` exists (Task 1)
- [x] Commit `8822063` exists (Task 2)
- [x] `grep "shouldFilter={false}"` = 2 matches
- [x] `grep "useFlushSync: false"` = 2 matches
- [x] `grep "estimateSize: () => 36"` = 1 match
- [x] `grep "export function VirtualizedCombobox"` = 1 match
- [x] `grep "export default"` = 0 matches
- [x] 10 tests passing, 0 it.todo
