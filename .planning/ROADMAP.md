# Roadmap: Pmkar

## Overview

Pmkar delivers a cross-platform desktop tool that bridges two Jira instances. The build progresses from infrastructure inward: credentials and the mock server first (nothing else compiles against real APIs without them), then connection setup, then the read path (fetch and review), then the primary action (copy core fields, then full content), then triage and audit polish, and finally internationalization. Each phase delivers a coherent, verifiable capability and unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Tauri scaffold, OS keychain credential store, mock Jira server (both API shapes), and security architecture (credential redaction, error boundaries) (completed 2026-03-20)
- [x] **Phase 2: Connection Setup** - Setup wizard UI for dual-connection configuration with OS keychain write, connection validation against mock, and error handling (completed 2026-03-20)
- [ ] **Phase 3: Ticket Fetch and Review** - Dual Jira adapter pair, JQL fetch with pagination, full ticket detail view, and persistent triage state schema
- [x] **Phase 4: Copy — Core Fields** - End-to-end copy pipeline for flat fields with ADF translation, origin tracking, diff preview, and copy result reporting (completed 2026-03-22)
- [x] **Phase 5: Copy — Attachments and Comments** - Binary attachment transfer, comment copy with attribution, work log copy, and sub-task hierarchy (completed 2026-03-22)
- [x] **Phase 6: Triage and Audit** - Ignore workflow, ignored list view, session-persistent triage state, and in-app audit log viewer (completed 2026-03-23)
- [x] **Phase 7: Internationalization** - Language switcher, English language pack, and Slovak language pack (completed 2026-03-23)

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
**Plans:** 3/3 plans complete

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
**Plans:** 5 plans

Plans:
- [x] 03-01-PLAN.md — Rust backend: triage_db, mock server extensions, enriched fixtures, fetch/triage Tauri commands
- [x] 03-02-PLAN.md — TypeScript types and Zustand ticket store
- [x] 03-03-PLAN.md — TicketListPage, TicketTable, TriageIndicator, App.tsx routing
- [x] 03-04-PLAN.md — TicketDetailPanel with all 5 tabs and DescriptionRenderer
- [x] 03-05-PLAN.md — Settings FetchConfigSection, frontend tests, and visual verification

### Phase 4: Copy — Core Fields
**Goal**: Users can copy a ticket's core fields and metadata to the company Jira with full origin tracking and a preview before committing
**Depends on**: Phase 3
**Requirements**: COPY-01, COPY-07, COPY-08, COPY-09
**Success Criteria** (what must be TRUE):
  1. User can preview what will be created in company Jira before confirming a copy
  2. User can copy a ticket's summary, description, status, priority, assignee, and labels to the company Jira
  3. The copied ticket in company Jira contains a remote link back to the original source ticket
  4. Description content is correctly translated from Jira Server wiki markup to Jira Cloud ADF format (tables, code blocks, mentions, and numbered lists render correctly)
**Plans:** 5/5 plans complete

Plans:
- [x] 04-01-PLAN.md — Rust infra: htmltoadf crate, reqwest multipart, mock server Cloud endpoints, triage_db copied_key
- [x] 04-02-PLAN.md — TypeScript copy types, copyStore Zustand store, Wave 0 test scaffolds
- [x] 04-03-PLAN.md — Rust commands: fetch_cloud_meta and copy_ticket pipeline
- [x] 04-04-PLAN.md — CopyPreviewModal, Copy button in detail panel, TriageIndicator extension
- [x] 04-05-PLAN.md — CopyResultModal, progress states, triage refresh, and visual verification

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
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — Rust backend: mock server extensions, copy_ticket pipeline for attachments, comments, worklogs, and description footer
- [x] 05-02-PLAN.md — Frontend: CopyPreviewModal and CopyResultModal extensions, copyStore progress, tests, and visual verification
- [x] 05-03-PLAN.md — Gap closure: sub-task child issue creation via Cloud API (COPY-05)

### Phase 6: Triage and Audit
**Goal**: Users can manage their review queue with a persistent ignore list and inspect the full API audit trail from within the app
**Depends on**: Phase 3
**Requirements**: TRIA-01, TRIA-02, TRIA-03, AUDIT-02
**Success Criteria** (what must be TRUE):
  1. User can mark a ticket as "not for me" and have it move out of the candidate list into an ignored list
  2. User can open the ignored list, see all previously ignored tickets, and un-ignore any of them to return them to the candidate list
  3. User can open an in-app audit log view that shows all REST API calls made during the session with timestamp, method, URL, status code, and response
  4. Ignored state survives app restart — re-launching does not re-surface ignored tickets
**Plans:** 3/3 plans complete

Plans:
- [x] 06-01-PLAN.md — Backend get_audit_count, AppShell nav tabs + footer, App.tsx routing, TicketListPage ignore filter
- [x] 06-02-PLAN.md — IgnoredTicketsPage with restore action and tests
- [x] 06-03-PLAN.md — AuditLogPage with expandable rows and tests

### Phase 7: Internationalization
**Goal**: The app UI is available in English and Slovak, switchable at runtime
**Depends on**: Phase 6
**Requirements**: I18N-01, I18N-02, I18N-03
**Success Criteria** (what must be TRUE):
  1. User can switch the app language from a language selector in the UI
  2. After switching to English, all UI strings display in English
  3. After switching to Slovak, all UI strings display in Slovak with no untranslated fallback strings visible
**Plans:** 3/3 plans complete

Plans:
- [x] 07-01-PLAN.md — i18n infrastructure: Rust backend persistence, i18next init, languageStore, formatting utils, App.tsx wiring
- [x] 07-02-PLAN.md — Complete en.json + sk.json translation packs, string extraction from all components, LanguageSection in SettingsPage
- [x] 07-03-PLAN.md — i18n test suite (language store, translation completeness, SettingsPage dropdown) and visual verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4/6 (can be parallelized) → 5 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-20 |
| 2. Connection Setup | 3/3 | Complete   | 2026-03-20 |
| 3. Ticket Fetch and Review | 0/5 | Not started | - |
| 4. Copy — Core Fields | 5/5 | Complete   | 2026-03-22 |
| 5. Copy — Attachments and Comments | 3/3 | Complete   | 2026-03-22 |
| 6. Triage and Audit | 3/3 | Complete   | 2026-03-23 |
| 7. Internationalization | 3/3 | Complete   | 2026-03-23 |
| 8. UI Redesign | 6/6 | Complete   | 2026-03-24 |
| 9. Accessibility | 4/4 | Complete   | 2026-03-24 |

### Phase 8: Fully redesign the app UI — modern, sleek, easy to use

**Goal:** Complete visual overhaul to a Linear-inspired minimal aesthetic using shadcn/ui, Lucide icons, card-based ticket lists, full-page detail view, and polished settings/modals — all functionality preserved
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Depends on:** Phase 7
**Success Criteria** (what must be TRUE):
  1. All hand-coded SVG icons are replaced with Lucide React icons
  2. Ticket list uses compact 3-line cards instead of sortable tables (all 3 tabs)
  3. Clicking a ticket shows a full-page detail view (not a side panel) with back navigation preserving tab context
  4. Copy preview and result modals use shadcn Dialog with progress visualization
  5. Settings page uses a sidebar nav layout with section-based content
  6. Loading states show skeleton cards, empty states show heading + body text
  7. Dark and light themes both render correctly with the merged token system
**Plans:** 6/6 plans complete

Plans:
- [x] 08-01-PLAN.md — shadcn/ui init, Lucide install, CSS token merge, AppShell redesign
- [x] 08-02-PLAN.md — TicketCard component, card-based list pages (New, Ignored, Linked)
- [x] 08-03-PLAN.md — TicketDetailPage full-page view, App.tsx routing update
- [x] 08-04-PLAN.md — CopyPreviewModal/CopyResultModal redesign, SettingsPage sidebar nav
- [x] 08-05-PLAN.md — AuditLogPage polish, i18n keys, SetupWizard polish, visual verification

### Phase 9: Increase accessibility - ARIA compatible inputs, sufficient contrast in light and dark modes, and general a11y improvements

**Goal:** WCAG AA compliant accessibility across the entire UI — dark mode contrast meets 4.5:1 for text, all interactive elements are keyboard accessible, form inputs have proper label associations, ARIA semantics are complete, and no information is conveyed by color alone
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06
**Depends on:** Phase 8
**Success Criteria** (what must be TRUE):
  1. All normal text in dark mode meets WCAG AA 4.5:1 contrast ratio against its background
  2. No status indicator (priority, triage state, copy status) relies on color alone — each is paired with visible text or distinct icon shape
  3. All clickable elements (ticket cards, audit log rows) are focusable via Tab and activatable via Enter/Space
  4. All form inputs have associated labels (via htmlFor/id or wrapping) and error messages linked via aria-describedby
  5. Semantic landmarks (main, nav with labels) and ARIA attributes (tabpanel, radiogroup, live regions) are complete
  6. Async operations (copy progress, fetch status) announce state changes via aria-live regions
**Plans:** 4/4 plans complete

Plans:
- [x] 09-01-PLAN.md — Dark mode contrast token fixes, AppShell main landmark, StatusBadge dark colors, tab panel ARIA
- [x] 09-02-PLAN.md — TicketCard keyboard access, PriorityDot text pairing, TriageIndicator semantics, AuditLogPage keyboard rows
- [x] 09-03-PLAN.md — CopyPreviewModal form labeling, ConnectionForm error linking, live regions for copy progress and fetch status
- [x] 09-04-PLAN.md — SettingsPage nav label, JQL radiogroup semantics, watched users combobox ARIA
