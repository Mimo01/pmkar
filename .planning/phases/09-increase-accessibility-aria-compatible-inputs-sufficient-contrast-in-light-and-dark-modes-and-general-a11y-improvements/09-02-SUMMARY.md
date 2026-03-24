---
phase: 09-increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements
plan: 02
subsystem: ui
tags: [accessibility, aria, keyboard-nav, a11y, react, tailwind]

# Dependency graph
requires:
  - phase: 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use
    provides: TicketCard, TriageIndicator, AuditLogPage components
provides:
  - Keyboard-accessible TicketCard with role=button, tabIndex, onKeyDown, aria-label
  - D-02 compliant PriorityDot showing visible priority name text alongside color dot
  - Accessible TriageIndicator with sr-only "New" text and real button for copiedKey link
  - Keyboard-accessible AuditLogPage expandable rows with aria-expanded state
affects:
  - 09-03 (color contrast)
  - 09-04 (focus management and skip links)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "role=button on non-button clickable divs/trs (avoids nested button HTML invalidity)"
    - "onKeyDown Enter+Space handler pattern for keyboard activation"
    - "aria-hidden=true on decorative dots/icons with adjacent visible/sr-only text"
    - "focus-visible:outline with negative offset for list-item keyboard focus"
    - "sr-only span for screen-reader-only text alongside decorative colored elements"

key-files:
  created: []
  modified:
    - src/features/tickets/TicketCard.tsx
    - src/features/tickets/TriageIndicator.tsx
    - src/features/tickets/AuditLogPage.tsx
    - src/features/tickets/AuditLogPage.test.tsx

key-decisions:
  - "Use role=button on outer TicketCard div (not button element) to allow nested button elements in actionSlot without invalid HTML nesting"
  - "PriorityDot adds visible text alongside color dot to satisfy D-02 — screen-reader aria-label replaced with visible span"
  - "TriageIndicator copiedKey uses real button element instead of span role=link for native keyboard activation"
  - "AuditLogPage expandable tr rows use role=button + aria-expanded rather than aria-label on tr"

patterns-established:
  - "Pattern: Clickable non-button elements use role=button + tabIndex=0 + onKeyDown(Enter/Space)"
  - "Pattern: Color-conveying decorative dots get aria-hidden=true with adjacent visible or sr-only text"
  - "Pattern: focus-visible outline with outline-offset-[-2px] for list/table items to avoid gap artifacts"

requirements-completed: [A11Y-02, A11Y-03]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 9 Plan 02: Keyboard Access and Color-Independence for TicketCard, TriageIndicator, AuditLogPage Summary

**Keyboard-accessible TicketCard (role=button + Enter/Space), D-02-compliant PriorityDot with visible text, real button on TriageIndicator copiedKey, and keyboard-expandable AuditLog rows with aria-expanded**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T09:12:42Z
- **Completed:** 2026-03-24T09:15:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- TicketCard outer div is fully keyboard accessible via Tab, Enter, and Space with proper role, focus indicator, and aria-label
- PriorityDot now shows visible priority name text alongside the color dot (D-02 fully satisfied — no color-only information)
- TriageIndicator "new" state has sr-only "New" text; "copied" state uses a real button element for the copiedKey link
- AuditLogPage expandable rows have keyboard activation (onKeyDown), tabIndex, role=button, and aria-expanded state tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: TicketCard keyboard access and PriorityDot D-02 compliance + TriageIndicator fixes** - `25bb343` (feat)
2. **Task 2: AuditLogPage keyboard-accessible expandable rows** - `5d16b8d` (feat)
3. **Test fix: Update AuditLogPage tests to use role=button selectors** - `9398c7d` (fix)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified
- `src/features/tickets/TicketCard.tsx` - Added role=button, tabIndex=0, onKeyDown, aria-label on outer div; PriorityDot now shows visible priority text with aria-hidden dot
- `src/features/tickets/TriageIndicator.tsx` - "new" state: sr-only "New" text + aria-hidden dot; "copied" state: real button element for copiedKey, SVG becomes aria-hidden
- `src/features/tickets/AuditLogPage.tsx` - Expandable tr rows: added onKeyDown, tabIndex=0, role=button, aria-expanded; both tables get aria-label="API audit log"
- `src/features/tickets/AuditLogPage.test.tsx` - Updated tests to select expandable rows via getAllByRole('button') instead of removed aria-label selectors

## Decisions Made
- Used `role="button"` on the outer TicketCard div instead of a `<button>` element — actionSlot can contain nested `<button>` elements (e.g., Restore), and nested button-in-button is invalid HTML
- Removed `aria-label` from AuditLogPage expandable `<tr>` rows — row content (method, URL, status code) provides adequate accessible name via visible content; `role="button"` + `aria-expanded` is sufficient
- Used `focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]` (negative offset) for list/table row items to avoid ring-offset gap artifacts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated AuditLogPage tests broken by planned aria-label removal**
- **Found during:** Task 2 verification (npm test run)
- **Issue:** Tests used `getByLabelText('Expand row for ...')` which relied on the old `aria-label` on `<tr>` elements. The plan explicitly removes this aria-label (row content provides accessible name), breaking 5 tests.
- **Fix:** Updated tests to use `getAllByRole('button')` and select by text content (.textContent includes 'POST'/'GET'). Test 4 now verifies `aria-expanded` attribute directly.
- **Files modified:** `src/features/tickets/AuditLogPage.test.tsx`
- **Verification:** `npm test -- --run` passes: 114/114 tests pass
- **Committed in:** `9398c7d`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug from planned attribute removal)
**Impact on plan:** Auto-fix was necessary for correctness. Tests now use the new accessible role=button selectors, which is actually a better testing pattern (role-based queries preferred over aria-label queries).

## Issues Encountered
None beyond the auto-fixed test regression above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All clickable non-button elements are now keyboard accessible
- D-02 color independence satisfied for PriorityDot
- TriageIndicator uses proper semantic elements throughout
- AuditLogPage expandable rows expose aria-expanded for AT users
- Phase 09-03 (color contrast) and 09-04 (focus management/skip links) can build on this foundation

## Self-Check

### Files exist
- `src/features/tickets/TicketCard.tsx` — FOUND
- `src/features/tickets/TriageIndicator.tsx` — FOUND
- `src/features/tickets/AuditLogPage.tsx` — FOUND
- `src/features/tickets/AuditLogPage.test.tsx` — FOUND

### Commits exist
- `25bb343` — FOUND
- `5d16b8d` — FOUND
- `9398c7d` — FOUND

## Self-Check: PASSED

---
*Phase: 09-increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements*
*Completed: 2026-03-24*
