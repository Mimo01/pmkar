---
phase: 17-field-discovery-mock-schema-fidelity
verified: 2026-04-27T15:35:00Z
status: human_needed
score: 8/8
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Visual banner — launch app with a Cloud target configured behind a proxy/firewall that blocks paginated createmeta. Confirm red banner appears at top of main shell showing endpoint URL, HTTP status code, and hint text."
    expected: "Banner renders with role=alert, shows 'Required-field detection unavailable on Cloud target', endpoint URL, HTTP status code, and proxy hint. X button dismisses it for the session."
    why_human: "Banner renders conditionally on live probe result against a real or simulated proxy. Cannot verify visual rendering or dismiss UX programmatically."
  - test: "Visual pill — same failing-probe scenario. Open Settings page and confirm the Cloud ConnectionCard shows a red 'Discovery unavailable' pill."
    expected: "Red pill with data-testid='probe-status-pill' is visible on the Cloud row only; Server row has no pill."
    why_human: "Requires visual inspection of a live app state."
  - test: "Banner per-session dismissal — confirm banner disappears after clicking X and does not reappear on the same session, but returns after app restart."
    expected: "probeBannerDismissed resets to false on app restart (Zustand not persisted); dismissed state is not written to SQLite."
    why_human: "Requires app restart cycle to confirm the non-persistence contract."
---

# Phase 17: Field Discovery + Mock Schema Fidelity — Verification Report

**Phase Goal:** Enable Jira field schema discovery so the app can learn what fields exist on source and target Jira instances, cache them in mapping.db (SQLite), and surface a clear error banner when the Cloud target's paginated createmeta endpoint is unreachable (proxy/firewall scenario).

**Verified:** 2026-04-27T15:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DISC-01: Source v2 field schemas discoverable + cached in mapping.db | VERIFIED | `discover_v2_fields` implemented in `field_discovery.rs` (lines 194–218); `get_or_fetch_source_global` persists to `FieldMappingDb`; integration test `discover_v2_fields_returns_global_list` passes (≥14 fields including `summary` + `customfield_10001`); unit test `null_project_and_issuetype_round_trip_for_source_global` confirms SQLite persistence. |
| 2 | DISC-02: Target v3 field schemas discoverable + cached | VERIFIED | `discover_v3_fields` + `fetch_all_createmeta_fields` implemented; `get_or_fetch_target_schema` persists to `FieldMappingDb`; integration test `discover_v3_fields_returns_custom_fields` passes (all 6 custom fields present); `cache_hit_returns_without_http` confirms cache read path. |
| 3 | DISC-03: Paginated createmeta correctly drained across multiple pages | VERIFIED | `fetch_all_createmeta_fields` uses three stop conditions (empty page, declared total reached, MAX_CREATEMETA_PAGES guard); integration test `fetch_all_createmeta_drains_two_pages` passes — 7 fields across 2 pages; `test_bug_createmeta_paginates_two_pages` (createmeta_pagination.rs) confirms mock pagination correctness (page1=5, page2=2, total=7). |
| 4 | DISC-04: Connection-time probe verifies createmeta reachability; failure surfaces in banner + pill | VERIFIED (automated); HUMAN_NEEDED (visual) | `probe_paginated_createmeta` in `field_discovery.rs` returns `ProbeResult`; `probe_createmeta` Tauri command registered in `main.rs`; `connectionStore.ts` `runProbe()` maps result to `probeStatus`; `ProbeStatusBanner.tsx` renders on `probeStatus === 'failed'`; `ConnectionCard.tsx` shows pill on cloud row when `probeStatus === 'failed'`; `App.tsx` fires `runProbe()` in `useEffect` on `hasSetup && targetProjectKey`; 3 probe integration tests pass; 5 ProbeStatusBanner RTL tests pass; 9 connectionStore.probe tests pass. Visual rendering requires human. |
| 5 | D-04: Schema hash computed over raw bytes for drift detection | VERIFIED | `fetch_all_createmeta_fields` accumulates raw response bytes in `sha2::Sha256` hasher (line 346: `Digest::update(&mut hasher, &bytes)`) before deserialization; `compute_schema_hash` in `field_mapping_db.rs` hashes raw bytes; `schema_hash_is_lowercase_hex_64` and `schema_hash_is_deterministic_and_input_sensitive` tests pass; `fetch_all_createmeta_hash_is_deterministic` integration test passes. |
| 6 | D-05: Banner per-session dismissable (not persisted) | VERIFIED (code); HUMAN_NEEDED (restart) | `probeBannerDismissed` is plain Zustand state — no persist middleware, no SQLite write; `dismissProbeBanner: () => set({ probeBannerDismissed: true })`; `clearConnections()` resets it to `false`; test `hides banner once dismissed` and `clicking dismiss button calls dismissProbeBanner` both pass. Restart-cycle non-persistence requires human. |
| 7 | D-07: Error message includes endpoint URL + HTTP status code + hint | VERIFIED | `ProbeStatusBanner.tsx` renders `probeEndpointUrl` as `Endpoint: {url}`, `probeStatusCode` as `HTTP {code}`, and `probeError` (hint) as third segment joined by ` — `; ProbeResult serializes all three fields (camelCase verified by `probe_result_serializes_without_credentials` test); banner RTL test confirms all three fields present in textContent. |
| 8 | D-08: Failure surfaces in two places (banner + status pill on Cloud row) | VERIFIED (automated); HUMAN_NEEDED (visual) | Banner: `ProbeStatusBanner` with `data-testid="probe-status-banner"` rendered in main shell; Pill: `ConnectionCard` cloud row with `data-testid="probe-status-pill"` when `probeStatus === 'failed'`; SettingsPage passes `connectionType="cloud"` (line 659, 679); RTL tests cover both. Visual layout requires human. |

**Score:** 8/8 truths verified (3 require additional human confirmation for visual aspects)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/field_discovery.rs` | Types + HTTP functions + ProbeResult | VERIFIED | 768 lines; `FieldSchemaType` serde enum, `FieldSchema`, `ProbeResult`, `discover_v2_fields`, `discover_v3_fields`, `fetch_all_createmeta_fields`, `fetch_target_issue_types`, `probe_paginated_createmeta`, `get_or_fetch_target_schema`, `get_or_fetch_source_global` — all present and substantive |
| `src-tauri/src/field_mapping_db.rs` | FieldMappingDb + compute_schema_hash | VERIFIED | 352 lines; `FieldMappingDb::open`, `open_in_memory`, `upsert_schema_row`, `get_cached_schemas`, `get_cached_schema_hash`, `clear_cache_for`, `compute_schema_hash` — all present; CREATE TABLE statement with UNIQUE constraint + index |
| `src-tauri/src/commands.rs` | 5 Tauri commands registered | VERIFIED | All 5 commands (`discover_source_fields`, `get_target_field_schema_for_issuetype`, `probe_createmeta`, `pre_warm_target_issue_types`, `refresh_field_schema_cache`) present at lines 1157–1322, registered in `main.rs` invoke_handler at lines 238–242 |
| `src-tauri/src/main.rs` | mapping.db opened + commands registered | VERIFIED | `mapping_db_path = app_dir.join("mapping.db")` at line 140; `FieldMappingDb::open(&mapping_db_path)` at line 142; managed via `app.manage(Arc::new(Mutex::new(mapping_db)))` at line 143; all 5 commands in `generate_handler!` |
| `src-tauri/tests/field_discovery_integration.rs` | 7 integration tests | VERIFIED | 7 tests: `discover_v3_fields_returns_custom_fields`, `discover_v2_fields_returns_global_list`, `fetch_all_createmeta_drains_two_pages`, `fetch_all_createmeta_hash_is_deterministic`, `fetch_target_issue_types_returns_three`, `cache_hit_returns_without_http`, `get_or_fetch_source_global_cache_miss_hits_http` — all passing |
| `src-tauri/tests/probe_createmeta.rs` | 3 probe tests | VERIFIED | 3 tests: `probe_succeeds_against_known_project`, `probe_fails_with_endpoint_and_status_in_message`, `probe_redacts_credentials` — all passing |
| `src/types/fieldSchema.ts` | FieldSchemaType discriminated union | VERIFIED | 186 lines; full discriminated union with 11 variants matching Rust serde output; `parseFieldSchemas` runtime parser; type guards for option/cascading/array/user/priority/custom/unsupported |
| `src/stores/schemaCacheStore.ts` | Zustand schema cache store | VERIFIED | 91 lines; `loadSchema`, `preWarm`, `refresh`, `clearCache` actions; invokes `discover_source_fields`, `get_target_field_schema_for_issuetype`, `pre_warm_target_issue_types`; `schemaCacheKey` with NULL sentinel |
| `src/features/connections/connectionStore.ts` | Probe state + actions | VERIFIED | 5 probe state fields (`probeStatus`, `probeError`, `probeEndpointUrl`, `probeStatusCode`, `probeBannerDismissed`); 3 probe actions (`runProbe`, `dismissProbeBanner`, `prewarmIssueTypes`); `clearConnections` resets all probe fields |
| `src/features/connections/ProbeStatusBanner.tsx` | Dismissable red banner | VERIFIED | 43 lines; renders null unless `probeStatus === 'failed' && !probeBannerDismissed`; shows endpoint URL + HTTP status code + hint; `role="alert"`, `data-testid="probe-status-banner"`, X button with `data-testid="probe-status-banner-dismiss"` |
| `src/features/connections/ConnectionCard.tsx` | Red status pill on cloud row | VERIFIED | Optional `connectionType?: ConnectionType` prop; pill at lines 42–49 gated on `isCloudCard && probeStatus === 'failed'`; `data-testid="probe-status-pill"` |
| `src/App.tsx` | runProbe wired into launch flow | VERIFIED | `runProbe` selector at line 40; `useEffect` at lines 90–94 fires `runProbe()` when `hasSetup && targetProjectKey`; `<ProbeStatusBanner />` rendered at line 208 in main shell only |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `App.tsx` useEffect | `connectionStore.runProbe()` | `useEffect([hasSetup, targetProjectKey, runProbe])` | WIRED | Line 91: `if (hasSetup && targetProjectKey) { void runProbe(); }` |
| `App.tsx` main shell | `ProbeStatusBanner` | JSX render at line 208 | WIRED | `<ProbeStatusBanner />` inside main AppShell children block |
| `connectionStore.runProbe()` | `probe_createmeta` Tauri command | `invoke<ProbeResult>('probe_createmeta')` | WIRED | Line 120 of `connectionStore.ts` |
| `probe_createmeta` command | `field_discovery::probe_paginated_createmeta` | `field_discovery::probe_paginated_createmeta(...)` | WIRED | `commands.rs` line 1255 |
| `SettingsPage.tsx` | `ConnectionCard` with cloud type | `connectionType="cloud"` prop at lines 659, 679 | WIRED | Both cloud ConnectionCard usages pass explicit prop |
| `ConnectionCard` | `probeStatus` pill | `useConnectionStore((s) => s.probeStatus)` + `isCloudCard && probeStatus === 'failed'` | WIRED | Lines 32–49 of `ConnectionCard.tsx` |
| `schemaCacheStore.preWarm()` | `pre_warm_target_issue_types` Tauri command | `invoke<IssueTypeRef[]>('pre_warm_target_issue_types', { projectKey })` | WIRED | `schemaCacheStore.ts` line 63 |
| `mapping.db` (SQLite) | `field_schema_cache` table | `FieldMappingDb::open(&mapping_db_path)` in `main.rs` | WIRED | `mapping_db_path = app_dir.join("mapping.db")` line 140; table created on open |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProbeStatusBanner.tsx` | `probeStatus`, `probeEndpointUrl`, `probeStatusCode`, `probeError` | `useConnectionStore` ← `runProbe()` ← `invoke('probe_createmeta')` ← Rust `probe_paginated_createmeta` | Yes — real HTTP response from Jira Cloud | FLOWING |
| `ConnectionCard.tsx` pill | `probeStatus` | `useConnectionStore` shared state | Yes — same flow as above | FLOWING |
| `schemaCacheStore.cache` | `fields: FieldSchema[]` | `invoke('discover_source_fields')` → `field_discovery::get_or_fetch_source_global` → `/rest/api/2/field` | Yes — real HTTP + SQLite cache | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| `cargo build` compiles cleanly | `Finished dev profile [unoptimized + debuginfo] target(s) in 8.30s` | PASS |
| `cargo test --features mock-server` — all Rust tests | 128 tests across 10 test binaries: 0 failed | PASS |
| `cargo clippy --features mock-server -- -D warnings` | `Finished dev profile` — no warnings | PASS |
| `npx vitest run --no-coverage` — all TS tests | 573 tests across 50 files: 0 failed | PASS |
| `probe_createmeta` integration: ok=true against mock v3 | `probe_succeeds_against_known_project`: ok=true, status_code=200 | PASS |
| `probe_createmeta` integration: graceful failure on closed port | `probe_fails_with_endpoint_and_status_in_message`: ok=false, no Err | PASS |
| Credential redaction: no auth value in ProbeResult | `probe_redacts_credentials`: serialized JSON has no secret | PASS |
| Hash determinism across calls | `fetch_all_createmeta_hash_is_deterministic`: hash1 == hash2 | PASS |
| Two-page pagination drain | `fetch_all_createmeta_drains_two_pages`: 7 fields, hash 64-char hex | PASS |
| `npx tsc --noEmit` | Not executable — permission denied | SKIP (needs user to run) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DISC-01 | 17-04 | Source v2 field schemas discoverable + cached | SATISFIED | `discover_v2_fields` + `get_or_fetch_source_global` + integration test |
| DISC-02 | 17-04 | Target v3 field schemas discoverable + cached | SATISFIED | `discover_v3_fields` + `fetch_all_createmeta_fields` + `get_or_fetch_target_schema` |
| DISC-03 | 17-04 | Paginated createmeta correctly drained | SATISFIED | Three stop conditions + MAX guard + passing integration + pagination tests |
| DISC-04 | 17-05 | Connection-time probe + failure surfaces in banner + pill | SATISFIED (code) / NEEDS HUMAN (visual) | Full chain wired; RTL tests pass; visual rendering requires human |
| D-04 | 17-02 | Schema hash over raw bytes | SATISFIED | Raw `bytes` fed to `sha2::Sha256` before deserialization; hash tests pass |
| D-05 | 17-05 | Banner per-session dismissable (not persisted) | SATISFIED (code) / NEEDS HUMAN (restart) | Pure Zustand state; no persist; clearConnections resets it |
| D-07 | 17-05 | Error message includes endpoint URL + HTTP status code + hint | SATISFIED | Banner joins all three fields; test confirms textContent contains all three |
| D-08 | 17-05 | Failure surfaces in two places (banner + pill) | SATISFIED (code) / NEEDS HUMAN (visual) | Both `data-testid` targets exist; RTL tests cover both paths |

---

### Anti-Patterns Found

None. Scan of all Phase 17 Rust and TypeScript files found:
- No TODO/FIXME/placeholder comments in deliverable source files
- No stub `return null` / `return []` patterns in rendering paths
- No hardcoded empty data flowing to rendering (all empty states gated on real async results)
- All 5 Tauri commands call real `field_discovery::*` functions, not stubs
- `probeBannerDismissed: false` is an initial state value that gets correctly populated by `dismissProbeBanner()`, not a permanent stub

---

### Human Verification Required

#### 1. Visual probe failure banner

**Test:** Configure the app with a Cloud connection behind a proxy that blocks `/rest/api/3/issue/createmeta/{key}/issuetypes`. Launch the app with a target project key set. Wait for `runProbe()` to complete.
**Expected:** A red alert banner appears at the top of the main shell (outside Settings/Audit branches) showing "Required-field detection unavailable on Cloud target." with a detail line containing the endpoint URL, "HTTP {code}", and the proxy hint. An X button is visible.
**Why human:** Requires a live proxy/firewall scenario or mock network failure. Cannot simulate Tauri IPC + real network conditions in Vitest.

#### 2. Visual status pill on Cloud row

**Test:** Same failing-probe state as above. Navigate to Settings (gear icon).
**Expected:** The Cloud target ConnectionCard shows a small red "Discovery unavailable" pill next to the connection name label. The Server source ConnectionCard shows no such pill.
**Why human:** Requires visual inspection of the rendered Settings page with active Zustand probe state.

#### 3. Per-session banner dismissal + restart reset

**Test:** With banner visible, click the X button. Confirm banner disappears. Then restart the app (quit + reopen).
**Expected:** After dismiss: banner gone for the session. After restart: if probe still fails, banner reappears (probeBannerDismissed was not persisted).
**Why human:** Requires app restart cycle to confirm the non-persistence contract of pure Zustand state vs. SQLite-persisted state.

---

### Gaps Summary

No blocking gaps. All 8 must-have success criteria are verifiable in code and pass all automated tests:

- `cargo build`: clean
- `cargo test --features mock-server`: 128 tests, 0 failures
- `cargo clippy -- -D warnings`: 0 warnings
- `npx vitest run`: 573 tests across 50 files, 0 failures

The only open items are the 3 human verification tests above, which concern visual rendering and a restart cycle. These are expected for a phase that adds UI components — they cannot be verified programmatically.

`npx tsc --noEmit` was blocked by shell permission. This should be run manually; no TypeScript type errors are expected given the clean Vitest run (Vitest does not transpile but the types are in the same tsconfig scope).

---

_Verified: 2026-04-27T15:35:00Z_
_Verifier: Claude (gsd-verifier)_
