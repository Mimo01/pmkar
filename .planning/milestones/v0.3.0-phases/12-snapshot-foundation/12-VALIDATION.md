---
phase: 12
slug: snapshot-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust built-in `#[test]` (no external test runner) |
| **Config file** | none — inline `#[cfg(test)]` modules per file |
| **Quick run command** | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db` |
| **Full suite command** | `cargo test --manifest-path src-tauri/Cargo.toml` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db`
- **After every plan wave:** Run `cargo test --manifest-path src-tauri/Cargo.toml`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | POLL-04 | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_store_and_get_snapshot` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | POLL-05 | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_no_changes_on_identical_response` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | POLL-05 | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_field_change_detected` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | POLL-05 | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_comment_count_change_detected` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | POLL-06 | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_watermark_not_advanced_on_no_store` | ❌ W0 | ⬜ pending |
| 12-01-06 | 01 | 1 | POLL-06 | unit | `cargo test --manifest-path src-tauri/Cargo.toml snapshot_db::tests::test_watermark_is_minimum` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/snapshot_db.rs` — new file with `#[cfg(test)]` module covering all POLL-04, POLL-05, POLL-06 tests
- [ ] `src-tauri/Cargo.toml` — add `sha2 = "0.10"` and `hex = "0.4"` direct deps
- [ ] `src-tauri/src/lib.rs` — add `pub mod snapshot_db;`

*All test infrastructure is new — no existing framework to reuse for snapshot-specific tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ADF description instability | POLL-05 | Jira Cloud ADF format may produce non-semantic changes between fetches; requires live Jira instance | Fetch same ticket twice from Jira Cloud v3, compare description field values in stored snapshots |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
