---
phase: 33-polish-verification
verified: 2026-10-12T00:00:00Z
status: gaps_found
score: 2/4 must-haves verified (SC1, SC4 verified; SC2, SC3 partial)
gaps:
  - truth: "SC3: palette contrast passes WCAG AA in light and dark themes (all new group UI text)"
    status: partial
    reason: "Missing-card issue key (text-xs, 12px) and meta row use text-brand-text-secondary at opacity-70, compositing to about 3.4:1 on surface, below the 4.5:1 AA minimum for normal text. contrast.test.ts asserts only >= 3 for this case, so the suite passes while the criterion fails. Confirmed in code: TicketCard.tsx line 52 uses opacity-70, and contrast.test.ts asserts toBeGreaterThanOrEqual(3) for the secondary text."
    artifacts:
      - path: "src/features/tickets/TicketCard.tsx"
        issue: "opacity-70 on secondary text for missing cards (lines ~51-53, 81-83, 112-114)"
      - path: "src/features/groups/__tests__/contrast.test.ts"
        issue: "Threshold lowered to 3:1 for the dimmed secondary text, locking in the non-compliance"
    missing:
      - "Dim via a token or summary-only opacity so key and meta stay at 4.5:1 or more in both themes"
      - "Raise the test assertion to >= 4.5"
  - truth: "SC2: tabs and tab menus are fully operable by keyboard alone"
    status: partial
    reason: "CR-01 confirmed. GroupTabStrip.updateOverflow calls .focus() without preventScroll when the focused scroll arrow disappears (lines ~99-104). Focus moves to the active tab and the browser scrolls the strip back to it. A keyboard user scrolling toward the end of an overflowing strip, with the active tab off-screen, is snapped back. The tests check focus only, not scrollLeft, so jsdom hides the bug. This is a real keyboard-operability defect in the overflow case, which matters for SC4 (about 25 groups)."
    artifacts:
      - path: "src/features/groups/GroupTabStrip.tsx"
        issue: "focus() without { preventScroll: true } in the arrow-disappearing fallback"
    missing:
      - "Use focus({ preventScroll: true }), or move focus to the opposite arrow or a visible tab"
      - "Add a test asserting scrollLeft is unchanged after the fallback"
      - "Optionally fix WR-03 (Esc ignored on checkbox and radio inputs, useListSelection.ts lines 105-112) and WR-01 (stale activeTab in the ResizeObserver closure)"
human_verification:
  - test: "Consolidated milestone UAT, 27 pending tests in 33-UAT.md"
    expected: "Real-app checks pass in WKWebView: Slovak strings and plurals, keyboard-only operation with focus return, both themes, 25-group tab bar and cards"
    why_human: "Visual appearance, real keyboard and focus behavior, scroll behavior and theme rendering cannot be verified by grep or jsdom"
---

# Phase 33: Polish & Verification Report

**Phase Goal:** All new group UI is fully bilingual and meets WCAG AA in both themes
**Status:** gaps_found
**Re-verification:** No, initial verification

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Slovak shows no untranslated strings; correct Slovak plurals | VERIFIED (visual pass pending UAT) | en.json and sk.json key sets are identical (0 missing in each direction, checked by script). noLiteralStrings.test.ts and groupLocale.test.ts exist as static guards. The one non-group literal ("Refresh (F5)") is exempted by name and documented in deferred-items.md under D-03. Minor: IN-02, the `_many` form is unreachable for integer counts. |
| 2 | Tabs, menus, picker, selection mode/bar and dialogs are keyboard operable; focus returns to trigger | PARTIAL | a11y.keyboard.test.tsx, AppShell.navKeys.test.tsx, menu-wrappers.test.tsx and GroupPicker tests exist and pass. Focus return is handled via afterUnmount and focusSelectToggle. Defect CR-01: the overflow-arrow focus fallback scrolls the strip back. WR-03: Esc is ignored on checkbox and radio inputs. |
| 3 | Color is never the only signal; palette contrast passes AA in both themes | PARTIAL | Contrast tests and a groupTokenUsage guard exist, and the group palette and tokens are checked in both themes. Missing-card key and meta text is about 3.4:1 against a 4.5:1 requirement (WR-02). The test accepts 3:1, so the suite is green while the criterion is not met. WR-04: the readVar helper is unanchored, so the tests may read the wrong token if declarations are reordered. |
| 4 | About 25 groups remain usable and uncluttered | VERIFIED (visual pass pending UAT) | groupScale.test.tsx and the GroupTabStrip overflow arrows exist. The overflow keyboard path is affected by CR-01, which should be fixed before this is treated as fully verified. |

**Score:** 2/4 (SC2 and SC3 have confirmed defects)

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| GQA-01 (EN/SK strings, SK plurals) | 33-01, 33-03, 33-06, 33-10 | SATISFIED | Locale parity holds; plural and literal guards exist. Human UAT for the visual check remains. |
| GQA-02 (WCAG AA: keyboard, focus return, color not sole signal, contrast in both themes) | 33-02 to 33-10 | BLOCKED (partial) | CR-01 and WR-02 above. |

No orphaned requirements: REQUIREMENTS.md maps only GQA-01 and GQA-02 to Phase 33, and both are claimed by the plans. Both are still unchecked in REQUIREMENTS.md.

## Anti-Patterns

No TBD, FIXME or XXX markers found in src/features/groups, src/test-utils or src/i18n/__tests__. Code review warnings and info items not listed as gaps (WR-01, WR-04, IN-01 to IN-06) are non-blocking, but should be tracked.

## Behavioral Checks

The orchestrator reported that the full suites pass (1635 vitest, 321 cargo, build OK). I did not re-run them. Their green status is weak evidence for SC2 and SC3, because the relevant assertions are loose (focus-only, 3:1).

## Human Verification Required

All 27 tests in 33-UAT.md are pending. Items to prioritize: Slovak plural forms in the running app, keyboard-only walkthrough including the overflow arrows with an off-screen active tab, dark and light theme contrast, and the 25-group layout.

## Gaps Summary

Two gaps block the phase goal.
1. WR-02: dimmed missing-card text fails AA at about 3.4:1. The test was loosened to match, which is an objective failure of SC3.
2. CR-01: the keyboard overflow-arrow fallback undoes its own scroll, affecting SC2 and SC4.

Both are small fixes (a token or opacity change plus a threshold change; one `preventScroll` option plus a test). Run `/gsd:plan-phase --gaps`. After the fixes, SC1 and SC4 are likely to pass, and the remaining items are the human UAT.

---

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
