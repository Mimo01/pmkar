---
phase: 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use
plan: "01"
subsystem: frontend-ui
tags: [shadcn, tailwind, lucide, i18n, appshell, design-system]
dependency_graph:
  requires: []
  provides:
    - shadcn/ui component library initialized
    - cn() utility for class merging
    - Lucide React icon library
    - CSS token bridge between brand tokens and shadcn semantic tokens
    - Redesigned AppShell with Linear-inspired styling
    - All new i18n keys for Plans 02-05
  affects:
    - All subsequent Phase 08 plans (shadcn components, Lucide icons, i18n keys)
tech_stack:
  added:
    - lucide-react@1.0.1 (icon library)
    - clsx@2.1.1 (class utility)
    - tailwind-merge@3.5.0 (Tailwind class merging)
    - class-variance-authority (shadcn variant system)
    - "@types/node" (Node type definitions for test setup)
    - "@radix-ui/react-tooltip" (via shadcn tooltip component)
  patterns:
    - shadcn/ui component pattern with cn() utility
    - CSS variable bridging (brand tokens aliased to shadcn semantic tokens)
    - Lucide icon usage replacing hand-coded SVGs
key_files:
  created:
    - components.json (shadcn/ui configuration)
    - src/lib/utils.ts (cn() class merging utility)
    - src/components/ui/button.tsx (shadcn Button)
    - src/components/ui/card.tsx (shadcn Card)
    - src/components/ui/dialog.tsx (shadcn Dialog)
    - src/components/ui/tabs.tsx (shadcn Tabs)
    - src/components/ui/badge.tsx (shadcn Badge)
    - src/components/ui/separator.tsx (shadcn Separator)
    - src/components/ui/skeleton.tsx (shadcn Skeleton)
    - src/components/ui/scroll-area.tsx (shadcn ScrollArea)
    - src/components/ui/tooltip.tsx (shadcn Tooltip)
    - src/components/ui/progress.tsx (shadcn Progress)
  modified:
    - src/index.css (shadcn semantic token aliases merged with brand tokens)
    - tsconfig.json (@/ path alias added)
    - vite.config.ts (@/ path alias added, test.resolve.alias added)
    - vitest.config.ts (@/ path alias added for test resolution)
    - src/components/ui/AppShell.tsx (redesigned with Lucide icons + shadcn Tooltip)
    - src/i18n/locales/en.json (all new UI i18n keys added)
    - src/i18n/locales/sk.json (all new UI i18n keys added)
    - package.json (5 new dependencies)
decisions:
  - "Use relative import in AppShell.tsx for tooltip (./tooltip) instead of @/ alias — fixes vitest test resolution without requiring mocks"
  - "Fix pre-existing TypeScript strict mode errors in SettingsPage, DevStatusPanel, OverviewTab, copyStore, test-setup — build was already broken"
  - "Add @/ alias to vitest.config.ts — separate vitest config file was overriding vite.config.ts test settings"
metrics:
  duration: "9 minutes"
  completed_date: "2026-03-24"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 20
---

# Phase 8 Plan 01: shadcn/ui Foundation and AppShell Redesign Summary

**One-liner:** shadcn/ui initialized with 10 components, Lucide icons installed, brand CSS tokens bridged to shadcn semantic tokens, all downstream i18n keys added, AppShell redesigned with Linear-inspired styling replacing hand-coded SVGs.

## What Was Built

### Task 1: shadcn/ui Setup, CSS Token Merge, i18n Keys

**Path alias configuration:** Added `@/*` → `./src/*` to tsconfig.json and vite.config.ts `resolve.alias`, enabling the `@/` import pattern required by shadcn components.

**Package installations:**
- `lucide-react` — Lucide icon library
- `clsx` + `tailwind-merge` + `class-variance-authority` — shadcn utility dependencies
- `@types/node` — Node type definitions for test polyfill

**shadcn/ui initialization:** Created `components.json` with `style: "default"`, `baseColor: "neutral"`, Tailwind v4 mode, `iconLibrary: "lucide"`. Created `src/lib/utils.ts` with `cn()` utility.

**10 components installed:** button, card, dialog, tabs, badge, separator, skeleton, scroll-area, tooltip, progress — all at `src/components/ui/`.

**CSS token merge in `src/index.css`:** Added shadcn semantic token aliases inside `@theme {}` that reference existing brand tokens (e.g., `--background: var(--color-brand-bg)`). Dark theme overrides added to `body.dark {}`. All existing brand tokens preserved.

**i18n keys:** Added ~22 new keys to both `en.json` and `sk.json` covering: `tickets.empty.*`, `ignored.empty.*`, `linked.empty.*`, `copy.progress.*`, `detail.back`, `ignored.confirm.*`, `audit.empty.*`, `error.fetchFailed`, `error.copyFailed`, `settings.back` updated to "Back to App". Updated existing `detail.ignored` and `detail.ignore` values to align with new UX copy.

### Task 2: AppShell Redesign

Rewrote `src/components/ui/AppShell.tsx`:
- **Removed** `GearIcon` and `TerminalIcon` hand-coded SVG function components entirely
- **Added** Lucide `Settings` and `Terminal` icon imports
- **Added** `shadcn Tooltip` + `TooltipProvider` wrapping both icon buttons with 300ms delay
- **Updated** brand wordmark to `text-xs font-semibold tracking-tight` (per UI-SPEC Typography Label tier)
- **Added** `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` to all interactive elements
- **Changed** nav tab transitions to `transition-colors duration-150`
- **Preserved** full `AppShellProps` interface — no consumer changes needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing TypeScript build errors prevented build from passing**
- **Found during:** Task 1 verification
- **Issue:** Build was already broken before this plan: `SettingsPage.tsx` had unused `onEdit` param, unsafe type cast, `useRef` without initial value; `DevStatusPanel.tsx` and `OverviewTab.tsx` imported but never used `t`; `AuditLogPage.test.tsx` had unused `container` variable; `copyStore.ts` had type mismatch; `test-setup.ts` used `NodeJS.ArrayBufferView` without types
- **Fix:** Removed unused imports, prefixed unused destructured params with `_`, fixed type casts to use `unknown` as intermediary, installed `@types/node`, rewrote crypto polyfill to use `require('crypto')`
- **Files modified:** `SettingsPage.tsx`, `DevStatusPanel.tsx`, `OverviewTab.tsx`, `AuditLogPage.test.tsx`, `copyStore.ts`, `test-setup.ts`
- **Commits:** 9ab4d9b

**2. [Rule 2 - Missing Config] vitest.config.ts lacked @/ alias, causing test failures after AppShell used Tooltip import**
- **Found during:** Task 2 verification
- **Issue:** A separate `vitest.config.ts` was overriding vite.config.ts test settings. The vitest config had no `resolve.alias`, so `@/lib/utils` imported by tooltip.tsx failed to resolve in the test environment
- **Fix:** Added `path` import and `resolve.alias: { "@": path.resolve(__dirname, "./src") }` to `vitest.config.ts`. Also switched AppShell tooltip import from `@/components/ui/tooltip` to `./tooltip` (relative) for clarity
- **Files modified:** `vitest.config.ts`, `src/components/ui/AppShell.tsx`
- **Commits:** 4c94f15

## Verification Results

- `npm run build` — Exit 0 (TypeScript clean, vite bundled 1828 modules, 436KB JS)
- `npm run test` — 114/114 tests passed across 14 test files

## Known Stubs

None — all 10 shadcn components are fully installed (not stubs), CSS token bridge is fully wired, i18n keys have real string values. AppShell redesign is fully functional.

## Self-Check: PASSED

All key files exist. All commits verified in git history. Build and tests pass clean.
