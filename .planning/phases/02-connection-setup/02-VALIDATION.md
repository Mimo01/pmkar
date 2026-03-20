---
phase: 2
slug: connection-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + @testing-library/react 16.3.0 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- --reporter=verbose src/features/connections` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose src/features/connections`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CONN-01 | unit | `npm test -- src/features/connections/ConnectionForm.test.tsx` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | CONN-02 | unit | `npm test -- src/features/connections/ConnectionForm.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | CONN-04 | unit | `npm test -- src/features/connections/TestResult.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | CONN-05 | unit | `npm test -- src/features/connections/TestResult.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | CONN-06 | unit | `npm test -- src/features/connections/SetupWizard.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | CONN-06 | unit | `npm test -- src/features/connections/SetupWizard.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/connections/ConnectionForm.test.tsx` — stubs for CONN-01, CONN-02: form renders fields, URL validation, Test Connection invokes correct command
- [ ] `src/features/connections/TestResult.test.tsx` — stubs for CONN-04, CONN-05: renders success/error messages with correct copy strings
- [ ] `src/features/connections/SetupWizard.test.tsx` — stubs for CONN-06: step progression, Next gating, wizard completion
- [ ] `src/features/connections/SecretInput.test.tsx` — eye icon toggle, aria-label changes

*Existing infrastructure covers test framework — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Credentials persist in OS keychain across restarts | CONN-06 | OS keychain access requires running Tauri app | 1. Complete wizard. 2. Quit app. 3. Relaunch. 4. Verify keychain entries via Keychain Access (macOS) |
| Spinner appears during Test Connection | CONN-04 | Visual state requires running app | 1. Click Test Connection. 2. Verify button shows spinner. 3. Verify fields are disabled during test |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
