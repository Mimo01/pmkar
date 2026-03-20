# Roadmap: Pmkar

## Overview

Pmkar delivers a cross-platform desktop tool that bridges two Jira instances. The build progresses from infrastructure inward: credentials and the mock server first (nothing else compiles against real APIs without them), then connection setup, then the read path (fetch and review), then the primary action (copy core fields, then full content), then triage and audit polish, and finally internationalization. Each phase delivers a coherent, verifiable capability and unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri scaffold, OS keychain credential store, mock Jira server (both API shapes), and security architecture (credential redaction, error boundaries) (completed 2026-03-20)
- [ ] **Phase 2: Connection Setup** - Setup wizard UI for dual-connection configuration with OS keychain write, connection validation against mock, and error handling
- [ ] **Phase 3: Ticket Fetch and Review** - Dual Jira adapter pair, JQL fetch with pagination, full ticket detail view, and persistent triage state schema
- [ ] **Phase 4: Copy — Core Fields** - End-to-end copy pipeline for flat fields with ADF translation, origin tracking, diff preview, and copy result reporting
- [ ] **Phase 5: Copy — Attachments and Comments** - Binary attachment transfer, comment copy with attribution, work log copy, and sub-task hierarchy
- [ ] **Phase 6: Triage and Audit** - Ignore workflow, ignored list view, session-persistent triage state, and in-app audit log viewer
- [ ] **Phase 7: Internationalization** - Language switcher, English language pack, and Slovak language pack

## Phase Details

### Phase 1: Foundation
**Goal**: The app compiles, runs, and provides the security and testability infrastructure every other phase builds on
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, CONN-03, AUDIT-01, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. The app launches as a Tauri desktop window on macOS, Windows, and Linux
  2. A PAT can be stored in and retrieved from the OS keychain without ever appearing in a log, config file, or IPC payload
  3. The mock Jira server starts and responds to both Jira Server v2 and Jira Cloud v3 API endpoint shapes with realistic fixture data
  4. The app can be run entirely against the mock server without any real PAT or Jira instance
  5. Every REST call logged by the audit system has the Authorization header value replaced with [REDACTED]
**Plans:** 4/4 plans complete

Plans:
- [ ] 01-01-PLAN.md — Scaffold Tauri project with all dependencies, error types, and test infrastructure
- [ ] 01-02-PLAN.md — OS keychain credential store and audit logging with SQLite + credential redaction
- [ ] 01-03-PLAN.md — Mock Jira server (dual port) with realistic fixture data
- [ ] 01-04-PLAN.md — Tauri command wiring, dev status UI, and end-to-end integration verification

### Phase 2: Connection Setup
**Goal**: Users can configure both Jira connections through a guided wizard, validate them, and receive meaningful feedback on failures
**Depends on**: Phase 1
**Requirements**: CONN-01, CONN-02, CONN-04, CONN-05, CONN-06
**Success Criteria** (what must be TRUE):
  1. User can open the setup wizard and enter base URL and PAT for the customer Jira Server connection
  2. User can enter base URL, email, and API token for the company Jira Cloud connection
  3. User can click "Test Connection" for each and see a clear success message or a specific failure reason (auth failure, permission error, rate limit, server error)
  4. Configured credentials persist across app restarts via the OS keychain (no plaintext storage)
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — Mock server /myself + /serverInfo endpoints and Rust test_jira_*_connection commands
- [ ] 02-02-PLAN.md — Zustand connection store, wizard React components, and App.tsx routing
- [ ] 02-03-PLAN.md — Settings page, AppShell gear icon, frontend tests, and visual verification

### Phase 3: Ticket Fetch and Review
**Goal**: Users can fetch candidate tickets from the customer Jira and see their full detail before taking any action
**Depends on**: Phase 2
**Requirements**: FETCH-01, FETCH-02, FETCH-03, FETCH-04, FETCH-05, FETCH-06, FETCH-07, FETCH-08, FETCH-09, FETCH-10, FETCH-11, FETCH-12
**Success Criteria** (what must be TRUE):
  1. User can click "Fetch" and see a list of candidate tickets from the customer Jira assigned to them, mentioning them, or assigned to watched users
  2. User can open any candidate ticket and see its full detail: summary, description, status, priority, assignee, reporter, labels, components, fix versions, comments, work log, attachments list, sub-tasks, linked issues, and change history
  3. User can configure watched users whose tickets are included in the candidate fetch
  4. User can customize the JQL query used to fetch candidates
  5. Ticket triage state (seen, ignored, copied) is remembered across app restarts
**Plans**: TBD

### Phase 4: Copy — Core Fields
**Goal**: Users can copy a ticket's core fields and metadata to the company Jira with full origin tracking and a preview before committing
**Depends on**: Phase 3
**Requirements**: COPY-01, COPY-07, COPY-08, COPY-09
**Success Criteria** (what must be TRUE):
  1. User can preview what will be created in company Jira before confirming a copy
  2. User can copy a ticket's summary, description, status, priority, assignee, and labels to the company Jira
  3. The copied ticket in company Jira contains a remote link back to the original source ticket
  4. Description content is correctly translated from Jira Server wiki markup to Jira Cloud ADF format (tables, code blocks, mentions, and numbered lists render correctly)
**Plans**: TBD

### Phase 5: Copy — Attachments and Comments
**Goal**: Users can copy tickets with full content fidelity: binary attachments, comment threads, work log, and sub-task hierarchy
**Depends on**: Phase 4
**Requirements**: COPY-02, COPY-03, COPY-04, COPY-05, COPY-06
**Success Criteria** (what must be TRUE):
  1. User can copy a ticket and have its binary attachment files downloaded from the source and uploaded to the destination ticket
  2. User can copy a ticket and see its comment thread reproduced in the destination with clear attribution indicating the original author and date
  3. User can copy a ticket and have its work log entries transferred with original author attribution
  4. User can copy a ticket with sub-tasks and find the sub-tasks created as child issues under the new parent ticket in company Jira
  5. User sees a clear per-item result for attachments (e.g., "3 copied, 1 failed") rather than a silent partial success
**Plans**: TBD

### Phase 6: Triage and Audit
**Goal**: Users can manage their review queue with a persistent ignore list and inspect the full API audit trail from within the app
**Depends on**: Phase 3
**Requirements**: TRIA-01, TRIA-02, TRIA-03, AUDIT-02
**Success Criteria** (what must be TRUE):
  1. User can mark a ticket as "not for me" and have it move out of the candidate list into an ignored list
  2. User can open the ignored list, see all previously ignored tickets, and un-ignore any of them to return them to the candidate list
  3. User can open an in-app audit log view that shows all REST API calls made during the session with timestamp, method, URL, status code, and response
  4. Ignored state survives app restart — re-launching does not re-surface ignored tickets
**Plans**: TBD

### Phase 7: Internationalization
**Goal**: The app UI is available in English and Slovak, switchable at runtime
**Depends on**: Phase 6
**Requirements**: I18N-01, I18N-02, I18N-03
**Success Criteria** (what must be TRUE):
  1. User can switch the app language from a language selector in the UI
  2. After switching to English, all UI strings display in English
  3. After switching to Slovak, all UI strings display in Slovak with no untranslated fallback strings visible

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4/6 (can be parallelized) → 5 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-20 |
| 2. Connection Setup | 0/3 | Not started | - |
| 3. Ticket Fetch and Review | 0/TBD | Not started | - |
| 4. Copy — Core Fields | 0/TBD | Not started | - |
| 5. Copy — Attachments and Comments | 0/TBD | Not started | - |
| 6. Triage and Audit | 0/TBD | Not started | - |
| 7. Internationalization | 0/TBD | Not started | - |
