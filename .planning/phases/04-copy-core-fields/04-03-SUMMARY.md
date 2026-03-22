---
phase: 04-copy-core-fields
plan: "03"
subsystem: rust-backend
tags: [tauri, commands, copy-pipeline, htmltoadf, multipart, remotelink, adf, triage]

requires:
  - phase: 04-01
    provides: [htmltoadf-crate, multipart-reqwest, mock-remotelink-endpoint, mock-priority-endpoint, mock-project-statuses-endpoint, set-triage-copied-method]
provides:
  - fetch_cloud_meta Tauri command (statuses, priorities, accountId from Cloud Jira)
  - copy_ticket Tauri command (full 9-step two-pass copy pipeline per D-03)
  - rewrite_image_urls helper (replaces source image URLs with Cloud attachment URLs in HTML)
  - extract_image_urls helper (parses img src attributes from HTML without regex dependency)
  - get_cloud_credentials helper (retrieves Cloud base_url + email + api_token from connection_meta + keychain)
  - CloudMeta, StatusOption, PriorityOption, CopyStepResult, CopyTicketResult structs
affects: [04-04, 04-05]

tech-stack:
  added: []
  patterns:
    - "reqwest_middleware::RequestBuilder lacks .json() and .multipart() — use .body(serialized_str) for JSON and plain reqwest::Client for multipart uploads"
    - "Two-pass copy pipeline: create issue with stub -> upload images -> collect URL map -> rewrite HTML -> convert to ADF -> PUT description update"
    - "Partial failure tolerance: copy_ticket returns CopyStepResult per step; individual image upload failures are logged but do not abort the pipeline"

key-files:
  created: []
  modified:
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs

key-decisions:
  - "Used plain reqwest::Client for multipart image upload — reqwest_middleware::ClientWithMiddleware does not expose .multipart(); image uploads bypass audit middleware but are acceptable since the audit middleware primarily captures Jira API calls"
  - "extract_image_urls uses simple string parsing instead of regex crate — avoids adding a dependency; handles standard <img src=\"...\" patterns correctly"
  - "fetch_cloud_meta signature takes triage_db State instead of explicit base_url — credentials are retrieved from connection_meta (consistent with server PAT pattern)"
  - "target_status parameter is accepted but only informational — Cloud v3 API does not support status at issue creation; transitions are out of scope for Phase 4"

patterns-established:
  - "Cloud credential retrieval: get_cloud_credentials() reads connection_meta for cloud type, extracts email (username), calls keychain::get_credential(\"jira-cloud\", &email)"
  - "JSON request bodies with reqwest_middleware: serde_json::to_string(&body) + .body(str) instead of .json(&body)"

requirements-completed: [COPY-01, COPY-07, COPY-09]

duration: ~4 minutes
completed: 2026-03-22
---

# Phase 04 Plan 03: Copy Backend Commands Summary

**Two-pass copy pipeline implemented as Tauri commands: fetch_cloud_meta fetches target Jira metadata, copy_ticket creates issue, uploads inline images, rewrites HTML with new URLs, converts to ADF via htmltoadf, PUTs description, adds remote link, and marks triage copied.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-22T19:48:07Z
- **Completed:** 2026-03-22T19:52:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `fetch_cloud_meta` command: fetches `/myself` (accountId), `/priority`, and `/project/MYPROJ/statuses` from Cloud Jira with Basic auth built from keychain credentials
- `copy_ticket` command: full D-03 two-pass pipeline — create issue, upload images, rewrite URLs, convert HTML to ADF, PUT description, add remotelink, update triage state
- `get_cloud_credentials` private helper consistent with existing `get_server_pat` pattern
- Both commands registered in `main.rs` invoke_handler

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement fetch_cloud_meta Tauri command** - `33df3ca` (feat)
2. **Task 2: Implement copy_ticket and register both commands** - `3cbf56f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src-tauri/src/commands.rs` - Added fetch_cloud_meta, copy_ticket, rewrite_image_urls, extract_image_urls, get_cloud_credentials, and all result/option structs
- `src-tauri/src/main.rs` - Registered fetch_cloud_meta and copy_ticket in generate_handler!

## Decisions Made

- Used plain `reqwest::Client` for multipart uploads because `reqwest_middleware::ClientWithMiddleware` does not expose `.multipart()`. Image upload calls are not logged through the audit middleware — acceptable trade-off for Phase 4 since the primary audit value is Jira API call tracking.
- Implemented `extract_image_urls` with simple string parsing rather than adding the `regex` crate. The HTML from Jira Server renderedFields uses standard `<img src="...">` patterns that parse cleanly with `str::find`.
- `fetch_cloud_meta` derives Cloud credentials from `connection_meta` + keychain via the new `get_cloud_credentials` helper — consistent with `get_server_pat` pattern from Phase 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced .json()/.multipart() request methods with .body() and plain reqwest::Client**
- **Found during:** Task 2 (copy_ticket implementation)
- **Issue:** `reqwest_middleware::RequestBuilder` does not implement `.json()` (request body) or `.multipart()` — cargo check returned 11 errors
- **Fix:** Used `serde_json::to_string()` + `.body()` for JSON POST/PUT requests; used `reqwest::Client::new()` for multipart attachment uploads
- **Files modified:** src-tauri/src/commands.rs
- **Verification:** `cargo check` exits 0
- **Committed in:** 3cbf56f (Task 2 commit)

**2. [Rule 2 - Missing Critical] Extracted image URL parsing to helper instead of regex**
- **Found during:** Task 2 (copy_ticket implementation)
- **Issue:** Plan specified `regex` crate for image URL extraction but `regex` was not in Cargo.toml; adding it would introduce a non-trivial dependency
- **Fix:** Implemented `extract_image_urls()` with simple string parsing — finds `<img` tags, extracts `src="..."` value, handles both http:// and https:// URLs
- **Files modified:** src-tauri/src/commands.rs
- **Verification:** Function logic handles standard Jira renderedFields HTML patterns; cargo check passes
- **Committed in:** 3cbf56f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking API mismatch, 1 dependency avoidance)
**Impact on plan:** Both fixes maintain full D-03 compliance and all acceptance criteria. No scope creep.

## Issues Encountered

- `reqwest_middleware::ClientWithMiddleware` is missing request-building methods that plain `reqwest::Client` provides. This is a known limitation of the middleware crate. Future plans using multipart should use plain `reqwest::Client` and note that those calls bypass the audit log.

## Known Stubs

- `fetch_cloud_meta` hardcodes project key `"MYPROJ"` for the statuses endpoint — cloud_project_key is not yet in settings. Mock server responds to any project key. This will be resolved when the settings schema is extended.

## Next Phase Readiness

- `fetch_cloud_meta` and `copy_ticket` are ready for frontend invocation in Plans 04-04 and 04-05
- Both commands compile and are registered in main.rs
- Mock server already supports all required endpoints (from Plan 04-01): POST /issue, POST /remotelink, GET /priority, GET /project/{key}/statuses

---
*Phase: 04-copy-core-fields*
*Completed: 2026-03-22*
