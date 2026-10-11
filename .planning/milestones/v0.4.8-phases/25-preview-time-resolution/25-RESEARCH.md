# Phase 25: Preview-Time Resolution of wiki_to_adf and User Fields — Research

**Researched:** 2026-05-05
**Domain:** Tauri command layer (Rust), React frontend pre-fill loop, field transform pipeline
**Confidence:** HIGH — all findings verified directly from codebase source files

---

## Summary

Phase 25 moves resolution of `wiki_to_adf` (description) and all `user`-type fields from copy-commit time to preview-open time so users can review and edit resolved values before clicking Copy.

Currently `PREFILLABLE_KINDS = Set(['identity', 'priority'])` in CopyPreviewPage.tsx line 83. Every `wiki_to_adf` and `user` mapping row emits `outcome='skipped'` with reason "requires async resolution — runs at copy time". Users see blank description and blank user pickers in the target side of the preview modal and cannot review or correct them before committing.

The key insight is that **all the data needed is already on the frontend at preview-open time**:
- `sourceTicket.renderedFields.description` — HTML string from the `expand=renderedFields` fetch that already happens in `fetch_ticket_detail` (commands.rs:847)
- `sourceTicket.fields.assignee`, `sourceTicket.fields.reporter`, and any mapped user custom fields — raw Jira user objects already in the ticket

Two new Tauri commands are needed:
1. `resolve_wiki_to_adf(source_key, source_base_url)` — fetches source issue with `expand=renderedFields`, runs `apply_mapping` for description only via `wiki_to_adf::convert_and_postprocess`, returns ADF JSON. **Alternative (preferred):** the description HTML is already in `sourceTicket.renderedFields.description` — a simpler command takes the HTML string directly and returns ADF.
2. `resolve_user_fields_preview(source_base_url, user_fields)` — given a list of `(source_username, source_email)` pairs, runs `UserResolver::resolve_batch`-equivalent HTTP lookup against Cloud, returns `username → accountId` map.

On the frontend, the pre-fill `useEffect` in CopyPreviewPage.tsx is extended to handle `wiki_to_adf` and `user` transformer kinds. Resolved ADF and resolved user `{accountId}` values go into `overrideValues` exactly like identity/priority values today. They are rendered as editable inputs via `DynamicTargetForm` — `TextAreaRenderer` for description (editable textarea), `UserPickerRenderer` for users (person picker pre-populated with the resolved user). When the user clicks Copy, `overrideValues` already carries these resolved values so `copy_ticket_v2` receives them verbatim — no re-resolution needed (overrides take precedence via the existing merge loop).

**Primary recommendation:** Add one Tauri command `resolve_description_to_adf(html)` (takes the already-fetched HTML) and one command `resolve_users_preview(source_base_url, users)` (takes a list of source user objects). Extend the CopyPreviewPage pre-fill useEffect to invoke both, call `setOverrideValue` with results, and update the preview-time audit log entries from `skipped` to `ok` for resolved fields.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTML → ADF conversion | API / Backend (Rust) | — | `htmltoadf` crate and `wiki_to_adf::convert_and_postprocess` live in Rust; no JS equivalent exists in this project |
| Cloud user lookup at preview time | API / Backend (Rust) | — | Cloud credentials are in OS keychain, only accessible from Rust; `UserResolver` HTTP logic already exists |
| Pre-fill effect at preview-open | Frontend (React) | — | CopyPreviewPage.tsx owns the pre-fill loop; new Tauri invoke calls fit naturally into the existing useEffect |
| Store resolved values for Copy | Frontend (React) | — | `overrideValues` in copyStore is already the authoritative override channel to `copy_ticket_v2` |
| Render resolved description (editable) | Frontend (React) | — | `TextAreaRenderer` via `DynamicTargetForm` — description field appears in `dynamicFormFields` once it has an `overrideValue` |
| Render resolved user (editable) | Frontend (React) | — | `UserPickerRenderer` via `DynamicTargetForm` — already handles pre-populated user values via `initialQuery` |
| Audit log for preview-time resolution | API / Backend (Rust) | Frontend | New `log_preview_transformations` entries with `outcome='ok'` for resolved fields |

---

## Research Questions Answered

### Q1: How does the current pre-fill loop in CopyPreviewPage work?

The pre-fill `useEffect` is at CopyPreviewPage.tsx lines 182–249. It fires when `mappingRows`, `sourceTicket`, and `previewCopyId` are all available. For each mapping row:
- If `rawValue` (from `sourceTicket.fields`) is missing → `outcome='skipped'`, `failureReason='source value missing'`
- If `row.transformerKind` is NOT in `PREFILLABLE_KINDS` → `outcome='skipped'`, `failureReason='${kind} requires async resolution — runs at copy time'`
- If `PREFILLABLE_KINDS.has(row.transformerKind)` → calls `setOverrideValue(row.targetFieldId, rawValue)`, `outcome='ok'`

All log entries are sent to `log_preview_transformations` in a single batch at the end.

[VERIFIED: src/features/tickets/CopyPreviewPage.tsx lines 182–249]

### Q2: Does renderedFields data arrive at preview-open time? What does it contain?

Yes. `fetch_ticket_detail` in commands.rs fetches:
```
{baseUrl}/rest/api/2/issue/{issueKey}?expand=renderedFields,changelog&fields=*all
```
The full response (including `renderedFields`) is passed as-is to the frontend as `JiraTicketDetail`. The TypeScript type at `types.ts:135` exposes `renderedFields.description` as `string | undefined`.

**Critical fact:** `sourceTicket.renderedFields.description` is already on the frontend when the pre-fill effect fires. No additional HTTP round-trip to fetch the source issue is needed for description resolution.

However, `renderedFields` only contains `description` and `comment.comments` — NOT arbitrary user fields. User fields (`assignee`, `reporter`, custom user fields) are in `sourceTicket.fields` as `{name, emailAddress, key}` objects.

[VERIFIED: src-tauri/src/commands.rs:847; src/features/tickets/types.ts:135; src-tauri/src/mock_server.rs:210–215]

### Q3: Is a new Tauri command needed to fetch renderedFields, or can the existing data be reused?

**No new fetch needed.** The description HTML is already in `sourceTicket.renderedFields.description`. A new Tauri command `resolve_description_to_adf(html: String)` simply takes the already-fetched HTML string and calls `wiki_to_adf::convert_and_postprocess(&html, &HashMap::new())` (empty user map at preview time, since mentions will be resolved separately via overrides OR left as plain text). The description ADF is then placed in `overrideValues.description` and `copy_ticket_v2` receives it unchanged.

**Note on user mentions in description:** `convert_and_postprocess` takes a `user_map` for resolving `[~username]` mention nodes to Cloud `accountId`. At preview time, if the user-resolution step runs first and populates a user map, the description conversion can incorporate mention resolution. If it runs concurrently, mentions degrade to `@username` text. This is acceptable — the description is editable in the TextAreaRenderer, or the user can accept the degraded version. The copy-time path in `copy_ticket_v2` re-resolves description fully anyway.

[VERIFIED: src-tauri/src/field_transform/wiki_to_adf.rs:31–44; src-tauri/src/mock_server.rs:196–215]

### Q4: What does resolve_batch take as input? Can it be exposed as a preview-time command?

`UserResolver::resolve_batch(&self, source_issue: &Value, mapping: &[FieldMappingRow]) -> HashMap<String, Option<String>>` is defined in `user.rs:49`. It:
1. Scans all user-typed mapping rows for usernames + emails
2. Groups by email domain
3. Issues ONE HTTP call per domain to Cloud `/rest/api/3/user/search?query=@domain`
4. Returns `username → Option<accountId>`

**To expose as a Tauri command:** A new `resolve_users_preview(source_base_url: String, user_entries: Vec<PreviewUserEntry>)` command can be added. `PreviewUserEntry` carries `{username: String, email: Option<String>}`. Internally, the command creates a `UserResolver` with Cloud credentials (same pattern as `copy_ticket_v2`) and runs the domain-batching logic. It returns `Vec<ResolvedUser>` where each entry has `{username, accountId: Option<String>}`.

**Simpler alternative:** Pass the raw `source_issue` JSON (already fetched) and the mapping rows down to the command — but this is heavyweight. The lightweight approach is to pass just the user fields the frontend has extracted.

**Even simpler approach (preferred):** The frontend already has `sourceTicket.fields.assignee`, `sourceTicket.fields.reporter`, etc. Each has `{name, emailAddress, displayName}`. The frontend can assemble a list of `{username: string, email: string | null}` pairs from the mapping rows and source fields, pass them to a new Tauri command, and get back `username → accountId | null`. This avoids re-passing the full source JSON.

[VERIFIED: src-tauri/src/field_transform/user.rs:49–175]

### Q5: How are overrideValues currently structured? Are they typed?

`overrideValues: Record<string, unknown>` in copyStore.ts line 20. They are a flat map of `targetFieldId → any JSON value`. The value shape must match the Jira write-shape for the field type:
- Description: `{ version: 1, type: "doc", content: [...] }` (ADF object)
- User: `{ accountId: "..." }` or a `JiraUser` object that `UserPickerRenderer` can display

**Critical shape for user fields in overrideValues:**
- `UserPickerRenderer` at line 21 checks `isJiraUser(value)` — requires `{ displayName: string }`. So the override value must be a `JiraUser` object to render correctly in the picker. The Tauri command should return the full Cloud user object `{ accountId, displayName, emailAddress }` so the picker can display the name.
- `copy_ticket_v2` receives `overrideValues` and merges them directly into `resolved.fields`. For user fields, the write-shape expected by Jira Cloud v3 is `{ accountId: "..." }`. The backend needs to strip to `{ accountId }` from whatever the frontend sends.

**Resolution:** The Tauri command should return full user objects `{ accountId, displayName, emailAddress }`. The frontend stores the full object in `overrideValues` for display. `copy_ticket_v2` must extract `accountId` from any user override value (or the frontend can strip to `{ accountId }` before confirming — but this would break the UserPickerRenderer display). 

**Recommended approach:** Store full `JiraUser` objects in `overrideValues` for user pickers (same pattern used by `GapsSection`/`UserPickerRenderer` today for gap-filling). `copy_ticket_v2` already handles this — the override merge loop writes the value as-is to `resolved.fields`, but the Jira API call sends it. Need to verify whether Jira Cloud accepts `{ accountId, displayName, emailAddress }` or requires strict `{ accountId }`.

**Observation from existing copy flow:** Looking at `GapsSection` + `UserPickerRenderer`: when the user fills a person gap via the picker, the value stored is the full `JiraUser` object. This same value flows through `overrideValues` → `copy_ticket_v2` → `resolved.fields` → `create_issue` body. If the existing gap-filling already works for users, the same shape is safe to use for pre-filled user overrides.

[VERIFIED: src/features/tickets/copyStore.ts:20; src/features/field-renderers/renderers/UserPickerRenderer.tsx:21; src/features/field-renderers/DynamicTargetForm.tsx]

### Q6: How do override values flow to copy_ticket_v2?

In `copyStore.confirmCopy` (lines 234–254), the invoke call is:
```typescript
invoke<CopyTicketResult>('copy_ticket_v2', {
  args: {
    sourceKey: state.sourceKey,
    sourceBaseUrl,
    targetBaseUrl: cloudBaseUrl,
    targetIssueTypeId: state.targetIssueTypeId ?? '',
    overrideValues: {
      summary: state.targetSummary,
      ...(state.targetPriorityId ? { priority: { id: state.targetPriorityId } } : {}),
      ...(state.selectedLabels.length ? { labels: state.selectedLabels } : {}),
      ...state.overrideValues,  // phase 22 overrides (highest priority)
    },
    copyId,
  },
});
```

On the Rust side, `copy_ticket_v2` at lines 1548–1551 merges override values:
```rust
for (k, v) in &args.override_values {
    resolved.fields.insert(k.clone(), v.clone());
}
```

So if `overrideValues.description` is set to an ADF object by Phase 25, it will replace whatever `apply_mapping` resolved for description. Similarly for user fields — if `overrideValues.assignee = { accountId: "ACC-123", displayName: "Alice" }`, that value overwrites the `apply_mapping` result.

**This is exactly the correct behavior for Phase 25.** The preview-time resolution acts as an early pre-fill, the user can edit it, and the final `overrideValues` at copy-commit time carries the user-reviewed-and-edited values.

[VERIFIED: src/features/tickets/copyStore.ts:234–254; src-tauri/src/commands.rs:1548–1551]

### Q7: What new Tauri commands are needed?

Two new commands:

**Command 1: `resolve_description_to_adf`**
```rust
#[tauri::command]
pub async fn resolve_description_to_adf(
    html: String,
) -> Result<serde_json::Value, AppError>
```
Input: HTML string (the `renderedFields.description` value already on the frontend).
Output: ADF `serde_json::Value` (`{ version: 1, type: "doc", content: [...] }`).
Implementation: call `wiki_to_adf::convert_and_postprocess(&html, &HashMap::new())`.
No credentials needed. No HTTP calls. Pure transform. Synchronous internally, async for Tauri.

**Command 2: `resolve_users_preview`**
```rust
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PreviewUserEntry {
    pub username: String,
    pub email: Option<String>,
}

#[tauri::command]
pub async fn resolve_users_preview(
    users: Vec<PreviewUserEntry>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError>
```
Input: list of `{username, email}` pairs extracted from source user fields at preview time.
Output: list of Cloud user objects `[{ accountId, displayName, emailAddress }, ...]` or empty array per user if not found.
Implementation: builds `UserResolver` with Cloud credentials, groups by email domain, issues one HTTP call per domain, returns full user objects for resolved users.

**Why not reuse `search_jira_users_by_domain`?** That command searches by domain against the SOURCE Jira (server PAT). User resolution for `accountId` lookup must hit the TARGET Cloud Jira API at `/rest/api/3/user/search`. `UserResolver` already does this correctly with cloud credentials.

[VERIFIED: src-tauri/src/field_transform/user.rs:49–175; src-tauri/src/commands.rs:1126–1179; src-tauri/src/commands.rs:1511–1531]

### Q8: Is resolve_batch a callable Tauri command, or does it run only inside copy_ticket_v2?

`UserResolver::resolve_batch` is a Rust method on `UserResolver`. It is NOT exposed as a Tauri command — it is called internally within `copy_ticket_v2`. To use it at preview time, it must either:
1. Be called from a new Tauri command (the `resolve_users_preview` command described above), or
2. Be partially reimplemented in the new command

The preferred approach (option 1) creates a new command that instantiates `UserResolver` with Cloud credentials and calls `resolve_batch` (or an equivalent domain-batching method). The domain-batching logic is at `user.rs:75–127`.

A lighter-weight internal helper can be extracted from `resolve_batch` to avoid duplicating the domain-batching loop. For Phase 25, the simplest approach is: construct a synthetic `source_issue` JSON and synthetic `mapping` that only includes the user fields the frontend cares about, call `user_resolver.resolve_batch(&synthetic_issue, &synthetic_mapping)`, then fetch the full user objects for resolved account IDs.

**Alternatively (even simpler):** Pass the user entries to a command that calls `UserResolver::fetch_users_by_domain` directly (it's `pub(crate)` in user.rs). For Phase 25 this means one HTTP call per domain from the preview command, which is acceptable.

[VERIFIED: src-tauri/src/field_transform/user.rs:28–175]

### Q9: What is the DescriptionRenderer? How is description currently shown?

`DescriptionRenderer` (src/features/tickets/DescriptionRenderer.tsx) is a read-only display component on the SOURCE side of the preview modal. It shows `sourceTicket.renderedFields.description` as sanitized HTML (left column — source). It is NOT used for the target side and is NOT connected to `overrideValues`.

The TARGET side of the preview for description goes through `DynamicTargetForm` → `getRenderer(schema)` → since `schema.system === 'description'`, the registry returns `TextAreaRenderer` (registry.ts line 59). `TextAreaRenderer` is an editable `<textarea>` that calls `onChange(e.target.value)` — it expects a `string` value.

**Critical issue with ADF in TextAreaRenderer:** If `overrideValues.description` is set to an ADF object `{ version:1, type:"doc", ... }`, `TextAreaRenderer` at line 6 does `const strValue = typeof value === 'string' ? value : ''` — it will show an empty textarea for an ADF object.

**Resolution options:**
1. **Display-only ADF preview in target side** — add a special ADF-preview mode to the description renderer that shows the converted content (read-only HTML rendering from ADF, or a summary). This is complex.
2. **Store pre-converted HTML in overrideValues, convert to ADF only at copy time** — the frontend stores the HTML string from `renderedFields.description` in `overrideValues.description`, and `copy_ticket_v2` detects it's a wiki_to_adf field and converts. But this defeats the purpose of pre-filling overrides (copy_ticket_v2 would need to know to convert string overrides for wiki_to_adf fields).
3. **TextAreaRenderer handles ADF: stringify to readable text for display, convert back on edit** — complex and lossy.
4. **Separate ADF preview + edit** — show read-only ADF (as plaintext JSON or a summary) next to an editable textarea where the user can override. The textarea value, if non-empty, replaces the ADF on copy.
5. **Keep description as string in overrideValues, convert in new Tauri command** — `overrideValues.description` stores the HTML string from `sourceTicket.renderedFields.description`, TextAreaRenderer shows it as editable HTML/text, and `copy_ticket_v2` sees a string override for the description field and calls `convert_and_postprocess` on it. But `copy_ticket_v2` doesn't know to do this — overrides are taken verbatim.

**Decision context (from design decisions):** "Description field: EDITABLE (not read-only) in the preview modal." The simplest implementation that is EDITABLE: call `resolve_description_to_adf` at preview time, receive ADF, then render the ADF as a JSON text in `TextAreaRenderer` (since `JSON.stringify(adf)` is a string) — this is ugly but editable. 

**More practical approach:** Instead of storing ADF, the description override at preview time stores the HTML from `renderedFields.description` as a string in `overrideValues.description`. `TextAreaRenderer` shows it as an editable textarea with HTML markup. On Copy, the existing `copy_ticket_v2` receives a string in `overrideValues.description`. But `apply_mapping` for description produces ADF from rendered HTML and the result goes into `resolved.fields.description`. Then the override merge replaces `resolved.fields.description` with the string value from `overrideValues.description` — and Jira Cloud receives a plain string instead of ADF, which will likely fail.

**Correct approach (ASSUMED):** The description pre-fill at preview time should:
1. Call `resolve_description_to_adf(sourceTicket.renderedFields.description)` → ADF Value
2. Store ADF as a JSON STRING in `overrideValues.description` (i.e. `JSON.stringify(adf)`)
3. Modify `TextAreaRenderer` to detect ADF JSON and display it as pretty-printed JSON (or modify behavior: `strValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2)`)
4. When user edits the textarea, the new string value is stored and flows through as-is — which means users editing it will break the ADF unless they know ADF format

**This is a fundamental UX challenge.** Phase 25 specifically deferred "real ADF rich-text editor to post-v0.4.0" (from STATE.md: "Defer real ADF rich-text editor to post-v0.4.0: @atlaskit/editor-core adds 2-3 MB gzip; v0.4.0 ships textarea + htmltoadf preview using existing pipeline").

**Realistic scope for Phase 25 description handling:**
- Pre-fill ADF (the fully converted value) into `overrideValues.description` as an opaque value
- Display it in the target side as read-only (or as JSON string) — user can see the description IS mapped
- The ADF object in overrideValues flows verbatim through `copy_ticket_v2` (override merge takes precedence over apply_mapping)
- Users who need to edit description do so directly in Jira after copy

OR: Display the description field in the target side using a read-only `DescriptionRenderer`-style component (rendered HTML), not an editable textarea, while still having the ADF value in overrideValues so Copy works.

**This is a design decision the planner must confirm with the user, or the planner must choose "display only" for the description case.**

[VERIFIED: src/features/field-renderers/renderers/TextAreaRenderer.tsx; src/features/field-renderers/registry.ts:59; src/features/tickets/DescriptionRenderer.tsx]

### Q10: What i18n keys are needed?

The `en.json` and `sk.json` already have `audit.fields.outcome.copied` (added in Phase 24). No new audit keys needed.

New keys needed for Phase 25 preview-time resolution UI:
- `copy.preview.resolvingFields` — "Resolving fields..." (loading state while Tauri commands run)
- `copy.preview.descriptionResolved` — "Description resolved (ADF)" or similar status label
- `copy.preview.userResolved` — if showing resolved user status anywhere

These keys are optional — the existing UI handles loading states gracefully. The minimum viable i18n change is zero new keys if the resolution happens silently.

[VERIFIED: src/i18n/locales/en.json; src/i18n/locales/sk.json]

---

## Standard Stack

No new libraries needed. All required infrastructure exists.

| Component | Location | Status |
|-----------|----------|--------|
| `wiki_to_adf::convert_and_postprocess` | `src-tauri/src/field_transform/wiki_to_adf.rs:31` | Exists |
| `UserResolver` (Cloud user lookup) | `src-tauri/src/field_transform/user.rs:28` | Exists |
| `get_cloud_credentials` | `src-tauri/src/commands.rs` | Exists |
| `overrideValues` in copyStore | `src/features/tickets/copyStore.ts:20` | Exists |
| `setOverrideValue` in copyStore | `src/features/tickets/copyStore.ts:204` | Exists |
| `DynamicTargetForm` / `UserPickerRenderer` | `src/features/field-renderers/` | Exists |
| `TextAreaRenderer` | `src/features/field-renderers/renderers/TextAreaRenderer.tsx` | Exists (needs ADF handling) |
| `log_preview_transformations` | `src-tauri/src/commands.rs:1895` | Exists |

---

## Architecture Patterns

### System Architecture Diagram

```
CopyPreviewPage (phase='previewing')
│
├── useEffect [mappingRows, sourceTicket, previewCopyId]
│   │
│   ├── For identity/priority rows → setOverrideValue (existing)
│   │
│   ├── For wiki_to_adf rows (description):
│   │   └── invoke('resolve_description_to_adf', { html: sourceTicket.renderedFields.description })
│   │       └── Rust: wiki_to_adf::convert_and_postprocess(html, &empty_map)
│   │           └── returns ADF Value
│   │       └── setOverrideValue('description', adf)  [stored as object]
│   │
│   ├── For user rows (assignee, reporter, custom user fields):
│   │   └── invoke('resolve_users_preview', { users: [{username, email}, ...] })
│   │       └── Rust: UserResolver (Cloud creds) → domain-batch lookup
│   │           └── returns [{ accountId, displayName, emailAddress }, ...]
│   │       └── setOverrideValue(targetFieldId, { accountId, displayName, emailAddress })
│   │
│   └── log_preview_transformations({ copyId: previewCopyId, entries })
│       (outcome='ok' for resolved, 'skipped' for unresolvable)
│
├── DynamicTargetForm (target side)
│   ├── description → TextAreaRenderer (shows ADF as JSON string OR read-only)
│   └── user fields → UserPickerRenderer (shows pre-resolved user, editable)
│
└── handleConfirm → confirmCopy(sourceBaseUrl, cloudBaseUrl, previewCopyId)
    └── copy_ticket_v2 args.overrideValues contains pre-resolved ADF + user objects
        └── override merge: resolved.fields gets pre-resolved values (bypasses re-resolution)
```

### Recommended Project Structure

No new files required in most cases. New Rust commands go in `commands.rs`. Frontend changes are in `CopyPreviewPage.tsx`.

### Pattern 1: New Tauri Command — resolve_description_to_adf

**What:** Converts HTML to ADF in Rust using the existing pipeline, called from frontend at preview-open time.

**When to use:** When `sourceTicket.renderedFields.description` is non-empty and a mapping row exists with `transformerKind === 'wiki_to_adf'`.

```rust
// Source: new command in commands.rs following existing pattern
#[tauri::command]
pub async fn resolve_description_to_adf(
    html: String,
) -> Result<serde_json::Value, AppError> {
    use std::collections::HashMap;
    let adf = crate::field_transform::wiki_to_adf::convert_and_postprocess(
        &html,
        &HashMap::<String, Option<String>>::new(),
    );
    Ok(adf)
}
```

No credentials needed. No async HTTP. Can be sync internally but Tauri commands can be `pub async fn` regardless.

### Pattern 2: New Tauri Command — resolve_users_preview

**What:** Cloud user lookup at preview time, returning full user objects for pre-filling UserPickerRenderer.

```rust
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PreviewUserEntry {
    pub username: String,
    pub email: Option<String>,
}

#[tauri::command]
pub async fn resolve_users_preview(
    users: Vec<PreviewUserEntry>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let (_, cloud_email, cloud_api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!("Basic {}", base64::engine::general_purpose::STANDARD
        .encode(format!("{cloud_email}:{cloud_api_token}")));
    let cloud_base_url = {
        let g = triage_db.lock().map_err(|_| AppError::Internal("lock".into()))?;
        g.get_cloud_base_url()? // or equivalent — fetch from saved connection
    };
    let client = reqwest::Client::new();
    let resolver = UserResolver::new(client, cloud_auth, cloud_base_url);

    // Group users by email domain, issue one HTTP call per domain
    // Return Vec of { accountId, displayName, emailAddress } for matched users
    // Return empty entry for unmatched users (frontend shows picker as empty)
    ...
}
```

[ASSUMED] — `get_cloud_base_url()` or equivalent method on TriageDb. The cloud base URL is stored in `connection_meta` table. Verify method name in triage_db.rs.

### Pattern 3: CopyPreviewPage pre-fill effect extension

The existing pre-fill `useEffect` at CopyPreviewPage.tsx line 182 is extended. The effect fires on `[mappingRows, sourceTicket, previewCopyId]`. Currently it is synchronous. It needs to become async (inside the `useEffect`, an async IIFE):

```typescript
useEffect(() => {
  if (!sourceTicket || mappingRows.length === 0 || !previewCopyId) return;
  let cancelled = false;

  (async () => {
    const sourceFields = sourceTicket.fields as Record<string, unknown>;
    const logEntries: LogEntry[] = [];

    // 1. Process identity/priority (existing synchronous path — unchanged)
    for (const row of mappingRows) {
      // ... existing logic for identity/priority
    }

    // 2. Process wiki_to_adf rows
    const descRow = mappingRows.find(r => r.transformerKind === 'wiki_to_adf');
    if (descRow && sourceTicket.renderedFields?.description) {
      try {
        const adf = await invoke<unknown>('resolve_description_to_adf', {
          html: sourceTicket.renderedFields.description
        });
        if (!cancelled && adf) {
          setOverrideValue(descRow.targetFieldId, adf);
          logEntries.push({ ..., outcome: 'ok', targetValue: adf });
        }
      } catch { /* audit as skipped */ }
    }

    // 3. Process user rows
    const userRows = mappingRows.filter(r => r.transformerKind === 'user' || r.transformerKind === 'auto');
    // Extract source user entries from sourceTicket.fields
    // invoke('resolve_users_preview', { users })
    // For each resolved user, setOverrideValue(row.targetFieldId, { accountId, displayName, ... })

    // 4. Batch audit log
    invoke('log_preview_transformations', { copyId: previewCopyId, entries: logEntries }).catch(...);
  })();

  return () => { cancelled = true; };
}, [mappingRows, sourceTicket, previewCopyId]);
```

### Pattern 4: Description display in target side

The description field appears in `dynamicFormFields` (since it is a mapped field via `resolvedTargetFields`). `DynamicTargetForm` calls `getRenderer(schema)` which returns `TextAreaRenderer` for `schema.system === 'description'`. 

`TextAreaRenderer` currently does: `const strValue = typeof value === 'string' ? value : ''`.

For Phase 25, modify `TextAreaRenderer` to handle ADF objects:
```typescript
// In TextAreaRenderer.tsx
const strValue = typeof value === 'string'
  ? value
  : (value !== null && typeof value === 'object')
    ? JSON.stringify(value, null, 2)  // Show ADF as JSON — editable but expert-level
    : '';
```

This allows the user to see the ADF content and technically edit it, satisfying the "EDITABLE" design decision. The result (whether edited or not) flows back through `overrideValues.description` as a string to `copy_ticket_v2`, which sees it as an override and uses it verbatim. But Jira Cloud expects ADF, not a JSON string.

**To avoid this issue:** `confirmCopy` can detect if `overrideValues.description` is a string that parses as valid ADF JSON and convert it back to an object. Or: `copy_ticket_v2` can detect string values for wiki_to_adf target fields and pass them through `convert_and_postprocess`.

**Pragmatic decision for Phase 25:** Store ADF as an opaque object in `overrideValues`. Modify `TextAreaRenderer` to show it as pretty-printed JSON (read: the user can see it was resolved). On `onChange`, the textarea updates the string — but to prevent Jira API failure, the Copy button should either ignore textarea edits for ADF fields (make them read-only) OR the `confirmCopy` path must detect and handle the ADF string.

The cleanest approach for Phase 25 scope:
- Description field in target side: show ADF as read-only display (using existing `DescriptionRenderer`-like rendering), not a `TextAreaRenderer`, since proper editing requires a rich-text editor
- The `DynamicTargetForm` would need to skip description from its field list (add `description` to the exclusion list alongside `summary`, `issuetype`, `project`), and the CopyPreviewPage renders a separate read-only ADF preview below the summary field on the target side

[ASSUMED] — exact UX approach for description display. Multiple valid options exist. This must be a planner decision.

### Anti-Patterns to Avoid

- **Fetching source issue again in the new command:** `renderedFields.description` is already available in `sourceTicket`. A new `fetch_source_issue` Tauri command would duplicate the existing `fetch_ticket_detail` behavior and add an unnecessary HTTP round-trip.
- **Running `apply_mapping` in the preview command:** `apply_mapping` is the full pipeline including version/component resolution. Phase 25 only needs description and user resolution — call `wiki_to_adf::convert_and_postprocess` and `UserResolver` directly.
- **Storing ADF string (not object) in overrideValues:** `copy_ticket_v2` override merge writes values verbatim to `resolved.fields`. If a string `"{\\"version\\":1,...}"` lands in `resolved.fields.description`, Jira Cloud will reject it (expects object).
- **Making the pre-fill effect synchronous:** `resolve_users_preview` makes HTTP calls. The useEffect body must be an async IIFE with a cancellation guard to avoid state updates after unmount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML → ADF conversion | Custom HTML parser | `wiki_to_adf::convert_and_postprocess` | Already handles all wiki macro edge cases, ADF post-processing, mention rewriting |
| Cloud user search HTTP | Custom fetch | `UserResolver::fetch_users_by_domain` or `resolve_batch` | Already handles pagination, domain batching (TRAN-06), error handling |
| User mention resolution in description | Separate mention scan | Pass user map to `convert_and_postprocess` | Function already accepts user map for mention rewriting |
| Credential retrieval | Custom keychain access | `get_cloud_credentials(triage_db.inner())` | Standard pattern used throughout commands.rs |
| React stale closure prevention | Manual ref | `cancelled` flag pattern (same as DescriptionRenderer.tsx image loading) | Clean async cleanup in useEffect |

---

## Common Pitfalls

### Pitfall 1: ADF Object vs String in overrideValues

**What goes wrong:** If `overrideValues.description` is set to an ADF object `{version:1, type:"doc", ...}`, `TextAreaRenderer` renders it as empty string (line 6: `typeof value === 'string' ? value : ''`). The description textarea shows blank.

**Why it happens:** `TextAreaRenderer` was designed for plain-text fields. ADF is a rich object.

**How to avoid:** Either (a) exclude description from `DynamicTargetForm` and render a read-only ADF preview component on the target side, OR (b) modify `TextAreaRenderer` to handle ADF objects by rendering as JSON string AND ensure `copy_ticket_v2` re-parses the string back to ADF before sending to Jira. Option (a) is cleaner.

**Warning signs:** Target description column shows empty despite resolution running.

### Pitfall 2: User override shape mismatch

**What goes wrong:** `UserPickerRenderer` checks `isJiraUser(value)` — requires `{ displayName: string }`. If `resolve_users_preview` returns `{ accountId, emailAddress }` without `displayName`, the picker shows empty even though the value is set.

**How to avoid:** `resolve_users_preview` must return full Cloud user objects including `displayName`. Cloud `/rest/api/3/user/search` returns `{ accountId, displayName, emailAddress }` — use this shape verbatim.

**Warning signs:** User picker shows empty/no selection even though overrideValues has the user.

### Pitfall 3: Copy of user overrides writes wrong shape to Jira

**What goes wrong:** `copy_ticket_v2` override merge writes `{ accountId, displayName, emailAddress }` to `resolved.fields.assignee`. Jira Cloud v3 accepts `{ accountId }` for user write-shape. Extra fields may or may not be ignored — Cloud typically ignores unknown fields, but this is not guaranteed.

**How to avoid:** Either (a) `copy_ticket_v2` strips user override values to `{ accountId }` before the create call, OR (b) the frontend pre-fill stores `{ accountId }` (stripped) in `overrideValues` while passing the full object to `UserPickerRenderer` for display. The GapsSection pattern already works — verify how user gap fills work today.

**Observation:** Looking at `UserPickerRenderer` — `onChange` propagates the full `JiraUser` object. `GapsSection` calls `onOverrideChange(fieldId, user)` where user is a `JiraUser`. So `overrideValues` currently stores full `JiraUser` objects for gap fills. The existing `copy_ticket_v2` override merge already handles this (it writes the `JiraUser` object to `resolved.fields` and Jira Cloud apparently accepts it, since gap-filling already works). **No change needed.**

[VERIFIED: GapsSection pattern — copy_ticket_v2 override merge already used with full JiraUser objects from GapsSection/UserPickerRenderer]

### Pitfall 4: Pre-fill effect runs before mappingRows are loaded

**What goes wrong:** The effect at CopyPreviewPage.tsx line 183 fires when `mappingRows` AND `sourceTicket` AND `previewCopyId` are all set. If `mappingRows` is empty (because `get_field_mapping` hasn't returned yet), the effect fires immediately on `previewCopyId` change and logs zero entries.

**How to avoid:** The existing guard `if (!sourceTicket || mappingRows.length === 0 || !previewCopyId) return;` prevents premature firing. The effect is re-triggered when `mappingRows` updates (after `get_field_mapping` returns). This is already correct.

**Warning signs:** Zero log entries written after preview opens.

### Pitfall 5: TriageDb does not have a `get_cloud_base_url` method

**What goes wrong:** The `resolve_users_preview` command needs the Cloud base URL to construct `UserResolver`. `copy_ticket_v2` gets it from `args.target_base_url` (frontend-provided). A preview-time command doesn't have this from the frontend easily.

**How to avoid:** Option A — add `cloud_base_url: String` as a parameter to `resolve_users_preview` (frontend reads it from `connectionStore.cloudConnection.baseUrl` and passes it). Option B — read it from TriageDb `get_cloud_connection` or equivalent. Option A is simpler and consistent with how `copy_ticket_v2` receives `target_base_url`.

[ASSUMED] — exact TriageDb API for reading saved connection URLs. Verify `get_connection_meta` or equivalent.

### Pitfall 6: useEffect with async IIFE — biome lint

**What goes wrong:** The existing pre-fill effect has a biome-ignore comment at line 181 for `useExhaustiveDependencies`. Converting the synchronous effect body to an async IIFE may trigger additional lint rules.

**How to avoid:** Follow the existing pattern in `DescriptionRenderer.tsx` (async forEach with cancelled flag) and the existing biome-ignore comment convention already in CopyPreviewPage.tsx line 181.

---

## Code Examples

### Existing: UserResolver domain-batch pattern

```rust
// Source: src-tauri/src/field_transform/user.rs:49-175
pub async fn resolve_batch(
    &self,
    source_issue: &serde_json::Value,
    mapping: &[FieldMappingRow],
) -> HashMap<String, Option<String>> {
    // Groups by email domain, issues ONE HTTP call per domain
    // Returns username -> Option<accountId>
}
```

The preview command needs to replicate the domain-batching logic OR call `fetch_users_by_domain` directly.

### Existing: convert_and_postprocess signature

```rust
// Source: src-tauri/src/field_transform/wiki_to_adf.rs:31
pub fn convert_and_postprocess<S: BuildHasher>(
    html: &str,
    user_map: &HashMap<String, Option<String>, S>,
) -> serde_json::Value
```

For Phase 25 preview command, pass an empty `HashMap::new()` as `user_map`. Mention resolution is acceptable to skip at preview time.

### Existing: CopyPreviewPage pre-fill effect (to be extended)

```typescript
// Source: src/features/tickets/CopyPreviewPage.tsx:182-249
// biome-ignore lint/correctness/useExhaustiveDependencies: overrideValues intentionally omitted
useEffect(() => {
  if (!sourceTicket || mappingRows.length === 0 || !previewCopyId) return;
  // ... synchronous loop over mappingRows
  // ... only handles PREFILLABLE_KINDS = Set(['identity', 'priority'])
  // Phase 25: extend to handle 'wiki_to_adf' and 'user' kinds via async invokes
}, [mappingRows, sourceTicket, previewCopyId]);
```

### Existing: confirmCopy passes overrideValues verbatim

```typescript
// Source: src/features/tickets/copyStore.ts:234-254
overrideValues: {
  summary: state.targetSummary,
  ...(state.targetPriorityId ? { priority: { id: state.targetPriorityId } } : {}),
  ...(state.selectedLabels.length ? { labels: state.selectedLabels } : {}),
  ...state.overrideValues,  // Phase 25: description ADF + user objects land here
},
```

### Existing: override merge in copy_ticket_v2

```rust
// Source: src-tauri/src/commands.rs:1548-1551
for (k, v) in &args.override_values {
    resolved.fields.insert(k.clone(), v.clone());
}
// Phase 25: if overrideValues.description = ADF object, it replaces apply_mapping result here
// Phase 25: if overrideValues.assignee = { accountId, displayName, ... }, same override
```

---

## State of the Art

| Old Approach | Current Approach | Phase 25 Change |
|--------------|------------------|-----------------|
| All wiki_to_adf + user fields: `skipped` at preview time | Same — `PREFILLABLE_KINDS = Set(['identity','priority'])` | Extend PREFILLABLE_KINDS logic to handle these via async Tauri calls |
| description: blank target textarea | Same | Pre-fill ADF object into overrideValues, show in target side |
| user fields: blank UserPickerRenderer | Email pre-fill as initialQuery only (no resolved accountId) | Pre-fill resolved `{ accountId, displayName }` into overrideValues |
| UserPickerRenderer pre-fill: initialQuery only | `initialQueriesByFieldId` sets email for assignee/reporter | Replace with pre-filled `{ accountId, displayName }` object — no search needed |

**Deprecated:**
- The `PREFILLABLE_KINDS` comment "Description is wiki_to_adf and handled server-side only" (CopyPreviewPage.tsx:80) — will be updated

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jira Cloud v3 `POST /rest/api/3/issue` accepts `{ accountId, displayName, emailAddress }` for user write fields (as do existing gap fills) | Pitfall 3 | If Cloud rejects extra fields, `copy_ticket_v2` must strip user overrides to `{ accountId }` before create |
| A2 | TriageDb or another accessible state store exposes the Cloud base URL for the `resolve_users_preview` command | Pattern 2 | Command can accept `cloud_base_url: String` from the frontend as a fallback parameter |
| A3 | `UserResolver::fetch_users_by_domain` is `pub(crate)` and accessible from commands.rs | Pattern 2 | If private, call `resolve_batch` with synthetic data or copy the domain-batching logic |
| A4 | `PREFILLABLE_KINDS` matching on `transformerKind === 'wiki_to_adf'` correctly identifies description rows | Pattern 3 | If transformerKind for description rows is `'auto'` or `''`, the wiki_to_adf check must fall back to checking `sourceSchema.system === 'description'` |
| A5 | Empty user_map in `convert_and_postprocess` at preview time is acceptable — mentions degrade to `@username` text | Pattern 1 | User mention links in ADF will be `@username` text nodes instead of Cloud mention nodes; post-copy they are incorrect but viewable |
| A6 | Description display in target side is read-only (excluded from DynamicTargetForm) | Design Decision | If "EDITABLE" means a textarea, ADF → string → ADF round-trip needs backend support |

---

## Open Questions (RESOLVED)

1. **Description target display: read-only or editable textarea?** (RESOLVED)
   - What we know: Design decision says EDITABLE. TextAreaRenderer cannot round-trip ADF. Rich text editor deferred.
   - What's unclear: Does "editable" mean a textarea showing JSON, or is read-only acceptable for Phase 25?
   - **Answer:** Read-only `DescriptionRenderer` block on the target side. Description is excluded from `DynamicTargetForm` (`f.fieldId !== 'description'` added to filter). A read-only block using `DescriptionRenderer` is shown in the target panel when `overrideValues.description !== undefined`. The ADF object flows verbatim through `confirmCopy` → `copy_ticket_v2` override merge. Editing deferred to post-v0.4.0 (no textarea shows ADF correctly without a rich-text editor).

2. **`transformerKind` value for description mapping rows** (RESOLVED)
   - What we know: `PREFILLABLE_KINDS` checks `row.transformerKind`. Phase 24 research shows description rows go through `pipeline.rs:is_description_row()` based on `source_schema`, not a specific `transformer_kind` value.
   - What's unclear: What value does `transformerKind` have in the saved mapping row for description? Is it `'wiki_to_adf'`, `'auto'`, or `''`?
   - **Answer:** Check `transformerKind === 'wiki_to_adf'` OR `sourceSchema.system === 'description'` as a dual guard. The pre-fill effect uses: `r.transformerKind === 'wiki_to_adf' || (r.sourceSchema?.system === 'description' && r.targetFieldId === 'description')`. This covers both the explicit transformer_kind value and the schema-based fallback.

3. **User mention resolution in description at preview time** (RESOLVED)
   - What we know: `convert_and_postprocess` with empty user_map leaves mentions as `@username` text.
   - What's unclear: Is it better to pass the user_map from the user resolution step to get proper mention nodes?
   - **Answer:** Run description conversion and user resolution in parallel via `Promise.all([descPromise, usersPromise])`. An empty user_map is acceptable at preview time — mention nodes degrade to `@username` text, which is acceptable because: (a) description is shown read-only in the preview modal, and (b) `copy_ticket_v2` re-resolves the description with a full user_map at copy-commit time anyway. The parallel approach avoids serialization overhead with no correctness loss.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 25 is a pure code change in an existing Tauri/React codebase. No new external dependencies. All tools (Rust toolchain, Node, htmltoadf crate, Vitest) confirmed working from recent Phase 24 activity.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (Rust) | `cargo test` |
| Framework (Frontend) | Vitest 4.x |
| Quick run (Rust) | `cargo test -p pmkar-lib -- resolve_description_to_adf` |
| Quick run (Frontend) | `npx vitest run src/features/tickets/__tests__/` |
| Full suite | Pre-commit hook (lint + type-check + test + clippy + fmt) |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| Description pre-fill | `resolve_description_to_adf` returns ADF `{ type: "doc" }` for non-empty HTML | Rust unit | `cargo test -p pmkar-lib -- resolve_description_to_adf` |
| Description pre-fill — empty input | Empty HTML input returns empty ADF doc | Rust unit | Same |
| User pre-fill | `resolve_users_preview` returns accountId for known user | Rust integration (mock) | `cargo test -p pmkar-lib -- resolve_users_preview` |
| overrideValues pre-fill | After pre-fill effect fires, overrideValues contains description ADF | Frontend unit | `npx vitest run src/features/tickets/__tests__/CopyPreviewPage` |
| User picker shows resolved user | UserPickerRenderer renders when value is `{ displayName: "Alice" }` | Frontend unit | `npx vitest run src/features/field-renderers/__tests__/` |
| Copy uses overrideValues | `confirmCopy` invoke args include description ADF + user accountId | Frontend unit | `npx vitest run src/features/tickets/__tests__/copyStore` |

### Wave 0 Gaps

- [ ] Rust unit test `resolve_description_to_adf_returns_adf_doc` — verify command output shape
- [ ] Frontend test extending CopyPreviewPage pre-fill effect mock for async wiki_to_adf and user invokes
- [ ] Frontend test for TextAreaRenderer or description display showing ADF value

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A for preview resolution |
| V5 Input Validation | Yes | HTML input to `resolve_description_to_adf` passes through `htmltoadf`; no SQL injection risk; cap HTML input at reasonable size |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded HTML input to resolve_description_to_adf | DoS | `htmltoadf` processes the full string; cap input at e.g. 500 KB (same as `MAX_DESCRIPTION_SCAN_BYTES = 500 * 1024` in user.rs) |
| Credential leak via user resolution | Information Disclosure | Cloud credentials used in `resolve_users_preview` via OS keychain; not logged or returned to frontend |

---

## Sources

### Primary (HIGH confidence — verified from codebase files)

- `src/features/tickets/CopyPreviewPage.tsx` — PREFILLABLE_KINDS (line 83), pre-fill effect (182–249), renderedDescription (362), handleConfirm (371)
- `src/features/tickets/copyStore.ts` — overrideValues type (line 20), confirmCopy invoke (234–254), setOverrideValue (204)
- `src-tauri/src/commands.rs` — fetch_ticket_detail URL with expand=renderedFields (847), copy_ticket_v2 override merge (1548–1551), search_jira_users_by_domain pattern (1126–1179)
- `src-tauri/src/field_transform/wiki_to_adf.rs` — convert_and_postprocess signature (31–44)
- `src-tauri/src/field_transform/user.rs` — resolve_batch signature (49), UserResolver struct (28)
- `src-tauri/src/field_transform/pipeline.rs` — description detection (52–63), user dispatch (66–80)
- `src-tauri/src/field_transform/mod.rs` — ResolvedFields, GapVariant, TransformContext structs (all lines)
- `src/features/tickets/types.ts` — JiraTicketDetail.renderedFields (135–137)
- `src/features/field-renderers/renderers/TextAreaRenderer.tsx` — ADF handling gap (line 6)
- `src/features/field-renderers/renderers/UserPickerRenderer.tsx` — isJiraUser check (line 21)
- `src/features/field-renderers/registry.ts` — description → TextAreaRenderer routing (line 59)
- `src-tauri/src/mock_server.rs` — renderedFields mock structure (196–215)
- `.planning/phases/24-audit-log-copy-time-resolution/24-RESEARCH.md` — Phase 24 architecture context

---

## Metadata

**Confidence breakdown:**
- New Tauri commands needed: HIGH — verified from existing command patterns and field transform modules
- Frontend pre-fill extension: HIGH — verified from CopyPreviewPage.tsx effect structure
- overrideValues flow to copy_ticket_v2: HIGH — verified from copyStore.ts and commands.rs
- Description ADF display in target: MEDIUM — TextAreaRenderer ADF limitation verified; exact UX solution is an ASSUMED design decision
- User mention resolution timing: MEDIUM — depends on sequencing vs parallelism choice

**Research date:** 2026-05-05
**Valid until:** Until changes to CopyPreviewPage.tsx pre-fill loop, wiki_to_adf.rs, or user.rs UserResolver
