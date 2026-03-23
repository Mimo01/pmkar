# Quick Task 260323-plu: Redesign Settings - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign the settings page with a new navigation pattern, section grouping, and visual density. The current settings page is a single vertical scroll with 5 sections (Connections, What to Fetch, Watched Users, Theme, Language) in a narrow centered container.

</domain>

<decisions>
## Implementation Decisions

### Navigation Pattern
- Sidebar navigation with section links on the left and content panel on the right
- Desktop-app feel — one section visible at a time based on sidebar selection

### Section Grouping
- Three groups in the sidebar:
  1. **Connections** — Source (Customer Jira Server), Destination (Company Jira Cloud)
  2. **Fetching** — JQL Presets (What to Fetch), Watched Users
  3. **Appearance** — Theme, Language

### Visual Density
- Spacious cards with generous padding — modern, breathable feel
- Each setting or logical group in its own card

### Claude's Discretion
- Sidebar width and responsive behavior
- Transition animations between sections
- Whether sidebar groups are collapsible or always expanded
- Active section indicator styling

</decisions>

<specifics>
## Specific Ideas

- Sidebar should use the existing design system colors (brand red #c02232, surface/border tokens)
- Maintain existing functionality — this is a layout/visual redesign, not a functional change
- Keep the existing toggle button patterns for Theme and Language sections
- Connection cards should retain their current edit-inline behavior

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
