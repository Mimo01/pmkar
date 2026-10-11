---
phase: 25-preview-time-resolution
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src-tauri/src/commands.rs
  - src-tauri/src/field_transform/user.rs
  - src-tauri/src/main.rs
  - src-tauri/tests/resolve_users_preview_integration.rs
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
  - src/features/tickets/__tests__/copyStore.test.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-05-05
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 25 adds preview-time resolution of `wiki_to_adf` descriptions and user fields in `CopyPreviewPage`, plus two new Tauri commands (`resolve_description_to_adf`, `resolve_users_preview`), an audit-logging command (`log_preview_transformations`), and an integration test. The Rust implementation is well-structured. The critical finding is an SSRF inconsistency: `resolve_users_preview` accepts the Cloud base URL from the frontend and uses it without validating it against the stored credential, while `fetch_jira_image` — the only other command that accepts a URL argument — performs strict origin validation. The remaining findings are a logic gap in the frontend (array-of-user fields silently skipped), stale closure captures for `wasOverridden` in async callbacks, dead code in a test, and a flaky-by-design integration test.

---

## Critical Issues

### CR-01: `resolve_users_preview` uses frontend-supplied URL without origin validation

**File:** `src-tauri/src/commands.rs:1238`

**Issue:** `resolve_users_preview` accepts `cloud_base_url` as a command argument from the frontend and uses it directly to issue `/rest/api/3/user/search` requests with the stored Cloud API token:

```rust
let trimmed_base = cloud_base_url.trim_end_matches('/').to_string();
let client = reqwest::Client::new();
let resolver = crate::field_transform::user::UserResolver::new(
    client,
    cloud_auth,          // real Cloud credentials from OS keychain
    trimmed_base,        // URL supplied by frontend — not validated
);
```

The credentials retrieved from the keychain (`cloud_auth`) belong to the configured Cloud instance. The base URL used to send requests is supplied by the caller, not read from the stored connection meta. A compromised or manipulated WebView (e.g., via a cross-site scripting exploit in rendered Jira HTML, which is displayed inside the app) could pass an arbitrary URL and exfiltrate the Cloud API token to an attacker-controlled host.

Compare to `fetch_jira_image` (line 967–979), which explicitly validates that the request URL matches the stored base URL before using credentials.

**Fix:** Retrieve the Cloud base URL from the stored connection meta (already fetched on line 1232 as the first element of the tuple) instead of from the command argument. The command signature can drop `cloud_base_url` entirely, or retain it as an optional hint but validate it matches the stored URL:

```rust
// Line 1232 already returns (stored_base_url, cloud_email, cloud_api_token)
let (stored_base_url, cloud_email, cloud_api_token) = get_cloud_credentials(triage_db.inner())?;
// Use stored_base_url, not the frontend-supplied cloud_base_url
let trimmed_base = stored_base_url.trim_end_matches('/').to_string();
```

---

## Warnings

### WR-01: Array-of-user fields silently produce no audit log entry

**File:** `src/features/tickets/CopyPreviewPage.tsx:330-334`

**Issue:** The user-row extraction loop casts `fieldVal` to `Record<string, unknown>` and reads `.name` / `.key` from it regardless of whether the value is a single-user object or an array. When `sourceSchema.type === 'array' && items === 'user'`, `fieldVal` is a JSON array; `val.name` is `undefined`, `val.key` is `undefined`, so `username` resolves to `null` and the `continue` at line 334 fires silently — no log entry is pushed and no `setOverrideValue` call is made. The gap remains unresolved and the audit log has a missing entry for that row:

```ts
const val = fieldVal as Record<string, unknown>;
// Single user: { name, emailAddress }
const username =
  (val.name as string | undefined) ?? (val.key as string | undefined) ?? null;
if (!username) continue;  // ← silent skip; no logEntry pushed
```

This is acknowledged in a test comment (line 441–442) but is presented as expected behavior. For array-of-user fields, the first element should be extracted, or the row should be pushed to `logEntries` with `outcome: 'skipped'` and `failureReason: 'array user field not supported in preview'` so the audit trail is complete.

**Fix:**
```ts
const username = Array.isArray(fieldVal)
  ? ((fieldVal[0] as Record<string, unknown> | undefined)?.name as string | undefined) ?? null
  : (val.name as string | undefined) ?? (val.key as string | undefined) ?? null;

if (!username) {
  logEntries.push({
    targetFieldId: row.targetFieldId,
    sourceFieldId: row.sourceFieldId,
    transformerKind: row.transformerKind,
    outcome: 'skipped',
    failureReason: 'array user field: username not extractable',
    wasOverridden: false,
    gapKind: null,
    sourceValue: fieldVal ?? null,
    targetValue: null,
  });
  continue;
}
```

### WR-02: Stale `overrideValues` closure in async callbacks causes incorrect `wasOverridden` audit flag

**File:** `src/features/tickets/CopyPreviewPage.tsx:264, 360`

**Issue:** `overrideValues` is captured by the `useEffect` closure at the time the effect fires. The `wasOverridden` check inside the `.then()` callback for both `descPromise` and `usersPromise` reads from this stale snapshot rather than the live store state:

```ts
// Line 264 — inside .then() callback, but `overrideValues` was captured when effect ran
wasOverridden: overrideValues[descRow.targetFieldId] !== undefined,

// Line 360 — same pattern for user rows
wasOverridden: overrideValues[row.targetFieldId] !== undefined,
```

If the user edits an override value in the gap form between effect invocation and async resolution (a short window but plausible in slow network conditions), the audit record will log `wasOverridden: false` even though the user did provide a value. This is especially misleading for audit-trail consumers.

**Fix:** Read from the live store at the point of logging rather than from the captured snapshot:
```ts
wasOverridden: useCopyStore.getState().overrideValues[descRow.targetFieldId] !== undefined,
```

### WR-03: `resolve_users_preview` does not guard existing user override values

**File:** `src/features/tickets/CopyPreviewPage.tsx:352-353`

**Issue:** The identity/priority pre-fill path (lines 208–218) checks `userAlreadyHasValue` and skips `setOverrideValue` if the user has already entered a value. The async user-resolution path has no equivalent guard:

```ts
if (resolvedUser?.accountId) {
  setOverrideValue(row.targetFieldId, resolvedUser);  // ← overwrites user-entered value
```

If the user manually selects an assignee in the gap pickers before the async resolution returns (possible with slow networks), the auto-resolved value silently overwrites the user's choice. This is inconsistent with the synchronous path's behavior.

**Fix:**
```ts
if (resolvedUser?.accountId) {
  const alreadySet = useCopyStore.getState().overrideValues[row.targetFieldId] !== undefined;
  if (!alreadySet) {
    setOverrideValue(row.targetFieldId, resolvedUser);
  }
```

### WR-04: Integration test relies on a 300 ms sleep for mock server startup — flaky under load

**File:** `src-tauri/tests/resolve_users_preview_integration.rs:30`

**Issue:** The test spawns a thread that starts the mock servers, then unconditionally sleeps 300 ms before proceeding under the assumption the server is bound. Under CI load or resource-constrained runners, 300 ms can be insufficient:

```rust
RESOLVE_USERS_ONCE.call_once(|| {
    std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new()...;
        rt.block_on(async {
            start_mock_servers(fixtures).await...;
            loop { tokio::time::sleep(Duration::from_secs(3600)).await; }
        });
    });
    std::thread::sleep(Duration::from_millis(300));  // ← fixed sleep
});
```

The same pattern is used in `field_discovery_integration.rs` (pre-existing), but adding it again in a new test file compounds the risk. This is identical to what the other integration test files do, but no retry/probe logic is used.

**Fix:** After the sleep, probe the port with a TCP connect loop before proceeding:
```rust
// After thread::sleep, probe readiness
for _ in 0..30 {
    if std::net::TcpStream::connect("127.0.0.1:8081").is_ok() { break; }
    std::thread::sleep(Duration::from_millis(20));
}
```

---

## Info

### IN-01: Dead code in PREV-01 test — first `currentStoreState` assignment is overwritten immediately

**File:** `src/features/tickets/__tests__/CopyPreviewPage.test.tsx:543-548`

**Issue:** The test sets `currentStoreState` twice in succession; the first assignment (lines 543–548) is dead code. A corrective comment explains why, but the first assignment was never removed:

```ts
currentStoreState = buildState({           // ← dead: immediately overwritten
  sourceTicket: makeTicketDetail({
    description: '<p>Test description</p>',
    renderedFields: { description: '<p>Test</p>' },
  }),
});
// renderedFields is on the outer ticket object, not inside fields
currentStoreState = buildState({           // ← this is the one that actually runs
  sourceTicket: {
    ...makeTicketDetail(),
    renderedFields: { description: '<p>Test</p>' },
  },
});
```

**Fix:** Remove the dead first assignment (lines 543–548).

### IN-02: Multiple integration test files independently bind port 8081 — inherent port-conflict risk

**File:** `src-tauri/tests/resolve_users_preview_integration.rs:47` (also `field_discovery_integration.rs:56`, `mock_server.rs:62`)

**Issue:** At least three integration test binaries each attempt to bind `127.0.0.1:8081`. Rust's `cargo test` runs each integration test file as a separate binary; if two are executed concurrently (e.g., by a parallel CI runner or `cargo nextest`), the second to start will fail to bind the port and tests will error. Phase 25 adds a fourth consumer of port 8081 without documenting this constraint.

**Fix:** Document in a `tests/README.md` or `Cargo.toml` comment that integration tests must run with `--test-threads=1` or serially. Alternatively, use `TcpListener::bind("127.0.0.1:0")` to bind an ephemeral port and pass the address to the resolver under test (as is already done in `user.rs` unit tests).

### IN-03: `outcome` field written to the audit DB without server-side validation

**File:** `src-tauri/src/commands.rs:2020, 2094`

**Issue:** `PreviewTransformationLog.outcome` is a free `String` that flows from the frontend directly into `mapping_audit_log.outcome` without any whitelist check. The audit UI renders known values (`ok`, `failed`, `skipped`, `copied`); any other string would display as raw text. This is low-risk (parameterized query prevents injection), but allows the frontend to write arbitrary strings into the audit log, which could confuse the UI or future queries that filter on the outcome column.

**Fix:** Validate on the backend before inserting:
```rust
let valid_outcomes = ["ok", "failed", "skipped", "copied"];
if !valid_outcomes.contains(&e.outcome.as_str()) {
    continue; // or map to "skipped"
}
```

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
