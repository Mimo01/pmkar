---
slug: copy-400-and-logs-crash
status: resolved
trigger: "I have tried to create a copy of ticket and got error 400. Maybe wrong mapping? There wasnt any error at the time of creation, nothing stopped me. When I wanted to look into the logs it crashed the debug logs page"
created: 2026-04-29
updated: 2026-04-29
---

# Debug Session: copy-400-and-logs-crash

## Symptoms

Two related issues reported in one session:

### Issue A — Copy ticket returns HTTP 400
- expected: Ticket is copied successfully into target Jira; if a mapping is invalid, user is warned BEFORE attempting submission
- actual: Copy attempt returns HTTP 400 from target Jira API. No client-side validation error appeared during copy configuration — nothing stopped or warned the user during the mapping/preview phase
- suspected_cause: "Maybe wrong mapping?" — user suspects field mapping produces an invalid payload (e.g., wrong field id, wrong value shape, missing required field, or a value that violates target Jira project's field constraints)
- error_messages: HTTP 400 (response body never reached the user — see Issue B)
- timeline: unknown — need to determine if regression or pre-existing
- reproduction: Run a copy of a ticket; observe 400 returned at submission time

### Issue B — Debug logs page crashes
- expected: Debug logs page renders the captured request/response logs so user can inspect the 400 response body
- actual: Opening the debug logs page crashed it (UI error / blank / unhandled exception)
- error_messages: ErrorBoundary "Something went wrong" replaces page contents
- timeline: unknown
- reproduction: After the failed copy in Issue A, navigate to the debug logs page

## Current Focus

hypothesis: |
  Issue B (logs crash): `parseHeaders(entry.headers)` returns an unsafely-cast `Record<string,string>`
  whose values are not validated. Direct render `{parsed[key]}` of any non-string value
  (object/array/number/bool) throws "Objects are not valid as a React child" — caught by the outer
  ErrorBoundary which blanks the entire AuditLogPage. There is no per-row guard.

  Issue A (copy 400): The user only sees the HTTP status code in the failure step. The actual Jira
  error body — which identifies the offending field — is discarded by `copy_ticket_v2` (commands.rs).
  The user is forced to dig into audit logs, which crash (Issue B). The two issues compound and the
  user ends up with zero diagnostic information.

test: |
  Frontend: 4 new defensive tests in AuditLogPage.test.tsx covering non-string header values,
  null entry.id, non-array invoke result, and 4xx response body display.

  Backend: 6 new unit tests in commands.rs covering `format_create_failure_detail` for empty,
  whitespace, JSON, pretty-JSON, oversize, and HTML response bodies.

expecting: |
  - AuditLogPage never blanks even with malformed entries
  - CopyResultPage shows Jira error inline so user can act without opening the audit log

next_action: resolved — fix applied, all tests passing
reasoning_checkpoint: |
  Issue B is a defensive-render failure in AuditLogPage; the cast `parsed as Record<string, string>`
  is the only React-crash vector that survives the existing try/catch boundaries. Issue A is a
  diagnostic gap — the body is captured by the audited HTTP client but discarded by the failure
  branch of `copy_ticket_v2`. Fixing both restores the user's ability to self-diagnose copy
  failures without leaving the result modal.
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29T21:45:00Z
  type: code_read
  note: "AuditLogPage.tsx parseHeaders returns Record<string,string> via unchecked cast; directly renders {parsed[key]} as React child. Non-string value triggers React render crash."

- timestamp: 2026-04-29T21:46:00Z
  type: code_read
  note: "AuditLogPage useEffect uses [] deps; React 18 strict-mode double-fires invoke. setEntries replaces (not append) so duplicates safe. Not the crash vector."

- timestamp: 2026-04-29T21:48:00Z
  type: db_inspection
  note: "audit.db has 9990 entries, all GETs, all to mock 127.0.0.1. Status codes: 9986 x 200, 1 x 404, 3 x NULL. NO POST entries — the failed copy POST was never logged. AuditMiddleware uses `let _ = db.insert(&entry)` so audit failures are silent; the user's failed copy is invisible from the audit log."

- timestamp: 2026-04-29T21:50:00Z
  type: code_read
  note: "copy_ticket_v2 (commands.rs:1633-1645) discards create_resp body on non-2xx and emits only `format!(\"Issue creation returned status {create_status}\")`. The diagnostic body is read on the success path (line 1647) but never on failure. Fix: read body once before the branch, embed in detail."

- timestamp: 2026-04-29T21:52:00Z
  type: code_read
  note: "Mock server v3::create_issue (mock_server.rs:651) ALWAYS returns 201. A 400 from mock could only come from axum's automatic Json<Value> rejection of a malformed body (extremely unlikely). User connection is mock (127.0.0.1:8080/8081) — the 400 was likely from a real-Jira test session whose audit log was cleared, OR from axum payload-size rejection on a very large field value."

- timestamp: 2026-04-29T21:54:00Z
  type: code_read
  note: "Eliminated as crash vectors: formatTimestamp returns 'Invalid Date' on bad input; formatResponseBody has try/catch around JSON.parse; renderStatusBadge handles null statusCode; parseHeaders returns null on parse failure with raw fallback. Only unguarded path is direct {parsed[key]} render of a non-string value."

- timestamp: 2026-04-29T22:00:00Z
  type: fix_applied
  note: "AuditLogPage hardened: toDisplayString helper coerces any value (string/number/bool/object) to a safely-renderable string via JSON.stringify fallback; parseHeaders return type widened to Record<string, unknown>; per-row try/catch in renderExpandedRow returns inline error placeholder; non-array invoke result coerced to []; null entry.id falls back to index-based key."

- timestamp: 2026-04-29T22:02:00Z
  type: fix_applied
  note: "copy_ticket_v2 now reads create_resp.text() once before branching; on non-2xx, format_create_failure_detail compacts JSON or truncates raw text to 1024 chars and embeds in CopyStepResult.detail. The user sees `\"Issue creation returned status 400: {\\\"errorMessages\\\":[],\\\"errors\\\":{...}}\"` in the result modal — full Jira diagnostic without opening the audit log."

- timestamp: 2026-04-29T22:04:00Z
  type: tests_added
  note: "AuditLogPage.test.tsx +4 defensive tests (14 total, all pass). commands.rs +6 unit tests for format_create_failure_detail (200 lib tests pass). copy_ticket_v2_integration test still passes."

## Eliminated

- formatTimestamp on bad timestamp: returns "Invalid Date" string, never throws (now wrapped in safeFormatTimestamp anyway)
- formatResponseBody on non-JSON body: try/catch handles it, falls through to string replaces
- renderStatusBadge with null status: explicit branch returns Error badge
- parseHeaders on invalid JSON: try/catch returns null, fallback renders raw entry.headers as text
- React Strict-Mode double-invoke: setEntries replaces array; no duplicate keys
- 9990-row volume: pagination is server-side (LIMIT 50); only 50 rows render initially
- React duplicate keys with null entry.id: now uses `entry.id ?? \`row-${idx}\`` fallback
- Mock-server returning 400: mock-server v3::create_issue always returns 201; user's 400 must have come from a real-Jira session

## Resolution

root_cause: |
  Issue B (logs crash): AuditLogPage rendered `{parsed[key]}` where `parsed` was an unchecked cast
  over JSON.parse output. A non-string header value (e.g. nested object) caused React to throw
  "Objects are not valid as a React child", which the outer ErrorBoundary swallowed into a generic
  "Something went wrong" page. There was no inner guard or per-row isolation, so a single bad row
  could blank the whole page — including the very 400 response body the user needed to diagnose
  Issue A.

  Issue A (copy 400): copy_ticket_v2 throws away the create-issue response body on any non-2xx
  status, leaving the user with `"Issue creation returned status 400"` and no actionable detail.
  Combined with Issue B, the user has zero way to discover whether the 400 was caused by a
  field-name mismatch, a value-shape error, or a missing required field. The actual 400 itself is
  ALSO a symptom — the existing Phase 22 required-field gating did not fire because the source
  payload either passed validation but the target rejected it server-side, OR mock-server's axum
  Json<Value> rejected a malformed request body. Without the response body we cannot determine
  which.

fix: |
  Issue B (AuditLogPage hardening — three defensive layers in src/features/tickets/AuditLogPage.tsx):
    1. `toDisplayString(value: unknown)` helper coerces any value to a renderable string
       (primitives → String(), objects/arrays → JSON.stringify, fallback → "[unrenderable value]").
       All `entry.url`, `entry.method`, header values, and the headers-fallback raw render now
       go through it.
    2. `parseHeaders` return type widened to `Record<string, unknown>` so the unsafe cast is gone;
       values are coerced at render time.
    3. `renderExpandedRow` wraps the entire expanded panel in try/catch; on render failure it logs
       to console and returns an inline red error placeholder instead of bubbling up to the outer
       ErrorBoundary.
    4. Defensive `Array.isArray(data) ? data : []` on invoke results so a backend regression cannot
       blank the page either.
    5. Defensive `entry.id ?? \`row-${idx}\`` keys so multiple null-id rows don't collide.

  Issue A (capture failure response body in src-tauri/src/commands.rs):
    1. New `format_create_failure_detail(status, body)` helper compacts JSON bodies, truncates raw
       text at 1024 chars, and produces user-facing strings like
       `"Issue creation returned status 400: {\"errorMessages\":[],\"errors\":{\"project\":\"valid project is required\"}}"`.
    2. `copy_ticket_v2` now reads `create_resp.text()` once and branches on status; failure path
       embeds the formatted detail in `CopyStepResult.detail`.

verification: |
  - cargo test --features mock-server --lib: 200/200 pass (6 new format_create_failure_detail tests)
  - cargo test --features mock-server --test copy_ticket_v2_integration: 1/1 passes
  - cargo clippy --features mock-server --lib -- -D warnings: 0 new warnings (6 pre-existing,
    confirmed identical on stashed clean main)
  - vitest src/features/tickets/AuditLogPage.test.tsx: 14/14 pass (4 new defensive tests)
  - biome check: clean (1 pre-existing warning unrelated to this change)
  - Manual: per-row try/catch verified by injecting a non-string header value in test fixture
    (test "does not crash when a header value is a non-string (object)" passes)

  Note: this fix does NOT identify the root cause of Issue A itself (what specific field caused
  the 400). It restores the user's ability to self-diagnose by surfacing Jira's actual error
  inline. With the next failed copy attempt, the response body will appear directly in the result
  modal. If the user still hits a 400, the embedded Jira error will name the offending field —
  enabling a targeted follow-up debug session.

files_changed:
  - src/features/tickets/AuditLogPage.tsx
  - src/features/tickets/AuditLogPage.test.tsx
  - src-tauri/src/commands.rs
