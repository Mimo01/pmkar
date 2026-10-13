---
phase: 33-polish-verification
verified: 2026-10-13T12:00:00Z
status: human_needed
score: 4/4 must-haves verified (automated); visual and real-focus checks pending UAT
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "SC2: focus handoff from the vanishing overflow arrow landed on an off-screen tab (WCAG 2.4.7), closed by 33-13"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Consolidated milestone UAT, 27 pending tests in 33-UAT.md"
    expected: "Slovak strings and plurals correct; keyboard-only operation with focus return; both themes; 25-group tab bar and cards in WKWebView"
    why_human: "Visual appearance, real focus and scroll behavior, and theme rendering cannot be verified by grep or jsdom"
  - test: "Keyboard walkthrough of overflow arrows with 25 groups: press Enter on 'Scroll tabs right' until the end"
    expected: "Focus moves to the visible 'Scroll tabs left' arrow with a visible focus ring; the strip does not snap back"
    why_human: "jsdom has no layout, so focus visibility inside the clipped scroller cannot be asserted automatically"
  - test: "Mouse click on the scroll arrows to the end (Windows or Linux webview, if available)"
    expected: "Check whether the opposite arrow's tooltip pops open (review WR-01). Advisory only"
    why_human: "Depends on the webview's click-to-focus behavior; not testable here"
---

# Phase 33: Polish & Verification Report (re-verification after 33-13)

**Phase Goal:** All new group UI is fully bilingual and meets WCAG AA in both themes
**Verified:** 2026-10-13
**Status:** human_needed
**Re-verification:** Yes, after gap closure plan 33-13

## Gap closure check (SC2 / WCAG 2.4.7)

Read in `src/features/groups/GroupTabStrip.tsx`:

- `updateOverflow` (lines ~92-122): when the focused right arrow disappears and `canScrollLeft` is true, it calls `setArrowHandoff('left')`. The mirror case sets `'right'`. The active-tab fallback (with `preventScroll: true`) runs only when neither arrow can scroll, so the strip no longer overflows and the active tab is in view.
- A layout effect (lines ~137-142) focuses the target arrow with `preventScroll: true` and then clears the state.
- Both arrows render in an absolutely positioned overlay (`absolute inset-y-0 left-0` or `right-0`, `z-10`). That overlay sits outside the clipped scroller, so the focused control is always on screen.
- Batching: `setArrowHandoff` and `setOverflow` are queued in the same handler. The target arrow is mounted and its ref attached before the layout effect runs, and `overflow` is also an effect dependency. I read this independently and it matches the review's trace.
- I re-ran `GroupTabStrip.test.tsx`: 38/38 pass. The handoff tests assert `toHaveFocus` on the opposite arrow. The review confirmed they fail against the 33-12 code. The orchestrator reports the post-merge build and the full suite (1650 tests) pass.

The prior gap is CLOSED. The SUMMARY claim matches the code. The code has no TBD, FIXME or XXX markers.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Slovak shows no untranslated strings; correct plurals | VERIFIED (visual pass pending UAT) | Locale parity, literal-string guard and plural guards are unchanged since the last verification. Only IN-02 (`_many` unreachable for integer counts) remains, which is advisory. |
| 2 | Tabs, menus, picker, selection mode/bar and dialogs are keyboard operable; focus is visible and returns to the trigger | VERIFIED (real-focus pass pending UAT) | The overflow handoff now targets a visible control. The Esc guard and focus-return paths are unchanged and were previously verified. |
| 3 | Color is never the only signal; AA contrast in both themes | VERIFIED | `dimClass` opacity-70 is limited to the summary text. The contrast tests enforce 4.5:1 with anchored token reads. |
| 4 | About 25 groups remain usable and uncluttered | VERIFIED | The groupScale tests and the overflow arrows exist, and the keyboard overflow path is now fixed. |

**Score:** 4/4

## Assessment of review WR-01 (arrow handoff opens the Radix tooltip)

Advisory. It does not block the goal. Reasons:

- It does not violate WCAG 2.4.7. Focus is visible and on screen. The tooltip is extra content that appears on focus, and the arrow's accessible name is unchanged. The tooltip content is `aria-hidden`.
- 1.4.13 (content on hover or focus) requires that such content be dismissible with Esc, and Radix provides that. Keyboard users get a harmless tooltip.
- The mouse-user case applies only to Chromium-based webviews (Windows and Linux), where a click focuses a button. The reviewer did not check it at runtime. macOS (WKWebView) is unaffected. The effect is cosmetic: a tooltip stays open until blur. It does not hide content or block operation.
- A cheap fix exists (hand off only when the arrow matched `:focus-visible`, or suppress the tooltip once). Track it as a follow-up and check it during UAT on a non-macOS target. IN-06 (held Enter reverses scroll direction) and IN-07 (the biome-ignore comment overstates what it guarantees) are likewise non-blocking.

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| GQA-01 (EN and SK strings, Slovak plurals) | 33-01, 33-03, 33-06, 33-10 | SATISFIED (visual UAT pending) | Locale parity and guard tests pass. |
| GQA-02 (WCAG AA: keyboard, focus return, non-color signals, contrast) | 33-02 to 33-13 | SATISFIED in code (real-focus and theme UAT pending) | Contrast fixed (33-11), Esc and snap-back fixed (33-12), arrow handoff fixed (33-13). |

Every ID that the plans declare (GQA-01, GQA-02) appears in REQUIREMENTS.md, and REQUIREMENTS.md maps only those two to Phase 33. There are no orphaned requirements. The checkboxes at REQUIREMENTS.md lines 55-56 and the traceability rows (112-113, "Pending") are still unchecked. Update them once UAT passes.

## Anti-Patterns

There are no blockers. The Info items (IN-01 to IN-08 in 33-REVIEW.md) are test-quality and minor behavior notes. IN-08 notes that `expectFocusVisible` is a no-op in the handoff tests, but the `toHaveFocus` assertions are the real guard.

## Human Verification Required

1. The 27 pending tests in 33-UAT.md, in WKWebView, covering Slovak copy, keyboard operation, both themes and the 25-group scenario.
2. An overflow-arrow keyboard walkthrough that confirms visible focus at both scroll ends.
3. Optional, advisory: click the arrows to the end on a Windows or Linux webview and watch for the WR-01 tooltip.

## Gaps Summary

No code gaps remain. Status is human_needed only because the visual, real-focus and theme checks cannot be run in jsdom, and the user has chosen milestone-end UAT.

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
