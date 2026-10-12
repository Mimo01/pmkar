---
phase: 33-polish-verification
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - package.json
  - src-tauri/src/fixtures.rs
  - src-tauri/src/mock_server.rs
  - src-tauri/tests/mock_server_scenarios.rs
  - src/components/ui/AppShell.tsx
  - src/components/ui/context-menu.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/features/groups/ChangeColorPopover.tsx
  - src/features/groups/ConfirmRemovePopover.tsx
  - src/features/groups/CreateGroupPopover.tsx
  - src/features/groups/DeleteGroupDialog.tsx
  - src/features/groups/DetailGroupsRow.tsx
  - src/features/groups/GroupChip.tsx
  - src/features/groups/GroupChips.tsx
  - src/features/groups/GroupColorSwatches.tsx
  - src/features/groups/GroupNameForm.tsx
  - src/features/groups/GroupPicker.tsx
  - src/features/groups/GroupTab.tsx
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/RenameGroupPopover.tsx
  - src/features/groups/SelectionBar.tsx
  - src/features/groups/useListSelection.ts
  - src/features/tickets/TicketCard.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/index.css
  - src/test-setup.ts
  - src/test-utils/contrast.ts
  - src/vitest-axe.d.ts
  - src/i18n/__tests__/noLiteralStrings.test.ts
  - src/i18n/__tests__/groupLocale.test.ts
  - src/features/groups/__tests__/a11y.axe.test.tsx
  - src/features/groups/__tests__/a11y.keyboard.test.tsx
  - src/features/groups/__tests__/contrast.test.ts
  - src/features/groups/__tests__/groupTokenUsage.test.ts
  - src/features/groups/__tests__/groupScale.test.tsx
  - src/features/groups/__tests__/GroupTabStrip.test.tsx
  - src/features/groups/__tests__/useListSelection.test.tsx
  - src/components/ui/__tests__/AppShell.navKeys.test.tsx
  - src/components/ui/__tests__/menu-wrappers.test.tsx
  - src/features/tickets/__tests__/TicketCard.test.tsx
findings:
  critical: 1
  warning: 4
  info: 6
  total: 11
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-10-12
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

Phase 33 is mostly mechanical polish: contrast token swaps, popover aria-labels, i18n quote and plural fixes, nav arrow-key focus, mock-server scenarios, plus a large set of new a11y and static-guard tests. Most of the token and label changes are correct. The real defects are in the new behaviour this phase added:

- The fallback in `GroupTabStrip.updateOverflow` that moves focus off a disappearing scroll arrow scrolls the strip back to the active tab. Keyboard users who press the right arrow to reach the end of the strip get snapped back.
- The contrast decision for dimmed "missing" cards accepts about 3.4:1 for 12px issue keys. That fails WCAG 1.4.3, in a phase whose goal is WCAG compliance.
- The `useListSelection` text-field guard is broader than its comment says, and the key-search field it refers to has no Escape handling.
- The `readVar` contrast helper is not anchored, so it can read the wrong CSS variable.

## Critical Issues

### CR-01: Focus fallback undoes the scroll that triggered it

**File:** `src/features/groups/GroupTabStrip.tsx:99-108`
**Issue:** When the focused scroll arrow is about to disappear (`!next.canScrollRight` / `!next.canScrollLeft`), the code calls `tabRefs.current.get(id)?.focus()` or `focusCoreTab(...)` (which calls `el.focus()` in `groupTabs.ts:14`). Neither passes `preventScroll`. Focusing an element scrolls it into view inside its scroll container. Example: a keyboard user activates "Scroll tabs right" until the strip reaches its end, while the active tab sits off-screen on the left. Focus then jumps to the active tab, and the browser scrolls the scroller back to show it. That brings the right arrow back and hides the tabs the user just scrolled to. So the arrow cannot reveal the end of the strip for a keyboard user whenever the active tab is far away. The new tests (`GroupTabStrip.test.tsx`, "moves focus to the active group tab when the focused arrow disappears") check only `toHaveFocus` and never assert `scrollLeft`, so jsdom hides the bug.
**Fix:** Move focus without scrolling. Better still, move focus to the opposite arrow or to the last/first visible tab, which is where the user's attention is:
```tsx
const target =
  id !== null
    ? tabRefs.current.get(id)
    : document.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
target?.focus({ preventScroll: true });
```
Also add a test that asserts `scroller.scrollLeft` is unchanged after the fallback fires (stub `HTMLElement.prototype.focus` to record the options it receives).

## Warnings

### WR-01: ResizeObserver callback reads a stale `activeTab`

**File:** `src/features/groups/GroupTabStrip.tsx:115-123`
**Issue:** The `ResizeObserver` is created in a `useLayoutEffect` with deps `[groups]`, so it captures the `updateOverflow` closure (and its `activeTab`) from that render. Since this phase, `updateOverflow` also moves focus based on `activeTab`. If the user switches tabs without `groups` changing and then resizes the window while a scroll arrow is focused, focus goes to the previously active tab.
**Fix:** Keep `activeTab` in a ref (`activeTabRef.current = activeTab` on each render) and read it from the ref inside `updateOverflow`. Alternatively, have the observer call through a ref to the latest `updateOverflow`.

### WR-02: Dimmed issue keys and metadata fail WCAG 1.4.3 AA

**File:** `src/features/tickets/TicketCard.tsx:51-53, 81-83, 112-114`; `src/features/groups/__tests__/contrast.test.ts:13, 82-93`
**Issue:** On missing cards, the issue key (`text-xs font-mono`) and the date/meta row use `text-brand-text-secondary` at `opacity-70`. Composited contrast is about 3.42:1 on surface and 3.28:1 on `brand-bg` in light mode, and about 3.42:1 in dark mode. For 12px non-bold text, AA requires 4.5:1. The contrast test hard-codes a 3:1 "legibility floor" and calls the content "decorative de-emphasis". The issue key is the primary identifier of the row and is not decorative, and WCAG has no exemption for de-emphasised content. The test therefore locks in a non-compliant state while the phase claims GQA compliance.
**Fix:** Dim with a token instead of opacity. Use `text-brand-text-secondary` undimmed for the key and meta, and dim only the summary, which uses `brand-text` and stays at 4.5:1 or more at 0.7. Alternatively, raise the opacity to the value that keeps secondary text at 4.5:1 or more. Then change the test assertion to `toBeGreaterThanOrEqual(4.5)`.

### WR-03: `useListSelection` text-field guard is broader than intended

**File:** `src/features/groups/useListSelection.ts:105-112`
**Issue:** The guard returns early for any key from any `INPUT`. That includes `type="checkbox"`, `type="radio"` and other non-text inputs, which do nothing with Escape. Escape on a focused checkbox or radio inside a list page therefore no longer exits select mode. The comment says the guard is about text fields, but the code does not check input types. The guard also runs before the `e.key === 'Escape'` check, so any key handling added to this function later will be silently skipped for every input.
**Fix:**
```ts
if (e.key !== 'Escape' || e.defaultPrevented || !selectMode) return;
const t = e.target as HTMLElement | null;
const isTextField =
  t instanceof HTMLTextAreaElement ||
  t?.isContentEditable ||
  (t instanceof HTMLInputElement &&
    !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(t.type));
if (isTextField) return;
```

### WR-04: `readVar` regex is unanchored and can match a suffixed variable

**File:** `src/test-utils/contrast.ts:25-29`
**Issue:** `new RegExp(\`${name}:\\s*(#…)\`)` has no left boundary. `readVar(block, '--color-ring')` matches inside `--color-focus-ring: #…;`. Today it reads the correct value only because, in `body.dark`, `--color-ring` happens to be declared before `--color-focus-ring`. In `@theme`, `--color-ring` is `var(--color-brand)`, not hex, so a light-theme lookup would silently return `--color-focus-ring`'s value. Reordering declarations would make the contrast tests check the wrong token and still pass.
**Fix:** Anchor the match to a declaration start and escape the name:
```ts
const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const m = new RegExp(`(?:^|[\\s;{])${esc}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`, 'm').exec(block);
```

## Info

### IN-01: Comment claims the key-search field handles Escape, but it does not

**File:** `src/features/groups/useListSelection.ts:105`; `src/features/tickets/TicketFilterBar.tsx:145-152`
**Issue:** The comment says "Esc inside a text field belongs to that field (clear/dismiss)". The key-search `<input>` in `TicketFilterBar` has no Escape handler, so Escape there now does nothing at all. Before this change it exited select mode.
**Fix:** Add `onKeyDown` with Escape-to-clear on the key-search input (call `preventDefault`), or reword the comment.

### IN-02: SK `_many` change contradicts CLDR

**File:** `src/i18n/locales/sk.json:499, 535, 562, 568, ...`; `src/i18n/__tests__/groupLocale.test.ts:43-50`
**Issue:** In CLDR, Slovak `many` is the category for non-integer numbers (e.g. "1,5 úlohy", genitive singular). The previous `_many` = `_few` values were grammatically correct for that case. The new rule `_many === _other` ("úloh") is wrong for decimals. Counts are always integers here, so this is unreachable today, but the test now enforces the incorrect form.
**Fix:** Accept as-is with a comment noting that `_many` is unreachable for integer counts, or revert to the genitive singular and drop the `_many === _other` assertion.

### IN-03: Truncated scenario adds filler to every search, ignoring JQL

**File:** `src-tauri/src/mock_server.rs:317-347`
**Issue:** The 1000 filler issues (`assignee: null`) are appended after `filter_issues`, so they show up in every v2 search, including assignee-filtered "mine" queries. That suits the truncation test but pollutes any other list that runs during manual UAT with this scenario. Their order (real issues first, then FILL-n) also differs from the key-sorted order used elsewhere.
**Fix:** Document this in the scenario doc comment, or apply filler only when the JQL matches a configured assignee, as `PartialFail` does.

### IN-04: `__mock/mutate` always sets status category to `indeterminate`

**File:** `src-tauri/src/mock_server.rs:972-975`
**Issue:** Mutating status to "Done" yields `statusCategory.key = "indeterminate"`, so done-state UI (badges, filters) cannot be reproduced through this endpoint.
**Fix:** Accept an optional `status_category` in `MutateBody`, or map well-known names ("Done", "To Do") to `done`/`new`.

### IN-05: Scenario env var leaks into every `build_fixtures()` test

**File:** `src-tauri/src/fixtures.rs:3171`
**Issue:** `build_fixtures()` reads `PMKAR_MOCK_SCENARIO` on every call. A developer who exports `PMKAR_MOCK_SCENARIO=drop` (or `truncated`) for manual UAT and then runs `cargo test --features mock-server` gets unrelated mock-server tests failing in confusing ways. Only `mock_server_scenarios.rs` overrides the scenario explicitly.
**Fix:** Read the env var only in the binary's mock-server startup path, not in `build_fixtures()`, or default to `MockScenario::Default` under `#[cfg(test)]`.

### IN-06: Redundant code in tests and nav handler

**File:** `src/features/groups/__tests__/contrast.test.ts:57-61`; `src/components/ui/AppShell.tsx:50-51`
**Issue:** The "unchecked checkbox boundary >= 3" test checks the same pair that the preceding ">= 4.5" test already covers, so it can never fail on its own. In `handleNavKeyDown`, `focus()` already scrolls the target into view, which makes the follow-up `scrollIntoView` call redundant.
**Fix:** Drop the duplicate test, or point it at the actual checkbox border token. Use `focus({ preventScroll: true })` followed by `scrollIntoView({ inline: 'nearest' })` if the explicit scroll is intended.

---

_Reviewed: 2026-10-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
