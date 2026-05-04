---
phase: full-codebase-review
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 120
files_reviewed_list:
  - src/App.tsx
  - src/features/connections/connectionStore.ts
  - src/features/tickets/copyStore.ts
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/computeGapFields.ts
  - src/features/tickets/isOverrideValueFilled.ts
  - src/features/tickets/GapsSection.tsx
  - src/features/tickets/DescriptionRenderer.tsx
  - src/features/field-mapping/types.ts
  - src/features/field-renderers/DynamicTargetForm.tsx
  - src/features/field-renderers/registry.ts
  - src/stores/schemaCacheStore.ts
  - src/lib/format.ts
  - src-tauri/src/main.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/copy_pipeline.rs
  - src-tauri/src/audit.rs
  - src-tauri/src/poll_engine.rs
  - src-tauri/src/field_mapping_db.rs
  - src-tauri/src/field_transform/pipeline.rs
  - src-tauri/src/field_transform/user.rs
  - src-tauri/src/field_transform/wiki_to_adf.rs
  - src-tauri/src/field_transform/identity.rs
  - src-tauri/src/field_transform/component.rs
  - src-tauri/src/field_transform/version.rs
  - src-tauri/src/notification_dispatcher.rs
  - src-tauri/src/snapshot_db.rs
  - src-tauri/src/triage_db.rs
  - src-tauri/src/keychain.rs
  - src-tauri/src/jira_client.rs
findings:
  critical: 4
  warning: 8
  info: 6
  total: 18
status: issues_found
---

# Full Codebase Review — pmkar v0.4.3

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 120 (Rust backend + TypeScript/React frontend)
**Status:** issues_found

## Summary

pmkar is a Tauri desktop application that copies Jira tickets from a Server instance to a Cloud instance. The codebase is generally well-structured — Rust backend with typed IPC commands, Zustand state management on the frontend, SQLite persistence via rusqlite, and a two-phase field-transform pipeline. The architecture is sound.

Four BLOCKER findings were identified. Two are security vulnerabilities: an XSS vector in the description renderer and an SSRF bypass in the image proxy. One is a data corruption bug: raw Jira Server v2 user objects are written into the Cloud API payload instead of the required `{accountId}` shape, causing all copy operations involving user-type fields to fail at the API level or silently send malformed data. One is a JQL injection issue from unescaped username strings.

Eight WARNINGs cover null-dereference risks on known-nullable Jira fields, audit logging gaps, silent error swallowing in network paths, and a stale-read anti-pattern in the render phase.

---

## Critical Issues

### CR-01: XSS via `dangerouslySetInnerHTML` with unsanitized Jira Server HTML

**File:** `src/features/tickets/DescriptionRenderer.tsx:54`
**Status:** FIXED in ca7f790

**Issue:** `renderedHtml` — sourced from the Jira Server `renderedFields.description` REST response — was injected directly into the DOM via `dangerouslySetInnerHTML`. No sanitization library was applied. A malicious Jira ticket description containing `<script>`, event handler attributes, or `javascript:` hrefs could execute in the app's WebView context, where Tauri's IPC bridge is accessible.

**Fix applied:** Wrapped with `DOMPurify.sanitize(renderedHtml)`.

---

### CR-02: SSRF bypass in `fetch_jira_image` via prefix spoofing

**File:** `src-tauri/src/commands.rs:953-958`
**Status:** FIXED in ca7f790

**Issue:** `image_url.starts_with(trimmed_base)` allowed `https://jira.example.com.evil.com/malicious` to pass when `trimmed_base` was `https://jira.example.com`. The server PAT was forwarded to the attacker-controlled host.

**Fix applied:** Replaced with `url::Url` scheme + host + port comparison.

---

### CR-03: Wrong user object shape sent to Cloud API — all user-field copies produce malformed payloads

**File:** `src/features/tickets/CopyPreviewPage.tsx:83` and `src/features/tickets/copyStore.ts`
**Status:** FIXED in ca7f790

**Issue:** `PREFILLABLE_KINDS` included `'user'`, causing raw Jira Server v2 user objects `{name, emailAddress}` to be written into `overrideValues` and merged into the Cloud create-issue payload, overriding the properly resolved `{accountId}` objects. The Jira Cloud API v3 requires `{accountId}` for user-typed fields.

**Fix applied:** Removed `'user'` from `PREFILLABLE_KINDS`.

---

### CR-04: JQL injection via unescaped usernames in poll engine

**File:** `src-tauri/src/poll_engine.rs:308-358`
**Status:** FIXED in ca7f790

**Issue:** Usernames and watched-user identifiers were interpolated directly into JQL string literals without escaping double-quote characters. A crafted username could break the query or manipulate which tickets are fetched.

**Fix applied:** Added `jql_escape()` function and applied to all JQL interpolations (username, watched identifiers, project key).

---

## Warnings

### WR-01: Null dereference on `ticket.fields.priority` — priority can be null in Jira

**File:** `src/features/tickets/copyStore.ts:109` and `src/features/tickets/CopyPreviewPage.tsx:455`
**Status:** FIXED in ca7f790

**Issue:** Both files accessed `.priority.name` on a field that the Jira REST API documents as nullable. Jira tickets without a priority set return `"priority": null`, which would throw `TypeError: Cannot read properties of null`.

**Fix applied:** Optional chaining `priority?.name ?? ''`.

---

### WR-02: Attachment `download_url` not validated against source base URL — SSRF risk

**File:** `src-tauri/src/copy_pipeline.rs:121`
**Status:** FIXED in ca7f790

**Issue:** `att["content"].as_str()` was used directly as the download URL for attachment fetching without validating it belonged to the configured source Jira instance. The server PAT was attached unconditionally.

**Fix applied:** Added origin check (scheme + host + port) before download.

---

### WR-03: `search_jira_users` silently returns empty vec on API errors

**File:** `src-tauri/src/commands.rs:1097-1101`
**Status:** FIXED in ca7f790

**Issue:** A 401, 403, or 500 all returned `Ok(vec![])` to the frontend. Users saw "no results" instead of an error. JSON parse errors were also silently swallowed.

**Fix applied:** Returns `Err(AppError::Http(...))` on non-success status and parse failure.

---

### WR-04: Poll engine HTTP calls bypass audit middleware — not logged

**File:** `src-tauri/src/jira_client.rs` (poll engine path)
**Status:** OPEN

**Issue:** The poll engine uses a plain unauthenticated client, bypassing `AuditMiddleware`. All background poll fetches are invisible in the audit log.

**Fix:** Pass `AuditDb` to the poll engine and use `build_audited_client`. Architectural change — deferred.

---

### WR-05: `useUpdateStore.getState()` called during render

**File:** `src/App.tsx:139`
**Status:** FIXED in ca7f790

**Issue:** Store state was accessed via `getState()` during render instead of a reactive selector, causing the component not to re-render when `updateInfo` changed.

**Fix applied:** Replaced with `useUpdateStore((s) => s.updateInfo)` reactive selector.

---

### WR-06: `format.ts` utility functions read store state outside React lifecycle

**File:** `src/lib/format.ts`
**Status:** OPEN

**Issue:** `formatDate`, `formatRelativeTime`, and `formatTimestamp` call `useLanguageStore.getState()` to read locale. Components using these won't re-render when language changes.

**Fix:** Convert to hooks using reactive `useLanguageStore((s) => s.locale)` selector. Deferred.

---

### WR-07: `fetch_users_by_domain` silently truncates at 2500 users with no warning

**File:** `src-tauri/src/field_transform/user.rs:112`
**Status:** OPEN

**Issue:** Hard cap of 50 pages × 50 results = 2500 users. When a domain has more users, resolution silently returns only the first 2500 with no log or gap annotation.

**Fix:** Emit warning or propagate truncation indicator when loop cap is hit. Deferred.

---

### WR-08: `notification_dispatcher.rs` `build_comment_body` truncates at byte offset, not char boundary

**File:** `src-tauri/src/notification_dispatcher.rs:57-60`
**Status:** FIXED in ca7f790

**Issue:** `&body_text[..60]` sliced at byte offset 60, not a UTF-8 character boundary. Multi-byte characters (accented letters, CJK, emoji) would cause a panic.

**Fix applied:** Replaced with `char_indices().take(60)` safe truncation.

---

## Info

### IN-01: Debug credential file has no programmatic permission enforcement

**File:** `src-tauri/src/keychain.rs` (debug build path)
**Status:** OPEN

In debug builds, credentials stored as plain JSON in `~/.pmkar-dev-credentials.json` depend on umask for permissions. No `chmod 600` call is made after creation.

---

### IN-02: `redact_credential_value` does not catch lowercase auth scheme prefixes

**File:** `src-tauri/src/field_mapping_db.rs`
**Status:** OPEN

Redaction checks for `"Bearer "` and `"Basic "` with exact casing. Lowercase variants would pass through unredacted into the audit log.

---

### IN-03: `console.error` calls in production code paths

**Files:** `src/features/tickets/copyStore.ts:163`, `src/features/tickets/CopyPreviewPage.tsx:244,342`
**Status:** OPEN

Multiple `console.error` calls log sensitive error details in production builds. Should be routed through structured error state.

---

### IN-04: AuditMiddleware double-buffers all HTTP response bodies

**File:** `src-tauri/src/audit.rs` (AuditMiddleware)
**Status:** OPEN

The middleware reads and buffers up to 100 KB of every response body for logging. For large attachment downloads this doubles memory allocation.

---

### IN-05: `search_jira_users_by_domain` pagination has no upper bound

**File:** `src-tauri/src/commands.rs:1129-1153`
**Status:** OPEN

Unbounded `loop` with no maximum page count. If the API always returns exactly 50 results, this loops forever.

---

### IN-06: `copy_subtasks` hardcodes `"Sub-task"` as the Cloud issue type name

**File:** `src-tauri/src/copy_pipeline.rs:495`
**Status:** OPEN

Jira Cloud instances may use a different subtask type name (`"Subtask"`, `"Child issue"`). The hardcoded name will cause a 400 error with no user-visible explanation on non-standard instances.

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
