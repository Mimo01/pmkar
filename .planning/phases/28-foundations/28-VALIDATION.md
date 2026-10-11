---
phase: 28
slug: foundations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-11
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) + Rust `cargo test` |
| **Config file** | `vitest.config.ts`, `src-tauri/Cargo.toml` |
| **Quick run command** | `npx vitest run src/features/groups src/features/tickets src/i18n` ; `cd src-tauri && cargo test groups_db` |
| **Full suite command** | `npm run test && (cd src-tauri && cargo test)` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched area
- **After every plan wave:** Run `npm run test && (cd src-tauri && cargo test)`
- **Before `/gsd:verify-work`:** Full suite must be green (plus `npm run lint`, `npx tsc --noEmit`, `cargo clippy`)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (filled by planner/executor) | | | GRP-06 | SQLi / tampering | params![] only, Rust-side validation | unit | `cargo test groups_db` | ❌ W0 | ⬜ pending |
| | | | GRP-06 | — | N/A | unit | `npx vitest run src/features/groups` | ❌ W0 | ⬜ pending |
| | | | CONI-01 | — | N/A | unit | `npx vitest run src/features/tickets/__tests__/copyStepLabel.test.ts` | ❌ W0 | ⬜ pending |
| | | | CONI-01 | — | N/A | unit | `npx vitest run src/features/tickets/__tests__/copyStepSync.test.ts` | ❌ W0 | ⬜ pending |
| | | | SC4 | — | N/A | unit | `npx vitest run src/features/tickets` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/groups_db.rs` tests module (incl. `survives_reopen` with tempfile)
- [ ] Shared name-validation vector JSON (Rust + TS)
- [ ] `src/features/groups/__tests__/*` (store, validation, colors)
- [ ] `ticketListUtils.test.ts` characterization tests — committed BEFORE extraction
- [ ] `copyStepLabel.test.ts`, `copyStepSync.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Groups survive real app restart | GRP-06 | Requires running Tauri app | Create groups via dev tools/commands, quit, relaunch, confirm present |
| Copy result screens show SK labels | CONI-01 | Visual confirmation | Switch to SK, run a copy against mock server, inspect progress/result screens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
