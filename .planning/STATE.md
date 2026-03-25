---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: v1.0 milestone complete
stopped_at: Completed quick task 260325-dom
last_updated: "2026-03-25T09:29:49.672Z"
last_activity: 2026-03-25
progress:
  total_phases: 11
  completed_phases: 11
  total_plans: 45
  completed_plans: 45
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** Surface relevant tickets from customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.
**Current focus:** v1.0 shipped — planning next milestone

## Current Position

Phase: 11
Plan: Not started

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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

### Roadmap Evolution

- Phase 8 added: Fully redesign the app UI — modern, sleek, easy to use
- Phase 9 added: Increase accessibility — ARIA compatible inputs, sufficient contrast in light and dark modes, and general a11y improvements
- Phase 10 added: Improve codebase quality — add linting, increase test coverage, apply best practices, fix tech debt, update dependencies, and improve overall app quality
- Phase 11 added: Add deployment, auto-updates, and release management

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: ADF schema for fixture construction needs verification against current Atlassian OpenAPI spec before mock server build
- Phase 4: Wiki Markup to ADF conversion has no official library — renderedFields HTML approach needs prototype to validate fidelity
- Phase 5: Self-hosted Jira Server attachment auth model (PAT vs cookie-based) cannot be confirmed without a real Server instance — seek early customer confirmation

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
| 260325-jos | Select source and target Jira projects | 2026-03-25 | 55e532c | | [260325-jos-i-want-the-user-to-be-able-to-select-sou](./quick/260325-jos-i-want-the-user-to-be-able-to-select-sou/) |

## Session Continuity

Last activity: 2026-03-25
Last session: 2026-03-25T08:51:09.513Z
Stopped at: Completed quick task 260325-dom
Resume file: None
