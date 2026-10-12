---
phase: 29
slug: tab-strip-group-view
status: draft
nyquist_compliant: true
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
| 29-01-T1 | 01 | 1 | GVIEW-01 (tab stability) | T-29-02, T-29-03 | Stale hydrates dropped; failed hydrate keeps last good groups | unit | `npx vitest run src/features/groups/__tests__/groupStore.test.ts` | ✅ (rewritten) | ⬜ pending |
| 29-01-T2 | 01 | 1 | GRP-01 | T-29-01 | Zero-width / BOM / NEL names agree TS vs Rust; invisible-only rejected | unit (TS + Rust vectors) | `npx vitest run src/features/groups/__tests__/validation.test.ts && cargo test --manifest-path src-tauri/Cargo.toml groups_db` | ✅ | ⬜ pending |
| 29-02-T1 | 02 | 1 | GVIEW-03, GVIEW-02, (cross) fallback | — | N/A | unit | `npx vitest run src/features/groups/__tests__/groupTabs.test.ts src/features/groups/__tests__/groupBadge.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 29-02-T2 | 02 | 1 | GVIEW-04 | T-29-05 | Same restore write path | component | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ✅ | ⬜ pending |
| 29-02-T3 | 02 | 1 | GVIEW-05, (cross) i18n parity | T-29-07 | Reserved names unchanged (size 6) | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts src/i18n/__tests__/translations.test.ts src/features/groups/__tests__/validation.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 29-03-T1 | 03 | 1 | GRP-01 | T-29-SC | Human verifies package before install | checkpoint | `npm view @radix-ui/react-popover repository.url scripts` | n/a | ⬜ pending |
| 29-03-T2 | 03 | 1 | GRP-01 | T-29-SC, T-29-08 | Lockfile pins version | component | `npx vitest run src/components/ui/__tests__/popover.test.tsx` | ❌ W0 (created in task) | ⬜ pending |
| 29-04-T1 | 04 | 2 | GRP-01 | T-29-09, T-29-10, T-29-11 | Inline validation; mapped errors only; single submit | component | `npx vitest run src/features/groups/__tests__/CreateGroupPopover.test.tsx` | ❌ W0 (created in task) | ⬜ pending |
| 29-05-T1 | 05 | 2 | GVIEW-03 | T-29-12, T-29-14 | Corrupt snapshots skipped; no selector loop | component (hook) | `npx vitest run src/features/groups/__tests__/useGroupMembers.test.tsx` | ❌ W0 (created in task) | ⬜ pending |
| 29-05-T2 | 05 | 2 | GVIEW-03, GVIEW-04, GVIEW-05, GVIEW-06 | T-29-13, T-29-15 | Text-only rendering of snapshot data | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` | ❌ W0 (created in task) | ⬜ pending |
| 29-06-T1 | 06 | 3 | GVIEW-01, GVIEW-02, GRP-01 (create-then-focus) | T-29-16 | Color token coerced; names as text | component | `npx vitest run src/features/groups/__tests__/GroupTabStrip.test.tsx` | ❌ W0 (created in task) | ⬜ pending |
| 29-06-T2 | 06 | 3 | GVIEW-01, GVIEW-03, GVIEW-05, (cross) fallback | T-29-18, T-29-19 | Fallback converges; tab not persisted | integration | `npx vitest run src/__tests__/App.test.tsx` | ✅ (extended) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each test file is created by the task that implements the behavior (tdd="true" tasks write tests first), so no separate Wave 0 plan is needed:
- [ ] `src/features/groups/__tests__/CreateGroupPopover.test.tsx` — GRP-01 (29-04-T1)
- [ ] `src/features/groups/__tests__/GroupTabStrip.test.tsx` — GVIEW-01, GVIEW-02 (29-06-T1; stubs for `ResizeObserver`, `scrollIntoView`, `scrollBy`, `matchMedia`)
- [ ] `src/features/groups/__tests__/GroupViewPage.test.tsx`, `useGroupMembers.test.tsx` — GVIEW-03..06 (29-05)
- [ ] `src/features/groups/__tests__/groupBadge.test.ts`, `groupTabs.test.ts`, `groupI18n.test.ts` (29-02)
- [ ] `src/components/ui/__tests__/popover.test.tsx` (29-03)
- [ ] `npm install @radix-ui/react-popover` after human legitimacy check (29-03-T1)

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
