# Phase 16: Enhanced Watch Configuration - Research

**Researched:** 2026-03-29
**Domain:** Jira REST API user search (Server v2 + Cloud v3), Tauri command layer, React settings UI
**Confidence:** HIGH (codebase), MEDIUM (Jira Cloud email privacy specifics — intentionally unvalidated per STATE.md blocker)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Domain selector lives inside the existing "Watched Users" section in SettingsPage as a sub-section below the individual user search — keeps all watch config in one place
- **D-02:** Auto-prepend @ and validate format — user types "acme.com" or "@acme.com", both accepted. Invalid formats (no dot, special chars) show inline error
- **D-03:** After entering a domain and triggering search, the app queries Jira for users matching that email domain and presents results for confirmation before adding
- **D-04:** When Jira Cloud email privacy hides addresses, display an inline yellow warning banner below search results explaining the privacy issue and suggesting the user contact their Jira admin. Non-blocking — user can still add users manually
- **D-05:** Dedup silently — single entry per user regardless of how they were added (domain vs manual). No duplicates in the watchedUsers list

### Claude's Discretion

- Results UI design: how matched users are presented (table, chips, etc.) and selection mechanism (checkboxes, select-all, pre-selected removable chips)
- Search UX: whether results appear inline below input, in a modal, or another pattern
- Privacy warning trigger timing: on empty results only vs always for Cloud connections vs pre-check
- Storage model: whether domain-resolved users merge into the same flat watchedUsers list or use separate storage with domain rule tracking (decision should weigh simplicity vs re-resolve capability)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WTCH-01 | User can add a watch selector by email domain (e.g. @acme.com) | Domain input sub-section in SettingsPage; new `search_jira_users_by_domain` Tauri command; domain validation regex |
| WTCH-02 | Domain selector resolves to matching users at config time (search + confirm list) | Jira Cloud `/rest/api/3/user/search?query=@domain.com`; confirmation UI with checkboxes; merge into `watchedUsers` via `setWatchedUsers` + `persistFetchConfigWith` |
</phase_requirements>

---

## Summary

Phase 16 adds email-domain-based bulk add to the existing Watched Users settings section. The user types a domain (e.g. "acme.com"), the app searches Jira for matching users, presents a checkbox list for confirmation, and merges selected users into the flat `watchedUsers` array.

The key technical challenge is **Jira API asymmetry**: the existing `search_jira_users` command calls the Jira Server v2 endpoint (`/rest/api/2/user/search?username=<query>`) using a PAT. The Cloud v3 equivalent is `/rest/api/3/user/search?query=<query>` using Basic auth (email + API token). A new Tauri command is needed for Cloud domain search, or the existing command must be generalized.

The **email privacy risk** is real and validated: when Jira Cloud users set email visibility to "Only you and admins", the `emailAddress` field is **silently absent** (not null, not empty — omitted entirely) from API responses. The app cannot force email disclosure. Detection: check whether `emailAddress` is present in any returned user object. If the Cloud connection is active and zero users are found (or all returned users lack `emailAddress`), show the amber privacy warning banner (D-04, already specified in UI-SPEC).

Storage is simple: domain-resolved users merge into the existing flat `watchedUsers: Vec<String>` (SQLite `fetch_config.watched_users` as JSON array). No schema change needed.

**Primary recommendation:** Add one new Tauri command `search_jira_users_by_domain` for Cloud (v3 API, Basic auth). Reuse the existing `search_jira_users` command path for Server (v2, PAT, pass domain string as query). Frontend adds domain input sub-section below existing user search, triggers search on button click / Enter, renders inline results list with checkboxes per UI-SPEC, and calls `handleAddUser` in bulk on "Add selected".

---

## Standard Stack

### Core (all already in project — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| reqwest | (via Cargo.lock) | HTTP client for Jira API calls in Rust | Already used for all existing Jira commands |
| serde_json | (via Cargo.lock) | JSON serialization/deserialization | Already used throughout commands.rs |
| Tauri command layer | 2.x | Expose Rust functions to TypeScript frontend | Existing pattern for all commands |
| Zustand (`useTicketStore`) | (via package.json) | Frontend state — `watchedUsers`, `setWatchedUsers` | Already manages watched users |
| i18next / react-i18next | (via package.json) | Translations | All settings strings already i18n'd |
| lucide-react | (via package.json) | Icons (AtSign, AlertTriangle) | Already used in SettingsPage |

### Supporting (already installed, may need new component)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn Checkbox | (from official registry) | Checkbox for user selection in results list | Per UI-SPEC registry safety table — allowed from official shadcn registry without vetting |
| shadcn Separator | (from official registry) | Visual separator between existing user search and new domain sub-section | Per UI-SPEC — already allowed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New command `search_jira_users_by_domain` | Generalize existing `search_jira_users` | New command is cleaner — existing command is Server-only (Bearer PAT), Cloud needs Basic auth. Merging would complicate auth logic |
| Inline results list (UI-SPEC choice) | Modal dialog | Inline matches existing SettingsPage pattern, no z-index issues |

**Installation:**
```bash
# Shadcn Checkbox (if not already installed)
npx shadcn@latest add checkbox

# Shadcn Separator (if not already installed)
npx shadcn@latest add separator
```

**Version verification:** All Rust dependencies already resolved in Cargo.lock. All npm dependencies already in package.json. No new packages required beyond potential shadcn components.

---

## Architecture Patterns

### Existing Patterns to Follow

**Tauri command pattern** (from commands.rs `search_jira_users`):
```rust
// Source: src-tauri/src/commands.rs lines 1005-1034
#[tauri::command]
pub async fn search_jira_users(
    base_url: String,
    query: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');
    let encoded_query = urlencoding::encode(&query);
    let url = format!("{trimmed_url}/rest/api/2/user/search?username={encoded_query}");
    // ...Bearer PAT auth, returns Vec<serde_json::Value>
}
```

**New Cloud command pattern** (follows `fetch_cloud_meta` for auth, `search_jira_users` for shape):
```rust
// New command: search_jira_users_by_domain (Cloud v3 variant)
// - Uses get_cloud_credentials() for (base_url, email, api_token)
// - Basic auth: base64(email:api_token)
// - Endpoint: /rest/api/3/user/search?query=@{domain}&maxResults=50
// - Returns Vec<serde_json::Value> (same shape as existing command)
// - Must be registered in main.rs invoke_handler
```

**Frontend invoke pattern** (from SettingsPage.tsx lines 298-315):
```typescript
// Source: src/features/connections/SettingsPage.tsx
invoke<JiraUser[]>('search_jira_users', {
  baseUrl: serverConn.baseUrl,
  query: userQuery.trim(),
})
```

**Persist pattern** (from SettingsPage.tsx lines 377-386):
```typescript
// Source: src/features/connections/SettingsPage.tsx
function persistFetchConfigWith(users: string[]) {
  const state = useTicketStore.getState();
  const config: FetchConfig = {
    jqlPreset: state.jqlPreset,
    jqlCustom: state.jqlCustom,
    watchedUsers: Array.isArray(users) ? users : [],
    lastFetchedAt: state.lastFetchedAt,
  };
  invoke('set_fetch_config', { config }).catch(() => {});
}
```

**Dedup pattern** (from handleAddUser):
```typescript
// Source: src/features/connections/SettingsPage.tsx lines 337-347
function handleAddUser(username: string) {
  if (!username || safeWatchedUsers.includes(username)) return;
  const updated = [...safeWatchedUsers, username];
  useTicketStore.getState().setWatchedUsers(updated);
  persistFetchConfigWith(updated);
}
```

**Bulk add** must replicate this dedup: filter results by `!safeWatchedUsers.includes(u.name)` before merging.

### Recommended Component Structure

No new files for the UI — all additions go inside the `case 'watched-users':` block in SettingsPage.tsx (line 651). Local state for domain search lives alongside existing `userQuery` / `suggestions` state in the same component.

New local state needed in SettingsPage:
```typescript
const [domainQuery, setDomainQuery] = useState('');
const [domainResults, setDomainResults] = useState<JiraUser[]>([]);
const [domainSearchState, setDomainSearchState] = useState<
  'idle' | 'loading' | 'results' | 'empty' | 'error'
>('idle');
const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
```

### JiraUser Type Extension

The existing `JiraUser` interface (in `types.ts`) already has `emailAddress?: string` and `accountId?: string`. The domain search results use `accountId` (Cloud v3) instead of `name` (Server v2). The `watchedUsers` array stores strings — for Cloud users this will be `accountId`.

**Critical**: Check what `build_poll_jql` does with `watched_users` values. From `poll_engine.rs` line 280, it simply wraps each string in quotes: `format!("\"{u}\"")`. JQL `assignee in ("accountId-value")` works in Cloud v3 — accountId is a valid assignee selector.

### Anti-Patterns to Avoid

- **Don't reuse `search_jira_users` for Cloud**: It uses Bearer PAT auth which is correct for Server only. Cloud requires Basic auth with email:apitoken.
- **Don't filter by `emailAddress` for dedup**: Use `accountId` for Cloud, `name` for Server. The `watchedUsers` array may contain a mix.
- **Don't add domain search results to the existing Server user search flow**: Domain search is a separate input with its own trigger (button/Enter), not debounced typeahead.
- **Don't block "Add selected" on privacy warning**: D-04 says the warning is non-blocking. Users can still add manually.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL encoding of query params | Manual string concatenation | `urlencoding::encode()` (already imported) | Already used in existing `search_jira_users` |
| Base64 for Basic auth | Manual encoding | `base64::engine::general_purpose::STANDARD.encode()` (already in Cargo.toml) | Already used in `copy_ticket` command |
| State persistence | Custom SQLite calls | `invoke('set_fetch_config', { config })` via `persistFetchConfigWith` | Existing pattern, handles all fetch_config fields atomically |

---

## Jira API Reference

### Server v2 — existing (no change needed)

```
GET /rest/api/2/user/search?username=<query>
Auth: Bearer <PAT>
Returns: [{ name, displayName, emailAddress, active, avatarUrls }]
```

Domain search on Server v2: pass `query = "@domain.com"` as username — the API does substring match on username which includes email. This works because Server v2 `username` field contains the email or login which matches domain substring.

**Confidence:** MEDIUM — verified by existing mock server behavior and community reports; actual substring-match behavior on production Server may vary by Jira version.

### Cloud v3 — new command needed

```
GET /rest/api/3/user/search?query=<query>&maxResults=50
Auth: Basic base64(email:api_token)
Returns: [{ accountId, displayName, emailAddress?, active, avatarUrls }]
```

Domain search on Cloud v3: pass `query = "@domain.com"`. The `query` parameter searches across displayName, email, and username fields. When email visibility allows it, users matching the domain appear in results.

**Confidence:** MEDIUM — verified by Atlassian developer community and official docs structure; behavior with privacy restrictions documented below.

### Cloud v3 Email Privacy Behavior (the key blocker from STATE.md)

**Validated findings** (MEDIUM confidence — multiple community sources + official profile visibility docs):

1. **`emailAddress` is absent (not null)** when a user's visibility is set to "Only you and admins". The field is simply not included in the JSON response object.

2. **Users still appear in search results** even when email is hidden — they are searchable by displayName and accountId. The search result will contain `accountId` and `displayName` but no `emailAddress`.

3. **Domain-based search degrades silently**: When searching `query=@acme.com`, users whose email matches but is hidden will NOT appear in results (the API cannot match on a field it won't return). Users whose email is visible WILL appear. This means the result count may be incomplete — the app cannot distinguish "no users at this domain" from "users exist but are hidden."

4. **No admin override**: Even PAT tokens for site admins cannot bypass user-level email visibility settings via the standard REST API.

5. **Detection heuristic for D-04**: Show the privacy warning when:
   - Active connection is Cloud (`cloudConnection !== null`) AND
   - Search returned 0 results, OR
   - Search returned results but none have `emailAddress` field present

6. **Alternative signal**: If results are returned but `emailAddress` is absent on all of them, that also signals the privacy setting is active — show warning even with results. This aligns with UI-SPEC trigger: "when Jira Cloud connection is active AND search returns zero results (or when all returned users have masked email fields)."

**Sources:** Atlassian profile visibility docs, community threads (JRACLOUD-80288), developer community discussions.

---

## Common Pitfalls

### Pitfall 1: Server vs Cloud command confusion

**What goes wrong:** Calling `search_jira_users` (Server Bearer PAT) against a Cloud endpoint — the auth header format differs. Cloud uses `Basic base64(email:apitoken)`, not `Bearer <PAT>`.

**Why it happens:** The codebase already has this split (`get_server_pat` vs `get_cloud_credentials`) but `search_jira_users` only uses the Server path.

**How to avoid:** New `search_jira_users_by_domain` command must call `get_cloud_credentials(triage_db.inner())` and construct `Basic` auth header — same pattern as `copy_ticket` lines 1130-1133.

**Warning signs:** 401 responses against Cloud endpoint when testing.

### Pitfall 2: `name` vs `accountId` in watchedUsers

**What goes wrong:** Cloud v3 returns `accountId` (e.g. `"5b10a2844c20165700ede21g"`) where Server v2 returns `name` (e.g. `"jdoe"`). If the frontend naively uses `user.name` for Cloud users, it stores `undefined`.

**Why it happens:** `JiraUser` interface has both fields optional; the existing `handleAddUser(user.name)` pattern only works for Server.

**How to avoid:** In the domain search results handler, use `user.accountId ?? user.name` as the identifier to store. Verify the `JiraUser` interface already has both optional fields (confirmed: `types.ts` lines 12-13).

**Warning signs:** Empty strings or `undefined` appearing in the watched users list after bulk add.

### Pitfall 3: JQL compatibility of accountId in watched_users

**What goes wrong:** `build_poll_jql` in `poll_engine.rs` creates `assignee in ("jdoe", "5b10a2844c20165700ede21g")` — mixing Server names and Cloud accountIds. For Cloud-side polling this is fine (Cloud JQL accepts accountId). For Server-side queries this is irrelevant (different system).

**Why it happens:** The `watched_users` array is shared across both connection types. Server search stores `name`, Cloud domain search would store `accountId`.

**How to avoid:** This is the current design and is acceptable — the poll engine queries Server using these values only in `all_watched` preset, which involves Server JQL. Cloud accountIds in the array won't appear in Server JQL queries unless the user switched to `all_watched` preset while only having Cloud users. This edge case is low risk and the existing architecture does not distinguish.

**Warning signs:** JQL syntax errors in poll engine logs.

### Pitfall 4: Privacy warning trigger false positive on Server

**What goes wrong:** Showing the amber privacy warning when the server connection is active (not Cloud), where email privacy is not a relevant concept.

**Why it happens:** The check for "zero results = privacy issue" is only valid for Cloud.

**How to avoid:** Gate the privacy warning behind `cloudConnection !== null`. Server domain search returning zero results should show the generic empty state (UI-SPEC §4), not the privacy warning.

### Pitfall 5: Mock server v3 has no user search endpoint

**What goes wrong:** Integration tests that call the new `search_jira_users_by_domain` command against the mock Cloud server (port 8081) will get a 404.

**Why it happens:** `build_v3_router` in `mock_server.rs` does not include `/rest/api/3/user/search` — it was never needed before.

**How to avoid:** Add `/rest/api/3/user/search` to `build_v3_router` alongside the existing `search_users` handler (or a new v3 variant). The v3 mock handler should: accept `query` param, return users matching by email domain substring, include `accountId` instead of `name`, support a privacy-simulation mode (e.g., omit `emailAddress` based on a query param flag for testing).

### Pitfall 6: clippy `too_many_lines` on SettingsPage component

**What goes wrong:** Adding the domain search sub-section inline in the `case 'watched-users':` block may push the component over clippy limits (if the Rust `commands.rs` pattern applies to frontend — it doesn't, but worth noting the complexity).

**Why it happens:** SettingsPage is already large (~800 lines). Adding ~100 lines of domain search UI inline pushes it further.

**How to avoid:** Extract the domain search sub-section into a `DomainUserSearch` component within the same file or a new `DomainUserSearch.tsx`. This keeps the `case` block readable. Not a hard requirement but good practice.

---

## Code Examples

### New Rust Command (Cloud v3 domain search)

```rust
// Source: pattern derived from existing copy_ticket (commands.rs ~1130) + search_jira_users (~1005)
#[tauri::command]
pub async fn search_jira_users_by_domain(
    domain: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let (base_url, cloud_email, api_token) = get_cloud_credentials(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);

    // Normalize domain: strip leading @ if present
    let clean_domain = domain.trim_start_matches('@');
    let query = format!("@{clean_domain}");
    let encoded_query = urlencoding::encode(&query);
    let url = format!("{base_url}/rest/api/3/user/search?query={encoded_query}&maxResults=50");

    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{api_token}"))
    );

    let resp = client
        .get(&url)
        .header("Authorization", cloud_auth)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to search users by domain".into()))?;

    if !resp.status().is_success() {
        return Ok(vec![]);
    }

    let users: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
    Ok(users)
}
```

### Frontend: Privacy Detection

```typescript
// After domain search returns results:
const hasPrivacyIssue = (users: JiraUser[], cloudConn: ConnectionMeta | null): boolean => {
  if (!cloudConn) return false;
  // Zero results on Cloud = possible privacy issue
  if (users.length === 0) return true;
  // All returned users have no emailAddress = privacy active
  return users.every((u) => !u.emailAddress);
};
```

### Frontend: Bulk Add Handler

```typescript
function handleAddDomainResults(selected: JiraUser[]) {
  const current = safeWatchedUsers;
  const newIds = selected
    .map((u) => u.accountId ?? u.name)
    .filter((id): id is string => !!id && !current.includes(id));
  const updated = [...current, ...newIds];
  useTicketStore.getState().setWatchedUsers(updated);
  persistFetchConfigWith(updated);
  setDomainResults([]);
  setDomainQuery('');
  setSelectedAccountIds(new Set());
}
```

### Mock Server v3 Handler (to add)

```rust
// Source: pattern from v2::search_users (mock_server.rs lines 245-265)
// Add to build_v3_router: .route("/rest/api/3/user/search", get(v3::search_users))

pub async fn search_users(Query(params): Query<UserSearchQuery>) -> impl IntoResponse {
    // UserSearchQuery needs `query: Option<String>` field for v3
    let mock_users = vec![
        json!({
            "accountId": "5b10ac8d82e05b22cc7d4ef5",
            "displayName": "Jane Doe",
            "emailAddress": "jdoe@example.com",  // present = email visible
            "active": true,
            "avatarUrls": { "48x48": "https://avatar.example.com/jdoe/48x48.png" }
        }),
        // Add a user WITHOUT emailAddress to simulate privacy scenario
    ];
    // Filter by query (substring of emailAddress or displayName)
    // ...
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jira Server v2 `?username=` param | Jira Cloud v3 `?query=` param | Jira Cloud migration | `username` deprecated in Cloud; `query` used instead |
| Email addresses always present in API responses | Email may be absent when user sets visibility | GDPR/privacy changes ~2021 | Must handle absent `emailAddress` field without error |

**Deprecated/outdated:**
- `?username=` query param in Cloud v3: Deprecated due to GDPR privacy changes. Use `?query=` instead. Server v2 still uses `?username=`.

---

## Open Questions

1. **Does `query=@domain.com` actually return domain-filtered results on Jira Server v2?**
   - What we know: Server v2 `?username=` does substring match; `@domain.com` should match usernames that include the email. Community confirms partial-email search works.
   - What's unclear: Whether Server v2 usernames are email addresses or short names (org-dependent). In many on-prem Jira Server installations usernames are short names (`jdoe`) not emails.
   - Recommendation: For Server connections, the domain search will only work if Server usernames ARE email addresses. The planner should treat Server domain search as best-effort and show the same empty state (not privacy warning) if zero results are returned. Consider whether to even expose domain search for Server connections, or Cloud-only.

2. **`maxResults` pagination — how many users can a domain have?**
   - What we know: The endpoint default is 50, max is typically 200. No pagination is implemented in `search_jira_users`.
   - What's unclear: Organizations with 200+ users at a single domain will get truncated results.
   - Recommendation: Use `maxResults=50` (same as existing) and add a note in the results header ("showing up to 50 results") if the returned count hits the limit. Full pagination is out of scope for this phase.

3. **Should domain search trigger for Server connections at all?**
   - What we know: The existing `search_jira_users` uses Server connection (`serverConn`). Domain search was motivated by Cloud email privacy concern.
   - What's unclear: User expectation — do they want domain search against Server too?
   - Recommendation: The UI-SPEC and CONTEXT.md do not restrict domain search to Cloud-only. Implement for both, but route to different Tauri commands. The privacy warning is Cloud-only.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all tools already in project: Rust/Cargo, Node/npm, Tauri).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + Rust `cargo test` (backend) |
| Config file | `vite.config.ts` (Vitest config embedded) |
| Quick run command | `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx` |
| Full suite command | `npm run test -- --run` (frontend) + `cargo test` (Rust) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WTCH-01 | Domain input renders in Watched Users section | unit | `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx` | ✅ (extend existing) |
| WTCH-01 | Invalid domain format shows inline error | unit | same file | ✅ (extend existing) |
| WTCH-01 | Valid domain triggers search command | unit | same file | ✅ (extend existing) |
| WTCH-02 | Results list renders with user rows + checkboxes | unit | same file | ✅ (extend existing) |
| WTCH-02 | "Add selected" merges into watchedUsers + deduplicates | unit | same file | ✅ (extend existing) |
| WTCH-02 | Privacy warning shows on Cloud + 0 results | unit | same file | ✅ (extend existing) |
| WTCH-02 | Mock v3 user search endpoint returns domain-filtered users | integration | `cargo test test_mock_v3_user_search` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx`
- **Per wave merge:** `npm run test -- --run` + `cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src-tauri/tests/mock_server.rs` — add `test_mock_v3_user_search_returns_domain_users` test (covers WTCH-02 mock)
- [ ] `src-tauri/src/mock_server.rs` — add `/rest/api/3/user/search` route to `build_v3_router` with domain-filter handler (covers mock test)

*(All frontend tests extend the existing `SettingsPage.test.tsx` — no new test file needed.)*

---

## Sources

### Primary (HIGH confidence)

- `src-tauri/src/commands.rs` lines 1003-1034 — existing `search_jira_users` implementation, exact auth pattern, URL format, return type
- `src/features/connections/SettingsPage.tsx` lines 200-386, 651-754 — JiraUser interface, watched users state management, invoke patterns, persist helpers, UI structure
- `src/features/tickets/ticketStore.ts` — `watchedUsers`, `setWatchedUsers`, `hydrateFetchConfig`
- `src-tauri/src/triage_db.rs` lines 7-14, 63-68, 150-177 — `FetchConfig` struct, `watched_users` SQLite schema, get/set implementation
- `src-tauri/src/mock_server.rs` lines 245-265, 719-743, 745-777 — existing `search_users` v2 handler, router construction, v3 router (no user search yet)
- `src-tauri/src/poll_engine.rs` lines 266-284 — `build_poll_jql` uses `watched_users` as quoted strings in `assignee in (...)` JQL
- `src/features/tickets/types.ts` lines 11-16 — `JiraUser` interface (both `name` and `accountId` optional)
- `.planning/phases/16-enhanced-watch-configuration/16-UI-SPEC.md` — complete visual/interaction contract

### Secondary (MEDIUM confidence)

- Atlassian profile visibility docs (`developer.atlassian.com/cloud/jira/platform/profile-visibility/`) — `emailAddress` absent (not null) when hidden; no admin override
- Atlassian Community forum (JRACLOUD-80288, `Not-getting-user-s-emailAddress`) — emailAddress intentionally omitted for GDPR; "if user have set visibility...to 'Anyone' then response contain emailAddress"
- Atlassian Community (`How-to-do-user-search-with-v3-REST-API`) — `query` parameter accepts partial email/domain; deprecated `username` param in Cloud
- Atlassian Support KB (`resolving-email-visibility-issues`) — confirms fields that are hidden are not included in returned user object

### Tertiary (LOW confidence)

- Server v2 domain search via `?username=@domain.com`: community reports partial match works; not officially documented for domain suffix search specifically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing libraries, no new dependencies beyond optional shadcn components
- Architecture (Rust command): HIGH — clear precedent in `search_jira_users` and `copy_ticket` patterns
- Architecture (Frontend): HIGH — clear precedent in existing watched users section
- Jira Cloud v3 API behavior: MEDIUM — endpoint documented, but `query=@domain.com` domain-filter behavior not officially spec'd
- Email privacy behavior: MEDIUM — multiple sources confirm mechanism; exact trigger condition (0 results vs absent field) validated by community

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable Atlassian API surface, but privacy policy details can change)
