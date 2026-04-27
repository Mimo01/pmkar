---
phase: 18
slug: v2-v3-translation-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust `cargo test` (built-in) |
| **Config file** | `src-tauri/Cargo.toml` |
| **Quick run command** | `cargo test -p pmkar-lib --lib -- field_transform` |
| **Full suite command** | `cargo test -p pmkar-lib` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cargo test -p pmkar-lib --lib -- field_transform`
- **After every plan wave:** Run `cargo test -p pmkar-lib`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | TRAN-01 | — | N/A | unit | `cargo test -p pmkar-lib --lib -- field_transform::user` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | TRAN-06 | — | N/A | unit | `cargo test -p pmkar-lib --lib -- field_transform::identity` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | TRAN-02 | — | N/A | unit | `cargo test -p pmkar-lib --lib -- field_transform::version` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | TRAN-03 | — | N/A | unit | `cargo test -p pmkar-lib --lib -- field_transform::component` | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 1 | TRAN-05 | — | N/A | unit | `cargo test -p pmkar-lib --lib -- field_transform::wiki_to_adf` | ❌ W0 | ⬜ pending |
| 18-04-01 | 04 | 2 | TRAN-04 | — | N/A | integration | `cargo test -p pmkar-lib --test integration -- field_transform` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/field_transform/mod.rs` — module stub with `apply_mapping` signature
- [ ] `src-tauri/src/field_transform/user.rs` — stub for user resolution
- [ ] `src-tauri/src/field_transform/version.rs` — stub for version lookup
- [ ] `src-tauri/src/field_transform/component.rs` — stub for component lookup
- [ ] `src-tauri/src/field_transform/wiki_to_adf.rs` — stub for wiki→ADF post-processor
- [ ] `src-tauri/src/field_transform/identity.rs` — stub for batched user resolution
- [ ] `src-tauri/src/field_transform/pipeline.rs` — stub for `apply_mapping` pipeline

*Wave 0 creates the module skeleton so subsequent waves can build + test in isolation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Partial array resolution renders correctly in Phase 22 | TRAN-01 (D-03) | Phase 22 not yet implemented | Verify `UnresolvedPerson` variant flows correctly through `ResolvedFields.gaps` |
| ADF mention degrades gracefully to plain text | TRAN-05 (D-05) | Requires live Jira environment to test fallback | Create ticket with `[~nonexistent]` mention, verify output is `@nonexistent` plain text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
