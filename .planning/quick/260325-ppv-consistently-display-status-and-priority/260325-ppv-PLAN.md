---
phase: quick-260325-ppv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/StatusBadge.tsx
  - src/features/tickets/PriorityIcon.tsx
  - src/features/tickets/TicketCard.tsx
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.tsx
  - src/features/tickets/CopyPreviewModal.tsx
  - src/features/tickets/CopyPreviewPage.tsx
autonomous: true
requirements: [QUICK-PPV]

must_haves:
  truths:
    - "Status is shown as a colored badge (color-coded background) everywhere it appears"
    - "Priority is shown with a directional arrow icon (like Jira) everywhere it appears"
    - "Same StatusBadge and PriorityIcon components used in all locations"
  artifacts:
    - path: "src/features/tickets/StatusBadge.tsx"
      provides: "Shared StatusBadge component with color-coded backgrounds"
      exports: ["StatusBadge"]
    - path: "src/features/tickets/PriorityIcon.tsx"
      provides: "Shared PriorityIcon component with Jira-style directional arrows"
      exports: ["PriorityIcon"]
  key_links:
    - from: "src/features/tickets/TicketCard.tsx"
      to: "src/features/tickets/StatusBadge.tsx"
      via: "import StatusBadge"
      pattern: "import.*StatusBadge"
    - from: "src/features/tickets/TicketCard.tsx"
      to: "src/features/tickets/PriorityIcon.tsx"
      via: "import PriorityIcon"
      pattern: "import.*PriorityIcon"
---

<objective>
Create shared StatusBadge and PriorityIcon components with Jira-style visuals, then replace all inconsistent status/priority displays across the app.

Purpose: Status and priority are currently shown inconsistently - small dots in TicketCard, a Badge in TicketDetailPage, plain text in TicketDetailPanel and copy previews. This task unifies them with Jira-style colored status badges and priority arrow icons.

Output: Two shared components used consistently across all 5 files that display status/priority.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/features/tickets/TicketCard.tsx
@src/features/tickets/TicketDetailPage.tsx
@src/features/tickets/TicketDetailPanel.tsx
@src/features/tickets/CopyPreviewModal.tsx
@src/features/tickets/CopyPreviewPage.tsx

<interfaces>
<!-- Current status/priority data shape from Jira API types -->
<!-- ticket.fields.status.name: string (e.g., "To Do", "In Progress", "Done", "Blocked", "In Review", "Resolved", "Closed") -->
<!-- ticket.fields.priority.name: string (e.g., "Highest", "High", "Medium", "Low", "Lowest", "Critical") -->

From src/components/ui/badge.tsx:
- Badge component with variant="outline" available via @/components/ui/badge

From lucide-react (already in project deps):
- ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Minus, Equal icons available
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create shared StatusBadge and PriorityIcon components</name>
  <files>src/features/tickets/StatusBadge.tsx, src/features/tickets/PriorityIcon.tsx</files>
  <action>
Create `src/features/tickets/StatusBadge.tsx`:
- Export a `StatusBadge` component accepting `{ status: string }` props
- Render as a small inline badge (span) with rounded-full shape, px-2 py-0.5, text-xs font-medium
- Color mapping based on status name (case-insensitive):
  - "done", "resolved", "closed" -> bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400
  - "in progress", "progress", "review" -> bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400
  - "blocked" -> bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400
  - default ("to do", "open", anything else) -> bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400
- Do NOT use the shadcn Badge component — use a plain span for consistency and compactness (the shadcn Badge has border styling that doesn't match Jira's flat colored badges)

Create `src/features/tickets/PriorityIcon.tsx`:
- Export a `PriorityIcon` component accepting `{ priority: string; showLabel?: boolean }` props (showLabel defaults to true)
- Render an SVG arrow icon + optional text label, using Jira's exact priority icon pattern:
  - "highest" / "critical" -> ChevronsUp icon in red (#dc2626), double chevron pointing up
  - "high" -> ChevronUp icon in red/orange (#ea580c), single chevron up
  - "medium" -> Equal icon (or a horizontal bar) in orange/yellow (#ca8a04)
  - "low" -> ChevronDown icon in blue (#3b82f6), single chevron down
  - "lowest" -> ChevronsDown icon in blue (#60a5fa), double chevron down
- Icon size: w-4 h-4 for detail views, w-3.5 h-3.5 for card views. Accept an optional `size` prop: "sm" (w-3.5 h-3.5) | "md" (w-4 h-4), default "sm"
- Import icons from lucide-react: ChevronsUp, ChevronUp, Equal, ChevronDown, ChevronsDown
- Layout: flex items-center gap-1, label is text-xs text-brand-text-secondary
  </action>
  <verify>
    <automated>ls src/features/tickets/StatusBadge.tsx src/features/tickets/PriorityIcon.tsx && npx tsc --noEmit --pretty 2>&1 | tail -5</automated>
  </verify>
  <done>Both components exist, export correctly, and pass TypeScript compilation with no errors</done>
</task>

<task type="auto">
  <name>Task 2: Replace all status/priority displays with shared components</name>
  <files>src/features/tickets/TicketCard.tsx, src/features/tickets/TicketDetailPage.tsx, src/features/tickets/TicketDetailPanel.tsx, src/features/tickets/CopyPreviewModal.tsx, src/features/tickets/CopyPreviewPage.tsx</files>
  <action>
**TicketCard.tsx:**
- Remove the inline `StatusDot` and `PriorityDot` function components (lines 10-42)
- Import `StatusBadge` from './StatusBadge' and `PriorityIcon` from './PriorityIcon'
- Replace `<StatusDot status={ticket.fields.status.name} />` with `<StatusBadge status={ticket.fields.status.name} />`
- Replace `<PriorityDot priority={ticket.fields.priority.name} />` with `<PriorityIcon priority={ticket.fields.priority.name} size="sm" />`

**TicketDetailPage.tsx:**
- Remove the inline `StatusBadge` function component (lines 24-37)
- Remove the `Badge` and `cn` imports if no longer used elsewhere in the file (check first — Badge IS used for copied key badge at line 202 and copied status at line 234, so keep it)
- Import `StatusBadge` from './StatusBadge' and `PriorityIcon` from './PriorityIcon'
- Replace `<StatusBadge status={detail.fields.status.name} />` (line 214) with the new imported `StatusBadge`
- Replace `<span>{detail.fields.priority.name}</span>` (line 215) with `<PriorityIcon priority={detail.fields.priority.name} size="md" />`

**TicketDetailPanel.tsx:**
- Import `StatusBadge` from './StatusBadge' and `PriorityIcon` from './PriorityIcon'
- Replace the plain status span at line 186-188 (`<span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-surface-hover text-brand-text-secondary">{detail.fields.status.name}</span>`) with `<StatusBadge status={detail.fields.status.name} />`
- Replace the plain priority span at line 189-191 (`<span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-surface-hover text-brand-text-secondary">{detail.fields.priority.name}</span>`) with `<PriorityIcon priority={detail.fields.priority.name} size="md" />`

**CopyPreviewModal.tsx:**
- Import `StatusBadge` from './StatusBadge' and `PriorityIcon` from './PriorityIcon'
- Replace `<SourceFieldRow label="Status" value={sourceTicket.fields.status.name} />` (line 141) with `<SourceFieldRow label="Status"><StatusBadge status={sourceTicket.fields.status.name} /></SourceFieldRow>`
- Replace `<SourceFieldRow label="Priority" value={sourceTicket.fields.priority.name} />` (line 142) with `<SourceFieldRow label="Priority"><PriorityIcon priority={sourceTicket.fields.priority.name} size="sm" /></SourceFieldRow>`
- Verify that SourceFieldRow supports children prop (it should based on the Assignee row pattern at line 143-148)

**CopyPreviewPage.tsx:**
- Import `StatusBadge` from './StatusBadge' and `PriorityIcon` from './PriorityIcon'
- Replace `<SourceFieldRow label="Status" value={sourceTicket.fields.status.name} />` (line 145) with `<SourceFieldRow label="Status"><StatusBadge status={sourceTicket.fields.status.name} /></SourceFieldRow>`
- Replace `<SourceFieldRow label="Priority" value={sourceTicket.fields.priority.name} />` (line 146) with `<SourceFieldRow label="Priority"><PriorityIcon priority={sourceTicket.fields.priority.name} size="sm" /></SourceFieldRow>`
  </action>
  <verify>
    <automated>npx tsc --noEmit --pretty 2>&1 | tail -10 && npx vitest run --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>All 5 files use the shared StatusBadge and PriorityIcon components. No inline status/priority rendering remains. TypeScript compiles cleanly. All existing tests pass.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- `npx vitest run` all existing tests pass
- grep -r "StatusDot\|PriorityDot" src/ returns no matches (inline components removed)
- grep -r "import.*StatusBadge" src/features/tickets/ shows 5 files importing the shared component
- grep -r "import.*PriorityIcon" src/features/tickets/ shows 5 files importing the shared component
</verification>

<success_criteria>
- Status is displayed as a color-coded badge (green for done/resolved, blue for in-progress, red for blocked, neutral for to-do) in all locations
- Priority is displayed with a Jira-style directional arrow icon (red double-up for highest, red-orange up for high, yellow bar for medium, blue down for low, blue double-down for lowest) in all locations
- Both components are shared from dedicated files, no inline duplication remains
- All existing tests continue to pass
</success_criteria>

<output>
After completion, create `.planning/quick/260325-ppv-consistently-display-status-and-priority/260325-ppv-SUMMARY.md`
</output>
