# Phase 18: v2→v3 Translation Layer - Research

**Researched:** 2026-04-27
**Domain:** Pure Rust transformer pipeline — Jira Server v2 issue → Jira Cloud v3 POST body. User identity resolution, version/component name→ID lookups, wiki→ADF with mention resolution, batched HTTP.
**Confidence:** HIGH — codebase directly inspected; Phase 17 types verified in source; Atlassian API behaviour verified via official docs and pitfalls research; all patterns have direct code precedent in the project.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**User Resolution Failure Mode**
- **D-01:** When `user.rs` cannot resolve a source `name`/`key` to a Cloud `accountId`, the pipeline emits a typed `UnresolvedPerson` variant inside `ResolvedFields` — not `Err`. `apply_mapping` completes successfully; Phase 22's required-field gating reads the variant as an unfilled slot and blocks the Copy button.
- **D-02:** `UnresolvedPerson` carries the full source identity payload: `{ source_username, source_key, source_email }`. Phase 22's person picker uses this to pre-fill the search field.
- **D-03:** For `Array<User>` fields (multi-user pickers): partial resolution. The pipeline emits the resolved `accountId`s plus one `UnresolvedPerson` entry per unresolved user. The whole field is NOT failed.

**ADF Mention Resolution**
- **D-04:** The ADF post-processor resolves `[~jdoe]` wiki mention patterns to real Cloud `mention` ADF nodes: `{ type: "mention", attrs: { id: "<accountId>" } }`. Not plain text — Phase 18 produces correct Cloud ADF.
- **D-05:** If a specific mention user cannot be resolved to a Cloud `accountId`, that mention degrades to plain text `@jdoe` — not a pipeline error and not an `UnresolvedPerson` variant.
- **D-06:** Before assembling the user batch (TRAN-06), the pipeline pre-scans the source description (HTML/wiki) for `[~username]` patterns. Those users are added to the batch alongside `assignee`, `reporter`, and custom user fields. One HTTP pass covers all unique users regardless of where they appear.

**Unsupported Wiki Node Gap-Fills**
- **D-07:** Unhandled wiki macros (`{toc}`, `{page-break}`, `{anchor}`, unknown/custom macros) emit an annotated placeholder paragraph: `[Not converted: {original markup}]`.
- **D-08:** Image URL rewriting (Server attachment URLs → Cloud URLs) is NOT Phase 18's responsibility. Phase 18's pipeline receives pre-processed HTML.

**Version/Component Lookup Caching**
- **D-09:** In-memory `HashMap` per app session. On first copy needing resolution for a given project key, the pipeline fetches `/rest/api/3/project/{key}/versions` and `/rest/api/3/project/{key}/components` once and stores the results. App exit clears the cache.
- **D-10:** If a source version name or component name cannot be matched to a target Cloud ID, the pipeline emits a typed `UnresolvedVersion` or `UnresolvedComponent` variant in `ResolvedFields`.

### Claude's Discretion
- Exact Rust enum/struct shapes for `ResolvedFields`, `UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent`
- Whether the three `Unresolved*` variants implement a common trait or are independent types
- Async boundary design: `apply_mapping` is likely `async fn` since it performs HTTP
- Exact regex/parser for `[~username]` detection in wiki markup pre-scan
- Hash key shape for the in-memory version/component cache (e.g., `HashMap<String, Vec<VersionInfo>>` keyed by project_key)
- Error type for internal pipeline errors (distinct from typed gap variants)
- Exact pagination strategy for `/project/{key}/versions` if a project has many versions

### Deferred Ideas (OUT OF SCOPE)
- Tauri command exposure in Phase 18 — `copy_ticket_v2` is Phase 23
- mediaSingle ADF node for uploaded images — stays in existing `copy_ticket` until Phase 23
- Person resolution SQLite cache — in-session memory is sufficient for Phase 18
- `{info}` / `{note}` / `{warning}` content extraction — emit `[Not converted: ...]` for whole block
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAN-01 | System translates source user values (Server `name`/`key`) to target Cloud `accountId` for person fields | §User Resolution Pattern; §Batch User Lookup (TRAN-06); §`user.rs` Design; §Pitfalls 1+2 |
| TRAN-02 | System translates wiki markup to ADF for text and multi-line text fields | §Wiki→ADF Pipeline; §`wiki_to_adf.rs` + post-processor; §htmltoadf gap-fills |
| TRAN-03 | System translates source version names to target Cloud version IDs by name lookup | §`version.rs` Design; §Version/Component Caching (D-09/D-10) |
| TRAN-04 | System translates source component names to target Cloud component IDs by name lookup | §`component.rs` Design; §Version/Component Caching (D-09/D-10) |
| TRAN-05 | System fills documented htmltoadf coverage gaps (links, blockquotes, mentions, hard-break, mediaSingle) | §htmltoadf Gap Analysis; §ADF Post-Processor; §Mention Resolution (D-04/D-05/D-06) |
| TRAN-06 | System batches user lookups in a single pass to avoid N×M HTTP calls during a copy | §Batch User Lookup Pass; §Pre-scan Pattern; §`pipeline.rs` Two-Phase Design |
</phase_requirements>

---

## Summary

Phase 18 builds the pure Rust `field_transform/` submodule — a pipeline that converts a source Jira Server v2 issue + a saved field mapping into a v3-shaped POST body. It is consumed by Phase 23's `copy_ticket_v2` command and depends entirely on Phase 17's `FieldSchema` types and `field_schema_cache` in `mapping.db`.

The module consists of six files: `mod.rs` (Transformer trait + re-exports), `pipeline.rs` (`apply_mapping` entry point), `user.rs` (username→accountId via Cloud user search), `version.rs` (name→ID via project versions endpoint), `component.rs` (name→ID via project components endpoint), `wiki_to_adf.rs` (htmltoadf wrapper + ADF post-processor), and `identity.rs` (passthrough for symmetric field types). Phase 18 does NOT add any Tauri commands — the pipeline is pure Rust tested via `#[cfg(test)]` integration tests using Phase 17's mock fixtures.

The two hardest implementation problems are: (1) the batched user lookup — the pipeline must pre-scan the entire source issue (all person fields + description body) before issuing any HTTP call, collecting unique usernames, then resolving them in one domain-search pass and populating an in-memory map that individual transformers consume; (2) the ADF post-processor — `htmltoadf::convert_html_str_to_adf_str` produces structurally valid ADF but leaves mention patterns as literal text and may drop links/blockquotes. A second pass over the ADF JSON tree must resolve `[~username]` patterns to Cloud `mention` nodes and inject `link` marks for `<a>` tags the converter dropped.

**Primary recommendation:** Implement `apply_mapping` as a two-phase async function: phase 1 collects all unique source user identifiers (fields + description body scan), executes one domain-search HTTP call per unique domain, and builds a resolution map; phase 2 walks each mapping row, dispatches the matching transformer (sync except for the user transformer which reads the pre-built map), and assembles the target fields object. Typed gap variants (`UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent`) are members of `ResolvedFields` — not `Err` values — so the pipeline always completes and Phase 22 can display resolution UI.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field type routing (which transformer handles which schema type) | API / Backend (`pipeline.rs`) | — | Pure Rust dispatch on `FieldSchemaType` enum from Phase 17; no frontend involvement |
| User identity resolution (Server name/key → Cloud accountId) | API / Backend (`user.rs`) | In-memory batch map | HTTP call to Cloud `/user/search`; all user refs collected before any HTTP fires (TRAN-06) |
| Version name→ID lookup | API / Backend (`version.rs`) | In-memory session cache | HTTP to `/project/{key}/versions`; cached per project_key for session duration (D-09) |
| Component name→ID lookup | API / Backend (`component.rs`) | In-memory session cache | HTTP to `/project/{key}/components`; cached per project_key for session duration (D-09) |
| Wiki markup → ADF conversion | API / Backend (`wiki_to_adf.rs`) | — | Wraps `htmltoadf::convert_html_str_to_adf_str` (already in prod at commands.rs:1656, :1974) |
| ADF post-processing (mention resolution, gap-fill placeholders) | API / Backend (`wiki_to_adf.rs` post-processor) | — | Requires the user resolution map from the batch pass (D-04/D-06) |
| Typed gap variant collection | API / Backend (`pipeline.rs` → `ResolvedFields`) | Frontend (Phase 22) | Phase 18 only produces the variants; Phase 22 renders them as required-field gating UI |
| Passthrough transforms (text, labels, dates, numbers) | API / Backend (`identity.rs`) | — | Symmetric field types; no HTTP; pure value mapping |
| Integration tests | API / Backend (`#[cfg(test)]` in pipeline.rs + per-module) | Mock server (Phase 17 fixtures) | No Tauri commands in Phase 18; tests call `apply_mapping` directly against mock fixtures |

---

## Standard Stack

### Core (all already in Cargo.toml — no new dependencies for Phase 18)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `serde` + `serde_json` | 1.x | Deserializing source v2 issue JSON; building target v3 POST body as `serde_json::Value` / `Map<String, Value>` | Whole codebase [VERIFIED: Cargo.toml] |
| `reqwest` | 0.13 | HTTP calls to Cloud `/user/search`, `/project/{key}/versions`, `/project/{key}/components` | Already the HTTP client for all Jira calls [VERIFIED: Cargo.toml] |
| `async-trait` | 0.1 | `Transformer` trait with `async fn transform(...)` | Already a dep; used for async trait objects [VERIFIED: Cargo.toml] |
| `htmltoadf` | 0.1.12 | `convert_html_str_to_adf_str` — the existing wiki→ADF converter already in production | Two call sites at commands.rs:1656 and :1974 [VERIFIED: grep] |
| `tokio` | 1.x | Async runtime for `apply_mapping` and all HTTP futures | Already the runtime [VERIFIED: Cargo.toml] |
| `base64` | 0.22 | Basic auth header construction for Cloud API calls | Same pattern as search_jira_users_by_domain at commands.rs:1111 [VERIFIED: source] |
| `urlencoding` | 2.x | URL-encoding project keys in version/component endpoint paths | Already used in field_discovery.rs [VERIFIED: source] |
| `regex` | 1.x | `[~username]` pattern detection in description pre-scan (D-06) | **NOT currently in Cargo.toml** — see installation note below |

### Regex Dependency Note

The `[~username]` pre-scan (D-06) requires a regex. The project does not currently have `regex` as a direct dependency. Options:
1. Add `regex = "1"` (the standard choice, ~500 KB compiled, fast, lazy_static-friendly). [ASSUMED — not verified via Cargo.toml search whether `regex` is a transitive dep]
2. Hand-write a manual scan with `str::find` and byte-level parsing — viable for the simple `[~<alphanum>]` pattern; avoids a new dep.

**Recommendation (Claude's discretion):** Hand-write the scan with a simple state-machine approach. The `[~username]` pattern is: `[~` followed by alphanumerics/underscores/dots/hyphens followed by `]`. A 20-line iterator over bytes is sufficient and avoids adding `regex` as a new dependency for a single call site.

**Installation (if regex added):**
```bash
# Only needed if regex approach chosen over hand-written scanner
# No frontend changes needed
```
Cargo.toml addition:
```toml
regex = "1"
```

### New Files (Rust only)

| File | Purpose |
|------|---------|
| `src-tauri/src/field_transform/mod.rs` | `pub use` re-exports; `Transformer` trait; `TransformContext` struct; `TransformError` enum |
| `src-tauri/src/field_transform/pipeline.rs` | `apply_mapping(source_issue, mapping, ctx) -> ResolvedFields`; two-phase async fn |
| `src-tauri/src/field_transform/user.rs` | Batch user resolution: email/username → accountId via Cloud `/user/search` |
| `src-tauri/src/field_transform/version.rs` | Version name → target ID via `/project/{key}/versions` with session cache |
| `src-tauri/src/field_transform/component.rs` | Component name → target ID via `/project/{key}/components` with session cache |
| `src-tauri/src/field_transform/wiki_to_adf.rs` | Wraps `htmltoadf` + post-processor (mention resolution, gap-fill placeholders) |
| `src-tauri/src/field_transform/identity.rs` | Passthrough for text, labels, dates, numbers, priority (when IDs match) |

### Modified Files (Rust)

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Add `pub mod field_transform;` |

**No commands.rs changes in Phase 18.** No Tauri commands are added. Phase 23 adds `copy_ticket_v2`.

---

## Architecture Patterns

### System Architecture Diagram

```
Source v2 Issue JSON
        │
        ▼
[Phase 18: apply_mapping]
        │
        ├── PHASE 1: User Batch Collection
        │     ├── Walk person fields (assignee, reporter, Array<User> custom fields)
        │     ├── Pre-scan description body for [~username] patterns (D-06)
        │     └── Build unique username set → HTTP to Cloud /user/search → accountId map
        │
        └── PHASE 2: Per-field transform dispatch
              │
              ├── FieldSchemaType::User / Array{items:"user"} → user.rs
              │     ├── resolved  → accountId in output
              │     └── unresolved → UnresolvedPerson in ResolvedFields.gaps
              │
              ├── FieldSchemaType::Array{items:"version"} → version.rs
              │     ├── name match → version ID in output
              │     └── no match  → UnresolvedVersion in ResolvedFields.gaps
              │
              ├── FieldSchemaType::Array{items:"component"} → component.rs
              │     ├── name match → component ID in output
              │     └── no match  → UnresolvedComponent in ResolvedFields.gaps
              │
              ├── FieldSchemaType::String{system:"description"} → wiki_to_adf.rs
              │     ├── htmltoadf::convert_html_str_to_adf_str(html)
              │     └── ADF post-processor:
              │           ├── Walk ADF tree for text nodes matching [~username]
              │           ├── resolved   → mention node {type:"mention",attrs:{id:accountId}}
              │           ├── unresolved → plain text "@username"
              │           └── Unsupported macro text → [Not converted: {macro}]
              │
              └── All other types → identity.rs (passthrough / symmetric)

        ▼
ResolvedFields {
    fields: Map<String, Value>,  // ready for Cloud POST /issue
    gaps:   Vec<GapVariant>,     // UnresolvedPerson | UnresolvedVersion | UnresolvedComponent
}
```

### Recommended Project Structure

```
src-tauri/src/
├── field_transform/
│   ├── mod.rs           # Transformer trait, TransformContext, TransformError, ResolvedFields
│   ├── pipeline.rs      # apply_mapping (entry point, two-phase async)
│   ├── user.rs          # UserResolver: batch HTTP + accountId map
│   ├── version.rs       # VersionResolver: name→ID with in-memory session cache
│   ├── component.rs     # ComponentResolver: name→ID with in-memory session cache
│   ├── wiki_to_adf.rs   # htmltoadf wrapper + ADF post-processor
│   └── identity.rs      # passthrough for symmetric field types
├── field_discovery.rs   # [Phase 17 — types consumed here]
├── field_mapping_db.rs  # [Phase 17 — mapping.db, field_schema_cache table]
└── commands.rs          # [unchanged in Phase 18]
```

### Pattern 1: Two-Phase apply_mapping

**What:** `apply_mapping` runs in two phases. Phase 1 collects all unique user references (person fields + description body scan) and resolves them in one HTTP batch. Phase 2 walks mapping rows and dispatches transformers, all consuming the pre-built resolution maps.

**When to use:** Always — this is the `apply_mapping` entry point that Phase 23 calls.

**Example:**
```rust
// Source: ARCHITECTURE.md Pattern 4 (pipeline pattern)
// field_transform/pipeline.rs

pub async fn apply_mapping(
    source_issue: &Value,
    mapping: &[FieldMappingRow],
    ctx: &TransformContext<'_>,
) -> ResolvedFields {
    // PHASE 1: batch collect + resolve users
    let user_map = ctx
        .user_resolver
        .resolve_batch(source_issue, mapping)
        .await;  // single HTTP pass per domain

    let mut fields = Map::new();
    let mut gaps: Vec<GapVariant> = Vec::new();

    // PHASE 2: per-row transform
    for row in mapping {
        let src_val = source_issue
            .pointer(&format!("/fields/{}", row.source_field_id))
            .unwrap_or(&Value::Null);

        match dispatch_transform(row, src_val, &user_map, ctx).await {
            DispatchResult::Ok(v)              => { fields.insert(row.target_field_id.clone(), v); }
            DispatchResult::Gap(g)             => gaps.push(g),
            DispatchResult::Skip               => {}  // unresolvable non-required field
        }
    }

    ResolvedFields { fields, gaps }
}
```

### Pattern 2: Typed Gap Variants Over Pipeline Error

**What:** `UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent` are members of `ResolvedFields.gaps` — NOT `Err` values. `apply_mapping` always returns `ResolvedFields`, never `Err` for business-logic failures.

**When to use:** Any time a transformer cannot resolve a field value but the pipeline should continue (TRAN-01, TRAN-03, TRAN-04, D-01, D-10).

**Example:**
```rust
// field_transform/mod.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnresolvedPerson {
    pub target_field_id: String,
    pub source_username: Option<String>,
    pub source_key: Option<String>,
    pub source_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnresolvedVersion {
    pub target_field_id: String,
    pub source_name: String,
    pub target_project_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnresolvedComponent {
    pub target_field_id: String,
    pub source_name: String,
    pub target_project_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum GapVariant {
    Person(UnresolvedPerson),
    Version(UnresolvedVersion),
    Component(UnresolvedComponent),
}

pub struct ResolvedFields {
    /// The Cloud-ready `fields` map, ready to embed in POST /rest/api/3/issue body.
    pub fields: serde_json::Map<String, Value>,
    /// Typed gaps — Phase 22 reads these for required-field gating UI.
    pub gaps: Vec<GapVariant>,
}
```

### Pattern 3: Batch User Lookup (TRAN-06)

**What:** Before any HTTP call, the pipeline pre-scans the source issue for ALL user references and description mentions. Unique source usernames are resolved in one HTTP pass (one `search_jira_users_by_domain` call per unique email domain).

**When to use:** Phase 1 of `apply_mapping` — always runs before individual field transformers.

**Example:**
```rust
// field_transform/user.rs
impl UserResolver {
    /// Pre-scans all person fields + description for [~username] patterns.
    /// Returns HashMap<source_username, Option<accountId>>.
    pub async fn resolve_batch(
        &self,
        source_issue: &Value,
        mapping: &[FieldMappingRow],
    ) -> HashMap<String, Option<String>> {
        let mut unique_usernames: HashSet<String> = HashSet::new();

        // 1. Collect from person-typed mapping rows
        for row in mapping {
            if is_user_field(&row.source_schema) {
                collect_usernames_from_field(
                    source_issue, &row.source_field_id, &mut unique_usernames
                );
            }
        }

        // 2. Pre-scan description for [~username] patterns (D-06)
        if let Some(html_desc) = extract_description_html(source_issue) {
            scan_mention_patterns(&html_desc, &mut unique_usernames);
        }

        // 3. One HTTP call per unique domain (reuses search_jira_users_by_domain logic)
        let mut resolution_map = HashMap::new();
        for username in &unique_usernames {
            let account_id = self.lookup_single(username).await.ok().flatten();
            resolution_map.insert(username.clone(), account_id);
        }
        resolution_map
    }
}
```

### Pattern 4: ADF Post-Processor (TRAN-05)

**What:** After `htmltoadf::convert_html_str_to_adf_str` runs, a second pass walks the ADF JSON tree to resolve mention patterns, inject link marks for dropped `<a>` tags, and replace unsupported macro text with `[Not converted: ...]` placeholders.

**When to use:** Every time `wiki_to_adf.rs` converts a description or multi-line text field.

**Example:**
```rust
// field_transform/wiki_to_adf.rs
pub fn convert_and_postprocess(
    html: &str,
    user_map: &HashMap<String, Option<String>>,
) -> serde_json::Value {
    // Step 1: htmltoadf pass
    let adf_str = htmltoadf::convert_html_str_to_adf_str(html.to_string());
    let mut adf: Value = serde_json::from_str(&adf_str)
        .unwrap_or_else(|_| json!({"version":1,"type":"doc","content":[]}));

    // Step 2: Post-processor walk
    walk_adf_node_mut(&mut adf, user_map);
    adf
}

fn walk_adf_node_mut(node: &mut Value, user_map: &HashMap<String, Option<String>>) {
    // Recursively process content arrays.
    // When a text node contains [~username]:
    //   - resolved → replace with mention node
    //   - unresolved → replace [~username] with @username plain text (D-05)
    // When text matches {toc} / unknown macro patterns:
    //   - emit [Not converted: {original}] placeholder paragraph (D-07)
}
```

### Pattern 5: In-Memory Session Cache for Version/Component Maps

**What:** `HashMap<String, Vec<VersionInfo>>` and `HashMap<String, Vec<ComponentInfo>>` keyed by project key. Populated on first access per session; consumed by all subsequent copies.

**When to use:** `version.rs` and `component.rs` — always check cache before HTTP.

**Example:**
```rust
// field_transform/version.rs
pub struct VersionResolver {
    // Arc<Mutex<>> for interior mutability (shared across async tasks via TransformContext)
    cache: Arc<Mutex<HashMap<String, Vec<VersionEntry>>>>,
    client: reqwest::Client,
    cloud_auth: String,
    cloud_base_url: String,
}

impl VersionResolver {
    pub async fn resolve_name(
        &self,
        project_key: &str,
        source_name: &str,
    ) -> Option<String> {  // returns target version ID
        let versions = self.get_or_fetch_versions(project_key).await?;
        versions.iter()
            .find(|v| v.name.eq_ignore_ascii_case(source_name))
            .map(|v| v.id.clone())
    }

    async fn get_or_fetch_versions(&self, project_key: &str) -> Option<Vec<VersionEntry>> {
        {
            let cache = self.cache.lock().unwrap();
            if let Some(versions) = cache.get(project_key) {
                return Some(versions.clone());
            }
        }
        // Fetch from /rest/api/3/project/{key}/versions
        let versions = self.fetch_versions_from_api(project_key).await.ok()?;
        {
            let mut cache = self.cache.lock().unwrap();
            cache.insert(project_key.to_string(), versions.clone());
        }
        Some(versions)
    }
}
```

### Pattern 6: TransformContext — Dependency Carrier

**What:** A `TransformContext<'_>` struct carries all shared resources that transformers need: the audited HTTP client, Cloud credentials, target project key, user/version/component resolvers, and the pre-built user resolution map.

**When to use:** Passed into every transformer call; created in `apply_mapping` before the dispatch loop.

**Example:**
```rust
// field_transform/mod.rs
pub struct TransformContext<'a> {
    pub client: &'a reqwest::Client,
    pub cloud_auth: &'a str,
    pub cloud_base_url: &'a str,
    pub target_project_key: &'a str,
    pub user_resolver: &'a UserResolver,
    pub version_resolver: &'a VersionResolver,
    pub component_resolver: &'a ComponentResolver,
    // The pre-built map from Phase 1 of apply_mapping; populated before Phase 2 dispatch
    pub user_map: &'a HashMap<String, Option<String>>,
}
```

### Anti-Patterns to Avoid

- **Sequential user lookups:** Calling `search_jira_users_by_domain` once per person field = N×M HTTP calls. Always pre-collect all user references and issue one batch call (TRAN-06). The existing `search_jira_users_by_domain` at commands.rs:1096-1121 already paginates against domain; Phase 18 extracts the HTTP logic and calls it once.
- **Using `Err` for unresolvable entities:** `UnresolvedPerson` / `UnresolvedVersion` / `UnresolvedComponent` are expected business outcomes, not errors. Phase 22 reads them for required-field gating. Using `Err` would abort the pipeline and prevent Phase 22 from showing which specific fields need attention.
- **Re-using the read-shape for write-shape:** Jira custom field read responses contain extra fields (`self`, `avatarUrls`, `id`, `displayName`) that Cloud rejects on write. User writer shape: `{ accountId }` only. Version/component writer shape: `{ id }` only. Multi-select writer shape: `[{ value }]` (no `id`). See PITFALLS.md Pitfall 4.
- **Passing source `name`/`key` through for person fields:** Cloud v3 silently ignores `name`/`key` for assignee or returns `400 — anonymous user is invalid`. The pipeline must reject any person write without a resolved `accountId`. See PITFALLS.md Pitfall 1.
- **Skipping the ADF post-processor:** `htmltoadf` outputs literal `[~jdoe]` as a text node. Cloud accepts the ADF but renders the wrong content. The post-processor is required for TRAN-05 compliance.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML → ADF conversion | Custom HTML parser + ADF serializer | `htmltoadf::convert_html_str_to_adf_str` | Already in production at commands.rs:1656, :1974; MIT license; handles headings, lists, tables, code, panels, images [VERIFIED: source] |
| Cloud user search | Custom email lookup implementation | Existing `search_jira_users_by_domain` HTTP pattern (commands.rs:1096-1121) | Phase 16 already paginated, Basic-auth-correct, domain-search pattern confirmed working [VERIFIED: source] |
| URL encoding for project keys | Manual string replacement | `urlencoding::encode()` | Already a dep; used in field_discovery.rs:312-313 [VERIFIED: source] |
| SHA-256 hashing | Custom hash | `sha2` crate | Already a dep [VERIFIED: Cargo.toml] |

**Key insight:** The entire HTTP infrastructure (audited reqwest client, Basic auth construction, URL encoding, pagination) is already implemented in Phase 17 and commands.rs. Phase 18 re-uses these patterns exactly — it does NOT introduce new HTTP infrastructure.

---

## Common Pitfalls

### Pitfall A: User Write Shape Uses `name` Instead of `accountId`

**What goes wrong:** The pipeline resolves a user to an accountId, then accidentally uses the source user object (containing `name`, `key`, `displayName`) as the POST body. Cloud silently drops assignee or returns `400 — anonymous user is invalid`.

**Why it happens:** The source issue JSON has a rich user object; passing it through is the path of least resistance.

**How to avoid:** The user transformer output for ALL person-typed fields (system: assignee/reporter, custom Array<user>) is `{ "accountId": "<id>" }` and NOTHING else. Unit tests verify the write shape per field type.

**Warning signs:** POST body for assignee contains `"name"` or `"key"` keys. Destination ticket has `assignee: null` after a copy that reported success.

### Pitfall B: Multi-User Array Fails Wholesale on One Unresolvable Member

**What goes wrong:** A 3-user custom field has 2 resolvable users and 1 unresolvable. The pipeline wraps the whole field in `Err`. Phase 22 shows no resolved users at all.

**How to avoid:** Partial resolution (D-03). Walk each array element independently. Resolved elements go into the output array. Unresolved elements become `UnresolvedPerson` gap variants, each tagged with `target_field_id` so Phase 22 can show "pick manually for this slot."

### Pitfall C: ADF Mention Pre-Scan Misses Descriptions Stored as wiki vs Rendered HTML

**What goes wrong:** The source v2 issue may deliver description as raw wiki markup or as pre-rendered HTML (via `renderedFields.description`). The `[~username]` pattern is wiki markup syntax. When the code receives pre-rendered HTML, the pattern is already rendered as `<a href="/user/jdoe">@jdoe</a>` and the regex scan misses it.

**How to avoid:** Scan BOTH the raw wiki `fields.description` (for `[~username]` patterns) AND the rendered HTML `renderedFields.description` (for `href="/user/<username>"` patterns). Union the results before the batch lookup. The existing `copy_ticket` at commands.rs:1640-1660 already selects between `renderedFields.description` (HTML) and `fields.description` (raw) — `wiki_to_adf.rs` must handle both sources.

**Warning signs:** Descriptions with wiki mentions produce literal `[~jdoe]` in Cloud. Descriptions with HTML rendered mentions produce broken plain text `@jdoe` because the mention was already in `<a>` form and the user map lookup used the wrong key.

### Pitfall D: Version/Component Name Matching Is Case-Sensitive

**What goes wrong:** Source has version `"v1.2.3-RC"`. Target project has version `"v1.2.3-rc"`. Case-sensitive string match fails. Pipeline emits `UnresolvedVersion`. User confusion: "the version exists, why is it unresolved?"

**How to avoid:** Name matching uses `eq_ignore_ascii_case`. This is a deliberate UX trade-off (correctness vs. strictness) — version names in real Jira instances frequently differ in capitalization between Server and Cloud projects.

### Pitfall E: Version/Component Cache Not Thread-Safe

**What goes wrong:** `version.rs` and `component.rs` caches are plain `HashMap`s. In a concurrent scenario (unlikely in a single-user desktop app but possible if Phase 23 calls `apply_mapping` multiple times quickly), two concurrent lookups for the same project key can trigger two simultaneous HTTP fetches.

**How to avoid:** Wrap the cache in `Arc<Mutex<HashMap<...>>>`. Lock only for cache read/write, not during HTTP. Same pattern as the `mapping.db` lock in Phase 17 (`field_discovery.rs:497-528`).

### Pitfall F: ADF Post-Processor Corrupts Non-Mention Text Nodes

**What goes wrong:** The post-processor uses a greedy regex or string replace that accidentally modifies text containing `[~` in legitimate code blocks or literal bracket content. A code sample like `let x = array[~0]` becomes a garbled mention node.

**How to avoid:** The post-processor must check the ADF node type before applying mention replacement. Only apply the `[~username]` → `mention` transform to `type: "text"` nodes that are NOT inside a `codeBlock` or `code` mark. Maintain a `in_code_block` flag during the tree walk.

---

## Code Examples

Verified patterns from existing codebase:

### Building Cloud Basic Auth (commands.rs:1111-1113)
```rust
// Source: commands.rs:1111-1113 [VERIFIED: source]
let cloud_auth = format!(
    "Basic {}",
    base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
);
```

### Existing htmltoadf Call (commands.rs:1656)
```rust
// Source: commands.rs:1654-1658 [VERIFIED: source]
let rewritten_html = rewrite_image_urls(&html_description, &url_map);
let adf_str = htmltoadf::convert_html_str_to_adf_str(rewritten_html);
serde_json::from_str(&adf_str)
    .map_err(|e| AppError::Serialization(format!("Failed to parse ADF JSON: {e}")))?
```

### Existing Domain User Search HTTP Pattern (commands.rs:1119-1126)
```rust
// Source: commands.rs:1119-1126 [VERIFIED: source]
let url = format!(
    "{base_url}/rest/api/3/user/search?query={encoded_query}&maxResults={PAGE_SIZE}&startAt={start_at}"
);
let resp = client
    .get(&url)
    .header("Authorization", cloud_auth.clone())
    .send()
    .await
    .map_err(|_| AppError::Http("Failed to search users by domain".into()))?;
```

### Cache-First Pattern (field_discovery.rs:492-528)
```rust
// Source: field_discovery.rs:492-528 [VERIFIED: source]
// 1) Cache check — lock window kept short
{
    let guard = db.lock().map_err(|_| AppError::Internal("... lock poisoned".into()))?;
    let cached = guard.get_cached_schemas(...)?;
    if !cached.is_empty() { return Ok(cached); }
}
// 2) HTTP fetch — no lock held during network call
let result = fetch_from_api(...).await?;
// 3) Persist
{ let guard = db.lock()...; guard.upsert(...)?; }
```

### ADF Mention Node Structure (Atlassian spec)
```json
// Source: Atlassian ADF spec — mention is an inline node [CITED: developer.atlassian.com/cloud/jira/platform/apis/document/structure/]
{
  "type": "mention",
  "attrs": {
    "id": "557058:abc123-def456",
    "text": "@DisplayName"
  }
}
```
`id` is required (Cloud `accountId`). `text` is optional display hint. `accessLevel` and `userType` are optional. [CITED: JFM spec cross-reference from WebSearch]

### FieldSchemaType Variants Available to Phase 18 (field_discovery.rs)
```rust
// Source: field_discovery.rs:38-112 [VERIFIED: source]
// Key variants Phase 18 dispatch must handle:
// FieldSchemaType::User { .. }           → user.rs
// FieldSchemaType::Array { items, .. } where items == "user"      → user.rs
// FieldSchemaType::Array { items, .. } where items == "version"   → version.rs
// FieldSchemaType::Array { items, .. } where items == "component" → component.rs
// FieldSchemaType::String { system: Some("description"), .. }     → wiki_to_adf.rs
// FieldSchemaType::String { .. }  (non-description)               → identity.rs
// FieldSchemaType::Number { .. }                                  → identity.rs
// FieldSchemaType::Date { .. }                                    → identity.rs
// FieldSchemaType::Datetime { .. }                                → identity.rs
// FieldSchemaType::Option_ { .. }                                 → identity.rs (by value name)
// FieldSchemaType::Array { items: "option", .. }                  → identity.rs (by value name)
// FieldSchemaType::Priority                                       → identity.rs (by name lookup)
// FieldSchemaType::Issuetype                                      → identity.rs (Phase 23 concern)
// FieldSchemaType::OptionWithChild { .. }                         → identity.rs (Phase 20 concern)
// FieldSchemaType::Any                                            → skip (unsupported type)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pass source `name`/`key` through for assignee on Cloud | Must use `accountId` exclusively on Cloud v3 | Atlassian 2019 GDPR migration | Any code that passes `name`/`key` to Cloud silently fails or returns 400 |
| `createmeta?expand=projects.issuetypes.fields` (legacy combined) | `createmeta/{key}/issuetypes/{id}` (paginated, per Phase 17) | Cloud ~2023 deprecation | Phase 17 already implements the paginated endpoint |
| htmltoadf used raw (no post-processor) | htmltoadf + post-processor for mentions/links/macros | Phase 18 addition | Required for TRAN-05 compliance |
| Version/component referenced by name in POST body | Referenced by target instance ID in POST body | Always-correct behaviour | `{ "id": "<cloud-id>" }` not `{ "name": "v1.2.3" }` |

**Deprecated/outdated:**
- Server `name`/`key`/`username` identifiers for Cloud person fields: replaced by `accountId`
- Read-shape reuse for write-shape custom fields: always use the write-specific shapes (no `id` in multi-select value objects, no `displayName` in user writes)

---

## Runtime State Inventory

> Phase 18 is NOT a rename/refactor/migration phase. It adds new Rust files and modifies `lib.rs`.

**No runtime state migration is needed.** The `mapping.db` `field_schema_cache` table (Phase 17) is read-only in Phase 18 — Phase 18 only reads cached schemas to route field transforms. Phase 18 does NOT write new tables (Phase 19 adds `field_mapping` and `mapping_meta`). Version/component in-memory caches are session-scoped and require no migration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `htmltoadf` crate | wiki_to_adf.rs | ✓ | 0.1.12 | — |
| `reqwest` crate | user.rs, version.rs, component.rs HTTP | ✓ | 0.13 | — |
| `serde_json` | pipeline.rs, all transformers | ✓ | 1.x | — |
| `sha2`, `hex`, `base64`, `urlencoding` | Already used in field_discovery.rs | ✓ | current | — |
| `async-trait` | Transformer trait | ✓ | 0.1 | — |
| `regex` crate (optional) | [~username] scan | ✗ (not direct dep) | — | Hand-written scanner (recommended) |
| Phase 17 `field_discovery.rs` | `FieldSchema`, `FieldSchemaType`, `FieldSide` types | ✓ | Phase 17 shipped | — |
| Phase 17 `field_mapping_db.rs` | `mapping.db` + `field_schema_cache` reads | ✓ | Phase 17 shipped | — |
| Mock server fixtures (Phase 17) | Integration tests against mock | ✓ | 5 custom field types + v2/v3 divergence shapes | — |

**Missing dependencies with no fallback:** None — all required dependencies are present.

**Missing dependencies with fallback:** `regex` crate — recommended fallback is a hand-written scanner.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Rust built-in (`#[cfg(test)]`, `#[tokio::test]`) |
| Config file | `Cargo.toml` — no extra test config needed |
| Quick run command | `cargo test -p pmkar --lib field_transform` |
| Full suite command | `cargo test -p pmkar` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAN-01 | `assignee.name` → Cloud `accountId` in output | unit | `cargo test -p pmkar --lib field_transform::user` | ❌ Wave 0 |
| TRAN-01 | Unresolvable user → `UnresolvedPerson` gap variant (not Err) | unit | `cargo test -p pmkar --lib field_transform::user::unresolved` | ❌ Wave 0 |
| TRAN-01 | `Array<User>` partial resolution (2 resolved + 1 unresolved) | unit | `cargo test -p pmkar --lib field_transform::user::partial_array` | ❌ Wave 0 |
| TRAN-02 | Description HTML → valid ADF doc (no 400 shape) | unit | `cargo test -p pmkar --lib field_transform::wiki_to_adf` | ❌ Wave 0 |
| TRAN-03 | Version name → target version ID via name lookup | unit | `cargo test -p pmkar --lib field_transform::version` | ❌ Wave 0 |
| TRAN-03 | Missing version name → `UnresolvedVersion` gap | unit | `cargo test -p pmkar --lib field_transform::version::unresolved` | ❌ Wave 0 |
| TRAN-04 | Component name → target component ID | unit | `cargo test -p pmkar --lib field_transform::component` | ❌ Wave 0 |
| TRAN-04 | Missing component name → `UnresolvedComponent` gap | unit | `cargo test -p pmkar --lib field_transform::component::unresolved` | ❌ Wave 0 |
| TRAN-05 | `[~jdoe]` in description → `mention` node with accountId | unit | `cargo test -p pmkar --lib field_transform::wiki_to_adf::mention_resolution` | ❌ Wave 0 |
| TRAN-05 | Unresolvable mention → plain text `@jdoe` | unit | `cargo test -p pmkar --lib field_transform::wiki_to_adf::mention_fallback` | ❌ Wave 0 |
| TRAN-05 | `{toc}` macro → `[Not converted: {toc}]` placeholder | unit | `cargo test -p pmkar --lib field_transform::wiki_to_adf::macro_placeholder` | ❌ Wave 0 |
| TRAN-06 | Single HTTP pass for 3-user issue (assignee + reporter + custom user field) | integration | `cargo test -p pmkar --lib field_transform::pipeline::batch_user_lookup` | ❌ Wave 0 |
| TRAN-06 | Description mention users included in batch (D-06) | integration | `cargo test -p pmkar --lib field_transform::pipeline::description_mention_in_batch` | ❌ Wave 0 |
| TRAN-01..04 | Round-trip: ≥4 custom-field types against Phase 17 mock fixtures | integration | `cargo test -p pmkar --lib field_transform::pipeline::integration_round_trip` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test -p pmkar --lib field_transform` (fast, no network)
- **Per wave merge:** `cargo test -p pmkar` (full suite including mock server integration tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/field_transform/mod.rs` — defines `Transformer` trait, `TransformContext`, `ResolvedFields`, gap variants
- [ ] `src-tauri/src/field_transform/pipeline.rs` — `apply_mapping` skeleton + integration test stubs
- [ ] `src-tauri/src/field_transform/user.rs` — `UserResolver` with batch resolution tests
- [ ] `src-tauri/src/field_transform/version.rs` — `VersionResolver` with cache + tests
- [ ] `src-tauri/src/field_transform/component.rs` — `ComponentResolver` with cache + tests
- [ ] `src-tauri/src/field_transform/wiki_to_adf.rs` — htmltoadf wrapper + post-processor tests
- [ ] `src-tauri/src/field_transform/identity.rs` — passthrough tests
- [ ] `src-tauri/src/lib.rs` edit — add `pub mod field_transform;`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Reuses existing Cloud Basic auth pattern; no new auth mechanism |
| V3 Session Management | No | No session tokens in Phase 18; in-memory caches are cleared on app exit |
| V4 Access Control | No | Pipeline reads existing credentials from keychain via `get_cloud_credentials` |
| V5 Input Validation | Yes | Source issue field values are treated as untrusted input — never interpolated into SQL or shell; JSON-serialized via serde |
| V6 Cryptography | No | No new crypto; SHA-256 hash for version/component cache keys uses existing `sha2` crate |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Source field value containing credential-like strings (`Bearer`, `aws_secret_`) flows into ADF output | Information Disclosure | ADF post-processor does NOT redact — that is the audit layer's responsibility (Phase 7 / PITFALLS.md Pitfall 10). Phase 18 produces the output; it does not log field values. |
| `[~username]` pre-scan regex DoS on extremely long description | DoS | Bound the scan: if description exceeds a threshold (e.g., 500 KB), scan only the first N bytes for mention patterns. Practical descriptions are < 10 KB. |
| Gap variant structs carrying `source_email` serialized to IPC | Information Disclosure | `UnresolvedPerson.source_email` is used by Phase 22 for picker pre-fill — this is intentional; the data stays in-process and is cleared when the Copy Preview modal closes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `regex` crate is not a direct or transitive dependency in the project | Standard Stack | If it IS a transitive dep, importing it costs nothing; if not, choose the hand-written scanner to avoid adding a dep |
| A2 | Phase 17 mock fixtures include a v2 source issue with `assignee.name`, `fixVersions[].name`, and `components[].name` shapes (D-12) | Integration tests | Without these fixtures, integration tests need to supply their own mock data |
| A3 | The `[~username]` pattern in Jira wiki markup uses exactly the syntax `[~<alphanumeric-username>]` without spaces | ADF post-processor | If Jira also emits `[~ username]` (with space), the hand-written scanner must be adjusted |
| A4 | Cloud `/rest/api/3/project/{key}/versions` returns a flat JSON array (not paginated) for typical project versions | version.rs | If paginated, version.rs needs a pagination loop like `field_discovery.rs:fetch_all_createmeta_fields` |

**If this table is empty or short:** All critical claims were verified against the codebase directly. A1-A4 are the only unverified items.

---

## Open Questions

1. **`[~username]` detection in rendered HTML (Pitfall C)**
   - What we know: `copy_ticket` at commands.rs:1640-1660 already selects between `renderedFields.description` (HTML) and `fields.description` (raw wiki). Phase 18's `wiki_to_adf.rs` will receive HTML (the rendered form).
   - What's unclear: Does rendered HTML from Jira Server v2 emit `[~jdoe]` as literal text inside an `<a>` tag, or does it strip the wiki syntax entirely? The format of the rendered mention in HTML affects the pre-scan regex.
   - Recommendation: Add a mock fixture that exercises both cases (raw wiki description with `[~jdoe]` AND rendered HTML description with the rendered form). Test both paths in `wiki_to_adf.rs`.

2. **Pagination for `/project/{key}/versions`**
   - What we know: The Jira Cloud REST API v3 `/project/{key}/versions` returns a flat array by default. Large projects may have 100+ versions.
   - What's unclear: Whether Cloud v3 paginates this endpoint (some Atlassian endpoints return paginated responses, some return flat arrays).
   - Recommendation (Claude's discretion): Implement a pagination loop in `version.rs` matching the `fetch_all_createmeta_fields` pattern. If the endpoint returns a flat array, the loop exits after one page (total == actual count).

3. **Write shape for `priority` field**
   - What we know: Source v2 returns `priority: { id: "3", name: "Medium" }`. ARCHITECTURE.md documents: "identity if id matches; otherwise lookup by name in target priorities list."
   - What's unclear: Phase 18 scope says `identity.rs` handles priority. But what if the priority `id` differs between Server and Cloud (different numbering)? Does Phase 18 implement the name-based lookup or defer to Phase 23?
   - Recommendation: Phase 18's `identity.rs` implements a safe passthrough for priority — pass `{ id }` (not `{ name }`) to Cloud. If the `id` doesn't exist on Cloud, the POST will return a 400. Priority name-based lookup is a Phase 20/21 concern (it requires a priority list from the Cloud project's configuration). Document this limitation in the pipeline's integration test assertions.

---

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/field_discovery.rs` — `FieldSchema`, `FieldSchemaType`, `FieldSide` types (direct inspection)
- `src-tauri/src/field_mapping_db.rs` — `FieldMappingDb`, `get_cached_schemas`, `upsert_schema_row` (direct inspection)
- `src-tauri/src/commands.rs:1096-1155` — `search_jira_users_by_domain` pattern (direct inspection)
- `src-tauri/src/commands.rs:1640-1660` — `htmltoadf::convert_html_str_to_adf_str` usage (direct inspection)
- `src-tauri/Cargo.toml` — current dependencies (direct inspection)
- `.planning/phases/18-v2-v3-translation-layer/18-CONTEXT.md` — all locked decisions D-01 through D-10
- `.planning/research/ARCHITECTURE.md` — `field_transform/` module layout, `apply_mapping` contract, `pipeline.rs` Pattern 4
- `.planning/research/PITFALLS.md` — Pitfall 1 (accountId vs name), Pitfall 2 (privacy mode), Pitfall 4 (read/write asymmetry), Pitfall 5 (ADF gaps), Pitfall 9 (version/component name vs ID)
- `.planning/research/STACK.md` — htmltoadf 0.1.12 gap analysis, ADF editor strategy decision

### Secondary (MEDIUM confidence)
- [htmltoadf 0.1.12 README on GitHub](https://github.com/wouterken/htmltoadf/blob/master/README.md) — supported HTML elements list; gaps (links, blockquotes, mentions, mediaSingle not documented) [CITED: WebFetch]
- [Atlassian ADF Structure spec](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) — mention is an inline node type [CITED: official docs]
- Atlassian JFM spec (GitHub issue cross-reference) — mention node attrs: `id` (required, accountId), `text` (optional), `accessLevel` (optional) [CITED: WebSearch]
- [Jira Cloud v3 user/search privacy mode](https://support.atlassian.com/jira/kb/retrieve-email-addresses-of-users-through-jira-cloud-rest-api/) — emailAddress may be null; accountId always returned [CITED: WebSearch]

### Tertiary (LOW confidence — verified against PRIMARY above)
- ARCHITECTURE.md `Pipeline.rs` Pattern 4 code example — pseudocode, not production code; structure confirmed against real field_discovery.rs patterns

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all existing deps verified in Cargo.toml; no new deps (except optional regex)
- Architecture: HIGH — module layout mirrors ARCHITECTURE.md exactly; types confirmed in field_discovery.rs
- Pitfalls: HIGH — drawn from PITFALLS.md (HIGH confidence source) + direct codebase inspection
- Integration test targets: HIGH — Phase 17 mock fixtures confirmed (D-09 through D-12)
- ADF mention node structure: MEDIUM — confirmed inline node type in official spec; attrs structure from JFM cross-reference

**Research date:** 2026-04-27
**Valid until:** 90 days (stable Atlassian API, stable htmltoadf 0.1.12 — no indication of upcoming breaking changes)
