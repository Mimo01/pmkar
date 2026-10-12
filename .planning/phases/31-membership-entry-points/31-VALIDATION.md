---
phase: 31
slug: membership-entry-points
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-12
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.1 + @testing-library/react ^16.3.2 + user-event ^14.6.1 (jsdom) |
| **Config file** | `vitest.config.ts` (setup `src/test-setup.ts`) |
| **Quick run command** | `npx vitest run src/features/groups src/features/tickets` |
| **Full suite command** | `npm test && npm run lint` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched feature folder>`
- **After every plan wave:** Run `npm test && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 31-01-T1 | 01 | 1 | GMEM-02..09 (i18n) | T-31-01 | Names via i18n interpolation, text only | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts src/i18n/__tests__/translations.test.ts` | extend | ⬜ pending |
| 31-02-T1 | 02 | 1 | GMEM-05 | T-31-03 | Focus only existing group tabs | component | `npx vitest run src/features/groups/__tests__/NavigationContext.test.tsx src/features/groups/__tests__/GroupTabStrip.test.tsx` | ❌ W0 / extend | ⬜ pending |
| 31-02-T2 | 02 | 1 | GMEM-05 | T-31-04 | selectTicket(null) prevents detail re-open | integration | `npx vitest run src/__tests__/App.test.tsx && npx tsc --noEmit` | extend | ⬜ pending |
| 31-03-T1 | 03 | 2 | GMEM-06 | T-31-05/06/07 | Prune hidden keys; no loop; per-page state | hook | `npx vitest run src/features/groups/__tests__/useListSelection.test.tsx` | ❌ W0 | ⬜ pending |
| 31-03-T2 | 03 | 2 | GMEM-06 | — | N/A | component | `npx vitest run src/features/tickets/__tests__/TicketFilterBar.test.tsx` | extend | ⬜ pending |
| 31-04-T1 | 04 | 2 | GMEM-07 | T-31-18 | Single atomic call | unit | `npx vitest run src/features/groups/__tests__/membershipActions.test.ts` | ❌ W0 | ⬜ pending |
| 31-04-T2 | 04 | 2 | GMEM-02, GMEM-09 | T-31-09/10/11 | Text-only names; color via token; in-flight guard | component | `npx vitest run src/features/groups/__tests__/GroupPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 31-04-T3 | 04 | 2 | GMEM-03, GMEM-07 | T-31-08 | validateGroupName before create; Rust re-validates | component | `npx vitest run src/features/groups/__tests__/GroupPicker.test.tsx` | ❌ W0 | ⬜ pending |
| 31-05-T1 | 05 | 2 | GMEM-04, GMEM-05 | T-31-13/14/15 | Text names; groupColorVar only; null selector | component | `npx vitest run src/features/groups/__tests__/GroupChips.test.tsx` | ❌ W0 | ⬜ pending |
| 31-05-T2 | 05 | 2 | GMEM-05, GMEM-06 | T-31-16 | No nested buttons; stopPropagation | component | `npx vitest run src/features/tickets src/features/groups` | ❌ W0 | ⬜ pending |
| 31-06-T1 | 06 | 3 | GMEM-07, GMEM-08 | T-31-17..20 | Confirm before remove; atomic; Esc contained | component | `npx vitest run src/features/groups/__tests__/SelectionBar.test.tsx` | ❌ W0 | ⬜ pending |
| 31-07-T1 | 07 | 3 | GMEM-02 | T-31-21 | Minimal renderable snapshot | unit | `npx vitest run src/features/groups/__tests__/detailToTicket.test.ts` | ❌ W0 | ⬜ pending |
| 31-07-T2 | 07 | 3 | GMEM-02, GMEM-03, GMEM-09 | T-31-22/24 | Chip × confirm | component | `npx vitest run src/features/groups/__tests__/DetailGroupsRow.test.tsx` | ❌ W0 | ⬜ pending |
| 31-07-T3 | 07 | 3 | GMEM-05, GMEM-09 | T-31-23 | Esc in popover keeps detail | component + integration | `npx vitest run src/features/tickets/__tests__/TicketDetailPage.test.tsx src/__tests__/App.test.tsx` | extend | ⬜ pending |
| 31-08-T1 | 08 | 4 | GMEM-04, GMEM-06, GMEM-07, GMEM-08 | T-31-25/26/27 | Visible-only payload; confirm; remount clears | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` | extend | ⬜ pending |
| 31-09-T1 | 09 | 4 | GMEM-06, GMEM-07 | T-31-28/31 | Visible-only payload; no Remove in core lists | component | `npx vitest run src/features/tickets/TicketListPage.test.tsx src/features/tickets/IgnoredTicketsPage.test.tsx src/features/tickets/__tests__/LinkedTicketsPage.test.tsx` | extend | ⬜ pending |
| 31-09-T2 | 09 | 4 | GMEM-01, GMEM-05, GMEM-06 | T-31-29/30 | Triage unchanged; tab change clears selection | integration | `npx vitest run src/features/groups/__tests__/membershipRegression.test.tsx src/__tests__/App.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/groups/__tests__/GroupPicker.test.tsx` — GMEM-02, GMEM-03
- [ ] `src/features/groups/__tests__/GroupChips.test.tsx` — GMEM-04 (+ selector stability)
- [ ] `src/features/groups/__tests__/SelectionBar.test.tsx` — GMEM-07
- [ ] `src/features/groups/__tests__/useListSelection.test.tsx` — GMEM-06
- [ ] `src/features/tickets/__tests__/TicketCard.test.tsx` — GMEM-05
- [ ] `src/features/groups/__tests__/membershipRegression.test.tsx` — GMEM-01
- [ ] Update `GroupViewPage.test.tsx` card lookup (`closest('button')`) after TicketCard restructure

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Focus lands on target group tab after chip click | GMEM-05 | Real focus/scroll behavior in Tauri webview | Click chip on a card, verify group tab active and focused |
| Visual chip colors in light/dark | GMEM-04 | Visual | Toggle theme, inspect chips |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each new test file is created by the TDD task that needs it)
- [x] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
