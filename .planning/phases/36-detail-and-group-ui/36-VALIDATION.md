---
phase: 36
slug: detail-and-group-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-15
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.1 + @testing-library/react + vitest-axe |
| **Config file** | existing (vite/vitest config in repo root) |
| **Quick run command** | `npx vitest run src/features/tickets src/i18n` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched dirs>` and `npx biome check <touched files>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite and `npm run lint` must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-XX-XX | TBD | TBD | RTRI-01 | — | Deny sets ignored only, no Jira call | component | `npx vitest run src/features/tickets/TicketDetailPanel.test.tsx src/features/tickets/__tests__/TicketDetailPage.test.tsx` | ✅ extend | ⬜ pending |
| 36-XX-XX | TBD | TBD | RTRI-04 | — | N/A | component | same | ✅ extend | ⬜ pending |
| 36-XX-XX | TBD | TBD | RLNK-03 | — | N/A | component | `npx vitest run src/features/tickets src/features/groups/__tests__/GroupViewPage.test.tsx` | ✅ extend / ❌ W0 RememberedLinkHint.test.tsx | ⬜ pending |
| 36-XX-XX | TBD | TBD | RLNK-04 | — | N/A | component | `npx vitest run src/features/groups` | ✅ extend | ⬜ pending |
| 36-XX-XX | TBD | TBD | RQA-02 | — | N/A | unit | `npx vitest run src/i18n` | ❌ W0 detailLocale.test.ts | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Update `TicketDetailPanel.test.tsx` "Restoring from Ignored" test to the new Restore button (anchored regex)
- [ ] `src/i18n/__tests__/detailLocale.test.ts` — SK forbidden-term / placeholder parity for `detail.*` keys

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Focus landing after Deny in WebView2 | RTRI-04 | jsdom does not reproduce WebView2 focus behavior | Deny a linked ticket in the running app; confirm focus is on Link/Restore button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
