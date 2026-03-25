---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Rust)** | `cargo test` with `#[tokio::test]` for async |
| **Framework (Frontend)** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `cargo test -p pmkar-lib -- --test-thread=1` |
| **Full suite command** | `cargo test && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test && npx vitest run`
- **After every plan wave:** Run `cargo test && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | TEST-01 | Integration (Rust) | `cargo test test_mock_server_v2` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | TEST-02 | Integration (Rust) | `cargo test test_mock_server_v3` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | TEST-03 | Integration (Rust) | `cargo test test_mock_accepts_token` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | CONN-03 | Unit (Rust) | `cargo test test_keychain_roundtrip` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | AUDIT-01 | Unit (Rust) | `cargo test test_audit_log_entry` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | AUDIT-03 | Unit (Rust) | `cargo test test_audit_redaction` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/lib.rs` — library crate target so tests can import modules
- [ ] `src-tauri/tests/mock_server.rs` — integration tests for TEST-01, TEST-02, TEST-03
- [ ] `src-tauri/tests/keychain.rs` — integration tests for CONN-03
- [ ] `src-tauri/tests/audit.rs` — unit tests for AUDIT-01, AUDIT-03
- [ ] `vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `src/test-setup.ts` — WebCrypto polyfill for mockIPC

*All test files are Wave 0 — must be created before production code.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App launches as Tauri desktop window on all 3 OSes | Success Criteria 1 | Requires actual OS window manager | `cargo tauri dev` → verify window opens with React content |
| PAT never appears in logs/config/IPC | CONN-03 | Negative verification across all channels | Search all log output, config files, and IPC payloads for test PAT string |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
