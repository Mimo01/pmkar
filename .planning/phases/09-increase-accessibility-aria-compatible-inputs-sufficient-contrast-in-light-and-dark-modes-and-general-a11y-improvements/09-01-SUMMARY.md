---
phase: 09-increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements
plan: "01"
subsystem: ui
tags: [accessibility, wcag, aria, contrast, dark-mode, tailwind, css-tokens]

# Dependency graph
requires:
  - phase: 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use
    provides: AppShell and TicketDetailPage components with tab UI and CSS token system
provides:
  - WCAG AA compliant dark mode CSS color tokens (--color-brand-muted #7f7f7f, 4.52:1 ratio)
  - Main landmark on AppShell content area
  - Tooltip aria-hidden to prevent double-announcement by screen readers
  - StatusBadge dark mode text classes passing 4.5:1+ contrast ratios
  - Complete tab ARIA pattern with id/aria-labelledby/tabIndex on tab buttons and tabpanel
affects:
  - 09-02
  - 09-03
  - 09-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WCAG AA dark mode tokens: override color variables in body.dark block only, not @theme"
    - "Tooltip aria-hidden pattern: buttons carry aria-label, TooltipContent gets aria-hidden to avoid duplication"
    - "Tab ARIA pattern: id on buttons, aria-labelledby+tabIndex on tabpanel, aria-controls linking both"

key-files:
  created: []
  modified:
    - src/index.css
    - src/components/ui/AppShell.tsx
    - src/features/tickets/TicketDetailPage.tsx

key-decisions:
  - "Set dark muted token to #7f7f7f (4.52:1 on #161617) — passes WCAG AA for normal text; only change in body.dark block so light mode (#8c8c92) is unaffected"
  - "aria-hidden on TooltipContent, not TooltipTrigger — button already has aria-label, tooltip is purely a visual affordance for mouse users"
  - "tabIndex=0 on tabpanel — required so keyboard users can focus the panel after selecting a tab"

patterns-established:
  - "Dark mode CSS override: modify body.dark variables only, never touch @theme block light values"
  - "Semantic tab pattern: role=tab + id + aria-controls, role=tabpanel + aria-labelledby + tabIndex=0"

requirements-completed: [A11Y-01, A11Y-05]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 9 Plan 01: Dark Mode Contrast Tokens and Core ARIA Landmarks Summary

**WCAG AA dark mode contrast via CSS token fix (#7f7f7f at 4.52:1), main landmark in AppShell, and complete tab/tabpanel ARIA in TicketDetailPage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T10:12:00Z
- **Completed:** 2026-03-24T10:20:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Fixed `--color-brand-muted` and `--muted-foreground` in `body.dark` to `#7f7f7f`, achieving 4.52:1 contrast on `#161617` background (passes WCAG AA normal text threshold)
- Added `role="main"` to AppShell content area and `aria-hidden="true"` to both TooltipContent elements to eliminate screen reader double-announcement
- Updated StatusBadge in TicketDetailPage with dark mode variants: `dark:text-blue-400` (6.55:1), `dark:text-green-400` (8.44:1), `dark:text-red-400` (6.54:1)
- Completed tab ARIA: added `id={tab-${tab.id}}` on tab buttons and `aria-labelledby={tab-${activeTab}} tabIndex={0}` on the tabpanel div

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix dark mode contrast tokens and AppShell semantic structure** - `49071fc` (feat)
2. **Task 2: Fix StatusBadge dark mode contrast and complete tab panel ARIA** - `cbe7bbc` (feat)

**Plan metadata:** _(see final docs commit)_

## Files Created/Modified
- `src/index.css` - Changed `--color-brand-muted` and `--muted-foreground` in `body.dark` block from `#6b6b6f` to `#7f7f7f`
- `src/components/ui/AppShell.tsx` - Added `role="main"` to content wrapper, `aria-hidden="true"` to both TooltipContent elements
- `src/features/tickets/TicketDetailPage.tsx` - Added dark mode text variants to StatusBadge, added `id` to tab buttons, added `aria-labelledby` and `tabIndex=0` to tabpanel

## Decisions Made
- Changed dark muted color to `#7f7f7f` specifically (not `#808080` or similar) — confirmed 4.52:1 ratio against `#161617` as documented in RESEARCH.md
- Left `@theme` block light mode value (`#8c8c92`) untouched — dark override is only in `body.dark` block per plan spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 114 existing tests passed after changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dark mode contrast baseline is now WCAG AA compliant; subsequent plans (09-02 through 09-04) can build on this token foundation
- AppShell main landmark and tab ARIA patterns are complete; focus management and keyboard navigation plans can proceed

---
*Phase: 09-increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements*
*Completed: 2026-03-24*
