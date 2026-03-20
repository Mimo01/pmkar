# Phase 3: Ticket Fetch and Review - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fetch candidate tickets from customer Jira (assigned to me, mentioned, watched users) and display full ticket detail for review. Users can configure watched users, customize JQL queries, and see triage state (new/seen/ignored/copied) persisted across sessions. Copy and ignore actions are separate phases — this phase is read-only review.

</domain>

<decisions>
## Implementation Decisions

### Ticket list layout
- Table rows with columns: Key, Summary, Status, Priority, Assignee, Updated date
- Default sort: updated descending (most recently updated first)
- Clickable column headers to sort by any column (toggle asc/desc on re-click)
- Click row to open ticket detail in side panel

### Ticket detail view
- Side panel sliding from right (~40-50% width), ticket list stays visible on left
- Tabbed content organization: Overview | Comments | Work Log | Attachments | History
- Overview tab shows: status, priority, assignee, reporter, labels, components, fix versions, description, sub-tasks list, linked issues
- Description rendered as formatted HTML (wiki markup/ADF converted to readable HTML with headings, bold, code blocks, links)
- Images in descriptions rendered inline, proxied through Rust backend (PAT auth required to fetch from Jira)

### Watched users configuration
- Settings page section (under existing gear icon from Phase 2), "Fetch Configuration" section below connections
- Claude's discretion on implementation approach (simple text list vs autocomplete based on Jira API capabilities)

### JQL query customization
- Two-tier approach: preset dropdown + "Advanced" toggle for raw JQL editing
- Three presets: "Assigned to me", "Mentioned me", "All watched" (combines my tickets + watched users)
- Advanced mode shows editable text area with the generated JQL and a "Reset to default" button
- Settings live on the Settings page under "Fetch Configuration"

### Fetch trigger and flow
- Manual "Fetch Tickets" button — user controls when to hit the customer Jira
- Shows "Last fetched: X ago" timestamp next to the button
- Summary line: "N candidates, M new"

### Triage state display
- New/unseen tickets: blue dot indicator on the row
- Seen tickets: normal styling (no indicator)
- Copied tickets: green checkmark indicator
- Ignored tickets: hidden from default view (handled in Phase 6 triage)

### Triage state persistence
- SQLite database (extends existing audit SQLite) — table mapping ticket key to triage state + timestamps
- Survives app restarts per FETCH-12

### Pagination
- Claude's discretion — pick approach based on typical batch size (5-20 tickets per session, per PROJECT.md). Server-side pagination with load-more if needed for larger result sets.

### Claude's Discretion
- Watched users implementation approach (text list vs autocomplete)
- Pagination strategy (given 5-20 typical batch size)
- Loading states and skeleton design
- Error handling for failed fetches
- Side panel transition animation
- Tab styling within detail panel
- Image proxy implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, key decisions (Tauri, OS keychain, batch review workflow, 5-20 tickets per session)
- `.planning/REQUIREMENTS.md` — Phase 3 requirements: FETCH-01 through FETCH-12 (12 requirements)
- `.planning/ROADMAP.md` — Phase 3 success criteria (5 criteria that must be TRUE)

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 decisions: React + TypeScript, Tailwind CSS, Zustand, feature-based organization, SQLite audit, mock server design
- `.planning/phases/02-connection-setup/02-CONTEXT.md` — Phase 2 decisions: wizard flow, settings page with gear icon, inline feedback pattern, "Source/Destination" labeling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/jira_client.rs`: JiraClient wraps reqwest with audit middleware — all API calls go through this
- `src-tauri/src/commands.rs`: Connection test commands pattern (test_jira_server_connection, test_jira_cloud_connection) — adapt for fetch commands
- `src-tauri/src/mock_server.rs`: Search endpoints already exist (v2 GET /search, v3 POST /search/jql) with fixture data
- `src-tauri/src/fixtures.rs`: Rich fixture types (JiraIssue, JiraComment, JiraAttachment, JiraIssueLink, JiraUser, etc.) already defined
- `src/features/connections/SettingsPage.tsx`: Existing settings page where watched users and JQL config will be added
- `src/features/connections/connectionStore.ts`: Zustand store pattern to follow for ticket store
- `src/components/ui/AppShell.tsx`: App wrapper where navigation to ticket list view will be added
- `src/components/ui/StatusBadge.tsx`: May be reusable for triage state indicators

### Established Patterns
- Tauri IPC: commands in `src-tauri/src/commands.rs`, invoked from frontend via `@tauri-apps/api`
- Feature-based organization: `src/features/tickets/` directory exists (empty, ready)
- Zustand for state management
- Tailwind CSS for all styling
- SQLite for persistent storage (audit logs) — extend for triage state

### Integration Points
- `src/features/tickets/` — new ticket list and detail components
- `src/features/connections/SettingsPage.tsx` — add "Fetch Configuration" section
- `src/components/ui/AppShell.tsx` — navigation to ticket list (main view after setup)
- `src-tauri/src/commands.rs` — new fetch commands
- `src-tauri/src/mock_server.rs` — may need additional endpoints for ticket detail (comments, attachments, etc.)
- SQLite database — new triage state table

</code_context>

<specifics>
## Specific Ideas

- Table layout for ticket list (Jira-familiar, dense, good for scanning 5-20 tickets)
- Side panel detail with tabs matches the "review before action" workflow — quick switching between tickets
- Two-tier JQL (presets + advanced) balances ease-of-use with power-user needs
- Manual fetch button aligns with the daily batch workflow — no surprise API calls
- Blue dot for new, green check for copied — minimal, clear visual indicators

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-ticket-fetch-and-review*
*Context gathered: 2026-03-20*
