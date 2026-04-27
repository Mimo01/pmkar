# Feature Research

**Domain:** Configurable field mapping engine for a Jira Server v2 → Jira Cloud v3 ticket bridge desktop app (Tauri 2.10 / React 19 / Rust). Milestone v0.4.0 — replaces hardcoded copy of `summary, description, labels, priority, assignee, reporter` with a fully user-configurable, type-aware mapping pipeline including custom fields and required-field gating.
**Researched:** 2026-04-27
**Confidence:** HIGH for Jira API surface (createmeta, user picker, accountId model), HIGH for competitor UX patterns (JCMA, Exalate, Backbone, CSV importer all directly documented), MEDIUM for "what frustrates users" claims (synthesised from review/comparison articles plus community threads), HIGH for existing pmkar codebase integration points

---

> **Milestone scope reminder:** This file covers ONLY the new mapping-engine features for v0.4.0. The original feature research for v0.1.0 (connection setup, ticket fetch, copy pipeline core) and v0.3.0 (notifications, change tracking, polling) remains valid and is not repeated here. Comments, attachments, worklogs, sub-tasks, and the origin remote link **stay hardcoded** in the existing copy pipeline for this milestone.

---

## Reference Tools Surveyed

Five real tools were studied for UX patterns. Concrete observations follow:

| Tool | What It Is | Field-Mapping UX Pattern | What Works | What Frustrates |
|------|------------|--------------------------|------------|-----------------|
| **Jira Cloud Migration Assistant (JCMA)** | Atlassian's official Server/DC → Cloud migrator | Auto-discovery of standard + supported custom field types; non-supported types silently dropped to a post-migration log; field IDs change during migration and must be remapped in dependent entities | Auto-mapping of standard types is invisible (the "right" amount of UX = none); post-migration report enumerates omissions | Silent drops of unsupported custom field types ("icon single select", "non-standard" types) are the #1 user pain — users only discover the gap after migration; field-ID renumbering breaks downstream automations |
| **Exalate** | Bidirectional sync between Jiras (and Jira ↔ ServiceNow/Zendesk/etc.) via two endpoints with Groovy scripts | Outgoing-sync + Incoming-sync split; each side is a Groovy script with a default template; AI Assist generates Groovy from prose prompts; value-level mapping done with explicit dict literals (e.g. `def hobbyMap = ["Futbol":"Soccer"]`) | Maximum flexibility (any transformation expressible); explicit value maps survive option-not-found cleanly | Requires a Groovy programmer; non-technical users cannot self-serve; "this mapping is not supported" errors are common when option values don't exist on the receiving side; G2 reviews flag steep learning curve |
| **Backbone Issue Sync** (now "Backbone Work Sync", K15t) | Two-way Jira-to-Jira sync, no scripts | Visual checkbox-and-dropdown matrix at `Fields → Mappings`; "Publish Draft" gate before sync starts; per-issue-type mapping configuration; cache-invalidation button for when source schema changes | No-code, visual matrix easier than Exalate; "draft → publish" pattern matches enterprise change-control expectations; per-issue-type mappings handle the "Bug ≠ Defect" problem | No scripting engine = cannot do conditional or computed mappings; cannot opt out of specific data without JQL workarounds; status sync between team-managed and company-managed projects broken; cache-clear button is a smell — implies stale schema is a frequent failure mode |
| **Jira CSV Importer** (Atlassian native) | One-shot CSV → Jira issue create | File → Map → Validate (first 30 rows) → Begin Import; column-header → field-key dropdown per column; explicit "Validate" button before commit; downloadable error log | The four-step linear flow (file/map/validate/import) is intuitive; sample-row validation catches issues before destructive write; Summary is hard-required at the mapping step | Mapping is per-import (no saved templates by default); "missing fields for mapping" is a known confusing state in Server/DC; project key/name must be in CSV columns even when importing to a single known project |
| **Linear's Jira import** | Linear's native importer for Jira sources | Issue type → label conversion (Linear has no issue types); auto-mapping of Assignee/Creator only after the user links their personal Jira account in Settings | Smart defaults dramatically reduce mapping config; explicit nudge to authenticate so user-field mapping has identity context | Issue-type semantics are flattened to labels — lossy by design and a frequent migration regret; user mapping silently fails when personal Jira account isn't linked |
| *(Bonus)* **GitHub → Jira import** | Atlassian's GitHub importer | "GitHub fields will be automatically mapped to Jira fields" — zero user choice | Frictionless for happy path | Zero override surface — anything beyond defaults requires CSV re-import |

**Key takeaway:** The three viable UX archetypes are (1) **opaque auto-map** (JCMA, GitHub importer — fast, brittle), (2) **visual matrix with no-code overrides** (Backbone, CSV importer — accessible, limited), (3) **scripted transformation** (Exalate — powerful, gatekept). Pmkar's chosen position is **(2) plus per-copy override** — visual saved mapping with inline tweaks at copy time, no scripting.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any field-mapping bridge tool. Missing these = the feature feels half-built and users will hit them in week one.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dynamic field discovery from both sides | Hardcoded field lists fail the moment a customer Jira has a non-standard schema; every reference tool surveyed (JCMA, Exalate, Backbone) discovers fields at runtime | MEDIUM | Source: `GET /rest/api/2/field` (returns all fields including custom) + `GET /rest/api/2/issue/createmeta?projectKeys=X&issuetypeNames=Y&expand=projects.issuetypes.fields` for the issue-type-specific list with `required` flags. Target: same endpoints on `/rest/api/3/`. Cache per-session; invalidate on user request (Backbone exposes a cache-clear button — copy that pattern). |
| Field-type detection covering all standard Jira types | Without type info, the UI cannot render the right control (text vs select vs person vs date vs ADF) | MEDIUM | `createmeta` returns `schema.type` and `schema.custom`. Map: `string` → text or ADF (depends on `name`/key heuristics for "description"-shaped fields), `user` → person picker, `array+user` → multi-person picker, `option`/`array+option` → select/multi-select, `date`/`datetime` → date pickers, `number` → number input, `version`/`array+version` → version picker, `component`/`array+component` → component picker. Anything unrecognised → fall back to read-only "Unsupported type" pill (do NOT silently drop). |
| Visual source→target mapping matrix in Settings | This is the universal pattern (Backbone, JCMA, CSV importer all use it); a free-text config file would feel hostile | MEDIUM | Two-column table: left = source field (pre-populated from sample tickets + discovery), right = target field selector grouped by Standard / Custom. Add-row button for custom-field rows. Save as a single global mapping (per the v0.4.0 decision in PROJECT.md). |
| Sensible default mappings on first run | Users should not face an empty mapping screen on first launch; standard fields with identical names should auto-pair | LOW | On first save: walk source fields, for each look for a target field with same `name` (case-insensitive); pre-populate. Special-case the seven hardcoded fields the v0.1.0 pipeline already handled (`summary`, `description`, `labels`, `priority`, `assignee`, `reporter`) so users see continuity, not regression. |
| Per-copy override panel in the copy preview modal | Backbone's "publish draft" model and JCMA's pre-flight checks both establish the expectation that users see/adjust before commit; pmkar's existing copy preview is the natural slot | MEDIUM | Render the saved mapping as the baseline; allow per-row override to a different target field, a literal value, or "skip". Overrides are ephemeral (per-copy), not saved back to global mapping unless the user explicitly clicks "Save these changes to default mapping". |
| Field-type-aware target controls | Rendering all targets as text inputs would force users to type accountIds and version IDs by hand — unusable | MEDIUM-HIGH | Required controls: text input, multi-line textarea (for ADF source preview), URL input with validation, person picker (search + email pre-fill), multi-person picker, group picker, single-select (options from `allowedValues` in createmeta), multi-select, labels (free-text tag input with autocomplete from existing labels), components picker (project-scoped), versions picker (project-scoped), date picker, datetime picker, number input, checkboxes (multi-select), radio (single-select). |
| Person selector with exact-email pre-fill | Server uses username, Cloud uses opaque accountId; if the app silently picks the "wrong" person or fails, users blame the app, not Jira | MEDIUM | See dedicated "Person mapping" section below. Always render the picker even when a confident match exists — never silently auto-assign without user visibility (this is documented as a v0.4.0 key decision in PROJECT.md). |
| Issue-type chooser at copy time | Source and target Jiras have divergent issue-type schemes (Bug vs Defect, Task vs Work Item); auto-match is too brittle (Exalate explicitly recommends mapping by ID, not name, for this reason) | LOW | Dropdown in copy preview, populated from target project's createmeta `projects[].issuetypes[]`. Default to: source-name match if found in target, else target project's default issue type, else first issue type alphabetically. Selection is per-copy. |
| Required-field gating | Every reference tool that does pre-flight validation (CSV importer, JCMA reports, Backbone publish step) blocks on missing required fields; without this the user gets a 400 mid-copy with a cryptic Jira error | MEDIUM | Compute "required && unmapped && no value" set from createmeta. Highlight rows red in the override panel. Disable Copy button. Show inline hint per missing field. This must update reactively as the user fills in overrides. |
| v2 → v3 schema translation layer | Wiki markup → ADF, version/component name → ID lookup, username → accountId — these are not optional; Jira Cloud rejects v2-shaped payloads | HIGH | Already partially built: `htmltoadf` (in deps) handles wiki→ADF for description. New work: version-by-name lookup against target project's `/rest/api/3/project/{key}/versions`, component lookup against `/rest/api/3/project/{key}/components`, username→accountId via `/rest/api/3/user/search?query=<email>`. Cache lookups per-copy session. |
| Per-row "skip" / "don't copy" option | Users always want to disable a mapping without deleting it (especially for custom fields they don't want to overwrite on the target) | LOW | Tri-state per row: Map / Skip / Use literal. "Skip" persists the row but excludes from copy payload. |
| Search/filter on the field list | Long-tail custom fields are ubiquitous in mature Jira instances (commonly 100+); without search the dropdown is unusable | LOW | Standard combobox with type-ahead filter on the target field selector. Group by Standard / Custom in the dropdown. ClickUp, Salesforce, and Vendure (per research) all section custom fields away from standard fields — copy that. |
| Audit logging of mapping decisions | The v0.1.0 audit log is a core differentiator; mapping decisions, overrides, and required-gap fills must flow into it for parity | LOW | Existing audit middleware logs HTTP. New: log mapping-resolution events to the same audit store: source ticket key, mapping snapshot (saved mapping + overrides), required-field gap fills, final outbound payload (already logged via HTTP). Reuse existing log viewer. |

### Differentiators (Competitive Advantage)

Features that raise pmkar above "yet another sync tool". These are aligned with the Core Value (`maximum fidelity, no manual re-entry, no lost detail`) and the v0.4.0 goal of making the bridge work across arbitrary customer Jira schemas.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-copy override layered over saved global mapping | None of the surveyed tools do this cleanly: Backbone is global-only (no overrides), Exalate is per-script (no global), JCMA is one-shot. The "saved baseline + ad-hoc tweak" is closer to how email clients handle templates and is the right mental model for a copy-by-copy workflow | MEDIUM | The data shape: `effectiveMapping = savedMapping ⊕ perCopyOverrides`. Render the diff visibly ("Default: assignee → assignee. Override: assignee → reporter") so users see what they're changing. |
| Always-visible person picker with email pre-fill (even on confident match) | Silent identity mapping is the #1 known migration disaster (per Atlassian's own GDPR docs and JRACLOUD-70190); making the picker always visible converts a trust problem into a transparency feature | LOW (UI), MEDIUM (search debounce + cache) | The picker shows "Pre-filled by email match: jane@company.com → Jane Doe (accountId: abc123)" with the account ID visible. User can search/replace. This is the v0.4.0 key decision in PROJECT.md. |
| Inline required-field hint with one-click "Use source value" | When target requires a field that source doesn't have, offer fast paths: use a literal default, copy from another source field, or leave blank if optional. Reduces the 30-second back-and-forth Backbone users hit | LOW | Render under the red required indicator: "[Use literal: ___] [Map from: <source field dropdown>] [Skip]". Keeps the flow within the copy modal. |
| Field-type-aware diff preview | The v0.1.0 wiki→ADF diff already works; extend the diff to all field types — show "[Server username `jdoe`] → [Cloud user Jane Doe (jane@company.com)]" so users see the translation result, not just the input | MEDIUM | Render as a read-only "preview" column next to each mapping row, refreshed after the user picks a target field. For person fields, show resolved displayName + email. For versions, resolved version name. For ADF, the existing diff modal. |
| "Show only fields with values on this ticket" toggle | Mature Jira instances have 100+ custom fields per project; only ~5–15 typically have values on any given ticket. Filtering noise is a quality-of-life win the surveyed tools don't offer | LOW | Toggle in the override panel. Default ON. The user can flip OFF to surface a target field they want to set even though source is empty. |
| Bilingual UI for the mapping screens (EN/SK) | Pmkar already invests in i18n; the mapping UI is the most text-heavy new surface and is where untranslated labels would be most visible | LOW | All new strings go through i18next. Field type labels ("Person", "Multi-select", "Version") need translation. Field names from Jira are NOT translated (they're customer data). |
| Cache + invalidate button for discovered field schemas | Backbone's cache-clear button is a feature precisely because schema changes (admin adds a custom field) break sync silently. Surface this proactively | LOW | Cache discovery results for the session (10 min TTL); show "Last refreshed Xm ago [Refresh]" in the mapping screen header. |

### Anti-Features (Commonly Requested, Often Problematic)

These will be requested. We are consciously skipping them in v0.4.0 (and most likely beyond) because they multiply scope without proportional value, or because they would re-create exactly the problems users hit with Exalate and Backbone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Scripting engine for custom transformations** ("Groovy/JS expression for this field") | Exalate's headline feature; "I want to combine first+last name into displayName" or "set priority to High if labels contain `urgent`" | Adds a code-editing surface, sandbox/security model, syntax errors as a new error class, and a long-tail support burden. Every Exalate review on G2 cites learning curve. Pmkar is a single-user desktop tool; users who need scripting can edit the SQLite mapping directly | Provide a curated set of declarative transforms via the per-copy override panel (literal value, copy-from-other-field, skip). If a power user wants more, recommend they pre-process upstream |
| **Per-project-pair mappings** ("Different mapping for project FOO vs BAR") | Real Jira usage often has heterogeneous projects; "one mapping fits all" feels naive | Adds a mapping-selection picker, project-detection heuristics, and a config-explosion problem (10 source projects × 5 target projects = 50 mappings). The existing `global mapping + per-copy override` already covers heterogeneity ad hoc. PROJECT.md explicitly calls this out as a key decision | Document that the saved mapping is global; override per copy when projects differ. Revisit only if real users hit pain |
| **Bidirectional sync / two-way field mapping** | "I want changes on the target to flow back to the source" | Pmkar is explicitly "one-time copy with origin tracking" (v0.1.0 key decision). Adding two-way mapping would require sync state tracking, conflict resolution, and a daemon — out of scope by design | Use the origin remote link to navigate back to the source; copy again if needed |
| **Conditional mappings** ("If source.status == Closed, then map X to Y, else Z") | Exalate supports this via Groovy; users coming from there will ask | Conditional logic is a slippery slope to a full DSL. The per-copy override gives the user a manual "if" — they make the decision themselves at copy time. Keeping the engine declarative keeps it debuggable | Per-copy override is the human-in-the-loop "if" |
| **Value-level mapping for select/multi-select** ("Source 'High' → Target 'P1'") at v0.4.0 | Exalate supports it via dict literals; Backbone supports it via per-issue-type config; users will assume parity | Building a per-option mapping UI is a sub-screen of its own (option discovery, allowed-value matrix, default-when-missing handling). For v0.4.0, falling back to per-copy override on the select control is sufficient — user picks the right target option once per copy | Defer to a later milestone (e.g. v0.5.x). Per-copy override on the multi-select control covers 80% of cases |
| **Auto-create custom fields on the target if missing** | "JCMA / CSV importer can create fields on the fly" | Creating fields requires Jira admin permissions on the target which the user PAT may not have. Failures here are confusing (silent admin permission errors). Schema changes also pollute the target Jira | Show "target has no equivalent field" in red and let the user choose: skip, map to a different target field, or go to Jira admin and add the field manually |
| **Bulk apply mapping across many tickets at once** | Natural extension once mapping works; "select 20 tickets → copy all" | PROJECT.md explicitly lists "bulk copy (select all)" as out of scope — it defeats the review workflow that is core to pmkar's value. The mapping engine should not encourage what the product position rejects | Per-copy review remains the workflow; mapping reduces per-copy cost without bypassing review |
| **Field-history mapping** ("Copy the changelog of this field too") | Exalate offers it for some fields; Linear→Jira import preserves it | Changelog write APIs in Jira Cloud are limited and lossy; results often don't match user expectations. v0.1.0 already excluded change history from the copy pipeline. Mapping engine should not re-introduce it | Document the limitation; user can copy the source URL via origin link |
| **AI/LLM-suggested mappings** ("auto-map by semantic similarity") | Exalate now ships AI Assist; trend-following users will request it | LLM in a desktop app means either a hosted API call (network/cost/privacy) or a bundled model (size). Heuristic name-match auto-mapping (case-insensitive equality + a few synonym pairs) gets 90% of the value at 1% of the complexity | Keep first-run defaults heuristic. Revisit AI assistance only after baseline mapping ships and is exercised by real customers |

---

## Person Mapping (Detailed)

This section is broken out because it is the area most likely to silently fail and the area where the v2/v3 API gap is widest.

### The Problem

- **Jira Server v2** identifies users by `name` (the username, e.g. `jdoe`). It is human-readable and stable per instance.
- **Jira Cloud v3** identifies users by `accountId` (an opaque GDPR-era string, e.g. `5b10ac8d82e05b22cc7d4ef5`). The `name` field is gone. `displayName` and `emailAddress` are visible to a query but `emailAddress` may be hidden by user privacy settings.
- A copy operation that just shoves source `assignee.name = "jdoe"` into a Cloud `assignee` payload produces a 400 error.

### Established Patterns from Reference Tools

| Tool | Approach | Pmkar Fit |
|------|----------|-----------|
| JCMA | Email-based matching during user migration; users that don't exist in Cloud are created; mismatches logged in post-migration report | Email match is the right primary key. Pmkar will NOT create users (no admin access on customer Jira). |
| Exalate | Groovy script picks the strategy; common pattern is a hardcoded `userMap = ["jdoe":"5b10..."]` dict; falls back to a default user | The hardcoded dict is brittle; Pmkar's email-search-with-cache is lower friction. |
| Atlassian Cloud Automation | Provides a `convertUsernamesToAccountIds()` helper that calls the user picker API per username | This is essentially what pmkar will do, but with caching and fallback UI. |
| Linear's Jira import | Requires the user to "link personal Jira account" before user mapping works; otherwise silently drops | Pmkar already has both PATs configured by setup wizard, so identity context is always present. |

### Pmkar's Approach for v0.4.0

1. **Resolution pipeline (in order):**
   - If source ticket exposes user `emailAddress` (Server typically does for own users), search target Cloud via `GET /rest/api/3/user/search?query=<email>`. Treat exact email match as HIGH-confidence pre-fill.
   - If no email or no exact match, search target by `displayName` (best-effort). MEDIUM confidence — surface as "tentative match" in the picker.
   - If multiple matches, surface all in the picker with their accountIds, displayNames, and emails (where available); user picks.
   - If no match, picker is empty — user must search/select. Required-field gating prevents copy until resolved.

2. **UI contract:**
   - Person picker is **always visible** in the override panel for any person field, even when a confident pre-fill exists. (Key decision in PROJECT.md.)
   - Pre-fill is shown with a green check + the matched email; the user can override with one click.
   - Multiple matches are shown with a yellow ⚠ + a "n matches" badge.
   - No matches are shown with a red ✗ and the picker open by default.

3. **Caching:**
   - Resolved `email → accountId` pairs cached in-memory per copy session.
   - Persisted across sessions in a new `user_resolution_cache` SQLite table (TTL 7 days, can be invalidated by user).
   - Cache key is `(source_username, source_email)` to avoid stale-username-rebound problems.

4. **Privacy edge case:**
   - Cloud users may have email addresses hidden. In that case the user picker returns the user but `emailAddress` is null. Pmkar must support resolving by displayName when email is unavailable, and surface that this is a lower-confidence match.

5. **Audit logging:**
   - Every resolution decision (auto-prefill, manual pick, fallback) logged with confidence level. Reuses the existing audit log surface.

**Complexity:** MEDIUM. The Phase 16 user search work in v0.3.0 (`/rest/api/2/user/search?username=@domain.com` + bulk add) is the foundation; v0.4.0 adds the resolution pipeline, caching, and the per-field picker UI on top.

---

## Required-Field Handling (Detailed)

### The Problem

- Target Jira Cloud may require fields that source Jira Server does not have or has empty (e.g. a custom "Severity" field marked required in the target project).
- A copy that omits a required field returns a 400 with a per-field error map.
- Users get a cryptic "validation failed" without insight into which field or what to do.

### Pmkar's Approach for v0.4.0

1. **Discovery:** `createmeta` for the target issue type returns a `required: true` flag per field. Compute the set of required target fields up front when the user opens the copy modal.

2. **Gating:** The Copy button is disabled (with a tooltip listing the unmet required fields) until all required fields have a resolved value. This is a v0.4.0 key decision in PROJECT.md.

3. **Inline resolution UX in the override panel:**
   - Required fields that the saved mapping resolves get a green check.
   - Required fields with no source mapping AND no override get a red bar + inline controls:
     - **`[Use literal: ___]`** — text/number/date input depending on field type
     - **`[Map from: <source field dropdown>]`** — pick a different source field
     - **`[Use default: <value>]`** — only shown if `createmeta.allowedValues` has a `defaultValue`

4. **Visual hierarchy:** Required-but-unsatisfied fields appear at the TOP of the override panel, sorted before the rest, so the user sees them immediately on opening the modal.

5. **Re-validation:** As the user fills overrides, the gating recomputes reactively. The Copy button transitions disabled → enabled the instant the last required field is resolved.

6. **Error fallback:** Even with gating, the target Jira may reject the copy for reasons createmeta didn't surface (e.g. workflow conditions). Surface the per-field error from the 400 response in the same panel slot, so the user can fix and retry without re-entering everything.

**Complexity:** MEDIUM. Logic is simple but the reactive re-gating + inline-fill UX is the most-touched surface of the milestone.

---

## Issue Type Translation (Detailed)

### The Problem

Source and target Jiras have unaligned issue-type schemes:
- Source has `Bug`, target has `Defect`
- Source has `Task`, target has `Work Item`
- Source has `Sub-task`, target may not allow sub-tasks for the chosen parent type

### Established Patterns

- **Exalate** explicitly recommends mapping by **ID, not name**, because names drift.
- **Backbone** offers per-issue-type field-mapping configuration (different field maps for Bug vs Story).
- **CSV importer** lets the user map a column to "Issue Type" and create new types on the fly.
- **Linear's Jira import** flattens issue types to labels (lossy by design).

### Pmkar's Approach for v0.4.0

1. **At copy time** (NOT in saved mapping settings):
   - Show an Issue Type dropdown in the copy preview.
   - Populate from the target project's createmeta `projects[].issuetypes[]`.
   - Default selection: source-name match if exact case-insensitive name found; else target project's default issue type; else the first issue type alphabetically.

2. **Reactive field updates:**
   - Changing the issue type re-fetches createmeta for the new type and recomputes required-field gating + the override panel field list.
   - This is critical — different issue types in the same project can have different required fields and different available custom fields.

3. **No saved per-issue-type mappings (v0.4.0):**
   - Backbone's per-type mapping config is powerful but adds a config-explosion axis. The global-mapping + per-copy override pattern handles the variation manually for v0.4.0.
   - If real users hit "I do this same per-type override every time", revisit in a later milestone.

4. **Sub-tasks stay hardcoded:**
   - Per the v0.4.0 scope statement, sub-tasks remain in the existing copy pipeline. Issue type chooser does not affect sub-task copy logic in this milestone.

**Complexity:** LOW for the chooser, MEDIUM for the reactive re-fetch + re-gating.

---

## Saved vs Ad-Hoc Mapping (Detailed)

### The Problem

Users want both:
- A saved baseline so they don't reconfigure every copy ("90% of my copies use this mapping")
- Per-copy flexibility so they can deviate without committing the change ("just this one ticket, map reporter → assignee")

### Established Patterns

- **Backbone** is global-only (publish-and-go); changing a mapping is a config event with audit trail.
- **Exalate** is per-script (every script is bespoke); no concept of "saved mapping with overrides".
- **CSV importer** is per-import (no save by default); the closest analogue is third-party tools like csvbox that add saved templates.
- **Salesforce migration tools** (Coefficient, etc.) save mapping templates and let users apply with override.

### Pmkar's Approach for v0.4.0

1. **One global saved mapping** stored in SQLite. Single-user desktop tool, no team sharing required.

2. **Per-copy override panel** in the copy preview modal:
   - Renders the saved mapping as the baseline (read-only display).
   - Each row has an "edit override" pencil that turns it into an editable control.
   - Modified rows show a clear "modified" badge.
   - "Reset all overrides" button.

3. **"Save these changes to default" button** at the bottom of the override panel, with confirmation dialog. Promotes overrides into the saved global mapping. Off by default (overrides are ephemeral unless explicitly promoted).

4. **No mapping templates / multiple named mappings** for v0.4.0. Single global is sufficient. If users hit the "I have two distinct customer Jiras with different schemas" pain, revisit by introducing a per-connection-pair scope (still aligned with the "global mapping" decision since the global is bound to the connection pair, which is also unique per app install).

**Complexity:** LOW for storage (single JSON blob in SQLite), MEDIUM for the override panel UX.

---

## Feature Dependencies

```
[Field Discovery (source v2 + target v3)]
    └──requires──> [Existing Jira REST clients (v0.1.0)]
    └──produces──> [Field Schema Cache]
        └──consumed-by──> [Saved Mapping Settings UI]
        └──consumed-by──> [Per-Copy Override Panel]
        └──consumed-by──> [Required-Field Gating]
        └──consumed-by──> [Field-Type-Aware Controls]

[Field-Type Detection]
    └──requires──> [Field Discovery]
    └──produces──> [Type Tags per Field]
        └──consumed-by──> [Field-Type-Aware Controls (renderers)]
        └──consumed-by──> [v2→v3 Schema Translation Layer (lookups)]

[Saved Global Mapping]
    └──stored-in──> [SQLite (new table: field_mappings or JSON in app_config)]
    └──seeded-by──> [Heuristic Default Mapper (name-match)]
    └──consumed-by──> [Per-Copy Override Panel (as baseline)]

[Per-Copy Override Panel]
    └──extends──> [Existing Copy Preview Modal (v0.1.0)]
    └──requires──> [Saved Global Mapping]
    └──requires──> [Field Discovery]
    └──requires──> [Field-Type-Aware Controls]
    └──produces──> [Effective Mapping for this copy]

[Required-Field Gating]
    └──requires──> [Field Discovery (createmeta with `required` flags)]
    └──requires──> [Per-Copy Override Panel (to read current values)]
    └──gates──> [Copy Button]

[Person Mapping]
    └──requires──> [Cloud user search API (/rest/api/3/user/search)]
    └──extends──> [Phase 16 user search from v0.3.0]
    └──produces──> [User Resolution Cache (new SQLite table)]
    └──consumed-by──> [Person Picker control]

[Issue-Type Chooser]
    └──requires──> [Target createmeta with issuetypes[]]
    └──triggers──> [Re-fetch createmeta on selection change]
    └──triggers──> [Required-Field Re-Gating]

[v2→v3 Schema Translation Layer]
    └──includes──> [Wiki→ADF (existing, htmltoadf)]
    └──includes──> [Version name → ID lookup (new)]
    └──includes──> [Component name → ID lookup (new)]
    └──includes──> [Username → accountId resolution (Person Mapping)]

[Audit Logging of Mapping Decisions]
    └──extends──> [Existing audit log (v0.1.0)]
    └──logs-from──> [Per-Copy Override Panel, Person Mapping, Required-Field fills]
```

### Dependency Notes

- **Field Discovery is the linchpin:** every other feature consumes it. Build first. Without it, the override panel has nothing to render and required-field gating has nothing to check.
- **Field-Type Detection separates from Discovery deliberately:** discovery returns raw schema; type detection is the heuristic layer that maps schema to UI control. Keep them separable so the heuristic can evolve without re-fetching schemas.
- **Saved Global Mapping is a thin layer** over the field discovery output; effectively a `Map<sourceFieldId, targetFieldId>` plus per-row metadata (skip flag, literal value). Storage is straightforward.
- **Per-Copy Override Panel composes the others:** it does not stand alone. It reads saved mapping, displays via type-aware controls, validates against required-field gating, and resolves users via person mapping. Implement after its dependencies.
- **Required-Field Gating reactively re-runs** on every override edit and on issue-type change. Build the gating as a pure function of (mapping, overrides, required-set, current-values) for testability.
- **Person Mapping reuses Phase 16 user search** (already shipped in v0.3.0). Extension is the email-resolution + caching layer, not the search API itself.
- **Issue-Type Chooser cascades into Field Discovery:** selecting a different issue type forces a createmeta re-fetch (different types have different required fields). This is the biggest source of latency/UX-flicker risk in the milestone.
- **v2→v3 Schema Translation Layer is the "last mile" before the HTTP call:** consumes the effective mapping + resolved user identities and produces the v3-shaped POST body. Wiki→ADF is already done; version/component lookup is new.
- **Audit Logging is the cross-cutting concern:** every decision feeds it; it does not block any other feature. Implement last but plan logging hooks throughout earlier features.

---

## MVP Definition

This is milestone v0.4.0 MVP — what is needed for this milestone to ship.

### Launch With (v0.4.0)

- [ ] **Dynamic field discovery** (source v2 + target v3, including custom fields with type detection) — foundation; nothing else works without it
- [ ] **Saved global source→target mapping** (Settings UI, single mapping, name-match defaults on first run) — the core promise of the milestone
- [ ] **Per-copy override panel** in the copy preview modal — flexibility without re-config
- [ ] **Field-type-aware target controls** for all standard Jira types (text, multi-line, URL, person, multi-person, group, single/multi-select, labels, components, versions, date, datetime, number, checkboxes, radio) — without these the UI is unusable
- [ ] **Person selector with exact-email pre-fill, always visible** — addresses the v2/v3 identity gap
- [ ] **Issue-type chooser at copy time** with source-name-match default — addresses cross-instance type mismatch
- [ ] **Required-field gating** (Copy button blocked until satisfied; inline-fill controls for unmet required fields) — prevents mid-copy 400 errors
- [ ] **v2 → v3 schema translation layer** (wiki→ADF [done], version/component name→ID lookup [new], username→accountId [new]) — required for any copy to succeed against real Cloud
- [ ] **Audit logging of mapping decisions** (selections, overrides, required-gap fills) — parity with v0.1.0 audit log surface
- [ ] **User resolution cache** (SQLite table, 7-day TTL, manual invalidate) — performance and correctness for repeated copies
- [ ] **Field schema cache + manual refresh button** — handles target schema drift

### Add After Validation (v0.4.x)

- [ ] **"Show only fields with values" toggle** in the override panel — quality-of-life once baseline works
- [ ] **"Save overrides to default" promotion button** — pattern emerges only with usage; defer until a user explicitly asks
- [ ] **Field-type-aware diff preview column** in the override panel — extends the existing wiki→ADF diff to all field types
- [ ] **Cache-clear button surfaced in main UI** (not just settings) — surfaces stale-schema as a first-class concern

### Future Consideration (v0.5+)

- [ ] **Value-level mapping for select/multi-select** ("source 'High' → target 'P1'" persisted) — defer until per-copy override demonstrates the pattern is real and frequent
- [ ] **Per-issue-type or per-project-pair saved mappings** — defer until the global+override pattern is proven insufficient
- [ ] **Conditional/computed mappings** — likely never; documented as anti-feature
- [ ] **AI-suggested mappings** — defer until baseline ships and value of suggestion is clear

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| Dynamic field discovery (source + target) | HIGH | MEDIUM | P1 | Foundation for everything |
| Field-type detection | HIGH | MEDIUM | P1 | Foundation for type-aware UI |
| Saved global mapping (Settings UI) | HIGH | MEDIUM | P1 | The headline feature |
| Sensible default mappings on first run | HIGH | LOW | P1 | Avoids empty-state hostility |
| Per-copy override panel | HIGH | MEDIUM | P1 | The "just this once" escape hatch |
| Field-type-aware target controls (all types) | HIGH | HIGH | P1 | The biggest UI build of the milestone |
| Person selector (always visible, email pre-fill) | HIGH | MEDIUM | P1 | Addresses v2/v3 identity gap |
| Issue-type chooser at copy time | HIGH | LOW | P1 | Addresses type-name mismatch |
| Required-field gating | HIGH | MEDIUM | P1 | Prevents 400 errors mid-copy |
| v2 → v3 schema translation (versions, components, accountId) | HIGH | MEDIUM | P1 | Needed for any successful copy |
| User resolution cache (SQLite) | HIGH | LOW | P1 | Performance + correctness |
| Field schema cache + refresh button | MEDIUM | LOW | P1 | Handles schema drift |
| Audit logging of mapping decisions | HIGH | LOW | P1 | Parity with v0.1.0 audit |
| "Show only fields with values" toggle | MEDIUM | LOW | P2 | Noise reduction; nice once 100+ field instances are real |
| Field-type-aware diff preview | MEDIUM | MEDIUM | P2 | Extends existing diff; polish |
| "Save overrides to default" promotion | MEDIUM | LOW | P2 | Wait for user demand |
| Inline fast-paths for required gaps (use literal / map from) | MEDIUM | LOW | P2 | UX polish; required gating is the must-have |
| Value-level select mapping | MEDIUM | HIGH | P3 | Per-copy override covers it for now |
| Per-issue-type saved mappings | LOW | HIGH | P3 | Backbone-style; not justified yet |
| Per-project-pair mappings | LOW | HIGH | P3 | Anti-feature for v0.4.0 |
| Scripting / Groovy-style transformation | LOW | HIGH | P3 | Documented anti-feature |
| AI-suggested mappings | LOW | HIGH | P3 | Trend-following; defer |

**Priority key:**
- P1: Must have for v0.4.0 launch
- P2: Add during v0.4.x iterations
- P3: Future milestone consideration

---

## Competitor Feature Analysis

| Feature | JCMA (Atlassian) | Exalate | Backbone | CSV Importer | Pmkar Approach |
|---------|------------------|---------|----------|--------------|----------------|
| Field discovery | Auto | Auto | Auto | Auto | Auto, with manual refresh button |
| Custom field support | Standard types only; non-standard silently dropped | All; via scripting | All; visual matrix | All; per-import column mapping | All; visual matrix + per-copy override |
| Mapping UI | Largely opaque; report-driven | Groovy editor | Visual matrix | Per-import dropdown | Visual matrix in Settings + per-copy panel |
| Saved mappings | Per-migration session | Per-script (saved as scripts) | Global (publish-and-go) | None by default | Single global + per-copy overrides |
| Per-item override | None | Per-script logic | None | None | Yes (per-copy panel) |
| Value-level mapping | Limited | Yes (Groovy dict) | Yes (per option config) | None | Deferred to v0.5+ |
| Required-field handling | Logged in post-migration report | Script throws error | Surfaced at publish | First-30-row validation | Inline gating, copy button blocked |
| Issue type mapping | Auto by name; non-matches dropped | Per script | Per type; complex | Map column to "Issue Type" | Per-copy chooser, source-name default |
| Person mapping | Email match during user migration; non-matches create user | Hardcoded dict in Groovy | Username/email picker | Username/email column | Email-search with cache, picker always visible |
| Conditional/computed | Limited (scripted via Groovy if Connect app) | Yes (Groovy) | No | No | No (anti-feature) |
| Scripting | None (declarative migration) | Groovy | None | None | None (anti-feature) |
| Cache invalidation | Per-migration | Manual | Cache-clear button | N/A | Manual refresh button |

---

## Existing Codebase Integration Points

Confidence: HIGH — based on direct codebase analysis and prior milestone audits.

| New Feature | Existing Hook | Notes |
|-------------|---------------|-------|
| Field discovery API calls | Existing v2 + v3 Jira clients (`src-tauri/src/jira/`) | Add `fetch_create_meta` and `fetch_fields` Tauri commands; reuse middleware-instrumented HTTP layer for audit logging |
| Field schema cache | New SQLite table `field_schema_cache` in `triage.db` | `(connection_id TEXT, project_key TEXT, issue_type_id TEXT, schema_json TEXT, fetched_at TEXT)` — short TTL |
| Saved global mapping | New SQLite table `field_mappings` in `triage.db` | Single row containing JSON blob; or one row per mapping rule with sourceFieldId/targetFieldId/skip/literalValue |
| User resolution cache | New SQLite table `user_resolution_cache` in `triage.db` | `(source_username TEXT, source_email TEXT, target_account_id TEXT, target_display_name TEXT, target_email TEXT, resolved_at TEXT)` — 7-day TTL |
| Settings mapping UI | `SettingsPage.tsx` (already exists) | Add a new "Field Mapping" section/tab |
| Per-copy override panel | `CopyResultModal` / copy-preview component (already exists) | Extend the existing modal with the override panel; reuse the wiki→ADF diff component |
| Field-type-aware controls | New `src/features/mapping/controls/` directory | One component per type; export a `<FieldControl type={...} value={...} onChange={...} />` dispatcher |
| Person picker | Phase 16 user search (`watchedUsers` config) | Reuse the search hook; new picker component with email pre-fill state |
| Required-field gating | Existing copy-button enable/disable logic | Add a `useRequiredFieldStatus(...)` hook that pure-computes from the effective mapping |
| v2→v3 wiki→ADF | `htmltoadf` (already in deps) | No change |
| v2→v3 version/component lookup | New helper in `src-tauri/src/jira/translate.rs` | Resolve names against target project versions/components endpoints |
| Audit log entries | Existing audit middleware (`src-tauri/src/audit/`) | Add structured log type `MappingDecision` with serde-derived fields |
| Bilingual UI | `i18next` (already in deps) | All new strings flow through existing i18n setup; field type labels need EN/SK translations |

---

## Jira API Surface for Field Mapping

Confidence: HIGH — based on Atlassian REST API docs.

### Field Discovery

- **Source v2 fields:** `GET /rest/api/2/field` returns ALL fields (standard + custom) with `id`, `name`, `custom`, `schema.type`, `schema.custom`. No project context needed.
- **Source v2 createmeta:** `GET /rest/api/2/issue/createmeta?projectKeys=X&issuetypeNames=Y&expand=projects.issuetypes.fields` returns per-project, per-issue-type field list with `required`, `allowedValues`, `defaultValue`, `schema`. Note: deprecated/removed in Jira 9.0+; for newer Server installs use `GET /rest/api/2/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` (per [JRACLOUD-75814](https://jira.atlassian.com/browse/JRACLOUD-75814) discussion).
- **Target v3 createmeta:** `GET /rest/api/3/issue/createmeta?projectKeys=X&issuetypeNames=Y&expand=projects.issuetypes.fields` for older Cloud, or the issue-type-scoped variant for newer. Same response shape.
- **Caveat:** `createmeta` is known to be slow on large instances; cache aggressively.

### User Search (Cloud)

- `GET /rest/api/3/user/search?query=<email>` — returns users matching email/displayName. Used for accountId resolution.
- `GET /rest/api/3/groupuserpicker?query=<email>` — alternative; returns the same accountId data plus group results.
- Email may be hidden by user privacy settings; fall back to displayName + manual confirm.

### Project Versions / Components (for name→ID lookup)

- `GET /rest/api/3/project/{key}/versions` — array of `{id, name, archived, released, ...}`.
- `GET /rest/api/3/project/{key}/components` — array of `{id, name, lead, ...}`.
- Cache per copy session.

### Required-Field Validation

- `createmeta` response includes `fields[fieldId].required: boolean`. Compute the required set up front.
- Some field requirements come from workflow conditions or screen schemes that are NOT exposed by createmeta. The user may still hit a 400 on copy. Surface the per-field error from the response and let them fix and retry.

---

## Sources

- [Jira REST API: createmeta endpoint](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/) — HIGH confidence
- [Jira Cloud REST API v3: Group and User Picker](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-group-and-user-picker/) — HIGH confidence
- [Atlassian Cloud Automation: Convert usernames to account IDs](https://support.atlassian.com/cloud-automation/docs/convert-usernames-to-account-ids/) — HIGH confidence
- [JCMA: What gets migrated](https://support.atlassian.com/migration/docs/what-gets-migrated-with-the-jira-cloud-migration-assistant/) — HIGH confidence
- [JCMA custom field migration tutorial](https://developer.atlassian.com/platform/app-migration/tutorials/migrating-app-custom-fields/) — HIGH confidence
- [JCMA: Custom fields not migrated](https://support.atlassian.com/migration/kb/jcma-doesnt-migrate-all-custom-fields/) — HIGH confidence
- [JCMA: Icon Single Select fields not migrated](https://support.atlassian.com/migration/kb/icon-single-select-custom-fields-not-migrated-to-jira-cloud-via-jcma/) — HIGH confidence
- [Exalate: Jira-to-Jira integration guide](https://docs.exalate.com/docs/jira-to-jira-integration) — HIGH confidence
- [Exalate: Sync custom fields with options in Jira Cloud](https://docs.exalate.com/docs/how-to-sync-custom-fields-with-options-in-jira-cloud) — HIGH confidence
- [Exalate: Sync user fields in Jira Cloud](https://docs.exalate.com/docs/jira-cloud-user-field-sync) — HIGH confidence
- [Exalate: Invalid issue type selected](https://docs.exalate.com/docs/invalid-issue-type-selected) — HIGH confidence
- [Exalate: Fix "This Mapping is Not Supported" error](https://docs.exalate.com/docs/error-unsupported-field-mapping) — HIGH confidence
- [Exalate vs Backbone comparison (vendor analysis, take with grain of salt)](https://exalate.com/blog/backbone-issue-sync/) — MEDIUM confidence
- [Backbone Field Mapping Configuration sneak peek (K15t blog)](https://www.k15t.com/blog/2016/04/backbone-issue-sync-for-jira-field-mapping-configuration-sneak-peek) — MEDIUM confidence
- [Backbone: Common field mapping types](https://help.k15t.com/backbone-issue-sync/5.12/server/common-field-mapping-types) — HIGH confidence
- [Linear docs: Jira integration](https://linear.app/docs/jira) — HIGH confidence
- [Linear docs: Issue importer](https://linear.app/docs/import-issues) — HIGH confidence
- [Atlassian Community: enhanced Jira import options for issue types](https://community.atlassian.com/forums/Jira-articles/Enhance-Your-Jira-Imports-New-Options-for-Mapping-Issue-Types/ba-p/2928118) — MEDIUM confidence
- [Atlassian: Map CSV data to Jira fields](https://support.atlassian.com/jira-software-cloud/docs/mapping-csv-data-to-jira-fields/) — HIGH confidence
- [Atlassian: Create work items using the CSV importer](https://support.atlassian.com/jira-software-cloud/docs/create-issues-using-the-csv-importer/) — HIGH confidence
- [Atlassian Cloud Migration: GDPR username changes](https://confluence.atlassian.com/jirasoftwarecloud/gdpr-changes-to-usernames-in-jira-cloud-967319102.html) — HIGH confidence
- [Atlassian: How users and groups are migrated](https://support.atlassian.com/migration/docs/migrate-users-and-groups/) — HIGH confidence
- [Atlassian Developer: Retrieve data mappings (App migration platform)](https://developer.atlassian.com/platform/app-migration/mappings/) — HIGH confidence
- [JRACLOUD-75814: createmeta endpoint behaviour](https://jira.atlassian.com/browse/JRACLOUD-75814) — MEDIUM confidence (issue tracker discussion)
- [JRASERVER-70190: Cloud-to-Server import shows accountIDs not usernames](https://jira.atlassian.com/browse/JRASERVER-70190) — MEDIUM confidence (issue tracker)
- [Flatfile: Advanced Mapping for data migration teams](https://flatfile.com/blog/advanced-mapping-a-new-essential-tool-for-data-migration-teams/) — MEDIUM confidence (vendor blog, but good UX taxonomy)
- [Azure DevOps Migration Tools: Field Mapping Tool](https://devopsmigration.io/docs/reference/tools/field-mapping-tool/) — MEDIUM confidence (open-source reference for transformation strategies)
- [Coefficient: Custom field mapping templates for Salesforce migration](https://coefficient.io/use-cases/custom-field-mapping-templates-salesforce) — MEDIUM confidence (vendor blog; saved-template pattern reference)
- [Atlassian Community discussion: Jira sync tool comparison (Backbone vs Exalate vs Jira-to-Jira)](https://community.atlassian.com/forums/Jira-questions/JIRA-Sync-tools-between-Client-Vendor-acct-Any-preference/qaq-p/2068182) — MEDIUM confidence (user opinions)
- Pmkar codebase: `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `.planning/milestones/v0.3.0-research/FEATURES.md`, `src-tauri/src/`, `src/features/` — HIGH confidence (direct analysis)

---

*Feature research for: Pmkar v0.4.0 — Configurable Field Mapping milestone*
*Researched: 2026-04-27*
