
## [0.4.0]

### Bug Fixes

- partial UNIQUE INDEX to allow multiple dismissed rows
- expand prefill to user and wiki_to_adf transformer kinds
- prefill override dropdowns from field mapping rows
- persist accepted/dismissed suggestions to DB via invoke
- seed typed schema JSON + NULL migration for field mapping defaults
- remove max-w-[760px] cap from SettingsPage content column
- remove max-w-3xl centering from TicketDetailPage
- deduplicate target_field_id rows before creating unique index
- unify Map field button to ghost Button in UnsupportedFieldHint
- gap rows match DynamicTargetForm field layout exactly
- label above amber content, matching normal field layout
- standard label styling on gap rows, amber on content only
- remove group header from gap fields section
- constrain target project combobox to min-h-9 to match issue type chooser
- per-field amber cards, remove group container
- unify missing-field display variants for consistent UI
- add Slovak translations for transformer options
- translate transformer options and flip dropdown upward near screen bottom
- align UnsupportedFieldHint amber tokens to app-wide pattern
- unified UnsupportedFieldHint component — same amber box and Map link everywhere
- fix field mapping dropdown overflow and sizing
- unify unsupported field hint visual in both GapsSection and DynamicTargetForm
- extend unsupported field hint to DynamicTargetForm
- improve unsupported field type warnings in copy gaps section
- widen settings view from 560px to 760px
- add field mapping button now works in settings
- WR-04 propagate migrate_triage_check_constraint errors via AppResult
- WR-03 remove dead _audit bindings and db params from 4 field-discovery commands
- WR-02 capture error details in all Err(_) network arms in copy_pipeline
- CR-02 push failure CopyStepResult on all worklog error paths
- WR-01 add early guard for null targetIssueTypeId in confirmCopy
- CR-01 merge targetSummary into overrideValues in confirmCopy
- resolve typography BLOCK — collapse to 4 sizes, 2 weights
- collapse typography weights from 3 to 2 in UI-SPEC
- WR-02 restrict resolver struct fields to pub(crate) visibility
- WR-01 document no-domain per-call behavior in user.rs docstring
- CR-01 fix isolated mention node silently dropped in splice_mentions
- paginate /rest/api/2/search to fetch all matching tickets
- use issueKey (not ticketKey) when invoking fetch_ticket_detail in manual fetch
- hoist PAGE_SIZE const above statements in search_jira_users_by_domain

### Documentation

- pre-dispatch plan for app container layout consistency
- pre-dispatch plan for fix duplicate target field mapping
- add code review fix report
- complete phase execution — verification passed, PROJECT.md evolved .planning/phases/23-copy-ticket-v2-wiring/23-VERIFICATION.md .planning/ROADMAP.md .planning/STATE.md .planning/PROJECT.md
- verification passed — all tests confirmed .planning/phases/23-copy-ticket-v2-wiring/23-VERIFICATION.md
- add code review report .planning/phases/23-copy-ticket-v2-wiring/23-REVIEW.md
- complete Phase 23 Plan 04 — integration test + phase complete
- complete copy_ticket_v2 cutover plan — SUMMARY, STATE, ROADMAP, REQUIREMENTS
- complete audit infrastructure plan — SUMMARY, STATE, ROADMAP, REQUIREMENTS
- complete copy_pipeline extraction plan — SUMMARY, STATE, ROADMAP
- create phase plan — 4 plans, 3 waves
- UI design contract — backend-only phase, IPC call-site swap only
- capture phase context — copy_ticket_v2 cutover decisions
- complete integration plan summary — CopyPreviewPage Phase 22 wiring
- complete computeGapFields + GapsSection plan summary
- complete IssueTypeChooser plan — VirtualizedCombobox chooser with D-06 defaulted notice and 8 unit tests
- complete copyStore override state plan summary
- create phase plan .planning/phases/22-copy-preview-override-panel/22-01-PLAN.md .planning/phases/22-copy-preview-override-panel/22-02-PLAN.md .planning/phases/22-copy-preview-override-panel/22-03-PLAN.md .planning/phases/22-copy-preview-override-panel/22-04-PLAN.md .planning/STATE.md .planning/ROADMAP.md
- create phase plan — copy preview override panel + issue-type chooser + required-field gating
- record phase 22 UI-SPEC session
- fix spacing scale — remove non-multiples-of-4 from exceptions
- fix UI-SPEC checker issues — spacing declarations and copywriting
- UI design contract for copy preview override panel
- record phase 22 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- add code review report
- complete wave 2 integration plan summary
- complete leaf components plan summary (recovered after stream timeout)
- update summary with self-check results (PASSED)
- complete wave 0 scaffolding plan summary
- record phase 21 planning complete — 3 plans ready
- create phase plan for Mapping Editor Settings UI .planning/phases/21-mapping-editor-settings-ui/21-01-PLAN.md .planning/phases/21-mapping-editor-settings-ui/21-02-PLAN.md .planning/phases/21-mapping-editor-settings-ui/21-03-PLAN.md .planning/ROADMAP.md
- map existing patterns for mapping editor
- add validation strategy for mapping editor phase
- research mapping editor phase domain
- record phase 21 UI-SPEC approval
- fix Dimension 5 spacing — remove non-multiple-of-4 tokens
- add UI design contract for Mapping Editor settings section
- record phase 21 context session .planning/STATE.md
- capture phase context .planning/phases/21-mapping-editor-settings-ui/21-CONTEXT.md .planning/phases/21-mapping-editor-settings-ui/21-DISCUSSION-LOG.md
- complete phase execution
- add code review report
- complete registry + DynamicTargetForm plan
- complete picker renderers plan — 8 renderers, 18 tests, CTRL-02/03/04 covered
- complete simple renderers plan — 9 renderers, 28 tests passing
- complete VirtualizedCombobox plan — 2 tasks, 10 tests passing
- add self-check result to SUMMARY.md
- complete Wave 0 scaffold plan — types.ts + 13 test stubs
- create phase plan
- create phase plan — renderer registry + field-type-aware controls
- research phase domain
- UI design contract .planning/phases/20-renderer-registry-field-type-aware-controls/20-UI-SPEC.md
- UI design contract for renderer registry phase
- record phase 20 context session .planning/STATE.md
- capture phase context .planning/phases/20-renderer-registry-field-type-aware-controls/20-CONTEXT.md .planning/phases/20-renderer-registry-field-type-aware-controls/20-DISCUSSION-LOG.md
- evolve PROJECT.md after phase completion .planning/PROJECT.md .planning/ROADMAP.md .planning/STATE.md
- complete phase execution .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md .planning/phases/19-mapping-persistence-crud-commands/19-VERIFICATION.md
- add code review report .planning/phases/19-mapping-persistence-crud-commands/19-REVIEW.md
- complete CRUD commands plan — FieldMappingDb methods + Tauri commands registered
- update tracking after wave 1 .planning/ROADMAP.md .planning/STATE.md
- complete field_mapping + mapping_meta DDL and seed plan
- create phase 19 plan — mapping persistence + CRUD commands
- research phase domain — mapping persistence + CRUD commands
- record phase 19 context session .planning/STATE.md
- capture phase context .planning/phases/19-mapping-persistence-crud-commands/19-CONTEXT.md .planning/phases/19-mapping-persistence-crud-commands/19-DISCUSSION-LOG.md
- evolve PROJECT.md after phase completion .planning/PROJECT.md
- complete phase execution — all 5 plans verified, 157 tests passing .planning/ROADMAP.md .planning/STATE.md .planning/phases/18-v2-v3-translation-layer/18-VERIFICATION.md
- add code review fix report .planning/phases/18-v2-v3-translation-layer/18-REVIEW-FIX.md
- add code review report .planning/phases/18-v2-v3-translation-layer/18-REVIEW.md
- update tracking after wave 3 — plan 18-05 complete .planning/ROADMAP.md .planning/STATE.md
- complete plan 05 summary — apply_mapping pipeline
- update tracking after wave 2 — plans 18-02, 18-03, 18-04 complete .planning/ROADMAP.md .planning/STATE.md
- complete wiki_to_adf + identity transformers plan — 23 tests pass, clippy clean
- complete UserResolver batch resolution plan — 20 tests pass, clippy clean
- complete VersionResolver + ComponentResolver plan — 12/12 tests pass
- update tracking after wave 1 — plan 18-01 complete .planning/ROADMAP.md .planning/STATE.md
- complete field_transform scaffolding plan — 10 tests pass, clippy clean
- record phase 18 planning complete — 5 plans, 3 waves
- plan v2→v3 translation layer — 5 plans across 3 waves
- research phase — v2→v3 translation layer
- record phase 18 context session
- capture phase context — v2→v3 translation layer
- mark Phase 17 complete — all 5 plans shipped
- add phase verification report — 8/8 must-haves pass, 3 UAT items pending
- complete field discovery Rust module and commands plan
- complete probe-banner-status-pill-wiring plan
- add Wave 1 plan summaries for 17-01 and 17-02
- complete TypeScript FieldSchema types and schemaCacheStore plan
- apply plan-checker revisions and finalize phase plan .planning/ROADMAP.md .planning/STATE.md .planning/phases/17-field-discovery-mock-schema-fidelity/17-01-mock-fixtures-and-routes-PLAN.md .planning/phases/17-field-discovery-mock-schema-fidelity/17-04-field-discovery-rust-module-and-commands-PLAN.md .planning/phases/17-field-discovery-mock-schema-fidelity/17-05-probe-banner-status-pill-wiring-PLAN.md .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md
- create phase plan — 5 plans across 2 waves
- add validation strategy and research .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md .planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md
- research phase field discovery, mock schema fidelity, mapping.db design
- record phase 17 context session .planning/STATE.md
- capture phase context .planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md .planning/phases/17-field-discovery-mock-schema-fidelity/17-DISCUSSION-LOG.md
- create milestone v0.4.0 roadmap (7 phases, 17-23) .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
- define milestone v0.4.0 requirements (41 reqs, 8 categories) .planning/REQUIREMENTS.md
- v0.4.0 field mapping research (stack, features, architecture, pitfalls, summary) .planning/research/
- archive v0.1.0-era research before v0.4.0 refresh .planning/milestones/v0.3.0-research/ .planning/research/
- start milestone v0.4.0 Configurable Field Mapping .planning/PROJECT.md .planning/STATE.md
- pre-dispatch plan for ignore-option quick task

### Features

- register PriorityRenderer in field-renderer registry
- create PriorityRenderer for priority schema type
- add duplicate target_field_id guard to apply_mapping pipeline
- filter used target fields from MappingRow combobox
- add UNIQUE(target_field_id) index to field_mapping DB
- replace native selects with VirtualizedCombobox in copy preview
- improve field mapping settings UX
- swap frontend confirmCopy to invoke copy_ticket_v2 (CUTV-01 D-03)
- add copy_ticket_v2 command + remove old copy_ticket (CUTV-01/03/04)
- add mapping_audit_log table + insert API + sanitizer + hasher to FieldMappingDb
- add audit_verbose flag to TriageDb + get_target_project_key getter
- create copy_pipeline.rs with CopyContext and 5 extracted helpers
- wire Phase 22 components into CopyPreviewPage + Modal; extend DynamicTargetForm with initialQueries
- add 8 copy.preview.* i18n keys (en+sk), extend SettingsPage with initialSection prop, thread onOpenSettingsSection through App.tsx
- expand mock fixtures — 4 new tickets + issuetype on all issues
- implement GapsSection component with amber section, renderer dispatch, and Map link
- implement computeGapFields pure function and unit tests
- create IssueTypeChooser component with VirtualizedCombobox + defaulted notice + loading spinner
- extend copyStore with override + issue-type state (D-11)
- wire FieldMappingSection into SettingsPage + add 29 i18n keys
- implement FieldMappingSection orchestrator + tests
- implement SuggestionsPanel with Accept/Dismiss auto-save and tests
- implement DriftWarning + MappingRow with auto-save, delete, and tests
- add FieldMappingRow type, transformerOptions, heuristics modules with tests
- install sonner, scaffold Toaster, mount in App.tsx, extend SectionCard with headerAction
- create registry.ts + DynamicTargetForm.tsx + fieldRenderer.* i18n keys
- implement 5 static picker renderers (SingleSelect/MultiSelect/Labels/Component/Version)
- implement UserPickerRenderer + MultiUserPickerRenderer + GroupPickerRenderer
- create CheckboxRenderer, RadioRenderer, UnsupportedTypeRenderer + 3 test files (CTRL-06, CTRL-07)
- create 6 native-input renderers + 3 test files (CTRL-01, CTRL-05)
- implement VirtualizedCombobox<T> with cmdk + useVirtualizer
- install cmdk@1.1.1 + @tanstack/react-virtual@3.13.24; add types.ts contract
- add get_field_mapping, set_field_mapping, delete_field_mapping Tauri commands
- add upsert_mapping_row, get_all_mapping_rows, delete_mapping_row to FieldMappingDb
- add field_mapping + mapping_meta DDL and seed_defaults_if_empty
- implement apply_mapping two-phase pipeline with 12 tests
- implement identity transform_identity with per-type write-shape correction
- implement wiki_to_adf convert_and_postprocess + ADF post-processor
- implement UserResolver::resolve_batch with one-HTTP-per-domain batching
- implement helper layer — scan_mention_patterns, scan_html_profile_links, is_user_field, extract_usernames_from_field, collect_description_mentions
- implement ComponentResolver — twin of VersionResolver for /components endpoint
- implement VersionResolver with cached fetch + case-insensitive name lookup
- add 6 transformer stub files and register field_transform in lib.rs
- add field_transform/mod.rs with shared types and re-exports
- wire 5 Tauri commands and register in main.rs invoke_handler
- implement HTTP discovery functions and probe in field_discovery.rs
- wire runProbe into App.tsx launch flow and render ProbeStatusBanner in main shell
- create ProbeStatusBanner component and add probe status pill to ConnectionCard
- extend connectionStore with probe state and actions (GREEN phase)
- add field routes to mock server — v2/v3 /field, paginated createmeta, versions, components
- create FieldMappingDb with field_schema_cache table and open mapping.db in main
- create schemaCacheStore Zustand store with cache map and field schema actions
- create TypeScript FieldSchemaType discriminated union and narrowing helpers
- define FieldSchemaType enum and FieldSchema types in field_discovery.rs
- extend FixtureState with field discovery fixtures (D-09/D-10/D-11/D-12)
- add 'Mark as Handled' button to detail views and update tab filters
- extend triage state to 'handled' across DB, command, and types

### Miscellaneous

- remove REQUIREMENTS.md for v0.4.0 milestone
- archive v0.4.0 milestone files
- merge quick task worktree (worktree-agent-a7ac089a0cc60509c)
- merge quick task worktree (worktree-agent-a103f78b52d0df18e)
- merge quick task worktree (worktree-agent-a3d26a17b78b7ae5f)
- merge quick task worktree (worktree-agent-af1678d7be3ccc76b)
- update package-lock.json devOptional → dev for @types/react, @types/react-dom, csstype
- mark phase 22 complete in STATE.md
- merge executor worktree (worktree-agent-a60d68556477967f3)
- merge executor worktree (worktree-agent-a9ea52f8d35dbe513)
- merge executor worktree (worktree-agent-a003a1ff85ee9cb9b)
- merge executor worktree (worktree-agent-a6c5c1609b55aa3e6)
- merge executor worktree (worktree-agent-a8ae66abb1a5450ac)
- merge executor worktree (worktree-agent-a8bc4722e39e19e4d)
- merge executor worktree (worktree-agent-a17c091f64893097d)
- update lockfiles (package-lock devOptional and Cargo tempfile dep)
- merge executor worktree (worktree-agent-ae74807a730b86ad9)
- merge executor worktree (worktree-agent-a9b9009dc7da90a75)
- merge executor worktree (worktree-agent-a0249d6beeb192b30)
- merge executor worktree (worktree-agent-a6ec4e3aff2a16591)
- merge executor worktree (worktree-agent-a95dc6a5208497110)
- merge executor worktree (worktree-agent-a84a223c51c959f5a)
- merge executor worktree (worktree-agent-aadf73de97347d762) — plan 18-05
- merge executor worktree (worktree-agent-ac9075c93b47e9309) — plan 18-04
- merge executor worktree (worktree-agent-a2f517f4f26622a41) — plan 18-03
- merge executor worktree (worktree-agent-a302c513a8aafaefa) — plan 18-02
- merge executor worktree (worktree-agent-a3bb2c95cd74fb95a) — plan 18-01
- merge executor worktree (worktree-agent-a3d7e3817cc9b34ac)
- merge executor worktree (worktree-agent-a0fb749064776c354)
- set nyquist_compliant: true in 17-VALIDATION.md
- merge executor worktree (worktree-agent-ae835c8f19f892a36)
- merge executor worktree (worktree-agent-a4b01345c507e88c7)
- merge executor worktree (worktree-agent-a08b6dfd0f3149505)
- merge quick task worktree (worktree-agent-a3487b144ea7c43a7)
- expand workflow config with new toggles and intel/graph sections
- sync lockfiles to v0.3.2
- archive resolved debug sessions

### Refactoring

- refactor copy_ticket to call extracted free helpers (D-08 proof)

### Testing

- resolve F-02 (partial) — add Phase 22 store fields to buildStoreState
- resolve F-03 — update CTRL-07 priority assertion to PriorityRenderer
- resolve F-01 — add targetIssueTypeId to confirmCopy success test
- complete UAT - 0 passed, 0 issues (2 skipped/approved)
- complete UAT - 0 passed, 0 issues (1 skipped/approved)
- add copy_ticket_v2 full-pipeline integration test (CUTV-02 + CUTV-04)
- add IssueTypeChooser unit tests covering selection, defaulted notice, loading state, empty state
- add Phase 22 override state tests for copyStore
- add it.todo stub test files for MappingRow, SuggestionsPanel, FieldMappingSection
- persist human verification items as UAT
- replace registry + DynamicTargetForm it.todo stubs with real assertions
- replace VirtualizedCombobox it.todo stubs with real assertions
- add 13 it.todo stub files tagged by CTRL-01..08 requirement IDs
- add failing tests for upsert/get/delete mapping row methods
- add failing tests for field_mapping + mapping_meta DDL and seed
- persist human verification items as UAT .planning/phases/18-v2-v3-translation-layer/18-HUMAN-UAT.md
- add failing integration tests for discovery + probe (RED)
- add failing ProbeStatusBanner tests (RED phase)
- add failing probe store tests (RED phase)
- add failing vitest tests for fieldSchema types and schemaCacheStore
- add failing integration tests for mock field routes and pagination
## [0.3.2]

### Bug Fixes

- store watched users as structured objects with name, email, and JQL identifier
- load target project at startup and add project selector to copy preview
- paginate domain user search to return all results
- treat pub_date parse errors as up-to-date instead of showing error
- ensure pub_date is never empty in CI latest.json builder

### Documentation

- update debug knowledge base with watched-users-domain-pagination
- resolve debug watched-users-domain-pagination

### Miscellaneous

- formatting and Cargo.lock sync for v0.3.1 release prep
## [0.3.1]

### Bug Fixes

- resolve target Jira project selection and credential persistence failures
- use email as cloud credential key instead of display name
- collect exe.sig instead of nsis.zip for Tauri v2 updater format
- use temp files for JSON data in workflow instead of shell interpolation
- delete existing release assets before re-uploading
- rewrite workflow Python to use argv instead of stdin, fix YAML indentation
- dedent inline Python in workflow to avoid IndentationError
- use correct secret name RELEASES_REPO_PAT in workflow
- fetch tags in CI checkout and handle partial build success

### Features

- add Windows MSI + NSIS download links to release.sh README template
- add MSI artifact collection and platform-selective dispatch
- add GitHub Actions workflow for Linux + Windows release builds

### Miscellaneous

- update Cargo.lock
## [0.3.0]

### Bug Fixes

- correct artifact paths in release.sh (workspace root target/, not src-tauri/target/)
- auto-detect signing key from taskflow.key fallback + fix clippy doc warnings
- add matching labels to both search inputs with more spacing
- remove domain search label — match individual search style
- match domain search input styles to individual search input
- move both search inputs above the watched user list
- fix domain search UX issues — use displayName, reorder layout, add cancel
- restore tooltip on Changed badge in TicketCard
- wire change tracking to TicketDetailPage and improve UX
- re-render "last checked" every 30s so relative time updates

### CI/CD

- auto-update README download links after each release

### Documentation

- fix tech debt — update NOTIF requirement statuses, checkboxes, and verification body text
- evolve PROJECT.md after phase completion
- complete phase execution
- update SUMMARY.md with user feedback fixes and final state
- complete domain search UI plan — checkpoint at human-verify
- complete backend infrastructure for domain-based user search plan
- add 16-01-SUMMARY.md for domain user search backend plan
- create phase plan
- add research and validation strategy
- research phase — Jira user search API and email privacy
- fix remaining spacing violations in UI-SPEC
- fix spacing violations and apply checker recommendations
- UI design contract
- record phase 16 context session
- capture phase context
- complete phase execution
- complete change diff view frontend plan
- complete change-diff-view backend plan
- create phase plan
- add validation strategy
- research phase domain
- UI design contract
- record phase 15 context session
- capture phase context
- complete phase execution and verification
- complete plan summary
- complete plan summary and fix formatting
- create phase plan
- add validation strategy
- research phase domain
- UI design contract
- record phase 14 context session
- capture phase context
- finalize plan — human-verify checkpoint approved
- complete frontend polling integration plan — checkpoint:human-verify pending
- complete background polling engine plan — poll_engine.rs, frequency persistence, Tauri commands
- create phase plan — 2 plans for background polling engine
- add validation strategy
- research phase domain
- fix typography weights and add focal point declaration
- UI design contract
- record phase 13 context session
- evolve PROJECT.md after phase completion
- complete phase execution
- complete SnapshotDb Tauri integration plan
- complete snapshot-foundation plan 01 — SnapshotDb implementation
- create phase plan — 2 plans in 2 waves
- add validation strategy
- research phase snapshot foundation
- record phase 12 context session
- capture phase context
- create milestone v0.3.0 roadmap (5 phases)
- define milestone v0.3.0 requirements
- complete project research
- start milestone v0.3.0 Notifications & Change Tracking

### Features

- add release.sh and inject-version.cjs, delete release.yml
- enhance pre-commit hook with all CI checks, delete ci.yml
- add domain search UI to Watched Users settings section
- add emailAddress to JiraUser type and domain search i18n keys
- add search_jira_users_by_domain Tauri command and v3 mock endpoint
- file-based credential store for debug builds
- wire TicketCard dot, TicketDetailPanel Changes tab, and TicketListPage hydration
- add unseenChanges store slice, ChangesTab, and i18n keys
- add Tauri commands and wire poll engine for unseen changes
- extend SnapshotDb with unseen-changes columns and methods
- remove quiet hours UI from notification settings
- notification preferences UI with toggles, quiet hours, and permission handling
- enrich poll engine with FieldChange data and wire notification dispatch
- notification dispatcher module, NotificationPrefs in TriageDb, plugin setup
- dual-purpose fetch, F5 shortcut, and poll-complete event listener
- ticketStore polling state, i18n keys, and Settings polling section
- wire poll loop in main.rs and add Tauri commands for poll frequency
- add poll_engine module with PollFrequency, PollCompletePayload, run_poll_loop
- wire SnapshotDb into Tauri runtime
- implement SnapshotDb with SHA-256 hash-based change detection

### Miscellaneous

- complete v0.3.0 milestone — Notifications & Change Tracking

### Refactoring

- remove quiet hours from backend and frontend entirely

### Testing

- persist human verification items as UAT
- add failing tests for domain search feature
- update keychain tests for dual-backend

### Style

- fix formatting and complete phase verification
- cargo fmt snapshot_db and main
## [0.2.4]

### Miscellaneous

- pre-release cleanup for v0.2.4
## [0.2.3]

### Bug Fixes

- remove unused waitFor import and fix AboutSection TS type error
- skip keychain tests when no keyring daemon available
- inline format args in platform-specific code for clippy
- update tests to match current component behavior
- resolve clippy warnings and add clippy to pre-commit hook
- pass --tag to git-cliff so current version appears in changelog
- skip release build when tag already has a release
- resolve CI lint and format failures
- remove redundant try again link from update error state
- merge unreleased into latest version and make changelog collapsible

### Documentation

- rename milestone v1.0 to v0.1.0 to match actual binary version

### Miscellaneous

- add pre-commit hook for lint and format checks

### Testing

- expand tests for low-coverage files to meet thresholds
- add comprehensive tests for CopyPreviewPage and CopyResultPage
## [0.2.2]

### Bug Fixes

- treat unreachable update endpoint as up-to-date
## [0.2.1]

### Bug Fixes

- add version headings to changelog template
## [0.2.0]

### Bug Fixes

- limit hover tooltips to dismiss/ignored buttons only
- fix shadcn color tokens for Tailwind v4 and improve action buttons
- remove duplicated footer buttons from CopyPreviewPage
- extract SectionCard to module scope
- add camelCase serde rename to ConnectionTestResult
- implement missing backend commands for project selection
- use configured target project key for status fetch in fetch_cloud_meta
- use 'tiket/tikety' instead of 'lístky' in Slovak translation

### Features

- hide copy button on dismissed tickets in both detail views
- redesign linked ticket state with compact badge and short open buttons
- auto-regenerate changelog on version bump and internationalize version history modal
- redesign copied/linked state UI in TicketDetailPanel
- add VersionHistoryModal with changelog viewer and Version History button
- create AboutModal and wire show-about event in App.tsx
- redesign linked issues section with grouped layout
- add native menu with About pmkar item that emits show-about event
- add hover tooltips to action buttons on ticket detail pages
- store and display project names across the app
- rename Not Mine to Dismissed and add info card
- paginate AuditLogPage with load-more button
- add audit log retention pruning and paginated fetch
- add created date to issue detail header
- add relative "Updated X ago" timestamp to issue detail headers
- filter done tickets from all three ticket list views
- delete done ticket triage entries after fetch
- remove status/priority metadata from TicketDetailPanel header
- remove status/priority/assignee/reporter from TicketDetailPage header
- replace all inline status/priority with shared components
- create shared StatusBadge and PriorityIcon components
- redesign action button strip with shadcn Button variants and toolbar
- add UserAvatar to all user display locations
- add avatarUrls to JiraUser type, create UserAvatar component, update mock data
- redesign ProjectSelector with searchable dropdown and All Projects option
- show created and updated dates on ticket cards
- update consumer pages with assignee filter state
- redesign TicketFilterBar with assignee autocomplete
- replace plain status codes with color-coded Badge components in audit log
- wrap wizard route in AppShell so header shows on all routes
- pin AppShell to viewport with h-screen overflow-hidden
- frontend project selection — Settings dropdowns, Copy Preview target project, store wiring
- backend project selection — fetch_projects commands, DB persistence, copy_ticket param
- add TicketFilterBar and wire to all three ticket tabs

### Miscellaneous

- generate CHANGELOG.md and add changelog npm script

### Refactoring

- remove audit log count badge from app header

### Testing

- add TicketFilterBar unit and integration tests
## [1.0]

### Bug Fixes

- disable mock-server in production builds
- resolve TypeScript error in TicketDetailPage test
- set updater signing pubkey in tauri.conf.json
- replace copy modals with full-page views and prominent buttons
- point release workflow and updater to Mimo01/pmkar-releases
- lint and formatting fixes for update UI components
- resolve biome lint gaps — auto-format test files, fix forEach return, disable noNonNullAssertion
- fix optional chaining in ConnectionForm useEffect dependency
- fix all Biome lint violations, eliminate any types, remove dead code
- revise plans based on checker feedback
- correct Slovak translation diacritics and terminology
- update AuditLogPage tests to use role=button selectors
- remove unused ChevronDown import in AuditLogPage
- revise plans based on checker feedback
- audit log readability — capture response body, format JSON, fix URL overflow
- hide Not Mine button on copied tickets
- restyle language switcher as toggle buttons matching theme section
- default labels to empty array in mock create_issue
- add missing fields to mock create_issue responses
- add mock server attachment download route
- widen triage column for badge visibility, add ignored state to table rows
- UAT feedback — badge width, hide copy for copied, editable description, Not Mine action
- correct triageMap type from plain string to TriageEntry object
- address checkpoint feedback — button placement, editable summary, status prefill, missing currentAccountId
- revise plans based on checker feedback
- inline watched users count next to section heading
- make ticket table header opaque for sticky scroll
- fix triage map serialization, auto-refetch on restart
- pre-fill PAT/API token from keychain when editing connection
- fix fetch config persistence, pre-fill connection edit form
- inline connection editing, user search no-results feedback
- fix JQL quote parsing, add user search autocomplete
- null guards, settings UX redesign, hide gear on settings page
- fix keychain credential lookup and redesign settings page
- fix watchedUsers crash, persist connection meta across reloads
- fix connection errors, external links, and redesign UI
- remove unused variables in SetupWizard.test.tsx

### Documentation

- complete dual Jira buttons plan summary
- complete phase execution — update roadmap, state, and PROJECT.md
- complete final verification plan
- complete update UI plan
- complete updater plugin foundation plan
- complete release workflow and version tooling plan
- create phase plan — 4 plans in 3 waves for deployment, auto-updates, and release management
- add validation strategy
- research phase domain
- UI design contract
- fix typography weight constraint — remove font-medium, enforce 2-weight rule
- UI design contract for deployment and auto-updates phase
- record phase 11 context session
- capture phase context
- complete phase execution — all quality gates passed
- complete CI workflow plan — GitHub Actions pipeline
- complete test coverage plan — 80.11% lines, 351 tests, thresholds enforced
- complete dependency updates plan — Vite 8, TS 6, plugin-react 6, cargo patches
- complete frontend linting plan — Biome setup + type safety
- complete Rust quality tooling plan — clippy pedantic + unit tests
- create phase plan — 5 plans across 3 waves
- add validation strategy
- research phase domain
- record phase 10 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution and verification
- complete SettingsPage ARIA semantics plan summary
- complete keyboard access and D-02 compliance plan
- add self-check result to SUMMARY.md
- complete dark mode contrast and ARIA landmark plan
- complete form label associations and live regions plan
- create phase 9 accessibility plans
- UI design contract
- UI design contract
- add validation strategy
- research phase domain
- record phase 9 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete SettingsPage SVG gap closure plan summary
- create gap closure plan for remaining SVG icon replacements
- complete AuditLogPage and SetupWizard polish plan summary
- complete copy modals and settings sidebar redesign plan
- complete card layout conversion plan
- complete full-page ticket detail page plan
- complete shadcn foundation and AppShell redesign plan
- create phase 8 UI redesign plans
- add validation strategy
- research phase domain
- UI design contract
- fix UI-SPEC checker issues — typography, copywriting, color, visuals
- UI design contract
- record phase 8 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution — internationalization verified
- complete i18n test suite — visual verification approved
- complete i18n test suite plan — 23 tests, Task 2 checkpoint pending
- complete string extraction and translation pack plan
- complete i18n infrastructure plan
- create phase plan for internationalization
- fix spacing exception — document py-2.5 as inherited deviation
- UI design contract
- add validation strategy
- research phase domain
- record phase 7 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete ignored-tickets-page plan
- complete AuditLogPage plan
- complete triage-and-audit infrastructure plan
- create phase plan
- add validation strategy
- research phase domain
- fix spacing BLOCK issues in UI-SPEC
- UI design contract
- record phase 6 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete sub-task child issue creation gap closure plan
- create gap closure plan for COPY-05 sub-task child issue creation
- complete frontend modal plan — human-verify approved
- complete copy-attachments-and-comments plan 01
- complete frontend modal extension plan — checkpoint awaiting human-verify
- create phase plan
- fix spacing contract — move legacy py-2.5/mb-3 out of scale table
- UI design contract
- add validation strategy
- research phase domain
- record phase 5 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- update verification — gaps resolved, status human_needed
- complete copy result modal plan — awaiting human-verify checkpoint
- complete copy preview modal plan — CopyPreviewModal, Copy button, TriageIndicator badge
- complete copy-backend-commands plan
- complete Rust copy infrastructure plan — htmltoadf, mock endpoints, triage copied_key
- complete copy types and store plan — types, copyStore, Wave 0 test scaffolds
- create phase plan — 5 plans in 4 waves
- fix UI-SPEC checker issues — copywriting, typography, spacing
- UI design contract
- add validation strategy
- research phase domain
- record phase 4 context session
- capture phase context
- complete phase execution
- update roadmap — all 5 plans complete
- complete settings, tests, and visual verification plan
- complete ticket list page plan
- complete ticket detail panel plan
- complete Rust backend for ticket fetch and review plan
- complete ticket types and store plan
- create phase plan — ticket fetch and review
- fix UI-SPEC blocking issues — typography weights, spacing, focal point
- UI design contract
- add validation strategy
- research phase domain — ticket fetch and review
- record phase 3 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution and verification
- complete connection setup UI plan — checkpoint resolved
- add self-check results to SUMMARY.md
- complete settings page, connection cards, and wizard tests plan
- complete setup wizard UI plan
- complete connection backend commands plan
- create phase plan
- add research and validation strategy
- research phase connection setup
- UI design contract
- record phase 2 context session
- capture phase context
- evolve PROJECT.md after phase completion
- complete phase execution
- complete integration plan - Tauri commands, jira_client, dev status UI
- complete mock Jira server plan
- complete keychain and audit logging plan
- add self-check results to summary
- complete scaffold and test infrastructure plan
- create phase plan — 4 plans in 3 waves
- fix typography weight — collapse to 2 weights
- UI design contract
- add validation strategy
- research phase domain
- record phase 1 context session
- capture phase context
- create roadmap (7 phases)
- define v1 requirements
- complete project research
- initialize project

### Features

- show dual Jira buttons for copied tickets with prominent styling
- add translation keys for source/target Jira distinction
- add Open in Jira button to both ticket detail views
- build AboutSection, UpdateModal, wire into SettingsPage and App.tsx
- update store, launch check hook, and i18n keys
- register updater and process plugins, add capabilities and updater config
- add version bump script for multi-file version sync
- add release workflow and changelog config
- create GitHub Actions CI workflow
- write store and utility tests, enforce 80% line coverage threshold
- upgrade npm dependencies to latest major versions
- configure clippy pedantic and rustfmt, fix all Rust lint violations
- increase icon text size for better visibility
- icon shows "pmkar" wordmark matching app header
- redesign icon with macOS-compliant padding
- redesign app icon — white bg with red P glyph
- regenerate all platform icon variants from redesigned SVG
- redesign app icon SVG source
- configure Tauri bundle icons and update web favicon
- create branded app icon and generate all platform variants
- add ARIA semantics to SettingsPage nav, JQL radiogroup, and combobox
- keyboard-accessible expandable rows in AuditLogPage
- link ConnectionForm URL error via aria-describedby and add TicketListPage fetch status live region
- fix StatusBadge dark mode contrast and complete tab panel ARIA
- keyboard access and D-02 compliance for TicketCard and TriageIndicator
- add htmlFor/id label associations and live progress region to CopyPreviewModal
- fix dark mode contrast tokens and AppShell semantic structure
- replace 5 hand-coded SVG icons with Lucide icons in SettingsPage.tsx
- polish AuditLogPage with shadcn ScrollArea, Badge, Lucide icons and SetupWizard with Lucide ChevronRight
- redesign SettingsPage with sidebar nav layout per spec
- redesign CopyPreviewModal and CopyResultModal with shadcn Dialog and Progress
- convert list pages from table to card layout, deprecate TicketTable
- create TicketCard component with StatusDot, PriorityDot, SkeletonCards
- update App.tsx routing with ticket detail page branch
- create TicketDetailPage full-page component
- redesign AppShell with Lucide icons, shadcn Tooltip, Linear-inspired styling
- initialize shadcn/ui, install components, add Lucide, merge CSS tokens, add i18n keys
- move audit log trigger from footer to header icon
- add ticket detail panel to Not Mine and Already Linked tabs
- redesign homepage from 2-tab to 3-tab navigation
- refactor SettingsPage to sidebar navigation layout
- i18n test suite — language store, translation completeness, SettingsPage dropdown
- extract all UI strings and add LanguageSection to SettingsPage
- build complete en.json and sk.json translation packs
- Frontend i18n infrastructure — i18next init, languageStore, formatting utils, test helpers, App.tsx wiring
- Rust backend — app_config table, OS locale detection, language persistence commands
- implement AuditLogPage with expandable rows
- implement IgnoredTicketsPage with Restore action
- AppShell nav tabs + footer, App routing, TicketListPage filter
- add get_audit_count command and AuditEntry TS type
- add sub-task child issue creation loop and frontend step handling
- extend copy_ticket — description footer, attachments, comments, worklogs
- extend mock server — renderedFields.comment in v2, POST worklog in v3
- extend preview/result modals with attachment, comment, worklog, sub-task, and linked issue support
- create CopyResultModal and wire into TicketDetailPanel
- extend TriageIndicator with copied key badge and implement tests
- create CopyPreviewModal and add Copy button to TicketDetailPanel
- implement copy_ticket command and register both commands
- implement fetch_cloud_meta Tauri command
- extend triage_db with copied_key and update get_triage_state command
- add htmltoadf, multipart support, and Cloud metadata mock endpoints
- add copy pipeline types and copyStore state machine
- light header, consistent height, light/dark/system theme switcher
- add FetchConfigSection to SettingsPage
- create TicketDetailPanel and integrate into TicketListPage
- route App.tsx to TicketListPage, replace DevStatusPanel
- create TriageIndicator, TicketTable, and TicketListPage components
- create DescriptionRenderer and all five tab components
- add 9 Tauri commands and register in main.rs
- create triage_db module, enrich fixtures, extend mock server
- create Zustand ticket store with triage and fetch config
- define TypeScript types for Jira ticket data
- add gear icon, SettingsPage, ConnectionCard, wire App.tsx navigation
- build complete setup wizard components and wire App.tsx routing
- create TypeScript types and Zustand connection store
- add test_jira_server_connection and test_jira_cloud_connection commands
- add /myself and /serverInfo mock endpoints to v2 and v3 routers
- build dev status UI components and screen
- wire Tauri commands, jira_client, and main.rs
- implement dual-port mock Jira server with axum
- implement audit logging with SQLite and credential redaction
- implement OS keychain credential store
- create fixture data module with 12 realistic Jira tickets
- unified AppError type and Vitest test infrastructure
- scaffold Tauri 2 project with all Phase 1 dependencies

### Miscellaneous

- complete v1.0 milestone — archive, retrospective, PROJECT.md evolution
- add tauri-plugin-updater and tauri-plugin-process dependencies
- install @vitest/coverage-v8, add coverage config and test:coverage script
- update Rust crates via cargo update
- install Biome, add lint/format scripts, auto-format all src files
- add .gitignore to exclude .claude/
- add project config

### Testing

- persist verification and human UAT items
- add unit tests for triage_db and audit modules
- persist human verification items as UAT
- update SettingsPage tests for sidebar navigation layout
- add failing tests for AuditLogPage
- add failing tests for IgnoredTicketsPage
- extend CopyPreviewModal and CopyResultModal test suites for Phase 5 content types
- persist human verification items as UAT
- implement CopyResultModal tests — all 6 pass
- add Wave 0 test scaffolds for CopyPreviewModal and CopyResultModal
- add frontend tests for TicketListPage and TicketDetailPanel
- add frontend tests for all wizard components
- add failing integration tests for mock Jira server

### Style

- polish settings page — sleeker typography, refined layout
- move appearance section to bottom of settings
- switch to light theme — white bg, dark text, dark header
- header — red 'pm', white 'kar'
- header redesign — surface bg, branded K, gradient underline
- redesign header — red left accent bar with app name
- cooler neutral palette, table redesign, minimal header
- darker table header, minimal app header with red dot mark
- cooler palette, distinct table header, redesigned app header
- deep ISDD brand integration — warm dark palette, brand surfaces
- apply exact ISDD brand colors (#c02232, #ffffff, #231f20)
- rebrand from blue to ISDD red brand colors
