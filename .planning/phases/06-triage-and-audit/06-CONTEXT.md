# Phase 6: Triage and Audit - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Ignore workflow for managing the review queue (mark as "not for me", ignored list, un-ignore) and in-app audit log viewer for inspecting REST API calls. Triage state persistence already exists in SQLite — this phase adds the ignore/restore UI and the audit log viewer.

</domain>

<decisions>
## Implementation Decisions

### Ignore action UX
- **D-01:** "Not for me" button in the ticket detail side panel header, alongside the existing "Copy to Jira" button
- **D-02:** No confirmation dialog — instant action. User can always recover from the ignored list
- **D-03:** Ticket disappears from candidate list immediately after ignoring

### Ignored list access
- **D-04:** Dedicated separate page for ignored tickets, accessible from AppShell navigation (new "Ignored" tab alongside "Tickets")
- **D-05:** Same table layout as the candidate ticket list for consistency

### Audit log viewer
- **D-06:** Table with expandable rows — compact view shows timestamp, method, URL, status code; click to expand and see headers + response body
- **D-07:** Response body displayed as formatted JSON (pretty-printed) when content is JSON
- **D-08:** Entries ordered newest first (matches AuditDb.get_all() existing DESC order)

### Audit log navigation
- **D-09:** Footer/status bar link showing "N API calls" count — unobtrusive, developer-tools feel
- **D-10:** Clicking the footer link opens a full page view (replaces main content area, like Settings page) with a close button to return to previous view

### Claude's Discretion
- After ignoring a ticket: whether to close the detail panel or auto-advance to next ticket
- Un-ignore mechanism on the ignored list page (row action button vs detail panel button)
- Whether to include method/status filters on the audit log (depends on expected log volume given 5-20 tickets per session)
- Loading states and empty states for both ignored list and audit log
- Footer/status bar styling and positioning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, key decisions (batch review workflow, 5-20 tickets per session)
- `.planning/REQUIREMENTS.md` — Phase 6 requirements: TRIA-01, TRIA-02, TRIA-03, AUDIT-02
- `.planning/ROADMAP.md` — Phase 6 success criteria (4 criteria that must be TRUE)

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 decisions: React + TypeScript, Tailwind CSS, Zustand, SQLite audit
- `.planning/phases/03-ticket-fetch-and-review/03-CONTEXT.md` — Phase 3 decisions: table layout, side panel detail, triage state display (blue dot/green check), Settings page, gear icon
- `.planning/phases/04-copy-core-fields/04-CONTEXT.md` — Phase 4 decisions: Copy button in detail panel, CopyPreviewModal pattern

### Key source files
- `src-tauri/src/triage_db.rs` — TriageDb with 'ignored' state already in schema
- `src-tauri/src/audit.rs` — AuditDb with get_all() returning all entries
- `src/features/tickets/TriageIndicator.tsx` — Existing triage state indicator component
- `src/features/tickets/TicketTable.tsx` — Existing ticket table to extend
- `src/features/tickets/TicketDetailPanel.tsx` — Where "Not for me" button goes
- `src/components/ui/AppShell.tsx` — Navigation where "Ignored" tab is added

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/triage_db.rs`: TriageDb already supports `state IN ('new','seen','ignored','copied')` — just need a command to set state to 'ignored' and query ignored tickets
- `src-tauri/src/audit.rs`: AuditDb.get_all() returns Vec<AuditEntry> with all fields needed for the viewer
- `src/features/tickets/TriageIndicator.tsx`: Extend with ignored state visual (grey strikethrough or similar)
- `src/features/tickets/TicketTable.tsx`: Reuse for ignored list page with minor column adjustments
- `src/features/tickets/TicketDetailPanel.tsx`: Add "Not for me" button next to existing "Copy to Jira" button
- `src/components/ui/AppShell.tsx`: Add "Ignored" navigation tab and footer status bar

### Established Patterns
- Tauri IPC: commands in `commands.rs`, invoked from frontend via `@tauri-apps/api`
- Zustand for state management (connectionStore, ticketStore, copyStore patterns)
- Feature-based organization: `src/features/tickets/` for ticket-related components
- SQLite for persistent storage (audit + triage DBs)

### Integration Points
- `src/features/tickets/TicketDetailPanel.tsx` — add "Not for me" button
- `src/components/ui/AppShell.tsx` — add "Ignored" nav tab + footer status bar with API call count
- `src-tauri/src/commands.rs` — new commands: `ignore_ticket`, `restore_ticket`, `get_ignored_tickets`, `get_audit_log`
- `src/features/tickets/ticketStore.ts` — update to remove ignored ticket from candidates list
- New page components: `IgnoredTicketsPage.tsx`, `AuditLogPage.tsx`

</code_context>

<specifics>
## Specific Ideas

- "Not for me" button label matches the conversational tone of the triage workflow
- Footer link with API call count gives a quick health indicator without cluttering the main UI
- Full page audit view (not slide-up panel) keeps it consistent with Settings page pattern
- Ignored list as separate page keeps the candidate list clean and focused

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-triage-and-audit*
*Context gathered: 2026-03-23*
