# Phase 5: Copy — Attachments and Comments - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the copy pipeline to transfer binary attachments, comment threads with attribution, and work log entries from customer Jira Server to company Jira Cloud. Sub-tasks and linked issues are referenced in the copied description but not created as separate issues. This phase builds on the core field copy from Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Comment attribution
- **D-01:** Comments copied with bold prefix line showing original author and date: **[Author Name] — YYYY-MM-DD HH:MM** followed by the comment body on the next line
- **D-02:** Comment bodies converted from wiki markup to ADF using the same renderedFields HTML→ADF pipeline built in Phase 4 (reuse existing converter)
- **D-03:** All comments copied automatically — no per-comment selection in preview
- **D-04:** Comments posted in chronological order (oldest-first) to preserve thread sequence

### Attachment copy
- **D-05:** All attachments copied automatically — download binary from source Server, upload via multipart to target Cloud ticket (extends existing inline image upload pattern from Phase 4 D-03)
- **D-06:** Per-file status reported in the result modal — each attachment listed as a step with checkmark/X and failure reason (consistent with Phase 4 D-11 pattern). e.g., "screenshot.png ✔", "database-dump.sql ✘ (413 too large)"

### Work log copy
- **D-07:** Work log entries copied with author attribution prefix (same bold prefix format as comments: **[Author] — YYYY-MM-DD**)
- **D-08:** Work log entries include time spent value in the attribution line

### Sub-task handling
- **D-09:** Sub-tasks are NOT created as child issues in Cloud Jira — they are listed in a "Sub-tasks" section appended to the bottom of the copied description
- **D-10:** Each sub-task entry shows source key + summary (e.g., "CUST-101: Fix login timeout")

### Linked issue handling
- **D-11:** Linked issues are NOT created as remote links — they are listed in a "Linked Issues" section appended to the description footer (below sub-tasks)
- **D-12:** Each linked issue entry shows link type + source key + summary (e.g., "Blocks: CUST-200 — API rate limiting")

### Claude's Discretion
- Attachment download/upload concurrency strategy (sequential vs parallel)
- Error handling for individual attachment/comment failures within the partial-success model
- Mock server enhancements needed for testing attachment and comment copy flows
- How the preview modal displays attachment count, comment count, and sub-task/linked issue lists before copy
- Work log API endpoint details and mock server support

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, key decisions (one-time copy with origin tracking, partial success accepted)
- `.planning/REQUIREMENTS.md` — Phase 5 requirements: COPY-02, COPY-03, COPY-04, COPY-05, COPY-06

### Prior phase context
- `.planning/phases/04-copy-core-fields/04-CONTEXT.md` — Copy pipeline architecture, wiki→ADF conversion (D-01/D-02/D-03), result modal (D-11), partial success (D-12), multipart upload pattern
- `.planning/phases/03-ticket-fetch-and-review/03-CONTEXT.md` — Side panel detail view with tabs, ticket types, image proxy

### Jira API
- Jira Cloud REST API: `POST /rest/api/3/issue/{key}/attachments` for attachment upload (multipart, X-Atlassian-Token: no-check)
- Jira Cloud REST API: `POST /rest/api/3/issue/{key}/comment` for adding comments
- Jira Cloud REST API: `POST /rest/api/3/issue/{key}/worklog` for adding work log entries
- Jira Server REST API: `GET /rest/api/2/issue/{key}?expand=renderedFields` for rendered comment bodies
- Jira Server REST API: `GET /rest/api/2/issue/{key}/worklog` for work log entries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/commands.rs:copy_ticket` — Existing copy pipeline with multipart attachment upload (inline images). Extend for standalone attachments and comments.
- `src-tauri/src/commands.rs:fetch_worklog` — Already fetches work log from Server v2 API. Reuse for copy.
- `src/features/tickets/tabs/AttachmentsTab.tsx` — Read-only attachment display (filename, size, mimeType). Already renders attachment list.
- `src/features/tickets/tabs/CommentsTab.tsx` — Read-only comment display with author names and relative timestamps. Handles both string and JSON body formats.
- `src/features/tickets/tabs/WorkLogTab.tsx` — Fetches and displays work log via invoke('fetch_worklog').
- `src-tauri/src/mock_server.rs` — Has `add_comment` and `add_attachment` routes for both v2 and v3 mock servers. Extend for work log.

### Established Patterns
- Multipart upload via plain `reqwest::Client` (not middleware) — reqwest_middleware doesn't support multipart (Phase 4 decision)
- CopyStepResult per item in result modal — extend with attachment/comment/worklog steps
- Cloud Basic auth via `cloud_email:cloud_api_token` base64 — same pattern for all Cloud API calls
- Server PAT auth via `Bearer {pat}` header — same for all Server API calls

### Integration Points
- `copy_ticket` command needs additional parameters or internal logic to handle attachments, comments, work log
- Result modal (`CopyPreviewModal.tsx`) needs to display new step types (attachments, comments, worklog)
- Preview modal needs attachment count, comment count, sub-task list, and linked issue list sections
- Mock server needs work log POST endpoint and possibly richer comment/attachment fixtures

</code_context>

<specifics>
## Specific Ideas

- Sub-tasks and linked issues as description footer sections follows the same visual pattern — clean, scannable lists appended after the main description content
- Bold prefix attribution format for comments: **Jane Smith — 2025-01-15 14:30** on its own line, then the comment body
- Per-file attachment status in result modal matches the established D-11 pattern from Phase 4 — users already understand this UI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-copy-attachments-and-comments*
*Context gathered: 2026-03-22*
