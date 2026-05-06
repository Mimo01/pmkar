---
status: complete
---

# Quick Task 260506-fju Summary

**Task:** Add way more data to dev server so I can more easily test things

## What was done

Expanded `src-tauri/src/fixtures.rs` with 24 new mock issues and 2 new test users.

### New users added

| v2 name | v3 accountId | Display name |
|---------|-------------|--------------|
| `aliu` | `acc-aliu` | Alex Liu |
| `mramos` | `acc-mramos` | Maria Ramos |

### Issues added (PROJ-17 through PROJ-40)

| Key | Type | Status | Priority | Assignee | Notes |
|-----|------|--------|----------|----------|-------|
| PROJ-17 | Bug | Open | Critical | Alex Liu | Payment gateway silent failure |
| PROJ-18 | Task | In Progress | High | Maria Ramos | Audit log CSV export, 2 comments |
| PROJ-19 | Story | Open | Medium | Alex Liu | JQL presets |
| PROJ-20 | Bug | Resolved | Medium | Chris Smith | Stale data after sync |
| PROJ-21 | Task | Open | Low | Bob Wilson | Rust edition 2024 upgrade |
| PROJ-22 | Bug | In Progress | High | Jane Doe | Inline images in copy, with attachment |
| PROJ-23 | Story | In Progress | High | Maria Ramos | Bulk copy, 3 subtasks |
| PROJ-24 | Task | In Progress | Medium | Alex Liu | Subtask of PROJ-23 |
| PROJ-25 | Task | Open | Medium | Bob Wilson | Subtask of PROJ-23 |
| PROJ-26 | Task | Open | Low | Chris Smith | Subtask of PROJ-23 |
| PROJ-27 | Bug | Closed | Low | Maria Ramos | Null description edge case |
| PROJ-28 | Bug | Reopened | High | Alex Liu | Field mapping persistence, issue link |
| PROJ-29 | Task | Open | Medium | Bob Wilson | Relates to PROJ-28 |
| PROJ-30 | Epic | In Progress | High | Jane Doe | v0.5.0 planning epic |
| PROJ-31 | Bug | Open | Critical | (unassigned) | Config corruption crash |
| PROJ-32 | Task | Resolved | Medium | Chris Smith | Keyboard shortcut |
| PROJ-33 | Bug | Open | High | Bob Wilson | Archived projects in dropdown, 3 comments |
| PROJ-34 | Story | Open | Medium | Jane Doe | Copy history in detail view |
| PROJ-35 | Task | In Progress | Medium | Alex Liu | JQL OR conditions, worklog |
| PROJ-36 | Bug | Open | Medium | Maria Ramos | Settings scroll on small viewports |
| PROJ-37 | Task | Open | Low | Jane Doe | User guide documentation |
| PROJ-38 | Bug | In Progress | High | Chris Smith | Window size persistence, issue link |
| PROJ-39 | Story | Open | Low | Bob Wilson | Recently copied quick-access |
| PROJ-40 | Bug | Open | High | Maria Ramos | Null description + empty labels edge case |

### Before → After

- Issues: 16 → 40
- Named users: 3 → 5
- `next_issue_id`: 10017 → 10041

## Commit

4a383fc
