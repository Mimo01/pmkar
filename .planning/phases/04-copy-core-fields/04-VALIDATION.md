---
phase: 4
slug: copy-core-fields
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | vitest.config.ts (jsdom environment, setup: src/test-setup.ts) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | COPY-01 | unit | `npm run test -- CopyPreviewModal` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | COPY-01 | unit | `npm run test -- CopyPreviewModal` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | COPY-07 | unit | `npm run test -- CopyResultModal` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | COPY-08 | unit | `npm run test -- CopyPreviewModal` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 1 | COPY-08 | unit | `npm run test -- CopyPreviewModal` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 1 | COPY-09 | unit | `npm run test -- CopyPreviewModal` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 2 | COPY-01 | unit | `npm run test -- TicketTable` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/tickets/CopyPreviewModal.test.tsx` — stubs for COPY-01, COPY-08, COPY-09 preview rendering
- [ ] `src/features/tickets/CopyResultModal.test.tsx` — stubs for COPY-07, copy result display

*Note: Rust-side conversion (COPY-09 htmltoadf correctness) is tested through the mock server integration path — the copy_ticket command is invoked against the mock server which returns fixture renderedFields HTML.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side-by-side diff layout renders correctly | COPY-08 | Visual layout verification | Open copy preview, verify source on left, target on right |
| ADF rendering fidelity in company Jira | COPY-09 | Requires real Jira Cloud instance | Copy ticket, open in Cloud, verify tables/code blocks/lists render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
