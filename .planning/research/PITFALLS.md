# Pitfalls Research

**Domain:** Desktop app for cross-instance Jira ticket management (Tauri, Cloud + Server, PAT auth)
**Researched:** 2026-03-19
**Confidence:** MEDIUM — based on well-established API documentation and integration patterns; Brave/WebSearch unavailable, so no live verification against recent community post-mortems. Core API differences are HIGH confidence from Atlassian documentation knowledge; Tauri-specific patterns are MEDIUM.

---

## Critical Pitfalls

### Pitfall 1: Treating Jira Cloud and Server APIs as Identical

**What goes wrong:**
Code written against one API shape silently fails or returns wrong data when run against the other. The APIs have significant structural differences that are not immediately obvious: field naming conventions, pagination models, authentication headers, and resource URL schemes all differ. Projects assume one adapter is enough and get burned when real edge cases surface.

**Why it happens:**
Both expose a "REST API" and share many endpoint names. Developers write against the Cloud API (better documented), then discover Server uses different field names for the same concepts, different pagination (startAt/maxResults vs cursor-based in some Cloud v3 endpoints), and that some Cloud-only fields (e.g., `accountId` instead of `name`/`key` for users) simply do not exist on Server.

Specific documented differences:
- **User identity**: Cloud uses `accountId` (opaque string). Server uses `name` (username) and `key`. Mixing these breaks assignee lookups and comment author attribution.
- **API version paths**: Cloud REST API v3 (`/rest/api/3/`) uses Atlassian Document Format (ADF) for description and comment bodies. Server typically uses v2 (`/rest/api/2/`) with Jira Wiki Markup or plain text. Sending ADF to a Server instance will be rejected or stored as garbage.
- **Attachment URLs**: Cloud attachment download URLs require authenticated requests with a different auth header pattern. Server attachment URLs may be directly accessible or require cookie-based auth depending on configuration.
- **Pagination**: Cloud v3 has moved some endpoints to cursor-based pagination; Server is always offset-based (startAt + maxResults).
- **Custom fields**: IDs are instance-specific (`customfield_10014`) but the same logical field (e.g., story points) may map to different IDs across instances.

**How to avoid:**
Design the Jira client as two separate adapter implementations behind a single interface from day one. Never share a single client implementation with branching conditionals — the conditionals will multiply. Define a `JiraClient` trait/interface with methods that return normalized internal types. Each adapter handles translation. Never pass raw API response shapes across the adapter boundary.

**Warning signs:**
- A single `jira_client.rs` file with `if is_cloud { ... } else { ... }` blocks growing beyond 3-4 cases
- User display names showing as `accountId` strings in the UI
- Description or comment bodies rendering as raw ADF JSON markup
- Copy succeeding silently but destination ticket having empty description

**Phase to address:**
Foundation / API integration phase — the adapter split must be established before any feature work begins. Retrofitting it later requires touching every callsite.

---

### Pitfall 2: Rich Content (ADF vs Wiki Markup) Conversion Causing Data Loss

**What goes wrong:**
Ticket descriptions and comments copied from Server to Cloud (or vice versa) arrive as unrendered markup strings, broken JSON blobs, or stripped plain text. The content looks fine in the source but is unusable in the destination. This is the single most common "copy looked successful but data is wrong" failure.

**Why it happens:**
Jira Cloud API v3 uses Atlassian Document Format (ADF) — a structured JSON schema — for all rich text fields (description, comment body, environment, etc.). Jira Server API v2 uses Jira Wiki Markup (a custom markup language) or sometimes plain text. Sending a Wiki Markup string to Cloud's v3 endpoint as the `description` field will not auto-convert it — Cloud will store it as a literal string inside an ADF paragraph node, losing all formatting. Sending ADF JSON to a Server v2 endpoint that expects a string will either fail validation or store `[object Object]`.

There is no official Atlassian-provided conversion library. Third-party converters exist (`jira-markup` npm package, `adf-builder`) but have coverage gaps for tables, nested lists, macros, and embedded images.

**How to avoid:**
- Always use the `renderedFields` parameter when fetching from Server (returns HTML) — this gives you rendered output which is more portable than Wiki Markup
- For the Cloud→Server direction (copying back is out of scope, but relevant for mock testing), use the `expand=renderedFields` query param
- Implement a conservative conversion: strip unsupported formatting rather than failing silently. A description with plain text is better than a broken copy.
- Add a "content fidelity" flag to the copy result: "description copied (formatting may differ)" vs "description copied (full fidelity)"
- Test with tickets that contain: tables, code blocks, inline images, numbered lists, @mentions, and issue links — these are the most common failure cases

**Warning signs:**
- Descriptions in destination tickets start with `{"version":1,"type":"doc"...`
- Descriptions show raw `*bold*` or `{code}` syntax instead of rendered formatting
- Tables are missing or flattened to single-line text
- @mentions appear as raw `[~username]` text

**Phase to address:**
Core copy workflow phase. Must be explicitly scoped — "copy description" is not done until rich content round-trips correctly through a mock that exercises both API shapes.

---

### Pitfall 3: Credential Leakage Through Rust Panic Messages and Log Output

**What goes wrong:**
PATs appear in log files, crash reports, or Tauri webview console output. This happens even when credentials are stored securely in the OS keychain — the moment a PAT is retrieved and used in an HTTP request, it passes through code paths that may log it.

**Why it happens:**
The PROJECT.md requirement for "full request/response logging" creates a direct conflict with credential security. A developer implements logging as `log::debug!("Request: {:?}", request)` and the PAT appears in the Authorization header. Rust's `Debug` derive on HTTP request structs will include all fields including auth headers. Tauri's webview DevTools (accessible in dev builds) shows IPC payloads that may include PATs if they're passed to the frontend.

Additionally, Rust panics triggered during HTTP calls may include partial request state in the panic message, which propagates to crash logs.

**How to avoid:**
- Never pass PATs to the frontend layer — all API calls must happen in the Rust backend
- Implement a `RedactedString` wrapper type for credentials that implements `Debug` as `"[REDACTED]"` and `Display` as `"[REDACTED]"` — use this type wherever credentials are held in memory
- Create a `SanitizedRequest` log struct that explicitly excludes the Authorization header, built separately from the actual request struct
- In the audit log (which per requirements logs full request/response), store header names but redact `Authorization` header value
- Never enable Tauri's `devTools` in release builds
- Add a CI check: grep for PAT patterns in log output during test runs

**Warning signs:**
- Audit log files containing `Bearer ey...` or `Basic ...` strings
- `cargo test -- --nocapture` output showing credential strings
- Tauri IPC payloads in browser DevTools containing token fields

**Phase to address:**
Foundation phase — the credential handling architecture (RedactedString type, log sanitization) must be in place before any HTTP client code is written. The audit logging feature (a PROJECT.md requirement) must be designed with this constraint from the start.

---

### Pitfall 4: Mock Server Drift — Tests Pass But Real API Fails

**What goes wrong:**
The mock Jira server diverges from real API behavior over time. Tests pass against the mock, but integration with a real Jira instance fails on edge cases the mock doesn't reproduce: field nullability, unexpected pagination behavior, rate limiting, attachment download quirks, or API version-specific response shapes.

**Why it happens:**
The mock is built to make tests pass, not to accurately model the full API contract. Developers add only the response fields their code currently reads, leaving other fields absent. When new code reads a previously-ignored field, it works against the mock (which was written to match) but fails against a real API that returns the field with a different name, type, or nesting.

A second failure mode: the mock is never run against a real Jira instance to validate parity. Without a validation harness, drift is invisible.

**How to avoid:**
- Build the mock from Atlassian's OpenAPI spec, not from observed responses — this ensures correct schema even for fields you haven't written code for yet
- Use response fixtures captured from real Jira API calls (sanitized) rather than hand-crafted JSON — include all fields the API actually returns, not just the ones you need
- Implement contract tests: a test suite that runs the same assertions against both the mock and (when credentials are available) a real instance
- Version the mock against specific Jira API versions (v2 Server, v3 Cloud) and document which version each fixture represents
- Mark mock endpoints with coverage status: "full parity", "partial — missing X", "stub only"

**Warning signs:**
- Mock response JSONs have fewer than 20 fields for a ticket (real Jira issues have 50+ fields)
- Test fixtures were hand-written rather than captured from a real API
- No test exercises the `renderedFields` expansion
- Mock returns `200 OK` for all requests including malformed ones

**Phase to address:**
Testing infrastructure phase — must be addressed before feature development, not retrofitted. The mock server design should be a deliverable in its own right, reviewed for API fidelity.

---

### Pitfall 5: Attachment Handling Broken by Auth Model Differences

**What goes wrong:**
Attachments fetch successfully (the metadata endpoint returns URLs), but downloading the actual binary content fails. Attachments appear in the UI as broken links or empty files. This affects the "copy with full fidelity" requirement directly.

**Why it happens:**
Jira attachment download URLs are not public. They require authentication, but the authentication mechanism differs:
- **Cloud**: The content URL returned by the API must be fetched with the same PAT in an `Authorization: Bearer` header. The URL itself is not pre-signed and does not embed credentials.
- **Server (older versions)**: The attachment URL may require cookie-based session authentication rather than PAT headers, depending on the server's authentication configuration. Some Server configurations will return the attachment metadata (with content URLs) to a PAT-authenticated request but then reject the content download from the same PAT.
- URL schemes differ: Cloud uses `api.atlassian.com/ex/jira/{cloudId}/...` while Server uses the instance's own domain.

A copy operation that transfers attachment metadata but not content produces a ticket with broken attachment links in the destination — which looks complete until a user clicks a link.

**How to avoid:**
- Implement a two-step attachment transfer: fetch metadata, then independently verify content download succeeds before marking the attachment transfer as complete
- In the mock server, implement attachment content endpoints (return actual binary content), not just metadata
- Test the attachment download path explicitly — do not assume it works because metadata returned 200
- For Server instances, test against both PAT-only and session-cookie configurations in the mock
- Make attachment transfer failures visible: report "copied with N attachments (M failed)" rather than silently omitting failures

**Warning signs:**
- Tests only assert that attachment metadata was copied, not that binary content was transferred
- Mock server has `/rest/api/2/issue/{key}/attachments` returning metadata but no corresponding content download endpoint
- Copy operation returns success with 0 bytes written to attachment storage

**Phase to address:**
Core copy workflow phase — specifically the attachment sub-feature. Must not be marked "done" until binary content transfer is verified end-to-end in the mock.

---

### Pitfall 6: Pagination Assumption — Silently Missing Tickets

**What goes wrong:**
Ticket fetch returns only the first page of results (typically 50 tickets). Users see an incomplete list and don't know it — there's no indication that more results exist. Over time they miss tickets they were supposed to review.

**Why it happens:**
The Jira search API (`/rest/api/2/search` or v3 equivalent) returns paginated results. The default `maxResults` is 50 on most instances. A JQL query for "tickets assigned to me or watched users" can easily return more than 50 results. Code that fetches one page and stops looks correct in tests (where the mock returns < 50 tickets) but silently truncates in production.

**How to avoid:**
- Always implement full pagination for any list-returning endpoint: loop until `startAt + issues.length >= total`
- Set a conservative maximum page size (50-100) — Server instances may enforce lower limits than Cloud
- Display the total count alongside the visible list: "Showing 23 of 23 tickets" vs "Showing 50 of 147 tickets — load more"
- In the mock, include test cases where total > maxResults to exercise pagination logic

**Warning signs:**
- Fetch function returns `Vec<Issue>` without a total count field
- No test case exercises a response where `total > maxResults`
- UI shows a list with no indication of whether more results exist

**Phase to address:**
Ticket fetch / candidate discovery phase. Pagination must be in the initial implementation, not added when a user reports missing tickets.

---

### Pitfall 7: Tauri IPC Boundary Leaks Internal Error Details

**What goes wrong:**
Rust errors bubble up to the frontend as raw error strings that expose internal implementation details: file paths, stack traces, credential-adjacent field names, or Jira API error payloads including account IDs and instance URLs.

**Why it happens:**
Tauri commands return `Result<T, E>` and the error type is serialized to the frontend. If `E` is `anyhow::Error` or a raw Jira API error struct, the full error message — including context added with `.context("while fetching ticket for account_id: abc123")` — reaches the JavaScript layer and may be displayed or logged.

**How to avoid:**
- Define a `FrontendError` enum with user-facing variants only: `ConnectionFailed`, `AuthFailed`, `NotFound`, `CopyFailed { ticket_key: String }`, etc.
- Internal errors (including Jira API error bodies) are logged at Rust level only — never forwarded to frontend
- The `From<InternalError> for FrontendError` conversion strips sensitive context
- In tests, assert that error messages returned to the frontend contain no URLs, account IDs, or credential strings

**Warning signs:**
- Tauri commands return `anyhow::Error` directly
- Frontend displays error messages containing URLs (e.g., `https://companyinstance.atlassian.net/...`)
- Error messages in the UI show Jira field names or account IDs

**Phase to address:**
Foundation phase — the error handling architecture should be designed before feature work. Retrofitting a `FrontendError` enum after all commands are written is feasible but tedious.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single Jira client with `if is_cloud` branches | Faster initial build | Branches multiply; untestable combinations; refactor required when adding third source | Never — split from start |
| Hand-write mock response fixtures | Fast to create first test | Mock drifts from real API; silent test-passes/real-fails | Only for trivial status-code tests, not for data structure tests |
| Skip ADF/Wiki Markup conversion, copy raw string | Description "copies" quickly | Destination tickets have broken/unrendered content; users lose trust in the tool | Never for the primary copy path |
| Store copy history in JSON file alongside app | Simple to implement | No query capability; file corruption loses history; hard to extend | Acceptable for MVP if schema is versioned and migration path planned |
| Hardcode field mappings (summary→summary, description→description) | Works for standard fields | Custom fields silently dropped; users discover missing data after copy | Acceptable for MVP with explicit "custom fields not copied" notice |
| Pass credentials through Tauri IPC to frontend | Simplifies architecture | Credentials in webview memory, accessible via DevTools, risk of logging | Never — credentials stay in Rust backend only |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira Cloud API v3 | Send string as `description` field | Send ADF document: `{"version":1,"type":"doc","content":[...]}` |
| Jira Server API v2 | Send ADF JSON as `description` | Send Wiki Markup string or use `renderedFields` HTML as source |
| Jira user identity | Use `name`/`displayName` as assignee on Cloud | Use `accountId` for Cloud, `name` for Server; they are not interchangeable |
| Jira attachments | Assume attachment URL is directly downloadable | Re-fetch attachment content with authenticated request using the same PAT |
| Jira issue links | Copy `inwardIssue`/`outwardIssue` keys directly | Keys reference the source instance; links in destination will be broken unless destination has matching tickets |
| Jira sub-tasks | Copy parent ticket assuming sub-tasks copy automatically | Sub-tasks must be fetched and copied separately; parent key in `fields.parent` must be updated to destination key |
| Jira custom fields | Read `customfield_10014` by ID | IDs are instance-specific; same logical field has different ID on source vs destination; build a field mapping configuration |
| PAT authentication | Use Basic auth with `user:token` as password | Cloud uses Bearer token for PAT; Server uses Basic auth with `user:token` — different schemes |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching full ticket details in list view | UI hangs during candidate fetch; slow initial load | Fetch list with minimal fields, load full detail on demand | At 20+ tickets in a session |
| Sequential attachment downloads | Copy operation takes minutes for tickets with many attachments | Parallelize attachment downloads (bounded concurrency — 3-5 simultaneous) | At 5+ attachments per ticket |
| No caching of watched-user lookups | User profile lookups on every ticket render | Cache user profiles for session duration | At 10+ unique users across 20 tickets |
| Fetching all comments upfront | High memory use; slow for tickets with 100+ comments | Paginate comments; load older comments on demand | At 50+ comments per ticket |
| Re-fetching source ticket on every copy attempt | Unnecessary round-trips if user copies multiple fields | Cache source ticket data until user navigates away | Per-session, not a scaling issue — but poor UX |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full HTTP requests including Authorization header | PAT written to audit log file on disk | Sanitize auth headers in log layer; log header name but not value |
| Passing PAT to frontend via Tauri IPC | PAT in webview memory; accessible via DevTools in dev mode | All API calls stay in Rust backend; frontend receives results, never credentials |
| Storing PAT in app config file as fallback | Config file readable by other processes; checked into source control accidentally | OS keychain only, no fallback; fail loudly if keychain is unavailable |
| Using PAT in URL query string (`?token=...`) | PAT in server logs, browser history, Tauri webview address bar | Header-only auth; never put credentials in URLs |
| Not clearing PAT from memory after use | PAT remains in Rust heap until GC; could appear in crash dumps | Zeroize credential buffers after use (zeroize crate) |
| Trusting TLS certificate without validation on Server instances | Man-in-the-middle against self-hosted instance | Enforce TLS validation; provide explicit "accept this certificate" UX for self-signed certs rather than disabling validation globally |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No indication of copy fidelity | User assumes full copy; discovers missing data later | Show explicit "copied: description (may differ), 3 attachments, 2 comments, 0 sub-tasks (not copied)" summary |
| Copy operation has no progress feedback | For tickets with many attachments, app appears frozen | Progress bar with step labels: "Copying description... Uploading attachments (2/5)..." |
| Ignore list is not reviewable in-flow | User accidentally ignores a ticket; has no way to recover it | Dedicated "Ignored" view accessible at all times; undo for recent ignores |
| Connection test only on save, not on open | Saved credentials expire; user discovers on first fetch attempt | Test connection on app startup; show connection status in UI persistently |
| No distinction between "no new tickets" and "fetch failed" | User doesn't know if they're up to date or if something went wrong | Explicit "last fetched: X minutes ago (success)" vs "last fetch: failed — [reason]" |
| Custom fields silently dropped | User doesn't know Sprint, Story Points, Epic Link weren't copied | Explicit "fields not copied" section in copy result — show what was dropped |

---

## "Looks Done But Isn't" Checklist

- [ ] **Ticket copy**: Often missing sub-task copy — verify sub-tasks appear in destination with correct parent
- [ ] **Ticket copy**: Often missing attachment binary content (metadata copies, content doesn't) — verify file downloads from destination
- [ ] **Description copy**: Often stored as raw ADF or Wiki Markup — verify rendered view in destination Jira shows formatted content, not raw markup
- [ ] **Comment copy**: Often copies author as the PAT holder's account, not the original author — verify author attribution in destination
- [ ] **Connection wizard**: Often passes with valid PAT but fails on first real fetch due to missing permissions — verify PAT has Browse Projects + Create Issues permissions
- [ ] **Credential storage**: Often stored in keychain but leaked in audit log — grep audit log for Bearer/Basic strings after a test run
- [ ] **Pagination**: Often returns first 50 results only — verify with a mock returning 51 tickets that all 51 appear in the list
- [ ] **Ignored tickets**: Often "ignored" state is lost on restart — verify ignored list persists across app restarts
- [ ] **Mock server**: Often only implements happy path — verify error cases (401, 404, 429 rate limit, 500) are handled gracefully in UI

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Merged Cloud/Server client needing split | HIGH | Define JiraClient trait, create two impl files, migrate callsites one by one; ~2 days for moderate codebase |
| ADF/markup conversion not implemented | MEDIUM | Add conversion layer; hardest part is tables and macros; can ship "plain text only" as interim with user notice |
| Credentials found in audit log | HIGH | Rotate all PATs immediately; audit log files must be considered compromised; redesign log sanitization before re-shipping |
| Mock server too simplistic, real API fails | MEDIUM | Capture real API responses (sanitized), replace hand-written fixtures; add contract tests; 1-3 days |
| Pagination missing, users reporting missing tickets | LOW | Add pagination loop to fetch functions; straightforward code change; 1-2 hours |
| Attachment content not transferred | MEDIUM | Add content-download step to copy workflow; test with various attachment types; 1 day |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cloud/Server API treated as identical | Foundation — API client design | Two separate adapter impls exist; no shared response types cross boundary |
| ADF vs Wiki Markup conversion | Core copy workflow | Round-trip test: copy ticket with table and code block; verify rendered in destination |
| Credential leakage in logs | Foundation — credential architecture | Grep audit log output for `Bearer`/`Basic` strings; CI check |
| Mock server drift | Testing infrastructure (before features) | Contract test suite documents coverage; fixtures are captured not hand-written |
| Attachment content not transferred | Core copy workflow — attachments sub-feature | Copy a ticket with 3 attachments; verify binary content downloadable from destination |
| Pagination truncating results | Ticket fetch phase | Test with mock returning 51 tickets; verify all 51 in list |
| Tauri IPC leaking internal errors | Foundation — error handling architecture | Assert frontend error messages contain no URLs or account IDs |
| Copy fidelity not communicated | Core copy UI | Copy result shows per-field status; no silent drops |

---

## Sources

- Atlassian REST API documentation (v2 Server, v3 Cloud) — well-established differences, HIGH confidence
- Atlassian ADF schema documentation — HIGH confidence for format differences
- Known Tauri security architecture (Rust backend isolation, IPC serialization) — MEDIUM confidence for specific pitfall patterns
- Community patterns for Jira integration projects — MEDIUM confidence; search tools unavailable, based on training knowledge
- `zeroize` crate for credential memory safety — MEDIUM confidence, standard Rust practice for secrets
- Jira PAT authentication mechanism differences (Cloud Bearer vs Server Basic) — HIGH confidence, documented by Atlassian

**Confidence note:** Web search was unavailable during this research session. All pitfalls are derived from Atlassian API documentation knowledge and established Rust/Tauri security patterns. Claims about specific API field names and authentication schemes are HIGH confidence (stable, well-documented API contracts). Claims about community frequency of these mistakes are MEDIUM confidence (pattern-based, not empirically verified from recent post-mortems).

---
*Pitfalls research for: Pmkar — cross-instance Jira desktop app (Tauri + Cloud + Server)*
*Researched: 2026-03-19*
