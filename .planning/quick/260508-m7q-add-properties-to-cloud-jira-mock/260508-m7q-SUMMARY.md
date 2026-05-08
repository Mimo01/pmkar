---
quick_id: 260508-m7q
status: complete
---

# Summary: Add more properties to cloud jira mock

## What was done

Added 10 standard Jira fields to all 16 mock issues (PROJ-1 through PROJ-16) in both v2 and v3 fixture blocks, inspired by a real v2 ticket from scratch_2.txt.

## Fields added per issue

| Field | Example value |
|-------|--------------|
| `lastViewed` | `"2026-05-08T09:00:00.000+0000"` |
| `resolutiondate` | `null` (open) / date string (resolved/closed) |
| `duedate` | `null` or date string (bugs with urgency, milestoned stories) |
| `environment` | `null` or `"Production"` (production bugs) |
| `watches` | `{ "watchCount": N, "isWatching": false }` |
| `votes` | `{ "votes": N, "hasVoted": false }` |
| `progress` | `{ "progress": N, "total": N }` |
| `timeoriginalestimate` | `null` or integer seconds |
| `aggregatetimeoriginalestimate` | `null` or integer seconds |
| `timetracking` | `{}` or full object with estimates |

## Values are contextually appropriate

- Resolved/Closed issues: `resolutiondate` set, `progress` = 100%
- Production bugs: `environment = "Production"`, higher `watchCount`
- Issues with worklogs: `timetracking` fully populated, `progress` reflects time logged
- Open issues: `resolutiondate = null`, `progress = { 0, 0 }`

## Files changed

- `src-tauri/src/fixtures.rs` — 16 issues × 2 API variants (v2 + v3) updated
