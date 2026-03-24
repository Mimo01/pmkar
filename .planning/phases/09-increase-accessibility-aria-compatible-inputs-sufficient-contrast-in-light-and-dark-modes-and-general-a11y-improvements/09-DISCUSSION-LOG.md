# Phase 9: Increase Accessibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 09-increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements
**Areas discussed:** Contrast & color, Keyboard navigation, Form inputs & labels, Screen reader support

---

## Contrast & Color

| Option | Description | Selected |
|--------|-------------|----------|
| WCAG AA | 4.5:1 for normal text, 3:1 for large text and UI components | ✓ |
| WCAG AAA | 7:1 for normal text, 4.5:1 for large text | |
| AA with brand exceptions | Target AA everywhere except brand red accent | |

**User's choice:** WCAG AA (Recommended)
**Notes:** Industry standard, covers most users with low vision.

### Brand Red Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Adjust the red shade | Lighten/darken per-context to meet 4.5:1 | |
| Keep red, add text alternatives | Keep #c02232 for accent, never sole info carrier | |
| Red for large elements only | Use brand red only on large text/elements (3:1 threshold) | |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Dark Mode Muted Text

| Option | Description | Selected |
|--------|-------------|----------|
| Brighten to pass AA | Adjust --color-brand-muted in dark mode to ~#8a8a8f | |
| Brighten only for body text | Muted labels brightened, decorative hints stay as-is | |
| You decide | Claude picks based on usage analysis | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Status Indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Always pair with text/icon | Every colored indicator also has text label or distinct icon | ✓ |
| Pair where critical | Only triage state and copy status get text labels | |
| You decide | Claude audits each indicator | |

**User's choice:** Always pair with text/icon
**Notes:** No information conveyed by color alone — firm decision.

---

## Keyboard Navigation

### Focus Indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Brand ring on all focusable | 2px brand-colored ring on every focusable element | |
| Subtle ring, bold on key actions | Light ring on most, thicker on primary actions | |
| Browser default | Remove custom focus styles, use native outline | |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Skip-to-Content Link

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, skip to main content | Hidden link on first Tab, jumps past header/nav | |
| No, not needed | Minimal nav, short tab order | |
| You decide | Claude evaluates tab depth | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Card Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Arrow keys between cards | Listbox pattern, Tab into list then Up/Down | |
| Tab between cards | Each card is separate tab stop | |
| You decide | Claude picks based on list size and Radix patterns | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Escape Key

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Escape closes overlays | Consistent with Dialog behavior | |
| Only for modals | Escape only for CopyPreview/CopyResult modals | |
| You decide | Claude decides based on existing patterns | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

---

## Form Inputs & Labels

### Validation Errors

| Option | Description | Selected |
|--------|-------------|----------|
| Inline + aria-describedby | Error text below field, linked via aria-describedby | |
| Toast/alert only | Errors as toast at top of form | |
| You decide | Claude picks per form | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Visible Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Visible labels always | Persistent <label> above each input | |
| Keep placeholders, add aria-label | Visual layout unchanged, aria-label for SR | |
| You decide | Claude audits each form | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Required Field Indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Asterisk + aria-required | Red asterisk (*) next to labels | |
| Text hint + aria-required | '(required)' text next to label | |
| You decide | Claude picks based on form complexity | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

---

## Screen Reader Support

### Live Regions

| Option | Description | Selected |
|--------|-------------|----------|
| All async ops | aria-live for fetch, copy, connection test, errors | |
| Only critical operations | Live regions for copy progress and errors only | |
| You decide | Claude identifies which ops need announcements | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Semantic Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Full semantic structure | Proper heading levels + <main>, <nav>, <header> landmarks | |
| Headings only | Fix heading hierarchy, skip landmark roles | |
| You decide | Claude audits and adds what's most impactful | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Icon Labels

| Option | Description | Selected |
|--------|-------------|----------|
| All icons get labels | Every icon has aria-label or sr-only text | |
| Actionable icons only | Icon buttons get aria-label, decorative get aria-hidden | |
| You decide | Claude categorizes each icon | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

### Dynamic Page Titles

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, dynamic titles | Title changes per view: 'Pmkar — New Tickets', etc. | |
| Keep static title | Title stays as 'Pmkar' everywhere | |
| You decide | Claude decides based on view count | ✓ |

**User's choice:** You decide
**Notes:** Delegated to Claude's discretion.

---

## Claude's Discretion

User delegated most implementation details to Claude, retaining two firm decisions:
1. WCAG AA compliance standard
2. No color-only information — always pair with text/icon

All other decisions (focus rings, skip link, card navigation, escape key, form patterns, live regions, semantic structure, icon labels, page titles, brand red handling, dark mode muted text) are at Claude's discretion based on codebase analysis.

## Deferred Ideas

None — discussion stayed within phase scope.
