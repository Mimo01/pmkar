# Phase 8: Fully Redesign the App UI — Modern, Sleek, Easy to Use - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete visual overhaul of the existing app UI. All functionality from Phases 1-7 is preserved — this phase changes how it looks and feels, not what it does. New features or capabilities belong in other phases.

</domain>

<decisions>
## Implementation Decisions

### Visual direction
- **D-01:** Minimal & clean aesthetic — Linear-inspired. Lots of whitespace, subtle borders, muted neutral colors, typography-driven hierarchy
- **D-02:** Brand red (#c02232) used as accent only — not dominant. Neutral grays carry the UI
- **D-03:** Linear is the primary design reference — ultra-clean, fast transitions, keyboard-aware feel

### Layout & navigation
- **D-04:** Keep current top tab navigation pattern (header + horizontal tabs below). Refine styling, spacing, and transitions — don't restructure
- **D-05:** Settings and Audit Log remain as overlay pages (replace main content, close to return). Polish the UI of both pages
- **D-06:** Header retains pmkar branding, debug icon, and gear icon — refine icon sizing and spacing

### Ticket list presentation
- **D-07:** Switch from sortable table to card list layout. Each ticket is a card — more visual, richer per-item display
- **D-08:** Compact 3-line card: ticket key + relative time (top row), summary text (middle), status dot + priority + assignee (bottom metadata row)
- **D-09:** Cards should have subtle hover effect, clean borders, and good spacing between cards

### Ticket detail view
- **D-10:** Switch from side panel to full-page detail view. Clicking a ticket navigates to a full-width detail page with a back button
- **D-11:** Full-page detail gives more room for description, comments, attachments, and copy actions
- **D-12:** Back button returns to the ticket list preserving the current tab context

### Component library
- **D-13:** Adopt shadcn/ui — copy-paste Radix-based components styled with Tailwind. Components live in src/components/ui/
- **D-14:** Replaces existing custom components (AppShell, StatusBadge, ErrorBoundary) with shadcn/ui equivalents where applicable
- **D-15:** Lucide React for icons — replaces all hand-coded inline SVGs (GearIcon, TerminalIcon, ChevronIcon, SpinnerIcon)

### Pain points to address
- **D-16:** Settings page: redesign from current crowded sidebar+form layout to a cleaner, more spacious section-based layout
- **D-17:** Ticket list: fix spreadsheet feel — more breathing room, card-based layout solves this
- **D-18:** Copy modals (preview/result): redesign to feel less boxy, improve progress visualization during copy operations
- **D-19:** Empty states & loading: polish loading indicators and empty state messages — more refined than basic spinners

### Claude's Discretion
- Exact shadcn/ui components to install (Button, Card, Dialog, Tabs, etc.)
- Animation/transition library choice (CSS transitions, Framer Motion, or native)
- Card hover effects and selection state styling
- Detail page layout structure and tab organization
- Settings page section ordering and spacing
- Loading skeleton vs spinner approach
- Color palette refinements within the minimal/clean direction
- Typography scale and font choices (system font stack or custom)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, Tauri architecture
- `.planning/REQUIREMENTS.md` — All v1 requirements (functional scope preserved)
- `.planning/ROADMAP.md` — Phase 8 definition and dependencies

### Prior phase context (UI patterns to replace/upgrade)
- `.planning/phases/03-ticket-fetch-and-review/03-CONTEXT.md` — Original table layout, side panel detail, triage state display decisions
- `.planning/phases/04-copy-core-fields/04-CONTEXT.md` — Copy button in detail panel, CopyPreviewModal pattern
- `.planning/phases/06-triage-and-audit/06-CONTEXT.md` — Ignore UX, audit log viewer, AppShell navigation, footer pattern
- `.planning/phases/07-internationalization/07-CONTEXT.md` — i18n integration, language switcher in Settings

### Key source files to redesign
- `src/components/ui/AppShell.tsx` — Current header + tab nav + icon toolbar
- `src/features/tickets/TicketListPage.tsx` — Current ticket list with fetch controls
- `src/features/tickets/TicketTable.tsx` — Current sortable table (replacing with cards)
- `src/features/tickets/TicketDetailPanel.tsx` — Current side panel (replacing with full page)
- `src/features/tickets/CopyPreviewModal.tsx` — Copy preview modal to redesign
- `src/features/tickets/CopyResultModal.tsx` — Copy result modal to redesign
- `src/features/tickets/IgnoredTicketsPage.tsx` — Ignored tickets list (also gets card treatment)
- `src/features/tickets/LinkedTicketsPage.tsx` — Linked tickets list (also gets card treatment)
- `src/features/tickets/AuditLogPage.tsx` — Audit log viewer to polish
- `src/features/connections/SettingsPage.tsx` — Settings page to redesign
- `src/features/connections/SetupWizard.tsx` — Wizard (polish styling)
- `src/features/connections/ConnectionCard.tsx` — Connection display cards
- `src/features/theme/themeStore.ts` — Existing dark/light theme store
- `src/index.css` — Tailwind theme config with CSS custom properties

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `themeStore.ts` + `useApplyTheme.ts`: Dark/light theme system already in place — redesign enhances both themes
- `src/index.css`: CSS custom properties for brand colors — redesign updates these values
- `src/i18n/`: Full i18n setup with react-i18next — all new components must use `useTranslation()`
- Zustand stores (`connectionStore`, `ticketStore`, `copyStore`): State management unchanged
- Tauri IPC commands: Backend unchanged — purely frontend redesign

### Established Patterns
- Tailwind CSS utility classes for all styling (extends naturally to shadcn/ui)
- Feature-based file organization: `src/features/tickets/`, `src/features/connections/`
- React 19 functional components with hooks
- i18n via react-i18next `useTranslation()` hook in every component
- Dark/light theme via `body.dark` class toggle and CSS custom properties

### Integration Points
- `src/App.tsx`: Routing logic (wizard vs settings vs audit vs main view) — structure stays, components change
- `src/components/ui/AppShell.tsx`: Shell component wraps all views — redesign updates this
- All ticket pages share `ticketStore` and `triageMap` — data layer untouched
- All i18n keys in `src/i18n/locales/en.json` and `sk.json` — may need new keys for redesigned UI text

</code_context>

<specifics>
## Specific Ideas

- Linear is the design north star — clean, fast, minimal chrome
- Cards should feel like Linear's issue list items — not heavy Material Design cards
- Full-page detail should feel spacious, not cramped
- The redesign should make the app feel like a polished desktop tool, not a web prototype

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use*
*Context gathered: 2026-03-23*
