---
phase: 33
slug: polish-verification
status: draft
nyquist_compliant: false
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
| (filled by planner/executor per PLAN.md tasks) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/test-utils/contrast.ts` + `src/features/groups/__tests__/contrast.test.ts` — GQA-02 token contrast
- [ ] `src/i18n/__tests__/groupLocale.test.ts` — GQA-01 quotes, SK plurals, glossary
- [ ] `src/i18n/__tests__/noLiteralStrings.test.ts` — GQA-01 static literal scan
- [ ] `src/features/groups/__tests__/a11y.axe.test.tsx` — GQA-02 axe
- [ ] `src/features/groups/__tests__/a11y.keyboard.test.tsx` — GQA-02 keyboard/focus
- [ ] `src/features/groups/__tests__/groupScale.test.tsx` — GQA-02 25 groups
- [ ] `npm install -D vitest-axe` (after human-verify) or direct `axe-core` fallback

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Consolidated v0.5.0 milestone UAT (phases 28–33) | GQA-01, GQA-02 | Real-app visual + workflow judgment | Execute 33-UAT against mock server scenarios |
| Visual contrast/legibility in both themes | GQA-02 | Perceptual check beyond token math | Toggle light/dark, inspect tabs, cards, dimmed states |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
