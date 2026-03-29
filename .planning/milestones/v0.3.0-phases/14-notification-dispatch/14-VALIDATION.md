---
phase: 14
slug: notification-dispatch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) / cargo test (Rust) |
| **Config file** | `vitest.config.ts` / `src-tauri/Cargo.toml` |
| **Quick run command** | `cd src-tauri && cargo test --lib && cd .. && npx vitest run` |
| **Full suite command** | `cd src-tauri && cargo test --lib && cd .. && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd src-tauri && cargo test --lib && cd .. && npx vitest run`
- **After every plan wave:** Run `cd src-tauri && cargo test --lib && cd .. && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | NOTIF-01 | unit | `cargo test notification` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | NOTIF-02 | unit | `cargo test notification` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | NOTIF-03, NOTIF-04 | unit | `cargo test notification` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | NOTIF-05, NOTIF-06 | unit | `cargo test notification` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | NOTIF-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | NOTIF-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/notification_dispatcher.rs` — notification dispatch logic (testable without AppHandle)
- [ ] Test stubs for body-building, quiet-hours, and preference filtering logic

*Existing vitest and cargo test infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OS notification appears | NOTIF-03 | Requires macOS notification center | Trigger poll with changed ticket, verify notification banner appears |
| Permission request dialog | NOTIF-01 | OS-level dialog cannot be automated | First launch after install, verify permission prompt appears before first poll |
| Quiet hours suppression | NOTIF-06 | Requires system clock manipulation | Set quiet hours to current time range, trigger change, verify no notification |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
