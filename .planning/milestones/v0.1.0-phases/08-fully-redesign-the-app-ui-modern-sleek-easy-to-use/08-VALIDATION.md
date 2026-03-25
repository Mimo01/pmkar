---
phase: 8
slug: fully-redesign-the-app-ui-modern-sleek-easy-to-use
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | visual + unit | `npm run test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest init` — Initialize shadcn/ui with Tailwind v4
- [ ] Install shadcn components: button, card, dialog, tabs, badge, separator, skeleton, scroll-area, tooltip, progress
- [ ] Install lucide-react icon library

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card layout matches Linear-inspired design | D-01, D-07 | Visual appearance | Compare ticket list with Linear UI reference |
| Dark/light theme consistency | D-02 | Visual both themes | Toggle theme, verify all surfaces use correct tokens |
| Full-page detail navigation feel | D-10 | UX flow | Click ticket → verify full page → click back → verify tab preserved |
| Copy modal progress visualization | D-18 | Animation timing | Trigger copy → verify progress bar + step labels update smoothly |
| Loading skeleton appearance | D-19 | Visual polish | Trigger fetch → verify 3 skeleton cards appear, no spinner in list area |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
