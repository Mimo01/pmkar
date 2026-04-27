# Project Research Summary

**Project:** Pmkar v0.4.0 — Configurable Field Mapping
**Domain:** Cross-Jira (Server v2 → Cloud v3) ticket bridge with dynamic, user-configurable field translation
**Researched:** 2026-04-27
**Confidence:** HIGH (stack/architecture/Jira API surface) · MEDIUM-HIGH (UX claims and library edge-case coverage)

## Executive Summary

The v0.4.0 milestone replaces the hardcoded copy pipeline (summary, description, labels, priority, assignee, reporter) with a fully dynamic, user-configurable field-mapping engine that discovers source v2 and target v3 field schemas at runtime, persists a single global source→target mapping, allows per-copy override in the existing Copy Preview modal, renders field-type-aware target controls for all common Jira types, gates the Copy button until target-required fields have values, and translates v2→v3 schema/value differences (user identity, versions/components, wiki→ADF). Comments, attachments, worklogs, sub-tasks, summary, and the origin remote link stay hardcoded inside the copy pipeline; the mapping engine only governs core fields and custom fields.

The chosen UX position — saved global mapping with per-copy override and an always-visible person picker — is unmatched by surveyed competitors (JCMA opaque auto-map, Backbone visual matrix without per-copy overrides, Exalate scripted Groovy). The biggest engineering risks are the Server username → Cloud accountId identity gap (well-known, addressable via existing Phase 16 user-search infra), the polymorphic custom-field reader/writer asymmetry, the createmeta pagination/show-all gotchas, and the htmltoadf coverage gaps for mentions/blockquotes/links/tables. The biggest UX risk is the cold-start latency of the first Copy Preview that triggers schema + mapping + user-list fetches.

The recommended phasing is 7 sequential-with-some-parallelism phases (17→23) totalling roughly 14–16 plans, with mock-server fidelity work threaded into Phase 17 (foundation) rather than as its own phase.

## Key Findings

### Recommended Stack

Stack additions are tightly scoped — total runtime cost ≈ **54 kB gzipped**. All versions verified live via npm and Context7 (2026-04-27).

**Core technologies (NEW):**
- **react-hook-form 7.74.0** + **zod 4.1.0** + **@hookform/resolvers 5.2.2** — schema-driven dynamic form rendering. zod can construct schemas at runtime from Jira metadata (essential for required-field gating).
- **cmdk 1.1.1** + **@tanstack/react-virtual 3.13.24** — virtualized comboboxes. Plain cmdk collapses at ~5k items per [shadcn-ui#7544](https://github.com/shadcn-ui/ui/issues/7544); virtualization is mandatory for any user/option list >500. `useFlushSync: false` required for React 19.
- **react-day-picker 9.14.0** — date/datetime fields. v9 line resolves the v8/React 19 peer-dep conflict; shadcn/ui Calendar already migrated.

**ADF strategy (KEY DECISION):** Do NOT add `@atlaskit/editor-core` in v0.4.0 — bundle bomb (2–3 MB+ gzipped, multiple reports of 12 MB total bundle and 50–80s build), restrictive Atlassian Design Guidelines license, styles fight the shadcn aesthetic. Description field renders as **plain wiki/HTML textarea + ADF preview** using the existing `htmltoadf` Rust pipeline. Real ADF authoring deferred to v0.5.0+.

**htmltoadf gap mitigation:** Documented coverage = headings/images/lists/tables/text/paragraphs/code/inline-cards/panels/emoji. Documented gaps = links, blockquotes, mentions, hard-break, mediaSingle. Plan: Rust-side post-processor wrapper to inject the missing nodes; if gaps explode in production, fork in-tree (MIT, ~600 LOC).

**Type bridge:** TypeScript discriminated unions on `schema.type` + `schema.items` mirroring Rust `serde(tag = "type")` enums. **No schema codegen library** (skip schemars, ts-rs).

**Reused (already in stack):** Phase 16 user search at `src-tauri/src/commands.rs:1075-1135` — covers both v2 `/rest/api/2/user/search` and v3 `/rest/api/3/user/search` and is reused as-is for the person picker.

**Anti-additions:** No global form library beyond RHF+Zod. No JSON-Schema codegen crate. No ADF authoring library in v0.4.0. No additional state-management library.

Detail: [STACK.md](STACK.md)

### Expected Features

Categorized for v0.4.0 scope. Complexity = build effort relative to existing v0.3.0 phase plans.

**Must have (table stakes — won't ship without):**
- Dynamic field discovery (v2 + v3 `/field`, v3 `/createmeta/{key}/issuetypes/{id}`) with custom-field detection and type extraction — **HIGH** complexity, foundation
- Saved global source→target mapping persisted in SQLite with sensible defaults pre-populated (description→description, labels→labels, priority→priority, assignee→assignee, reporter→reporter) — **MED**
- Settings UI mapping editor with field-type-aware target controls for all standard types (text, multi-line text + URL, person, multi-person, group, single/multi-select, labels, components, versions, date, datetime, number, checkboxes, radio) — **HIGH**
- Per-copy override panel inside CopyPreviewModal that defaults to saved mapping and allows inline tweaks without mutating saved config — **MED**
- Person picker with exact-email pre-fill (always visible even when matched) — **MED** (reuses Phase 16)
- Issue-type chooser at copy time, defaults to source-name match — **LOW**
- Required-field gating: Copy button disabled until target-required fields have values, gaps surfaced inline — **MED**
- v2→v3 schema/value translation layer (wiki→ADF text, version/component name→id, accountId resolution) — **HIGH**
- Audit logging of mapping decisions, overrides, and required-gap fills with credential/PII redaction — **LOW** (extends existing audit middleware)
- Mock server fidelity: realistic field schemas including ≥4 custom fields exercising the renderer registry — **MED**

**Should have (differentiators — set Pmkar apart):**
- Heuristic name-based default mapping suggestions when user opens the editor for the first time — **LOW**
- Field-schema cache with manual refresh button (avoids cold-start re-fetch on every Copy Preview) — **MED**
- Mapping drift detection via schema hashes (warn when target admin renamed/removed a mapped field since the saved mapping was created) — **MED**

**Defer (post-v0.4.0):**
- Real ADF rich-text authoring (Tiptap with custom prosemirror-model schema or @atlaskit fork) — defer to v0.5.0+
- Value-level select mapping ("Source priority 'P1' → target 'Highest'") — needed but adds another UI surface
- Per-project-pair scoped mappings — Pmkar is single-connection-pair, so global mapping is functionally equivalent
- Per-issue-type saved mappings — config explosion, per-copy override + per-copy issue-type chooser handles the variance
- Conditional mappings, scripting engine, AI-suggested mappings, bulk apply, field-history mapping — all explicitly anti-features for v0.4.0

**Anti-features (consciously not building):**
- Bidirectional sync (out of scope project-wide)
- Auto-create custom fields on target Jira (admin operation, scope creep)
- Persistent per-ticket override drafts (in-memory only for v0.4.0)

Detail: [FEATURES.md](FEATURES.md)

### Architecture Approach

The mapping engine integrates as a parallel path alongside the existing `copy_ticket` Rust command — `copy_ticket_v2` is added new, the old function stays untouched until v0.4.0 cuts over completely (old function deleted in v0.5.0). This preserves the existing 528-test suite while the new pipeline matures and avoids the v0.1.0/v0.3.0 lesson of refactor regressions.

**Major components:**
1. **`src-tauri/src/field_discovery.rs`** — Tauri commands for v2/v3 `/field` and v3 `/createmeta/.../issuetypes/{id}`. Caches results in a new `mapping.db` SQLite file. Manual user-triggered refresh, not auto-refresh on every modal open.
2. **`src-tauri/src/field_mapping_db.rs`** — new SQLite database (mirrors `snapshot_db.rs` precedent: separate file, separate `Arc<Mutex<>>`, separate `.db`). Three tables: `field_schema_cache` (raw JSON + parsed rows scoped by source/target/project/issuetype), `field_mapping` (one row per source→target pair, `transformer_config` JSON column), `mapping_meta` (singleton). Do NOT extend `triage_db.rs` (already 5 concerns).
3. **`src/features/mapping/fields/registry.ts`** — frontend `schema.type` → React component map. `DynamicTargetForm` does `getRendererForSchema(s); return <Renderer {...props} />`. Replaces the hardcoded fields block (~lines 225–344) of `CopyPreviewModal.tsx`.
4. **`src-tauri/src/field_transform/`** — submodule with `Transformer` trait and per-type implementations: `user`, `version`, `component`, `wiki_to_adf`, `identity`, `priority`. Entry point: `pipeline::apply_mapping(source, mapping, ctx) -> Map<String, Value>`. First-pass batch user lookup avoids N×M HTTP calls.
5. **`src-tauri/src/commands.rs::copy_ticket_v2`** — new Tauri command consuming the mapping engine. Reuses existing helpers for attachments/comments/worklogs/sub-tasks (extract them as `pub fn`s in the LAST step so old `copy_ticket` keeps working).
6. **Mock server extension** (`mock_server.rs` + `fixtures.rs`) — new routes on both v2 and v3 routers: `/field`, `/createmeta`, `/createmeta/.../issuetypes/{id}`, `/editmeta`, `/project/{key}/versions`, `/project/{key}/components`. Fixtures include ≥4 custom fields (number, multi-select, user, date) to exercise the renderer registry.

Build order is dependency-justified: field discovery + mock fixtures first, then mapping persistence and renderer registry in parallel, then mapping editor UI, then transform pipeline + dynamic target form, then copy_ticket_v2 wiring, then required-field gating + audit hooks, then refactor of shared helpers (last so old path stays alive throughout).

Detail: [ARCHITECTURE.md](ARCHITECTURE.md)

### Critical Pitfalls

Top 8 highest-impact items pulled from the 18 documented in PITFALLS.md.

1. **Server username vs Cloud accountId identity gap** — Server `assignee` returns `name`/`key`; Cloud requires `accountId`. Naive copy yields silent assignment failure. **Mitigation:** Person picker is always visible; pre-fills via Phase 16 email-search; never sends raw Server name to Cloud.
2. **Cloud privacy mode hides emailAddress** — Some Cloud user-search responses omit `emailAddress`, which breaks email-pre-fill. **Mitigation:** Treat email match as best-effort; always render picker; surface "no email match — please pick" inline. Already encountered in v0.3.0 Phase 16 (privacy banner).
3. **createmeta pagination + `expand=projects.issuetypes.fields` gotcha** — Without expand, fields are missing; without pagination, only first page returned for large projects. **Mitigation:** Use the new paginated `/createmeta/{key}/issuetypes/{id}` endpoint and expand explicitly; verify both at connection-time probe in Phase 17.
4. **Custom-field shape reader/writer asymmetry** — Cascade selects, multi-checkbox, multi-user, etc. return one shape but accept a different shape on write. **Mitigation:** Per-type writer functions in the transform pipeline; round-trip integration test for ≥4 custom field types in mock server.
5. **htmltoadf coverage gaps** — Library does not cover links, blockquotes, mentions, hard-break, mediaSingle. **Mitigation:** Rust-side post-processor wrapper; capture wiki→ADF round-trip diffs in Phase 18 verification; fork in-tree if gaps explode.
6. **Refactor regressing existing copy paths** — Comments/attachments/worklogs/sub-tasks stay hardcoded but consume `target_issue_key` from the new mapping flow. **Mitigation:** Introduce `CopyContext` seam, run full-pipeline integration test before deletion of old `copy_ticket`. Pull the v0.1.0 INT-02 hardcoded `MYPROJ` debt forward into the same refactor.
7. **Required-field gating must re-evaluate when issue type changes** — Required fields vary per issue type. Switching the target type from Bug→Task changes which fields are required mid-copy. **Mitigation:** Re-fetch createmeta and re-validate gating whenever the issue-type chooser value changes; debounce for UX.
8. **Cold-start latency of first Copy Preview** — Schema + mapping + user-list fetches stack on the first open. Estimated 8–15s without caching. **Mitigation:** Pre-warm field-schema cache on app launch; warm user-search cache on first connection; surface a skeleton state with progress indicators in the modal.

Detail: [PITFALLS.md](PITFALLS.md)

## Cross-Cutting Decisions Roadmapper Must Respect

These three decisions are settled by research and must NOT be re-debated at planning time:

1. **ADF authoring deferred** — Description field uses textarea + htmltoadf preview. Do NOT plan a phase for `@atlaskit/editor-core` integration. Real ADF editor is post-v0.4.0.
2. **Separate `mapping.db` SQLite file** — Do NOT extend `triage_db.rs` (already 5 concerns). New file follows `snapshot_db.rs` precedent.
3. **Per-copy issue-type chooser, not saved per-pair** — Saved mapping is global and issue-type-agnostic. The Copy Preview modal owns the issue-type dropdown and re-validates required-field gating on change.

## Implications for Roadmap

Phasing reconciled across all 4 research files (Architecture's 9 build steps + Features' 7 phases + Pitfalls' 8 phases collapsed into 7 phases). Continues numbering from v0.3.0 (last phase = 16) → starting at **Phase 17**.

### Phase 17: Field Discovery + Mock Schema Fidelity
**Rationale:** Nothing else builds without a typed schema for source v2 and target v3 fields. Mock server fixtures must include realistic custom fields before the renderer registry can be tested. Combining mock fidelity with discovery avoids a separate "groundwork" phase and surfaces v2/v3 differences early.
**Delivers:** `field_discovery.rs` Tauri commands hitting v2/v3 `/field` and v3 `/createmeta/{key}/issuetypes/{id}` with pagination + expand handling; serde structs for the polymorphic `schema` shape; mock server `/field`, `/createmeta`, `/editmeta`, `/project/.../versions`, `/project/.../components` routes with ≥4 custom-field fixtures (number, multi-select, user, date); connection-time createmeta probe (Pitfall 3).
**Avoids:** Pitfalls 1, 3, 13, 18.

### Phase 18: v2→v3 Translation Layer
**Rationale:** Translation primitives (user, version, component, wiki_to_adf) must exist before any target control can produce a valid POST payload. Pure pipeline work — no UI. Standalone Rust phase suitable for parallel research depth.
**Delivers:** `field_transform/` submodule with `Transformer` trait + per-type implementations; `pipeline::apply_mapping`; htmltoadf wrapper that injects missing nodes (links, blockquotes, mentions, hard-break, mediaSingle); first-pass batch user lookup; round-trip integration tests for ≥4 custom-field types.
**Avoids:** Pitfalls 4, 5.

### Phase 19: Mapping Persistence + CRUD Commands
**Rationale:** Mapping editor and renderer registry both need persistence as their store backend. Light-weight phase preceding the heavy UI work.
**Delivers:** `field_mapping_db.rs` SQLite database (3 tables); `mapping.db` file separate from existing dbs; CRUD Tauri commands (`get_field_mapping`, `set_field_mapping`, `delete_field_mapping`, `refresh_field_schema_cache`); migration to drop pre-populated defaults on first run.

### Phase 20: Renderer Registry + Field-Type-Aware Controls
**Rationale:** The biggest UI build (15+ control types). Pure component work, can run partly in parallel with Phase 19. Required by both Phase 21 (mapping editor) and Phase 22 (per-copy override panel) — building it standalone keeps both consumers honest.
**Delivers:** `src/features/mapping/fields/registry.ts` and per-type components: text, multi-line text + URL, person, multi-person, group, single-select, multi-select, labels, components, versions, date, datetime, number, checkboxes, radio; virtualized cmdk + tanstack-virtual for any list >500; react-day-picker integrated with shadcn/ui; readonly "Unsupported type" pill for heuristic misses.

### Phase 21: Mapping Editor (Settings UI)
**Rationale:** First user-visible surface. Composes registry (Phase 20) + persistence (Phase 19). Shippable end-to-end on its own — user can configure the mapping even if Copy Preview hasn't been refactored yet.
**Delivers:** Settings page section for "Field Mapping"; source-field list with name-match heuristic suggestions; per-row target field picker + transformer config; pre-populated defaults; manual "Refresh schema" button; mapping drift warnings.

### Phase 22: Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating
**Rationale:** The integration phase. Composes everything from Phases 17–21 into the existing CopyPreviewModal. Must re-evaluate gating when issue type changes.
**Delivers:** Issue-type chooser dropdown defaulting to source-name match; per-copy override panel (saved mapping + inline tweaks, in-memory only); required-field gating that disables Copy button and surfaces gaps inline; person picker always visible with email pre-fill; refactor of CopyPreviewModal lines 225–344 to use `DynamicTargetForm`.
**Avoids:** Pitfalls 2, 7, 11, 12, 14, 15, 16, 17.

### Phase 23: copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks
**Rationale:** Cuts over from old `copy_ticket` to the new mapping-driven path. Done LAST so the old path keeps the existing test suite green throughout the milestone. Pulls the v0.1.0 INT-02 hardcoded `MYPROJ` debt forward.
**Delivers:** `copy_ticket_v2` Tauri command consuming mapping engine; extract attachment/comment/worklog/sub-task helpers as `pub fn`s; `CopyContext` seam; full-pipeline integration test before old path is deleted; audit log entries for every mapping decision, override, and required-gap fill (hash-based default, opt-in verbose mode for credential redaction); `MYPROJ` parameterization fixed in same refactor.
**Avoids:** Pitfalls 6, 8, 9, 10.

### Phase Ordering Rationale

- **17 → 18 → 19** is strictly sequential (discovery contracts → translation primitives → persistence schema).
- **20** can begin in parallel with **19** (registry only needs schema types from 17, not persistence).
- **21** depends on **19 + 20** (composes them).
- **22** depends on **17 + 18 + 19 + 20 + 21** (the integration phase).
- **23** is the cutover, gated by the full-pipeline integration test so the existing 528 frontend + 75 Rust tests continue to pass throughout.
- Audit logging is folded into Phase 23 (not its own phase) because it's a cross-cutting concern best addressed at the cutover boundary.
- Mock-server fidelity is folded into Phase 17 (not its own phase) because the schema-discovery work is what surfaces the fixture requirements.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 18:** htmltoadf coverage gaps need empirical verification against representative source tickets — `/gsd-research-phase 18` recommended before planning.
- **Phase 22:** UX detail of how required-field gating surfaces gaps (banner? inline? per-field?) — short Plan-time discuss recommended.

Phases with standard patterns (skip research-phase):
- **Phase 17:** Createmeta API documented and predictable; existing v2/v3 client patterns apply.
- **Phase 19:** SQLite DB-per-concern is established (snapshot_db.rs, triage_db.rs, audit_db.rs).
- **Phase 20:** Registry + RHF/Zod patterns are well-documented in the recommended stack.
- **Phase 21:** Existing Settings page provides a clear template.
- **Phase 23:** Refactor work — pattern is "extract helpers, swap caller, full-pipeline integration test."

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified live via `npm view` + Context7; ADF strategy decision supported by community + dependency-tree evidence |
| Features | HIGH | Patterns from 4 reference tools (JCMA, Exalate, Backbone, CSV importer); table-stakes/differentiator/anti-feature split is opinionated and defended |
| Architecture | HIGH | Concrete file/module placements; build order dependency-justified; reuses existing patterns (db-per-concern, Tauri-command/Zustand/component) |
| Pitfalls | MEDIUM-HIGH | 18 pitfalls covered; v2/v3 schema differences HIGH; UX scale claims (10k users, 8–15s cold start) MEDIUM (not empirically measured) |

**Overall confidence:** HIGH — research is implementation-ready.

### Gaps to Address

- **htmltoadf empirical coverage** — README documents some nodes but production behaviour for links/blockquotes/mentions/tables needs verification with real source tickets. Resolve in Phase 18 planning via short `/gsd-research-phase`.
- **Field schema cache TTL** — recommended session-bound + manual refresh; exact TTL (10 min? per-session?) is a UX decision for REQUIREMENTS.md.
- **Behaviour on field-type heuristic miss** — recommended read-only "Unsupported type" pill; alternative is "treat as text" with warning. UX decision for REQUIREMENTS.md.
- **Cold-start latency budget** — pre-warming strategy details (on app launch? on first connection?) deferred to Phase 22 plan-time discuss.
- **Cloud target paginated createmeta endpoint availability** — some proxies/firewalls only expose the legacy endpoint. Worth a connection-time probe at Phase 17.

## Sources

### Primary (HIGH confidence)
- Atlassian Developer — [Jira REST API: createmeta](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/)
- Atlassian Developer — [Jira Cloud REST API v3 — Issue Fields group](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/)
- Atlassian Developer — [Group and User Picker (v3)](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-group-and-user-picker/)
- Atlassian Developer — [Atlassian Document Format spec](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)
- Atlassian Cloud Automation — [Convert usernames to accountIds](https://support.atlassian.com/cloud-automation/docs/convert-usernames-to-account-ids/)
- Atlassian Confluence — [GDPR username changes in Jira Cloud](https://confluence.atlassian.com/jirasoftwarecloud/gdpr-changes-to-usernames-in-jira-cloud-967319102.html)
- npm registry (verified 2026-04-27) — react-hook-form, zod, @hookform/resolvers, cmdk, @tanstack/react-virtual, react-day-picker, date-fns
- Context7 — react-hook-form, zod, tanstack-virtual library docs
- shadcn-ui — [#7544 combobox performance](https://github.com/shadcn-ui/ui/issues/7544); [Calendar June 2025 changelog](https://ui.shadcn.com/docs/changelog/2025-06-calendar)
- Project repo — `src-tauri/src/commands.rs:1075-1135` (Phase 16 user search), `src-tauri/src/audit_db.rs`, `src-tauri/src/snapshot_db.rs`, `src-tauri/src/triage_db.rs`, `src-tauri/src/mock_server.rs`, `src/components/CopyPreviewModal.tsx`

### Secondary (MEDIUM confidence)
- Atlassian Community — [editor-core bundle size discussion](https://community.atlassian.com/forums/Jira-questions/How-can-I-optimize-project-building-with-atlaskit-editor-core/qaq-p/2645394)
- Atlassian Community — [Get all custom fields and values](https://community.developer.atlassian.com/t/get-all-custom-fields-and-values/30154); [Get single field metadata](https://community.developer.atlassian.com/t/get-single-field-metadata/73451)
- Exalate docs — [Jira-to-Jira integration](https://docs.exalate.com/docs/jira-to-jira-integration); [Sync custom fields with options](https://docs.exalate.com/docs/how-to-sync-custom-fields-with-options-in-jira-cloud); [Cloud user field sync](https://docs.exalate.com/docs/jira-cloud-user-field-sync); [Invalid issue type selected](https://docs.exalate.com/docs/invalid-issue-type-selected)
- Backbone (K15t) — [Field mapping configuration sneak peek](https://www.k15t.com/blog/2016/04/backbone-issue-sync-for-jira-field-mapping-configuration-sneak-peek); [Common field mapping types](https://help.k15t.com/backbone-issue-sync/5.12/server/common-field-mapping-types)
- Atlassian — [JCMA: What gets migrated](https://support.atlassian.com/migration/docs/what-gets-migrated-with-the-jira-cloud-migration-assistant/); [JCMA custom-field gaps KB](https://support.atlassian.com/migration/kb/jcma-doesnt-migrate-all-custom-fields/); [Map CSV data to Jira fields](https://support.atlassian.com/jira-software-cloud/docs/mapping-csv-data-to-jira-fields/)
- Linear — [Jira integration docs](https://linear.app/docs/jira)
- htmltoadf README — [coverage matrix](https://github.com/wouterken/htmltoadf/blob/master/README.md)

### Tertiary (LOW confidence)
- Cold-start latency estimate (8–15s) — heuristic, not measured against real Cloud
- Cloud target paginated createmeta availability through proxies/firewalls — speculation; verify with connection-time probe

---
*Research completed: 2026-04-27*
*Ready for roadmap: yes*
