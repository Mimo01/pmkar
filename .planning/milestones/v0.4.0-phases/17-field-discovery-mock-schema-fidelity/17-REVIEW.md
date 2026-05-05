---
phase: 17-field-discovery-mock-schema-fidelity
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/types/fieldSchema.ts
  - src/types/fieldSchema.test.ts
  - src/stores/schemaCacheStore.ts
  - src/stores/schemaCacheStore.test.ts
  - src-tauri/src/field_discovery.rs
  - src-tauri/tests/field_discovery_integration.rs
  - src-tauri/tests/probe_createmeta.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/main.rs
  - src/features/connections/__tests__/connectionStore.probe.test.ts
  - src/features/connections/__tests__/ProbeStatusBanner.test.tsx
  - src/features/connections/ProbeStatusBanner.tsx
  - src/features/connections/connectionStore.ts
  - src/features/connections/ConnectionCard.tsx
  - src/features/connections/SettingsPage.tsx
  - src/App.tsx
findings:
  critical: 0
  warning: 8
  info: 0
  total: 8
status: fixed
---

# Phase 17: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 17 delivers field discovery (Rust HTTP fetchers, Tauri commands, TypeScript schema types, Zustand cache store, and the probe UI). The TypeScript types and runtime parser are well-structured, the serde contract between Rust and TS is consistent, and the credential-safety invariant is correctly enforced at all layers. The `ProbeResult` redaction tests are sound. Integration tests cover the happy path thoroughly.

Eight issues were found, all warnings. The most impactful one is a pagination offset bug in `fetch_all_createmeta_fields` that can silently drop fields when the server returns a short page. Two further structural issues affect cache correctness and audit coverage.

---

## Warnings

### WR-01: Pagination offset advances by `max(page_len, max_results)` — skips fields on short pages

**File:** `src-tauri/src/field_discovery.rs:368`

**Issue:** When a page is shorter than `max_results` (e.g. the final page returns 3 of 50 declared max), `start_at` is advanced by `page_len.max(declared_max_results)` = `declared_max_results` = 50, which jumps past the remaining items. For example with `total=53`, `page_len=50` on page 1 triggers `all_fields.len() >= declared_total` check: `50 >= 53` is false, so a second page is fetched at `startAt=50`. That returns 3 fields, `len >= 53` is true, and the loop exits — correct in this case. However the bug fires when `total` is a multiple of `max_results`: with `total=50`, `page_len=50`, the loop breaks at the first iteration (stop condition 2 fires). So this particular case is safe. The real failure mode is when `page_len < declared_max_results` due to a mid-stream pagination anomaly: if the server returns 40 items on a page where `max_results=50`, the next request would be at `startAt=50` (skipping items 40-49). The Atlassian API spec requires advancing by actual items received (`page_len`), not by `max_results`. The guard `page_len.max(declared_max_results)` can only be larger than `page_len`; it can never save a correct result, only introduce a gap.

**Fix:**
```rust
// line 368 — advance by actual page length, not max_results
start_at += page_len;
```
The `declared_max_results` variable is otherwise unused after line 351 and can be removed.

---

### WR-02: `fetch_target_issue_types` fetches only the first page — silently truncates large issue-type lists

**File:** `src-tauri/src/field_discovery.rs:389-416`

**Issue:** The function sends a single request with `startAt=0&maxResults=50`. If a Jira Cloud project has more than 50 issue types (uncommon but possible in heavily customised instances), the excess are silently dropped. The function is used for the pre-warm path (D-01/D-15) so the chooser would be missing issue types without any error.

**Fix:** Either paginate the same way `fetch_all_createmeta_fields` does, or add a defensive check after the first page and return an error if `body.total > body.issue_types.len()`:
```rust
let body: IssueTypesResponse = resp.json().await
    .map_err(|_| AppError::Http("issuetype list parse failed".into()))?;
if body.total > body.issue_types.len() as u64 {
    // Log a warning or paginate; for now guard against silent truncation
    return Err(AppError::Http(format!(
        "issuetype list truncated: server reports {} types, only {} returned",
        body.total, body.issue_types.len()
    )));
}
Ok(body.issue_types)
```

---

### WR-03: `discover_source_fields` and `get_target_field_schema_for_issuetype` bypass the audit client

**File:** `src-tauri/src/commands.rs:1199` and `src-tauri/src/commands.rs:1217`

**Issue:** Both field-discovery Tauri commands create a bare `reqwest::Client::new()` instead of calling `build_audited_client(arc_db)`. Every other HTTP command in `commands.rs` uses the audited client. This means field discovery HTTP calls are not logged in the audit trail, making it impossible for users or developers to diagnose fetch failures from the Audit Log page.

**Fix:**
```rust
// discover_source_fields (around line 1199)
let arc_db = Arc::clone(mapping_db.inner()); // or pass db state
// Note: commands.rs does not have mapping_db as AuditDb; the fix is to thread
// AuditDb state into these commands the same way it is in fetch_tickets.
// Alternatively, accept that field-discovery calls are non-audited and document it.

// Minimal fix: add db state parameter and use audited client
pub async fn discover_source_fields(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
    db: State<'_, Arc<Mutex<AuditDb>>>,  // add this
) -> Result<Vec<FieldSchema>, AppError> {
    let client = build_audited_client(Arc::clone(db.inner()));  // replace Client::new()
    // ...
}
```

---

### WR-04: `schemaCacheStore` — source-side cache key includes unused `projectKey`/`issuetypeId`

**File:** `src/stores/schemaCacheStore.ts:44-53`

**Issue:** `loadSchema('source', projectKey, issuetypeId)` builds a cache key from all three arguments (`side|projectKey|issuetypeId`), but then calls `discover_source_fields` with no arguments — the source schema is global and ignores project/issue type. As a result, calling `loadSchema('source', null, null)` and `loadSchema('source', 'PROJ', '10001')` produce two different cache keys that both invoke the same backend fetch, creating duplicate cache entries for identical data. The contract comment says `side='source'` means `project_key=NULL, issuetype_id=NULL`, but nothing enforces this in the store.

**Fix:** Normalise the cache key for source calls to always use `null`:
```typescript
loadSchema: async (side, projectKey, issuetypeId) => {
  // Source schema is global — project/issuetype are irrelevant
  const effectiveProjectKey = side === 'source' ? null : projectKey;
  const effectiveIssuetypeId = side === 'source' ? null : issuetypeId;
  const key = schemaCacheKey(side, effectiveProjectKey, effectiveIssuetypeId);
  // ...rest unchanged
```

---

### WR-05: `schemaCacheStore.refresh` leaves cache empty without reloading

**File:** `src/stores/schemaCacheStore.ts:85-95`

**Issue:** `refresh` deletes the cache entry (line 88-89) and then calls `refresh_field_schema_cache` on the Rust side (line 91). After this resolves, the cache entry is permanently absent — no reload is triggered. The comment "caller can re-trigger loadSchema regardless" treats this as the caller's responsibility, but callers (Phases 21+) may not know they must always call `loadSchema` after `refresh`. Any component that reads the cache between the `refresh` call and the subsequent `loadSchema` call will see `undefined`, which renders as a loading/empty state even though data existed before.

**Fix:** Either call `loadSchema` at the end of `refresh`, or document in the function's JSDoc that callers MUST call `loadSchema` immediately after:
```typescript
refresh: async (side, projectKey, issuetypeId) => {
  const key = schemaCacheKey(side, projectKey, issuetypeId);
  const next = { ...get().cache };
  delete next[key];
  set({ cache: next });
  try {
    await invoke('refresh_field_schema_cache', { side, projectKey, issuetypeId });
  } catch {
    // Non-fatal
  }
  // Reload immediately so cache is never transiently empty
  await get().loadSchema(side, projectKey, issuetypeId);
},
```

---

### WR-06: `search_jira_users_by_domain` silently returns partial results on HTTP error mid-pagination

**File:** `src-tauri/src/commands.rs:1154-1155`

**Issue:** Inside the pagination loop, a non-success HTTP response causes a `break` rather than an error return:
```rust
if !resp.status().is_success() {
    break;
}
```
This means that if the server returns a 429 or 500 on page 2, the function returns whatever page 1 contained — a partial user list — with no indication of failure. The UI shows these as the complete results, which can result in incorrect "no more users" conclusions and missed entries being added to watched users.

**Fix:** Return an error on non-success mid-pagination:
```rust
if !resp.status().is_success() {
    return Err(AppError::Http(format!(
        "User domain search returned status {} at startAt={start_at}",
        resp.status().as_u16()
    )));
}
```
Or at minimum break with a flag so the caller knows the result is partial.

---

### WR-07: `App.tsx` — probe not re-fired when cloud connection credentials change

**File:** `src/App.tsx:105-109`

**Issue:** The `useEffect` that calls `runProbe` depends on `[hasSetup, targetProjectKey, runProbe]`. When a user edits their cloud connection (new base URL or API token) through the Settings page, neither `hasSetup` nor `targetProjectKey` changes, so `runProbe` is not re-triggered. The probe banner could therefore show a stale "failed" or "ok" result against the old cloud endpoint while the user is now configured against a new one. This matters most when the user fixes a previously failing proxy configuration.

**Fix:** Track cloud connection identity in the effect dependencies. The simplest approach is to depend on `cloudConnection?.baseUrl`:
```typescript
const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl);
// ...
useEffect(() => {
  if (hasSetup && targetProjectKey) {
    void runProbe();
  }
}, [hasSetup, targetProjectKey, cloudBaseUrl, runProbe]);
```

---

### WR-08: `ProbeStatusBanner` — dynamic banner not announced to screen readers

**File:** `src/features/connections/ProbeStatusBanner.tsx:24-43`

**Issue:** The banner appears and disappears reactively based on `probeStatus`. While it carries `role="alert"` which should trigger announcement in some browsers, browser support for `role="alert"` on conditionally rendered elements is inconsistent. Elements that are initially absent from the DOM and then injected are not reliably announced. An `aria-live` region that is always present in the DOM and whose content changes is more robustly supported.

**Fix:** Render the container unconditionally and control visibility through content:
```tsx
// In parent (App.tsx), always mount a live region wrapper:
<div aria-live="assertive" aria-atomic="true">
  <ProbeStatusBanner />
</div>
```
Or mount a persistent live region in `AppShell` and have `ProbeStatusBanner` write into it via a portal pattern. The existing `role="alert"` provides some coverage but should not be relied upon alone.

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
