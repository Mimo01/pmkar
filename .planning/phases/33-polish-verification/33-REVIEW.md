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
  info: 8
  total: 9
status: issues_found
---

# Phase 33: Code Review Report (re-review after gap closure 33-13)

**Reviewed:** 2026-10-13
**Depth:** standard
**Files Reviewed:** 44
**Status:** issues_found

## Summary

This re-review follows gap-closure plan 33-13, which changed how focus moves when an overflow arrow disappears. Since the previous review (`f2aed21`), only two source files changed: `src/features/groups/GroupTabStrip.tsx` and `src/features/groups/__tests__/GroupTabStrip.test.tsx`. The other 42 files are byte-identical, so their earlier assessment and line references still hold.

The new logic works as follows. When the focused arrow disappears and the strip still overflows the other way, `updateOverflow` sets `arrowHandoff`. A layout effect then focuses the opposite arrow with `preventScroll`. Focus falls back to the active tab only when overflow is gone entirely, and in that case the active tab is guaranteed to be visible.

I traced the batching. `setArrowHandoff` and `setOverflow` are queued in the same handler, so the target arrow is mounted and its ref is attached before the layout effect runs. That holds even when the left arrow mounts in the same commit after a single-step scroll. The new tests assert that the opposite arrow has focus, and they would fail against the 33-12 code. `GroupTabStrip.test.tsx`, `groupScale.test.tsx` and `a11y.keyboard.test.tsx` pass (68 tests).

**Prior WR-01 is resolved.** The handoff target is now the opposite arrow, which sits in an absolutely positioned overlay outside the clipped scroller and is always visible. Prior IN-04 (test cleanup leaks and vacuous `scrollLeft` assertions) is also resolved.

The new handoff has two side effects:
- **Tooltip (one Warning).** The arrows are Radix tooltip triggers, so moving focus programmatically opens a tooltip nobody asked for. On Chromium-based webviews this also affects mouse users.
- **Held Enter (Info).** Holding Enter on the right arrow reverses direction once the strip reaches its end.

## Previous findings status

| ID | Title | Status | Evidence |
|----|-------|--------|----------|
| WR-01 | Overflow-arrow focus handoff leaves focus on an off-screen tab | **Resolved** | `GroupTabStrip.tsx:109-112` hands off to the opposite arrow; the active-tab fallback (`:113-117`) runs only when `!canScrollLeft && !canScrollRight`; the layout effect at `:137-142` focuses the arrow with `preventScroll`. Tests at `GroupTabStrip.test.tsx:210-241` assert the opposite arrow has focus (they fail on the 33-12 code). |
| IN-01 | Key-search field has no Escape handling | **Open** | Unchanged (carried as IN-01) |
| IN-02 | SK `_many === _other` contradicts CLDR | **Open** | Unchanged (carried as IN-02) |
| IN-03 | Redundant contrast test / redundant `scrollIntoView` | **Open** | Unchanged (carried as IN-03) |
| IN-04 | Vacuous `scrollLeft` assertions, leaking DOM and spies | **Resolved** | `scrollLeft).toBe(...)` assertions removed; `afterEach` (`GroupTabStrip.test.tsx:71-74`) runs `vi.restoreAllMocks()` and removes stray `[data-tab-id]` nodes |
| IN-05 | Contrast test opacity regex takes the first `opacity-NN` | **Open** | Unchanged (carried as IN-04) |
| IN-06 | Hook JSDoc attached to `NON_TEXT_INPUT_TYPES` | **Open** | Unchanged (carried as IN-05) |

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The arrow handoff opens the "Scroll tabs …" tooltip without the user asking, including for mouse users on Chromium webviews

**File:** `src/features/groups/GroupTabStrip.tsx:137-142` (target buttons at `:386-399` and `:407-420`)
**Issue:** Both arrows are wrapped in Radix `TooltipTrigger`. In `@radix-ui/react-tooltip` 1.2.8, the trigger's `onFocus` calls `context.onOpen()` unless `isPointerDownRef` is set (`dist/index.mjs:202-203`). `onOpen` opens the tooltip immediately; the provider's `delayDuration=300` applies only to pointer-enter. The handoff calls `.focus()` on an arrow that never received a pointerdown, so the opposite arrow's tooltip always pops open at the far end of the strip.

- **Keyboard users:** this is tolerable, though the first Escape is then consumed by the tooltip rather than reaching any outer handler. `a11y.keyboard.test.tsx:410` already notes this pitfall for another trigger.
- **Mouse users:** Chromium focuses a `<button>` on click. That covers WebView2 on Windows, and `tauri.conf.json` bundles `"targets": "all"`. So a mouse user who clicks "Scroll tabs right" until the end now sees focus jump to the left arrow and a "Scroll tabs left" tooltip appear away from the pointer. The tooltip stays open until the next blur, because a focus-opened Radix tooltip does not close on pointer-leave. With the 33-12 code, nothing visible happened. (WKWebView on macOS does not focus buttons on click, so macOS is unaffected; I have not checked this at runtime on Windows or Linux.)

**Fix:** Hand off only when the arrow was focused via the keyboard. For pointer-initiated focus, let it drop (or keep the old active-tab fallback), since mouse users do not need the handoff:
```tsx
const keyboardFocused = focused instanceof HTMLElement && focused.matches(':focus-visible');
if (focusedRightGone && next.canScrollLeft) {
  if (keyboardFocused) setArrowHandoff('left');
} else if (focusedLeftGone && next.canScrollRight) {
  if (keyboardFocused) setArrowHandoff('right');
} else if (focusedLeftGone || focusedRightGone) { /* existing active-tab fallback */ }
```
If `:focus-visible` is unreliable in jsdom, track a `lastArrowPointerRef` set in the arrows' `onPointerDown` and cleared on `keydown`. Optionally suppress the tooltip on the handed-off focus by making the `Tooltip` `open` controlled for one tick. Add a test: pointer-click the right arrow, reach the end, and assert that no `role="tooltip"` is rendered.

## Info

### IN-01: The key-search field still has no Escape handling (carried over)

**File:** `src/features/tickets/TicketFilterBar.tsx:145-152`; `src/features/groups/useListSelection.ts:117`
**Issue:** The guard comment says Esc "belongs to that field (clear/dismiss)". The key-search input has no `onKeyDown`, so in select mode Escape there does nothing.
**Fix:** Add `onKeyDown={(e) => { if (e.key === 'Escape' && searchText) { e.preventDefault(); onSearchChange(''); } }}`, or reword the comment.

### IN-02: SK `_many === _other` contradicts CLDR (carried over)

**File:** `src/i18n/locales/sk.json:499, 535, 561, 568`; `src/i18n/__tests__/groupLocale.test.ts:43-50`
**Issue:** In Slovak CLDR, `many` covers non-integer counts. The test enforces the plural `other` form. This cannot be reached with integer counts.
**Fix:** Add a comment in the test noting that `_many` is unreachable for integer counts, or revert to the `_few` form.

### IN-03: Redundant contrast test and redundant `scrollIntoView` (carried over)

**File:** `src/features/groups/__tests__/contrast.test.ts:65-69`; `src/components/ui/AppShell.tsx:50-51`
**Issue:** The ">= 3" checkbox-boundary test checks the same pair as the ">= 4.5" test, so it can never fail on its own. In `handleNavKeyDown`, `focus()` already scrolls the element into view.
**Fix:** Drop the duplicate test. Use `focus({ preventScroll: true })` followed by `scrollIntoView({ inline: 'nearest' })` if the explicit scroll is intended.

### IN-04: The opacity extraction in the contrast test takes the first `opacity-NN` anywhere in TicketCard.tsx (carried over)

**File:** `src/features/groups/__tests__/contrast.test.ts:19-21`
**Issue:** `/opacity-(\d+)/` matches the first occurrence anywhere in the file. A later `hover:opacity-100` placed above `dimClass` would make the test check the wrong opacity.
**Fix:** Export the dim class as a constant from `TicketCard.tsx` and parse that, or anchor the regex to the `dimClass` declaration.

### IN-05: The hook's JSDoc is attached to `NON_TEXT_INPUT_TYPES` (carried over)

**File:** `src/features/groups/useListSelection.ts:29-46`
**Issue:** The constant sits between the `useListSelection` JSDoc and the function, so doc tooling attaches the hook's documentation to the constant. Native `<select>` is not treated as a field that owns Escape.
**Fix:** Move the constant above the JSDoc block. Optionally treat `HTMLSelectElement` as a field that owns Escape.

### IN-06: Holding Enter on the right arrow reverses scrolling once it reaches the end

**File:** `src/features/groups/GroupTabStrip.tsx:109-110, 392, 413`
**Issue:** Enter activates a `<button>` on every auto-repeated keydown. A keyboard user holding Enter on "Scroll tabs right" reaches the end. Focus then moves to "Scroll tabs left", and the remaining repeat keydowns click that arrow, so the strip scrolls back left. Depending on repeat rate and smooth-scroll timing, it can bounce. This is an inherent cost of handing focus to the opposite arrow. It is minor, but it was not covered by the plan or the tests.
**Fix:** Ignore repeated activations on the arrows, for example `onKeyDown={(e) => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault(); }}`. Alternatively, ignore clicks on the handed-off arrow until the next `keyup`.

### IN-07: A pending handoff is silently dropped if the target arrow is not mounted, and the biome-ignore rationale is inaccurate

**File:** `src/features/groups/GroupTabStrip.tsx:136-142`
**Issue:** The effect calls `leftArrowRef.current?.focus(...)` and then always calls `setArrowHandoff(null)`. If the ref were ever null, the handoff would be cleared on that run: the `overflow` dependency does not "re-run after the arrow mounts" as the comment claims, because there is nothing left to retry. Focus would then fall to `<body>`. Today this cannot happen, because both state updates are batched in one commit. But the comment describes a guarantee the code does not provide, and a future refactor (for example, deferring `setOverflow`) would break focus without failing any test.
**Fix:** Clear the handoff only once it has been honoured, and fall back otherwise:
```tsx
const target = arrowHandoff === 'left' ? leftArrowRef.current : rightArrowRef.current;
if (!target) return; // wait for the overflow-driven re-render
target.focus({ preventScroll: true });
setArrowHandoff(null);
```
Then remove the `overflow` dependency from the biome-ignore comment, or keep it with an accurate comment.

### IN-08: `expectFocusVisible` is a no-op in both handoff tests, and its rect checks only compare hand-set mocks

**File:** `src/features/groups/__tests__/GroupTabStrip.test.tsx:90-101, 196-232, 243-260`
**Issue:**
- The helper returns early whenever an arrow is focused. In the two arrow-handoff tests it therefore asserts nothing, and the `mockRect` calls for the tabs in `setupRightEndHandoff` (`:202-204`) and at `:225` are dead setup.
- In the resize-fallback test, the rects passed to the bounds check are values the test itself chose to lie inside the scroller, so that check is tautological.

The real guard in these tests is the `toHaveFocus` assertion, which is enough. But the helper's name and the "rect-based focus-visibility tests" wording in the commit message overstate what is verified.
**Fix:** Drop the unused `mockRect` calls in the handoff tests and call `expectFocusVisible` only in the fallback test. Alternatively, assert directly that the focused arrow sits outside the scroller element (`expect(scroller.contains(document.activeElement)).toBe(false)`), which is the actual visibility argument for the arrows.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
