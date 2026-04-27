# Phase 17: Field Discovery + Mock Schema Fidelity - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Foundation phase for v0.4.0 Configurable Field Mapping. The app discovers the full set of source Jira Server v2 and target Jira Cloud v3 fields (system + custom) for a given (project, issue type), including required-field metadata via the paginated `createmeta/{key}/issuetypes/{id}` endpoint, and the mock server returns realistic schemas that exercise every renderer the milestone will ship.

**In scope:**
- v2 `/field` + v3 `/field` field-list discovery with custom-field type detection
- v3 `/createmeta/{key}/issuetypes/{id}` paginated fetch with `expand=projects.issuetypes.fields`
- Rust serde structs + TypeScript discriminated unions for the polymorphic `schema` shape
- Persistent schema cache in a new `mapping.db` SQLite file (separate from triage/snapshot/audit)
- Connection-time probe at app launch verifying paginated createmeta is reachable on the configured Cloud target
- Mock Jira server fixtures: ≥4 custom field types + cascading select, 3 issue types, realistic v2/v3 shape divergence

**Out of scope (later phases):**
- Translation pipeline (Phase 18)
- CRUD Tauri commands for the saved mapping (Phase 19 — `mapping.db` file is created here, but `field_mapping`/`mapping_meta` tables are seeded there)
- Renderer registry / target controls (Phase 20)
- Mapping editor UI + manual refresh button (Phase 21, DISC-05)
- Drift warning UI (Phase 21, MAP-05) — Phase 17 only stores the hash that Phase 21 reads

</domain>

<decisions>
## Implementation Decisions

### Schema cache lifecycle
- **D-01** (Claude's discretion): Pre-warm at app launch — background fetch fires immediately after the connection-time createmeta probe succeeds. Eliminates the 8–15s cold-start documented in PITFALLS.md item 8 for the first Copy Preview.
- **D-02** (Claude's discretion): Session-bound + manual refresh — cache lives until app exit OR the user clicks the manual Refresh button (Phase 21, DISC-05). No TTL-based background invalidation.
- **D-03** (Claude's discretion): On a (project, issuetype) cache miss inside Copy Preview, fetch synchronously and show a skeleton state on the target-fields panel. Deterministic, matches the "no surprises" UX bias.
- **D-04** (Claude's discretion): Store a SHA-256 schema hash per (project, issuetype) row in `field_schema_cache` so Phase 21 can implement MAP-05 drift detection without a schema migration. Cheap to add now.

### Connection probe failure UX
- **D-05** (Claude's discretion): Soft warning banner — app launches normally, persistent (per-session-dismissable) banner says "Required-field detection unavailable on Cloud target." Triage and other non-mapping flows stay usable. Required-field gating is disabled until the probe passes.
- **D-06** (Claude's discretion): No legacy `/createmeta?expand=projects.issuetypes.fields` fallback — paginated endpoint only. Forces proxy/firewall misconfigurations to surface immediately rather than silently degrading. Avoids carrying technical debt as Atlassian deprecates the legacy endpoint.
- **D-07** (Claude's discretion): Specific + actionable error message — surface the exact endpoint URL, HTTP status code, and a one-line cause hint. Example: `GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001 returned 404. Your proxy may not expose the paginated createmeta endpoint.`
- **D-08** (Claude's discretion): Failure surfaces in **two** places — a dismissable app-shell banner at the top of the window AND a red status pill on the Cloud connection row in Settings → Connections. Hard to miss, fixable in the same place the user goes to fix it.

### Mock fixture realism
- **D-09**: Atlassian-typical custom-field naming — `customfield_10001 "Story Points"`, `customfield_10002 "Sprint"`, `customfield_10003 "Epic Link"`, `customfield_10004 "Team"`. Tests the standard Atlassian-ecosystem shape rather than coupling fixtures to any specific customer.
- **D-10** (Claude's discretion): Add cascading select as a 5th custom-field fixture (e.g. `customfield_10005 "Department/Team"` with parent/child option shape). Exercises the read/write asymmetry early and gives Phase 18 transformer pipeline a real test target. Renderer treatment is a Phase 20 decision (likely the CTRL-07 "Unsupported type" pill at first).
- **D-11**: Mock target project exposes 3 issue types — Bug, Task, Story — each with a different required-field set so Phase 22 (OVRD-02) can verify required-field gating re-evaluates on issue-type change. Suggested split: Bug requires `priority` + a custom `Severity`, Task requires only `summary`, Story requires `Story Points`.
- **D-12**: Mock reflects all 4 v2/v3 shape divergences:
  - User identity — v2 returns `assignee.name`/`key`, v3 returns `assignee.accountId` (Pitfall 1)
  - Versions/components — v2 references by name, v3 by id (Pitfall 9)
  - Priority — v2 returns `{name, id}` object, v3 write side accepts `{id}` only
  - Custom-field read/write asymmetry — multi-select reads as `[{value, id}, …]`, writes as `[{value}, …]` (Pitfall 4)

### Discovery scope keying
- **D-13**: Cache key = `(side, project_key, issuetype_id)` where `side ∈ {'source', 'target'}`. Single-connection-pair tool, so instance identity is implicit. Smallest indexes, cleanest joins.
- **D-14**: Source v2 — global `/rest/api/2/field` only, no per-issuetype fetch. We only WRITE to target; source-side required-field metadata is irrelevant for the read path. Source schemas exist purely to populate the source-field picker in the mapping editor.
- **D-15**: Target v3 — lazy fetch on issue-type selection in Copy Preview. No eager pre-fetch of all issue types. Trades potential first-Copy-Preview-per-issue-type latency for minimal network footprint.
- **D-16**: When the user changes the target issue type inside an open Copy Preview (Phase 22, OVRD-02 trigger) and the new issue type isn't cached, fetch synchronously and show a skeleton on the target-fields panel until createmeta returns. Disable the Copy button during the fetch. Matches D-03.

### Claude's Discretion
- Exact pagination page-size for createmeta (defaulting to Atlassian's default of 50 unless multi-page surfaces a clear win)
- Tauri command surface naming (`get_field_schemas`, `probe_createmeta`, `get_target_field_schema_for_issuetype` etc.) — final names emerge during planning
- Error retry/backoff policy for transient network failures during pre-warm
- Exact serde tag names for the `FieldSchema` enum (`type` discriminant value mapping)
- Skeleton UI animation/layout details
- Whether the pre-warm runs in `tauri::async_runtime::spawn` vs the existing `tokio` runtime used by `poll_engine`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context (always)
- `.planning/PROJECT.md` — Project vision, constraints, current milestone goals
- `.planning/REQUIREMENTS.md` — v0.4.0 acceptance criteria. Phase 17 covers DISC-01, DISC-02, DISC-03, DISC-04 (DISC-05 is Phase 21).
- `.planning/ROADMAP.md` §"Phase 17: Field Discovery + Mock Schema Fidelity" — Goal, dependencies, success criteria

### v0.4.0 milestone research
- `.planning/research/SUMMARY.md` — Cross-cutting decisions (ADF deferral, db-per-concern, per-copy issue-type chooser) and full milestone phase rationale
- `.planning/research/STACK.md` — Stack additions, ADF strategy decision, htmltoadf gap mitigation
- `.planning/research/ARCHITECTURE.md` — Concrete file/module placements for `field_discovery.rs`, `field_mapping_db.rs`, mock-server extensions; build order rationale
- `.planning/research/FEATURES.md` — Must-have/should-have/defer split for v0.4.0
- `.planning/research/PITFALLS.md` — All 18 documented pitfalls. Phase 17 specifically avoids Pitfalls 1, 3, 4 (read side), 13, 18.

### External (Atlassian primary docs — cite when planning/researching)
- Jira REST API createmeta — https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/
- Jira Cloud REST API v3 Issue Fields — https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/
- Atlassian Document Format spec — https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/

### Existing code (patterns to follow)
- `src-tauri/src/snapshot_db.rs` (738 LOC) — Pattern for the new `mapping.db` file: separate `Arc<Mutex<>>`, separate `.db`, migration on first open, db-per-concern principle. The new file should mirror this layout.
- `src-tauri/src/audit_db.rs` — Same db-per-concern precedent (no schema migration framework — manual `CREATE TABLE IF NOT EXISTS`).
- `src-tauri/src/triage_db.rs` — Anti-pattern reference: do NOT extend (already 5 concerns).
- `src-tauri/src/jira_client.rs` — Pattern for the new `field_discovery.rs` HTTP client wrapper. `search_tickets` (line 42) and `fetch_ticket_detail_raw` (line 109) show how to compose audited reqwest calls.
- `src-tauri/src/commands.rs:1063` `search_jira_users` and `:1096` `search_jira_users_by_domain` — Phase 16 user-search; reused as-is in Phase 22 for the person picker. Phase 17 should not touch these.
- `src-tauri/src/mock_server.rs` (886 LOC) — Where v2 and v3 routers live. New routes (`/field`, `/createmeta`, `/createmeta/{key}/issuetypes/{id}`, `/editmeta`, `/project/{key}/versions`, `/project/{key}/components`) are added on the existing routers at the bottom of the file (existing v3 user-search at line 858 is the registration pattern).
- `src-tauri/src/fixtures.rs` — Where mock fixture data lives. Custom-field fixtures (D-09, D-10, D-12) extend this file.
- `src/features/tickets/CopyPreviewModal.tsx` — Phase 22 integration target. Phase 17 doesn't touch it directly, but the schema types it imports must be designed for that consumer.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 16 user-search infra** (`src-tauri/src/commands.rs:1063,1096`): unchanged in this phase. Discovered schemas will reference user fields whose values are resolved by these commands during Phase 22 (person picker).
- **Audit middleware** (already wraps reqwest calls in `jira_client.rs`): every new createmeta/field call inherits audit logging + credential redaction for free. No new audit work in Phase 17.
- **Mock server v2/v3 router split** (`mock_server.rs:812,858`): the existing `v2::` and `v3::` modules already separate the two API surfaces. New routes drop into the same modules cleanly.
- **Tauri command + Zustand store + React component triple**: established pattern for end-to-end features. Phase 17 only needs the Rust + Tauri-command halves; the Zustand store is light (cache state) and the React surface is just whatever Copy Preview / pre-warm needs.

### Established Patterns
- **db-per-concern**: each concern gets its own `<concern>_db.rs` and its own `<concern>.db` file (`triage.db`, `snapshot.db`, `audit.db`). `mapping.db` follows. **Do not** add tables to existing dbs.
- **Discriminated-union types via serde tag**: existing Rust enums use `#[serde(tag = "type")]`; mirror this for `FieldSchema`. TypeScript side uses string-literal discriminants on `schema.type` + `schema.items`. No codegen library — keep types hand-written and tested.
- **Connection-time probes at app launch**: app already does keychain access + connection ping on launch. Adding a createmeta probe extends the same flow rather than introducing a new lifecycle hook.
- **Persistent dismissable banners**: existing privacy-mode banner (Phase 16) shows a per-session-dismissable banner from a Zustand store. Probe-failure banner (D-05/D-08) reuses this pattern.

### Integration Points
- **App-launch probe** hooks into the existing connection-validation step (Settings save + app-launch boot path).
- **Pre-warm fetch** (D-01) hooks in immediately after probe success on the same code path.
- **Settings → Connections page** gets a new red status pill on the Cloud connection row (D-08). UI surface already exists; Phase 17 adds the data + presentation.
- **`mapping.db` file** is created here with the `field_schema_cache` table (and the schema_hash column for D-04). Phase 19 adds `field_mapping` + `mapping_meta` tables to the same file.
- **Mock server route registration** at the bottom of `mock_server.rs` (after line 812 for v2, after line 858 for v3) is the only mock-side touch point — new fixture data lives in `fixtures.rs`.

</code_context>

<specifics>
## Specific Ideas

- **Pitfall-driven**: the four locked decisions on shape divergence (D-12) are not arbitrary — each maps to a documented v2/v3 asymmetry that bit JCMA, Backbone, or Exalate. Mock fixtures must reproduce these so Phase 18 transformers have something real to translate against.
- **Skeleton over progress bar**: D-03 + D-16 both pick "skeleton" rather than "progress bar" or "spinner" because the existing app uses skeleton states elsewhere (TicketCard load, AuditLogPage). Stay consistent.
- **No legacy fallback**: D-06 is opinionated — surface the misconfiguration loudly. The app's audience is power users debugging Jira plumbing; silent degradation costs them more than a clear error.
- **Atlassian-typical names over customer-specific**: D-09 keeps the mock fixtures generic so the renderer registry tests don't drift to one customer's quirks. If a real customer has odd custom fields, those become integration-test fixtures, not mock-server defaults.

</specifics>

<deferred>
## Deferred Ideas

- **TTL-based cache invalidation** — explicitly rejected for v0.4.0 (D-02 picks session-bound + manual refresh). Could revisit in v0.5.0 if users report stale-cache pain.
- **Eager pre-fetch of all target issue types** — explicitly rejected (D-15). If "first Copy Preview per issue type is slow" becomes a real complaint, revisit with telemetry rather than guesswork.
- **Per-field schema hash** (vs per-(project, issuetype) hash) — D-04 picks the coarser grain. Per-field gives surgical drift warnings but costs storage and complexity. Phase 21 can refine if MAP-05 needs it.
- **Legacy `/createmeta?expand=…` fallback** — explicitly rejected (D-06). Recipe for technical debt as Atlassian deprecates legacy endpoints.
- **Customer-specific mock fixtures** — D-09 picks generic Atlassian names. If integration testing against a specific customer's schema becomes important, those fixtures live alongside (not replacing) the mock-server defaults.
- **Auto-refresh on mapping-editor open** — explicitly listed as out-of-scope project-wide (REQUIREMENTS.md "Out of Scope" table: "Auto-refresh of schema cache on every modal open" — performance impact).
- **Schema discovery for non-configured projects** — Phase 17 only fetches for the configured target project. Multi-project support would change the cache key shape (D-13).

</deferred>

---

*Phase: 17-field-discovery-mock-schema-fidelity*
*Context gathered: 2026-04-27*
