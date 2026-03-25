---
phase: quick
plan: 260325-kf1
subsystem: ui-shell
tags: [layout, header, viewport, appshell, setup-wizard]
dependency_graph:
  requires: []
  provides: [fixed-header-all-routes]
  affects: [AppShell, App, SetupWizard]
tech_stack:
  added: []
  patterns: [h-screen overflow-hidden viewport-constraint, flex-1 fill-parent]
key_files:
  modified:
    - src/components/ui/AppShell.tsx
    - src/App.tsx
    - src/features/connections/SetupWizard.tsx
decisions:
  - AppShell root changed to h-screen overflow-hidden — viewport constraint prevents header from scrolling off-screen
  - SetupWizard fixed top-0 brand accent bar removed — AppShell header replaces it, prevents overlap
  - SetupWizard root changed from min-h-screen to flex-1 — fills AppShell main area without overflowing
metrics:
  duration: 6 min
  completed_date: "2026-03-25"
  tasks: 2
  files: 3
---

# Quick Task 260325-kf1: Make App Header Always Visible Summary

**One-liner:** AppShell constrained to viewport height with h-screen overflow-hidden, wizard wrapped in AppShell so pmkar header is pinned and visible on every route.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Pin AppShell header to viewport top | 1f36ce8 | src/components/ui/AppShell.tsx |
| 2 | Wrap wizard route in AppShell | 650dd39 | src/App.tsx, src/features/connections/SetupWizard.tsx |

## Changes Made

### Task 1: AppShell root div constraint

Changed `className` on AppShell root div:
- FROM: `min-h-screen bg-brand-bg text-brand-text flex flex-col`
- TO: `h-screen bg-brand-bg text-brand-text flex flex-col overflow-hidden`

This single change ensures the shell container cannot grow beyond the viewport. The header takes its natural height at the top, and the flex-1 main area fills remaining space with its own scroll handling.

### Task 2: Wizard wrapped in AppShell

**App.tsx** — wizard branch now wraps SetupWizard in AppShell:
```tsx
<AppShell>
  <SetupWizard initialStep={initialStep} onComplete={() => setEditStep(null)} />
</AppShell>
```

**SetupWizard.tsx** — two adjustments:
1. Root div `min-h-screen` changed to `flex-1` so it fills AppShell's main area
2. Removed the `fixed top-0` brand accent bar (AppShell header already provides it; leaving it would cause visual overlap)

## Verification

- `npx tsc --noEmit` passes (one pre-existing unrelated error in TicketFilterBar.test.tsx)
- All 5 App.tsx render branches now use `<AppShell>` (grep count: 9 occurrences)
- 385 tests passing; 16 pre-existing failures in CopyPreviewModal.test.tsx unrelated to this change
- AppShell root is `h-screen overflow-hidden`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed SetupWizard fixed top-0 brand accent bar**
- **Found during:** Task 2
- **Issue:** SetupWizard had a `fixed top-0 left-0 right-0 z-50` div rendering a 2px brand accent bar. After wrapping wizard in AppShell, this bar would visually overlap the new header.
- **Fix:** Removed the fixed position brand bar from SetupWizard.tsx — the AppShell header already provides the brand accent underline on its bottom edge.
- **Files modified:** src/features/connections/SetupWizard.tsx
- **Commit:** 650dd39

## Known Stubs

None.

## Self-Check: PASSED

- src/components/ui/AppShell.tsx — modified, committed 1f36ce8
- src/App.tsx — modified, committed 650dd39
- src/features/connections/SetupWizard.tsx — modified, committed 650dd39
