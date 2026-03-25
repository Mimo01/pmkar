---
phase: quick
plan: 260325-sxj
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.tsx
autonomous: true
requirements: [QUICK-sxj]

must_haves:
  truths:
    - "Dismissed (ignored) tickets do NOT show the Copy to Company Jira button"
    - "Non-dismissed, non-copied tickets still show the Copy button normally"
    - "Copied tickets continue to show linked status badge (no regression)"
  artifacts:
    - path: "src/features/tickets/TicketDetailPage.tsx"
      provides: "Full-page ticket detail with conditional copy button"
      contains: "!isCopied && !isIgnored"
    - path: "src/features/tickets/TicketDetailPanel.tsx"
      provides: "Side panel ticket detail with conditional copy button"
      contains: "!isCopied && !isIgnored"
  key_links:
    - from: "src/features/tickets/TicketDetailPage.tsx"
      to: "ticketStore.triageMap"
      via: "isIgnored state check"
      pattern: "isIgnored"
---

<objective>
Hide the "Copy to Company Jira" button when a ticket is in dismissed (ignored) state.

Purpose: Dismissed tickets should not offer the copy action since the user has explicitly decided they don't belong in the company Jira. Showing the copy button on dismissed tickets is confusing UX.
Output: Updated TicketDetailPage.tsx and TicketDetailPanel.tsx with copy button hidden for ignored tickets.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/TicketDetailPage.tsx
@src/features/tickets/TicketDetailPanel.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Hide copy button on dismissed tickets in both detail views</name>
  <files>src/features/tickets/TicketDetailPage.tsx, src/features/tickets/TicketDetailPanel.tsx</files>
  <action>
In TicketDetailPage.tsx:
- Line 215: Change `{!isCopied && (` to `{!isCopied && !isIgnored && (` for the copy Button block (lines 215-227). This ensures the "Copy to {name}" button is hidden when the ticket is dismissed.

In TicketDetailPanel.tsx:
- Line 262: Change `{isCopied ? null : (` to `{isCopied || isIgnored ? null : (` for the copy button block (lines 262-290). This ensures the copy button in the side panel is also hidden when the ticket is dismissed.

Both files already derive `isIgnored` from `triageEntry?.state === 'ignored'` so no new state logic is needed.

Do NOT change the dismiss/undismiss button rendering — those should remain as-is so users can still undismiss tickets.
Do NOT change the "Open in Jira" button — dismissed tickets should still be openable in source Jira.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
- Dismissed tickets: show Dismissed button + Open in Jira, but NOT the Copy button
- Non-dismissed, non-copied tickets: show Copy button + Dismiss button + Open in Jira (unchanged)
- Copied tickets: show linked badge + Jira links (unchanged)
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Visual check: open a dismissed ticket detail — no copy button visible
- Visual check: open a normal ticket detail — copy button visible
</verification>

<success_criteria>
The "Copy to Company Jira" button is not rendered on any ticket detail view (page or panel) when the ticket has dismissed/ignored triage state.
</success_criteria>

<output>
After completion, create `.planning/quick/260325-sxj-hide-copy-to-company-jira-button-on-dism/260325-sxj-SUMMARY.md`
</output>
