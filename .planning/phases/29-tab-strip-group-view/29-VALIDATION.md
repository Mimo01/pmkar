---
phase: 29
slug: tab-strip-group-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-12
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.1 + jsdom + @testing-library/react ^16 + user-event ^14 |
| **Config file** | `vite.config.ts` (`test.environment: 'jsdom'`, `setupFiles: ./src/test-setup.ts`) |
| **Quick run command** | `npx vitest run src/features/groups src/components/ui` |
| **Full suite command** | `npm test && npm run lint && npx tsc --noEmit` |
| **Estimated runtime** | ~60 seconds |

Known baseline failures (NOT regressions): vitest `TicketListPage` x2, `StaticMappingRow` x3, `SettingsPage` domain search x2; Rust createmeta two-page fixture tests x2.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/features/groups` (plus any touched ui test)
- **After every plan wave:** Run `npm test && npm run lint && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green (except documented baseline failures)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (filled by planner) | — | — | GRP-01 | — | Name validation rejects empty/duplicate/reserved/too-long inline | component | `npx vitest run src/features/groups/__tests__/CreateGroupPopover.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | GVIEW-01, GVIEW-02 | — | N/A | unit/component | `npx vitest run src/features/groups/__tests__/GroupTabStrip.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | — | — | GVIEW-03..06 | — | N/A | unit/component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx src/features/groups/__tests__/groupBadge.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | (cross) i18n parity | — | N/A | unit | `npx vitest run src/i18n/__tests__/translations.test.ts` | ✅ | ⬜ pending |
| TBD | — | — | (cross) active-group fallback | — | N/A | unit | `npx vitest run src/features/groups/__tests__/groupTabs.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/groups/__tests__/CreateGroupPopover.test.tsx` — GRP-01
- [ ] `src/features/groups/__tests__/GroupTabStrip.test.tsx` — GVIEW-01, GVIEW-02 (stubs for `ResizeObserver`, `scrollIntoView`, `matchMedia`)
- [ ] `src/features/groups/__tests__/GroupViewPage.test.tsx` — GVIEW-03..06
- [ ] `src/features/groups/__tests__/groupBadge.test.ts` and `groupTabs.test.ts`
- [ ] `npm install @radix-ui/react-popover`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Strip overflow scroll with ~15 groups, core tabs pinned | GVIEW-02 | Real layout/scroll metrics not available in jsdom | Create ~15 groups via popover, scroll strip, verify arrows + pinned core tabs |
| Long-name truncation + tooltip | GVIEW-02 | Visual | Create group with long name, hover tab |
| EN/SK switch, light/dark, keyboard-only walk-through | GRP-01, GVIEW-01 | Visual / a11y | Per D-19 UAT checklist |

Populated-view UAT deferred to Phase 31.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
