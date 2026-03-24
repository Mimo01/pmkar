# Phase 9: Increase Accessibility - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve accessibility across the existing UI: ARIA-compatible inputs, sufficient contrast in both light and dark modes, keyboard navigation, screen reader support, and general a11y improvements. All functionality from Phases 1-8 is preserved — this phase changes how accessible it is, not what it does.

</domain>

<decisions>
## Implementation Decisions

### Contrast & color
- **D-01:** Target WCAG AA standard — 4.5:1 for normal text, 3:1 for large text and UI components
- **D-02:** No information conveyed by color alone — every colored status indicator (priority dots, triage state, copy status) must be paired with a text label or distinct icon shape

### Claude's Discretion
- Brand red (#c02232) handling when it fails AA contrast — Claude chooses between shade adjustment per-context, restricting to large elements, or pairing with text alternatives
- Dark mode muted text (#6b6b6f on #161617, currently ~3.5:1) — Claude decides brightening strategy based on where muted color is used
- Focus indicator style — Claude picks between brand-colored ring, subtle+bold hybrid, or contextual approach
- Skip-to-content link — Claude evaluates tab depth and decides if warranted given the minimal nav structure
- Ticket card keyboard navigation — Claude picks between roving tabindex (arrow keys) or standard Tab based on typical list size (5-20 tickets)
- Escape key behavior for overlay pages — Claude decides based on existing keyboard patterns
- Form validation error pattern — Claude picks best approach per form (likely inline + aria-describedby)
- Visible labels vs placeholder-as-label — Claude audits each form and picks per context
- Required field indicators — Claude picks asterisk vs text hint based on form complexity
- Live region strategy for async operations — Claude identifies which operations need announcements
- Semantic structure (headings + landmarks) — Claude audits and adds what's most impactful
- Icon accessibility — Claude categorizes each icon as actionable (gets aria-label) vs decorative (gets aria-hidden)
- Dynamic page titles — Claude decides based on number of distinct views

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, Tauri architecture
- `.planning/REQUIREMENTS.md` — All v1 requirements (functional scope preserved)
- `.planning/ROADMAP.md` — Phase 9 definition and dependencies

### Prior phase context (UI patterns to audit)
- `.planning/phases/08-fully-redesign-the-app-ui-modern-sleek-easy-to-use/08-CONTEXT.md` — shadcn/ui adoption, Linear aesthetic, component library decisions, dark/light theme setup

### Key source files to audit
- `src/index.css` — CSS custom properties, color tokens for both themes, shadcn semantic aliases
- `src/components/ui/AppShell.tsx` — Header, tab nav, icon toolbar (9 aria occurrences)
- `src/features/tickets/TicketCard.tsx` — Card component (3 aria occurrences)
- `src/features/tickets/TicketDetailPage.tsx` — Full-page detail (12 aria occurrences, highest count)
- `src/features/connections/ConnectionForm.tsx` — Form inputs for Jira connections
- `src/features/connections/SetupWizard.tsx` — Multi-step wizard form (4 aria occurrences)
- `src/features/connections/SettingsPage.tsx` — Settings form (5 aria occurrences)
- `src/features/tickets/CopyPreviewModal.tsx` — Copy preview modal (4 aria occurrences)
- `src/features/tickets/CopyResultModal.tsx` — Copy result display
- `src/features/tickets/AuditLogPage.tsx` — Audit log viewer (5 aria occurrences)
- `src/features/tickets/TicketListPage.tsx` — Ticket list container
- `src/features/tickets/TriageIndicator.tsx` — Triage state display (5 aria occurrences)
- `src/features/connections/TestResult.tsx` — Connection test results (6 aria occurrences)
- `src/features/connections/SecretInput.test.tsx` — Reference for existing test patterns
- `src/features/theme/themeStore.ts` — Dark/light theme toggle

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- shadcn/ui components (button, card, dialog, tabs, tooltip, badge, progress, scroll-area, separator, skeleton) — Radix-based, already provide baseline ARIA for overlays and interactive widgets
- `themeStore.ts` + `useApplyTheme.ts` — Dark/light theme system with `body.dark` class toggle
- CSS custom properties in `src/index.css` — centralized color tokens make contrast fixes systematic
- i18n via react-i18next — all strings already translatable, including any new aria-label text

### Established Patterns
- Tailwind CSS utility classes including `focus-visible:` variants available
- shadcn semantic color aliases (--background, --foreground, --muted, etc.) bridge to brand tokens
- Feature-based file organization: `src/features/tickets/`, `src/features/connections/`
- ~90 existing aria/role/sr-only/focus-visible/tabIndex occurrences across 20 files — partial a11y already in place

### Integration Points
- `src/App.tsx` — View routing (wizard/settings/audit/detail/main) — where dynamic page titles would hook in
- `src/components/ui/AppShell.tsx` — Shell wraps all views — where skip link and landmark roles would go
- All shadcn components — may need focus ring CSS adjustments in their base styles
- `src/index.css` @theme block — where contrast-fixed color values go

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User delegated most implementation details to Claude's discretion, with two firm decisions: WCAG AA compliance and no color-only information conveying.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements*
*Context gathered: 2026-03-24*
