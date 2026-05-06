---
quick_id: 260506-fju
slug: add-way-more-data-to-dev-server-so-i-can
description: Add way more data to dev server so I can more easily test things
date: 2026-05-06
---

# Quick Task 260506-fju: Add way more data to dev server so I can more easily test things

## Goal

Expand `src-tauri/src/fixtures.rs` with substantially more mock issues and an extra test user, making it easier to test ticket list browsing, filtering, pagination, and copy flows in dev mode.

## Current State

- 16 issues: PROJ-1 through PROJ-16
- 3 named users: jdoe (Jane Doe), csmith (Chris Smith), bwilson (Bob Wilson) + 2 privacy accounts
- `next_issue_id`: 10017

## Plan

### Task 1: Add 2 new test users to v2_user / v3_user helpers

Add `aliu`/`acc-aliu` (Alex Liu) and `mramos`/`acc-mramos` (Maria Ramos) to the match arms in `v2_user()` and `v3_user()` helpers so they get emails and avatars.

### Task 2: Add PROJ-17 through PROJ-40 (24 new issues)

Add 24 issues covering:
- Mix of all issue types: Bug, Task, Story, Epic
- All statuses: Open, In Progress, Resolved, Closed, Reopened
- All priorities: Critical, High, Medium, Low
- Assigned to all 5 named users (jdoe, csmith, bwilson, aliu, mramos)
- Some with issue links, subtasks, attachments, comments
- Some with null/unassigned assignee
- Some with empty description
- A few with richer text (multi-sentence descriptions)
- Update `next_issue_id` to 10041

Files: `src-tauri/src/fixtures.rs`
Action: Add new user match arms + 24 new issues in `build_fixtures()`
Verify: `cargo check` passes; `grep -c 'v2.insert\|v3.insert' src-tauri/src/fixtures.rs` shows 80 insertions (40 × 2)
Done: cargo check succeeds
