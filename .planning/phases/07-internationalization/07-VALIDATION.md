---
phase: 7
slug: internationalization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | I18N-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | I18N-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | I18N-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | I18N-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/i18n/__tests__/i18n.test.ts` — stubs for i18n provider and language switching
- [ ] `src/features/connections/__tests__/SettingsPage.test.tsx` — stubs for language selector UI
- [ ] vitest environment may need explicit `environment: 'jsdom'` in vite.config.ts

*Existing vitest infrastructure is in place but test files for i18n are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slovak UI strings display correctly with proper diacritics | I18N-03 | Visual verification of rendered text | Switch to Slovak, check all pages for mojibake or missing diacritics |
| Language persists across app restart | I18N-01 | Requires Tauri app lifecycle | Set language to Slovak, close app, reopen, verify Slovak is still active |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
