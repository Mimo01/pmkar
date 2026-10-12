---
phase: 30-group-management-reorder
plan: 01
subsystem: ui
tags: [radix, dropdown-menu, context-menu, shadcn, jsdom, vitest]
requires: []
provides:
  - DropdownMenu shadcn wrapper (src/components/ui/dropdown-menu.tsx)
  - ContextMenu shadcn wrapper (src/components/ui/context-menu.tsx)
  - jsdom pointer-capture and scrollIntoView stubs
affects: [30-group-management-reorder]
tech-stack:
  added: ["@radix-ui/react-dropdown-menu@2.2.0", "@radix-ui/react-context-menu@2.4.0"]
  patterns: [shadcn forwardRef wrappers, destructive item variant]
key-files:
  created:
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/context-menu.tsx
    - src/components/ui/__tests__/menu-wrappers.test.tsx
  modified: [package.json, package-lock.json, src/test-setup.ts]
key-decisions:
  - "Exact-pinned both Radix packages (--save-exact), per react-popover precedent"
requirements-completed: [GRP-05]
duration: 10min
completed: 2026-10-12
---

# Phase 30 Plan 01: Radix menu primitives Summary

Exact-pinned Radix DropdownMenu and ContextMenu with shadcn wrappers (destructive item variant) and jsdom stubs, proven by smoke tests.

## Task 1: Package legitimacy checkpoint (resolved by orchestrator)

Approved by the human. `npm view` findings: both packages come from github.com/radix-ui/primitives, maintainers hadihallak, chancestrickland, mark-workos, npm-workos, and have no preinstall/install/postinstall scripts. Both versions were published 2026-10-12 (under 3 days old). The plan's age rule (step 4) would have asked for older versions, but the human was told and explicitly chose to keep the planned versions, so 2.2.0 and 2.4.0 were installed.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 2 | a715e89 | Installed packages, created both wrappers |
| 3 | b3fcae4 | Test-setup stubs and 4 smoke tests |

## Verification
- `npm ls` resolves each package once; `npx tsc --noEmit` exits 0.
- `npx vitest run src/components/ui src/features/groups`: 17 files, 198 tests pass.

## Deviations from Plan

1. **[Rule 3 - Blocking] Worktree base reset.** The worktree started at c4d9cb4, not the expected base cec4cd8. I ran the sanctioned `git reset --hard cec4cd8` on the clean worktree-agent branch.
2. **Test adjustment.** Opening the dropdown with the keyboard already focuses the first item. The test asserts that, then one ArrowDown to confirm the disabled item is skipped. This is a test-expectation fix, not a wrapper change.
3. TDD note: the wrappers were already committed in Task 2, so the Task 3 tests passed on first run apart from the expectation fix above. There was no separate RED commit.
4. The jsdom stubs were not needed for these tests to pass, but were added as planned for later menu tests.

## Known Stubs
None.

## Self-Check: PASSED
