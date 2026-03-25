---
phase: 10
slug: improve-codebase-quality-add-linting-increase-test-coverage-apply-best-practices-fix-tech-debt-update-dependencies-and-improve-overall-app-quality
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-24
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), cargo test (Rust backend) |
| **Config file** | `vitest.config.ts` / `src-tauri/Cargo.toml` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test -- --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-T1 | 10-01 | 1 | D-01, D-02 | lint | `npx biome format --check src/ 2>&1 \| tail -5` | biome.json | pending |
| 10-01-T2 | 10-01 | 1 | D-07, D-08 | lint/unit | `npm run lint && npm test 2>&1 \| tail -5` | src/\*\*/\*.ts(x) | pending |
| 10-02-T1 | 10-02 | 1 | D-03 | lint | `cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings 2>&1 \| tail -5` | src-tauri/rustfmt.toml | pending |
| 10-02-T2 | 10-02 | 1 | D-06 | unit | `cd src-tauri && cargo test 2>&1 \| tail -10 && cargo clippy -- -D warnings 2>&1 \| tail -3` | src-tauri/src/triage_db.rs, src-tauri/src/audit.rs | pending |
| 10-03-T1 | 10-03 | 2 | D-10 | build/unit | `npm run build && npm test 2>&1 \| tail -5 && npm run lint 2>&1 \| tail -3` | package.json | pending |
| 10-03-T2 | 10-03 | 2 | D-11 | build/unit | `cd src-tauri && cargo build 2>&1 \| tail -3 && cargo test 2>&1 \| tail -5 && cargo clippy -- -D warnings 2>&1 \| tail -3` | src-tauri/Cargo.toml | pending |
| 10-04-T1 | 10-04 | 3 | D-05 | unit | `npm run test:coverage 2>&1 \| tail -20` | vitest.config.ts | pending |
| 10-04-T2 | 10-04 | 3 | D-04, D-05, D-06 | unit/coverage | `npm run test:coverage 2>&1 \| grep -E "^(All files\|Statements\|Branches\|Functions\|Lines)" \| head -5` | src/\*\*/\_\_tests\_\_/\*.test.ts | pending |
| 10-05-T1 | 10-05 | 4 | D-09 | config | `cat .github/workflows/ci.yml \| head -5 && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" 2>&1 && echo "YAML valid"` | .github/workflows/ci.yml | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] Biome installed and configured — handled by Plan 10-01 Task 1
- [x] Vitest coverage configured — handled by Plan 10-04 Task 1
- [x] Rust test module stubs — handled by Plan 10-02 Task 2

*All Wave 0 items are addressed within plan tasks. No separate Wave 0 needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Biome IDE integration | D-07 | Editor-specific | Verify lint errors appear in VS Code |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
