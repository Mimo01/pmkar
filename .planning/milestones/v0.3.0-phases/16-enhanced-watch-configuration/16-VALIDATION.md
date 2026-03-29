---
phase: 16
slug: enhanced-watch-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + Rust `cargo test` (backend) |
| **Config file** | `vite.config.ts` (Vitest config embedded) |
| **Quick run command** | `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx` |
| **Full suite command** | `npm run test -- --run` (frontend) + `cargo test` (Rust) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx`
- **After every plan wave:** Run `npm run test -- --run` + `cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | WTCH-02 | integration | `cargo test test_mock_v3_user_search` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | WTCH-01 | unit | `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx` | ✅ extend | ⬜ pending |
| 16-01-03 | 01 | 1 | WTCH-01 | unit | same file | ✅ extend | ⬜ pending |
| 16-02-01 | 02 | 1 | WTCH-02 | unit | `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx` | ✅ extend | ⬜ pending |
| 16-02-02 | 02 | 1 | WTCH-02 | unit | same file | ✅ extend | ⬜ pending |
| 16-02-03 | 02 | 1 | WTCH-02 | unit | same file | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/mock_server.rs` — add `/rest/api/3/user/search` route to `build_v3_router` with domain-filter handler
- [ ] `src-tauri/tests/mock_server.rs` — add `test_mock_v3_user_search_returns_domain_users` test stub

*Existing frontend test infrastructure (`SettingsPage.test.tsx`) covers all frontend requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Privacy warning renders with correct yellow styling | WTCH-02 | Visual appearance | 1. Connect Cloud instance 2. Search domain with hidden emails 3. Verify yellow banner appears |
| Domain input auto-prepends @ visually | WTCH-01 | Visual UX | 1. Type "acme.com" in domain field 2. Verify "@" appears in input |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
