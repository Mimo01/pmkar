---
phase: 23-copy-ticket-v2-wiring
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src-tauri/src/copy_pipeline.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/triage_db.rs
  - src-tauri/src/field_mapping_db.rs
  - src-tauri/src/main.rs
  - src/features/tickets/copyStore.ts
  - src/features/tickets/CopyPreviewModal.test.tsx
  - src-tauri/tests/copy_ticket_v2_integration.rs
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: fixed
---

# Phase 23: Code Review Report

**Reviewed:** 2026-04-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 23 wires `copy_ticket_v2` through the mapping engine, extracts shared pipeline helpers into `copy_pipeline.rs`, parameterizes the target project key, and adds per-decision audit logging. The Rust backend is generally sound. The two critical findings are a data-loss bug in the frontend (user-edited summary never reaches the backend) and a silent worklog failure path that can make the copy appear successful while losing all work-log data. Four warnings cover logic gaps and suppressed error information.

---

## Critical Issues

### CR-01: User-edited summary in `confirmCopy` is silently dropped — copy always uses the mapping-engine value

**File:** `src/features/tickets/copyStore.ts:221-228`

**Issue:** `setTargetSummary` writes the user's summary edit into `state.targetSummary`, but `confirmCopy` only sends `state.overrideValues` to the backend. `targetSummary` is never inserted into `overrideValues`. The backend's `copy_ticket_v2` constructs its create-issue payload from `apply_mapping(...) + override_values` (commands.rs:1613-1631); the summary field comes entirely from `apply_mapping`, so the user's in-preview edit is silently discarded. The ticket is created with whatever the mapping engine produced, not what the user typed.

This is confirmed by the fact that `setTargetSummary` and `setOverrideValue` are separate store actions and neither `confirmCopy` nor any caller bridges them (copyStore.ts:211-243, CopyPreviewModal.tsx:372-373, CopyPreviewPage.tsx:420).

**Fix:**
```typescript
// In confirmCopy, merge targetSummary into overrideValues before invoking:
const result = await invoke<CopyTicketResult>('copy_ticket_v2', {
  args: {
    sourceKey: state.sourceKey,
    sourceBaseUrl,
    targetBaseUrl: cloudBaseUrl,
    targetIssueTypeId: state.targetIssueTypeId ?? '',
    overrideValues: {
      summary: state.targetSummary,   // <-- add this line
      ...state.overrideValues,
    },
  },
});
```
Alternatively, `setTargetSummary` could call `setOverrideValue('summary', summary)` internally to keep a single source of truth.

---

### CR-02: Silent worklog failure path — worklog errors are entirely swallowed with no step recorded

**File:** `src-tauri/src/copy_pipeline.rs:367-444`

**Issue:** `copy_worklogs` uses two nested `if let Ok` / `if ... is_success()` checks (lines 367-443). If the worklog GET request fails at the network layer, or returns a non-2xx status, or the response body cannot be parsed as JSON, the function returns an empty `Vec` with **zero** `CopyStepResult` entries. The caller in `copy_ticket_v2` (`commands.rs:1694`) does `steps.extend(copy_worklogs(&ctx).await)`, so no failure step is pushed into the result. The UI receives an overall success result with no worklog-related steps — even when all worklogs were silently skipped due to a network or auth error. A user gets no indication that work-log migration failed.

The integration test (copy_ticket_v2_integration.rs:184-193) only asserts `s.success` on steps that are returned — it explicitly comments "copy_worklogs may return zero steps" — so this silent path is not caught by the existing test.

**Fix:**
```rust
pub async fn copy_worklogs(ctx: &CopyContext) -> Vec<CopyStepResult> {
    let mut out: Vec<CopyStepResult> = Vec::new();
    let worklog_url = format!(
        "{}/rest/api/2/issue/{}/worklog",
        ctx.source_base_url, ctx.source_key
    );
    let wl_resp = ctx
        .client
        .get(&worklog_url)
        .header("Authorization", format!("Bearer {}", ctx.server_pat))
        .send()
        .await;

    let wl_response = match wl_resp {
        Ok(r) => r,
        Err(_) => {
            out.push(CopyStepResult {
                step: "worklog:fetch".to_string(),
                success: false,
                detail: Some("Network error fetching worklogs from source".to_string()),
            });
            return out;
        }
    };
    if !wl_response.status().is_success() {
        out.push(CopyStepResult {
            step: "worklog:fetch".to_string(),
            success: false,
            detail: Some(format!(
                "Worklog fetch returned status {}",
                wl_response.status().as_u16()
            )),
        });
        return out;
    }
    let wl_body = match wl_response.json::<serde_json::Value>().await {
        Ok(b) => b,
        Err(_) => {
            out.push(CopyStepResult {
                step: "worklog:fetch".to_string(),
                success: false,
                detail: Some("Failed to parse worklog response".to_string()),
            });
            return out;
        }
    };
    // ... existing per-worklog loop unchanged
```

---

## Warnings

### WR-01: `targetIssueTypeId` is `null` by default and coerced to `""` before being sent — Jira Cloud will reject the create-issue call

**File:** `src/features/tickets/copyStore.ts:226`

**Issue:** When the Phase 22 pre-warm fails or finds no issue types (e.g., on first run, misconfigured project, or network failure), `state.targetIssueTypeId` remains `null`. `confirmCopy` sends `targetIssueTypeId: state.targetIssueTypeId ?? ''` — an empty string. The Jira Cloud `/rest/api/3/issue` endpoint rejects an empty `issuetype.id` with a 400. The resulting `CopyStepResult` step `create_issue` will have `success: false` with `"Issue creation returned status 400"`, giving no clear explanation. There is no guard in `confirmCopy` before the `invoke` call to check that `targetIssueTypeId` is non-null/non-empty, even though the `isCopyDisabled` gating in the UI (`CopyPreviewModal.tsx:203`) may not correctly account for this case when `gapFields` is empty but the issue type was never resolved.

**Fix:**
```typescript
confirmCopy: async (sourceBaseUrl, cloudBaseUrl) => {
  const state = get();
  if (!state.sourceKey || !state.cloudMeta) return;
  if (!state.targetIssueTypeId) {
    set({
      phase: 'result',
      result: {
        targetKey: null,
        targetUrl: null,
        steps: [{ step: 'create_issue', success: false, detail: 'No target issue type selected.' }],
      },
      progressStep: '',
    });
    return;
  }
  // ... rest of the function
```

---

### WR-02: `add_remote_link` network error silently discards the error message — `detail` always returns a generic string

**File:** `src-tauri/src/copy_pipeline.rs:96-101`

**Issue:** The `Err(_)` arm of the `.send()` result in `add_remote_link` (line 96) discards the underlying error entirely with `_`. The `detail` field returns `"Failed to create remote link in Cloud Jira"` regardless of whether the failure was a timeout, a DNS error, or an authentication failure. This mirrors a pattern seen throughout `copy_pipeline.rs` (copy_attachments lines 185-190, 216-221; copy_comments lines 336-342; copy_worklogs lines 432-439; copy_subtasks lines 504-509). While the error is surfaced to the user as a failed step, the lack of error detail makes debugging difficult.

The same pattern is present in `copy_attachments` (upload network error, line 185), `copy_comments` (line 336), and `copy_subtasks` (line 504).

**Fix:** Capture the error and include it in `detail`:
```rust
Err(e) => CopyStepResult {
    step: "add_remotelink".to_string(),
    success: false,
    detail: Some(format!("Network error creating remote link: {e}")),
},
```
Apply consistently across all `Err(_)` arms in the pipeline helpers.

---

### WR-03: `_audit` client built but immediately discarded in four field-discovery commands — AuditDb arc cloned for no effect

**File:** `src-tauri/src/commands.rs:1193, 1214, 1271, 1297`

**Issue:** `discover_source_fields`, `get_target_field_schema_for_issuetype`, `probe_createmeta`, and `pre_warm_target_issue_types` each call `build_audited_client(Arc::clone(db.inner()))` and assign the result to `_audit`, which is immediately dropped. These commands then use a plain `reqwest::Client::new()` for the actual HTTP calls. The comment says "Arm audit middleware side-effects (request-id seeding)" but `build_audited_client` doesn't have meaningful side effects on the `AuditDb` unless requests are actually made through the returned client. The `Arc::clone` of `AuditDb` is wasted, and no HTTP request made through `plain_client` will be logged to the audit database.

**Fix:** Either use the audited client for all requests in these commands (the audit intent), or remove the dead `_audit` binding and its `Arc::clone` call entirely if audit logging is intentionally not needed for schema discovery. This is a correctness question about whether schema probes should be audited.

---

### WR-04: `MIGRATE_TRIAGE_CHECK_HANDLED` migration copies `copied_key` but `ALTER_TRIAGE_ADD_COPIED_KEY` runs before the migration — on a DB that lacked `copied_key` the migration will fail silently

**File:** `src-tauri/src/triage_db.rs:135-136`

**Issue:** The migration sequence in `open()` is:
1. Line 135: `ALTER TABLE triage_state ADD COLUMN copied_key TEXT` (silently ignored if already present via `let _`).
2. Line 136: `Self::migrate_triage_check_constraint(&conn)` which runs `MIGRATE_TRIAGE_CHECK_HANDLED` — a `BEGIN TRANSACTION` block that creates `triage_state_new` with a `copied_key` column and then does `INSERT INTO triage_state_new ... SELECT ..., copied_key FROM triage_state`.

The problem: if the database is a legacy DB that does NOT yet have `copied_key`, step 1 will add the column (the `let _` discards any error, which on a fresh column add is `Ok`). That looks fine. But on a DB where step 1 already succeeded on a previous run (column exists, `ALTER` returns an error that is discarded), and the `CHECK` constraint still lacks `'handled'`, step 2 runs and tries to `SELECT ..., copied_key FROM triage_state` — which should succeed because the column was added by step 1 in a prior run.

However, there is a subtler issue: `MIGRATE_TRIAGE_CHECK_HANDLED` is a multi-statement batch executed via `execute_batch`, which wraps everything in a single `BEGIN TRANSACTION ... COMMIT`. If **any** statement inside that batch fails, `execute_batch` returns an error that is also silently discarded (`let _ = conn.execute_batch(MIGRATE_TRIAGE_CHECK_HANDLED)`). If the migration fails mid-way (e.g., disk full, constraint violation on the `INSERT`), the transaction rolls back but the code continues as if nothing happened — leaving the DB in the pre-migration state with the old `CHECK` constraint that rejects `'handled'`. The caller gets `Ok(Self { conn })` and any subsequent `set_triage("key", "handled")` call will return a `CHECK constraint failed` error.

**Fix:** Propagate the error instead of discarding it:
```rust
// In open() and open_in_memory():
Self::migrate_triage_check_constraint(&conn);
// Change migrate_triage_check_constraint to return AppResult<()>
// and propagate: Self::migrate_triage_check_constraint(&conn)?;
```

---

## Info

### IN-01: Dead store fields `targetStatus`, `targetPriorityId`, `selectedLabels`, `targetDescription` in `copyStore` — populated but never sent to backend

**File:** `src/features/tickets/copyStore.ts:15-19, 63-68, 123-125`

**Issue:** `targetStatus`, `targetPriorityId`, `selectedLabels`, and `targetDescription` are populated in `startPreview` (lines 123-125) and exposed via setters, but `confirmCopy` sends only `overrideValues` to the backend. These four state fields are either UI-only display artifacts (if the UI components drive overrides through `setOverrideValue` for status/priority) or dead state that was never wired up. This is related to CR-01 but distinct: it indicates the store has accumulated legacy fields from a pre-D-03 design that partially persists.

A search of `CopyPreviewModal.tsx` shows `targetStatus`, `targetPriorityId`, and `selectedLabels` are not subscribed anywhere in that file — they exist only in the store and in the test mock (`buildStoreState`). This suggests they are dead weight or the wiring was never completed.

**Fix:** Audit which fields (if any) are still needed for UI display vs. which should be removed. If status/priority/labels are controlled entirely through `DynamicTargetForm` + `setOverrideValue`, these four fields and their setters can be removed. This also means the test mock (`CopyPreviewModal.test.tsx:79-83`) is testing state that never affects the IPC call.

---

### IN-02: Integration test start-up race condition — `thread::sleep(300ms)` to await server readiness is fragile

**File:** `src-tauri/tests/copy_ticket_v2_integration.rs:47`

**Issue:** `start_servers_once()` spawns a thread running the mock servers and then sleeps 300 ms, assuming the servers are ready by then. On a loaded CI machine or a slow environment this sleep may be insufficient, causing the first test to fail with a connection-refused error against `127.0.0.1:8080/8081`. There is no retry or readiness check.

**Fix:** Poll the server readiness endpoint (e.g., `GET /rest/api/2/search` with a short timeout) in a loop with a bounded retry count before proceeding:
```rust
fn start_servers_once() {
    CUTV_SERVERS_ONCE.call_once(|| {
        std::thread::spawn(|| { /* ... spawn runtime */ });
        // Replace fixed sleep with a readiness poll:
        for _ in 0..30 {
            if reqwest::blocking::Client::new()
                .get("http://127.0.0.1:8080/rest/api/2/search")
                .header("authorization", "Bearer ping")
                .send()
                .is_ok()
            {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        panic!("Mock servers did not start within 3s");
    });
}
```

---

### IN-03: `open_external_url` on Windows passes `url` as third argument to `cmd /C start` — space-containing URLs may be misinterpreted

**File:** `src-tauri/src/commands.rs:659-662`

**Issue:** On Windows, `cmd /C start <url>` works for simple URLs but `cmd.exe`'s `start` command parses space-separated tokens as window-title + URL. A URL containing a space (even percent-encoded, which browsers sometimes produce) or a URL like `https://jira.example.com/browse/PROJ-1 (1)` would be split across two arguments. The correct invocation is `cmd /C start "" "<url>"` (the empty string forces `start` to treat the next argument as the URL, not a window title).

**Fix:**
```rust
#[cfg(target_os = "windows")]
{
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])   // empty title arg prevents misparse
        .spawn()
        .map_err(|e| AppError::Internal(format!("Failed to open URL: {e}")))?;
}
```

---

_Reviewed: 2026-04-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
