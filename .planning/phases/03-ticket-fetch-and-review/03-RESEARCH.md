# Phase 3: Ticket Fetch and Review - Research

**Researched:** 2026-03-20
**Domain:** Jira REST API (v2/v3), Tauri IPC, SQLite persistence, React table/panel UI, ADF rendering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ticket list layout:**
- Table rows with columns: Key, Summary, Status, Priority, Assignee, Updated date
- Default sort: updated descending (most recently updated first)
- Clickable column headers to sort by any column (toggle asc/desc on re-click)
- Click row to open ticket detail in side panel

**Ticket detail view:**
- Side panel sliding from right (~40-50% width), ticket list stays visible on left
- Tabbed content organization: Overview | Comments | Work Log | Attachments | History
- Overview tab shows: status, priority, assignee, reporter, labels, components, fix versions, description, sub-tasks list, linked issues
- Description rendered as formatted HTML (wiki markup/ADF converted to readable HTML with headings, bold, code blocks, links)
- Images in descriptions rendered inline, proxied through Rust backend (PAT auth required to fetch from Jira)

**Watched users configuration:**
- Settings page section (under existing gear icon from Phase 2), "Fetch Configuration" section below connections
- Claude's discretion on implementation approach (simple text list vs autocomplete based on Jira API capabilities)

**JQL query customization:**
- Two-tier approach: preset dropdown + "Advanced" toggle for raw JQL editing
- Three presets: "Assigned to me", "Mentioned me", "All watched" (combines my tickets + watched users)
- Advanced mode shows editable text area with the generated JQL and a "Reset to default" button
- Settings live on the Settings page under "Fetch Configuration"

**Fetch trigger and flow:**
- Manual "Fetch Tickets" button — user controls when to hit the customer Jira
- Shows "Last fetched: X ago" timestamp next to the button
- Summary line: "N candidates, M new"

**Triage state display:**
- New/unseen tickets: blue dot indicator on the row
- Seen tickets: normal styling (no indicator)
- Copied tickets: green checkmark indicator
- Ignored tickets: hidden from default view (handled in Phase 6 triage)

**Triage state persistence:**
- SQLite database (extends existing audit SQLite) — table mapping ticket key to triage state + timestamps
- Survives app restarts per FETCH-12

**Pagination:**
- Claude's discretion — pick approach based on typical batch size (5-20 tickets per session). Server-side pagination with load-more if needed for larger result sets.

### Claude's Discretion
- Watched users implementation approach (text list vs autocomplete)
- Pagination strategy (given 5-20 typical batch size)
- Loading states and skeleton design
- Error handling for failed fetches
- Side panel transition animation
- Tab styling within detail panel
- Image proxy implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FETCH-01 | User can fetch candidate tickets from customer Jira assigned to them | JQL `assignee = currentUser()` via v2 GET /search or v3 POST /search/jql; mock server already has assignee filter |
| FETCH-02 | User can fetch candidate tickets where they were mentioned | JQL `mention = currentUser()` — needs to be added to preset JQL generation |
| FETCH-03 | User can configure watched users and fetch their tickets too | Watched users stored in SQLite (fetch_config table); JQL extended with `assignee in (u1, u2)` |
| FETCH-04 | User can view full ticket detail: summary, description, status, priority, assignee, reporter, labels, components, fix versions | GET /rest/api/2/issue/{key}?expand=renderedFields,changelog; fixture data needs labels/components/fixVersions added |
| FETCH-05 | User can view ticket comments thread with authors and timestamps | Already in issue fields.comment.comments in both v2 and v3 fixtures |
| FETCH-06 | User can view ticket work log entries with authors and time spent | GET /rest/api/2/issue/{key}/worklog — new mock endpoint needed; new Rust command needed |
| FETCH-07 | User can view ticket attachments list with filenames and sizes | Already in issue fields.attachment in fixtures |
| FETCH-08 | User can view ticket sub-tasks list | Already in issue fields.subtasks in fixtures |
| FETCH-09 | User can view ticket linked issues | Already in issue fields.issuelinks in fixtures |
| FETCH-10 | User can view ticket change history | GET /rest/api/2/issue/{key}?expand=changelog returns changelog.histories; mock needs changelog fixture data |
| FETCH-11 | User can customize the JQL query used to fetch candidates | Two-tier UI (presets + advanced textarea) on SettingsPage; JQL stored in SQLite fetch_config table |
| FETCH-12 | App remembers triage state (seen/ignored/copied) across sessions | New SQLite table `triage_state`; Rust command to read/write; Zustand store hydrated on app start |
</phase_requirements>

---

## Summary

Phase 3 builds the core read workflow: fetching candidate tickets from the customer's Jira Server (v2 API), displaying them in a sortable table, and letting the user drill into full ticket detail in a side panel. All state — triage status, watched users, JQL config, last fetch timestamp — persists in the existing SQLite database via new tables and Tauri commands.

The primary technical complexity lives in three areas: (1) the Rust fetch layer needs new commands and mock endpoints for worklog, changelog, and the image proxy; (2) the frontend needs a sortable table and a tabbed side panel with per-tab lazy loading; (3) description rendering requires parsing wiki markup (v2 plain text + `renderedFields` HTML) and ADF JSON (v3) into readable HTML.

The good news: existing fixtures already contain comments, attachments, sub-tasks, and linked issues. The mock server already has `GET /issue/{key}`. The biggest gaps are the worklog and changelog endpoints (not yet in the mock) and the image proxy Tauri command.

**Primary recommendation:** Use `expand=renderedFields` on the Jira Server v2 issue fetch to get description as server-rendered HTML — do not hand-roll a wiki markup parser. For Cloud v3 ADF, use `simple-adf-formatter` (Apache 2.0, lightweight, React output). Image proxy: implement as a Tauri `invoke` command (`fetch_jira_image`) that fetches bytes with the stored PAT and returns base64 — simpler and more auditable than a custom URI scheme.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Rust / rusqlite | 0.39 (bundled) | SQLite for triage state + fetch config | Already used for audit log; same DB file, new tables |
| @tauri-apps/api | ^2.10.1 | IPC bridge (`invoke`) | Established pattern — all Rust commands go through this |
| zustand | ^5.0.12 | Frontend state for tickets, triage, fetch config | Project-wide state management choice |
| React + TypeScript | 19.x / 5.7.x | Component UI | Project-wide |
| Tailwind CSS | ^4.2.2 | Styling — table, panel, tabs | Project-wide |

### New Additions
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simple-adf-formatter | latest (~2.x) | Parse ADF JSON (Cloud v3 descriptions) to React elements | Cloud v3 description/comment bodies only |

**Installation:**
```bash
npm install simple-adf-formatter
```

**Version verification:**
```bash
npm view simple-adf-formatter version
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `simple-adf-formatter` | `@atlaskit/renderer` | Atlaskit renderer is the official package but is 126.x major version, massive bundle, requires Atlassian's internal CSS toolchain — completely impractical for this app |
| `simple-adf-formatter` | Hand-rolled ADF traversal | ADF has 30+ node types; hand-rolling misses marks, lists, code blocks, tables, media nodes |
| `renderedFields` HTML (v2) | jira-markup-js or custom parser | `renderedFields` gives server-canonical HTML, no parser maintenance, handles all custom wiki macros |
| Tauri URI scheme protocol (image proxy) | Custom protocol registered in `main.rs` | URI scheme requires CSP changes, async handler registration, more complex; `invoke` command is simpler to audit |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── features/
│   └── tickets/              # Already exists (empty)
│       ├── ticketStore.ts    # Zustand: tickets[], selectedKey, triageMap, fetchConfig
│       ├── fetchConfigStore.ts  # OR merged into ticketStore — watchedUsers, jql, lastFetchedAt
│       ├── TicketListPage.tsx   # Main view: fetch button + table
│       ├── TicketTable.tsx      # Sortable table component
│       ├── TicketDetailPanel.tsx # Side panel wrapper + tabs
│       ├── tabs/
│       │   ├── OverviewTab.tsx
│       │   ├── CommentsTab.tsx
│       │   ├── WorkLogTab.tsx
│       │   ├── AttachmentsTab.tsx
│       │   └── HistoryTab.tsx
│       ├── DescriptionRenderer.tsx  # Renders wiki HTML (v2) or ADF (v3)
│       ├── TriageIndicator.tsx      # Blue dot / green check row indicator
│       └── types.ts                 # Ticket, TriageState, FetchConfig types
src-tauri/
└── src/
    ├── commands.rs           # New: fetch_tickets, fetch_ticket_detail, fetch_worklog,
    │                         #      fetch_changelog, fetch_jira_image, get_triage_state,
    │                         #      set_triage_state, get_fetch_config, set_fetch_config
    ├── triage_db.rs          # New: TriageDb wrapping existing SQLite conn — new tables
    ├── fixtures.rs           # Extended: add labels, components, fixVersions, worklog,
    │                         #           changelog fields to existing fixture issues
    └── mock_server.rs        # Extended: add /worklog and /changelog endpoints
```

### Pattern 1: Rust Fetch Command Pattern

Follow the existing `test_jira_server_connection` command shape: retrieve stored credentials from keychain, build an audited client, make the HTTP call, return a typed result.

**What:** New async Tauri commands that retrieve credentials from keychain, construct JQL from stored config, call Jira, return serializable structs.

**When to use:** Every new Jira API call goes through this pattern — no direct HTTP from the frontend.

```typescript
// Frontend invocation (established pattern)
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<FetchTicketsResult>('fetch_tickets', {
  baseUrl: serverConn.baseUrl,
});
```

```rust
// Rust command (follows existing commands.rs pattern)
#[tauri::command]
pub async fn fetch_tickets(
    base_url: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<FetchTicketsResult, AppError> {
    // 1. Get PAT from keychain
    // 2. Get JQL from triage_db fetch_config
    // 3. Build audited client, call /rest/api/2/search?jql=...
    // 4. Return issues + mark previously-unseen as "new" in triage_db
    // ...
}
```

### Pattern 2: SQLite Triage State

**What:** Two new tables in the existing `pmkar.db` file — `triage_state` and `fetch_config`. A new `TriageDb` struct (or methods added to `AuditDb`) handles reads and writes.

**New module:** `src-tauri/src/triage_db.rs`

```sql
-- triage_state table
CREATE TABLE IF NOT EXISTS triage_state (
    ticket_key   TEXT PRIMARY KEY,
    state        TEXT NOT NULL CHECK(state IN ('new', 'seen', 'ignored', 'copied')),
    first_seen   TEXT NOT NULL,   -- ISO 8601
    last_updated TEXT NOT NULL
);

-- fetch_config table (single-row configuration)
CREATE TABLE IF NOT EXISTS fetch_config (
    id              INTEGER PRIMARY KEY CHECK(id = 1),
    jql_preset      TEXT NOT NULL DEFAULT 'assigned',  -- 'assigned'|'mentioned'|'all_watched'|'custom'
    jql_custom      TEXT,
    watched_users   TEXT NOT NULL DEFAULT '[]',  -- JSON array of usernames/accountIds
    last_fetched_at TEXT                          -- ISO 8601 or NULL
);
```

**Managed as Tauri state:** `Arc<Mutex<TriageDb>>` added alongside `Arc<Mutex<AuditDb>>` in `lib.rs` / `main.rs`.

### Pattern 3: Image Proxy via invoke Command

**What:** `fetch_jira_image` Tauri command — fetches image bytes from Jira using stored PAT, returns base64 data URL to frontend. The frontend injects it as `src="data:image/...;base64,..."` in `<img>` elements found inside rendered description HTML.

**Why not URI scheme protocol:** The existing codebase uses `invoke` for all Jira HTTP calls (auditable, credential-safe). URI scheme protocols require CSP policy changes in `tauri.conf.json`, async protocol registration in `main.rs`, and still need credential access — more complexity with no benefit.

```rust
#[tauri::command]
pub async fn fetch_jira_image(
    image_url: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<String, AppError> {
    // Validate URL starts with configured base_url (security: no arbitrary URL fetch)
    // Get PAT from keychain
    // Fetch with audited client
    // Return base64: format!("data:{mime_type};base64,{}", base64::encode(bytes))
}
```

Frontend usage in `DescriptionRenderer.tsx`: after setting `innerHTML` with rendered HTML, walk `img` elements and replace `src` with invoke result.

### Pattern 4: Zustand Ticket Store

**What:** New `useTicketStore` in `src/features/tickets/ticketStore.ts` following the `useConnectionStore` shape.

```typescript
interface TicketState {
  tickets: JiraTicket[];
  selectedTicketKey: string | null;
  triageMap: Record<string, TriageState>;  // key -> 'new'|'seen'|'ignored'|'copied'
  fetchStatus: 'idle' | 'loading' | 'error';
  lastFetchedAt: string | null;
  totalCount: number;
  newCount: number;
  // Actions
  setTickets: (tickets: JiraTicket[], triageMap: Record<string, TriageState>) => void;
  selectTicket: (key: string | null) => void;
  markSeen: (key: string) => void;
  setFetchStatus: (status: 'idle' | 'loading' | 'error') => void;
}
```

**Triage hydration on startup:** On app mount (in `TicketListPage` or `App.tsx`), invoke `get_triage_state` to hydrate the Zustand store — tickets persisted in SQLite, but issue data itself is NOT cached (re-fetched each session).

### Pattern 5: Sortable Table without External Library

Given 5-20 rows, a custom sortable table in React with `useMemo` for sort logic is trivial and avoids adding a table library dependency. Use `useState` for `{ column, direction }` sort state.

```typescript
// In TicketTable.tsx
const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({
  col: 'updated', dir: 'desc'
});
const sorted = useMemo(() => [...tickets].sort(comparator(sort)), [tickets, sort]);
```

### Anti-Patterns to Avoid

- **Fetching ticket detail on every panel open:** Load all field data in the initial `fetch_tickets` call using `fields=*` or field list — avoid a second network call per ticket for Overview tab content (comments/worklog/history tabs can lazy-load separately since they have their own endpoints).
- **Parsing wiki markup in the frontend:** Never parse Jira wiki markup in TypeScript. Use `expand=renderedFields` to get server-rendered HTML from Jira Server v2.
- **Storing full issue JSON in SQLite:** Only store triage state (key + state + timestamps) in SQLite. Issue content is ephemeral and re-fetched each session.
- **Using @atlaskit/renderer:** Massive bundle (~1MB+), internal build toolchain dependencies, not designed for standalone apps.
- **Global state mutation without Tauri sync:** Always write triage state changes to SQLite via `invoke` before updating Zustand — prevents desync on crash.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ADF JSON → React rendering | Custom ADF traversal/renderer | `simple-adf-formatter` | ADF has 30+ node/mark types; inline code, tables, mention nodes, media are non-trivial |
| Wiki markup → HTML | Markup parser | `expand=renderedFields` on Jira Server v2 fetch | Server knows all custom macros; 100% fidelity, zero maintenance |
| Sortable table | External table library | Custom `useMemo` sort (5-20 rows) | Trivial at this scale; saves bundle size, no API to learn |
| Relative timestamps ("3 hours ago") | Date library | Simple JS `Intl.RelativeTimeFormat` | No dependency needed for basic relative time at this scale |

**Key insight:** The Jira v2 `expand=renderedFields` endpoint is the most important "don't hand-roll" decision. It eliminates the wiki markup parsing problem entirely for Server connections.

---

## Common Pitfalls

### Pitfall 1: Missing Fields in Issue Fetch

**What goes wrong:** `GET /rest/api/2/search` returns a limited field set by default. Labels, components, fixVersions, and updated date may be absent.

**Why it happens:** Jira search API defaults to a subset of fields. The fixture issues in `fixtures.rs` also lack `labels`, `components`, `fixVersions`, `updated`, and `worklog` fields.

**How to avoid:** Explicitly request fields: `fields=summary,status,priority,assignee,reporter,labels,components,fixVersions,description,comment,attachment,subtasks,issuelinks,updated` in the JQL search call. OR use `fields=*all` (slower but complete). Update fixtures to include these fields.

**Warning signs:** Frontend shows "undefined" or empty fields in the Overview tab.

### Pitfall 2: `renderedFields` Not Returned for Search Endpoint

**What goes wrong:** `expand=renderedFields` works on `GET /rest/api/2/issue/{key}` but returns an empty/partial `renderedFields` object on `GET /rest/api/2/search`.

**Why it happens:** Jira Server's search endpoint has historically had partial `renderedFields` support. Community reports confirm inconsistency.

**How to avoid:** Fetch list via search (summary, status, priority, assignee, updated only). Fetch individual issue detail via `GET /rest/api/2/issue/{key}?expand=renderedFields,changelog` when the user opens the panel. This is the correct two-request pattern anyway — list is lightweight, detail is rich.

**Warning signs:** Description shows raw `{panel}`, `*bold*`, `h2.` wiki syntax in the UI.

### Pitfall 3: Triage State Desync on Fast Interactions

**What goes wrong:** User opens ticket (marks as "seen"), immediately opens next ticket — second mark-seen invoke fires before first returns. Race condition leaves triage state stale.

**Why it happens:** Zustand updates are synchronous but `invoke` is async. If Zustand is updated optimistically without awaiting the DB write, a crash between the two leaves them desynced.

**How to avoid:** For mark-seen: optimistic Zustand update is fine (low stakes if lost). For mark-ignored/mark-copied (higher stakes): await the invoke before updating store. Use a simple in-flight flag per key to prevent double-writes.

### Pitfall 4: Worklog and Changelog Not in Issue Fields

**What goes wrong:** Attempting to read `issue.fields.worklog` or `issue.fields.changelog` after fetching the issue returns null/undefined.

**Why it happens:** Worklog is not in `fields.*` by default in v2. Changelog requires `expand=changelog` on the individual issue endpoint, not the search endpoint. The mock server currently has NO worklog or changelog endpoints.

**How to avoid:**
- Work Log tab: call `GET /rest/api/2/issue/{key}/worklog` separately (lazy load on tab click)
- History tab: call `GET /rest/api/2/issue/{key}?expand=changelog` on detail fetch, or include `changelog` in the expand parameter alongside `renderedFields`
- Add both endpoints to mock server in Wave 0

### Pitfall 5: Image URLs in Descriptions Require Authentication

**What goes wrong:** Description HTML from `renderedFields` contains `<img src="https://jira-server.company.com/secure/attachment/...">` URLs. Browser `<img>` tags cannot authenticate with PAT, so images 403.

**Why it happens:** Jira attachment/thumbnail URLs require the same PAT auth as API calls. The webview makes the request as a plain HTTP GET with no auth header.

**How to avoid:** Post-process rendered HTML: find all `<img>` elements, replace `src` with a call to `fetch_jira_image` Tauri command, display base64 data URLs. This is the image proxy the CONTEXT.md prescribes.

### Pitfall 6: ADF "version" Field Mishandled

**What goes wrong:** ADF JSON sometimes arrives without the `version` field or with `version: 2` — `simple-adf-formatter` may silently fail.

**Why it happens:** Some Jira Cloud versions or third-party add-ons emit non-standard ADF. The fixture ADF uses `version: 1` (correct per project decision in Phase 1).

**How to avoid:** Validate ADF input before passing to formatter: `if (!doc.version) doc.version = 1`. Fall back to `JSON.stringify` display if formatter throws.

### Pitfall 7: SQLite Single Connection with Mutex

**What goes wrong:** Concurrent Tauri commands attempting to write to SQLite simultaneously cause mutex contention or "database is locked" errors.

**Why it happens:** `rusqlite::Connection` is not `Send`; wrapped in `Arc<Mutex<>>` means serialized access. With multiple commands writing simultaneously (fetch returns + mark-seen fires), the lock is held too long.

**How to avoid:** Keep DB writes in triage_db fast (single INSERT/UPDATE by primary key). The existing audit log pattern uses `let _ = db.insert(...)` with silent failure — apply same philosophy to triage writes (loss of one "seen" mark is acceptable; data is rebuilt on next fetch).

---

## Code Examples

Verified patterns from existing codebase and research:

### Jira Server v2: Search with Fields + Changelog Expand

```rust
// Fetch list: lightweight fields only
let search_url = format!(
    "{}/rest/api/2/search?jql={}&fields=summary,status,priority,assignee,updated&maxResults=50",
    base_url,
    urlencoding::encode(&jql)
);
let resp = client.get(&search_url)
    .header("Authorization", format!("Bearer {}", pat))
    .send().await?;

// Fetch individual detail: rendered description + changelog
let detail_url = format!(
    "{}/rest/api/2/issue/{}?expand=renderedFields,changelog&fields=*all",
    base_url, key
);
```

### Worklog Endpoint (v2)

```
GET /rest/api/2/issue/{key}/worklog
```

Response shape:
```json
{
  "worklogs": [
    {
      "id": "...",
      "author": { "name": "jdoe", "displayName": "Jane Doe" },
      "comment": "Fixed the issue",
      "started": "2026-01-15T10:00:00.000+0000",
      "timeSpent": "2h",
      "timeSpentSeconds": 7200
    }
  ]
}
```

### Changelog (via expand)

```json
{
  "changelog": {
    "histories": [
      {
        "id": "10000",
        "author": { "name": "jdoe", "displayName": "Jane Doe" },
        "created": "2026-01-15T10:00:00.000+0000",
        "items": [
          {
            "field": "status",
            "fromString": "Open",
            "toString": "In Progress"
          }
        ]
      }
    ]
  }
}
```

### SQLite Triage State DDL

```sql
CREATE TABLE IF NOT EXISTS triage_state (
    ticket_key   TEXT PRIMARY KEY,
    state        TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied')),
    first_seen   TEXT NOT NULL,
    last_updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fetch_config (
    id              INTEGER PRIMARY KEY CHECK(id = 1),
    jql_preset      TEXT NOT NULL DEFAULT 'assigned',
    jql_custom      TEXT,
    watched_users   TEXT NOT NULL DEFAULT '[]',
    last_fetched_at TEXT
);
```

### Zustand Store Hydration on App Start

```typescript
// In TicketListPage useEffect or App.tsx
useEffect(() => {
  invoke<Record<string, TriageState>>('get_triage_state')
    .then((map) => useTicketStore.getState().hydrateTriageMap(map))
    .catch(() => {}); // non-fatal — app still works, just loses triage indicators
}, []);
```

### simple-adf-formatter Usage Pattern

```typescript
import { createFormatter } from 'simple-adf-formatter';
import { createElement } from 'react';

const htmlFormatter = createFormatter({
  // text node
  text: ({ text, marks }) => {
    let node: React.ReactNode = text;
    if (marks?.some(m => m.type === 'strong')) node = createElement('strong', {}, node);
    if (marks?.some(m => m.type === 'code')) node = createElement('code', {}, node);
    return node;
  },
  // ... other node handlers
});

// In DescriptionRenderer.tsx for Cloud v3
function AdfContent({ adf }: { adf: AdfDoc }) {
  const content = htmlFormatter(adf);
  return <div className="prose">{content}</div>;
}
```

### Image Proxy — Frontend Side

```typescript
// Post-process HTML from renderedFields to replace img srcs
async function injectProxiedImages(html: string): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'));
  await Promise.all(imgs.map(async (img) => {
    try {
      const dataUrl = await invoke<string>('fetch_jira_image', { imageUrl: img.src });
      img.src = dataUrl;
    } catch {
      img.alt = '[image unavailable]';
      img.removeAttribute('src');
    }
  }));
  return doc.body.innerHTML;
}
```

### Mock Server: Add Worklog Endpoint (axum)

```rust
// In mock_server.rs, v2 module
pub async fn get_worklog(
    State(fixtures): State<SharedFixtures>,
    Path(key): Path<String>,
) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    match state.server_v2_issues.get(&key) {
        Some(issue) => {
            let worklogs = issue.fields.get("worklog")
                .cloned()
                .unwrap_or(json!({ "worklogs": [] }));
            (StatusCode::OK, Json(worklogs)).into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
// Register: .route("/rest/api/2/issue/{key}/worklog", get(v2::get_worklog))
```

---

## Jira API Reference (Confirmed)

### Jira Server v2 Endpoints Used in Phase 3

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/rest/api/2/search` | GET | Fetch candidate list (JQL in query param) |
| `/rest/api/2/issue/{key}` | GET | Fetch full detail (`?expand=renderedFields,changelog&fields=*all`) |
| `/rest/api/2/issue/{key}/worklog` | GET | Fetch work log entries |
| `/rest/api/2/myself` | GET | Get current user (for JQL `currentUser()` resolution and watched user lookup) |

### Mock Server Gaps (must add in Wave 0)

| Gap | Endpoint | Priority |
|-----|----------|----------|
| Worklog responses | `GET /rest/api/2/issue/{key}/worklog` | Required for FETCH-06 |
| Changelog in issue response | `fields.changelog` added to fixture issues, or `expand=changelog` handling | Required for FETCH-10 |
| Labels/components/fixVersions | Fixture fields only | Required for FETCH-04 |
| `updated` field | Fixture fields only | Required for table sort |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@atlaskit/renderer` for ADF | `simple-adf-formatter` (lightweight) | 2023-2024 | Atlaskit renderer became impractical outside Atlassian infra; lightweight alternatives emerged |
| Wiki markup parser (jira-markup-js) | `expand=renderedFields` server-side HTML | Always existed, underused | Eliminates client-side parsing entirely |
| URI scheme protocol for image proxy | `invoke` command returning base64 | N/A (new design) | Simpler to audit, no CSP changes needed |
| Separate SQLite DB file for new data | Extend existing audit DB with new tables | N/A | Reduces file handle count, easier migrations |

**Deprecated/outdated:**
- `jira-markup-js` npm package: last published ~2021, abandoned. Do not use.
- Jira Server REST API v2 is "end of support" (Feb 2024) but is functionally complete for all Phase 3 operations — the API itself still works on legacy installations, which is exactly our use case.

---

## Open Questions

1. **Watched users: text input or Jira user search autocomplete?**
   - What we know: Jira Server v2 has `GET /rest/api/2/user/search?username=...` which returns matching users
   - What's unclear: Whether the customer's Jira instance will have broad user search permissions
   - Recommendation: Implement as plain text list input first (one username/accountId per line). Autocomplete is CLAUDE'S DISCRETION per CONTEXT.md — research says the endpoint exists but may be permission-restricted. Phase 3 plan should use the simpler text list approach.

2. **Pagination: given 5-20 typical batch size, is pagination needed at all?**
   - What we know: JQL search with `maxResults=50` will cover 95%+ of use cases per PROJECT.md
   - What's unclear: Whether power users might hit 50+ candidates
   - Recommendation: Implement `maxResults=50` with a visible "Showing first 50 results" message if `total > 50`. No load-more pagination needed in Phase 3; add in a later phase if requested.

3. **`renderedFields` reliability across Jira Server versions**
   - What we know: Community reports show partial reliability for non-standard fields; core system fields (description) work consistently
   - What's unclear: Customer's exact Jira Server version
   - Recommendation: Use `renderedFields.description` with a fallback to plain text `fields.description` if `renderedFields` is absent/empty.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 + @testing-library/react 16.3 |
| Config file | `vitest.config.ts` (project root) |
| Setup file | `src/test-setup.ts` (jest-dom + WebCrypto polyfill) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FETCH-01/02/03 | `fetch_tickets` invokes Tauri with correct JQL per preset | unit | `npm test -- --reporter=verbose src/features/tickets/` | Wave 0 |
| FETCH-04 | OverviewTab renders summary, status, priority, labels, etc. | unit | `npm test -- src/features/tickets/` | Wave 0 |
| FETCH-05 | CommentsTab renders comment list with author + timestamp | unit | `npm test -- src/features/tickets/` | Wave 0 |
| FETCH-06 | WorkLogTab renders worklog entries (lazy load on tab click) | unit | `npm test -- src/features/tickets/` | Wave 0 |
| FETCH-07 | AttachmentsTab renders attachment list with filename + size | unit | `npm test -- src/features/tickets/` | Wave 0 |
| FETCH-08 | OverviewTab renders sub-tasks list | unit | `npm test -- src/features/tickets/` | Wave 0 |
| FETCH-09 | OverviewTab renders linked issues | unit | `npm test -- src/features/tickets/` | Wave 0 |
| FETCH-10 | HistoryTab renders changelog entries | unit | `npm test -- src/features/tickets/` | Wave 0 |
| FETCH-11 | Settings page renders JQL preset dropdown + advanced textarea | unit | `npm test -- src/features/connections/SettingsPage.test.tsx` | Wave 0 |
| FETCH-12 | `get_triage_state` invoke called on mount; triage indicators shown | unit | `npm test -- src/features/tickets/` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/tickets/TicketListPage.test.tsx` — covers FETCH-01/02/03, FETCH-12
- [ ] `src/features/tickets/TicketDetailPanel.test.tsx` — covers FETCH-04 through FETCH-10
- [ ] `src/features/connections/SettingsPage.test.tsx` — extend existing SettingsPage for FETCH-11
- [ ] Mock server worklog endpoint: `GET /rest/api/2/issue/{key}/worklog` in `mock_server.rs`
- [ ] Mock server changelog: add `changelog.histories` to fixture data + detail handler
- [ ] Fixture fields: add `labels`, `components`, `fixVersions`, `updated` to at least PROJ-1 and PROJ-2

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src-tauri/src/` (commands.rs, mock_server.rs, fixtures.rs, audit.rs, jira_client.rs) — direct inspection
- Existing codebase: `src/features/connections/` — established patterns for store, IPC, Tailwind styling
- Existing codebase: `vitest.config.ts`, `src/test-setup.ts` — confirmed test infrastructure

### Secondary (MEDIUM confidence)
- Jira Server REST API — `GET /rest/api/2/search`, `expand=renderedFields,changelog`, `/worklog` endpoint confirmed via Atlassian community discussions and official API reference
- Tauri v2 `invoke` pattern — confirmed via v2.tauri.app/develop/calling-rust/
- `simple-adf-formatter` on GitHub (dixahq/simple-adf-formatter) — Apache 2.0, actively maintained, renders to React elements
- `@atlaskit/renderer` size concern — confirmed by npm package page (126.x major, Atlassian infra dependency chain)

### Tertiary (LOW confidence)
- `renderedFields` reliability across Jira Server versions — community discussion only, no official version matrix
- Tauri 2 URI scheme protocol async handler specifics — documentation was incomplete at research time; `invoke` command recommended as simpler alternative

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all new additions are minimal (one npm package), rest already in project
- Architecture patterns: HIGH — direct extension of proven Phase 2 patterns
- Jira API endpoints: MEDIUM-HIGH — v2 API is stable/frozen, confirmed via docs; worklog/changelog shapes confirmed via community + official v2 reference
- ADF rendering approach: MEDIUM — `simple-adf-formatter` works but ADF coverage completeness is not independently verified; fallback strategy documented
- Image proxy via invoke: HIGH — avoids URI scheme complexity, consistent with project's audit-everything philosophy
- Mock server gaps: HIGH — confirmed by direct inspection of mock_server.rs and fixtures.rs

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (Jira API is stable; Tauri 2 moves fast but patterns are stable)
