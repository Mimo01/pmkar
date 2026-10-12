---
phase: 28
slug: foundations
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-11
audited: 2026-10-12
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
| 28-01-T1 | 01 | 1 | GRP-06 (SC4) | T-28-01 | Characterization committed before refactor | component | `npx vitest run src/features/tickets/__tests__/ticketListParity.test.tsx` | ✅ | ✅ green |
| 28-01-T2 | 01 | 1 | GRP-06 (SC4) | T-28-01 | N/A | unit | `npx vitest run src/features/tickets/__tests__/ticketListUtils.test.ts` | ✅ | ✅ green |
| 28-01-T3 | 01 | 1 | GRP-06 (SC4) | T-28-01 | Page tests unchanged and green | component | `npx vitest run src/features/tickets` | ✅ | ✅ green¹ |
| 28-02-T1 | 02 | 1 | CONI-01 | T-28-05 | Sync test non-vacuous (min 8 ids) | unit | `npx vitest run src/features/tickets/__tests__/copyStepLabel.test.ts src/features/tickets/__tests__/copyStepSync.test.ts src/i18n` | ✅ | ✅ green |
| 28-02-T2 | 02 | 1 | CONI-01 | T-28-03 | Text children only, no innerHTML | component | `npx vitest run src/features/tickets/CopyResultModal.test.tsx src/features/tickets/__tests__/CopyResultPage.test.tsx` | ✅ | ✅ green |
| 28-03-T1 | 03 | 1 | GRP-06 | T-28-07 | No red tokens; >=3:1 contrast; token order via deep-equal test (no CSS-parity asserts yet, file fully green) | unit | `npx vitest run src/features/groups/__tests__/colors.test.ts` | ✅ | ✅ green |
| 28-03-T2 | 03 | 1 | GRP-06 | T-28-06 | CSS-parity describe added RED, then CSS vars make it GREEN; CSS == colors.ts | unit | `npx vitest run src/features/groups/__tests__/colors.test.ts` | ✅ | ✅ green |
| 28-04-T1 | 04 | 1 | GRP-06 | T-28-SC | Blocking human crate check | manual | n/a (checkpoint) | n/a | ✅ manual (approved) |
| 28-04-T2 | 04 | 1 | GRP-06 | T-28-09 | Rust-authoritative validation, shared vectors | unit | `cd src-tauri && cargo test groups_db` | ✅ | ✅ green |
| 28-04-T3 | 04 | 1 | GRP-06 | T-28-08, T-28-10, T-28-11 | params![] only, scope filter, FK + tx | unit | `cd src-tauri && cargo test groups_db` | ✅ | ✅ green |
| 28-05-T1 | 05 | 2 | GRP-06 | T-28-14, T-28-16 | Rust-derived scope, lock order | unit | `cd src-tauri && cargo test groups_commands` | ✅ | ✅ green |
| 28-05-T2 | 05 | 2 | GRP-06 | T-28-15 | N/A | build | `cd src-tauri && cargo build && cargo test` | ✅ | ✅ green¹ |
| 28-06-T1 | 06 | 3 | GRP-06 | T-28-20 | TS mirror == Rust vectors | unit | `npx vitest run src/features/groups/__tests__/validation.test.ts` | ✅ | ✅ green |
| 28-06-T2 | 06 | 3 | GRP-06 | T-28-19, T-28-21 | ?? null selector; color coercion; rehydrateAfter waits for persist; App hydrates at startup only | unit | `npx vitest run src/features/groups src/App.test.tsx src/__tests__/App.test.tsx` | ✅ | ✅ green |
| 28-06-T3 | 06 | 3 | GRP-06 (D-01) | T-28-23 | list_groups invoked only after set_connection_meta settles (server only) | component | `npx vitest run src/features/connections src/features/groups` | ✅ | ✅ green¹ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

¹ All phase-28 tests in this suite pass. It also contains baseline failures that predate v0.5.0 and don't touch phase-28 code: TicketListPage ×2 and SettingsPage domain search ×2 (Vitest), and the createmeta two-page fixture ×2 (Rust).

---

## Wave 0 Requirements

- [x] `src-tauri/src/groups_db.rs` tests module (incl. `survives_reopen` with tempfile)
- [x] Shared name-validation vector JSON (Rust + TS)
- [x] `src/features/groups/__tests__/*` (store, validation, colors)
- [x] `ticketListUtils.test.ts` characterization tests — committed BEFORE extraction
- [x] `copyStepLabel.test.ts`, `copyStepSync.test.ts`
- [x] Ordering tests in `SettingsPage.test.tsx` / `SetupWizard.test.tsx` (extend existing) for re-hydration after `set_connection_meta`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Groups survive real app restart | GRP-06 | Requires running Tauri app | Create groups via dev tools/commands, quit, relaunch, confirm present |
| Copy result screens show SK labels | CONI-01 | Visual confirmation | Switch to SK, run a copy against mock server, inspect progress/result screens |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-12

---

## Validation Audit 2026-10-12

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 15 tasks have their tests in place (Wave 0 files present). Results: Rust `groups_db` + `groups_commands` 24/24 green; Vitest groups/tickets/i18n/connections/App 668/672 green. The 4 failures (TicketListPage ×2, SettingsPage domain search ×2) are baseline failures that predate v0.5.0, and none of them touches phase-28 code. Shared name vectors are checked by `groups_db::tests::shared_vectors_match` and `validation.test.ts`, and restart persistence by `groups_db::tests::groups_survive_reopen`.
