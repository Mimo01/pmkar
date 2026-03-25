---
phase: 11
slug: add-deployment-auto-updates-and-release-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + cargo test (Rust) |
| **Config file** | `vitest.config.ts` / `src-tauri/Cargo.toml` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && cd src-tauri && cargo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | D-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | D-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | D-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | D-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Updater plugin Rust crate installed and capabilities configured
- [ ] `TAURI_SIGNING_PRIVATE_KEY` generation documented in workflow
- [ ] Existing test infrastructure covers frontend — stubs needed for updater store/hooks

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS Gatekeeper bypass | D-09 | Requires physical macOS machine | Right-click > Open on unsigned .dmg |
| Windows SmartScreen bypass | D-10 | Requires physical Windows machine | Click "More info" > "Run anyway" on .msi |
| Auto-update flow end-to-end | D-04, D-05 | Requires published release + running app | Publish test release, verify modal appears |
| Cross-repo publish | D-01 | Requires GitHub PAT + public repo setup | Push tag, verify binaries appear on public repo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
