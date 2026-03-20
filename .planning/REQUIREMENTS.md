# Requirements: Pmkar

**Defined:** 2026-03-19
**Core Value:** Surface relevant tickets from customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Connection & Security

- [x] **CONN-01**: User can configure connection to customer's self-hosted Jira Server via base URL and PAT
- [x] **CONN-02**: User can configure connection to company's Jira Cloud via base URL, email, and API token
- [x] **CONN-03**: User credentials are stored in OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service)
- [x] **CONN-04**: User can test each connection and see clear success/failure feedback
- [x] **CONN-05**: App displays meaningful error messages for auth failures (401), permission errors (403), rate limits (429), and server errors (5xx)
- [x] **CONN-06**: Setup wizard guides user through configuring both connections step-by-step

### Ticket Fetch & Review

- [ ] **FETCH-01**: User can fetch candidate tickets from customer Jira assigned to them
- [ ] **FETCH-02**: User can fetch candidate tickets where they were mentioned
- [ ] **FETCH-03**: User can configure watched users and fetch their tickets too
- [ ] **FETCH-04**: User can view full ticket detail: summary, description, status, priority, assignee, reporter, labels, components, fix versions
- [ ] **FETCH-05**: User can view ticket comments thread with authors and timestamps
- [ ] **FETCH-06**: User can view ticket work log entries with authors and time spent
- [ ] **FETCH-07**: User can view ticket attachments list with filenames and sizes
- [ ] **FETCH-08**: User can view ticket sub-tasks list
- [ ] **FETCH-09**: User can view ticket linked issues
- [ ] **FETCH-10**: User can view ticket change history
- [ ] **FETCH-11**: User can customize the JQL query used to fetch candidates
- [ ] **FETCH-12**: App remembers triage state (seen/ignored/copied) across sessions

### Copy Workflow

- [ ] **COPY-01**: User can copy a ticket's core fields (summary, description, status, priority, assignee, labels) to company Jira
- [ ] **COPY-02**: User can copy ticket attachments as full binary files (download from source, upload to target)
- [ ] **COPY-03**: User can copy ticket comment thread with author attribution prefix
- [ ] **COPY-04**: User can copy ticket work log entries with author attribution
- [ ] **COPY-05**: User can copy sub-tasks as child issues under the newly created parent ticket
- [ ] **COPY-06**: User can copy linked issue references as annotations or remote links
- [ ] **COPY-07**: Copied ticket includes a remote link back to the source ticket for origin tracking
- [ ] **COPY-08**: User sees a diff/preview of what will be created before confirming the copy
- [ ] **COPY-09**: Description and comment content is correctly translated between wiki markup (Server) and ADF (Cloud)

### Triage

- [ ] **TRIA-01**: User can mark a ticket as "not for me" to move it to the ignored list
- [ ] **TRIA-02**: User can view the ignored tickets list
- [ ] **TRIA-03**: User can un-ignore a ticket to bring it back to the candidate list

### Audit & Logging

- [x] **AUDIT-01**: All REST API calls are logged with timestamp, method, URL, status code, and response
- [ ] **AUDIT-02**: User can view the audit log within the app
- [x] **AUDIT-03**: Audit log redacts credentials and sensitive auth headers

### Internationalization

- [ ] **I18N-01**: App UI supports multiple languages with a language switcher
- [ ] **I18N-02**: English language pack is complete and is the default language
- [ ] **I18N-03**: Slovak language pack is complete

### Testing Infrastructure

- [x] **TEST-01**: Mock Jira server simulates Jira Server v2 API responses
- [x] **TEST-02**: Mock Jira server simulates Jira Cloud v3 API responses
- [x] **TEST-03**: App can run fully against mock server without real PATs

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Export

- **EXPORT-01**: User can export ticket data to Excel (.xlsx)
- **EXPORT-02**: User can select which fields to include in export

### Enhanced Features

- **ENH-01**: User can re-copy/update a previously copied ticket when source changes
- **ENH-02**: User receives notification when watched tickets change

## Out of Scope

| Feature | Reason |
|---------|--------|
| Two-way sync | Complexity 10x — conflict resolution, webhooks, field locking. One-way copy with origin tracking sufficient |
| Real-time push notifications | Requires webhooks or polling daemon. Batch/daily workflow is the design |
| OAuth/SSO authentication | PATs are the correct auth method for server-to-server. OAuth requires admin and redirect URI |
| Full custom field mapping UI | A product unto itself. Standard fields + custom fields preserved as text |
| Bulk copy (select all) | Defeats review workflow purpose. Copy is ticket-by-ticket with explicit action |
| In-app Jira editor | Scope creep into Jira client. App bridges two systems, doesn't replace Jira UI |
| Background sync daemon | Hard to audit, credential access outside app context. On-demand launch only |
| Mobile app | Desktop-only workflow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 2 | Complete |
| CONN-02 | Phase 2 | Complete |
| CONN-03 | Phase 1 | Complete |
| CONN-04 | Phase 2 | Complete |
| CONN-05 | Phase 2 | Complete |
| CONN-06 | Phase 2 | Complete |
| FETCH-01 | Phase 3 | Pending |
| FETCH-02 | Phase 3 | Pending |
| FETCH-03 | Phase 3 | Pending |
| FETCH-04 | Phase 3 | Pending |
| FETCH-05 | Phase 3 | Pending |
| FETCH-06 | Phase 3 | Pending |
| FETCH-07 | Phase 3 | Pending |
| FETCH-08 | Phase 3 | Pending |
| FETCH-09 | Phase 3 | Pending |
| FETCH-10 | Phase 3 | Pending |
| FETCH-11 | Phase 3 | Pending |
| FETCH-12 | Phase 3 | Pending |
| COPY-01 | Phase 4 | Pending |
| COPY-02 | Phase 5 | Pending |
| COPY-03 | Phase 5 | Pending |
| COPY-04 | Phase 5 | Pending |
| COPY-05 | Phase 5 | Pending |
| COPY-06 | Phase 5 | Pending |
| COPY-07 | Phase 4 | Pending |
| COPY-08 | Phase 4 | Pending |
| COPY-09 | Phase 4 | Pending |
| TRIA-01 | Phase 6 | Pending |
| TRIA-02 | Phase 6 | Pending |
| TRIA-03 | Phase 6 | Pending |
| AUDIT-01 | Phase 1 | Complete |
| AUDIT-02 | Phase 6 | Pending |
| AUDIT-03 | Phase 1 | Complete |
| I18N-01 | Phase 7 | Pending |
| I18N-02 | Phase 7 | Pending |
| I18N-03 | Phase 7 | Pending |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 1 | Complete |
| TEST-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation — all 39 requirements mapped*
