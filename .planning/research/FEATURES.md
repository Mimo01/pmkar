# Feature Research

**Domain:** Jira cross-instance ticket management (desktop app, one-way copy with review workflow)
**Researched:** 2026-03-19
**Confidence:** MEDIUM — No live web access during this session. Derived from training knowledge of Atlassian REST API v2/v3 surface area, Jira Server vs Cloud differences, and comparable Atlassian Marketplace products (Exalate, Issue Sync for Jira, Backbone Issue Sync, Jira Misc Workflow Extensions). Core Jira API capabilities are well-established; marketplace product feature comparisons are MEDIUM confidence.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Connection setup for two Jira instances | App is useless without both connections working | MEDIUM | Must support Jira Cloud (PAT + base URL) and Jira Server/DC (PAT + self-hosted URL). Two different auth header formats: Cloud uses Basic auth with API token, Server uses Bearer PAT. |
| Credential security (OS keychain) | Users will not trust a tool that stores API tokens in plaintext | MEDIUM | Tauri has `tauri-plugin-stronghold` and platform keychain bindings. macOS Keychain, Windows Credential Manager, Linux Secret Service via libsecret. |
| Fetch and display candidate tickets | Core of the review workflow — if you can't see tickets, nothing works | HIGH | Requires JQL query construction, pagination, and full issue expand (changelog, comments, worklogs, attachments, subtasks, links). Two separate API shapes (Server v2 vs Cloud v3). |
| Full issue detail view | User must see everything before deciding to copy | HIGH | Summary, description (Atlassian Document Format on Cloud, wiki markup on Server), status, priority, assignee, reporter, labels, components, fix versions, story points, custom fields, attachments list, comment thread, work log, sub-task list, linked issues. |
| Copy ticket to company Jira | The primary action — the whole point of the tool | HIGH | Must map fields across schemas. Cloud uses ADF for description; Server uses wiki markup. Need to translate or preserve as best possible. Attachments require binary download + re-upload. Sub-tasks are separate issue creates. |
| Origin tracking (source link) | Without this, users lose traceability back to the customer system | LOW | Store source ticket URL + key as a remote link or custom field on the created issue. Jira Cloud supports remote links via REST. |
| Ignore action with reviewable ignored list | User needs to triage without permanently losing visibility | LOW | Local state (SQLite or JSON) tracking ignored ticket keys. UI to view and un-ignore. |
| Watched users configuration | User's workflow includes monitoring colleagues' tickets, not just their own | LOW | Store a list of Jira usernames/account IDs. Merge their tickets into the candidate fetch. |
| Audit log of all API calls | Every REST call logged — this is a stated hard requirement | MEDIUM | Structured log: timestamp, method, URL, status code, request/response body. Must be viewable in-app and/or accessible as a file. |
| Connection validation / test | Users need immediate feedback if credentials are wrong | LOW | On save of connection config, fire a `GET /rest/api/2/myself` or `GET /rest/api/3/myself` call and surface success/failure clearly. |
| Graceful API error handling | Jira rate limits and network errors happen; app must not crash silently | MEDIUM | Surface 401 (invalid token), 403 (no permission), 404 (issue not found), 429 (rate limit), 5xx (server error) with meaningful messages. Retry logic for 429/5xx. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Fidelity of attachment copy | Most tools lose or skip attachments — full binary copy is rare | HIGH | Download attachment from source Jira (authenticated), re-upload to target Jira. Preserve filename. Comments that reference attachment filenames still make sense. |
| Comment thread copy | Preserves the full context of discussion, not just the ticket body | MEDIUM | POST each comment to target in order. Prefix with "Mirrored from [Customer]: Originally by [Author] on [Date]:" to preserve attribution. |
| Work log copy | Teams need to know actual effort logged on customer tickets | MEDIUM | Jira work logs have author, time spent, start date, comment. Mirror all entries with attribution prefix. |
| Sub-task hierarchy copy | Flat copies of parent tickets without sub-tasks lose structure | HIGH | Must create sub-tasks as child issues under the newly created parent. Requires two-pass: create parent, then create each sub-task linked to parent. Ordering matters. |
| Linked issue copy (reference only) | Linked issues show relationships; losing them breaks navigation | MEDIUM | Cannot copy linked issues themselves (scope creep), but can preserve link text as a description annotation or remote link: "Blocks: CUST-123 (customer system)". |
| Mock Jira server for dev/testing | No other tools in this space are built test-first against mock APIs | HIGH | Must simulate both Cloud v3 and Server v2 API shapes. Supports development without real PATs. Crucial for CI. This is a build-quality differentiator, not a user-facing feature. |
| Session-persistent triage state | Ticket triage across sessions — app remembers what you've reviewed | LOW | Persist "seen", "ignored", "copied" state per ticket key per run date. Prevents re-reviewing the same tickets. |
| Configurable JQL filter | Power users want to control what the fetch query retrieves | MEDIUM | Allow custom JQL beyond the defaults. With sensible default (assignee = currentUser() OR watcher = ...). Validate JQL before saving. |
| Excel export | Management reporting use case — export ticket data to spreadsheet | MEDIUM | Export copied/ignored/candidate ticket metadata to .xlsx. Field selection TBD in later milestone. Library: `xlsx` (SheetJS) or `exceljs`. |
| Diff view before copy | Show what will be created before committing — reduces errors | MEDIUM | Side-by-side or summary of: fields to be mapped, attachments to be copied, comments count, sub-task count. One-time confirmation before POST. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Two-way sync / ongoing sync | "Keep both systems in sync automatically" seems powerful | Sync requires conflict resolution, field locking, webhook infrastructure on both systems, and Jira Server webhooks are unreliable on older versions. Complexity is 10x; scope creep will delay launch indefinitely. | One-way copy with origin tracking. If status changes, re-copy manually or build re-copy feature later. |
| Real-time push notifications | "Notify me when a new customer ticket appears" seems useful | Requires Jira Server webhooks (unreliable on older self-hosted) or polling daemon running in background. Desktop polling with toast notifications adds OS integration complexity. | Explicit user-triggered refresh on a daily cadence. The workflow is already batch/daily. |
| OAuth / SSO authentication | "More secure than PATs" is a common request | OAuth requires a redirect URI and a registered Atlassian app. Self-hosted Jira Server OAuth is a different spec than Cloud. PATs are explicitly the right tool for server-to-server integrations. | PAT-based auth stored in OS keychain — secure and simpler. |
| Full custom field mapping UI | "I want to map customer field X to my company field Y" sounds practical | A generic field mapping UI requires introspecting both schemas, building a drag-and-drop mapper, handling type mismatches. This is a product unto itself. | Map standard fields reliably. Preserve custom field values as structured text in description (e.g., an appended "Custom Fields" table). |
| Bulk operations / select all | "Copy 50 tickets at once" feels efficient | Bulk copy without individual review defeats the purpose of the review workflow. It also risks rate limiting and partial failures. | Review individually; batch fetch is fine but copy is ticket-by-ticket with explicit action. |
| In-app Jira editor (create/edit issues) | "Why not let me create tickets from scratch too?" | Scope creep into a Jira client. The app's value is bridging two systems, not replacing the Jira UI. | Stick to copy-from-source workflow. |
| Persistent background sync daemon | "Run in the tray and sync automatically" | Daemon requires OS login item registration, background process management, credential access outside the main app context. Much harder to audit. | On-demand launch, explicit refresh. User controls when to pull. |

---

## Feature Dependencies

```
[Connection Config (Dual Jira)]
    └──requires──> [Credential Storage (OS Keychain)]
    └──requires──> [Connection Validation / Test]

[Candidate Ticket Fetch]
    └──requires──> [Connection Config (Dual Jira)]
    └──requires──> [Watched Users Config]
    └──enhances via──> [Configurable JQL Filter]

[Full Issue Detail View]
    └──requires──> [Candidate Ticket Fetch]

[Copy to Company Jira]
    └──requires──> [Full Issue Detail View]
    └──requires──> [Connection Config (Dual Jira)]
    └──enhances via──> [Diff View Before Copy]
        └──sub-feature──> [Comment Thread Copy]
        └──sub-feature──> [Work Log Copy]
        └──sub-feature──> [Attachment Copy]
        └──sub-feature──> [Sub-task Hierarchy Copy]
        └──sub-feature──> [Linked Issue Reference Copy]

[Origin Tracking]
    └──requires──> [Copy to Company Jira]

[Ignore Action]
    └──requires──> [Candidate Ticket Fetch]
    └──requires──> [Session-Persistent Triage State]

[Ignored List View]
    └──requires──> [Ignore Action]
    └──requires──> [Session-Persistent Triage State]

[Audit Log]
    └──enhances──> [All API calls] (cross-cutting concern)

[Mock Jira Server]
    └──enables──> [All features] (development/test only)

[Excel Export]
    └──requires──> [Session-Persistent Triage State]
    └──requires──> [Copy to Company Jira]
```

### Dependency Notes

- **Connection Config requires Credential Storage:** Config setup must complete before any API call can be made. The keychain write must succeed at setup time.
- **Candidate Fetch requires Connection Config:** No fetch until both connections are validated and stored.
- **Copy requires Full Issue Detail:** The copy payload is built from the fetched issue data. Partial fetches produce incomplete copies.
- **Sub-task Copy has ordering dependency:** Parent must be created first; sub-tasks reference the parent's new key. Two-pass creation required.
- **Attachment Copy is independent of Comment Copy:** Can ship one without the other. Attachment complexity is higher (binary transfer vs text).
- **Excel Export requires triage state persistence:** You can only export what has been tracked. Exporting live fetch data without persistence is fragile.
- **Mock Server enables all features:** Without it, development requires real credentials. This is a day-one infrastructure requirement, not a feature to defer.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the core copy workflow end-to-end.

- [ ] Connection setup wizard (Cloud + Server) with credential storage in OS keychain — without this, nothing works
- [ ] Connection validation with clear success/failure feedback — prevents silent auth failures
- [ ] Fetch candidate tickets via JQL (assignee = me + watched users) with full issue expand — core data pipeline
- [ ] Full issue detail view (summary, description, status, priority, assignee, reporter, comments, work log, attachments list, sub-tasks, linked issues) — must see before acting
- [ ] Copy to company Jira: summary, description, status-equivalent, priority, assignee, labels — core action
- [ ] Attachment copy (download + re-upload) — loss of attachments is a deal-breaker for ticket fidelity
- [ ] Comment thread copy with attribution prefix — preserves discussion context
- [ ] Origin tracking (remote link back to source ticket) — traceability is a stated requirement
- [ ] Ignore action with reviewable ignored list — triage workflow is incomplete without it
- [ ] Session-persistent triage state — prevents reviewing the same ticket twice across sessions
- [ ] Audit log of all REST calls — stated hard requirement from day one
- [ ] Mock Jira server (both Cloud v3 and Server v2 shapes) — no real PATs available, development blocker

### Add After Validation (v1.x)

- [ ] Work log copy — add once comment copy is proven; same pattern but different endpoint
- [ ] Sub-task hierarchy copy — add once flat copy is stable; requires two-pass creation logic
- [ ] Configurable JQL filter — add when users need more control over fetch scope
- [ ] Diff view before copy — add when users report accidental copies or want more confidence
- [ ] Watched users configuration UI — start with hardcoded or config-file approach; add UI when the list grows

### Future Consideration (v2+)

- [ ] Excel export — deferred by project requirement; scope TBD
- [ ] Linked issue reference copy — lower value than attachment/comment fidelity; add after core is validated
- [ ] Re-copy / update existing copy — useful when source ticket changes significantly after initial copy; complex (requires matching existing target issue)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dual connection setup + keychain | HIGH | MEDIUM | P1 |
| Connection validation | HIGH | LOW | P1 |
| Candidate ticket fetch (full expand) | HIGH | HIGH | P1 |
| Full issue detail view | HIGH | MEDIUM | P1 |
| Copy: summary + description + metadata | HIGH | HIGH | P1 |
| Attachment copy (binary transfer) | HIGH | HIGH | P1 |
| Comment thread copy | HIGH | MEDIUM | P1 |
| Origin tracking | HIGH | LOW | P1 |
| Ignore + ignored list | HIGH | LOW | P1 |
| Triage state persistence | HIGH | LOW | P1 |
| Audit log | HIGH | MEDIUM | P1 |
| Mock Jira server | HIGH (dev) | HIGH | P1 |
| Work log copy | MEDIUM | MEDIUM | P2 |
| Sub-task hierarchy copy | MEDIUM | HIGH | P2 |
| Configurable JQL filter | MEDIUM | MEDIUM | P2 |
| Diff view before copy | MEDIUM | MEDIUM | P2 |
| Watched users config UI | MEDIUM | LOW | P2 |
| Excel export | LOW-MEDIUM | MEDIUM | P3 |
| Linked issue reference copy | LOW | MEDIUM | P3 |
| Re-copy / update | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Confidence: MEDIUM — Based on training knowledge of Atlassian Marketplace tools as of mid-2025. No live verification possible in this session.

| Feature | Exalate (marketplace sync tool) | Backbone Issue Sync | Issue Sync for Jira | Pmkar (this project) |
|---------|----------------------------------|---------------------|---------------------|----------------------|
| Connection model | Peer-to-peer sync nodes | Admin-configured sync rules | JQL-based field mapping | User-configured dual connection, no admin access needed |
| Auth method | OAuth or PAT, requires Jira admin on both sides | Admin install on both instances | Jira admin install | PAT only, no admin access required on either side |
| Sync direction | Bi-directional | Bi-directional | Bi-directional | One-way copy only (intentional) |
| Attachment sync | Yes (paid plans) | Yes | Partial | Full binary copy (P1) |
| Comment sync | Yes | Yes | Field-level only | Full thread with attribution |
| Sub-task sync | Partial | Yes | No | Two-pass hierarchy copy (P2) |
| Work log sync | No | Partial | No | Copy with attribution (P2) |
| Review/triage workflow | No — automatic | No — automatic | No — automatic | Yes — explicit review before copy |
| Ignored list | No | No | No | Yes — reviewable |
| Origin tracking | Yes (link back) | Yes (link back) | Yes (link back) | Yes (remote link) |
| Desktop app | No — server plugin | No — server plugin | No — server plugin | Yes — Tauri desktop |
| Admin-free setup | No — requires Jira admin | No — requires Jira admin | No — requires Jira admin | Yes — PAT only |
| Mock/test mode | No | No | No | Yes — required from day one |
| Audit log | Partial (sync history) | Partial | No | Full request/response log |

**Key insight:** Every existing tool in this space requires Jira admin access on at least one instance (to install the plugin) and automates sync without human review. Pmkar's differentiating angle is admin-free setup (PAT only), human-in-the-loop review before copy, and desktop-native deployment. These are not bugs — they are the product.

---

## Jira API Fidelity Notes

Confidence: HIGH — Based on well-established Atlassian REST API documentation.

### Fields Available on Jira Issues (Server v2 and Cloud v3)

Both APIs surface the following via `?expand=changelog,renderedFields,names,schema,transitions,operations,editmeta,changelog,versionedRepresentations`:

- Core: `summary`, `description`, `status`, `priority`, `issuetype`, `assignee`, `reporter`, `created`, `updated`, `resolutiondate`
- Labels, components, fix versions, affected versions
- `subtasks` (list of child issue stubs — must fetch each separately for full data)
- `issuelinks` (list of link objects with type, inward/outward issue stubs)
- `attachment` (list with filename, content URL, MIME type, author, size)
- `comment.comments` (list with author, body, created, updated)
- `worklog.worklogs` (list with author, timeSpent, started, comment)
- `changelog.histories` (full audit trail of field changes)
- Custom fields (`customfield_NNNNN` keys — schema varies by instance)

### API Shape Differences (Critical)

| Concern | Jira Server (v2) | Jira Cloud (v3) |
|---------|-----------------|-----------------|
| Description format | Wiki markup string | Atlassian Document Format (ADF) JSON |
| Comment body format | Wiki markup string | ADF JSON |
| Auth header | `Authorization: Bearer <PAT>` | `Authorization: Basic base64(email:api_token)` |
| User identity | `name` (username string) | `accountId` (opaque UUID) |
| Attachment download auth | Same PAT | Same Basic auth |
| Base URL pattern | `https://jira.company.com/rest/api/2/` | `https://company.atlassian.net/rest/api/3/` |

**Implication:** Description and comment copy requires format translation or format preservation. Safest approach: copy ADF as-is to Cloud target (Cloud accepts ADF), convert Server wiki markup to ADF using Atlassian's `adf-utils` library or preserve as a code block. This is non-trivial and needs a deliberate approach in the implementation phase.

---

## Sources

- Atlassian REST API v2 documentation (Jira Server/DC) — training knowledge, HIGH confidence for established API surface
- Atlassian REST API v3 documentation (Jira Cloud) — training knowledge, HIGH confidence
- Atlassian Marketplace product pages for Exalate, Backbone Issue Sync, Issue Sync for Jira — training knowledge, MEDIUM confidence (feature sets may have changed)
- PROJECT.md requirements — definitive for this project's scope
- ADF (Atlassian Document Format) specification — training knowledge, HIGH confidence for format differences

---

*Feature research for: Jira cross-instance ticket management (Pmkar)*
*Researched: 2026-03-19*
