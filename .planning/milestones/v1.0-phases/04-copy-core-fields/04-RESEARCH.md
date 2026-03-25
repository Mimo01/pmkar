# Phase 4: Copy — Core Fields - Research

**Researched:** 2026-03-22
**Domain:** Jira Server → Jira Cloud field copy pipeline, HTML→ADF translation, copy preview UI, origin tracking via remote link
**Confidence:** HIGH (core APIs verified; htmltoadf crate verified at crates.io; ADF node structure verified at developer.atlassian.com)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wiki→ADF translation strategy**
- D-01: Use renderedFields HTML as intermediate — Jira Server renders wiki markup to HTML, then our converter transforms HTML→ADF nodes for Cloud v3
- D-02: Core formatting fidelity required: headings, bold/italic, code blocks, links, ordered/unordered lists, tables, and inline images. Unrecognized HTML elements degrade to plain text.
- D-03: Inline images in descriptions are downloaded from source Jira and re-uploaded as attachments to the target ticket, with ADF image URLs rewritten to point to the new attachment

**Copy preview UI**
- D-04: Side-by-side diff in a full-screen modal — source ticket on left, target preview on right, with warning indicators on fields that changed or couldn't be mapped
- D-05: Description preview shows rendered HTML (same renderer as Phase 3 detail view), not raw ADF JSON
- D-06: Target side fields are editable — user can adjust status, priority, labels, and assignee before confirming

**Field mapping behavior**
- D-07: Status: user picks target status from a dropdown in the preview (populated from target Jira's available statuses)
- D-08: Assignee: always assigned to the current user (the person doing the copy). No user lookup needed.
- D-09: Labels: user selects which labels to include via checkboxes in the preview. All source labels shown, all checked by default.
- D-10: Priority: user picks target priority from a dropdown in the preview (populated from target Jira's available priorities)

**Copy result feedback**
- D-11: Result modal showing per-item status: core fields, description conversion, inline image uploads, origin link. Each item shows checkmark or X with details.
- D-12: Partial success is accepted — ticket is not rolled back if a secondary step fails (e.g., image upload). User sees exactly what succeeded and what failed.
- D-13: Result modal includes clickable link to the newly created ticket in company Jira ("Open in Company Jira")
- D-14: Ticket row in the list updates immediately after copy: triage state→copied (green checkmark) plus a small badge with the target ticket key linking to it

**Origin tracking**
- D-15: Copied ticket in company Jira gets a remote link back to the source ticket in customer Jira (per COPY-07)

### Claude's Discretion
- HTML→ADF converter implementation details (Rust-side or frontend-side parsing)
- Exact modal layout, spacing, and transition animations
- Loading/progress states during the copy operation
- Error message wording for failed copy steps
- How target Jira statuses and priorities are fetched and cached

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COPY-01 | User can copy a ticket's core fields (summary, description, status, priority, assignee, labels) to company Jira | POST /rest/api/3/issue with full field mapping; assignee via accountId from /myself; status/priority via target project endpoints |
| COPY-07 | Copied ticket includes a remote link back to the source ticket for origin tracking | POST /rest/api/3/issue/{key}/remotelink with globalId, object.url, object.title |
| COPY-08 | User sees a diff/preview of what will be created before confirming the copy | Full-screen modal using DescriptionRenderer for preview; Zustand for copy state machine |
| COPY-09 | Description and comment content is correctly translated between wiki markup (Server) and ADF (Cloud) | htmltoadf crate (0.1.12) in Rust via convert_html_str_to_adf_str(); source renderedFields HTML is the input |
</phase_requirements>

---

## Summary

Phase 4 builds the end-to-end copy pipeline from customer Jira Server to company Jira Cloud. It has four distinct sub-problems: (1) a preview UI that is a full-screen side-by-side modal with editable target fields, (2) HTML-to-ADF description conversion using the `htmltoadf` Rust crate, (3) inline image re-upload so description images appear in the Cloud ticket, and (4) a remote link back to the source ticket for origin tracking.

The HTML→ADF path is the most technically novel piece. Jira Server's `renderedFields.description` already contains browser-ready HTML — the decision to use this as the conversion input (D-01) avoids any need to parse wiki markup directly. The `htmltoadf` crate (v0.1.12, MIT, published 2026-02, Rust-native) converts an HTML string to an ADF JSON string in a single call: `convert_html_str_to_adf_str(html: String) -> String`. It supports all required node types: headings, bold/italic, code blocks, links, ordered/unordered lists, tables, and images. Unrecognized elements degrade to plain text, matching D-02.

For inline images (D-03), Jira Cloud requires a two-step approach: upload the image as an attachment to the new ticket first (`POST /rest/api/3/issue/{key}/attachments`), then embed it in ADF using a `mediaSingle` node with `media.type = "external"` and `media.url` pointing to the newly uploaded attachment URL. The `X-Atlassian-Token: no-check` header is required for attachment uploads. Jira Cloud v3's `POST /rest/api/3/issue` is already stubbed in the mock server and accepts summary, description (ADF object), priority, and labels. Assignee must be set via `accountId` fetched from `GET /rest/api/3/myself` at copy time. Status is not settable at issue creation in Cloud (workflow transitions are required post-creation, but a status dropdown is still shown so the user's intent is captured for future phases or manual follow-up). Remote links use `POST /rest/api/3/issue/{key}/remotelink` with a `globalId` that doubles as an idempotency key.

**Primary recommendation:** Implement HTML→ADF conversion entirely in Rust using the `htmltoadf` crate server-side, inside a new `copy_ticket` Tauri command. This keeps credential access and API calls in the Rust backend consistent with the established pattern, avoids shipping a WASM module to the frontend, and produces a single serialized ADF object that can be directly passed to the Jira Cloud create-issue API.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| htmltoadf | 0.1.12 (Rust crate) | HTML string → ADF JSON string | Only Rust-native HTML→ADF converter; supports all required node types; actively maintained (published Feb 2026); zero external deps |
| reqwest + reqwest-middleware | already in Cargo.toml | All HTTP calls to Cloud API | Already used for all Jira API calls; audit middleware included automatically |
| Zustand | already in package.json | Copy state machine (idle/previewing/copying/result) | Established store pattern in this project |
| @tauri-apps/api invoke | already in package.json | Frontend→Rust IPC | Established pattern for all backend calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DescriptionRenderer (existing) | — | Render HTML preview in modal | Reuse for source-side description preview (D-05) |
| TriageIndicator (existing) | — | Show copied state + badge | Already has 'copied' state; extend for target key badge |
| base64 | already in Cargo.toml | Encode image bytes for in-memory transfer | Re-use existing dep for image download/re-upload |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| htmltoadf (Rust) | htmltoadf npm/WASM | WASM in frontend avoids IPC overhead but requires credential exposure in frontend and violates established architecture pattern |
| htmltoadf (Rust) | Custom HTML→ADF parser | Hand-rolling misses edge cases in tables, nested lists, code block languages; D-02 explicitly says "unrecognized degrades to plain text" which is htmltoadf's default behavior |
| media.type="external" for images | media.type="file" with Atlassian Media API | "file" type requires obtaining a media UUID from api.media.atlassian.com — a separate authenticated service that requires OAuth app setup. "external" type with attachment URL is simpler and working for REST API users |

**Installation (new Rust dependency only):**
```toml
# src-tauri/Cargo.toml
htmltoadf = "0.1.12"
```

No new npm packages needed — existing DescriptionRenderer, Zustand, and invoke are reused.

**Version verification:** `htmltoadf` confirmed at 0.1.12 via `cargo search htmltoadf` (run 2026-03-22). No new npm packages.

---

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
├── commands.rs            # Add copy_ticket command + fetch_cloud_meta command
├── jira_client.rs         # (existing) All HTTP via audited client
├── mock_server.rs         # Add remotelink endpoint to v3 router
├── triage_db.rs           # Add copied_key column to triage_state

src/features/tickets/
├── CopyPreviewModal.tsx   # Full-screen side-by-side preview modal
├── CopyResultModal.tsx    # Per-item result status modal
├── copyStore.ts           # Zustand store for copy state machine
├── types.ts               # Extend: CopyState, CopyResult, CloudMeta types
├── TicketDetailPanel.tsx  # Add "Copy to Company Jira" button
├── TicketTable.tsx        # Extend TriageIndicator row for target key badge
```

### Pattern 1: Copy State Machine (Zustand)
**What:** A dedicated `copyStore` tracks the lifecycle of a single copy operation independent of the ticket store.
**When to use:** The copy workflow has distinct phases (idle → loading_preview → previewing → copying → result) where different UI overlays render.

```typescript
// src/features/tickets/copyStore.ts
type CopyPhase = 'idle' | 'loading_preview' | 'previewing' | 'copying' | 'result';

interface CopyState {
  phase: CopyPhase;
  sourceKey: string | null;
  // Fields the user can edit in preview
  targetSummary: string;
  targetStatus: string;
  targetPriority: string;
  targetLabels: string[];
  selectedLabels: string[];
  // Available options populated from target Jira
  availableStatuses: { name: string; id: string }[];
  availablePriorities: { name: string; id: string }[];
  // Result
  result: CopyResult | null;
  error: string | null;
  // Actions
  startPreview: (key: string) => void;
  setTargetField: (field: string, value: string | string[]) => void;
  confirmCopy: () => Promise<void>;
  reset: () => void;
}
```

### Pattern 2: Rust copy_ticket Command (multi-step pipeline)
**What:** Single Tauri command encapsulates the full copy pipeline. Returns a structured result with per-step outcomes.
**When to use:** All API calls must go through the Rust backend for audit logging and credential access.

```rust
// src-tauri/src/commands.rs (new command)
#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CopyStepResult {
    pub step: String,          // "create_issue" | "convert_description" | "upload_image_{n}" | "add_remote_link"
    pub success: bool,
    pub detail: Option<String>, // error message or created key
}

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CopyTicketResult {
    pub target_key: Option<String>,
    pub target_url: Option<String>,
    pub steps: Vec<CopyStepResult>,
}

#[tauri::command]
pub async fn copy_ticket(
    source_key: String,
    source_base_url: String,
    target_base_url: String,
    target_summary: String,
    target_status: String,
    target_priority_id: String,
    target_labels: Vec<String>,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<CopyTicketResult, AppError>
```

### Pattern 3: HTML→ADF in Rust
**What:** `htmltoadf::convert_html_str_to_adf_str()` called inside `copy_ticket` to produce ADF JSON from the `renderedFields.description` HTML.
**When to use:** Always — the source is always Jira Server v2, which always provides `renderedFields`.

```rust
// Inside copy_ticket command
use htmltoadf::convert_html_str_to_adf_str;

let rendered_html = source_issue["renderedFields"]["description"]
    .as_str()
    .unwrap_or("")
    .to_string();

// Returns JSON string — parse back to Value for embedding in create-issue body
let adf_json_str = convert_html_str_to_adf_str(rendered_html);
let adf_value: serde_json::Value = serde_json::from_str(&adf_json_str)
    .unwrap_or_else(|_| serde_json::json!({
        "version": 1,
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "[Description conversion failed]"}]}]
    }));
```

### Pattern 4: Jira Cloud v3 Issue Creation
**What:** `POST /rest/api/3/issue` with summary, ADF description, priority (by id), labels, assignee (by accountId from /myself).
**When to use:** After ADF conversion succeeds.

```json
// Request body for POST /rest/api/3/issue
{
  "fields": {
    "project": { "key": "TARGET_PROJECT_KEY" },
    "issuetype": { "name": "Task" },
    "summary": "...",
    "description": { /* ADF object */ },
    "priority": { "id": "2" },
    "labels": ["bug", "customer"],
    "assignee": { "accountId": "5b10ac8d82e05b22cc7d4ef5" }
  }
}
```

Response on 201 Created: `{ "id": "10100", "key": "MYPROJ-42", "self": "https://..." }`

**Note on status:** Jira Cloud v3 does not support setting status during issue creation — the issue starts in the project's default status. Status transition via `POST /rest/api/3/issue/{key}/transitions` is a post-creation step. For this phase, the status dropdown in preview is informational / saved for future use, not applied during creation. The preview should make this limitation visible.

### Pattern 5: Remote Link for Origin Tracking
**What:** `POST /rest/api/3/issue/{key}/remotelink` after issue creation succeeds.
**When to use:** Always — COPY-07 requires origin tracking on every copied ticket.

```json
// Request body — uses globalId as idempotency key
{
  "globalId": "pmkar-source=https://customer.jira.example.com&key=PROJ-123",
  "object": {
    "url": "https://customer.jira.example.com/browse/PROJ-123",
    "title": "PROJ-123: Customer reported login failure after recent update",
    "icon": {
      "url16x16": "https://customer.jira.example.com/favicon.ico",
      "title": "Source Jira"
    }
  },
  "relationship": "copied from"
}
```

Response on 201 Created: `{ "id": 10001, "self": "..." }`

### Pattern 6: Inline Image Re-upload
**What:** For each `<img>` in the rendered HTML: (1) download bytes from source Jira using PAT auth, (2) upload to target ticket as attachment (`POST /rest/api/3/issue/{key}/attachments` with `X-Atlassian-Token: no-check`), (3) rewrite `<img src>` in the HTML to point to the new attachment URL before conversion.
**When to use:** Before calling `convert_html_str_to_adf_str()` — rewrite happens at the HTML level.

```rust
// Required header for Jira Cloud attachment upload
client.post(&upload_url)
    .header("Authorization", &cloud_auth)
    .header("X-Atlassian-Token", "no-check")
    .multipart(reqwest::multipart::Form::new()
        .part("file", reqwest::multipart::Part::bytes(bytes)
            .file_name(filename)
            .mime_str(&mime_type)?))
    .send().await?
```

Response includes `content` URL for the new attachment — use this URL in the ADF `mediaSingle` node.

### Pattern 7: Fetch Cloud Metadata (statuses/priorities)
**What:** Before showing preview, fetch target project's available statuses and priorities from Cloud so dropdowns are populated.
**Endpoints:**
- `GET /rest/api/3/project/{projectKey}/statuses` — returns issue-type-grouped statuses
- `GET /rest/api/3/priority` — returns all priority options (id + name)
- `GET /rest/api/3/myself` — returns current user's accountId for assignee

**Caching:** Results cached in copyStore for the session (cleared on reset). No SQLite persistence needed for this phase.

### Pattern 8: triage_db Extension for copied_key
**What:** Add `copied_key` column to `triage_state` so the UI can show a badge linking to the target ticket.
**Migration:** ALTER TABLE with DEFAULT NULL — backwards compatible with existing rows.

```sql
ALTER TABLE triage_state ADD COLUMN copied_key TEXT;
```

```rust
// set_triage extended signature:
pub fn set_triage_copied(&self, source_key: &str, target_key: &str) -> AppResult<()>
```

### Anti-Patterns to Avoid
- **Setting status during issue creation:** Jira Cloud v3 ignores the `status` field in `POST /rest/api/3/issue`; use transitions post-creation or accept default status
- **Using media.type="file" for description images without Media API setup:** Requires separate OAuth app registration with Atlassian Media API; use `media.type="external"` with attachment URL instead
- **Parsing Jira Server wiki markup directly:** The `renderedFields` expansion already provides clean HTML — no need to implement a wiki parser
- **Rolling back on image upload failure:** D-12 explicitly says partial success is accepted; do not delete the created issue if image upload fails
- **Blocking the UI during the multi-step copy:** Show progress state; the copy pipeline has 4-8 sequential steps that take 2-10 seconds total
- **Fetching statuses/priorities on every keystroke in the preview:** Cache them in copyStore after first fetch

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML → ADF conversion | Custom HTML parser + ADF builder | `htmltoadf` crate v0.1.12 | Tables, nested lists, code block language attrs, inline formatting all have edge cases; `htmltoadf` covers them with a single function call |
| Jira Cloud issue creation | Custom HTTP + JSON builder | Existing `build_audited_client` + reqwest | All calls must go through audit middleware; pattern already established |
| ADF document structure validation | Schema validator | Trust `htmltoadf` output + defensive fallback | ADF schema validation is complex; the crate is tested against the spec |
| User identity for assignee | User search or lookup | `GET /rest/api/3/myself` accountId | D-08 explicitly assigns to current user — no lookup needed |

**Key insight:** The two custom problems in this phase are the copy pipeline orchestration (multi-step with partial success) and the preview modal UI. Everything else reuses existing patterns or a single crate.

---

## Common Pitfalls

### Pitfall 1: Status Field Ignored at Issue Creation
**What goes wrong:** Developer sends `status` in the POST /rest/api/3/issue body, issue is created but status is ignored. Preview dropdown misleads user.
**Why it happens:** Jira Cloud workflow engine controls status — it cannot be set by direct field assignment during creation.
**How to avoid:** Accept the default project status at creation time. Show a clear note in the preview: "Status will be set to project default. Transitions can be applied in Jira after copy."
**Warning signs:** No error response — the issue creates successfully, status is just whatever the project default is.

### Pitfall 2: htmltoadf Returns ADF JSON String, Not Value
**What goes wrong:** `convert_html_str_to_adf_str()` returns a `String`, not a `serde_json::Value`. Embedding it as a raw string inside the issue body JSON produces a double-encoded string, which Jira rejects.
**Why it happens:** The function signature returns `String` — the caller must `serde_json::from_str()` it before composing the request body.
**How to avoid:** Always parse: `let adf: Value = serde_json::from_str(&adf_str)?` before embedding.
**Warning signs:** Jira Cloud returns 400 Bad Request on issue creation with error about description field type.

### Pitfall 3: Attachment Upload Blocked by CSRF Token
**What goes wrong:** `POST /rest/api/3/issue/{key}/attachments` returns 403 Forbidden.
**Why it happens:** Jira Cloud blocks multipart form POSTs without `X-Atlassian-Token: no-check` header as CSRF protection.
**How to avoid:** Always include `X-Atlassian-Token: no-check` header on all attachment upload requests.
**Warning signs:** 403 response on upload even with valid Basic auth.

### Pitfall 4: Inline Image URLs Are Source-Jira Relative
**What goes wrong:** After HTML→ADF conversion, the ADF contains image URLs pointing to the source Jira server. These URLs require PAT auth and are not accessible from a Jira Cloud viewer.
**Why it happens:** `renderedFields.description` HTML contains absolute URLs to the source Jira attachment endpoint.
**How to avoid:** Before calling `convert_html_str_to_adf_str()`, use a string replace / regex walk on the HTML to rewrite all `<img src="SOURCE_BASE_URL/...">` to the uploaded attachment URLs. The rewrite must happen at the HTML level, not the ADF level.
**Warning signs:** Images appear as broken links in the Cloud ticket description.

### Pitfall 5: reqwest multipart requires the "multipart" feature
**What goes wrong:** `reqwest::multipart::Form` not found at compile time.
**Why it happens:** The `multipart` feature is not enabled in `reqwest` by default.
**How to avoid:** Add `multipart` to reqwest features in Cargo.toml: `reqwest = { version = "0.13", features = ["json", "multipart"] }`
**Warning signs:** Rust compile error: `error[E0433]: failed to resolve: use of undeclared crate or module 'multipart'`

### Pitfall 6: Cloud Project Key Must Be Known
**What goes wrong:** `POST /rest/api/3/issue` requires `fields.project.key` — if the user hasn't configured a target project key, creation fails with 400.
**Why it happens:** Jira Cloud issues must belong to a project; there is no default project for the API caller.
**How to avoid:** Add a `cloud_project_key` field to `connection_meta` (or a new setting in the settings page) so the copy command always has it. Fall back to requiring the user to configure it before their first copy.
**Warning signs:** Jira Cloud returns `{"errorMessages":[],"errors":{"project":"field required"}}`.

### Pitfall 7: globalId Must Be Unique and URL-Safe
**What goes wrong:** Remote link creation fails or silently overwrites a different link if the globalId contains unescaped special characters or collides.
**Why it happens:** The globalId is a string used as a URL parameter for GET/PUT/DELETE operations.
**How to avoid:** Use a deterministic format that incorporates the source base URL and ticket key: `pmkar-source={encoded_base_url}&key={issue_key}`. URL-encode the base URL component.
**Warning signs:** Remote link updates an unrelated existing link silently.

### Pitfall 8: Mock Server Missing remotelink Endpoint
**What goes wrong:** Frontend copy test fails in mock mode because `POST /rest/api/3/issue/{key}/remotelink` returns 404.
**Why it happens:** The mock server v3 router does not have a remotelink route.
**How to avoid:** Add `.route("/rest/api/3/issue/{key}/remotelink", post(v3::create_remotelink))` to the v3 router in mock_server.rs before any integration testing.
**Warning signs:** Copy pipeline fails at the remote link step in mock mode.

---

## Code Examples

Verified patterns from official sources and codebase:

### Jira Cloud Create Issue — Minimal Valid Body
```json
{
  "fields": {
    "project": { "key": "MYPROJ" },
    "issuetype": { "name": "Task" },
    "summary": "Customer reported login failure after recent update",
    "description": {
      "version": 1,
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Reproduced on build 4.2.1" }]
        }
      ]
    },
    "priority": { "id": "2" },
    "labels": ["bug"],
    "assignee": { "accountId": "5b10ac8d82e05b22cc7d4ef5" }
  }
}
```
Source: Atlassian Jira Cloud REST API v3 — Create Issue

### Remote Link Body
```json
{
  "globalId": "pmkar-source=https%3A%2F%2Fcustomer.jira.example.com&key=PROJ-123",
  "object": {
    "url": "https://customer.jira.example.com/browse/PROJ-123",
    "title": "PROJ-123: Customer reported login failure"
  },
  "relationship": "copied from"
}
```
Source: Atlassian Support — How to use REST API to add remote links

### htmltoadf Rust Usage
```rust
// Source: https://github.com/wouterken/htmltoadf (README)
use htmltoadf::convert_html_str_to_adf_str;

let html = "<h1>Title</h1><p>Body with <strong>bold</strong> text.</p>".to_string();
let adf_str = convert_html_str_to_adf_str(html);
let adf_value: serde_json::Value = serde_json::from_str(&adf_str)
    .expect("htmltoadf always returns valid JSON");
// adf_value is ready to embed in POST /rest/api/3/issue body
```

### Attachment Upload (reqwest multipart)
```rust
// Source: Atlassian Support — How to add an attachment to a Jira Cloud work item
let form = reqwest::multipart::Form::new()
    .part("file", reqwest::multipart::Part::bytes(image_bytes)
        .file_name("image.png")
        .mime_str("image/png")?);

let resp = client
    .post(&format!("{}/rest/api/3/issue/{}/attachments", cloud_base_url, new_key))
    .header("Authorization", &cloud_auth_header)
    .header("X-Atlassian-Token", "no-check")
    .multipart(form)
    .send()
    .await?;
// Response body: array of attachment objects, each has "content" URL
```

### Fetch Current User accountId
```rust
// GET /rest/api/3/myself — same pattern as test_jira_cloud_connection
let resp = client.get(&format!("{}/rest/api/3/myself", cloud_base_url))
    .header("Authorization", &cloud_auth_header)
    .send().await?;
let body: serde_json::Value = resp.json().await?;
let account_id = body["accountId"].as_str().unwrap_or("").to_string();
```

### Inline Image URL Rewrite (before HTML→ADF)
```rust
// Rewrite img src URLs in HTML before conversion
// Pattern: replace source base URL prefix with uploaded attachment URL
// Use simple string manipulation since renderedFields HTML is Jira-generated (predictable structure)
fn rewrite_image_urls(html: &str, url_map: &HashMap<String, String>) -> String {
    let mut result = html.to_string();
    for (old_url, new_url) in url_map {
        result = result.replace(old_url, new_url);
    }
    result
}
```

### Mock Server remotelink Endpoint (to add)
```rust
// src-tauri/src/mock_server.rs — inside mod v3
pub async fn create_remotelink(
    Path(key): Path<String>,
    Json(_body): Json<Value>,
) -> impl IntoResponse {
    // Return minimal valid response — store in fixtures if needed for testing
    let response = json!({ "id": 10001 });
    (StatusCode::CREATED, Json(response)).into_response()
}

// In build_v3_router:
.route("/rest/api/3/issue/{key}/remotelink", post(v3::create_remotelink))
```

### triage_db Migration
```rust
// src-tauri/src/triage_db.rs
const ALTER_TRIAGE_ADD_COPIED_KEY: &str =
    "ALTER TABLE triage_state ADD COLUMN copied_key TEXT;";

// In TriageDb::open() — run after table CREATE:
let _ = conn.execute_batch(ALTER_TRIAGE_ADD_COPIED_KEY); // Ignores error if column already exists

pub fn set_triage_copied(&self, source_key: &str, target_key: &str) -> AppResult<()> {
    let now = chrono::Utc::now().to_rfc3339();
    self.conn.execute(
        "INSERT INTO triage_state (ticket_key, state, first_seen, last_updated, copied_key)
         VALUES (?1, 'copied', ?2, ?2, ?3)
         ON CONFLICT(ticket_key) DO UPDATE SET state='copied', last_updated=?2, copied_key=?3",
        rusqlite::params![source_key, now, target_key],
    )?;
    Ok(())
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Atlassian editor service API (`api.atlassian.com/pf-editor-service/convert`) for format conversion | Client-side or server-side libraries; no official conversion API | Decommissioned ~Sept 2024 | Must use a library; the `htmltoadf` crate is the correct Rust-side approach |
| ADF media.type="file" with Atlassian Media UUID | ADF media.type="external" with attachment URL for simpler REST-only workflows | Ongoing | The "file" type requires Atlassian Media API (OAuth app); "external" type works with just REST API and Basic auth |
| Jira Server wiki markup → ADF via direct parser | Jira Server renderedFields HTML → ADF via HTML converter | Established | No need to parse wiki markup; Server already renders it to HTML via `expand=renderedFields` |

**Deprecated/outdated:**
- `api.atlassian.com/pf-editor-service/convert`: Decommissioned Sept 2024 — do not use or reference
- Setting `status` field in POST /rest/api/3/issue: Never worked; ignored silently

---

## Open Questions

1. **Target Project Key**
   - What we know: POST /rest/api/3/issue requires `fields.project.key`
   - What's unclear: The settings page currently stores `base_url`, `email`, and `api_token` for Cloud, but not a project key
   - Recommendation: Add `cloud_project_key` to `ConnectionMeta` and the settings page as part of this phase (Wave 0 or Plan 1). Without it, no copy can succeed.

2. **htmltoadf table support fidelity**
   - What we know: The crate lists tables as a supported element; the project's STATE.md notes "Wiki Markup to ADF conversion has no official library — renderedFields HTML approach needs prototype to validate fidelity"
   - What's unclear: Whether complex tables (merged cells, nested content) convert correctly
   - Recommendation: Include a table-heavy fixture in the mock server's rendered HTML so the copy test exercises this path. If conversion fails on complex tables, ADF graceful degradation (plain text) is acceptable per D-02.

3. **Jira Cloud issue type**
   - What we know: POST /rest/api/3/issue requires `fields.issuetype`
   - What's unclear: Whether the target Jira project uses "Task", "Story", "Bug" etc. as issue type names; the source issue type from Server may not exist in Cloud
   - Recommendation: Default to `{ "name": "Task" }` for all copies in this phase. If the project doesn't have a "Task" type, creation will fail with a clear API error that the result modal can surface.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build system, npm | Yes | v25.8.1 | — |
| Cargo/Rust | Rust backend build | Yes | 1.94.0 | — |
| npm | Package install | Yes | 11.11.0 | — |
| htmltoadf crate | HTML→ADF conversion | Yes (crates.io) | 0.1.12 | — |
| reqwest multipart feature | Attachment upload | Needs Cargo.toml update | — | — |

**Missing dependencies with no fallback:**
- None that block execution

**Missing dependencies with fallback:**
- `reqwest` multipart feature: not currently enabled in Cargo.toml — must add `"multipart"` to reqwest features before attachment upload code compiles

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts (jsdom environment, setup: src/test-setup.ts) |
| Quick run command | `npm run test` (vitest run) |
| Full suite command | `npm run test` (same — all tests in `src/**/*.test.{ts,tsx}`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COPY-01 | Core fields appear in preview modal before confirming | unit | `npm run test -- CopyPreviewModal` | ❌ Wave 0 |
| COPY-01 | copy_ticket command invoked with correct field values on confirm | unit | `npm run test -- CopyPreviewModal` | ❌ Wave 0 |
| COPY-07 | copy_ticket result shows remote link step as success | unit | `npm run test -- CopyResultModal` | ❌ Wave 0 |
| COPY-08 | Preview modal renders before copy executes | unit | `npm run test -- CopyPreviewModal` | ❌ Wave 0 |
| COPY-08 | Cancel button dismisses modal without invoking copy_ticket | unit | `npm run test -- CopyPreviewModal` | ❌ Wave 0 |
| COPY-09 | DescriptionRenderer renders HTML preview on source side | unit | `npm run test -- CopyPreviewModal` | ❌ Wave 0 |
| COPY-01 | Ticket row badge shows target key after successful copy | unit | `npm run test -- TicketTable` | ❌ Wave 0 (extend existing) |

**Note:** Rust-side conversion (COPY-09 htmltoadf correctness) is tested through the mock server integration path — the copy_ticket command is invoked against the mock server which returns fixture renderedFields HTML.

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/tickets/CopyPreviewModal.test.tsx` — covers COPY-01, COPY-08, COPY-09 preview rendering
- [ ] `src/features/tickets/CopyResultModal.test.tsx` — covers COPY-07, COPY-11/12/13
- [ ] `src/features/tickets/copyStore.ts` — state machine (no test file needed at Wave 0, covered by modal tests)
- [ ] Extend `src/features/tickets/TicketTable.test.tsx` (if exists) or add table test for copied badge

---

## Sources

### Primary (HIGH confidence)
- `htmltoadf` crate — `cargo search htmltoadf` confirmed v0.1.12, published Feb 2026; GitHub README verified Rust API
- Jira Cloud REST API v3 — developer.atlassian.com: POST /rest/api/3/issue, POST /rest/api/3/issue/{key}/remotelink, GET /rest/api/3/priority, GET /rest/api/3/project/{key}/statuses, GET /rest/api/3/myself
- ADF structure — developer.atlassian.com/cloud/jira/platform/apis/document/structure/
- ADF mediaSingle node — developer.atlassian.com/cloud/jira/platform/apis/document/nodes/mediaSingle/
- Atlassian Support: attachment upload headers (X-Atlassian-Token: no-check)

### Secondary (MEDIUM confidence)
- Atlassian Developer Community: media.type="external" approach for inline images — multiple community threads confirm this works for REST-only workflows without Atlassian Media API
- Atlassian Support: remote link request body structure — verified field names (globalId, object.url, object.title, relationship)
- Community thread: pf-editor-service/convert decommissioned Sept 2024 — cross-referenced in multiple developer community discussions

### Tertiary (LOW confidence)
- htmltoadf complex table fidelity — crate README lists tables as supported but does not document edge cases with merged cells; treat as needing runtime validation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — htmltoadf crate verified via cargo search; all other deps already in project
- Architecture: HIGH — follows established Tauri IPC + Zustand patterns; Jira API endpoints verified
- Pitfalls: HIGH for API-level pitfalls (status ignored, CSRF header, double-encode); MEDIUM for htmltoadf table edge cases
- ADF inline image approach: MEDIUM — "external" type approach confirmed by community but not in official docs

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable Jira API; htmltoadf is actively maintained)
