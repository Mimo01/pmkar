---
phase: 05-copy-attachments-and-comments
plan: 01
subsystem: api
tags: [rust, tauri, jira, reqwest, htmltoadf, axum, mock-server, adf]

requires:
  - phase: 04-copy-core-fields
    provides: copy_ticket function with inline image upload, ADF description pipeline, remote link step

provides:
  - Extended copy_ticket with attachment binary copy loop (attach: steps)
  - Extended copy_ticket with comment copy loop using HTML-to-ADF conversion and attribution (comment: steps)
  - Extended copy_ticket with worklog copy loop posting to Cloud v3 (worklog: steps)
  - Extended copy_ticket with Sub-tasks and Linked Issues ADF footer appended to description
  - Mock server v2::get_issue renders comment.comments with HTML bodies in renderedFields
  - Mock server v3 add_worklog handler accepting POST /rest/api/3/issue/{key}/worklog returning 201

affects:
  - 05-02 (UI plan for copy progress display — will consume attach:/comment:/worklog: step names)
  - future verifier phases (copy completeness verification)

tech-stack:
  added: []
  patterns:
    - "Attachment copy follows inline image pattern: download with server PAT, upload via plain reqwest Client with multipart + X-Atlassian-Token: no-check"
    - "Comment attribution: bold ADF paragraph prepended to each comment body with author — date format"
    - "Worklog attribution: author — date (timeSpent) in bold ADF paragraph sent as worklog comment field"
    - "renderedFields fallback: use source_body[renderedFields][comment][comments] for HTML; fall back to fields[comment][comments] raw text if null"
    - "ISO 8601 dates sort lexicographically — no parsing needed for chronological comment ordering"

key-files:
  created: []
  modified:
    - src-tauri/src/mock_server.rs
    - src-tauri/src/commands.rs

key-decisions:
  - "Attachment loop placed after add_remotelink step so issue exists with description before binary uploads"
  - "Comment loop reads from renderedFields.comment.comments (HTML) and falls back to fields.comment.comments (plain text)"
  - "Worklogs fetched from source v2 API independently (not part of source issue fields) to match Jira Server API shape"
  - "add_worklog mock uses subsec_nanos for ID uniqueness — rand crate not present in Cargo.toml"

patterns-established:
  - "CopyStepResult partial-success model: each attachment/comment/worklog failure is independent, does not abort pipeline"
  - "ADF description footer appended in-place before PUT — subtasks and issuelinks appended as h3 + bulletList nodes"

requirements-completed: [COPY-02, COPY-03, COPY-04, COPY-05, COPY-06]

duration: 25min
completed: 2026-03-22
---

# Phase 05 Plan 01: Extend copy_ticket with Attachments, Comments, Worklogs, and Description Footer

**Rust copy_ticket pipeline extended to transfer binary attachments, HTML comments (htmltoadf with bold attribution), worklogs, and sub-task/linked-issue ADF footers; mock server updated with renderedFields.comment and POST worklog support**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-22T23:54:00Z
- **Completed:** 2026-03-22T23:58:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Mock server v2::get_issue now returns `renderedFields.comment.comments` with HTML-wrapped bodies (`<p>text</p>`) so copy_ticket can read rendered HTML for each comment
- Mock server v3 now accepts `POST /rest/api/3/issue/{key}/worklog` returning 201, enabling worklog copy loop to work against the mock
- `copy_ticket` description ADF is now extended with Sub-tasks (h3 + bulletList) and Linked Issues (h3 + bulletList) sections before the PUT, implementing COPY-05 and COPY-06
- Attachment binary copy loop downloads each source attachment with Server PAT and uploads to Cloud target using multipart with X-Atlassian-Token header, producing `attach:{filename}` step results
- Comment copy loop iterates sorted-by-created comments, converts HTML to ADF via htmltoadf, prepends bold attribution paragraph, and posts to Cloud v3 comment endpoint
- Worklog copy loop fetches source worklogs from v2 API, posts each to Cloud v3 with timeSpentSeconds, started, and bold attribution ADF comment

## Task Commits

1. **Task 1: Extend mock server** — `61f3420` (feat)
2. **Task 2: Extend copy_ticket** — `467f4a0` (feat)

## Files Created/Modified

- `src-tauri/src/mock_server.rs` — v2::get_issue renderedFields extended with comment.comments; v3 add_worklog handler added; v3 router POST worklog route registered
- `src-tauri/src/commands.rs` — copy_ticket extended with 4 new sections: description footer (sub-tasks + linked issues), attachment loop, comment loop, worklog loop

## Decisions Made

- **add_worklog ID uniqueness:** `rand` crate not present in Cargo.toml. Used `std::time::SystemTime::now().subsec_nanos()` for sufficient uniqueness in mock context.
- **Comment sort:** ISO 8601 dates sort lexicographically = chronologically, so `a_date.cmp(b_date)` is sufficient without date parsing.
- **Attachment loop position:** Placed after `add_remotelink` step (after Step 8) so the issue exists and has its final description before binary uploads begin.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Backend copy pipeline is complete: description (with footer), inline images, binary attachments, comments, and worklogs all transfer in a single `copy_ticket` call
- Step names (`attach:*`, `comment:*`, `worklog:*`) are stable and ready to be consumed by the UI progress display in plan 05-02
- All 9 existing tests pass; no regressions

---
*Phase: 05-copy-attachments-and-comments*
*Completed: 2026-03-22*
