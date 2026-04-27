# Pitfalls Research — v0.4.0 Configurable Field Mapping

**Domain:** Configurable Jira-to-Jira field mapping engine (Jira Server v2 → Jira Cloud v3) bolted onto an existing Tauri/React/Rust copy pipeline.
**Researched:** 2026-04-27
**Confidence:** MEDIUM-HIGH — Atlassian REST API v2/v3 schema differences and `accountId` privacy mode are HIGH confidence (verified by Atlassian docs and prior milestone retros). `createmeta`/`editmeta` shape and pagination are HIGH confidence (Atlassian developer docs). ADF translation gaps and `htmltoadf` library limitations are MEDIUM confidence (existing project uses `htmltoadf`; gaps observed during v0.1.0). Custom-field shape variability (cascade, multi-checkbox writer asymmetry) is HIGH confidence (Atlassian documented). UX scaling and config evolution claims (10k+ users, stale-mapping behavior) are MEDIUM confidence. Project-specific carry-overs (hardcoded `MYPROJ`, COPY-05 sub-task gap, checkbox drift) are HIGH confidence — drawn directly from `RETROSPECTIVE.md` and `MILESTONES.md`.

> **Scope reminder:** This milestone REPLACES the hardcoded core-field copy logic with a dynamic, user-configurable mapping engine. The existing copy paths for **comments, attachments, worklogs, sub-tasks, summary, and origin remote link** stay hardcoded but consume the `target_issue_key` produced by the new mapping flow. Every pitfall below is framed against that constraint.

---

## Critical Pitfalls

### Pitfall 1: Treating `accountId` (Cloud v3) and `name`/`key`/`username` (Server v2) as Interchangeable in Field Mapping

**What goes wrong:**
The mapping engine reads a person value from a Server v2 source field (assignee, reporter, multi-user-picker custom field) as `{ "name": "jdoe" }` or `{ "key": "JIRAUSER10100" }`, then POSTs the same shape to a Cloud v3 target field. Cloud silently ignores `name`/`key` for assignee (or returns `400 — anonymous user is invalid`) because Cloud v3 only accepts `{ "accountId": "557058:..." }`. The copy reports success, but the destination ticket has no assignee, no reporter, or `null`-out fields. For multi-user fields, all entries are dropped.

**Why it happens:**
Atlassian deprecated `name`/`username`/`key` in Cloud REST APIs for GDPR/privacy reasons in 2019. Server v2 still uses them as the primary identifier. Three traps compound:
1. Cloud's payload validation is permissive — it accepts unknown fields silently rather than rejecting the request.
2. `createmeta`/`editmeta` on Cloud returns the schema field as `"type": "user"` with `autoCompleteUrl` — but does NOT expose accepted-value shape. The shape is only documented in REST API docs, not in `createmeta`.
3. Server `key` (e.g., `JIRAUSER10100`) and Cloud `accountId` (e.g., `557058:abc-def`) have superficially similar opaque shapes — easy to misroute.

**How to avoid:**
- Define a normalized internal `Person { source_username, source_key, source_email, target_account_id }` type. Resolution from source → target ALWAYS goes through the email-match person-resolver step (Phase 16 user search reuse), never via raw identifier passthrough.
- The v2→v3 translation layer must reject any person field write that does not have a resolved `accountId` — fail loudly, do not silently drop.
- For `assignee`, `reporter`, and any `user`/`array<user>` schema custom field, the writer takes ONLY `{ accountId: string }` for Cloud targets. There is no fallback to `name`.
- Add a unit test per person-field schema variant (`user`, `array<user>`, `users` group) verifying that a Server `name`-shaped value gets translated correctly and that an unresolvable user produces a required-gating block (not a silent drop).

**Warning signs:**
- Code path constructs a person POST body with `if has_account_id { accountId } else { name }` — there is no valid fallback on Cloud.
- Mock target Cloud server accepts `{ name: "jdoe" }` for assignee — drift from real Cloud behavior.
- Audit log shows person field writes with `name` or `key` in the request body for Cloud targets.
- Destination tickets have `assignee: null` despite source having an assignee.

**Phase to address:**
**Phase 1 (Schema Discovery & Translation Layer)** — the v2→v3 user identity normalization is foundational. Every later phase (mapping UI, person picker, copy execution) consumes this. Retrofitting it once the writer is built means re-touching every person-field code path.

---

### Pitfall 2: Cloud Privacy Mode Hides `emailAddress`, Breaking Email-Based Person Pre-Fill

**What goes wrong:**
The "exact-email pre-fill" feature on the person picker is built assuming Cloud user search returns `emailAddress`. In dev (mock returns emails), pre-fill works. Against real Cloud, `GET /rest/api/3/user/search?query=jdoe@customer.com` returns users with `emailAddress` omitted (per the user's privacy settings or org-wide default), so no match is found. Every person field falls back to "user not found" — even when the user exists and has a valid `accountId`. The user manually re-picks every assignee on every copy.

**Why it happens:**
Jira Cloud's user privacy settings (default since 2019) hide `emailAddress` from `/rest/api/3/user/search` and `/rest/api/3/user` responses unless the queried user has explicitly opted in OR the requesting account has `User Administrator` global permission. Most PATs do NOT have that permission. The endpoint still returns `accountId`, `displayName`, and (sometimes) `avatarUrls` — but `emailAddress: null` or omitted.

A second compounding trap: Cloud's `/user/search` DOES match against email addresses internally, even when it doesn't return them. So `?query=jdoe@customer.com` may return the right user — you just can't verify it's the right one because the response email is hidden. Naive code assumes "no email match → no user".

**How to avoid:**
- Person resolver tries email-as-query first; if the API returns exactly ONE user, treat it as a high-confidence match (the engine implicitly matched by email even though it won't tell you).
- If multiple users return, fall back to displayName fuzzy match against source displayName + show disambiguation UI.
- Show a persistent banner in the person-mapping UI: "Email addresses are hidden by Jira Cloud privacy settings — pre-fill uses search heuristics. Verify the suggestion before copying."
- Cache resolution results in SQLite (`person_resolution` table: `source_username` + `source_email` → `target_account_id` + `confidence` + `resolved_at`) — re-resolve only on cache miss or when the user manually overrides.
- Mock target Cloud server MUST have a mode where `emailAddress` is omitted from search responses. Add a test fixture for this.

**Warning signs:**
- Person picker assumes `searchResults[0].emailAddress === sourceEmail` for match — will always be false in privacy mode.
- No "email hidden" banner or disambiguation flow for ambiguous matches.
- Mock returns `emailAddress` for all users → real Cloud returns none → silent regression in production.
- Code logs `User not found: jdoe@customer.com` even when the same query returns 1 result.

**Phase to address:**
**Phase 3 (Person Picker & Identity Resolution)** — privacy-mode handling must be the first design constraint, not an afterthought. Reuses Phase 16 user search infrastructure but adds the email-implicit-match heuristic + disambiguation UX.

---

### Pitfall 3: `createmeta` "Show all fields" Default — Required Custom Fields Missing from Discovery

**What goes wrong:**
Schema discovery calls `GET /rest/api/3/issue/createmeta?projectKeys=PROJ&issuetypeNames=Story&expand=projects.issuetypes.fields` and uses the returned `fields` map as the authoritative list of writable target fields. But the response is missing several custom fields that are actually required at create-time. The user's mapping config has no row for these fields. Copy fails with `400 — Field 'customfield_10082' is required`. The user sees a generic error and cannot proceed.

**Why it happens:**
Atlassian's `createmeta` endpoint, by default, returns ONLY fields visible on the configured "Create Issue" screen for that project + issue type. Custom fields exist in three categories:
1. **On the create screen** — returned by `createmeta` ✓
2. **Required but not on the create screen** — NOT returned by `createmeta`, but Cloud will reject the create call without them. This is a notorious Jira admin misconfiguration where field admins forget the Create Screen association.
3. **On the edit screen but not create screen** — only appear in `editmeta` after the issue exists.

Additionally, in Jira Cloud (post-2023), `createmeta` was split into `createmeta/{projectIdOrKey}/issuetypes` and `createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` — the legacy combined endpoint is deprecated and returns paginated data with a default page size that may truncate large schemas.

**How to avoid:**
- Use the new paginated v3 endpoints: `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes` (issue types list) followed by per-issue-type `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` for fields. Loop over `startAt`/`maxResults` until exhausted.
- After successful create, immediately call `editmeta` on the newly-created issue. Diff `editmeta.fields` vs `createmeta.fields` — any field present in `editmeta` but not `createmeta` is "post-create only" and must be either (a) updated in a follow-up PUT, or (b) flagged in the mapping UI as "edit-only".
- For "required but not in createmeta" — make the mapping UI a closed loop: after first failed create, parse the 400 error body (which lists missing required fields), surface them in the UI as "discovered required fields", and persist them to the schema cache so the next attempt does not repeat the failure.
- Document explicitly in the audit log: "createmeta returned N fields, edit-only delta: M fields".

**Warning signs:**
- Schema cache has fewer fields than the project's actual create screen + edit screen union.
- Code calls `createmeta?expand=projects.issuetypes.fields` (legacy combined endpoint) and treats result as complete.
- No retry-with-discovered-required-fields path on 400 errors.
- Pagination is not implemented for `createmeta/{projectIdOrKey}/issuetypes` — silently truncates after 50 issue types.

**Phase to address:**
**Phase 1 (Schema Discovery)** — the discovery contract must explicitly cover createmeta + editmeta union, pagination, and the post-failure required-field discovery loop. Without this, every later phase (mapping UI, required-gating, copy execution) is built on incomplete schema data.

---

### Pitfall 4: Custom Field Renderer-vs-Writer Asymmetry — Read Shape ≠ Write Shape

**What goes wrong:**
The mapping engine reads a custom field value from the source (e.g., a cascade select returns `{ value: "Parent", child: { value: "Child" } }`), maps it through the saved global mapping, and POSTs the same shape to the target. Cloud rejects with `400 — Operation value must be an Object with the structure { "value": "x" } or { "id": "y" }` (or for multi-checkbox: `Operation value must be a list of values`). The user is blocked with no clear remediation.

**Why it happens:**
Jira's custom field types have asymmetric read/write shapes. The shape returned in `GET /issue/{key}` (read) differs from the shape required in `POST /issue` and `PUT /issue/{key}` (write). The `schema.custom` string identifies the field type, and each type has its own writer contract:

| Type (`schema.custom` suffix) | Read shape | Write shape |
|---|---|---|
| `cascadingselect` | `{ value: "P", child: { value: "C" } }` | `{ value: "P", child: { value: "C" } }` (one of the few symmetric ones) |
| `multicheckboxes` | `[{ value: "A", id: "1" }, ...]` | `[{ value: "A" }, { value: "B" }]` — bare list, NOT objects with `id` mandatory |
| `radiobuttons` / `select` | `{ value: "A", id: "1", self: "..." }` | `{ value: "A" }` OR `{ id: "1" }` — extra fields cause 400 on some Cloud versions |
| `multiselect` | `[{ value: "A", id: "1" }, ...]` | `[{ value: "A" }, ...]` |
| `userpicker` | `{ accountId, displayName, avatarUrls, ... }` | `{ accountId: "..." }` only |
| `multiuserpicker` | `[{ accountId, displayName, ... }, ...]` | `[{ accountId: "..." }]` |
| `grouppicker` | `{ name, self }` | `{ name: "..." }` |
| `multigrouppicker` | `[{ name, self }, ...]` | `[{ name: "..." }]` |
| `labels` | `["a", "b"]` | `["a", "b"]` (symmetric) |
| `textfield` | `"string"` | `"string"` (symmetric) |
| `textarea` (Server v2) | `"wiki markup string"` | `"wiki markup"` (Server) / ADF doc (Cloud v3) |
| `datepicker` | `"2026-04-27"` | `"2026-04-27"` |
| `datetime` | `"2026-04-27T10:00:00.000+0200"` | `"2026-04-27T10:00:00.000+0200"` (symmetric, but timezone matters) |
| `float` | `3.14` | `3.14` |
| `version` / `versions` | `[{ name, id, released, ... }]` | `[{ name }]` or `[{ id }]` |
| `component` / `components` | `[{ name, id, ... }]` | `[{ name }]` or `[{ id }]` |

The naive "round-trip the value as-is" approach works for ~30% of types and fails silently or loudly for the rest.

**How to avoid:**
- Build a `FieldType` enum in Rust derived from `schema.type` + `schema.custom` (the suffix after `:com.atlassian.jira.plugin.system.customfieldtypes:`). Each variant implements `Reader` (parse from source response) and `Writer` (serialize to target POST body) traits separately — never reuse the read shape as the write shape.
- For each variant, write a parametric snapshot test: feed in a captured Server v2 response, assert the resulting Cloud v3 POST body matches the captured "known good" shape.
- Maintain a registry of supported `schema.custom` types. Unknown types produce a "not supported" mapping row that the user can either skip or hand-edit (raw JSON pass-through with explicit warning).
- Catalog ALL `schema.custom` strings observed in the source schema during discovery — log unknowns to the audit log so future mapping support gaps are visible.

**Warning signs:**
- A single `serialize_field_value(json) -> json` function used for all custom fields.
- POST body for `multiselect` field is an object instead of an array (or vice versa).
- Cloud returns `400 — Operation value must be ...` with field id; user sees raw error.
- No type-specific tests — only "happy path" text/select tested.

**Phase to address:**
**Phase 2 (v2→v3 Translation Layer)** — the type-aware writer must exist before mapping UI is built. Phase 4 (mapping UI) renders type-aware controls; Phase 5 (copy execution) calls writers. Both depend on this layer being correct first.

---

### Pitfall 5: ADF Translation Gaps Beyond `htmltoadf` Coverage

**What goes wrong:**
v0.1.0 already ships `htmltoadf` for wiki-markup → ADF translation. The mapping engine assumes any ADF-target text field can be filled via the same path. Edge cases that fail silently or produce broken ADF:

1. **Code blocks with language hint** — Server `{code:java}...{code}` becomes ADF `codeBlock` but the `attrs.language` may be lost.
2. **Tables** — Server `||h1||h2||\n|c1|c2|` syntax. `htmltoadf` produces ADF table nodes, but Cloud is strict about table structure: every row must have the same column count, and `tableRow > tableCell > paragraph > text` is the required nesting. Missing the inner `paragraph` produces a 400.
3. **Mentions** — `[~jdoe]` (Server username) becomes a literal `[~jdoe]` text node in ADF unless explicitly resolved to `{ type: "mention", attrs: { id: "<accountId>" }}`. The `id` is the target Cloud `accountId`, NOT the source username — requires the same person resolver as Pitfall 1/2.
4. **Attachment references** — Server `!filename.png|thumbnail!` references the attachment by filename. Cloud ADF `media` nodes reference attachments by `attachmentId` (returned at upload time). Since attachments stay hardcoded in v0.1.0 paths, the new mapping engine doesn't have access to the attachment id mapping at description-write time.
5. **Issue links** — `JIRA-123` plain text becomes a link in Server's renderer. ADF requires explicit `inlineCard` or `text` with `link` mark — `htmltoadf` may produce a plain text node, losing the link.
6. **Color / panel macros** — `{color:red}...{color}` and `{panel}...{panel}` macros are Server-specific. ADF has no equivalent for arbitrary color text; panels translate to ADF `panel` node but only with a fixed color set.
7. **Emoji shortcuts** — `:smile:` on Server may render as emoji; ADF `emoji` node requires `attrs.shortName` AND `attrs.id` (from Atlassian's emoji service) — the id is not derivable from text.

Naive use of `htmltoadf` produces ADF that Cloud accepts (no 400) but renders wrong: missing tables, broken mentions, dead attachment links.

**How to avoid:**
- Wrap `htmltoadf` in a `WikiToAdfTranslator` that runs a post-pass over the produced ADF tree:
  - Replace `[~name]` text nodes with resolved `mention` nodes (call person resolver).
  - Resolve `JIRA-123` patterns to `inlineCard` or `text+link` marks pointing to the source Jira instance URL (so links stay clickable, even if pointing to source).
  - Validate table structure: every row has equal column count, every cell wraps content in a `paragraph` node — emit a warning + drop malformed tables to plain text rather than producing 400-rejected ADF.
- For attachment references: defer description writes until after attachments are uploaded. The attachment upload step (hardcoded path) returns `(source_filename → target_attachmentId)` map. The description writer consumes this map to rewrite `media` nodes. This requires the new mapping pipeline to call the existing attachment uploader BEFORE writing description-typed fields.
- For unsupported macros (color, panel with custom color, emoji shortcuts): translate to plain text representation + log a "fidelity loss" entry in the copy result UI (same pattern as v0.1.0).
- Add a "ADF lint" step before submitting to Cloud: validate the ADF against Atlassian's schema (the `@atlaskit/adf-schema` JSON schema is publicly available) and surface validation errors to the user pre-flight, not as a 400 mid-copy.

**Warning signs:**
- Description copies "succeed" but rendered description in destination is missing tables, links, or shows literal `[~name]`.
- No post-pass over `htmltoadf` output to resolve mentions or attachments.
- Description write happens BEFORE attachment upload (no way to backfill `attachmentId`).
- No ADF schema validation step — first error surfaces as Cloud 400.

**Phase to address:**
**Phase 2 (v2→v3 Translation Layer)** for the mention/link/table post-pass and ADF validation. **Phase 5 (Copy Execution Refactor)** for the attachment-id backfill ordering — must orchestrate "upload attachments → rewrite description ADF → write fields".

---

### Pitfall 6: Required-Field Gating Re-Evaluation on Issue Type Change

**What goes wrong:**
The mapping UI shows the required-field gate as "all required fields filled — Copy enabled". User changes the target issue type from "Story" to "Bug". Copy button stays enabled. User clicks Copy. Cloud returns `400 — Field 'severity' is required` because Bug has a different required-field set than Story. User confused.

**Why it happens:**
Required fields in Jira Cloud are determined by the Field Configuration Scheme attached to the project, with overrides per issue type. The required set differs by issue type within the same project. The mapping engine MUST re-fetch the required-field set when the user changes the target issue type — there is no global "required fields for project P" answer.

A second compounding trap: `createmeta` for issue type X returns the required fields for X. If the user's UI flow lets them open the mapping panel with type=Story, change type to Bug AFTER mapping is shown, but the gate state is computed from the Story schema cache, the gate is wrong.

**How to avoid:**
- The required-field gate is a `derived(targetIssueType, mappingValues, schemaCache[targetIssueType])` — always recompute when any input changes.
- Issue type chooser triggers a schema fetch (or cache lookup) for the new type's createmeta BEFORE the mapping UI re-renders. Until the new schema arrives, disable Copy + show "loading required fields..." state.
- For the "user picks an issue type with no name match in source" case (e.g., source has "Story", target has only "Task"/"Bug"/"Epic"): default the chooser to a sensible fallback (configurable: `Task`) and surface an inline notice "Source type 'Story' has no exact match — defaulted to 'Task'. Verify required fields below."
- Display the required-field count prominently: "Required fields: 12 / 15 filled" — never hide the gate behind a single disabled button with no explanation.

**Warning signs:**
- Required-field set computed once at panel open and cached per session.
- Copy button enabled state derived from a flag set at panel mount, not a derived function.
- No "loading required fields..." state when issue type changes.
- 400 errors with "X is required" messages still reach the user (gate failed to catch them).

**Phase to address:**
**Phase 4 (Mapping UI & Required Gating)** — gate logic, issue-type chooser, and schema-refetch-on-change must be designed as one integrated flow, not three independent components.

---

### Pitfall 7: Stale Saved Mapping When Target Admin Adds/Removes/Renames Custom Fields

**What goes wrong:**
User saves a global mapping in v0.4.0 launch week. Three months later, the target Cloud admin renames `customfield_10082` from "Sprint" to "Iteration" (display name change), or removes the field entirely, or adds a new required custom field "Sentry Project". On the next copy:
- **Renamed field**: Mapping still works (id is stable) but the UI shows the old name "Sprint" — confusing but not broken.
- **Removed field**: Mapping references `customfield_10082` which no longer exists in `createmeta`. Copy fails with `400 — Field 'customfield_10082' cannot be set`. User sees an unintelligible error.
- **New required field**: Saved mapping has no row for it. Required gate fires — but the mapping UI auto-loads the saved mapping and shows "11/12 filled". User scratches head trying to figure out which field is missing.

**Why it happens:**
The mapping config is a snapshot of the schema at save-time. The schema is mutable on the Cloud side. There is no invalidation event — the app only discovers schema drift on the next copy attempt.

**How to avoid:**
- Saved mapping stores `target_field_id` (stable) PLUS `target_field_name` (cosmetic, for display) PLUS `target_field_schema_hash` (for drift detection).
- On every copy preview, re-fetch the target schema for the chosen project + issue type. Diff against the saved mapping:
  - **Removed fields**: Mark mapping row as "field no longer exists in target — remove from mapping?" with a one-click remove button.
  - **Renamed fields**: Update the cosmetic display name silently; log the rename to the audit log.
  - **New required fields not in mapping**: Highlight in red at the top of the mapping panel: "Target has new required fields: Sentry Project. Add mapping or copy will fail."
- Persist a `mapping_schema_version` bump whenever the saved mapping is edited; the UI shows "Mapping last verified against target schema: 2026-04-27. Schema drift detected." when the target schema hash differs.
- Never silently use a stale mapping that references a removed field — fail-fast in the UI before Copy is enabled.

**Warning signs:**
- Saved mapping persists field names instead of (or in addition to) field ids — renames silently break.
- No schema drift detection on copy preview open — first detection is a 400 error.
- "Field not found" errors propagate to the UI as raw Cloud error strings.
- Required-gate count shows mismatch with mapping rows (gate sees a required field that mapping has no row for) without surfacing the gap.

**Phase to address:**
**Phase 4 (Mapping UI)** for drift detection + UI surfacing. **Phase 1 (Schema Discovery)** for the schema hash + version metadata. Drift handling is a cross-cutting concern between these phases.

---

### Pitfall 8: Refactor Regression — Hardcoded Comments / Attachments / Worklogs / Sub-Tasks Pipeline Breaks

**What goes wrong:**
The v0.4.0 refactor replaces the hardcoded core-field copy with the new mapping engine. The existing pipeline path is:
```
copy_ticket(source_key) -> creates target issue -> uploads attachments -> posts comments -> posts worklogs -> creates sub-tasks -> writes origin remote link
```
The new mapping engine inserts itself at "creates target issue" — but each downstream step depends on `target_issue_key` and on side effects that the refactored step may handle differently:
- **Attachments**: depend on `target_issue_key`. If the new engine returns the key in a different shape (e.g., now returns `{ key, id, self }` instead of bare string), attachment uploader breaks with a type error or attaches to wrong issue.
- **Comments**: comment author attribution requires `accountId` of the original commenter, resolved via the same person resolver as core fields. If the resolver is now centralized in the new engine and the comment path doesn't get refactored to use it, comment authors regress to "the PAT holder" (a v0.1.0 known bug per "Looks Done But Isn't" checklist).
- **Sub-tasks**: COPY-05 was a sub-task gap caught LATE in v0.1.0. Sub-tasks recursively call `copy_ticket` — if the new engine has a different signature or new required parameters (e.g., `mapping_config: MappingConfig`), the recursive call needs the same mapping passed through. Easy to forget.
- **Origin remote link**: depends on target_issue_key. Same shape regression risk as attachments.
- **Hardcoded `MYPROJ` cloud project key (INT-02 from v0.1.0 audit)**: still present in some code paths. The new mapping engine takes target project from user input; the hardcoded `MYPROJ` in the attachment/comment/sub-task paths must be replaced to read from the new mapping context.

**Why it happens:**
The refactor scope is "field mapping" but the pipeline is a chain — changes to one link affect all downstream links. The team treats "hardcoded paths stay hardcoded" as license to not touch them, but the interface contract between the new mapping step and the hardcoded steps is itself a refactor.

**How to avoid:**
- Define a `CopyContext` struct (or equivalent) that the new mapping engine produces and ALL downstream hardcoded steps consume. Fields: `target_issue_key`, `target_project_key`, `target_issue_type`, `person_resolver: Arc<PersonResolver>`, `attachment_id_map: Arc<RwLock<HashMap<String, String>>>` (filename → target attachmentId, populated by uploader), `audit_session_id`.
- The `copy_ticket` orchestrator becomes the seam. Each downstream step takes `&CopyContext` instead of bare strings. Refactor the orchestrator and every downstream step's signature in the same plan, even if their internals are unchanged.
- Add an integration test that copies a ticket with: 2 attachments, 3 comments (different authors), 1 worklog, 2 sub-tasks. Verify in the (mock) destination: attachments downloadable, comments have correct author resolution, sub-tasks have correct parent linkage, origin remote link present. This is the "smoke test" gating the refactor.
- Resolve `MYPROJ` hardcoding (v0.1.0 INT-02 tech debt) AS PART of this refactor — every place that reads a project key now reads from `CopyContext`.

**Warning signs:**
- Hardcoded paths still take bare strings instead of `&CopyContext`.
- Sub-task recursive call doesn't pass mapping config / context through.
- Comment author attribution falls back to "current user" silently.
- `MYPROJ` literal still present in attachment/comment/sub-task code after refactor.
- No integration test covering the full pipeline post-refactor.

**Phase to address:**
**Phase 5 (Copy Pipeline Refactor)** — this is the explicit "wire the new mapping engine into the existing pipeline" phase. The `CopyContext` type and the orchestrator seam are the deliverable. Verification gate: full-pipeline integration test passes end-to-end against mock target.

---

### Pitfall 9: First-Time Copy Preview Cold Start Is Painfully Slow

**What goes wrong:**
User clicks "Copy" on a ticket for the first time after launch. The copy preview panel takes 8-15 seconds to appear. During that time, no spinner explanation. The user thinks the app is frozen, force-quits, retries, gets the same delay, and either gives up or files a "performance regression" bug.

**Why it happens:**
On first open per session, the preview panel needs:
1. Source schema (fields on the source ticket) — 1 API call, fast.
2. Target schema for the default project + issue type — `createmeta` paginated calls (Pitfall 3) — slow on real Cloud, especially for large projects with 20+ issue types.
3. Saved mapping — local SQLite read, fast.
4. Person resolver pre-warm: resolve the source assignee, reporter, and any people in custom fields against target — N person searches (Pitfall 2), each ~500ms-2s on real Cloud.
5. Component / version / option lookups for each select-typed field in the mapping — M list-fetch calls.

Sequential, this is 8-15s. Concurrent, it's still bottlenecked by the slowest user search.

**How to avoid:**
- Parallelize ALL discovery requests with bounded concurrency (4-6 simultaneous).
- Cache schemas in SQLite with TTL (e.g., 1 hour for schema, 24h for component/version lists, 7 days for person resolutions). Cold-start only on first copy of the day per project + issue type.
- Pre-warm on app idle: after triage view finishes loading, kick off a background fetch of target project schemas for the most-recently-used target project. By the time the user clicks Copy, schema is cached.
- Show a structured loading state in the preview panel: "Discovering target fields... Resolving people... Loading dropdowns..." — staged status messages, not a single spinner. (User research confirms staged progress reduces perceived wait time.)
- Set a hard timeout on each discovery request (10s) — if it fails, render the preview with cached/fallback data and a "some data could not be loaded — refresh?" banner. Never block the entire preview on one slow call.

**Warning signs:**
- Preview panel shows a single spinner with no text for >2 seconds.
- Discovery requests are sequential (`await` chained) rather than parallel.
- No SQLite cache for target schemas — re-fetched on every preview open.
- Person resolutions are not cached — same source user re-searched on every copy.

**Phase to address:**
**Phase 6 (Performance & Caching)** — separate from Phase 1 (Discovery) which builds correctness-first. Caching, parallelization, pre-warming, and staged loading UX should be a dedicated phase to avoid performance debt.

---

### Pitfall 10: Audit Log Leaks PII / Credentials in Custom Field Values

**What goes wrong:**
The audit log records every mapping decision and field-translation. A custom field value contains a user-pasted secret (a Slack token, an internal URL with embedded credentials, an SSH key, an internal customer email, GDPR-protected personal data). The audit log persists this verbatim. The audit log is exportable. The PAT-redaction logic from v0.1.0 only catches `Bearer` and `Basic` auth header patterns — it does not catch arbitrary credential strings inside JSON values.

**Why it happens:**
v0.1.0 audit logging assumes credential leak vectors are HTTP request headers. v0.4.0 widens the surface area: every field value flows through the mapping engine and is logged at multiple stages (read from source, translation step, write to target). Field values are user content — they may contain anything.

A second trap: even without leaked credentials, audit log entries may contain personal data (assignee email, customer name in a custom field, IP addresses) that triggers GDPR concerns when the audit log is shared for debugging.

**How to avoid:**
- The audit log records the field's `id`, `name`, `schema.type`, value `length`, and a `value_hash` (SHA-256 of the value) — but NOT the value itself by default.
- Add a separate "verbose audit mode" that logs values, gated by an explicit setting (off by default) with a warning banner.
- For known-sensitive field types (any `textarea`/`textfield` that the user has flagged sensitive in settings, plus any field name matching a regex like `/secret|token|password|key|credential/i`), force redaction even in verbose mode.
- Audit log writes go through a `Sanitizer` that runs a credential-pattern regex (`Bearer `, `Basic `, `aws_secret_`, `xox[bp]-` Slack, JWT pattern, AWS access key pattern, etc.) over every logged string and redacts matches to `[REDACTED:credential]`.
- Translation-layer audit entries log `source_value_hash` → `target_value_hash` — sufficient for debugging "did the value change?" without exposing the value.
- CI test: feed the test suite a synthetic ticket containing each credential pattern; assert the audit log output contains zero matches.

**Warning signs:**
- Audit log entries contain raw field values for any custom field.
- Sanitizer only checks HTTP headers, not JSON value payloads.
- No setting to suppress value logging.
- No CI test for credential patterns in audit output.

**Phase to address:**
**Phase 7 (Audit Logging & Observability)** — extension of v0.1.0 audit infrastructure. Must be designed alongside the translation layer (Phase 2) so that hash-based logging hooks into translation events from day one.

---

### Pitfall 11: Person Search at Scale — 10k+ User Org Hits Slow Cloud Responses + Stale Cache

**What goes wrong:**
The org has 12,000 users in Cloud. The person picker `?query=jdo` returns up to 50 results in 800ms-2.5s. User types fast (debounced at 300ms), each keystroke fires a search, the UI shows stale results because responses arrive out of order. User picks a name — but it's the result of an earlier query that has since been superseded. Wrong assignee on the copy.

A second failure mode: the person resolution cache (Pitfall 2) gets stale. Cached `accountId` is for a now-deactivated user. Copy sets assignee to a deactivated account; Cloud may reject (`400 — User is inactive`) or accept silently with the issue effectively unassigned.

**Why it happens:**
- Cloud's user search has no native "version" or "since" parameter. There's no incremental update mechanism.
- `displayName` is not unique — name collisions are common in large orgs (3 "John Smith"s).
- Deactivation is invisible to the search API by default; deactivated users are filtered out of search results, so a cached `accountId` from 6 months ago can point to a now-invisible user.

**How to avoid:**
- Implement search request cancellation: each new keystroke cancels the in-flight previous request (AbortController in fetch / drop the response in Rust). Only the latest response renders.
- Always show full disambiguation context: `displayName + emailDomain (if available) + accountId-suffix (last 6 chars)` so name collisions are resolvable.
- Cache resolutions with a 7-day TTL, but ALWAYS validate the cached `accountId` is still active before write — call `GET /rest/api/3/user?accountId=X` (cheap, single user). If 404 or `active: false`, invalidate cache and re-resolve.
- For the 10k+ user case: do not pre-load any "all users" list. Always lazy-search via the API. Implement an MRU (most-recently-used) cache of ~100 resolved users for instant render in dropdowns.
- Set request timeout on user search (5s); on timeout, show "search slow — try a more specific query" rather than spinning indefinitely.

**Warning signs:**
- No AbortController on search input — out-of-order responses possible.
- Person picker pre-loads any user list at app startup.
- Cached `accountId` used at write time without validity check.
- Disambiguation UI shows only `displayName` for matches.

**Phase to address:**
**Phase 3 (Person Picker)** — debouncing, cancellation, and MRU cache are the picker's contract. Cache validity check is in the writer (Phase 5), checked on every write.

---

### Pitfall 12: Bilingual UI (EN/SK) Awkwardly Mixes With Untranslated User-Provided Field Names

**What goes wrong:**
The UI is bilingual (EN/SK) per v0.1.0. The mapping panel renders a row per field with a label. The label comes from the Jira admin's chosen field name (e.g., "Sprint", "Story Points", "Sentry Project") — these are NOT translatable strings. In SK mode, the surrounding chrome ("Required", "Map to:", "Override") is in Slovak but the field labels are in English (or in whatever language the Jira admin used). User reports "missing translation" even though the field names are admin-provided strings the app cannot translate.

**Why it happens:**
i18n systems (i18next) translate static strings keyed by the developer. Jira field names are dynamic strings sourced from the API at runtime. Naively wrapping `t(field.name)` returns the raw English (or Slovak) string when no key matches, producing a confusing mixed-language UI.

**How to avoid:**
- Visually distinguish admin-provided strings from app-translated strings. Render field names with a subtle marker (e.g., monospace font OR an italic "(from Jira)" suffix the first time the user opens the panel) so it's clear the label is not a UI translation.
- Add a one-time onboarding tooltip in the mapping panel: "Field names are defined in your Jira instance and cannot be translated."
- Translate ONLY the surrounding chrome and field-type controls. Never wrap `field.name` in `t()`.
- In the audit log: log field names verbatim, never translated.
- Test: switch language mid-session with mapping panel open; verify field names do NOT change but chrome does.

**Warning signs:**
- `t(field.name)` calls in mapping rendering code.
- Bug reports about "translation missing" for field labels.
- Inconsistent rendering between EN and SK modes for field names (e.g., one uses original case, other uses lowercase).

**Phase to address:**
**Phase 4 (Mapping UI)** — the rendering convention for admin-provided strings must be set when the mapping rows are first built. Retrofit means touching every mapping component.

---

### Pitfall 13: Mock Server Custom-Field Schema Does Not Match Real Cloud Quirks

**What goes wrong:**
The mock Jira Cloud server returns a clean, consistent custom-field schema with all fields well-formed. The mapping engine works against the mock. Against real Cloud, edge cases break:
- Custom field with `schema.custom: "...:cascadingselect"` but schema description in mock is wrong shape.
- Real Cloud returns `allowedValues` for select-typed fields with `disabled: true` entries — mock omits this, so mapping UI shows disabled options as selectable.
- Real Cloud's `createmeta` returns fields with `hasDefaultValue: true` and a `defaultValue` field; mock returns no default. Real Cloud does NOT auto-apply the default if the field is required and unmapped — but the user assumes "has default → can leave unmapped".
- Real Cloud paginates `createmeta/.../issuetypes` at default 50; mock returns all in one page.
- Real Server v2 returns custom field values as objects with extra `self`/`avatarUrls` fields that aren't documented — mock omits them.

**Why it happens:**
v0.1.0 retro confirms mock drift was a real problem ("hardcoded `MYPROJ` survived through Phases 4-5"). The mock is built from observed responses to support specific tests, not from the OpenAPI spec. New code paths that hit untested response shapes fail.

**How to avoid:**
- Capture sanitized real-Jira responses for each custom-field type variant. Replace hand-crafted mock fixtures with these.
- Mock MUST implement: `createmeta` pagination (return `total > maxResults` and require multiple pages), `editmeta` returning a different field set than `createmeta`, `disabled: true` allowedValues, `hasDefaultValue: true` fields, `emailAddress` omitted from user search (Pitfall 2), 429 rate-limited responses, and `400 — Field 'X' is required` error response shape.
- For each `schema.custom` type the mapping engine claims to support, the mock must serve a fixture exhibiting that type's quirks. Maintain a coverage table: `schema.custom` × test fixture present? Block phase verification until coverage is complete.
- Add a mock "chaos mode" that randomly returns slow responses (up to 5s), 429s, and partial data — flush out frontend handling of degraded conditions.

**Warning signs:**
- Mock custom-field schema is hand-crafted JSON less than 30 fields.
- Mock `createmeta` returns all fields in one response regardless of count.
- No mock fixture exercising `disabled` allowed values, `hasDefaultValue`, or paginated createmeta.
- Tests pass but no contract test compares mock shape to real API spec.

**Phase to address:**
**Phase 0 (Mock Server Schema Fidelity)** — must precede schema discovery (Phase 1). Without mock fidelity, Phase 1 is built against a mirage. This is the highest-risk pitfall after #1 because everything downstream is calibrated against the mock.

---

### Pitfall 14: Snapshot Testing Dynamically-Rendered Forms Captures the Wrong State

**What goes wrong:**
The mapping panel is a dynamically-rendered form: rows depend on the discovered schema, ordering depends on saved-mapping cursor position, control type per row depends on `schema.custom`. Snapshot tests capture the rendered HTML and assert equality. Tests pass on day 1. As schemas evolve in the mock fixture, snapshots invalidate constantly — every fixture tweak means re-running snapshot updates without verifying correctness. Snapshots become rubber-stamps; a real regression slips through because the snapshot was auto-updated.

**Why it happens:**
Dynamic UI + brittle snapshot testing is a known antipattern. The snapshot is sensitive to: field id (random in fixtures), field name (admin-provided), control type (changes if `schema.custom` changes), default values (may include timestamps), and rendering order. Any of these changing invalidates the snapshot, and the easy fix (`-u` flag) destroys the test's value.

**How to avoid:**
- Test each control type in isolation with a hand-built fixture: "render a `multicheckboxes` control with 3 options, 1 disabled" — assert the rendered control via specific role queries (`getByRole('checkbox', { name: 'Option A' })`), not via snapshot.
- For the mapping panel as a whole, test BEHAVIOR not appearance: "given schema with N required fields and mapping with M filled, copy button is disabled iff M < N", "switching issue type triggers schema re-fetch", "person picker calls user search with debounce".
- Use snapshot tests only for stable, low-cardinality UI: error states, empty states, success modal copy. Never snapshot the full mapping panel.
- Set up Storybook (or equivalent) stories per control type for visual regression — separate from unit tests. Visual regression tools (Chromatic, Percy) handle dynamic content better than Jest snapshots.

**Warning signs:**
- Single snapshot test for the entire mapping panel.
- Snapshot file is >500 lines.
- Snapshots auto-updated in PRs without manual review (`-u` flag in CI or pre-commit).
- Test names like "matches snapshot" instead of behavioral descriptions.

**Phase to address:**
**Phase 4 (Mapping UI)** — testing strategy is a phase deliverable, set as the testing contract before component implementation. Retrofit means rewriting every test.

---

### Pitfall 15: Required-Field Discovery Failure Silently Disables Required-Gating

**What goes wrong:**
The schema discovery for required fields fails (network timeout, 401 from expired PAT, 500 from Cloud). The error is caught, logged, and the mapping panel continues with an empty required-field set. Copy button is enabled (no required fields → nothing to gate). User clicks Copy. Cloud rejects with 400. User sees an unintelligible error. The required-gating feature, the marquee feature of the milestone, silently degrades to a no-op when its dependency fails.

**Why it happens:**
"Defensive programming" anti-pattern: catching errors and falling through to a "default" empty state. The default empty state for required-fields (`[]`) coincidentally enables the Copy button, which is the wrong fallback.

**How to avoid:**
- Required-field discovery failure is a HARD ERROR for the mapping panel — Copy button stays disabled, panel shows "Could not load required fields. Retry?" with a retry button.
- The empty required-field set after a successful discovery is distinguishable from "discovery never ran" — represent state as `RequiredFields = NotLoaded | Loading | Loaded(Vec<Field>) | Error(String)`. The UI treats `NotLoaded` and `Error` the same: Copy disabled, retry visible.
- Test the failure path: mock returns 500 for createmeta → assert Copy disabled, retry visible, error message rendered.
- On Copy click, never trust the gate alone — submit, and if Cloud returns 400 with required-field messages, parse them and surface in the UI as "Discovered new required fields: X. Add to mapping?" (this is the "post-failure required-field discovery loop" from Pitfall 3).

**Warning signs:**
- Discovery error caught, state set to `[]`, no UI indication.
- Required-field state is `Vec<Field>` instead of an enum with explicit error/loading variants.
- No test for "discovery fails → Copy disabled".
- Copy button enabled state is `requiredFields.every(filled)` — true vacuously when array is empty.

**Phase to address:**
**Phase 4 (Mapping UI & Required Gating)** — error states are first-class UI concerns. The required-gating feature is incomplete without explicit failure handling.

---

### Pitfall 16: Saved Global Mapping vs Per-Copy Override Conflicts Confuse Users

**What goes wrong:**
User saves a global mapping: source `assignee` → target `assignee` (with a specific person). User copies ticket A — overrides assignee to a different person inline. Copies ticket B — assignee defaults back to the global mapping's person, but the user expected "the last person I picked". Or: user changes the global mapping while a copy preview is open in another window — preview shows the old mapping; user copies expecting the new one.

**Why it happens:**
Three-tier configuration (defaults → saved global → per-copy override) without explicit precedence rules and visual distinction between tiers. Users mental-model "last action wins" but the code is "saved global is base; override is per-copy".

**How to avoid:**
- Explicit precedence: `effective_value = override ?? saved_global ?? schema_default`. Document this on the mapping panel UI: "Showing: 1 override + 12 saved + 3 defaults".
- Visual distinction: override rows have a colored left border + "(overridden — reset)" link. Saved-global rows have a different marker. Defaults are subtle gray.
- "Reset to saved" button per row + "Clear all overrides" button at the panel top.
- Saved-mapping changes propagate to open preview panels via Tauri event broadcast — never let a stale preview submit using outdated saved mapping.
- Audit log records each effective value with its source: `{ field: "assignee", value: "...", source: "override" | "saved_global" | "default" }`.

**Warning signs:**
- Mapping panel renders override and saved values identically.
- No "reset to saved" option per row.
- Saved-mapping changes do not propagate to open previews.
- Audit log records final values without provenance.

**Phase to address:**
**Phase 4 (Mapping UI)** — three-tier precedence is a foundational UX pattern; bolting it on after one tier ships causes refactor.

---

### Pitfall 17: Issue Type Default Fallback Picks Wrong Type, Hides It From User

**What goes wrong:**
Source ticket is type "Story". Target project has types: "Task", "Bug", "Epic", "Spike" — no "Story". The auto-match logic falls back to the first type alphabetically ("Bug"). User clicks Copy without noticing the type chooser defaulted to "Bug". Destination has a Bug instead of a Story; project's Bug-specific automation fires (e.g., notifies QA team). User's manager asks why a customer requirement was filed as a Bug.

**Why it happens:**
Auto-match defaults to the first-found target type when there's no name match, and the type chooser is positioned inconspicuously in the UI. Users skim and assume the default is correct.

**How to avoid:**
- When source name has no exact match in target types, default to a CONFIGURABLE fallback (per-project setting, e.g., "Task") rather than alphabetical first.
- When fallback is used, surface a banner: "Source type 'Story' has no match in target project. Using 'Task' — change?" — banner stays visible until user explicitly confirms or changes.
- Issue-type chooser is a prominent select with current value visible at all times (not hidden in a side panel or accordion).
- Audit log records: source type, attempted match logic, final selected type, whether user explicitly changed it.

**Warning signs:**
- Default issue type is `targetTypes[0]` without configuration.
- No banner / surface for "no exact match" case.
- Issue type chooser hidden in collapsed UI section.
- Audit log doesn't distinguish "user picked type" vs "auto-defaulted".

**Phase to address:**
**Phase 4 (Mapping UI)** — issue type chooser is a Phase 4 component; default-fallback behavior is part of its contract.

---

### Pitfall 18: Field-Permission Variance Per Project Hides Fields the User Expected

**What goes wrong:**
User configures a global mapping including `customfield_10100` (e.g., "Sentry Project"). Mapping works for project A. User copies a ticket to project B; the field is missing from `createmeta` — not because it's not on the create screen, but because the user's PAT lacks `Edit Issues` permission specifically for project B (or the field has a per-project edit restriction). Mapping panel shows the field as "removed from target" (Pitfall 7) but the underlying cause is permission, not schema. User wastes time trying to re-add a mapping for a field they cannot write.

**Why it happens:**
`createmeta` filters fields by what the requesting user can write. Permission scopes are project-level on Server and project + role-level on Cloud. PAT scopes vary per project, especially in large orgs. The empty/missing field could mean: (a) field not on screen, (b) field doesn't exist on this project, (c) user lacks permission. Each requires a different remediation.

**How to avoke:**
- When a field present in the saved mapping is missing from current `createmeta`, do NOT just say "removed". Run `GET /rest/api/3/field` (returns all fields for the instance, no project filter, no permission filter) to determine if the field still exists at the instance level. Cross-reference:
  - Field exists at instance level + missing from project createmeta → likely permission OR not associated with this project. Surface: "Field not available for this project (may be a permission issue)."
  - Field doesn't exist at instance level → truly removed. Surface: "Field no longer exists in target."
- Separately, surface the permission set on the PAT at app startup via `GET /rest/api/3/mypermissions?projectKey=...` — preempt mapping failures by showing missing permissions in the connection settings UI.
- Audit log records the source (createmeta filter vs instance-level check) for each "field missing" determination.

**Warning signs:**
- "Field removed" shown without distinguishing schema removal vs permission lockout.
- No `mypermissions` check at copy preview open.
- Cross-reference between `createmeta` and `GET /field` not implemented.

**Phase to address:**
**Phase 7 (Audit Logging & Observability)** OR **Phase 1 (Schema Discovery)** — the field-existence cross-reference belongs in discovery; the permission check belongs in connection settings (which is v0.1.0 territory but needs an extension here).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single `serialize_field(json)` for all custom fields | Fast first cut of writer | 400 errors per type variant; users blocked | Never — type-aware writers from day one |
| Use `createmeta` only (skip `editmeta` reconciliation) | Simpler discovery | Required-but-not-on-create-screen fields cause silent 400s | Acceptable only if accompanied by post-failure required-field discovery loop |
| Store saved mapping as field NAMES not IDs | Survives display-name read | Renames silently break; field-id-vs-name confusion | Never — store id (stable) + name (cosmetic) |
| Skip schema drift detection on preview open | Faster preview load | Stale mapping → 400 errors with no remediation path | Acceptable for v0.4.0-alpha if user is told "drift detection coming"; never for v0.4.0 release |
| Hand-write mock custom-field fixtures | Quick test setup | Mock drift; tests pass + real Cloud fails (v0.1.0 pattern) | Never for custom field tests; acceptable for happy-path text-field-only smoke tests |
| Reuse v0.1.0 person resolver as-is for assignee but not custom user fields | Lower scope | Assignee works, custom user fields silently drop | Never — single resolver covers all user-typed fields |
| Wrap `htmltoadf` output without post-pass for mentions/attachments | Faster ADF translation | Mentions render literal; attachments dead links | Acceptable only with explicit "fidelity loss" UI banner per copy |
| Use `t(field.name)` for admin-provided field labels | "Looks i18n-clean" | Mixed-language UI; user confusion | Never — field names are not translatable |
| Cache person resolutions without TTL | Fast resolution | Deactivated user accountId persists; copies set inactive assignee | Never — TTL + validity check at write time |
| Required-field count = mapping rows count | Simple math | Hidden when mapping has rows for non-required fields too | Never — required count is from schema, not mapping |
| Treat empty required-field set as "all clear" | Defensive coding | Discovery failure silently degrades to "no gating" | Never — represent NotLoaded/Loaded/Error explicitly |
| Audit-log full field values for debugging | Easier post-mortem | PII / credential leak in logs | Acceptable only as opt-in verbose mode with redaction regex |
| Snapshot test entire mapping panel | Fast initial coverage | Brittle; snapshots auto-updated without review | Never for dynamic UI — behavior tests instead |
| Hardcoded `MYPROJ` in attachment/comment paths (still present from v0.1.0) | Was a v0.1.0 shortcut | Already documented as INT-02 tech debt | Resolve as part of v0.4.0 refactor; never extend to new code |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloud v3 `createmeta` (legacy combined endpoint) | Use `createmeta?expand=projects.issuetypes.fields` and trust full response | Use new paginated endpoints `createmeta/{key}/issuetypes` + per-type field fetch with pagination loop |
| Cloud v3 `createmeta` vs `editmeta` | Treat createmeta as authoritative for all writable fields | Union of createmeta + post-create editmeta covers required + edit-only fields |
| Cloud v3 person field write | POST `{ name: "jdoe" }` (Server-style) | POST `{ accountId: "557058:..." }` only; reject any other shape pre-flight |
| Cloud v3 user search privacy | Assume `emailAddress` always present | Treat email as optional; use single-result heuristic + displayName fallback |
| Cloud v3 cascade select write | POST flat `{ value: "Parent.Child" }` | POST nested `{ value: "Parent", child: { value: "Child" } }` |
| Cloud v3 multi-checkbox write | POST `[{ value, id }, ...]` (read shape) | POST `[{ value }, ...]` (write shape — no id required) |
| Cloud v3 user picker custom field | POST full user object from read | POST `{ accountId }` only |
| Cloud v3 group picker | POST `{ name, self }` | POST `{ name }` only |
| Cloud v3 ADF mentions | Translate `[~jdoe]` to literal text | Resolve to `mention` node with `attrs.id = accountId` |
| Cloud v3 ADF attachment refs | Use Server filename in `media` node | Use target `attachmentId` (returned at upload time); requires upload-before-description ordering |
| Cloud v3 ADF tables | Translate Server table syntax to ADF table without inner paragraph | Wrap every cell content in `paragraph` node; validate row column counts equal |
| Cloud v3 issue type matching | Auto-match alphabetical first when no exact name match | Configurable fallback type + explicit user banner for unmatched cases |
| Cloud v3 required field discovery | Trust createmeta required flag completely | Also parse 400 error bodies for "Field X is required" messages and update schema cache |
| Server v2 username case sensitivity | Treat `JDoe` and `jdoe` as the same user | Server usernames are case-sensitive on lookup; preserve exact case from source |
| Server v2 user `key` vs `name` | Use `name` as identifier in all writes | Use `key` (immutable) for storage; use `name` for display only — `name` can change |
| Server v2 attachment filename collision | Assume filename unique within ticket | Server allows duplicate filenames; use `id` for attachment lookup, filename for display |
| Cross-instance: source field id `customfield_10014` | Map to target by same id | IDs are instance-specific; map by user-defined name OR by `schema.custom` type heuristic with user confirmation |
| `htmltoadf` library | Trust output as Cloud-valid ADF | Run ADF schema validator post-translation; handle table/mention/attachment edge cases manually |
| `mypermissions` API | Skip permission check; surface failures via 400 | Check at copy preview open; surface missing permissions before user wastes time mapping |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sequential schema discovery on preview open | Preview takes 8-15s on first open | Parallelize with bounded concurrency; cache in SQLite with TTL | First copy per session (always); every copy if no caching |
| Person search not debounced + no cancellation | Stale search results render; wrong assignee picked | 300ms debounce + AbortController on input | Any org with >500 users + fast typer |
| Unbounded `createmeta` page size | Cloud truncates at default 50; missing issue types/fields | Loop pagination until exhausted | Projects with >50 issue types or fields per type |
| Re-fetching saved mapping on every keystroke in mapping panel | UI lag during edit | Load saved mapping once on panel open; cache in component state | Mapping with >20 rows |
| Re-resolving same source person on every preview | Slow person resolution + redundant API calls | Persistent SQLite cache `person_resolution` table with TTL + validity check | Org with repeated assignees across tickets (always — once user copies 5+ tickets) |
| Re-fetching component / version lists on every preview | Slow preview + spam to Cloud | TTL cache 24h; refresh button for forced reload | Projects with frequent version cuts (sprints) |
| ADF validation on each keystroke in description editor | UI lag while typing | Validate on blur or copy-button click, not per keystroke | Long descriptions (>1000 chars) |
| Snapshot test re-render of full mapping panel per test | Slow test suite | Test components in isolation, not full panel | Mapping panel grows past ~10 components |
| Audit log writes are synchronous in copy execution path | Slow copy when audit log is large | Async write via channel; copy doesn't wait for audit flush | Audit log >10k entries |
| Person picker pre-loads all users at app startup | Slow app startup; large memory use | Lazy-search only; MRU cache of recent picks | Org >1000 users |
| Schema cache without TTL | Stale schema persists indefinitely | TTL (1h) + manual refresh + drift detection | Long-running app sessions; schema admin changes |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Audit log records raw custom field values | PII / credential leak; GDPR concerns | Hash-based logging by default; opt-in verbose with redaction regex |
| Sanitizer only catches HTTP auth headers | Credentials in field values leak to audit log | Run regex over all logged strings (Bearer, Basic, JWT, AWS keys, Slack tokens, generic `secret/token/key/password`) |
| Schema cache writes person displayNames + emails | PII at rest in SQLite | Hash personal identifiers in cache; only store accountId for resolution |
| Person resolution cache exposes full user records | Internal user enumeration if SQLite DB is exfiltrated | Cache only `(source_email_hash, target_accountId, displayName_first_chars, ttl)` |
| Field values logged in error messages forwarded to frontend | Leak via Tauri IPC to webview | FrontendError enum (v0.1.0 pattern) — never forward raw error bodies containing field values |
| Translation layer audit logs include stack traces | Stack traces may include field values via panic context | Catch panics at translation boundary; log "translation failed for field X" without panic detail |
| Mapping config exported as JSON for backup | Saved mapping with default values may include sensitive defaults (e.g., default Sentry token) | Strip default values from export; export schema + mapping references only |
| `mypermissions` API response cached without TTL | Stale permission data; user appears to have access they revoked | Short TTL (15 min); check on each copy preview |
| Person search query logged verbatim | Search query may contain user emails (PII) | Hash query string in audit log; log only result count |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mapping panel collapses required-field warnings into one number | User can't tell which fields need attention | Highlight each unfilled required row inline + scroll to first unfilled on Copy click |
| Schema drift detected silently — only surfaces as 400 | User confused by Cloud error | Drift detected at preview open; banner with "Field X removed from target" + remediation buttons |
| Person picker shows just `displayName` for matches | Wrong user picked due to name collision | Show `displayName + emailDomain (if available) + accountId-suffix` |
| Issue-type fallback used silently | Tickets created with wrong type | Banner stays visible until user confirms type |
| "Override" vs "Saved" mapping tiers visually identical | User confused about which value will be used | Distinct visual treatment per tier + per-row "reset to saved" |
| First-time copy preview shows single spinner | Perceived freeze | Staged loading text: "Discovering target fields..." → "Resolving people..." → "Loading dropdowns..." |
| Required-field discovery failure silently degrades to no gating | User clicks Copy expecting protection; Cloud rejects | Hard error in panel; Copy disabled; retry button |
| Field labels appear untranslated in SK mode | "Translation missing" bug reports | Render admin-provided strings with visual marker + onboarding tooltip |
| Mapping panel re-renders aggressively on schema fetch | Form values lost; user re-fills | Stable form state; only field meta updates from schema refresh |
| No "test this mapping" affordance | User discovers bugs on first real copy | "Validate" button that submits a dry-run (`/issue?validateOnly=true` if Cloud supports) and surfaces 400s pre-flight |
| Saved mapping shows fields that no longer exist | Confusion about why Copy fails | Strike-through removed fields + "remove from mapping" button |
| Person picker shows deactivated users | User picks deactivated user; copy assigns to inactive | Filter `active: false` from picker results; cross-check at write time |
| Mapping panel scrolls to top on every render | User loses position while editing | Preserve scroll position; only scroll on explicit error focus |
| Type chooser hidden in side panel | User overlooks type — silent wrong-type copy | Type chooser is prominent at panel top, current value always visible |
| Per-copy override doesn't persist across "back" navigation | User loses 5 minutes of overrides on accidental back | Persist override draft to SQLite per source ticket; restore on re-open |

---

## "Looks Done But Isn't" Checklist

- [ ] **Person mapping**: Often missing privacy-mode handling — verify with mock returning users without `emailAddress`; ensure pre-fill still works via heuristic + disambiguation
- [ ] **Custom field write**: Often uses read shape for write — verify per-type with schema-specific tests (cascade, multi-checkbox, multi-user, group, version)
- [ ] **`createmeta` discovery**: Often misses required-but-not-on-create-screen fields — verify by intentionally configuring a project to have such a field; confirm post-failure required-field discovery loop fires
- [ ] **`createmeta` pagination**: Often returns first 50 issue types only — verify with mock returning 51 types; confirm all 51 appear
- [ ] **Issue type change**: Often doesn't re-evaluate required-field gate — verify changing type recomputes gate state and Copy button enable
- [ ] **Schema drift**: Often not detected until 400 error — verify with mock that removes a saved-mapping field; confirm drift banner appears at preview open
- [ ] **ADF mentions**: Often produces literal `[~user]` — verify destination shows resolved mention with correct user
- [ ] **ADF attachments**: Often produces broken refs — verify destination description shows attachments inline with target attachmentIds
- [ ] **ADF tables**: Often produces 400-rejected ADF — verify Cloud accepts and renders tables; ADF schema validator reports clean
- [ ] **Required-gating failure path**: Often degrades silently — verify mock 500 on createmeta → Copy stays disabled, retry visible
- [ ] **Person resolver cache**: Often persists stale `accountId` — verify deactivated user in cache → write-time check invalidates and re-resolves
- [ ] **Pipeline refactor**: Often regresses comment author attribution — verify mock copy with 3 comments from 3 different authors; assert all 3 authors correctly resolved
- [ ] **Pipeline refactor**: Often regresses sub-task copy (v0.1.0 COPY-05 pattern) — verify ticket with 2 sub-tasks copies sub-tasks with correct parent linkage
- [ ] **Pipeline refactor**: Often leaves `MYPROJ` hardcoding (v0.1.0 INT-02) — grep codebase for `MYPROJ` after refactor; should be zero matches outside test fixtures
- [ ] **Audit log**: Often leaks field values — feed test ticket with `Bearer ABC123` in custom field; verify audit output contains `[REDACTED:credential]`
- [ ] **i18n in mapping panel**: Often shows translated field names — switch to SK; verify field names unchanged, chrome translated
- [ ] **Override vs saved precedence**: Often muddles which wins — open mapping with override, change saved mapping in another window, copy; verify override still wins
- [ ] **Performance**: Often slow first-time preview — measure cold-start preview time with realistic schema (20+ fields); should be <3s with cache, <8s without
- [ ] **Snapshot test brittleness**: Often updated without review — verify CI does NOT auto-update snapshots; PR review required
- [ ] **Mock fidelity for custom fields**: Often only happy-path coverage — verify mock has fixture for every supported `schema.custom` type
- [ ] **Connection permission preflight**: Often skipped — verify `mypermissions` checked at preview open; missing perms surfaced in connection settings
- [ ] **Checkbox / traceability drift** (v0.1.0 + v0.3.0 systemic pattern): Often ROADMAP / REQUIREMENTS checkboxes drift from implementation — verify via milestone audit before completion

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Person identity translation broken | HIGH | Audit all person-field code paths; introduce normalized Person type; rewrite writers; ~2-3 days |
| Custom field writer asymmetry causes 400s | MEDIUM | Build `FieldType` enum + per-type Writer trait; migrate writers one type at a time; 2-3 days for full coverage |
| `createmeta` missing required fields | LOW | Add post-failure required-field discovery loop; parse 400 error body; ~4 hours |
| Stale saved mapping breaks copy | MEDIUM | Add schema drift detection at preview open; UI for remediation; ~1 day |
| Pipeline refactor regression (sub-tasks, attachments, comments) | HIGH | Add full-pipeline integration test as gating; refactor `CopyContext` seam; rerun all hardcoded paths through new context; 2-3 days |
| Audit log leaks credentials/PII | HIGH | Rotate any potentially-exposed credentials; scrub logs; redesign sanitizer with regex coverage; 1-2 days + audit + key rotation |
| ADF translation produces broken mentions/attachments | MEDIUM | Add post-pass to `htmltoadf` output; resolve mentions via person resolver; defer description writes until after attachment upload; 1-2 days |
| Cold-start preview slow | MEDIUM | Add caching layer + parallelization + pre-warming; ~1 day |
| Required-field discovery silent degradation | LOW | Convert state to enum (NotLoaded/Loading/Loaded/Error); UI handles each variant; ~4 hours |
| Person picker out-of-order results | LOW | Add AbortController to search; ~2 hours |
| Mock drift discovered post-release | MEDIUM | Capture sanitized real responses; replace fixtures; add contract tests; 1-3 days |
| Three-tier override/saved/default confusion | MEDIUM | Visual treatment per tier + per-row reset + audit-log provenance; ~1 day |
| Issue-type silent fallback | LOW | Add fallback config + persistent banner; ~4 hours |
| i18n field-label confusion | LOW | Visual marker + onboarding tooltip; ~2 hours |
| Permission lockout misdiagnosed as schema removal | MEDIUM | Add `GET /field` cross-reference + `mypermissions` preflight; ~1 day |

---

## Pitfall-to-Phase Mapping

Suggested phase structure (5-8 phases) based on pitfall coverage. Phases are ordered by dependency: each phase's deliverables unblock the next.

| Pitfall # | Pitfall | Prevention Phase | Verification |
|-----------|---------|------------------|--------------|
| 13 | Mock fidelity for custom field schemas | **Phase 0 — Mock Server Schema Fidelity** (precedes all) | Coverage matrix `schema.custom` × fixture; mock returns paginated createmeta, hidden emails, 429s, disabled allowedValues, hasDefaultValue |
| 1 | accountId vs name/key person identity | **Phase 1 — Schema Discovery & Translation Layer** | Per-person-field-type test confirms write-shape uses `accountId` only; failed resolution blocks copy |
| 3 | createmeta show-all + pagination + edit-only fields | **Phase 1** | Discovery returns union of createmeta + editmeta; pagination loop covers >50 issue types; post-failure required-field loop |
| 4 | Custom field reader/writer asymmetry | **Phase 2 — v2→v3 Translation Layer** | FieldType enum with per-type Reader/Writer traits; snapshot test per `schema.custom` variant |
| 5 | ADF translation gaps | **Phase 2** + **Phase 5** (attachment ordering) | Post-pass over htmltoadf output resolves mentions/links; ADF schema validator runs pre-submit; description writes happen after attachment upload |
| 18 | Field permission variance + missing-field disambiguation | **Phase 1** + connection settings extension | `GET /field` cross-reference for missing fields; `mypermissions` preflight at preview open |
| 2 | Cloud privacy hides emailAddress | **Phase 3 — Person Picker & Identity Resolution** | Mock with hidden emails → pre-fill works via single-result heuristic; disambiguation UI for ambiguous matches |
| 11 | Person search at scale + stale cache | **Phase 3** | AbortController on search input; MRU cache; cached accountId validity check at write time |
| 6 | Required-field re-eval on issue type change | **Phase 4 — Mapping UI & Required Gating** | Type change triggers schema re-fetch; gate recomputes; Copy disabled until new schema arrives |
| 7 | Saved mapping schema drift | **Phase 4** + **Phase 1** for schema hash | Drift banner at preview open; per-row remove-stale; `mapping_schema_version` bumps on edit |
| 12 | i18n + admin-provided field names | **Phase 4** | Visual marker on admin strings; switch SK ↔ EN with mapping panel open — field names unchanged |
| 14 | Snapshot testing dynamic forms | **Phase 4** (testing strategy) | Behavioral tests per control type; no full-panel snapshots; no auto-update in CI |
| 15 | Required-field discovery silent degradation | **Phase 4** | RequiredFields enum (NotLoaded/Loading/Loaded/Error); Copy disabled on Error/NotLoaded; retry button |
| 16 | Override vs saved vs default precedence | **Phase 4** | Visual distinction per tier; reset-to-saved per row; audit log provenance |
| 17 | Issue type silent fallback | **Phase 4** | Configurable fallback; persistent banner until user confirms |
| 8 | Pipeline refactor regression | **Phase 5 — Copy Pipeline Refactor** | `CopyContext` seam; full-pipeline integration test (attachments + comments + worklogs + sub-tasks + origin link) |
| 9 | Cold-start preview slow | **Phase 6 — Performance & Caching** | Preview <3s with cache, <8s cold; staged loading UX; parallelized discovery |
| 10 | Audit log PII / credential leak | **Phase 7 — Audit Logging & Observability** | Hash-based default; opt-in verbose with regex sanitizer; CI test for credential patterns |

---

## Sources

- Atlassian REST API v2 (Server) — `/rest/api/2/issue`, `/rest/api/2/issue/createmeta`, `/rest/api/2/user/search` — HIGH confidence
- Atlassian REST API v3 (Cloud) — `/rest/api/3/issue`, `/rest/api/3/issue/createmeta/{key}/issuetypes`, `/rest/api/3/user/search`, `/rest/api/3/field`, `/rest/api/3/mypermissions` — HIGH confidence
- [Atlassian Cloud GDPR migration: name → accountId deprecation](https://developer.atlassian.com/cloud/jira/platform/deprecation-notice-user-privacy-api-migration-guide/) — HIGH confidence
- [Atlassian Document Format (ADF) spec](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) — HIGH confidence
- [Atlassian custom field type catalog (`schema.custom` strings)](https://developer.atlassian.com/cloud/jira/platform/jira-expressions-type-reference/) — HIGH confidence
- [Cloud createmeta deprecation + new paginated endpoints (2023)](https://developer.atlassian.com/cloud/jira/platform/changelog/) — MEDIUM confidence
- [Cloud rate limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/) — HIGH confidence (carried forward from v0.3.0 research)
- [Jira Cloud user privacy controls](https://confluence.atlassian.com/cloud/blog/2018/12/atlassian-account-changes-and-deprecation-notice) — HIGH confidence
- `htmltoadf` npm package — README documents coverage gaps for tables/macros — MEDIUM confidence (project uses this library; gaps observed empirically in v0.1.0)
- `@atlaskit/adf-schema` — public ADF JSON schema for validation — HIGH confidence
- v0.1.0 RETROSPECTIVE.md: "Hardcoded `MYPROJ` survived through Phases 4-5", "checkbox drift", "COPY-05 sub-task gap caught and closed" — HIGH confidence (project history)
- v0.3.0 RETROSPECTIVE.md: "checkbox drift is systemic", parallel phase execution off Phase 13 — HIGH confidence
- v0.3.0 PITFALLS.md: Cloud Bearer vs Server Basic auth, accountId privacy, Server JQL timezone, attachment auth — HIGH confidence (carried forward, still applicable to v0.4.0)
- v0.1.0 MILESTONE-AUDIT INT-02: hardcoded `MYPROJ` cloud project key — HIGH confidence
- Atlassian developer community: "Operation value must be ..." 400 error patterns for custom fields — MEDIUM confidence
- Atlassian community: deactivated user `accountId` behavior — MEDIUM confidence
- Tauri 2.10 IPC error handling pattern (FrontendError enum) — established in v0.1.0 — HIGH confidence

---
*Pitfalls research for: Pmkar — v0.4.0 Configurable Field Mapping (Jira Server v2 → Jira Cloud v3)*
*Researched: 2026-04-27*
