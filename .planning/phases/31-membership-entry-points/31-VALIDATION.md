---
phase: 31
slug: membership-entry-points
status: draft
nyquist_compliant: false
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
| TBD | — | — | GMEM-01 | — | Group add does not mutate triage state | integration | `npx vitest run src/features/groups/__tests__/membershipRegression.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | GMEM-02, GMEM-03 | T-31 name spoofing | Names rendered as text; validateGroupName before create | component | `npx vitest run src/features/groups/__tests__/GroupPicker.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | GMEM-04 | T-31 color injection | Color only via isGroupColorToken | component | `npx vitest run src/features/groups/__tests__/GroupChips.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | GMEM-05 | — | N/A | component | `npx vitest run src/features/tickets/__tests__/TicketCard.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | GMEM-06 | — | N/A | hook + component | `npx vitest run src/features/groups/__tests__/useListSelection.test.tsx src/features/tickets/__tests__/TicketFilterBar.test.tsx` | ❌ W0 / extend | ⬜ pending |
| TBD | — | — | GMEM-07 | — | N/A | component | `npx vitest run src/features/groups/__tests__/SelectionBar.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | GMEM-08 | — | N/A | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` | extend | ⬜ pending |
| TBD | — | — | GMEM-09 | — | N/A | component | `npx vitest run src/features/tickets/__tests__/TicketDetailPage.test.tsx` | extend | ⬜ pending |
| TBD | — | — | all (i18n) | — | N/A | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts` | extend | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
