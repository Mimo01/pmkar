---
phase: 35
slug: shared-triage-actions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-15
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.1 + @testing-library/react, vitest-axe |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/features/tickets/__tests__/triageActions.test.ts` |
| **Full suite command** | `npm test && npm run lint` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/features/tickets/__tests__/triageActions.test.ts`
- **After every plan wave:** Run `npm test && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-XX-XX | TBD | TBD | LINT-01 | — | copiedKey preserved in store through deny/restore/handled; hydrate round-trip | unit | `npx vitest run src/features/tickets/__tests__/triageActions.test.ts` | ✅ extend | ⬜ pending |
| 35-XX-XX | TBD | TBD | RTRI-02 | T-35-02 | deny invokes only `set_triage_state('ignored')`; no Jira/copy command; rollback only if unchanged | unit | same | ❌ W0 | ⬜ pending |
| 35-XX-XX | TBD | TBD | RTRI-03 | T-35-03 | Undo toast id `deny-KEY`, 8000 ms; Undo uses DB-returned key from `relink_ticket` | unit | same | ❌ W0 | ⬜ pending |
| 35-XX-XX | TBD | TBD | RLNK-01 | — | `linkTicket` with remembered key → copied, same key, no startPreview | unit | same | ❌ W0 | ⬜ pending |
| 35-XX-XX | TBD | TBD | RLNK-02 | — | `linkTicket` with no key → startPreview, returns 'needs-copy' | unit | same | ❌ W0 | ⬜ pending |
| 35-XX-XX | TBD | TBD | LINT-01 (D-13) | — | Detail page/panel use shared module; no inline `copiedKey: null` | component + grep | `npx vitest run src/features/tickets/__tests__/TicketDetailPage.test.tsx` | ✅ extend | ⬜ pending |
| 35-XX-XX | TBD | TBD | i18n | — | New keys in EN + SK; SK uses "tiket" | unit | `npx vitest run src/i18n/__tests__` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Static check: `grep -rn "copiedKey: null" src --include='*.ts' --include='*.tsx'` outside tests/types returns only the fallback in `triageActions.ts`.

---

## Wave 0 Requirements

- [ ] Update sonner mock in `triageActions.test.ts` to a callable `toast` with `.error` / `.dismiss`
- [ ] New describe blocks: deny, link, markHandled, undo, hydrate round-trip
- [ ] `vi.spyOn(useCopyStore.getState(), 'startPreview')` for hand-off tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 8 s Undo toast and keyboard reach (Alt+T) in WebView2 | RTRI-03 | Real WebView2 timing/focus | Deny a Linked ticket; confirm Undo visible ~8 s, reachable via keyboard |
| Remembered key survives real app restart | LINT-01 | Needs real process restart | Deny a Linked ticket, restart app, re-link; same Cloud key, no copy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
