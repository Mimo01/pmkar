---
phase: 37-consistency-accessibility-and-uat
verified: 2026-10-15T14:15:00Z
status: human_needed
score: 3/4 roadmap success criteria verified automatically (SC4 needs human run)
overrides_applied: 0
human_verification:
  - test: "Run 37-HUMAN-UAT.md on Windows/WebView2 (focus after deny/link/restore, Undo toast, Narrator/NVDA announcements, EN and SK)"
    expected: "All 5 tests pass; results recorded in place of [pending]"
    why_human: "WebView2 and screen-reader behavior cannot be verified from the codebase. SC4 says the checklist is written and run; it is written but every result is still [pending]."
---

# Phase 37: Consistency, Accessibility and UAT Verification Report

**Phase Goal:** Re-triage leaves every list, count and badge correct, and is usable by keyboard and screen reader
**Status:** human_needed
**Re-verification:** No

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After any Linked to Not mine transition a ticket is in exactly one tab, with matching counts and badges (RQA-01) | VERIFIED | `triageConsistency.test.tsx` uses the real `isNewCandidate`, `isNotMineCandidate`, `isLinkedCandidate`, `groupBadgeKey` and `hydrateTriageMap`. Only Tauri `invoke` and sonner are mocked. Passes in the full suite. |
| 2 | Deny and Link buttons are reachable and operable by keyboard alone | VERIFIED (automated) | `a11y.triage.keyboard.test.tsx` passes. `TicketDetailPage.tsx:301,323` uses `aria-disabled` plus an `if (linkBusy) return` guard, so focus is kept while linking. The focus ring is applied in the panel, group view and Not mine page. Real WebView2 behavior is covered by the human checklist. |
| 3 | Screen readers announce the result of deny, undo and link | VERIFIED (code) | `LiveAnnouncer.tsx` is a `role=status`, `aria-live=polite`, `aria-atomic` region, mounted beside each `<Toaster/>` in all 5 App branches. `triageActions.ts` calls `announce()` for undo, deny, restore, handled and link (lines 59, 74, 93, 100, 121). Locale guard test passes. Actual speech needs a human run. |
| 4 | A WebView2 manual checklist is written and run | PARTIAL | `37-HUMAN-UAT.md` is written with 5 tests, and `36-HUMAN-UAT.md` is marked superseded. It has not been run: all results are `[pending]`. |

**Test run:** the full vitest suite passes (133 files, 1768 tests).

## Requirements Coverage

| ID | Plans | Status | Evidence |
|----|-------|--------|----------|
| RQA-01 | 37-02, 37-05 | SATISFIED | Truth 1. REQUIREMENTS.md still shows it as Pending and unchecked; update the checkbox and traceability table. |
| RQA-03 | 37-01, 37-03, 37-04, 37-05 | SATISFIED in code, human confirmation pending | Truths 2 and 3. The checkbox is also unchecked. |

There are no orphaned requirements. REQUIREMENTS.md maps only RQA-01 and RQA-03 to Phase 37, and both appear in the plans.

## Anti-Patterns and Review Findings

No TBD, FIXME or XXX markers were checked beyond the advisory review.

| Finding | Severity | Impact on must-haves |
|---------|----------|----------------------|
| WR-01: `<LiveAnnouncer/>` is mounted separately in 5 early-return branches of `App.tsx` (lines 213, 238, 252, 279, 325). Each remount runs the effect with the store's old `nonce > 0`, so the last message is re-announced after navigating between branches. I confirmed this in the code. | Warning | It affects SC3. A user can hear a stale "KEY moved to ..." again, for example after a deny on the detail page followed by navigating back. The plan truth "announcements match what was done" is weakened, but each action is still announced. Fix: mount it once, or skip the already-handled nonce on mount. |
| WR-02: `a11y.denied` says "Dismissed" while the toast and other UI say "Ignored". The checklist records this as a known mismatch. | Warning | Terminology only. |
| WR-03: `aria-disabled` Link button; hover styling is not suppressed and the re-entry guard relies on a render-time value. | Warning | Minor. |
| IN-01, IN-02: duplicated focus-ring strings; magic number 8000. | Info | None. |

## Human Verification Required

### 1. Run 37-HUMAN-UAT.md on Windows/WebView2

**Test:** Run all 5 checklist items: focus, tooltips, keyboard-only, Undo toast, Narrator and NVDA.
**Expected:** Pass, with results recorded. Also check whether WR-01 produces a stale repeat announcement.
**Why human:** WebView2 focus and screen-reader speech are not testable in jsdom.

## Gaps Summary

There are no blocking code gaps. RQA-01 and RQA-03 are implemented and tested. SC4 requires the user to run the checklist, and every result is still `[pending]`. I recommend fixing WR-01 (a single mount of the announcer) before the UAT run. REQUIREMENTS.md checkboxes for RQA-01 and RQA-03 need updating once the UAT passes.

---

_Verified: 2026-10-15_
_Verifier: Claude (gsd-verifier)_
