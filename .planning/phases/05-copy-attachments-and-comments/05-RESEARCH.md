# Phase 5: Copy — Attachments and Comments - Research

**Researched:** 2026-03-22
**Domain:** Jira REST API (attachment download/upload, comment copy, worklog copy), Rust async (reqwest multipart), ADF conversion reuse
**Confidence:** HIGH

## Summary

Phase 5 extends the existing `copy_ticket` command in Rust to handle binary attachments, comment threads, work log entries, sub-tasks, and linked issues. The infrastructure is already in place — multipart upload, `htmltoadf` conversion, `CopyStepResult` reporting, partial-success semantics — and this phase is largely additive: new loops in the existing function body, new mock server routes, and UI updates to the preview and result modals.

The most important architectural insight is that comment rendering is already handled. Jira Server v2 returns HTML-rendered comment bodies under `renderedFields.comment.comments[n].body` when `expand=renderedFields` is passed — and `copy_ticket` already requests that expansion on its source fetch. Comment bodies do not need a separate API call. The HTML-to-ADF pipeline (`htmltoadf` crate) that converts descriptions is equally applicable to comment bodies.

Work log entries are plain-text comment strings in Jira Server v2, not wiki markup — no HTML rendering step is needed. The attribution prefix is prepended as plain text before posting to the Cloud v3 worklog endpoint, which accepts `timeSpentSeconds` (integer) + `started` (ISO 8601) + an optional ADF `comment` field. Sub-tasks and linked issues are appended to the ADF description as plain-text list sections, not created as separate issues (per D-09, D-11) — this is a pure description-construction task, no additional API calls.

**Primary recommendation:** Implement all new logic as sequential additions inside the existing `copy_ticket` function. Extend `stepLabel()` in `CopyResultModal.tsx` to handle new step names. Add a worklog POST route to the mock server (only GET exists today). Keep attachment download/upload sequential (per D-05's "extends inline image pattern") — this matches Phase 4's inline image loop and avoids concurrency complexity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Comments copied with bold prefix line showing original author and date: **[Author Name] — YYYY-MM-DD HH:MM** followed by the comment body on the next line
- **D-02:** Comment bodies converted from wiki markup to ADF using the same renderedFields HTML→ADF pipeline built in Phase 4 (reuse existing converter)
- **D-03:** All comments copied automatically — no per-comment selection in preview
- **D-04:** Comments posted in chronological order (oldest-first) to preserve thread sequence
- **D-05:** All attachments copied automatically — download binary from source Server, upload via multipart to target Cloud ticket (extends existing inline image upload pattern from Phase 4 D-03)
- **D-06:** Per-file status reported in the result modal — each attachment listed as a step with checkmark/X and failure reason (consistent with Phase 4 D-11 pattern). e.g., "screenshot.png", "database-dump.sql (413 too large)"
- **D-07:** Work log entries copied with author attribution prefix (same bold prefix format as comments: **[Author] — YYYY-MM-DD**)
- **D-08:** Work log entries include time spent value in the attribution line
- **D-09:** Sub-tasks are NOT created as child issues in Cloud Jira — they are listed in a "Sub-tasks" section appended to the bottom of the copied description
- **D-10:** Each sub-task entry shows source key + summary (e.g., "CUST-101: Fix login timeout")
- **D-11:** Linked issues are NOT created as remote links — they are listed in a "Linked Issues" section appended to the description footer (below sub-tasks)
- **D-12:** Each linked issue entry shows link type + source key + summary (e.g., "Blocks: CUST-200 — API rate limiting")

### Claude's Discretion

- Attachment download/upload concurrency strategy (sequential vs parallel)
- Error handling for individual attachment/comment failures within the partial-success model
- Mock server enhancements needed for testing attachment and comment copy flows
- How the preview modal displays attachment count, comment count, and sub-task/linked issue lists before copy
- Work log API endpoint details and mock server support

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COPY-02 | User can copy ticket attachments as full binary files (download from source, upload to target) | Attachment download via `Bearer {pat}` to `/secure/attachment/{id}/{filename}` (PAT fixed in Server 8.17+); upload via existing multipart pattern to `/rest/api/3/issue/{key}/attachments` |
| COPY-03 | User can copy ticket comment thread with author attribution prefix | Comment rendered HTML already in `renderedFields.comment.comments[n].body` from existing source fetch; wrap in bold-prefix ADF; post to Cloud v3 `/rest/api/3/issue/{key}/comment` |
| COPY-04 | User can copy ticket work log entries with author attribution | Fetch from `/rest/api/2/issue/{key}/worklog`; build ADF comment with attribution prefix + time spent; POST to `/rest/api/3/issue/{key}/worklog` with `timeSpentSeconds` + `started` |
| COPY-05 | User can copy sub-tasks as child issues under the newly created parent ticket | Per D-09: append "Sub-tasks" section to ADF description instead of creating child issues; no separate API calls |
| COPY-06 | User can copy linked issue references as annotations or remote links | Per D-11: append "Linked Issues" section to ADF description instead of remote links; no separate API calls |
</phase_requirements>

## Standard Stack

### Core (already in project — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| reqwest (plain Client) | 0.13 | Multipart attachment upload | reqwest_middleware lacks .multipart() — established in Phase 4 |
| htmltoadf | existing | HTML-to-ADF conversion for comment bodies | Same pipeline used for description in Phase 4 |
| serde_json | existing | JSON construction for comment/worklog POST bodies | Already project-wide |
| axum | existing | Mock server route additions | Already running both v2 and v3 mock servers |

### No New Dependencies Required

All libraries needed for Phase 5 are already in `Cargo.toml`. The phase is additive — extending existing functions and data structures.

**Installation:** None. No new packages.

**Version verification:** Not applicable — no new dependencies.

## Architecture Patterns

### Recommended Extension Points

```
src-tauri/src/
├── commands.rs          # Extend copy_ticket: add attachment loop, comment loop, worklog fetch+post, description footer
├── mock_server.rs       # Add POST /rest/api/3/issue/{key}/worklog handler (GET exists; POST missing)
└── fixtures.rs          # Ensure PROJ-1 worklog fixtures are rich enough for testing

src/features/tickets/
├── CopyResultModal.tsx  # Extend stepLabel() to handle: attach:{filename}, comment:{n}, worklog:{n}
├── CopyPreviewModal.tsx # Add summary counts: "2 attachments", "3 comments", "1 work log", sub-task and linked issue lists
└── types.ts             # No changes needed — JiraAttachment, JiraComment, JiraWorklog, JiraSubTask, JiraIssueLink already typed
```

### Pattern 1: Attachment Copy Loop (extends inline image pattern from Phase 4)

**What:** For each entry in `source_body["fields"]["attachment"]`, download binary bytes with `Bearer {pat}`, then upload to target via multipart POST. Each file produces a `CopyStepResult` with step name `attach:{filename}`.

**When to use:** Always — all attachments are copied per D-05.

**Example (Rust, extends existing code):**
```rust
// Source: existing inline image loop in commands.rs lines 1057-1156
let attachments = source_body["fields"]["attachment"]
    .as_array()
    .cloned()
    .unwrap_or_default();

for att in &attachments {
    let download_url = att["content"].as_str().unwrap_or("");
    let filename = att["filename"].as_str().unwrap_or("file").to_string();
    // ... same download + multipart upload pattern as inline images ...
    steps.push(CopyStepResult {
        step: format!("attach:{}", filename),
        success: ...,
        detail: ...,
    });
}
```

### Pattern 2: Comment Copy Loop (HTML→ADF with bold attribution prefix)

**What:** Iterate `source_body["renderedFields"]["comment"]["comments"]` in order (oldest-first per D-04). Build ADF body: first paragraph is bold attribution text `**[Author] — YYYY-MM-DD HH:MM**`, subsequent content is the converted HTML comment body. POST to Cloud v3 `/rest/api/3/issue/{key}/comment`.

**When to use:** Always — all comments are copied per D-03.

**Key insight:** `renderedFields.comment.comments` is returned by the existing `expand=renderedFields&fields=*all` fetch in `copy_ticket`. No separate comments API call is needed.

**Mock server note:** The v2 mock server's `get_issue` handler only puts description in `renderedFields`, not comments. The mock must be extended to also render comment bodies in `renderedFields.comment.comments[n].body`.

**ADF body structure for a comment:**
```json
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Jane Doe — 2026-01-15 10:30",
          "marks": [{ "type": "strong" }] }
      ]
    },
    ...converted comment HTML nodes...
  ]
}
```

**Cloud POST endpoint:**
```
POST /rest/api/3/issue/{key}/comment
Authorization: Basic {base64(email:token)}
Content-Type: application/json
X-Atlassian-Token: no-check  (not required for comment, only attachment)

{ "body": <ADF doc above> }
```

### Pattern 3: Work Log Copy (fetch from v2, post to v3)

**What:** Fetch worklogs from Server v2 `GET /rest/api/2/issue/{key}/worklog` (already done by `fetch_worklog` command — can call the same endpoint inline). Build ADF comment with attribution line: `**[Author] — YYYY-MM-DD (Xh)**`. POST each entry to Cloud v3 `/rest/api/3/issue/{key}/worklog`.

**Cloud v3 worklog POST body (verified from official docs):**
```json
{
  "timeSpentSeconds": 7200,
  "started": "2026-01-15T10:00:00.000+0000",
  "comment": {
    "version": 1,
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Jane Doe — 2026-01-15 (2h)",
            "marks": [{ "type": "strong" }] }
        ]
      }
    ]
  }
}
```

**Required fields:** `timeSpentSeconds` (integer) and `started` (ISO 8601 string). `comment` is optional but used for attribution per D-07/D-08.

**Mock server gap:** No POST route exists for `/rest/api/3/issue/{key}/worklog`. The router has `get(v3::get_worklog)` but no `post(...)`. Must add a `add_worklog` handler alongside `add_comment`.

### Pattern 4: Description Footer — Sub-tasks and Linked Issues

**What:** Before the description ADF is built (currently happens in Step 6 of `copy_ticket`), extract `source_body["fields"]["subtasks"]` and `source_body["fields"]["issuelinks"]`. If either list is non-empty, append additional ADF nodes to the converted description's content array.

**Sub-tasks ADF section:**
```json
{ "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "Sub-tasks" }] },
{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [
    { "type": "paragraph", "content": [
      { "type": "text", "text": "PROJ-7: Investigate session token expiry" }
    ]}
  ]}
]}
```

**Linked issues ADF section:**
```json
{ "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "Linked Issues" }] },
{ "type": "bulletList", "content": [
  { "type": "listItem", "content": [
    { "type": "paragraph", "content": [
      { "type": "text", "text": "Blocks: PROJ-3 — API endpoints returning 503 in production" }
    ]}
  ]}
]}
```

**When to use:** Only when subtasks or issuelinks arrays are non-empty.

### Anti-Patterns to Avoid

- **Re-fetching issue for comment rendering:** `renderedFields.comment.comments` is already in the source fetch response — do not make a second call to `/rest/api/2/issue/{key}/comment?expand=renderedBody`. Reuse the data already in `source_body`.
- **Using reqwest_middleware for multipart:** As established in Phase 4, plain `reqwest::Client` must be used for multipart uploads. The attachment upload loop must use the same `plain_client` pattern.
- **Blocking the description update on attachment success:** Inline image URL rewriting depends on upload success; standalone attachments do not change the description. Run attachment loop after the description update (Step 7) to avoid coupling.
- **Constructing ADF manually from scratch:** Reuse `AdfDoc::paragraph()` and build on the existing `AdfNode` types in `fixtures.rs`. Do not use raw `serde_json::json!()` for complex ADF — it bypasses the type-safe helpers.
- **Creating sub-tasks or remote links for linked issues:** D-09 and D-11 explicitly prohibit this. Append to description only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wiki markup → ADF for comment bodies | Custom wiki parser | `htmltoadf` crate via `renderedFields` HTML | Same pattern as description, already validated in Phase 4 |
| Detecting link direction (inward/outward) | String parsing | `issuelinks[n].outwardIssue` / `inwardIssue` + `type.outward`/`type.inward` field names | Already modeled in `JiraIssueLink` struct in fixtures.rs |
| Time formatting (seconds → "2h 30m") | Custom formatter | Use `timeSpent` string from Server v2 worklog response | Jira already provides formatted string — echo it in attribution |

**Key insight:** The attachment download URL is the `content` field in `attachment[n]` — the same URL pattern used for inline images. The auth model (Bearer PAT) is identical. The upload target is the same multipart endpoint. This is not a new pattern; it is the existing pattern applied to a different source.

## Common Pitfalls

### Pitfall 1: renderedFields.comment not populated in mock
**What goes wrong:** Mock server's `get_issue` handler only puts `description` in `renderedFields`. Comment rendering in `renderedFields` is absent from the mock, causing `source_body["renderedFields"]["comment"]` to be null.
**Why it happens:** Phase 4 only needed description rendering — comments were not part of that phase's copy scope.
**How to avoid:** Extend the v2 `get_issue` handler to include `renderedFields.comment.comments` with pre-rendered HTML bodies when `expand=renderedFields` is requested. Format: `{ "renderedFields": { "description": "...", "comment": { "comments": [{ "id": "20001", "body": "<p>I can reproduce this...</p>" }] } } }`.
**Warning signs:** Copy completes with zero comment steps despite the source ticket having comments.

### Pitfall 2: Worklog POST missing from mock router
**What goes wrong:** `copy_ticket` attempts `POST /rest/api/3/issue/{key}/worklog` but the mock has no route for it — axum returns 404 or 405.
**Why it happens:** Only `GET /rest/api/3/issue/{key}/worklog` was needed before.
**How to avoid:** Add `post(v3::add_worklog)` to the v3 router alongside the existing `get(v3::get_worklog)`. The handler can return 201 with a stub worklog object.
**Warning signs:** worklog steps all show 404/405 failure in the result modal during development.

### Pitfall 3: Attachment download URL requires auth on real Jira Server
**What goes wrong:** The `content` field URL (`/secure/attachment/ID/filename`) returns a redirect to the login page (302) if the Jira Server version is < 8.17.0.
**Why it happens:** PAT support for the `/secure/attachment/` endpoint was added in Jira Server 8.17.0 (JRASERVER-72019, resolved as Fixed). Earlier versions require cookie-based auth.
**How to avoid:** The mock server does not enforce this restriction (returns 404 for unknown paths, or can be extended). For real deployments, confirm the customer's Jira Server version is 8.17+. If < 8.17, attachments will silently fail download — the partial-success model already handles this (each attachment gets its own CopyStepResult).
**Warning signs:** 302 response during attachment download step, detail says "Failed to download attachment".

### Pitfall 4: Comment ordering assumption
**What goes wrong:** Comments posted out of chronological order if the source API returns them in a different order.
**Why it happens:** Jira v2 API typically returns comments oldest-first but this is not guaranteed in all versions.
**How to avoid:** Sort comments by `created` field (ISO 8601, lexicographic sort is date-order correct for consistent format) before posting. D-04 requires chronological order.
**Warning signs:** Comment thread in Cloud Jira appears in reverse or random order.

### Pitfall 5: ADF bold marks syntax
**What goes wrong:** The attribution line displays as plain text instead of bold in Cloud Jira.
**Why it happens:** ADF bold is a mark on text nodes, not a wrapper node. `{ "type": "strong" }` must appear in `marks[]` array on the text node.
**How to avoid:** Use `"marks": [{ "type": "strong" }]` on the attribution text node. This is the same pattern as `htmltoadf` produces for `<strong>` tags.
**Warning signs:** Attribution shows plain text like "Jane Doe — 2026-01-15 10:30" without bold in the copied Jira ticket.

### Pitfall 6: timeSpent vs timeSpentSeconds in worklog POST
**What goes wrong:** Posting `timeSpent: "2h"` string to Cloud v3 worklog endpoint returns 400 — the string format is not accepted.
**Why it happens:** Cloud v3 worklog API requires `timeSpentSeconds` (integer) not `timeSpent` (string). The `timeSpent` string is returned in GET responses for display, not accepted in POST requests.
**How to avoid:** Use `timeSpentSeconds` (already present in the Server v2 worklog response) for the POST body. Display `timeSpent` string in the attribution line per D-08.
**Warning signs:** Worklog POST returns 400 with error about invalid time field.

## Code Examples

### Adding an ADF comment with bold attribution prefix
```rust
// Source: pattern derived from AdfDoc::paragraph() in fixtures.rs + htmltoadf crate
fn build_comment_adf(author: &str, date_str: &str, html_body: &str) -> serde_json::Value {
    let attribution = format!("{} \u{2014} {}", author, date_str); // em-dash
    let body_adf_str = htmltoadf::convert_html_str_to_adf_str(html_body.to_string());
    let mut body_doc: serde_json::Value = serde_json::from_str(&body_adf_str)
        .unwrap_or(serde_json::json!({ "version": 1, "type": "doc", "content": [] }));

    // Prepend attribution paragraph
    let attribution_node = serde_json::json!({
        "type": "paragraph",
        "content": [{
            "type": "text",
            "text": attribution,
            "marks": [{ "type": "strong" }]
        }]
    });

    if let Some(content) = body_doc["content"].as_array_mut() {
        content.insert(0, attribution_node);
    }
    body_doc
}
```

### Worklog POST body construction
```rust
// Source: Jira Cloud REST API v3 docs — POST /rest/api/3/issue/{key}/worklog
let attribution = format!("{} \u{2014} {} ({})",
    author_display,
    started_date,   // YYYY-MM-DD extracted from "started" field
    time_spent      // "2h" string from v2 worklog response
);
let worklog_body = serde_json::json!({
    "timeSpentSeconds": time_spent_seconds,
    "started": started,   // ISO 8601, e.g. "2026-01-15T10:00:00.000+0000"
    "comment": {
        "version": 1,
        "type": "doc",
        "content": [{
            "type": "paragraph",
            "content": [{
                "type": "text",
                "text": attribution,
                "marks": [{ "type": "strong" }]
            }]
        }]
    }
});
```

### Mock server: add_worklog handler (v3)
```rust
// Add alongside v3::add_comment in mock_server.rs
pub async fn add_worklog(
    State(fixtures): State<SharedFixtures>,
    Path(key): Path<String>,
    Json(_body): Json<Value>,
) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    if state.cloud_v3_issues.contains_key(&key) {
        let mock_worklog = json!({
            "id": format!("wl-{}", uuid::Uuid::new_v4()),
            "timeSpent": "2h",
            "timeSpentSeconds": 7200,
            "started": "2026-01-15T10:00:00.000+0000"
        });
        (StatusCode::CREATED, Json(mock_worklog)).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}
```

### CopyResultModal stepLabel extension
```typescript
// Source: existing CopyResultModal.tsx stepLabel() function
if (step.step.startsWith('attach:')) {
  const filename = step.step.slice('attach:'.length);
  return step.success
    ? `${filename} — attached`
    : `${filename} — ${step.detail || 'attachment failed'}`;
}
if (step.step.startsWith('comment:')) {
  const n = step.step.slice('comment:'.length);
  return step.success
    ? `Comment ${n} copied`
    : `Comment ${n} — ${step.detail || 'failed'}`;
}
if (step.step.startsWith('worklog:')) {
  const n = step.step.slice('worklog:'.length);
  return step.success
    ? `Work log entry ${n} copied`
    : `Work log ${n} — ${step.detail || 'failed'}`;
}
```

### Preview modal: attachment and comment summary display
```tsx
// In CopyPreviewModal.tsx source column — show counts before copy
{sourceTicket.fields.attachment.length > 0 && (
  <SourceFieldRow
    label="Attachments"
    value={`${sourceTicket.fields.attachment.length} file(s) will be copied`}
  />
)}
{sourceTicket.fields.comment.comments.length > 0 && (
  <SourceFieldRow
    label="Comments"
    value={`${sourceTicket.fields.comment.comments.length} comment(s) will be copied`}
  />
)}
{sourceTicket.fields.subtasks.length > 0 && (
  <SourceFieldRow
    label="Sub-tasks"
    value={sourceTicket.fields.subtasks.map(s => `${s.key}: ${s.fields.summary}`).join(', ')}
  />
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v2 attachment download required cookie auth | PAT Bearer token works for `/secure/attachment/` | Jira Server 8.17.0 | PAT-only workflow now viable for attachments on supported versions |
| timeSpent string in worklog POST (v2 style) | timeSpentSeconds integer required (v3) | Cloud v3 API | Must use `timeSpentSeconds` field, not `timeSpent` string |
| renderedFields comments separate endpoint | renderedFields.comment.comments in issue GET | Always supported in v2 | No second API call needed for comment rendering |

**No deprecated approaches relevant to this phase.**

## Open Questions

1. **Customer Jira Server version for PAT attachment download**
   - What we know: PAT attachment download fixed in 8.17.0; versions before that return 302 redirect
   - What's unclear: The customer's actual version — STATE.md blocker says this needs early confirmation
   - Recommendation: Plan assumes 8.17+ (most deployments); partial-success model absorbs failures gracefully if older. Add a note in the result modal for 302 attachment failures suggesting manual attachment transfer.

2. **renderedFields.comment path in real Jira Server**
   - What we know: Documentation and community confirm `renderedFields.comment.comments[n].body` is populated with HTML when `expand=renderedFields` is used; the mock needs to be extended to simulate this
   - What's unclear: Whether older Jira Server versions (pre-8.x) use a different path structure
   - Recommendation: Access the path defensively, fall back to `fields.comment.comments[n].body` (plain text string) when rendered version is absent.

3. **Preview modal work log count**
   - What we know: Work log is fetched lazily by `fetch_worklog` in the UI — not part of `JiraTicketDetail` passed to `startPreview`
   - What's unclear: Whether to show work log count in preview (would require an additional fetch during preview load or passing the count via `copy_ticket`)
   - Recommendation: Omit work log count from preview — only attachment and comment counts are directly available from `sourceTicket` fields. Work log steps appear in the result modal like other secondary steps.

## Environment Availability

Step 2.6: SKIPPED — no external dependencies beyond existing project stack. All required tools (Rust/Cargo, Node/npm, Tauri CLI) are already confirmed present from prior phases.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + jsdom + @testing-library/react |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COPY-02 | Binary attachment copied: result modal shows per-file steps | unit | `npm test -- CopyResultModal` | Extend existing ✅ |
| COPY-02 | Attachment step label shows filename + status | unit | `npm test -- CopyResultModal` | Extend existing ✅ |
| COPY-03 | Comment steps appear in result modal | unit | `npm test -- CopyResultModal` | Extend existing ✅ |
| COPY-03 | Preview shows comment count | unit | `npm test -- CopyPreviewModal` | Extend existing ✅ |
| COPY-04 | Worklog steps appear in result modal | unit | `npm test -- CopyResultModal` | Extend existing ✅ |
| COPY-05 | Sub-task list shown in preview source column | unit | `npm test -- CopyPreviewModal` | Extend existing ✅ |
| COPY-06 | Linked issues shown in preview source column | unit | `npm test -- CopyPreviewModal` | Extend existing ✅ |
| COPY-05/06 | Sub-task + linked issue sections in description | manual | Rust `cargo test` integration | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/features/tickets/CopyResultModal.test.tsx` — extend with attachment/comment/worklog step label cases (COPY-02, COPY-03, COPY-04) — file exists, needs new `it()` blocks
- [ ] `src/features/tickets/CopyPreviewModal.test.tsx` — extend with attachment count, comment count, sub-task list, linked issues display cases (COPY-02, COPY-03, COPY-05, COPY-06) — file exists, needs new `it()` blocks
- [ ] Rust integration test for description ADF footer construction (sub-tasks + linked issues appended) — not currently blocked by framework absence, but no test file exists: `src-tauri/tests/copy_ticket_description.rs` (optional, low priority given mock server covers the flow end-to-end)

## Sources

### Primary (HIGH confidence)
- Official Jira Cloud REST API v3 docs — worklog POST body: `timeSpentSeconds` (integer), `started` (ISO 8601), `comment` (ADF) — confirmed via search results citing https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/
- JRASERVER-72019 (closed, Fixed in 8.17.0) — PAT token attachment download confirmation
- Existing codebase (`commands.rs`, `mock_server.rs`, `fixtures.rs`, `copyStore.ts`, `CopyResultModal.tsx`, `CopyPreviewModal.tsx`, `types.ts`) — HIGH confidence, read directly

### Secondary (MEDIUM confidence)
- Atlassian community: `renderedFields.comment.comments[n].body` populated with HTML on `GET /rest/api/2/issue/{key}?expand=renderedFields` — confirmed by multiple community posts, consistent with documented behavior
- Atlassian community on comment rendered body: https://community.atlassian.com/t5/Jira-questions/cant-get-html-rendred-for-a-comments-body/qaq-p/953445

### Tertiary (LOW confidence)
- None — all critical claims verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries read directly from codebase
- Architecture: HIGH — read actual function bodies in commands.rs; extension points are clear
- Pitfalls: HIGH — PAT attachment issue verified via JRASERVER-72019 status; worklog POST fields verified from official docs; mock gaps observed directly in mock_server.rs router
- API behavior: MEDIUM — renderedFields.comment path confirmed by community sources, not official API spec page (Atlassian docs site rendered JS-only, not scrapable)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable Jira API surface)
