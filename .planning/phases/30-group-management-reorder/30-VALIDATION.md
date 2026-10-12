---
phase: 30
slug: group-management-reorder
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-12
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.1 + jsdom + @testing-library/react ^16 + user-event ^14 |
| **Config file** | `vite.config.ts` (`test.environment: 'jsdom'`, setupFiles `./src/test-setup.ts`) |
| **Quick run command** | `npx vitest run src/features/groups` |
| **Full suite command** | `npm test && npm run lint && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds (quick), ~120 seconds (full) |

Known baseline failures (not regressions, per Phase 29 VALIDATION): `TicketListPage` x2, `StaticMappingRow` x3, `SettingsPage` domain search x2; Rust createmeta x2.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/features/groups`
- **After every plan wave:** Run `npx vitest run src/features/groups src/components/ui && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green (baseline failures excepted)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Filled in by the planner/executor per task. Requirement → test map from RESEARCH.md:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| GRP-02 | Rename popover prefilled+selected; unchanged disables Save; case-only allowed; duplicate/reserved inline; Rust error inline; Enter/Esc | component | `npx vitest run src/features/groups/__tests__/GroupNameForm.test.tsx src/features/groups/__tests__/RenameGroupPopover.test.tsx` | ❌ W0 | ⬜ pending |
| GRP-02 | `validateGroupName` with self excluded | unit | `npx vitest run src/features/groups/__tests__/validation.test.ts` | ✅ extend | ⬜ pending |
| GRP-03 | 8 swatches, aria-checked, roving arrows, aria-label names; pick calls `setGroupColor`; Create preselects `pickDefaultColor` | component | `npx vitest run src/features/groups/__tests__/GroupColorSwatches.test.tsx src/features/groups/__tests__/CreateGroupPopover.test.tsx` | ❌ W0 / ✅ extend | ⬜ pending |
| GRP-04 | Dialog title, plural count EN+SK, empty copy, Cancel default focus, delete invokes `delete_group`, active → `onTabChange('new')`, focus rules, error stays open | component | `npx vitest run src/features/groups/__tests__/DeleteGroupDialog.test.tsx src/features/groups/__tests__/GroupTabStrip.test.tsx` | ❌ W0 / ✅ extend | ⬜ pending |
| GRP-05 | Move items disabled at edges; invokes `move_group`; announcement text; focus returns to `…`; core tabs untouched | component | `npx vitest run src/features/groups/__tests__/GroupTabStrip.test.tsx` | ✅ extend | ⬜ pending |
| GRP-05 | `canMove`, `deleteFocusTarget` pure helpers | unit | `npx vitest run src/features/groups/__tests__/groupMoves.test.ts` | ❌ W0 | ⬜ pending |
| GRP-05 | Order survives restart | store hydrate sort | `npx vitest run src/features/groups/__tests__/groupStore.test.ts` | ✅ | ⬜ pending |
| i18n | EN/SK key parity, sk plural keys, color names | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `GroupNameForm.test.tsx`, `RenameGroupPopover.test.tsx`, `GroupColorSwatches.test.tsx`, `DeleteGroupDialog.test.tsx`, `groupMoves.test.ts` — stubs for GRP-02..05
- [ ] jsdom stubs for Radix menus (`hasPointerCapture`, `releasePointerCapture`, `scrollIntoView`) in `src/test-setup.ts` or shared helper
- [ ] Update existing tests asserting the old "Create" label
- [ ] Install `@radix-ui/react-dropdown-menu@2.2.0` and `@radix-ui/react-context-menu@2.4.0` (exact pins)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VoiceOver announces new position after Move | GRP-05 | jsdom cannot assert real AT output | Enable VoiceOver, open group tab menu, Move right; confirm "{name}, position X of Y" is spoken |
| Shift+F10 / keyboard context menu in WKWebView | GRP-05 | Real WebKit keyboard behavior | Focus a group tab, press Shift+F10; menu opens with first item focused |
| `…` trigger does not shift tab widths | GRP-02..05 | Visual layout | Hover/focus tabs; verify no layout jump |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
