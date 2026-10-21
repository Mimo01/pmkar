---
phase: quick-261021-m26
verified: 2026-10-21
status: human_needed
score: 7/7 must-haves verified
---

# Quick 261021-m26 Verification

**Goal:** Ticket detail shows all sub-tasks or the parent. List cards show the parent or all sub-tasks at a glance.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Detail Overview shows a Parent block above Description | VERIFIED | OverviewTab.tsx renders the relations section (lines 45-62) before the Description heading (line 71) |
| 2 | Detail Overview lists ALL sub-tasks above Description | VERIFIED | `subtasks.map` renders a RelatedTicketRow for each, with no slicing |
| 3 | Clicking a relation row opens that ticket | VERIFIED | RelatedTicketRow is a button that calls `useTicketStore.getState().selectTicket(key)`. The plan confirmed the refetch effect depends on issueKey. |
| 4 | `parent` is not rendered twice | VERIFIED | `'parent'` is in OVERVIEW_BESPOKE_FIELDS (line 19), and a test covers it |
| 5 | Cards always show the parent or all sub-tasks, with no toggle | VERIFIED | TicketCard.tsx lines 154-182 render them unconditionally when present |
| 6 | A relation row click opens the related ticket without triggering the card click. Select mode still works. | VERIFIED | The wrapper and row both call stopPropagation. The rows become non-interactive divs in selectMode, and the wrapper loses pointer-events-auto. |
| 7 | Mock mode shows PROJ-1 -> PROJ-7/8 and PROJ-7/8 -> PROJ-1 | VERIFIED | fixtures.rs has 4 `"parent"` entries (PROJ-7 and PROJ-8, v2 and v3). PROJ-1 already had `subtasks`. The mock search returns full fields. |

## Other checks

- Both search URLs contain `fixVersions,subtasks,parent` (1 match each in commands.rs and jira_client.rs).
- Types: `JiraRelatedIssue` plus optional `parent`/`subtasks` are in types.ts.
- i18n: EN and SK have all 5 keys. SK uses "tiket" and has no "úloh".
- Sparse data is handled with optional chaining (`fields?.summary`, `subtasks?.length`).
- `npx vitest run src/features/tickets src/features/groups src/i18n/__tests__` passes: 87 files, 1459 tests.
- `tsc --noEmit` is clean. Biome is clean on the 3 modified source files (the 9 warnings are elsewhere).
- I did not run `cargo test` (the fixture and URL changes are string-level, and the grep checks pass).

## Human verification

1. **Mock-mode visual check (WebView2).** Open PROJ-1 and PROJ-7 in the list and in detail.
   Expected:
   - PROJ-1 shows PROJ-7 and PROJ-8 in both list and detail.
   - PROJ-7 shows PROJ-1 in both.
   - Clicking a relation row switches the detail to that ticket.
   - Clicking the card body still opens the card's own ticket.

   Why human: visual layout and the pointer-events overlay behavior cannot be confirmed by grep or jsdom.

## Gaps

None.
