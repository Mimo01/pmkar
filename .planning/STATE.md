---
gsd_state_version: 1.0
milestone: v0.4.0
milestone_name: Configurable Field Mapping
status: planning
stopped_at: Phase 19 complete — ready to plan Phase 20
last_updated: "2026-04-27T20:30:00.000Z"
last_activity: 2026-04-27 -- Phase 19 execution complete (2/2 plans, 165 tests passing)
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Surface relevant tickets from customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.
**Current focus:** v0.4.0 Configurable Field Mapping — Phase 19 complete, ready for Phase 20

## Current Position

Phase: 20 (Renderer Registry + Field-Type-Aware Controls) — next up
Plan: none yet
Status: Phase 19 complete, ready to plan Phase 20
Last activity: 2026-04-27 -- Phase 18 execution complete (5/5 plans, 157 tests passing)

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: 7 min
- Total execution time: 0.12 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1 | 7 min | 7 min |

**Recent Trend:**

- Last 5 plans: 01-01 (7 min)
- Trend: baseline established

*Updated after each plan completion*
| Phase 01-foundation P01 | 7 | 2 tasks | 18 files |
| Phase 01-foundation P02 | 6 | 2 tasks | 6 files |
| Phase 01-foundation P03 | 7 | 2 tasks | 4 files |
| Phase 01-foundation P04 | 3 | 3 tasks | 10 files |
| Phase 02-connection-setup P01 | 2 | 2 tasks | 4 files |
| Phase 02-connection-setup P02 | 4 | 2 tasks | 10 files |
| Phase 02-connection-setup P03 | 90 | 2 tasks | 10 files |
| Phase 02-connection-setup P03 | 90 | 3 tasks | 10 files |
| Phase 03 P02 | 2min | 2 tasks | 2 files |
| Phase 03 P01 | 7 | 2 tasks | 8 files |
| Phase 04-copy-core-fields P02 | 12 | 2 tasks | 4 files |
| Phase 04-copy-core-fields P01 | 15 | 2 tasks | 4 files |
| Phase 04-copy-core-fields P03 | 4 | 2 tasks | 2 files |
| Phase 04 P04 | 15 | 2 tasks | 5 files |
| Phase 04-copy-core-fields P05 | 15 | 2 tasks | 3 files |
| Phase 05-copy-attachments-and-comments P02 | 7 | 2 tasks | 5 files |
| Phase 05 P01 | 25 | 2 tasks | 2 files |
| Phase 05-copy-attachments-and-comments P03 | 12 | 1 tasks | 5 files |
| Phase 06-triage-and-audit P01 | 10min | 2 tasks | 7 files |
| Phase 06-triage-and-audit P03 | 2min | 1 tasks | 2 files |
| Phase 06-triage-and-audit P02 | 4min | 1 tasks | 2 files |
| Phase 07-internationalization P01 | 20 | 2 tasks | 14 files |
| Phase 07-internationalization P02 | 16 | 2 tasks | 26 files |
| Phase 08 P01 | 9 | 2 tasks | 20 files |
| Phase 08 P03 | 3 | 2 tasks | 2 files |
| Phase 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use P02 | 3min | 2 tasks | 7 files |
| Phase 08 P04 | 18 | 3 tasks | 5 files |
| Phase 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use P05 | 15 | 2 tasks | 3 files |
| Phase 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use P06 | 5 | 1 tasks | 1 files |
| Phase 09 P03 | 2 | 2 tasks | 3 files |
| Phase 09 P01 | 8 | 2 tasks | 3 files |
| Phase 09-increase-accessibility-aria-compatible-inputs-sufficient-contrast-in-light-and-dark-modes-and-general-a11y-improvements P04 | 2 | 1 tasks | 1 files |
| Phase 09 P02 | 3 | 2 tasks | 4 files |
| Phase 10-improve-codebase-quality P02 | 35min | 2 tasks | 13 files |
| Phase 10 P03 | 25 | 2 tasks | 6 files |
| Phase 10-improve-codebase-quality P04 | 180 | 2 tasks | 28 files |
| Phase 10-improve-codebase-quality P05 | 5 | 1 tasks | 1 files |
| Phase 11-add-deployment-auto-updates-and-release-management P02 | 2 | 2 tasks | 3 files |
| Phase 11-add-deployment-auto-updates-and-release-management P01 | 4 | 2 tasks | 9 files |
| Phase 11-add-deployment-auto-updates-and-release-management P03 | 12 | 2 tasks | 11 files |
| Phase 16-enhanced-watch-configuration P01 | 12 | 2 tasks | 6 files |
| Phase 16-enhanced-watch-configuration P02 | 18 | 1 tasks | 2 files |
| Phase 17-field-discovery-mock-schema-fidelity P04 | 55 | 3 tasks | 5 files |
| Phase 17-field-discovery-mock-schema-fidelity P05 | 8 | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work (v0.4.0 Configurable Field Mapping):

- Configurable field mapping (v0.4.0): hardcoded fields don't survive real-world Jira diversity; custom fields and per-customer schemas need user control
- Global mapping scope (one mapping for app): simpler than per-project-pair or per-issue-type; combined with per-copy override gives flexibility without config explosion
- Person picker always visible with email-match pre-fill: avoids silent assignment failures; user sees outcome before commit
- Block copy on unmapped required target fields: prevents Jira Cloud rejection mid-pipeline; explicit better than auto-default
- Target issue type chosen at copy time: source/target type semantics differ across Jiras; auto-match too brittle
- Defer real ADF rich-text editor to post-v0.4.0: `@atlaskit/editor-core` adds 2-3 MB gzip; v0.4.0 ships textarea + htmltoadf preview using existing pipeline
- Separate `mapping.db` SQLite file: do NOT extend `triage_db.rs` (already 5 concerns); follow `snapshot_db.rs` precedent

Recent v0.3.0 / v0.1.0 decisions retained for reference:

- Tauri over Electron: Rust backend enforces credential isolation by architecture, not convention
- OS keychain for credentials: macOS Keychain / Windows Credential Manager / Linux Secret Service via keyring crate
- One-time copy with origin tracking: full sync deferred as out of scope
- Mock server from day one: no real PATs available; mock is the primary dev environment
- Excel export deferred to v2: core ticket workflow is priority
- [01-01] jsdom installed as explicit devDependency — vitest@4 requires it as peer dep but does not auto-install
- [01-01] mock-server Cargo feature flag (not runtime env var) — mock compiled out of release builds
- [01-01] reqwest::Error mapped without .to_string() — credential leak prevention at type system level
- [01-01] Workspace Cargo.toml at project root — allows cargo commands from project root
- [Phase 01-02]: reqwest upgraded 0.12 to 0.13 — reqwest-middleware 0.5.1 requires reqwest 0.13; version mismatch caused Middleware trait type errors
- [Phase 01-02]: http = 1 added as explicit dep — http::Extensions required by reqwest_middleware::Middleware trait, not re-exported by reqwest-middleware
- [Phase 01-02]: Audit failure is silent (let _ = db.insert) — audit subsystem must never break production HTTP calls
- [Phase 01-02]: Authorization header redacted via header map clone before next.run() — credentials structurally unreachable in log
- [Phase 01-03]: std::sync::Once + dedicated std::thread for test server ensures servers persist across per-test tokio runtimes
- [Phase 01-03]: AdfDoc.version: u8 = 1 enforced via struct — ADF version field cannot be omitted by accident
- [Phase 01-03]: SharedFixtures shared between v2 and v3 routers via Arc::clone — single source of truth for created issues
- [Phase 01-foundation]: use tauri::Manager must be imported explicitly — path() and manage() methods are not in scope by default in Tauri 2.x setup closures
- [Phase 01-foundation]: setup() closure in Tauri Builder must use 'move' keyword — captured state must satisfy 'static lifetime
- [Phase 01-foundation]: ping_mock_servers uses POST for v3 search/jql (not GET) — matches axum route definition in mock_server.rs
- [Phase 02-01]: State type changed from Mutex<AuditDb> to Arc<Mutex<AuditDb>> — build_audited_client requires Arc; Tauri State inner() returns &T not Arc
- [Phase 02-01]: fetch_server_version non-fatal: /myself confirms auth, serverInfo version is best-effort
- [Phase 02-01]: base64 = 0.22 added as explicit dep for Cloud Basic auth base64 encoding
- [Phase 02-02]: SetupWizard owns store_credential and Zustand store update on test success; ConnectionForm only owns test invoke calls for reusability
- [Phase 02-02]: App.tsx wizard branch uses no AppShell wrapper — wizard provides its own full-page centered layout
- [Phase 02-03]: currentCredentialsRef useRef in ConnectionForm prevents stale-closure race in setTimeout invalidation callbacks
- [Phase 02-03]: SetupWizard multi-step tests use initialStep=3 with pre-populated store for determinism in React 19 async environment
- [Phase 02-03]: App.tsx three-branch conditional: !hasSetup||editStep shows wizard, showSettings shows SettingsPage, otherwise DevStatusPanel
- [Phase 02-03]: http:// URL allowed for localhost in dev — connection test URL validator accepts http:// for 127.0.0.1/localhost so mock servers work without TLS
- [Phase 02-03]: open_external_url Tauri command required for external links — <a target=_blank> is silently swallowed in webviews; invoke-based opener added to SecretInput help links
- [Phase 03]: Followed connectionStore Zustand pattern for ticket store shape
- [Phase 03]: Ticket types support dual Jira API: string|Record for v2/v3 body fields
- [Phase 03]: TriageDb follows AuditDb pattern for SQLite persistence consistency
- [Phase 03]: Image proxy validates URL origin to prevent SSRF
- [Phase 04-copy-core-fields]: Jira Cloud v3 does not support setting status at issue creation — status field in copy preview is informational only
- [Phase 04-copy-core-fields]: Wave 0 test scaffolding pattern: create it.todo stubs tagged with requirement IDs before component exists
- [Phase 04-copy-core-fields]: triage_db internal get_all_triage returns raw tuples to keep DB layer decoupled from DTO types
- [Phase 04-copy-core-fields]: FetchTicketsResult.triage_map updated to TriageEntryResponse for single consistent shape sent to frontend
- [Phase 04-copy-core-fields]: Used plain reqwest::Client for multipart image uploads because reqwest_middleware::ClientWithMiddleware lacks .multipart() support
- [Phase 04-copy-core-fields]: target_status parameter in copy_ticket is informational only — Cloud v3 API does not support status at issue creation
- [Phase 04]: CopyPreviewModal renders null when phase is not previewing/copying — clean unmount
- [Phase 04]: TicketTable uses helper functions for backward compat between TriageState string and TriageEntry object
- [Phase 04-copy-core-fields]: Triage refresh on close: invoke get_triage_state in finally block so reset always fires even on network error
- [Phase 05-copy-attachments-and-comments]: Failed attach: step emits detail in both stepLabel span and detail paragraph — tests use getAllByText to handle dual rendering
- [Phase 05-copy-attachments-and-comments]: No real-time attachment/comment progress (single Tauri invoke) — progressStep updated to reflect all phases, per-item detail shown post-completion
- [Phase 05]: Attachment loop placed after add_remotelink step so issue exists with description before binary uploads
- [Phase 05]: Comment loop uses renderedFields.comment.comments HTML with fallback to fields.comment.comments plain text
- [Phase 05]: Worklogs fetched from source v2 worklog API independently, not from issue fields
- [Phase 05-copy-attachments-and-comments]: Sub-task description footer retained alongside child issue creation (both annotation and actual child issues)
- [Phase 06-triage-and-audit]: AppShell nav/footer gated on optional callbacks (onTabChange, onAuditClick) for backward compatibility with wizard/settings views
- [Phase 06-triage-and-audit]: candidateTickets filtered at TicketListPage level, not in ticketStore — store retains all tickets for ignored list view in Plan 02
- [Phase 06-03]: Single expandedId (number|null) state for accordion — enforces one-at-a-time constraint with minimal complexity
- [Phase 06-03]: formatResponseBody wraps JSON.parse in try/catch — handles non-JSON bodies without crashing
- [Phase 06-02]: Sort by updated DESC fixed order in IgnoredTicketsPage (no user-selectable sort headers) — ignored list is simpler than main table
- [Phase 06-02]: relativeTime inlined in IgnoredTicketsPage — not yet enough callsites to justify extraction to shared utility
- [Phase 07-internationalization]: i18n: sys-locale Rust crate for OS locale detection, app_config SQLite table for persistence (D-08/D-09/D-10), i18n initialized at module import with Promise.all hydration gate
- [Phase 07-02]: audit.close key added for aria-label semantics — tests expected 'Close audit log'; dedicated key separate from 'Back' heading text
- [Phase 07-02]: WizardStep.tsx left without useTranslation — renders only props; translated strings supplied by SetupWizard caller
- [Phase 08]: Use relative import in AppShell.tsx for tooltip components instead of @/ alias to avoid vitest test resolution issues
- [Phase 08]: Add @/ alias to vitest.config.ts separately — separate vitest config overrides vite.config.ts test settings
- [Phase 08]: shadcn/ui components use CSS variable token bridge pattern — brand tokens aliased to shadcn semantic variables in @theme block
- [Phase 08-03]: TicketDetailPage derives baseUrl and cloudBaseUrl from connectionStore directly, not as props — store-first pattern
- [Phase 08-03]: Detail page routing in App.tsx as priority 4 branch preserving all existing route priorities and currentTab state
- [Phase 08-02]: actionSlot prop on TicketCard enables tab-specific actions (Restore button, linked key badge) without component forking
- [Phase 08-02]: TicketTable retained as deprecated reference rather than deleted to preserve sort/compare logic
- [Phase 08]: shadcn Dialog for copy modals — eliminates hand-built z-index stacking, provides accessible Radix modal semantics
- [Phase 08]: border-l-2 border-brand active indicator for settings sidebar — cleaner than background highlight, matches Linear design
- [Phase 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use]: AuditLogPage header changed from X-close to ArrowLeft back button pattern matching SettingsPage and TicketDetailPage
- [Phase 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use]: methodColor updated to spec-correct colors (green/blue/yellow/red per HTTP method)
- [Phase 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use]: Lucide icon class sizes: w-3.5 h-3.5 for small UI icons (Search, X), w-4 h-4 for section-level theme icons (Sun, Moon, Monitor)
- [Phase 09]: Labels section heading converted from label to span since it describes a group not a single input, avoiding invalid label-without-control association
- [Phase 09]: Dark muted token set to #7f7f7f (4.52:1 on dark bg) for WCAG AA compliance, only overridden in body.dark block
- [Phase 09]: aria-hidden on TooltipContent (not trigger) since button aria-label already provides accessible name
- [Phase 09]: tabIndex=0 on tabpanel required for keyboard focus after tab selection per ARIA spec
- [Phase 09]: Used aria-label on search input instead of visible label; added aria-hidden to visual radio dots since aria-checked conveys state
- [Phase 10-02]: File-level #[allow(needless_pass_by_value)] in commands.rs — Tauri command args must be owned types per framework design
- [Phase 10-02]: rustfmt.toml uses only stable-channel options — nightly-only imports_granularity and group_imports removed
- [Phase 10]: Use --legacy-peer-deps for TS6 + i18next peer conflict; i18next peerOptional typescript@^5 does not affect runtime
- [Phase 10]: Added vite-env.d.ts with Vite client reference for TS6 CSS import compatibility (TS2882 fix)
- [Phase 10-04]: Set pragmatic coverage thresholds (lines 80, functions 75, branches 65) — Tauri invoke async paths are not exercisable in jsdom without major infrastructure overhead
- [Phase 10-improve-codebase-quality]: CI uses two parallel jobs (frontend + rust) with quality checks only — no full Tauri binary build keeps CI fast
- [Phase 11-add-deployment-auto-updates-and-release-management]: Two-job release structure: create-release generates changelog once, build-tauri matrix uploads artifacts — avoids changelog race condition
- [Phase 11-add-deployment-auto-updates-and-release-management]: scripts/bump-version.mjs synchronizes package.json + tauri.conf.json + Cargo.toml atomically before tagging
- [Phase 11]: Plugin registration gated with #[cfg(desktop)] in Tauri setup closure — desktop-only feature, safe for future mobile targets
- [Phase 11]: Placeholder pubkey in tauri.conf.json — user generates real keypair with tauri signer generate before first release
- [Phase 11]: Committed generated ACL schemas from cargo check — these are deterministic and must stay in sync with plugin registration
- [Phase 11-add-deployment-auto-updates-and-release-management]: UpdateModal rendered in every App.tsx routing branch since Dialog uses a portal — no layout disruption and avoids complex state threading
- [Phase 11-add-deployment-auto-updates-and-release-management]: Slovak translations include full diacritics for correctness, matching existing sk.json style
- [Phase quick-260325-wet]: vi.runAllTimersAsync() required after vi.advanceTimersByTime() to flush async promise callbacks in fake timer context
- [Phase 16-01]: search_jira_users_by_domain uses get_cloud_credentials for Cloud v3 Basic auth — consistent with existing cloud command pattern
- [Phase 16-01]: Privacy-simulation user in mock omits emailAddress entirely (JSON key absent, not null) — accurately simulates Jira Cloud email visibility restriction
- [Phase 16-02]: Updated local JiraUser interface to support optional name/accountId for Cloud v3 domain search users
- [Phase 16-02]: Privacy warning gated to cloudConn non-null — server-only connections never show amber banner
- [Phase 17-04]: probe_createmeta returns ProbeResult ok=false (not Err) for missing project key / credentials — Pitfall C: first-run users never see failure banner pre-setup
- [Phase 17-04]: #[allow(unused_assignments)] on loop accumulator variables — canonical Rust fix for false-positive liveness lint on loop-accumulated scalars
- [Phase 17-04]: refresh_field_schema_cache is synchronous (fn not async fn) — no await points; clippy unused_async enforced by -D warnings
- [Phase 17-04]: SHA-256 hash computed over concatenated raw response bytes per page (D-04) — preserves byte-level drift signal for Phase 21
- [Phase 17-05]: ConnectionCard gets explicit connectionType prop rather than URL-heuristic cloud detection — reliable and explicit; SettingsPage passes 'server'/'cloud'
- [Phase 17-05]: ProbeStatusBanner rendered in main shell only (not settings/audit/detail branches) — banner internally gated, zero cost when probe OK
- [Phase 17-05]: runProbe useEffect deps [hasSetup, targetProjectKey, runProbe] — Zustand create produces stable refs, no infinite re-render (T-17-20 mitigated)

### Roadmap Evolution

- Phase 8 added: Fully redesign the app UI — modern, sleek, easy to use
- Phase 9 added: Increase accessibility — ARIA compatible inputs, sufficient contrast in light and dark modes, and general a11y improvements
- Phase 10 added: Improve codebase quality — add linting, increase test coverage, apply best practices, fix tech debt, update dependencies, and improve overall app quality
- Phase 11 added: Add deployment, auto-updates, and release management
- v0.4.0 milestone added (2026-04-27): Configurable Field Mapping (Phases 17-23) — replaces hardcoded copy logic with discovery + persistence + renderer registry + transform pipeline + cutover

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 22: UX detail of how required-field gating surfaces gaps (banner? inline? per-field?) — short Plan-time discuss recommended
- Phase 17: Cloud target paginated createmeta endpoint availability through proxies/firewalls — speculation; verify with connection-time probe
- (Carried) Phase 1: ADF schema for fixture construction needs verification against current Atlassian OpenAPI spec before mock server build
- (Carried) Phase 4: Wiki Markup to ADF conversion has no official library — renderedFields HTML approach needs prototype to validate fidelity
- (Carried) Phase 5: Self-hosted Jira Server attachment auth model (PAT vs cookie-based) cannot be confirmed without a real Server instance — seek early customer confirmation

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260323-plu | Redesign settings page | 2026-03-23 | 17cabc8 | Needs Review | [260323-plu-i-want-to-redesign-settings](./quick/260323-plu-i-want-to-redesign-settings/) |
| 260323-w2c | 3-tab homepage: New / Not Mine / Already Linked | 2026-03-23 | 8269805 | | [260323-w2c-homepage-shows-only-new-tickets-with-not](./quick/260323-w2c-homepage-shows-only-new-tickets-with-not/) |
| 260323-wcw | Debug logs triggered as icon next to settings | 2026-03-23 | 6d3dbe3 | | [260323-wcw-i-want-the-debug-logs-to-be-triggered-as](./quick/260323-wcw-i-want-the-debug-logs-to-be-triggered-as/) |
| 260324-p39 | Fix Slovak translation diacritics and errors | 2026-03-24 | 7145f57 | | [260324-p39-check-slovak-translation-for-spelling-er](./quick/260324-p39-check-slovak-translation-for-spelling-er/) |
| 260324-pjx | The app is missing icon, add it | 2026-03-24 | 295c1ba | | [260324-pjx-the-app-is-missing-icon-add-it](./quick/260324-pjx-the-app-is-missing-icon-add-it/) |
| 260324-pq3 | Redesign app icon to match app aesthetic | 2026-03-24 | a74bae8 | | [260324-pq3-redesign-app-icon-to-match-app-aesthetic](./quick/260324-pq3-redesign-app-icon-to-match-app-aesthetic/) |
| 260324-q5o | Redesign icon with proper macOS padding | 2026-03-24 | b41a5ef | | [260324-q5o-redesign-icon-with-proper-macos-padding-](./quick/260324-q5o-redesign-icon-with-proper-macos-padding-/) |
| 260325-dd7 | Open issues in external Jira from the app | 2026-03-25 | 2291b68 | | [260325-dd7-open-issues-in-external-jira-from-the-ap](./quick/260325-dd7-open-issues-in-external-jira-from-the-ap/) |
| 260325-dom | Copied tickets open in both Jiras with more visible buttons | 2026-03-25 | 9ea47bc | | [260325-dom-copied-tickets-open-in-both-jiras-with-m](./quick/260325-dom-copied-tickets-open-in-both-jiras-with-m/) |
| 260325-jxu | Add ticket list filters for key and assignee with sort toggle | 2026-03-25 | 959c2ab | | [260325-jxu-add-ticket-list-filters-for-ticket-numbe](./quick/260325-jxu-add-ticket-list-filters-for-ticket-numbe/) |
| 260325-jos | Select source and target Jira projects | 2026-03-25 | 55e532c | | [260325-jos-i-want-the-user-to-be-able-to-select-sou](./quick/260325-jos-i-want-the-user-to-be-able-to-select-sou/) |
| 260325-k6l | Sleek filter bar with assignee autocomplete from real users | 2026-03-25 | 36ebef3 | | [260325-k6l-make-ticket-filter-bar-sleek-with-assign](./quick/260325-k6l-make-ticket-filter-bar-sleek-with-assign/) |
| 260325-kf1 | App header always visible across all routes | 2026-03-25 | 650dd39 | | [260325-kf1-make-the-app-header-across-the-app-alway](./quick/260325-kf1-make-the-app-header-across-the-app-alway/) |
| 260325-kl9 | See failed logs in audit logs with better status badge | 2026-03-25 | d633605 | | [260325-kl9-i-want-to-see-failed-logs-in-the-audit-l](./quick/260325-kl9-i-want-to-see-failed-logs-in-the-audit-l/) |
| 260325-kuc | Sleek filter bar with assignee autocomplete from real Jira users | 2026-03-25 | 49fd559 | | [260325-kuc-make-the-filter-more-sleek-the-assignee-](./quick/260325-kuc-make-the-filter-more-sleek-the-assignee-/) |
| 260325-kxt | Show created and updated dates on ticket cards | 2026-03-25 | 471d27a | | [260325-kxt-add-last-updated-column-to-tasks-list-an](./quick/260325-kxt-add-last-updated-column-to-tasks-list-an/) |
| 260325-ksf | Redesign project selector with searchable dropdown and All Projects | 2026-03-25 | 4103018 | | [260325-ksf-make-the-project-selector-nicer-also-add](./quick/260325-ksf-make-the-project-selector-nicer-also-add/) |
| 260325-p8e | User avatars shown everywhere users appear in the app | 2026-03-25 | 82cb0f0 | | [260325-p8e-when-users-are-shown-in-the-app-always-p](./quick/260325-p8e-when-users-are-shown-in-the-app-always-p/) |
| 260325-pcb | Fix watched users input losing focus on keystroke | 2026-03-25 | 4c3888c | | [260325-pcb-in-settings-when-editing-watched-users-a](./quick/260325-pcb-in-settings-when-editing-watched-users-a/) |
| 260325-pp3 | Remove duplicate buttons from issue copy page | 2026-03-25 | b85d0f8 | | [260325-pp3-on-the-issue-copy-page-the-buttons-are-b](./quick/260325-pp3-on-the-issue-copy-page-the-buttons-are-b/) |
| 260325-pp3 | Remove duplicated footer buttons from copy preview page | 2026-03-25 | 0ce321a | | [260325-pp3-on-the-issue-copy-page-the-buttons-are-b](./quick/260325-pp3-on-the-issue-copy-page-the-buttons-are-b/) |
| 260325-pv3 | Make the copy/notmine/open in jira strip look a little nicer | 2026-03-25 | d269c6c | | [260325-pv3-make-the-copy-notmine-open-in-jira-strip](./quick/260325-pv3-make-the-copy-notmine-open-in-jira-strip/) |
| 260325-ppv | Consistently display status and priority with colored badges and priority icons like Jira | 2026-03-25 | 1ca9083 | | [260325-ppv-consistently-display-status-and-priority](./quick/260325-ppv-consistently-display-status-and-priority/) |
| 260325-qcl | Remove duplicate status/priority/assignee/reporter from issue detail headers | 2026-03-25 | d08d256 | | [260325-qcl-remove-status-priority-and-other-metadat](./quick/260325-qcl-remove-status-priority-and-other-metadat/) |
| 260325-qac | Hide done/resolved/closed tickets from all ticket list views | 2026-03-25 | be3e687 | | [260325-qac-in-the-ticket-lists-only-show-those-that](./quick/260325-qac-in-the-ticket-lists-only-show-those-that/) |
| 260325-qq8 | Add created date to issue detail header | 2026-03-25 | 8565605 | | [260325-qq8-add-date-created-to-the-issue-detail](./quick/260325-qq8-add-date-created-to-the-issue-detail/) |
| 260325-qp8 | Audit log retention management with pagination | 2026-03-25 | 5fc4d11 | | [260325-qp8-implement-audit-log-retention-management](./quick/260325-qp8-implement-audit-log-retention-management/) |
| 260325-qw2 | Rename Not Mine to Dismissed, add info card, show project names in labels | 2026-03-25 | 0707ea4 | Verified | [260325-qw2-make-not-mine-ignored-clearer-to-users-a](./quick/260325-qw2-make-not-mine-ignored-clearer-to-users-a/) |
| 260325-s97 | Redesign Jira links section with grouped layout and direction icons | 2026-03-25 | 252a065 | | [260325-s97-redesign-jira-links-section-on-ticket-de](./quick/260325-s97-redesign-jira-links-section-on-ticket-de/) |
| 260325-sa2 | Custom About modal from native macOS menu | 2026-03-25 | 40dfb7d | | [260325-sa2-add-a-custom-about-the-app-modal-that-wi](./quick/260325-sa2-add-a-custom-about-the-app-modal-that-wi/) |
| 260325-sjh | Redesign Jira linked ticket state UI with compact badge and inline links | 2026-03-25 | 73aa8db | | [260325-sjh-redesign-jira-linked-ticket-state-ui](./quick/260325-sjh-redesign-jira-linked-ticket-state-ui/) |
| 260325-sk0 | Version history and changelog viewer in About modal | 2026-03-25 | 1c5994f | | [260325-sk0-i-want-the-user-to-be-able-to-see-versio](./quick/260325-sk0-i-want-the-user-to-be-able-to-see-versio/) |
| 260325-sxj | Hide Copy to Company Jira button on dismissed tickets | 2026-03-25 | b68ed1c | | [260325-sxj-hide-copy-to-company-jira-button-on-dism](./quick/260325-sxj-hide-copy-to-company-jira-button-on-dism/) |
| 260325-wet | Add tests to improve pipeline coverage | 2026-03-25 | 504cfe1 | | [260325-wet-add-tests-to-improve-pipeline-coverage](./quick/260325-wet-add-tests-to-improve-pipeline-coverage/) |
| 260329-nha | Replace GitHub Actions with local processes (pre-commit hook + release.sh) | 2026-03-29 | a4d6b34 | Gaps (fixed) | [260329-nha-replace-github-actions-with-local-proces](./quick/260329-nha-replace-github-actions-with-local-proces/) |
| 260401-hhp | Add MSI Windows build artifacts and platform-selective dispatch | 2026-04-01 | b64c8e5 | | [260401-hhp-add-msi-windows-build-back-to-release-wo](./quick/260401-hhp-add-msi-windows-build-back-to-release-wo/) |
| 260401-j1u | Fix target Jira project selection failure | 2026-04-01 | | Verified | [260401-j1u-fix-target-jira-project-selection-failur](./quick/260401-j1u-fix-target-jira-project-selection-failur/) |
| 260427-dss | Add 'Mark as Handled' triage action alongside Copy and Dismiss | 2026-04-27 | b86ebe6 | | [260427-dss-i-want-to-add-another-option-to-the-tick](./quick/260427-dss-i-want-to-add-another-option-to-the-tick/) |

## Session Continuity

Last activity: 2026-04-27
Last session: 2026-04-27T14:10:00Z
Stopped at: Phase 19 context gathered
Resume file: .planning/phases/19-mapping-persistence-crud-commands/19-CONTEXT.md
