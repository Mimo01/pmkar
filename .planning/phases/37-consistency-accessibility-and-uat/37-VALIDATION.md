---
phase: 37
slug: consistency-accessibility-and-uat
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-15
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.1, jsdom, Testing Library, vitest-axe |
| **Config file** | existing vite/vitest config; `src/test-setup.ts` |
| **Quick run command** | `npx vitest run src/features/tickets/__tests__/triageConsistency.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched test file
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 37-01 | 1 | RQA-01 | — | N/A | integration | `npx vitest run src/features/tickets/__tests__/triageConsistency.test.tsx` | ✅ | ✅ green |
| 37-02-01 | 37-02 | 2 | RQA-03 | T-37-01 | announcement text rendered as React text, never HTML | unit | `npx vitest run src/features/tickets/__tests__/triageActions.test.ts` | ✅ | ✅ green |
| 37-02-02 | 37-02 | 2 | RQA-03 | — | N/A | unit | `npx vitest run src/components/__tests__/LiveAnnouncer.test.tsx` | ✅ | ✅ green |
| 37-03-01 | 37-03 | 2 | RQA-03 | — | N/A | unit | `npx vitest run src/i18n/__tests__/a11yLocale.test.ts` | ✅ | ✅ green |
| 37-04-01 | 37-04 | 2 | RQA-03 | — | N/A | integration | `npx vitest run src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/features/tickets/__tests__/triageConsistency.test.tsx` — RQA-01
- [x] `src/components/__tests__/LiveAnnouncer.test.tsx` — RQA-03
- [x] `src/i18n/__tests__/a11yLocale.test.ts` — RQA-03
- [x] `src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx` — RQA-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real WebView2 focus, focus ring, Narrator/NVDA speech (EN/SK), Undo toast reachability | RQA-03 | Needs Windows + WebView2 + screen reader; dev machine is macOS | Run checklist in `37-HUMAN-UAT.md` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (automated); manual run pending in 37-HUMAN-UAT.md
