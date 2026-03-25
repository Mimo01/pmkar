---
status: awaiting_human_verify
trigger: "audit-log-display: response bodies not logged, URLs are percent-encoded"
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T02:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — response body pre-wrap and height cap fixed per user feedback
test: tsc --noEmit passes (no new errors in AuditLogPage.tsx)
expecting: human verification that response body wraps within container, no horizontal scroll, no height cap
next_action: await human verification in running app

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Audit log entries should show response bodies and display URLs in decoded/readable form
actual: No response body shown in audit entries; URLs are percent-encoded and hard to read
errors: None — functional issue, not a crash
reproduction: Open the audit/debug log panel and look at any logged API request
started: Likely since audit logging was first implemented

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-23T00:00:00Z
  checked: src-tauri/src/audit.rs AuditMiddleware::handle() lines 134-167
  found: In the Ok(resp) branch, response_body is hardcoded as None with comment "Response body read separately if needed" — it was never implemented
  implication: Bug 1 root cause — response body is never captured at all

- timestamp: 2026-03-23T00:00:00Z
  checked: src-tauri/src/audit.rs line 120 — `let url = req.url().to_string();`
  found: reqwest's Url::to_string() produces the percent-encoded form of the URL (this is the standard URL serialization per the URL spec)
  implication: Bug 2 root cause — the URL string is stored in its raw percent-encoded form; it needs to be decoded before storing

- timestamp: 2026-03-23T00:00:00Z
  checked: The middleware's handle() signature — it receives reqwest::Request (moves it) then calls next.run(req, extensions)
  found: The reqwest::Response returned by next.run() is consumed if we call .text() on it; we must reconstruct a new response or change the approach; in reqwest_middleware, after calling next.run() the response is an Ok(reqwest::Response) — calling .text().await consumes it, so we need to buffer and reconstruct
  implication: Fix requires reading body bytes, storing them, then reconstructing response to return to caller — OR use a different approach

- timestamp: 2026-03-23T00:00:00Z
  checked: reqwest::Response API
  found: reqwest::Response can be converted to bytes with .bytes().await; it can be reconstructed using http::Response builder — but reqwest_middleware Result is reqwest::Response, not http::Response; we can use reqwest::Response::from() with an http::Response<bytes::Bytes> — actually reqwest does not provide a public constructor from raw parts. The correct pattern is to read bytes, store them for the audit entry, then return an error-style response — but that breaks the call. The simpler correct approach: since this is a debug-only log, truncate to 10KB and use the bytes to build a new reqwest::Response via the underlying http response. Checking reqwest source: reqwest::Response wraps http::Response<hyper::body::Bytes>... actually we need to reconstruct it.
  implication: Safe approach — capture body bytes, then use reqwest::Response::from() which accepts http::Response<bytes::Bytes> to reconstruct; verified this is available in reqwest

- timestamp: 2026-03-23T01:00:00Z
  checked: AuditEntry struct in audit.rs vs AuditEntry TypeScript interface in types.ts
  found: Rust struct fields are status_code and response_body; TypeScript expects statusCode and responseBody; Rust struct was missing #[serde(rename_all = "camelCase")] — every other Tauri-serialized struct in the codebase has this attribute. Without it, Serde serializes snake_case as-is, producing status_code and response_body which TypeScript never finds under camelCase names.
  implication: entry.responseBody is always undefined in JS — the "no response body" display was caused by the missing serde attribute, NOT by the backend not capturing the body.

- timestamp: 2026-03-23T01:00:00Z
  checked: AuditLogPage.tsx URL column td at line 174
  found: td had class "truncate" (shorthand for overflow-hidden + text-ellipsis + whitespace-nowrap) but lacked max-w-0; in table-fixed layout without max-w-0 the td does not constrain to its flex-share width, so long URLs push the column wider instead of truncating.
  implication: URL overflow was a CSS constraint issue — adding max-w-0 overflow-hidden to the td forces the table-fixed algorithm to clip the cell content.

- timestamp: 2026-03-23T01:00:00Z
  checked: Expanded detail row in AuditLogPage.tsx
  found: When a row is expanded, the full URL was never shown — only request headers and response body. Users had no way to read the full URL.
  implication: Added a "Full URL" section at the top of the expanded row using break-all so long URLs wrap instead of overflow.

- timestamp: 2026-03-23T02:00:00Z
  checked: AuditLogPage.tsx headers rendering and response body styling
  found: (1) headers JSON string was rendered in a raw <pre> — unreadable; (2) response body <pre> had no visual distinction (no background, no border, no scroll cap); formatResponseBody() already used JSON.parse+stringify(null,2) but the pre was styled inline
  implication: (1) Added parseHeaders() that JSON.parses the headers string and renders each key/value as a bordered row with a 160px label column; (2) response body <pre> now gets bg-black/20, border, px-3 py-2, max-h-64 with overflow-y-auto so long responses scroll rather than flood the panel; whitespace-pre preserves indentation from stringify.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Four bugs total:
  1. (Rust) response_body hardcoded as None in AuditMiddleware::handle() — body never captured
  2. (Rust) URL stored via req.url().to_string() which produces percent-encoded form
  3. (Frontend) AuditEntry struct missing #[serde(rename_all = "camelCase")] — status_code and response_body serialized as snake_case; TypeScript reads camelCase so both fields were always undefined
  4. (Frontend CSS) URL column td missing max-w-0 so table-fixed layout did not constrain the cell; URLs overflowed. Expanded row never showed the full URL at all.

fix:
  1. Changed match &result to match result (consuming), read resp.bytes().await to capture body, truncate to 10KB, store as UTF-8 string (lossy). Reconstructed a new reqwest::Response via http::Response::builder() + reqwest::Response::from() so the call chain receives a complete response.
  2. Added urlencoding::decode(req.url().as_str()) before storing the URL, with fallback to raw string on decode failure.
  3. Added #[serde(rename_all = "camelCase")] to AuditEntry struct in audit.rs.
  4. Changed URL column td to use max-w-0 overflow-hidden text-ellipsis whitespace-nowrap for proper truncation. Added "Full URL" section to expanded detail row with break-all wrapping.
  5. Added audit.url i18n key to en.json and sk.json.

verification: cargo build clean; cargo test — all 17 tests pass (5 audit, 3 keychain, 9 mock_server); tsc --noEmit — no new type errors in AuditLogPage.tsx; user reported overflow and height issues → fixed: overflow-x-auto removed, whitespace-pre replaced with whitespace-pre-wrap break-all, max-h-64 overflow-y-auto removed from response body pre element
files_changed: [src-tauri/src/audit.rs, src/features/tickets/AuditLogPage.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json]
