# Phase 18: v2→v3 Translation Layer - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure Rust transformer pipeline (`src-tauri/src/field_transform/`) that converts a source v2 issue + a saved mapping into a v3-shaped POST body. Covers: user identity resolution (Server `name`/`key` → Cloud `accountId`), version/component name→ID lookups, wiki markup→ADF with documented gap-fills, and batched HTTP to avoid N×M round trips.

**In scope:**
- `src-tauri/src/field_transform/` submodule: `mod.rs`, `user.rs`, `version.rs`, `component.rs`, `wiki_to_adf.rs`, `identity.rs`, `pipeline.rs`
- `apply_mapping(source_issue, mapping, schema) -> ResolvedFields` pipeline function
- Typed gap variants: `UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent` in `ResolvedFields`
- ADF post-processor: mention resolution (`[~jdoe]` → Cloud `mention` node), unsupported-macro placeholder
- Batched user lookup (TRAN-06): single HTTP pass per email domain for all person fields + description mentions
- In-memory session cache for version/component name→ID maps
- Round-trip integration tests for ≥4 custom-field types against Phase 17 mock fixtures

**Out of scope (later phases):**
- Frontend wiring + `copy_ticket_v2` Tauri command (Phase 23)
- Person picker UI showing typed gap variants (Phase 22)
- Required-field gating UI (Phase 22)
- Image attachment upload + URL rewriting — stays in existing `copy_ticket` until Phase 23 cutover
- Mapping persistence / CRUD Tauri commands (Phase 19)
- Renderer registry (Phase 20)

</domain>

<decisions>
## Implementation Decisions

### User Resolution Failure Mode
- **D-01:** When `user.rs` cannot resolve a source `name`/`key` to a Cloud `accountId`, the pipeline emits a typed `UnresolvedPerson` variant inside `ResolvedFields` — not `Err`. `apply_mapping` completes successfully; Phase 22's required-field gating reads the variant as an unfilled slot and blocks the Copy button.
- **D-02:** `UnresolvedPerson` carries the full source identity payload: `{ source_username, source_key, source_email }`. Phase 22's person picker uses this to pre-fill the search field and display "Could not auto-match — please search manually" with the source name visible.
- **D-03:** For `Array<User>` fields (multi-user pickers): partial resolution. The pipeline emits the resolved `accountId`s plus one `UnresolvedPerson` entry per unresolved user. The whole field is NOT failed — Phase 22 renders resolved users normally and shows a "pick manually" slot for each gap.

### ADF Mention Resolution
- **D-04:** The ADF post-processor resolves `[~jdoe]` wiki mention patterns to real Cloud `mention` ADF nodes: `{ type: "mention", attrs: { id: "<accountId>" } }`. Not plain text — Phase 18 produces correct Cloud ADF.
- **D-05:** If a specific mention user cannot be resolved to a Cloud `accountId`, that mention degrades to plain text `@jdoe` — not a pipeline error and not an `UnresolvedPerson` variant. Description-body mentions are best-effort; person-field assignments are hard requirements.
- **D-06:** Before assembling the user batch (TRAN-06 batched pass), the pipeline pre-scans the source description (HTML/wiki) for `[~username]` patterns. Those users are added to the batch alongside `assignee`, `reporter`, and custom user fields. One HTTP pass covers all unique users regardless of where they appear.

### Unsupported Wiki Node Gap-Fills
- **D-07:** Unhandled wiki macros (`{toc}`, `{page-break}`, `{anchor}`, unknown/custom macros) that `htmltoadf` cannot translate emit an annotated placeholder paragraph in the ADF output: `[Not converted: {original markup}]`. Matches the "no lost detail" core value — user sees the gap in the Cloud ticket and can fill it manually.
- **D-08:** Image URL rewriting (Server attachment URLs → Cloud URLs) is **not** Phase 18's responsibility. Phase 18's pipeline receives pre-processed HTML (already rewritten by the existing `copy_ticket` logic) and translates content only. This separation is maintained until Phase 23 cutover.

### Version/Component Lookup Caching
- **D-09:** In-memory `HashMap` per app session. On first copy that needs version/component resolution for a given project key, the pipeline fetches `/rest/api/3/project/{key}/versions` and `/rest/api/3/project/{key}/components` once and stores the results. Subsequent copies in the same session reuse the cached list. App exit clears the cache. Mirrors Phase 17's session-bound schema cache pattern (Phase 17 D-02).
- **D-10:** If a source version name or component name cannot be matched to a target Cloud ID (version/component doesn't exist on the target project), the pipeline emits a typed `UnresolvedVersion` or `UnresolvedComponent` variant in `ResolvedFields`. Same required-field gating pattern as `UnresolvedPerson`. Phase 22 shows a dropdown picker to let the user select the correct target version/component.

### Claude's Discretion
- Exact Rust enum/struct shapes for `ResolvedFields`, `UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent`
- Whether the three `Unresolved*` variants implement a common trait or are independent types
- Async boundary design: `apply_mapping` is likely `async fn` since it performs HTTP (batch user lookup, version/component fetch). Internal sync helpers where no I/O is needed.
- Exact regex/parser for `[~username]` detection in wiki markup pre-scan
- Hash key shape for the in-memory version/component cache (e.g., `HashMap<String, Vec<VersionInfo>>` keyed by project_key)
- Error type for internal pipeline errors (distinct from typed gap variants — infrastructure failures vs expected gaps)
- Exact pagination strategy for `/project/{key}/versions` if a project has many versions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context (always)
- `.planning/PROJECT.md` — Project vision, constraints. Key decisions: "block copy on unmapped required target fields", "person picker always visible", "one-time copy with origin tracking"
- `.planning/REQUIREMENTS.md` — v0.4.0 acceptance criteria. Phase 18 covers TRAN-01, TRAN-02, TRAN-03, TRAN-04, TRAN-05, TRAN-06.
- `.planning/ROADMAP.md` §"Phase 18: v2→v3 Translation Layer" — Goal, dependencies, success criteria, phase boundary

### v0.4.0 milestone research
- `.planning/research/PITFALLS.md` — All 18 documented pitfalls. Phase 18 specifically avoids:
  - Pitfall 1 (accountId vs name passthrough) — the `UnresolvedPerson` pattern is the fix
  - Pitfall 4 (custom field read/write asymmetry) — pipeline uses write-shape for POST, never read-shape
  - Pitfall 5 (ADF mention resolution) — D-04 resolves to real mention nodes
  - Pitfall 9 (version/component name vs ID) — D-09/D-10 handle this
- `.planning/research/ARCHITECTURE.md` — Concrete module layout for `field_transform/`, `pipeline.rs` signature, `apply_mapping` contract, command placement in `commands.rs`
- `.planning/research/STACK.md` — Stack additions for v0.4.0; `htmltoadf 0.1.12` already in prod, used at `commands.rs:1656` and `:1974`

### Phase 17 (dependency)
- `.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md` — Phase 17 decisions that Phase 18 consumes: `FieldSchema` types, `field_schema_cache` in `mapping.db`, mock fixtures (D-09 through D-12), `FieldSide` enum
- `.planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md` — Phase 17 research including mock fixture shapes

### Existing code (patterns to follow)
- `src-tauri/src/field_discovery.rs` — `FieldSchema`, `FieldSchemaType`, `FieldSide` types produced by Phase 17. Pipeline consumes these.
- `src-tauri/src/field_mapping_db.rs` — `mapping.db` opened by Phase 17; Phase 18 reads field schema cache from it.
- `src-tauri/src/commands.rs:1656` and `:1974` — existing `htmltoadf::convert_html_str_to_adf_str` usage; `wiki_to_adf.rs` wraps this call and adds the post-processor
- `src-tauri/src/commands.rs:1075-1121` — Phase 16 user search (`search_jira_users`, `search_jira_users_by_domain`). `user.rs` reuses the Cloud v3 domain search command for the batch lookup pass.
- `src-tauri/src/jira_client.rs` — HTTP client pattern; `field_transform/` fetchers follow the same audited reqwest pattern

### External (Atlassian docs)
- Jira Cloud REST API v3 `user/search` — batch user resolution endpoint used by `user.rs`
- Jira Cloud REST API v3 `project/{key}/versions` and `/components` — used by `version.rs` and `component.rs`
- Atlassian Document Format `mention` node spec — `{ type: "mention", attrs: { id: accountId, text: "@displayName" } }`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`htmltoadf::convert_html_str_to_adf_str`** (commands.rs:1656, :1974): Already in production. `wiki_to_adf.rs` wraps this call; the Phase 18 post-processor runs after it to handle gaps (mentions, unsupported macros).
- **Phase 16 user search** (commands.rs:1075-1121): `search_jira_users_by_domain` hits `/rest/api/3/user/search?query=<email>`. `user.rs` reuses this HTTP pattern for the batch lookup. Already handles privacy-mode response shapes (Phase 16 D-01: single-user result = high-confidence email match).
- **Audit middleware** (jira_client.rs): Every reqwest call in `field_transform/` inherits audit logging + credential redaction via the existing `ClientWithMiddleware` wrapper.
- **`FieldSchema` / `FieldSchemaType`** (field_discovery.rs): Phase 17 types directly consumed by `pipeline.rs` to route each field to the correct transformer (`user.rs` for `User`/`Array<user>`, `version.rs` for `Array<version>`, etc.).

### Established Patterns
- **Typed gap variants over pipeline `Err`**: Phase 18 introduces `UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent` as typed members of `ResolvedFields`. These are expected outcomes, not errors — they flow to Phase 22's required-field gating rather than aborting the pipeline.
- **Session-bound in-memory cache**: `mapping.db`'s `field_schema_cache` table (Phase 17) holds the per-session schema. Version/component name→ID maps follow the same session-scoped pattern but live in `HashMap`s (not SQLite) since they don't need to persist.
- **Partial array resolution**: When resolving `Array<User>` fields, resolved entries are emitted normally and unresolved entries become `UnresolvedPerson` items. The array is never failed wholesale for a single gap.

### Integration Points
- **`pipeline.rs` `apply_mapping`**: The entry point that Phase 23 calls from `copy_ticket_v2`. It takes `(source_issue: &Value, mapping: &[FieldMappingRow], schema: &FieldSchemaCache)` and returns `ResolvedFields`. Phase 23 wires the return value into the v3 POST body.
- **`mapping.db`**: Phase 18 reads `field_schema_cache` (schema written by Phase 17). Does NOT write new tables — Phase 19 adds `field_mapping` and `mapping_meta`.
- **Mock server** (`mock_server.rs`): Phase 17 added fixtures for 5 custom field types + v2/v3 shape divergence (D-09 through D-12). Phase 18 integration tests run against these fixtures — no mock changes needed.
- **`commands.rs`**: Phase 18 does NOT add Tauri commands. The pipeline is pure Rust, tested via `#[cfg(test)]` integration tests. Phase 23 adds `copy_ticket_v2` command and wires the frontend.

</code_context>

<specifics>
## Specific Ideas

- **Consistent gap-variant pattern**: All three unresolvable-entity types (`UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent`) follow the same design — typed, carry source identity, flow to Phase 22's required-field gating. This makes Phase 22 implementation uniform: one pattern handles all gap types.
- **Mention users in the batch**: Pre-scanning the description for `[~username]` before assembling the user batch keeps TRAN-06's "single batched lookup pass" strictly true even when descriptions contain mentions. The batch assembler collects from all sources (fields + body) before making any HTTP call.
- **Plain text fallback only for description mentions**: The asymmetry is intentional — `[~jdoe]` in a description degrades gracefully to `@jdoe` text if unresolved, but `assignee: jdoe` in a field emits `UnresolvedPerson` and blocks the copy. Description is informational; person fields are structural.
- **Annotated placeholder for unsupported macros**: `[Not converted: {toc}]` matches the "no lost detail" core value. Users who have detailed Confluence-style wiki pages in their Jira descriptions will see exactly what wasn't translated, rather than silently missing content.

</specifics>

<deferred>
## Deferred Ideas

- **Tauri command exposure in Phase 18**: Phase 18 builds the pure Rust `field_transform/` module + integration tests only. No Tauri command is added. `copy_ticket_v2` is Phase 23's command to add.
- **mediaSingle ADF node for uploaded images**: Image URL rewriting (Server attachment URLs → Cloud URLs) stays in existing `copy_ticket` until Phase 23. Phase 18's pipeline takes pre-processed HTML.
- **Person resolution SQLite cache** (PITFALLS.md Pitfall 2 suggestion): A `person_resolution` SQLite table with TTL was mentioned as a future optimization. Deferred — in-session memory is sufficient for Phase 18. Phase 22 can add persistence if repeated copy sessions reveal pain.
- **`{info}` / `{note}` / `{warning}` content extraction**: These Confluence-style macros contain rich text inside. Phase 18's post-processor emits `[Not converted: {note}]` for the whole block. If preserving the inner text becomes important, a macro-body extractor could be added in a future phase.

</deferred>

---

*Phase: 18-v2-v3-translation-layer*
*Context gathered: 2026-04-27*
