# Phase 4: Copy — Core Fields - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end copy pipeline for a ticket's core fields from customer Jira Server to company Jira Cloud. Includes wiki markup→ADF description translation, origin tracking via remote link, editable diff preview before committing, and copy result reporting. Attachments (binary files), comment threads, work log, sub-tasks, and linked issues are Phase 5 — this phase copies only flat fields, description content, and inline description images.

</domain>

<decisions>
## Implementation Decisions

### Wiki→ADF translation strategy
- **D-01:** Use renderedFields HTML as intermediate — Jira Server renders wiki markup to HTML, then our converter transforms HTML→ADF nodes for Cloud v3
- **D-02:** Core formatting fidelity required: headings, bold/italic, code blocks, links, ordered/unordered lists, tables, and inline images. Unrecognized HTML elements degrade to plain text.
- **D-03:** Inline images in descriptions are downloaded from source Jira and re-uploaded as attachments to the target ticket, with ADF image URLs rewritten to point to the new attachment

### Copy preview UI
- **D-04:** Side-by-side diff in a full-screen modal — source ticket on left, target preview on right, with warning indicators on fields that changed or couldn't be mapped
- **D-05:** Description preview shows rendered HTML (same renderer as Phase 3 detail view), not raw ADF JSON
- **D-06:** Target side fields are editable — user can adjust status, priority, labels, and assignee before confirming

### Field mapping behavior
- **D-07:** Status: user picks target status from a dropdown in the preview (populated from target Jira's available statuses)
- **D-08:** Assignee: always assigned to the current user (the person doing the copy). No user lookup needed.
- **D-09:** Labels: user selects which labels to include via checkboxes in the preview. All source labels shown, all checked by default.
- **D-10:** Priority: user picks target priority from a dropdown in the preview (populated from target Jira's available priorities)

### Copy result feedback
- **D-11:** Result modal showing per-item status: core fields, description conversion, inline image uploads, origin link. Each item shows checkmark or X with details.
- **D-12:** Partial success is accepted — ticket is not rolled back if a secondary step fails (e.g., image upload). User sees exactly what succeeded and what failed.
- **D-13:** Result modal includes clickable link to the newly created ticket in company Jira ("Open in Company Jira")
- **D-14:** Ticket row in the list updates immediately after copy: triage state→copied (green checkmark) plus a small badge with the target ticket key linking to it

### Origin tracking
- **D-15:** Copied ticket in company Jira gets a remote link back to the source ticket in customer Jira (per COPY-07)

### Claude's Discretion
- HTML→ADF converter implementation details (Rust-side or frontend-side parsing)
- Exact modal layout, spacing, and transition animations
- Loading/progress states during the copy operation
- Error message wording for failed copy steps
- How target Jira statuses and priorities are fetched and cached

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, key decisions (Tauri, OS keychain, one-time copy with origin tracking)
- `.planning/REQUIREMENTS.md` — Phase 4 requirements: COPY-01, COPY-07, COPY-08, COPY-09
- `.planning/ROADMAP.md` — Phase 4 success criteria (4 criteria that must be TRUE)

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — React + TypeScript, Tailwind CSS, Zustand, feature-based organization, SQLite audit, mock server on :8080/:8081
- `.planning/phases/02-connection-setup/02-CONTEXT.md` — Settings page with gear icon, inline feedback pattern, "Source/Destination" labeling
- `.planning/phases/03-ticket-fetch-and-review/03-CONTEXT.md` — Side panel detail view with tabs, ticket table with triage indicators, DescriptionRenderer, image proxy

### Jira API
- Jira Cloud REST API: `POST /rest/api/3/issue` for creating issues, `POST /rest/api/3/issue/{key}/remotelink` for remote links
- Jira Server REST API: `GET /rest/api/2/issue/{key}?expand=renderedFields` for HTML-rendered descriptions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/mock_server.rs`: `create_issue` endpoints for both v2 and v3 — mock already supports issue creation
- `src-tauri/src/fixtures.rs`: `AdfDoc`, `AdfNode` types — ADF structure already modeled in Rust
- `src-tauri/src/jira_client.rs`: `JiraClient` with audit middleware — all API calls go through this
- `src-tauri/src/commands.rs`: `renderedFields` expansion already requested for v2 issue detail (line 409)
- `src/features/tickets/DescriptionRenderer.tsx`: Renders HTML descriptions — reusable for preview
- `src/features/tickets/types.ts`: `JiraTicketDetail` with both v2/v3 description types, full field interfaces
- `src/features/tickets/TriageIndicator.tsx`: Triage state display — will need "copied + link" variant
- `src/features/tickets/ticketStore.ts`: Zustand store pattern — extend for copy state

### Established Patterns
- Tauri IPC: commands in `src-tauri/src/commands.rs`, invoked from frontend via `@tauri-apps/api`
- Feature-based organization: `src/features/tickets/` for ticket-related UI
- Zustand for state management
- Tailwind CSS for all styling
- Image proxy through Rust backend (PAT auth for Jira image URLs)

### Integration Points
- Copy button added to ticket detail panel (side panel from Phase 3)
- Full-screen modal overlays the existing ticket list + detail view
- Triage state update after copy: `triage_db.rs` needs `copied` state with target ticket key
- Mock server `create_issue` endpoints need to return realistic responses for testing
- Mock server needs `remotelink` endpoint for origin tracking testing

</code_context>

<specifics>
## Specific Ideas

- Side-by-side diff makes field mapping gaps immediately visible — user sees source on left, target on right, with warning icons on mismatches
- Editable target fields in the preview (status dropdown, priority dropdown, label checkboxes) give the user full control over the copy
- Assignee always set to current user — simplifies the workflow since the user is copying tickets for their own team's Jira
- Partial success (no rollback) matches real-world expectations — a created ticket with a missing image is better than no ticket at all

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-copy-core-fields*
*Context gathered: 2026-03-22*
