---
phase: 33-polish-verification
verified: 2026-10-13T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified (SC1, SC3, SC4 verified; SC2 partial)
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "SC3 / WR-02: dimmed missing-card text below 4.5:1"
    - "CR-01 (original defect): overflow-arrow fallback scrolled the strip back"
    - "WR-01: stale activeTab in the ResizeObserver closure"
    - "WR-03: Esc ignored on checkbox and radio inputs"
    - "WR-04: unanchored readVar"
  gaps_remaining:
    - "SC2: focus handoff from the vanishing overflow arrow lands on an off-screen tab"
  regressions: []
gaps:
  - truth: "SC2: tabs and tab menus are fully operable by keyboard alone (focus visible, WCAG 2.4.7), including the overflow case with about 25 groups (SC4)"
    status: partial
    reason: "The CR-01 fix (GroupTabStrip.tsx:101-111) passes preventScroll: true, so the strip is no longer snapped back. But focus is still sent to the ACTIVE tab. When the user scrolls to the end via the overflow arrow and the active tab is off-screen, focus lands on an element the user cannot see (the scroller clips it). The focus indicator is invisible, which fails WCAG 2.4.7 (GQA-02 requires AA). The next Tab press goes to the off-screen More button and the browser scrolls the strip back, so the original symptom is deferred by one keystroke rather than removed. I confirmed this by reading the code: the fallback target is activeTabRef.current, with no visibility check. jsdom cannot reproduce it, and the new tests assert only the preventScroll argument (the scrollLeft assertions are vacuous in jsdom, per IN-04 in 33-REVIEW.md)."
    artifacts:
      - path: "src/features/groups/GroupTabStrip.tsx"
        issue: "updateOverflow fallback focuses the active tab even when it is scrolled out of view"
    missing:
      - "Hand focus to a control that is visible: the opposite arrow (which has just appeared), or the nearest fully visible tab"
      - "Add a test asserting the focused element is the opposite arrow or lies inside the scroller rect"
human_verification:
  - test: "Consolidated milestone UAT, 27 pending tests in 33-UAT.md"
    expected: "Real-app checks pass in WKWebView: Slovak strings and plurals, keyboard-only operation with focus return, both themes, 25-group tab bar and cards"
    why_human: "Visual appearance, real focus and scroll behavior, and theme rendering cannot be verified by grep or jsdom"
---

# Phase 33: Polish & Verification Report (Re-verification)

**Phase Goal:** All new group UI is fully bilingual and meets WCAG AA in both themes
**Verified:** 2026-10-13
**Status:** gaps_found
**Re-verification:** Yes, after gap closure plans 33-11 and 33-12

## Gap Closure Check

| Prior gap | Status | Evidence in code |
|-----------|--------|------------------|
| WR-02 dimmed-card contrast (SC3) | CLOSED | TicketCard.tsx:56 applies `opacity-70` through `dimClass`. It is applied only to the brand-text summary (lines ~129-134). Key, dates and assignee are undimmed. The review's independent composited numbers are 5.6 to 7.1:1 in both themes. The test asserts >= 4.5 with the opacity read from the source. |
| CR-01 snap-back | CLOSED for the original defect | `focus({ preventScroll: true })` is used for both tab and core-tab fallbacks. `focusCoreTab` forwards the options. |
| CR-01 follow-up (new, WR-01 in the fresh review) | OPEN | See the gap above. |
| WR-01 stale activeTab | CLOSED | `activeTabRef` is assigned on each render and read in `updateOverflow`. |
| WR-03 Esc on checkbox/radio | CLOSED | useListSelection.ts:116-123: the Escape and selectMode check comes first, and only text-entry fields are excluded. |
| WR-04 readVar | CLOSED | Anchored and escaped in src/test-utils/contrast.ts, with regression tests. |

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Slovak shows no untranslated strings; correct plurals | VERIFIED (visual pass pending UAT) | Locale parity, the literal guard and the plural guards are unchanged since the previous verification. No regressions. Only the minor IN-02 (`_many` unreachable) remains. |
| 2 | Tabs, menus, picker, selection mode/bar and dialogs are keyboard operable; focus returns to the trigger | PARTIAL | The snap-back is fixed and the Esc guard is fixed. The overflow-arrow handoff can leave focus invisible (gap above). Dialog focus return and the other paths are unchanged. |
| 3 | Color is never the only signal; AA contrast in both themes | VERIFIED | WR-02 is fixed and the tests now enforce 4.5:1 with the correct token reads. |
| 4 | About 25 groups remain usable and uncluttered | VERIFIED functionally (the keyboard overflow edge case is tracked under SC2) | groupScale tests and overflow arrows exist. |

**Score:** 3/4

## Assessment of the new finding

It affects SC2 directly and SC4 only through the overflow path. It does not undo the CR-01 closure of the original symptom (the strip no longer snaps back during the scroll), but the fix is incomplete: the user can scroll, yet loses a visible focus. The review rates it Warning. I classify it as a gap (BLOCKER for SC2) rather than UNCERTAIN, because GQA-02 explicitly demands WCAG AA, 2.4.7 is an AA criterion, and the defect is deterministic from the code (focus() on a clipped element with preventScroll). It is also a narrow fix. The impact is limited to keyboard users who have an overflowing strip, an active tab outside the viewport and the arrow button focused at the scroll end. If the owner prefers to ship it and accept the risk, record an override. I am not suggesting one, because an alternative implementation that gives the same guarantee does not exist.

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| GQA-01 | 33-01, 33-03, 33-06, 33-10 | SATISFIED (visual UAT pending) | Locale parity and guards pass. |
| GQA-02 | 33-02 to 33-12 | PARTIAL | Contrast is fixed; focus visibility in the overflow handoff is open. |

No orphaned requirements: REQUIREMENTS.md maps only GQA-01 and GQA-02 to Phase 33, and the plans claim both. Both checkboxes are still unchecked in REQUIREMENTS.md and the traceability table says Pending; update them after closure.

## Anti-Patterns

No TBD, FIXME or XXX markers were introduced. The Info items in 33-REVIEW.md (IN-01 to IN-06) are non-blocking: the key-search field has no Escape handler, `_many` is unreachable, duplicate contrast test, vacuous jsdom scroll assertions that can leak a stub button, a first-match opacity regex, and a misplaced JSDoc.

## Behavioral Checks

I did not re-run the suites. I relied on the orchestrator's report (125 files, 1649 tests, build OK) and the review's targeted run (156 tests). jsdom cannot cover focus visibility, so green tests do not clear the gap above.

## Human Verification Required

The 27 tests in 33-UAT.md are still pending. Prioritize the keyboard walkthrough of the overflow arrows with the active tab scrolled off-screen, and the Slovak plurals.

## Gaps Summary

One gap remains, narrow: change the fallback target in `updateOverflow` (GroupTabStrip.tsx:101-111) to a visible control (the opposite arrow, or the nearest visible tab) and add a test. Run `/gsd:plan-phase 33 --gaps`. All other prior gaps are closed with no regressions.

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
