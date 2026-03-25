---
phase: quick-260325-qcl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.tsx
autonomous: true
requirements: [QCL-01]
must_haves:
  truths:
    - "Issue detail header shows only summary, issue key, and action buttons — no status/priority/assignee/reporter"
    - "Status, priority, assignee, reporter still visible in the OverviewTab field grid below"
    - "Existing tests pass (updated if they assert on header metadata)"
  artifacts:
    - path: "src/features/tickets/TicketDetailPage.tsx"
      provides: "Detail page without duplicated metadata in header"
    - path: "src/features/tickets/TicketDetailPanel.tsx"
      provides: "Detail panel without duplicated metadata in header"
  key_links:
    - from: "OverviewTab"
      to: "StatusBadge, PriorityIcon, UserAvatar"
      via: "field grid rendering"
      pattern: "StatusBadge|PriorityIcon|UserAvatar"
---

<objective>
Remove duplicated status, priority, assignee, and reporter metadata from the issue detail header in both TicketDetailPage and TicketDetailPanel. This metadata is already displayed in the OverviewTab field grid below, so showing it in the header is redundant.

Purpose: Cleaner header focused on issue identity (key + summary) and actions
Output: Simplified headers in both detail views
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/TicketDetailPage.tsx
@src/features/tickets/TicketDetailPanel.tsx
@src/features/tickets/tabs/OverviewTab.tsx
@src/features/tickets/__tests__/TicketDetailPage.test.tsx
@src/features/tickets/TicketDetailPanel.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove metadata from TicketDetailPage header</name>
  <files>src/features/tickets/TicketDetailPage.tsx, src/features/tickets/__tests__/TicketDetailPage.test.tsx</files>
  <action>
In TicketDetailPage.tsx:
1. Remove the entire metadata div (lines 200-209) that contains StatusBadge, PriorityIcon, assignee displayName, and reporter displayName. This is the `<div className="flex items-center gap-3 mb-6 text-xs ...">` block right after the h1 summary.
2. Add `mb-6` to the h1 element (replacing the current `mb-2`) so spacing to the action buttons is preserved.
3. Remove unused imports: `StatusBadge`, `PriorityIcon` — these are no longer used in this file (they are used in OverviewTab which imports them separately).

In TicketDetailPage.test.tsx:
- The "shows status badge" test (line 135) uses `getAllByText('In Progress')` — this should still pass because OverviewTab renders it. No change needed, but verify.
- The "shows priority" test (line 144) uses `getAllByText('High')` — same, OverviewTab renders it. No change needed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx vitest run src/features/tickets/__tests__/TicketDetailPage.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>TicketDetailPage header shows only summary + action buttons, no status/priority/assignee/reporter. All existing tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Remove metadata from TicketDetailPanel header</name>
  <files>src/features/tickets/TicketDetailPanel.tsx, src/features/tickets/TicketDetailPanel.test.tsx</files>
  <action>
In TicketDetailPanel.tsx:
1. Remove the StatusBadge and PriorityIcon from the header metadata div (lines 187-189). This is inside the `<div className="flex items-center gap-2 mt-2">` block.
2. The remaining content in that div is the ml-auto action buttons group. Restructure: remove the outer flex wrapper since only the action buttons remain. Move the action buttons div (`<div className="ml-auto flex items-center gap-2">`) to be a direct child, removing the now-unnecessary `ml-auto` (use `flex justify-end` or `flex gap-2 mt-2` instead).
3. Remove unused imports: `StatusBadge`, `PriorityIcon` — no longer used in this file.

In TicketDetailPanel.test.tsx:
- No tests assert on header metadata specifically. Verify all tests still pass.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx vitest run src/features/tickets/TicketDetailPanel.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>TicketDetailPanel header shows only issue key, summary, and action buttons. No status/priority metadata in header. All tests pass.</done>
</task>

</tasks>

<verification>
Run full test suite for the tickets feature to ensure no regressions:
```bash
cd /Users/mimo/Desktop/pmkar && npx vitest run src/features/tickets/ --reporter=verbose 2>&1 | tail -50
```
Visually: Opening a ticket detail should show a clean header with just the summary and action buttons. Status, priority, assignee, and reporter are visible only in the Overview tab field grid.
</verification>

<success_criteria>
- TicketDetailPage header: summary (h1) + action buttons only
- TicketDetailPanel header: issue key + summary + action buttons only
- OverviewTab field grid still shows status, priority, assignee, reporter (unchanged)
- All ticket feature tests pass
- No unused imports remain
</success_criteria>

<output>
After completion, create `.planning/quick/260325-qcl-remove-status-priority-and-other-metadat/260325-qcl-SUMMARY.md`
</output>
