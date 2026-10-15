---
status: partial
phase: 37-consistency-accessibility-and-uat
source: [37-UI-SPEC.md, 36-HUMAN-UAT.md]
started: 2026-10-15
updated: 2026-10-15
---

# Phase 37 Manual Checklist (Windows / WebView2)

Environment: Windows, the WebView2 app build, Narrator and NVDA, light theme (backgrounds #f7f7f8 and #ffffff).
Record each result in place of `[pending]` (pass / issue + notes).

## Current Test

[awaiting human testing]

## Tests

### 1. Focus after Deny, Link, Restore (page and panel) (from Phase 36 #1)
steps:
1. Open a ticket on the detail page. Activate Deny.
2. Open the same kind of ticket in the panel. Activate Deny.
3. Activate Link (or Restore link) on a ticket, in page and panel.
4. From Not mine, activate Restore, in page and panel.
expected: Deny -> focus on "Restore link to KEY" (Copy if the ticket was never linked); Link -> focus on the Linked badge; Restore -> focus on Dismiss (panel fallback: the close button). Focus never falls back to body.
result: [pending]

### 2. Tooltips and remembered-link hint in EN and SK (from Phase 36 #2)
steps:
1. In English, hover/focus the triage controls and the remembered-link hint in the detail page, panel, Not mine rows and group rows.
2. Switch to Slovak and repeat.
expected: Tooltips and hint render correctly and fully in EN and SK in all four places.
result: [pending]

### 3. Keyboard-only run
steps:
1. Using only the keyboard, Tab through the page, panel and group view.
2. Activate Deny, Link / Restore link and Restore with Enter and with Space.
3. In the group view, Tab to a Not mine row and activate its Restore.
4. Start a Link and watch the Link button while the request is in flight.
expected: Tab order is left to right; Enter and Space both activate each control; the Not mine row Restore in group view is reachable by Tab; the Link button keeps focus while in flight and shows a spinner.
result: [pending]

### 4. Undo toast reachability (documented only, D-07)
steps:
1. Deny a Linked ticket.
2. Within 8 s press alt+T (sonner hotkey), or Tab to the toast, and activate Undo.
3. Deny again and let the toast expire.
4. Use the Not mine "Restore link to KEY" / Restore buttons to get back.
expected: Step 2 returns the ticket to Linked. After expiry, the Not mine Restore link / Restore buttons are the keyboard path back. No other Undo shortcut is expected.
result: [pending]

### 5. Screen reader announcements (Narrator, then NVDA)
steps:
1. With Narrator running, perform: deny (with and without a remembered key), undo, link/relink (no toast, still announced), restore, handled, and one forced failure if feasible.
2. Repeat with NVDA.
3. Note whether the live region ever takes focus.
expected: Spoken text equals the EN `a11y.*` strings with the real keys, e.g. "KEY moved to Dismissed.", "Undo: KEY restored to Linked CLOUD-1.", "KEY linked to CLOUD-1.", "KEY restored.", "KEY marked as handled." Each is heard once (D-05); a brief repeat caused by the toast is recorded as an issue with notes, not a blocker. The region never takes focus.
known mismatch: the deny toast says "Ignored" while the live-region announcement and the tab say "Dismissed". Tester notes whether this is confusing (follow-up, not a blocker).
result: [pending]

### 6. Slovak run of tests 3-5
steps:
1. Switch the app to Slovak.
2. Repeat tests 3, 4 and 5.
expected: Strings say "tiket", read naturally in the screen reader, and match the SK `a11y.*` strings (e.g. "Tiket KEY bol presunutý do Zamietnuté.", "Tiket KEY bol prepojený s CLOUD-1.").
result: [pending]

### 7. Visible focus ring
steps:
1. On both #f7f7f8 and #ffffff backgrounds, Tab to every control used in tests 1-4 (Deny, Link, Restore link, Restore, Dismiss, Linked badge, toast Undo).
expected: A clearly visible focus ring on each control on both backgrounds.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
