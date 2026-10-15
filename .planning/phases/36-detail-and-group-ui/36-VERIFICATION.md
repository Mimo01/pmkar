---
phase: 36-detail-and-group-ui
status: human_needed
score: 5/5
verified: 2026-10-15
human_verification:
  - item: "Focus after Deny / Link / Restore in real WebView2 (page and panel)"
    expected: "Deny -> 'Restore link to KEY' button focused; Link -> Linked badge; Restore -> Dismiss"
  - item: "Tooltips and 'Previously linked to KEY' hint rendering in EN and SK (page, panel, Not mine rows, group rows)"
    expected: "Tooltips and hint render correctly in both locales"
---

# Phase 36 Verification

Goal: users can deny and re-link tickets from an explicit labelled button in every ticket detail, with clear hints about the remembered link.

`npx vitest run src/features/tickets src/features/groups src/i18n` -> 80 files, 1249 tests pass. Full suite on merged tree: 1713 pass. tsc clean.

| Req | Status | Evidence |
|---|---|---|
| RTRI-01 | SATISFIED | Deny button at TicketDetailPage.tsx:260, TicketDetailPanel.tsx:281 via tri.handleDeny |
| RTRI-04 | SATISFIED in code | useTriageDetailActions pendingFocus + refs; human check pending |
| RLNK-03 | SATISFIED | RememberedLinkHint (detail + row variants), detail.restoreLink button |
| RLNK-04 | SATISFIED | Group view opens shared detail; groupDetailTriage.test.tsx; row hint |
| RQA-02 | SATISFIED | EN/SK keys + detailLocale guard test ("tiket") |

## Advisory follow-ups (from 36-REVIEW.md)
- WR-02: page/panel `isCopied` ignores `copiedKey`; use `tri.isLinked`/`tri.isDenied`.
- WR-01: SK `detail.ignore` and `detail.deny` are both "Zamietnuť" (never shown together).
- WR-03/04/05, IN-01..03: minor.
