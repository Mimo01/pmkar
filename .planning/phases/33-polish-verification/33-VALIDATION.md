---
phase: 33
slug: polish-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-12
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.1 + jsdom ^29 + RTL 16 + user-event 14; cargo test (mock-server feature) |
| **Config file** | `vitest.config.ts` (setup `src/test-setup.ts`) |
| **Quick run command** | `npx vitest run src/features/groups src/i18n` |
| **Full suite command** | `npm test && npm run lint` (+ `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server` for scenario work) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/features/groups src/i18n`
- **After every plan wave:** Run `npm test && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | GQA-01 | T-33-01 | i18next escapeValue untouched | unit (RED-first locale guard) | `npx vitest run src/i18n/__tests__/groupLocale.test.ts 2>&1 \| grep -E "failed\|FAIL" \| head -5` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | GQA-01 | T-33-01, T-33-02 | Copy-only; React-escaped output | unit | `npx vitest run src/i18n src/features/groups src/features/tickets src/__tests__/App.test.tsx` | ✅ (groupLocale.test.ts from 33-01-01) | ⬜ pending |
| 33-02-01 | 02 | 1 | GQA-02 | T-33-03 | Test helper not imported by app code | unit | `npx vitest run src/features/groups/__tests__/colors.test.ts` | ✅ (src/test-utils/contrast.ts ❌ W0, created here) | ⬜ pending |
| 33-02-02 | 02 | 1 | GQA-02 | T-33-03 | — | unit (token contrast, RED-first) | `npx vitest run src/features/groups/__tests__/contrast.test.ts src/features/groups/__tests__/colors.test.ts` | ❌ W0 | ⬜ pending |
| 33-03-01 | 03 | 1 | GQA-01, GQA-02 | T-33-04, T-33-05, T-33-07 | Control routes compiled only under mock-server feature, behind require_auth, typed mutate body | build | `cargo build --manifest-path src-tauri/Cargo.toml --features mock-server 2>&1 \| tail -3 && cargo build --manifest-path src-tauri/Cargo.toml 2>&1 \| tail -3` | ✅ (build-only) | ⬜ pending |
| 33-03-02 | 03 | 1 | GQA-01, GQA-02 | T-33-04, T-33-05, T-33-06, T-33-07 | Bearer required on control routes; unknown keys 404 | integration (Rust) | `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test mock_server_scenarios` | ❌ W0 | ⬜ pending |
| 33-04-01 | 04 | 2 | GQA-02 | T-33-08 | Focus indicators >= 3:1 | unit | `npx vitest run src/features/groups src/components src/features/tickets/__tests__/TicketFilterBar.test.tsx` | ✅ | ⬜ pending |
| 33-04-02 | 04 | 2 | GQA-02 | T-33-08 | Focus indicators >= 3:1 | unit | `npx vitest run src/features/groups` | ✅ | ⬜ pending |
| 33-05-01 | 05 | 2 | GQA-02 | — | — | unit | `npx vitest run src/features/tickets/__tests__/TicketCard.test.tsx src/features/groups/__tests__/GroupViewPage.test.tsx` | ✅ | ⬜ pending |
| 33-05-02 | 05 | 2 | GQA-02 | T-33-09 | Destructive action text >= 4.5:1; Cancel stays default focus | unit | `npx vitest run src/components/ui/__tests__/menu-wrappers.test.tsx src/features/groups/__tests__/GroupMenuItems.test.tsx src/features/groups/__tests__/DeleteGroupDialog.test.tsx` | ✅ | ⬜ pending |
| 33-06-01 | 06 | 3 | GQA-01 | T-33-10 | Repo-local test reads only | static (AST scan + dynamic-key gate + key existence) | `npx vitest run src/i18n/__tests__/noLiteralStrings.test.ts 2>&1 \| tail -30` | ❌ W0 | ⬜ pending |
| 33-06-02 | 06 | 3 | GQA-01, GQA-02 | T-33-11 | New strings use {{}} interpolation (escaped) | unit + static guard | `npx vitest run src/i18n src/features/groups src/features/tickets src/components` | ❌ W0 (groupTokenUsage.test.ts) | ⬜ pending |
| 33-07-01 | 07 | 3 | GQA-02 | T-33-12 | — | unit | `npx vitest run src/features/groups/__tests__/GroupTabStrip.test.tsx src/features/groups/__tests__/GroupTabStripOverlays.test.tsx` | ✅ | ⬜ pending |
| 33-07-02 | 07 | 3 | GQA-02 | T-33-12, T-33-13 | Group names rendered escaped | unit (scale) | `npx vitest run src/features/groups/__tests__/groupScale.test.tsx` | ❌ W0 | ⬜ pending |
| 33-08-01 | 08 | 4 | GQA-02 | T-33-SC | Blocking human package-legitimacy check before install | checkpoint (human-verify) | `grep -cE '"(vitest-axe\|axe-core)"' package.json \|\| true` | ✅ (package.json) | ⬜ pending |
| 33-08-02 | 08 | 4 | GQA-02 | T-33-SC, T-33-14 | devDependency only, lockfile-pinned; local jsdom run | a11y (axe) | `npx vitest run src/features/groups/__tests__/a11y.axe.test.tsx 2>&1 \| tail -40` | ❌ W0 | ⬜ pending |
| 33-08-03 | 08 | 4 | GQA-02 | T-33-14 | — | a11y (axe) + regression | `npx vitest run src/features/groups src/features/tickets src/i18n` | ✅ (a11y.axe.test.tsx from 33-08-02) | ⬜ pending |
| 33-09-01 | 09 | 5 | GQA-02 | — | — | unit (keyboard) | `npx vitest run src/components/ui/__tests__/AppShell.navKeys.test.tsx src/features/groups/__tests__/GroupTabStrip.test.tsx` | ❌ W0 | ⬜ pending |
| 33-09-02 | 09 | 5 | GQA-02 | T-33-15, T-33-16 | Range limited to visibleKeys; focus always returns to a defined trigger | a11y (keyboard/focus) | `npx vitest run src/features/groups src/features/tickets src/components` | ❌ W0 (a11y.keyboard.test.tsx) | ⬜ pending |
| 33-10-01 | 10 | 6 | GQA-01, GQA-02 | T-33-17 | Mock dummy token only | doc check + manual UAT | `test -f .planning/phases/33-polish-verification/33-UAT.md && grep -c "^### " .planning/phases/33-polish-verification/33-UAT.md` | ❌ W0 (33-UAT.md) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test-utils/contrast.ts` + `src/features/groups/__tests__/contrast.test.ts` — GQA-02 token contrast
- [ ] `src/i18n/__tests__/groupLocale.test.ts` — GQA-01 quotes, SK plurals, glossary
- [ ] `src/i18n/__tests__/noLiteralStrings.test.ts` — GQA-01 static literal scan
- [ ] `src/features/groups/__tests__/a11y.axe.test.tsx` — GQA-02 axe
- [ ] `src/features/groups/__tests__/a11y.keyboard.test.tsx` — GQA-02 keyboard/focus
- [ ] `src/features/groups/__tests__/groupScale.test.tsx` — GQA-02 25 groups
- [ ] `src/features/groups/__tests__/groupTokenUsage.test.ts` — GQA-02 token-usage guard (33-06)
- [ ] `src/components/ui/__tests__/AppShell.navKeys.test.tsx` — GQA-02 tab-strip arrow/Home/End (33-09)
- [ ] `src-tauri/tests/mock_server_scenarios.rs` — mock scenario integration tests (33-03)
- [ ] `npm install -D vitest-axe` (after human-verify) or direct `axe-core` fallback

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Consolidated v0.5.0 milestone UAT (phases 28–33) | GQA-01, GQA-02 | Real-app visual + workflow judgment | Execute 33-UAT against mock server scenarios |
| Visual contrast/legibility in both themes | GQA-02 | Perceptual check beyond token math | Toggle light/dark, inspect tabs, cards, dimmed states |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
