---
phase: 33-polish-verification
reviewed: 2026-10-13T00:00:00Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - src/components/ui/__tests__/AppShell.navKeys.test.tsx
  - src/components/ui/__tests__/menu-wrappers.test.tsx
  - src/components/ui/AppShell.tsx
  - src/components/ui/context-menu.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/features/groups/__tests__/a11y.axe.test.tsx
  - src/features/groups/__tests__/a11y.keyboard.test.tsx
  - src/features/groups/__tests__/colors.test.ts
  - src/features/groups/__tests__/contrast.test.ts
  - src/features/groups/__tests__/groupI18n.test.ts
  - src/features/groups/__tests__/GroupMenuItems.test.tsx
  - src/features/groups/__tests__/groupScale.test.tsx
  - src/features/groups/__tests__/groupTabs.test.ts
  - src/features/groups/__tests__/GroupTabStrip.test.tsx
  - src/features/groups/__tests__/groupTokenUsage.test.ts
  - src/features/groups/__tests__/GroupViewPage.test.tsx
  - src/features/groups/__tests__/useListSelection.test.tsx
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
  - src/features/groups/groupTabs.ts
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/RenameGroupPopover.tsx
  - src/features/groups/SelectionBar.tsx
  - src/features/groups/useListSelection.ts
  - src/features/tickets/__tests__/TicketCard.test.tsx
  - src/features/tickets/TicketCard.tsx
  - src/i18n/__tests__/groupLocale.test.ts
  - src/i18n/__tests__/noLiteralStrings.test.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/index.css
  - src/test-setup.ts
  - src/test-utils/contrast.ts
  - src/vitest-axe.d.ts
findings:
  critical: 0
  warning: 1
  info: 6
  total: 7
status: issues_found
---

# Phase 33: Code Review Report (re-review after gap closure 33-11 / 33-12)

**Reviewed:** 2026-10-13
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

This is a re-review after gap-closure plans 33-11 (dimmed-card contrast, `readVar` anchoring) and 33-12 (overflow-arrow focus handoff, stale `activeTab`, Esc guard). Since the previous review, ten source files changed (`git diff eda6d1a..HEAD`). All five earlier CR/WR items are fixed in code. Each fix has a regression test that fails against the old code. The six affected test files pass (156 tests).

I checked the composited contrast numbers independently:
- **Dimmed summary** (`brand-text` at 0.7 opacity):
  - light: 6.03 on surface, 5.63 on surface-hover
  - dark: 7.09 on surface, 6.49 on surface-hover
- **Focused destructive menu item** (`destructive-text` on `destructive/10`): 5.54 in light, 5.63 in dark.

One new Warning remains, and it comes from how CR-01 was fixed. Focus is no longer snapped back, but it now goes to a tab that may be scrolled out of view, so keyboard users cannot see where focus is. The remaining items are Info-level: test-reliability nits and carried-over items that the gap plans did not cover.

## Previous findings status

| ID | Title | Status | Evidence |
|----|-------|--------|----------|
| CR-01 | Focus fallback undoes the scroll that triggered it | **Resolved** (with follow-up WR-01 below) | `GroupTabStrip.tsx:109-110` passes `{ preventScroll: true }`; `focusCoreTab` forwards `FocusOptions` (`groupTabs.ts:11-14`); the spy-based tests at `GroupTabStrip.test.tsx:179-207` would fail on the old code |
| WR-01 | ResizeObserver callback reads a stale `activeTab` | **Resolved** | `activeTabRef` (`GroupTabStrip.tsx:85-86`) is read in `updateOverflow`; the test at `GroupTabStrip.test.tsx:213-223` exercises the captured observer callback after a rerender |
| WR-02 | Dimmed issue keys and metadata fail WCAG 1.4.3 | **Resolved** | Only the `brand-text` summary is dimmed (`TicketCard.tsx:129-134`); key, dates and assignee are undimmed (`TicketCard.tsx:85, 114, 139`); the contrast test asserts at least 4.5:1 on all three backgrounds, using the opacity read from source |
| WR-03 | `useListSelection` text-field guard too broad | **Resolved** | The Escape / defaultPrevented / selectMode check now runs first (`useListSelection.ts:116`); non-text input types are excluded (`:35-44, 119-123`); tests cover checkbox, radio, search and textarea |
| WR-04 | `readVar` regex unanchored | **Resolved** | Anchored on `(?:^|[\s;{])` with the name escaped (`contrast.ts:26-28`); four regression tests (`contrast.test.ts:94-113`) |
| IN-01 | Key-search field has no Escape handling | **Open** | `TicketFilterBar.tsx:145-152` is unchanged (carried as IN-01) |
| IN-02 | SK `_many` contradicts CLDR | **Open** | Unchanged (carried as IN-02) |
| IN-03 / IN-04 / IN-05 | Mock-server scenario items | **Not re-reviewed** | `src-tauri/*` is outside this re-review's file scope and was not touched by 33-11/33-12 |
| IN-06 | Redundant duplicate contrast test / `scrollIntoView` | **Open** | `contrast.test.ts:65-69` and `AppShell.tsx:50-51` are unchanged (carried as IN-03) |

## Warnings

### WR-01: The overflow-arrow focus handoff can leave focus on a tab that is off-screen

**File:** `src/features/groups/GroupTabStrip.tsx:101-111`
**Issue:** The CR-01 fix stops the browser from scrolling, but it still sends focus to the *active* tab. In the exact scenario CR-01 described, that tab is scrolled out of view: the active tab sits on the left and the user presses "Scroll tabs right" until the strip reaches its end. After the fix:

- Focus goes to an element the user cannot see. The focus indicator is hidden inside the `overflow-x-auto` scroller. This fails WCAG 2.4.7 (Focus Visible) and the intent of 2.4.11 (Focus Not Obscured), in a phase whose goal is GQA compliance.
- The next Tab press moves to the active tab's "More" button (`tabIndex=0`), which is also off-screen. The browser scrolls it into view, so the strip snaps back one keystroke later. The bug CR-01 reported is postponed, not fixed.

The 33-12 summary records this choice ("Focus fallback still targets the active tab but with preventScroll"). The previous review recommended moving focus to the opposite arrow or to the first/last visible tab, and that recommendation still stands.

**Fix:** Move focus to a control that is visible once the arrow disappears. When the right arrow vanishes because the strip reached its end, the left arrow is the natural target, because it just appeared. It is rendered conditionally, so focus it after the state update:
```tsx
const [arrowHandoff, setArrowHandoff] = useState<'left' | 'right' | null>(null);
// in updateOverflow, instead of focusing the active tab:
if (focused === rightArrowRef.current && !next.canScrollRight) {
  setArrowHandoff(next.canScrollLeft ? 'left' : null);
  if (!next.canScrollLeft) focusActiveTab(); // no overflow at all: active tab is visible
}
// mirror for the left arrow
useLayoutEffect(() => {
  if (arrowHandoff === 'left') leftArrowRef.current?.focus();
  else if (arrowHandoff === 'right') rightArrowRef.current?.focus();
  if (arrowHandoff) setArrowHandoff(null);
}, [arrowHandoff, overflow]);
```
Another option is to focus the last fully visible tab, measured with `getBoundingClientRect()` against the scroller rect. Either way, add a test asserting that the focused element's rect falls within the scroller's rect, or that the opposite arrow has focus.

## Info

### IN-01: The key-search field still has no Escape handling (carried over)

**File:** `src/features/tickets/TicketFilterBar.tsx:145-152`; `src/features/groups/useListSelection.ts:117`
**Issue:** The guard comment says Esc "belongs to that field (clear/dismiss)". The key-search `<input type="text">` has no `onKeyDown`, so in select mode Escape there does nothing: it neither clears the field nor exits select mode. Only the assignee combobox (`TicketFilterBar.tsx:129-134`) handles Escape.
**Fix:** Add `onKeyDown={(e) => { if (e.key === 'Escape' && searchText) { e.preventDefault(); onSearchChange(''); } }}`. This lets an empty field fall through to select-mode exit if the guard is later relaxed. Alternatively, reword the comment.

### IN-02: SK `_many === _other` contradicts CLDR (carried over)

**File:** `src/i18n/locales/sk.json:499, 535, 561, 568`; `src/i18n/__tests__/groupLocale.test.ts:43-50`
**Issue:** In Slovak CLDR, `many` covers non-integer counts and takes the genitive singular. The test enforces the plural `other` form. This cannot be reached with integer counts.
**Fix:** Add a comment in the test noting that `_many` is unreachable for integer counts, or revert to the `_few` form.

### IN-03: Redundant contrast test and redundant `scrollIntoView` (carried over)

**File:** `src/features/groups/__tests__/contrast.test.ts:65-69`; `src/components/ui/AppShell.tsx:50-51`
**Issue:** The "unchecked checkbox boundary >= 3" test checks the same pair as the ">= 4.5" test at lines 45-49, so it can never fail on its own. In `handleNavKeyDown`, `focus()` already scrolls the element into view.
**Fix:** Drop the duplicate test. Use `focus({ preventScroll: true })` followed by `scrollIntoView({ inline: 'nearest' })` if the explicit scroll is intended.

### IN-04: The new "without scrolling" assertions are vacuous in jsdom, and the tests can leak DOM

**File:** `src/features/groups/__tests__/GroupTabStrip.test.tsx:179-207`
**Issue:** `expect(scroller.scrollLeft).toBe(400)` always passes, because jsdom never scrolls on `focus()`. Only the `spy` assertion actually guards CR-01, so the test names overstate what is checked. Also, the core-tab test appends a `<button data-tab-id="new">` to `document.body`, and both tests install a prototype `focus` spy. Cleanup (`core.remove()`, `spy.mockRestore()`) runs only after the assertions. If an assertion fails, the stray button and the prototype spy leak into later tests in the file, and later `focusCoreTab('new')` calls hit the wrong element.
**Fix:** Delete the `scrollLeft` assertions, or label them as documentation. Move cleanup into `try/finally` or `afterEach` (`vi.restoreAllMocks()`, and remove the `[data-tab-id]` nodes).

### IN-05: The opacity extraction in the contrast test takes the first `opacity-NN` anywhere in TicketCard.tsx

**File:** `src/features/groups/__tests__/contrast.test.ts:19-21`
**Issue:** `/opacity-(\d+)/` matches the first occurrence anywhere in the file. A later edit that adds `disabled:opacity-50`, `hover:opacity-100` or similar above `dimClass` would make the test check the wrong opacity and still pass or fail misleadingly. The check also does not confirm that the opacity applies to a `brand-text` element.
**Fix:** Export the dim opacity from `TicketCard.tsx` as a constant (for example `export const MISSING_DIM_CLASS = 'opacity-70 …'`) and parse that. Alternatively, anchor the regex to the `dimClass` declaration: `/const dimClass = dimmed\s*\?\s*'opacity-(\d+)/`.

### IN-06: The hook's JSDoc is now attached to `NON_TEXT_INPUT_TYPES`

**File:** `src/features/groups/useListSelection.ts:29-46`
**Issue:** The new constant was inserted between the `useListSelection` JSDoc block and the function. Editors and doc tooling now attach the "Per-page selection state…" doc to the constant, and the hook has no documentation. Separately, `<select>` and `type="image"` are not covered: Escape on an open native `<select>` both closes the dropdown and exits select mode. This is minor.
**Fix:** Move `NON_TEXT_INPUT_TYPES` above the JSDoc block. Optionally add `'image'` to the set and treat `HTMLSelectElement` as a field that owns Escape.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
