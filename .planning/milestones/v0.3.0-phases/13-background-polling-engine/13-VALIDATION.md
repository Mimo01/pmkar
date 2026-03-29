---
phase: 13
slug: background-polling-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (Rust) |
| **Config file** | `vite.config.ts` / `Cargo.toml` |
| **Quick run command** | `cargo test --lib && npm run test -- --run` |
| **Full suite command** | `cargo test && npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test --lib && npm run test -- --run`
- **After every plan wave:** Run `cargo test && npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | POLL-01 | unit | `cargo test poll` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | POLL-02 | unit | `cargo test poll` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | POLL-03 | unit | `cargo test poll` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | POLL-01 | integration | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | POLL-02 | integration | `npm run test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/poll_engine.rs` — poll loop module with test stubs for POLL-01, POLL-02, POLL-03
- [ ] `src/__tests__/polling.test.ts` — frontend polling UI test stubs

*Existing cargo test and vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Poll continues when window minimized | POLL-02 | Requires minimized window state | Minimize app, wait for poll interval, verify new data appears on restore |
| Cmd/Ctrl+R triggers manual poll | POLL-03 | Keyboard shortcut binding | Press Cmd+R in app, verify ticket list refreshes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
