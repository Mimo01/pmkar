---
phase: 5
slug: copy-attachments-and-comments
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + jsdom + @testing-library/react |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | COPY-02 | unit | `npm test -- CopyResultModal` | Extend existing ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | COPY-02 | unit | `npm test -- CopyResultModal` | Extend existing ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | COPY-03 | unit | `npm test -- CopyResultModal` | Extend existing ✅ | ⬜ pending |
| 05-01-04 | 01 | 1 | COPY-03 | unit | `npm test -- CopyPreviewModal` | Extend existing ✅ | ⬜ pending |
| 05-01-05 | 01 | 1 | COPY-04 | unit | `npm test -- CopyResultModal` | Extend existing ✅ | ⬜ pending |
| 05-01-06 | 01 | 1 | COPY-05 | unit | `npm test -- CopyPreviewModal` | Extend existing ✅ | ⬜ pending |
| 05-01-07 | 01 | 1 | COPY-06 | unit | `npm test -- CopyPreviewModal` | Extend existing ✅ | ⬜ pending |
| 05-01-08 | 01 | 1 | COPY-05/06 | manual | `cargo test` integration | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/tickets/CopyResultModal.test.tsx` — extend with attachment/comment/worklog step label cases (COPY-02, COPY-03, COPY-04) — file exists, needs new `it()` blocks
- [ ] `src/features/tickets/CopyPreviewModal.test.tsx` — extend with attachment count, comment count, sub-task list, linked issues display cases (COPY-02, COPY-03, COPY-05, COPY-06) — file exists, needs new `it()` blocks
- [ ] Rust integration test for description ADF footer construction (sub-tasks + linked issues appended) — optional, `src-tauri/tests/copy_ticket_description.rs`

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sub-task + linked issue sections in ADF description | COPY-05/06 | Rust-level ADF construction; no existing Rust test harness for description builder | Build `cargo test` integration test or verify via mock server end-to-end |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
