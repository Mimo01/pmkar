# Roadmap: Pmkar

## Milestones

- ✅ **v0.1.0 MVP** — Phases 1-11 (shipped 2026-03-25)
- ✅ **v0.3.0 Notifications & Change Tracking** — Phases 12-16 (shipped 2026-03-29)
- 🚧 **v0.4.0 Configurable Field Mapping** — Phases 17-23 (in progress)

## Phases

<details>
<summary>✅ v0.1.0 MVP (Phases 1-11) — SHIPPED 2026-03-25</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-03-20
- [x] Phase 2: Connection Setup (3/3 plans) — completed 2026-03-20
- [x] Phase 3: Ticket Fetch and Review (5/5 plans) — completed 2026-03-21
- [x] Phase 4: Copy — Core Fields (5/5 plans) — completed 2026-03-22
- [x] Phase 5: Copy — Attachments and Comments (3/3 plans) — completed 2026-03-22
- [x] Phase 6: Triage and Audit (3/3 plans) — completed 2026-03-23
- [x] Phase 7: Internationalization (3/3 plans) — completed 2026-03-23
- [x] Phase 8: UI Redesign (6/6 plans) — completed 2026-03-24
- [x] Phase 9: Accessibility (4/4 plans) — completed 2026-03-24
- [x] Phase 10: Codebase Quality (5/5 plans) — completed 2026-03-25
- [x] Phase 11: Deployment & Auto-Updates (4/4 plans) — completed 2026-03-25

Full details: [milestones/v0.1.0-ROADMAP.md](milestones/v0.1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v0.3.0 Notifications & Change Tracking (Phases 12-16) — SHIPPED 2026-03-29</summary>

- [x] Phase 12: Snapshot Foundation (2/2 plans) — completed 2026-03-27
- [x] Phase 13: Background Polling Engine (2/2 plans) — completed 2026-03-27
- [x] Phase 14: Notification Dispatch (2/2 plans) — completed 2026-03-28
- [x] Phase 15: Change Diff View (2/2 plans) — completed 2026-03-28
- [x] Phase 16: Enhanced Watch Configuration (2/2 plans) — completed 2026-03-29

Full details: [milestones/v0.3.0-ROADMAP.md](milestones/v0.3.0-ROADMAP.md)

</details>

### 🚧 v0.4.0 Configurable Field Mapping (In Progress)

**Milestone Goal:** Replace the hardcoded core-field copy logic with a fully user-configurable, field-type-aware mapping engine that bridges Jira Server v2 → Cloud v3 cleanly, supports custom fields, gates on required-field completeness, and surfaces every mapping decision in the audit log. Comments, attachments, worklogs, sub-tasks, summary, and the origin remote link stay hardcoded inside the existing copy pipeline; the mapping engine governs core fields and custom fields only.

- [x] **Phase 17: Field Discovery + Mock Schema Fidelity** - Source v2 + target v3 schema discovery with paginated createmeta, custom-field type detection, and mock fixtures exercising the renderer registry
- [x] **Phase 18: v2→v3 Translation Layer** - Pure Rust transformer pipeline for user/version/component lookups and wiki→ADF gap-fill
- [x] **Phase 19: Mapping Persistence + CRUD Commands** - New `mapping.db` SQLite database with schema cache, mapping rows, and seeded defaults — completed 2026-04-27
- [x] **Phase 20: Renderer Registry + Field-Type-Aware Controls** - Component-per-type registry covering 15+ Jira field types with virtualized pickers — completed 2026-04-28
- [x] **Phase 21: Mapping Editor (Settings UI)** - Settings page for editing the global mapping with name-match suggestions, manual schema refresh, and drift warnings — completed 2026-04-28
- [ ] **Phase 22: Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating** - Integration phase that wires the mapping engine into CopyPreviewModal with always-visible person picker and reactive required-field gating
- [ ] **Phase 23: copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks** - Cutover phase with `CopyContext` seam, helper extraction, full-pipeline integration test, audit redaction, and `MYPROJ` debt fix

## Phase Details

### Phase 17: Field Discovery + Mock Schema Fidelity
**Goal**: The app can discover the full set of source Jira Server v2 and target Jira Cloud v3 fields (system + custom) for a given project / issue type, including required-field metadata, and the mock server returns realistic schemas that exercise every renderer the milestone will ship.
**Depends on**: Nothing within v0.4.0 (extends existing v0.1.0 Jira clients and v0.3.0 mock infrastructure)
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04
**Success Criteria** (what must be TRUE):
  1. User opening a copy preview against the mock server sees source v2 and target v3 field schemas (system + ≥4 custom field types) populated with correct `schema.type`, `schema.items`, and `custom` discriminators.
  2. System fetches all required-field metadata for a (project, issue type) pair via the paginated `createmeta/{key}/issuetypes/{id}` endpoint, including projects whose issue-type list spans multiple pages.
  3. Mock Jira server exposes ≥4 custom field fixtures (number, multi-select, user, date) plus realistic v2 vs v3 shape divergence (priority, user, versions) so renderer registry tests cover production-like variety.
  4. Connection-time probe at app launch verifies the paginated createmeta endpoint is reachable on the configured Cloud target and surfaces a clear error if a proxy/firewall only exposes the legacy endpoint.
**Plans**: 5 plans

**Wave 1** *(parallel-safe — disjoint files)*:
- [x] 17-01-PLAN.md — Mock fixtures + v2/v3 routes (custom fields, createmeta pagination, versions/components per D-09/D-10/D-11/D-12)
- [x] 17-02-PLAN.md — Rust FieldSchemaType + FieldMappingDb (mapping.db with field_schema_cache table + SHA-256 schema_hash per D-04)
- [x] 17-03-PLAN.md — TypeScript fieldSchema types + schemaCacheStore (Zustand cache by side/projectKey/issuetypeId)

**Wave 2** *(blocked on Wave 1 completion)*:
- [x] 17-04-PLAN.md — Rust field_discovery HTTP module + 5 Tauri commands (discover/probe/prewarm/refresh) — depends on 17-01, 17-02
- [x] 17-05-PLAN.md — Probe banner + ConnectionCard status pill + App-launch wiring (D-05/D-07/D-08) — depends on 17-03, 17-04

**Cross-cutting constraints** *(truths shared by 2+ plans)*:
- FieldSchema discriminated union locked by RESEARCH.md §3 — Rust enum (Plan 17-02) and TypeScript union (Plan 17-03) must stay 1-to-1; consumed by Plan 17-04
- Cache key shape `(side, project_key, issuetype_id)` per D-13 — used by Plans 17-02 and 17-04
- No legacy `/createmeta?expand=…` fallback per D-06 — paginated endpoint only across all plans
- Pre-warm fetches issue-type list only, NOT per-issuetype field schemas (D-01 + D-15 reconciled) — affects Plans 17-04 and 17-05

**UI hint**: no

### Phase 18: v2→v3 Translation Layer
**Goal**: Pure Rust transformer pipeline that turns a source v2 issue + a saved mapping into a v3-shaped POST body, handling user identity, version/component name→id lookups, wiki→ADF translation with documented gap-fills, and batched HTTP to avoid N×M round trips.
**Depends on**: Phase 17 (consumes `FieldSchema` types and the discovery cache)
**Requirements**: TRAN-01, TRAN-02, TRAN-03, TRAN-04, TRAN-05, TRAN-06
**Success Criteria** (what must be TRUE):
  1. Given a source ticket with assignee/reporter user values, the pipeline resolves each unique user to a Cloud `accountId` in a single batched lookup pass per email domain (no N×M call explosion).
  2. Given source `versions`, `fixVersions`, or `components` referenced by name, the pipeline produces a target POST body referencing the correct target Cloud IDs, looked up against the target project's `/versions` and `/components` endpoints.
  3. Given a source description containing wiki markup with links, blockquotes, mentions, hard-breaks, and `mediaSingle` references, the produced ADF document includes those nodes (post-processor wraps `htmltoadf`'s documented coverage gaps).
  4. Round-trip integration tests for ≥4 custom-field types (number, multi-select, user, date) pass against mock fixtures that exhibit the read-shape vs write-shape asymmetry documented in pitfall research.
**Plans**: 5 plans

**Wave 1** *(scaffolding — no parallel siblings)*:
- [x] 18-01-PLAN.md — Skeleton: field_transform/mod.rs (shared types ResolvedFields/GapVariant/UnresolvedPerson/Version/Component/TransformContext) + 6 stub files + lib.rs registration

**Wave 2** *(parallel-safe — disjoint files)*:
- [x] 18-02-PLAN.md — Twin transformers: version.rs + component.rs (cached HTTP fetch, case-insensitive name match, partial-array resolution)
- [x] 18-03-PLAN.md — user.rs: batch user resolution (TRAN-06 one-HTTP-per-domain) + hand-written [~username] / HTML profile-link scanners (D-06, Pitfall C)
- [x] 18-04-PLAN.md — wiki_to_adf.rs (htmltoadf + ADF post-processor with mention resolution D-04, plain-text fallback D-05, unsupported-macro placeholder D-07, codeBlock guard Pitfall F) + identity.rs (write-shape stripping per Pitfall 4)

**Wave 3** *(integration — depends on all of Wave 1+2)*:
- [x] 18-05-PLAN.md — pipeline.rs: two-phase apply_mapping + per-row dispatch + round-trip integration test exercising ≥4 custom-field types against mock fixtures

**Cross-cutting constraints** *(truths shared by 2+ plans)*:
- Typed gap variants (UnresolvedPerson/Version/Component in ResolvedFields.gaps, NEVER Err) per D-01 — defined in Plan 01, consumed by Plans 02/03/05
- TransformContext.user_map is built ONCE in Phase 1 by Plan 03 resolve_batch and consumed by Plan 04 (wiki_to_adf) + Plan 05 (pipeline dispatch)
- Cache pattern (Arc<Mutex<HashMap>>, short lock windows, no lock during HTTP) shared between Plan 02 (version + component caches) — analog: field_discovery.rs:498-529
- Write-shape correctness (Pitfall 4) — Plan 04 identity owns it for symmetric types; Plan 05 pipeline enforces {accountId} for users (Pitfall 1)
**UI hint**: no

### Phase 19: Mapping Persistence + CRUD Commands
**Goal**: A separate `mapping.db` SQLite database that persists the global source→target field mapping (one mapping for the app), seeded with sensible defaults on first run and exposed through Tauri CRUD commands.
**Depends on**: Phase 17 (uses the `FieldSchema` types so default-mapping seeding can target real field IDs)
**Requirements**: MAP-01, MAP-02
**Success Criteria** (what must be TRUE):
  1. On first launch after the milestone ships, the app creates `mapping.db` separately from `triage.db` / `snapshot.db` / `audit.db` (following the established db-per-concern pattern).
  2. On first run with discovered schemas, the saved mapping is pre-populated with default rows for description, labels, priority, assignee, and reporter — the user does not face an empty mapping screen.
  3. CRUD Tauri commands (`get_field_mapping`, `set_field_mapping`, `delete_field_mapping`, `refresh_field_schema_cache`) load and persist mapping rows; mapping changes survive an app restart.
**Plans**: 2 plans

**Wave 1** *(scaffolding — extends `field_mapping_db.rs` with new tables + seed)*:
- [ ] 19-01-PLAN.md — `field_mapping` + `mapping_meta` DDL added to existing `field_mapping_db.rs`; `seed_defaults_if_empty` inserts 5 default rows (description→wiki_to_adf, labels→identity, priority→priority, assignee→user, reporter→user) at `open()` when table empty (D-01/D-02/D-03/D-07/D-08)

**Wave 2** *(blocked on Wave 1 — adds CRUD methods + Tauri commands + main.rs registration)*:
- [ ] 19-02-PLAN.md — `upsert_mapping_row` / `get_all_mapping_rows` / `delete_mapping_row` methods + 3 sync Tauri commands (`get_field_mapping`, `set_field_mapping`, `delete_field_mapping`) + `invoke_handler!` registration — depends on 19-01

**Cross-cutting constraints** *(truths shared by both plans)*:
- All commands are synchronous `pub fn` (not `async fn`) — workspace clippy enforces `unused_async`
- All commands take only `Arc<Mutex<FieldMappingDb>>` state — Pitfall 4 (lock-ordering deadlock)
- `FieldMappingRow` stays in `field_transform/mod.rs` (Phase 18); `field_mapping_db.rs` imports it — avoids circular dep
- Seed rows store `source_schema_json = NULL` / `target_schema_json = NULL`; row-mapper falls back to `FieldSchemaType::Any` (Pitfall 3)
- All SQL values bound via rusqlite `params![]` — no string interpolation (security mitigation T-19-01/06/07)
**UI hint**: no

### Phase 20: Renderer Registry + Field-Type-Aware Controls
**Goal**: Frontend component registry that maps each Jira `schema.type` (+ `schema.items`) to a dedicated React renderer covering all 15+ standard Jira field types, with virtualized pickers for any list >500 items and a clear fallback for unsupported types.
**Depends on**: Phase 17 (uses `FieldSchema` discriminated unions)
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, CTRL-06, CTRL-07, CTRL-08
**Success Criteria** (what must be TRUE):
  1. User sees a control matching the field type for every standard schema variant: text/multi-line/URL, single/multi user, group, single/multi select, labels, components, versions, date/datetime/number, checkboxes, and radio.
  2. User sees a read-only "Unsupported type" pill (never a crash, never a silent fallback to text input) when a target field's type is not in the renderer registry.
  3. User can scroll/keyboard-navigate a combobox containing 5,000+ items (e.g., user picker on a 10k-user org) without observable lag — virtualized rendering is wired through cmdk + `@tanstack/react-virtual` with `useFlushSync: false` for React 19.
  4. Each renderer is unit-testable in isolation via the registry — adding a new field type requires only a new renderer file and one registry entry, never a switch-statement edit in `DynamicTargetForm`.
**Plans**: 5 plans

**Wave 0** *(scaffolding — types contracts + test stubs + npm install)*:
- [ ] 20-01-PLAN.md — Install cmdk + @tanstack/react-virtual; create types.ts (RendererProps, SearchCallbacks, JiraComponent, JiraVersion); create 13 test stub files tagged by CTRL-0X requirement IDs

**Wave 1** *(parallel-safe — disjoint files)*:
- [ ] 20-02-PLAN.md — VirtualizedCombobox shared base (cmdk + useVirtualizer with useFlushSync:false; mitigates Pitfalls 1-4) + tests (CTRL-08)
- [ ] 20-03-PLAN.md — 9 simple renderers: String / TextArea / Url / Date / DateTime / Number / Checkbox / Radio / UnsupportedType + 6 tests (CTRL-01, CTRL-05, CTRL-06, CTRL-07 file-level)

**Wave 2** *(blocked on Wave 1)*:
- [ ] 20-04-PLAN.md — 8 picker renderers wrapping VirtualizedCombobox: User / MultiUser / Group / SingleSelect / MultiSelect / Labels / Component / Version + 5 tests (CTRL-02, CTRL-03, CTRL-04) — depends on 20-02

**Wave 3** *(integration)*:
- [ ] 20-05-PLAN.md — registry.ts (getRenderer dispatch) + DynamicTargetForm.tsx (stateless shell) + 7 fieldRenderer.* i18n keys (en + sk) + registry/integration tests (CTRL-07 routing closure + CTRL-01..08 integration) — depends on 20-03, 20-04

**Cross-cutting constraints** *(truths shared by 2+ plans)*:
- RendererProps interface (D-04) defined in Plan 01 and consumed by all 17 renderer files across Plans 02-05
- VirtualizedCombobox<T> exported from Plan 02 is the single virtualization implementation; Plan 04 picker renderers wrap it without re-implementation (D-08, D-09)
- D-01 (no invoke in renderers): grep gate `grep -r @tauri-apps/api/core src/features/field-renderers/` must return 0 in Plans 02, 03, 04
- D-02 (MultiUserPicker filters out UnresolvedPerson): isJiraUser type guard in Plan 04 enforces this; tested in MultiUserPickerRenderer.test.tsx
- D-03 (initialQuery on mount): VirtualizedCombobox useEffect (Plan 02) + UserPickerRenderer pass-through (Plan 04) + assertion in UserPickerRenderer.test.tsx
- D-12 (extension contract): Adding a new field type is one file under renderers/ + one switch case in registry.ts; verified by 19-case registry.test.ts in Plan 05
- i18n parity (Pitfall 6): en.json + sk.json have identical fieldRenderer.* key sets; translations.test.ts gate enforced in Plan 05
**UI hint**: yes

### Phase 21: Mapping Editor (Settings UI)
**Goal**: A new "Field Mapping" section in Settings where the user can view, edit, and persist the global source→target mapping, including custom-field rows, with heuristic name-match suggestions and a manual "Refresh schema" button. Drift warnings surface when a saved row references a target field that no longer exists.
**Depends on**: Phase 19 (persistence) and Phase 20 (renderers)
**Requirements**: DISC-05, MAP-03, MAP-04, MAP-05, EDIT-01, EDIT-02, EDIT-03
**Success Criteria** (what must be TRUE):
  1. User can open a "Field Mapping" section in Settings showing the current mapping (defaults + user additions) with one row per source→target pair.
  2. User can add custom-field mapping rows, edit any row's target field or transformer, remove default rows, and save changes; saved changes survive an app restart.
  3. User opening the editor for the first time after a fresh discovery sees heuristic name-match suggestions for unmapped source fields (case-insensitive equality + a small synonym set), accepted with one click.
  4. User can click a "Refresh schema" button to re-fetch field schemas from both Jiras, with a visible "Last refreshed Xm ago" timestamp.
  5. User opening the editor when the target Jira's schema has drifted (a saved row references a now-missing target field) sees an inline warning per affected row with a one-click remove option (drift detected via stored schema hashes).
**Plans**: 3 plans

**Wave 0** *(scaffolding — install sonner, mount Toaster, extend SectionCard, types/transformerOptions/heuristics + test stubs)*:
- [x] 21-01-PLAN.md — sonner install + SectionCard.headerAction + FieldMappingRow type + transformerOptions + heuristics module (with tests) + test stubs for downstream components

**Wave 1** *(parallel-safe leaf components — disjoint files)*:
- [x] 21-02-PLAN.md — DriftWarning + MappingRow (auto-save invokes set/delete_field_mapping via VirtualizedCombobox) + SuggestionsPanel (Accept/Dismiss with empty-string sentinel D-07) + tests for both — depends on 21-01

**Wave 2** *(integration — orchestrator + nav wiring + i18n)*:
- [x] 21-03-PLAN.md — FieldMappingSection orchestrator (load rows + drift detection useMemo + heuristic suggestions useMemo + refresh handler) + FieldMappingSectionHeader (Refresh button + Last refreshed timestamp) + SettingsPage Copying nav group + en/sk i18n parity — depends on 21-01, 21-02

**Cross-cutting constraints** *(truths shared by 2+ plans)*:
- Tauri commands wired in Plan 02 leaves only — orchestrator (Plan 03) does NOT call set/delete_field_mapping; it patches local Zustand state after leaves invoke
- Empty-string targetFieldId sentinel (D-07) for dismissed suggestions — used by Plan 02 (SuggestionsPanel.handleDismiss) and recognized by Plan 03 (drift detection skips empty-string rows; suggestions skip rows already mapped including dismissed)
- Frontend timestamp for lastRefreshed (Pitfall 2) — no backend command for MAX(cached_at); Plan 03 owns the Date.now() write on successful refresh
- VirtualizedCombobox compactness wrapper [&_button]:min-h-9 (Pitfall 5) — Plan 02 MappingRow applies it consistently around both target and transformer comboboxes
- i18n parity: 25+ new settings.fieldMapping.* / settings.group.copying / settings.nav.fieldMapping / settings.section.fieldMapping keys MUST exist with identical key sets in en.json + sk.json (Plan 03 owns; consumers in Plans 02 + 03 reference the keys)

**UI hint**: yes

### Phase 22: Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating
**Goal**: Integration phase that replaces the hardcoded right column of CopyPreviewModal with a `DynamicTargetForm` driven by the saved mapping, layered with per-copy in-memory overrides, gated by reactive required-field validation that re-evaluates on issue-type change, and anchored by an always-visible person picker that pre-fills via exact-email match.
**Depends on**: Phases 18, 19, 20, 21
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04, OVRD-01, OVRD-02, OVRD-03, OVRD-04, OVRD-05, OVRD-06
**Success Criteria** (what must be TRUE):
  1. User opens a copy preview and sees an issue-type chooser that defaults to the source-name match (or to the target project's first issue type when no name match exists, with a clear "defaulted" notice).
  2. User changing the target issue type triggers a fresh createmeta lookup and re-evaluates required-field gating before re-rendering the form (no stale gate from the previous type).
  3. User can override any saved-mapping row inline in the Copy Preview (target field, transformer, or value) without mutating the saved global mapping; closing the modal clears all overrides.
  4. User sees the Copy button disabled with an inline tooltip listing missing required fields until every target-required field has a resolved value; the button enables the instant the last gap is filled.
  5. User sees the person picker rendered for every person and multi-person field — even when an exact-email match is found (the match is shown as a green-check pre-fill), and the picker stays visible (with no error) when source has no email due to Cloud privacy mode.
  6. User can search target users by name or email inside the picker (reusing the Phase 16 user-search command) and see required-but-unmapped target fields surfaced inline at the top of the panel with a clear "fill in or map" affordance.
**Plans**: TBD
**UI hint**: yes

### Phase 23: copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks
**Goal**: Cutover phase that introduces a new `copy_ticket_v2` Tauri command consuming the mapping engine end-to-end, extracts the existing attachment/comment/worklog/sub-task helpers behind a `CopyContext` seam so they're shared between the old and new paths, audits every mapping decision with PII redaction, and pulls the v0.1.0 INT-02 hardcoded `MYPROJ` debt forward in the same refactor.
**Depends on**: Phase 22
**Requirements**: CUTV-01, CUTV-02, CUTV-03, CUTV-04
**Success Criteria** (what must be TRUE):
  1. Confirming a copy in the preview modal invokes `copy_ticket_v2`, which produces a Cloud-accepted POST body via the mapping engine and returns the same `CopyTicketResult` shape as today's `copy_ticket` — the existing 528 frontend tests still pass.
  2. Existing copy paths for comments, attachments, worklogs, sub-tasks, and the origin remote link continue to work after cutover (full-pipeline integration test against mock target verifies attachments downloadable, comment authors resolved correctly, sub-tasks parented correctly, remote link present).
  3. Every mapping decision, per-copy override, and required-gap fill is recorded in the audit log with hash-based redaction by default and a verbose-mode opt-in for full-value logging, gated by a credential-pattern sanitizer (Bearer/Basic/JWT/AWS/Slack token regexes).
  4. The previously-hardcoded `MYPROJ` cloud project key is parameterized end-to-end (read from `CopyContext` / connection settings) — copying against a Cloud project whose key is not `MYPROJ` succeeds in the integration test.
**Plans**: TBD
**UI hint**: no

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v0.1.0 | 4/4 | Complete | 2026-03-20 |
| 2. Connection Setup | v0.1.0 | 3/3 | Complete | 2026-03-20 |
| 3. Ticket Fetch and Review | v0.1.0 | 5/5 | Complete | 2026-03-21 |
| 4. Copy — Core Fields | v0.1.0 | 5/5 | Complete | 2026-03-22 |
| 5. Copy — Attachments and Comments | v0.1.0 | 3/3 | Complete | 2026-03-22 |
| 6. Triage and Audit | v0.1.0 | 3/3 | Complete | 2026-03-23 |
| 7. Internationalization | v0.1.0 | 3/3 | Complete | 2026-03-23 |
| 8. UI Redesign | v0.1.0 | 6/6 | Complete | 2026-03-24 |
| 9. Accessibility | v0.1.0 | 4/4 | Complete | 2026-03-24 |
| 10. Codebase Quality | v0.1.0 | 5/5 | Complete | 2026-03-25 |
| 11. Deployment & Auto-Updates | v0.1.0 | 4/4 | Complete | 2026-03-25 |
| 12. Snapshot Foundation | v0.3.0 | 2/2 | Complete | 2026-03-27 |
| 13. Background Polling Engine | v0.3.0 | 2/2 | Complete | 2026-03-27 |
| 14. Notification Dispatch | v0.3.0 | 2/2 | Complete | 2026-03-28 |
| 15. Change Diff View | v0.3.0 | 2/2 | Complete | 2026-03-28 |
| 16. Enhanced Watch Configuration | v0.3.0 | 2/2 | Complete | 2026-03-29 |
| 17. Field Discovery + Mock Schema Fidelity | v0.4.0 | 0/5 | Not started | - |
| 18. v2→v3 Translation Layer | v0.4.0 | 0/5 | Not started | - |
| 19. Mapping Persistence + CRUD Commands | v0.4.0 | 0/2 | Not started | - |
| 20. Renderer Registry + Field-Type-Aware Controls | v0.4.0 | 0/5 | Not started | - |
| 21. Mapping Editor (Settings UI) | v0.4.0 | 0/3 | Not started | - |
| 22. Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating | v0.4.0 | 0/? | Not started | - |
| 23. copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks | v0.4.0 | 0/? | Not started | - |
