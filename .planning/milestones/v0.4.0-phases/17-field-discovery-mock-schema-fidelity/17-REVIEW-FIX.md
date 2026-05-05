---
phase: 17-field-discovery-mock-schema-fidelity
fixed_at: 2026-05-04T23:14:00Z
review_path: .planning/milestones/v0.4.0-phases/17-field-discovery-mock-schema-fidelity/17-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-05-04T23:14:00Z
**Source review:** `.planning/milestones/v0.4.0-phases/17-field-discovery-mock-schema-fidelity/17-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### WR-01: Pagination offset advances by `max(page_len, max_results)` instead of `page_len`

**Files modified:** `src-tauri/src/field_discovery.rs`
**Commit:** `30d848f`
**Applied fix:** Removed the `declared_max_results` variable (was `page.max_results.max(1)`) and changed `start_at += page_len.max(declared_max_results)` to `start_at += page_len`. Added a comment explaining why advancing by actual page length is required per the Atlassian API spec.

---

### WR-02: `fetch_target_issue_types` fetches only the first page

**Files modified:** `src-tauri/src/field_discovery.rs`
**Commit:** `79945ac`
**Applied fix:** Added a truncation guard after deserializing `IssueTypesResponse`: if `body.total > body.issue_types.len()` the function returns an explicit `AppError::Http` rather than silently returning an incomplete list. The `IssueTypesResponse` struct already had a `total: u64` field so no struct changes were needed.

---

### WR-03: `discover_source_fields` and `get_target_field_schema_for_issuetype` bypass audit client

**Files modified:** `src-tauri/src/commands.rs`
**Commit:** `31d7500`
**Applied fix:** Added `# Audit note` doc comment to both commands explaining that they use a bare `reqwest::Client` (not `build_audited_client`) and including a `TODO` to thread `AuditDb` state in a future pass (same pattern as `fetch_tickets`). Threading `AuditDb` into these commands would require significant signature changes that would ripple into the Tauri command registration — the doc comment approach was applied as specified in the review fix guidance.

---

### WR-04: `schemaCacheStore` source-side cache key includes unused `projectKey`/`issuetypeId`

**Files modified:** `src/stores/schemaCacheStore.ts`
**Commit:** `0360f4d`
**Applied fix:** Added `effectiveProjectKey` and `effectiveIssuetypeId` derivations at the top of `loadSchema` that force both to `null` when `side === 'source'`. Both the cache key and the `get_target_field_schema_for_issuetype` invoke call now use these normalised values, ensuring all source-side calls share a single cache entry regardless of what project/issuetype the caller passed.

---

### WR-05: `schemaCacheStore.refresh` leaves cache empty without reloading

**Files modified:** `src/stores/schemaCacheStore.ts`, `src/stores/schemaCacheStore.test.ts`
**Commit:** `258b076`
**Applied fix:** Added `await get().loadSchema(side, projectKey, issuetypeId)` at the end of `refresh` (after the `invoke` try/catch), so the cache is repopulated immediately rather than left transiently empty. Updated the existing test that asserted the cache entry was `undefined` after refresh — the test now supplies a second `invokeMock` for the reload call and asserts the entry is present with `status: 'success'`.

---

### WR-06: `search_jira_users_by_domain` silently returns partial results on HTTP error

**Files modified:** `src-tauri/src/commands.rs`
**Commit:** `a17d9cd`
**Applied fix:** Changed the `break` on non-success response to `return Err(AppError::Http(format!(...)))` with the status code and current `start_at` position. Also changed `resp.json().await.unwrap_or_default()` to a proper `map_err` that returns a meaningful error if JSON parsing fails.

---

### WR-07: App.tsx probe not re-fired when cloud connection credentials change

**Files modified:** `src/App.tsx`
**Commit:** `1695fc7`
**Applied fix:** Added `const cloudBaseUrl = useConnectionStore((s) => s.cloudConnection?.baseUrl)` selector and added `cloudBaseUrl` to the probe `useEffect` dependency array. Added a `biome-ignore lint/correctness/useExhaustiveDependencies` comment with explanation because Biome's hook-deps rule flags `cloudBaseUrl` as unnecessary (it is not referenced inside the effect body — it is used only as a trigger dependency, while `runProbe()` reads the current connection from the Zustand store internally).

---

### WR-08: ProbeStatusBanner not announced to screen readers

**Files modified:** `src/features/connections/ProbeStatusBanner.tsx`
**Commit:** `910a6bd`
**Applied fix:** Added `aria-live="assertive"` and `aria-atomic="true"` attributes directly to the banner's outer `<div>` element alongside the existing `role="alert"`. This improves screen reader coverage for dynamically injected content without requiring a portal pattern or parent component changes.

---

_Fixed: 2026-05-04T23:14:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
