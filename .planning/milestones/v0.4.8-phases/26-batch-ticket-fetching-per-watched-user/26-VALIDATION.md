---
phase: 26
slug: batch-ticket-fetching-per-watched-user
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | — | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 26-01-02 | 01 | 1 | — | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |
| 26-01-03 | 01 | 1 | — | — | N/A | unit | `npm run test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progress counter "X/N users fetched" displays during fetch loop | — | Requires live Tauri app with real/mock Jira connection | Launch app, watch list with 3+ users, initiate fetch, confirm counter increments per batch |
| Partial failure warning lists failed user names | — | Requires injected network error for specific user | In mock/dev mode, simulate error for one user batch, confirm warning names that user |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
