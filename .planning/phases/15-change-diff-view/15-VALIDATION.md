---
phase: 15
slug: change-diff-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (frontend) + cargo test (Rust) |
| **Config file** | `vitest.config.ts` / `src-tauri/Cargo.toml` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose && cd src-tauri && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | CHNG-01 | unit | `cargo test snapshot` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | CHNG-01 | unit | `cargo test changes` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | CHNG-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 2 | CHNG-02 | manual | visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/snapshot_store.rs` — test stubs for new columns and Tauri commands
- [ ] `src/tests/ChangesTab.test.tsx` — stubs for diff view component rendering
- [ ] Existing vitest + cargo test infrastructure covers framework needs

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual badge on changed ticket | CHNG-01 | CSS/visual indicator | Open ticket list, verify dot appears on changed tickets |
| Diff panel layout | CHNG-02 | Visual layout verification | Open changed ticket detail, verify old/new values displayed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
