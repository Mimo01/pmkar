# Quick 261021-m26 - Research

**Researched:** 2026-10-21 | **Confidence:** HIGH (all codebase-verified)

## User Constraints
Locked in 261021-m26-CONTEXT.md: relations block at top of OverviewTab (above Description); clickable explicit rows; both Page and Panel; use `fields.parent`/`fields.subtasks` (no extra requests); add `parent` to `JiraTicketDetail` and `OVERVIEW_BESPOKE_FIELDS`; mock fixtures show it; SK term "tiket"; no drag and drop.

## Findings

### 1. Opening a ticket's detail
- There is no router. `App.tsx:123` holds `detailTicketKey`; `App.tsx:148-153` has an effect that sets it (and `showDetail`) whenever `useTicketStore.selectedTicketKey` changes. `ticketStore.ts:68,189`: `selectTicket(key)` is `set({ selectedTicketKey: key })`.
- Only `TicketDetailPage` is mounted in the app (`App.tsx:273`, keyed by `issueKey` prop). `TicketDetailPanel` is not mounted by any non-test file, so it is dead or legacy code, but it still renders OverviewTab (`TicketDetailPanel.tsx:542`; Page at `TicketDetailPage.tsx:517`).
- Recommended: OverviewTab calls `useTicketStore.getState().selectTicket(key)` directly. Both contexts then behave the same, and no new prop is needed. Confirm that `TicketDetailPage` refetches when `issueKey` changes. It takes `issueKey` as a prop and fetches into local `detail` state. Check that its fetch effect depends on `issueKey` and resets `activeTab` to 'overview'. The `key={...}` at line 492 is for tabs, not the page. If the effect does not depend on `issueKey`, add `key={detailTicketKey}` at `App.tsx:273`.
- Caveat: `handleDetailBack` clears the selection and returns to the list, so back goes to the list, not the previous ticket. That is acceptable for a quick task.
- Related tickets may not be in the ticket store, but `selectTicket` only needs a key. The detail view fetches by key.

### 2. AllFieldsSection and `parent`
- `AllFieldsSection.tsx` has no `parent` or `subtask` handling. Fields are rendered generically from the `fields` record. The skip list is applied at `AllFieldsSection.tsx:137-138` (`skip?.includes(fieldId)`).
- Adding `'parent'` to `OVERVIEW_BESPOKE_FIELDS` (`OverviewTab.tsx:14-24`) is sufficient. Without it, `parent` would render as a generic object field.
- Types: `types.ts:58` defines `JiraSubTask {key, fields:{summary,status}}`. Add `parent?: { key: string; fields: { summary: string; status: JiraStatus } }` to `JiraTicketDetail.fields` (`types.ts` ~line 128, next to `subtasks`). Make it optional because the real Jira response omits it for non-sub-tasks and old cached details lack it.
- Real Jira `parent.fields` also carries `issuetype` and `priority`. Both are ignored here.

### 3. OverviewTab changes
- The Sub-tasks block (`OverviewTab.tsx:50-62`) is currently below Description. Its rows are non-clickable divs.
- Linked Issues (`:90-126`) uses the row style `flex items-center gap-2.5 py-1.5 px-3 rounded-md hover:bg-brand-surface-hover`, a key chip `text-xs font-semibold font-mono text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded`, then truncated summary and `StatusBadge`. Reuse that style.
- Make the rows `<button type="button" className="w-full text-left ...">` so they are keyboard-accessible. Use a shared small `RelatedRow` component for the parent and each sub-task.
- Existing section labels ("Description", "Sub-tasks", "Linked Issues") are hardcoded English. The Overview tab has no `useTranslation` today. For the new headings, add i18n keys (Parent, Sub-tasks) and use `useTranslation`. Either translate the existing "Sub-tasks" heading when it is moved, or leave the others alone.

### 4. i18n
- Files: `src/i18n/locales/en.json` and `sk.json`. They are flat, dotted keys (e.g. `detail.tab.overview` at line 92 and `detail.back` at line 319 in both).
- Add `detail.parent` / `detail.subtasks` (pick a prefix like `detail.relations.*`). SK: "Nadradený tiket", "Podúlohy" is wrong. Use "Podtikety" or "Pod-tikety". `detailLocale.test.ts` forbids `/úloh/i` in SK keys listed in its NEW_KEYS and uses "tiket" for the ticket noun. Avoid "úloh" anywhere, so use "Nadradený tiket" and "Podtikety".
- Guards: `src/i18n/__tests__/detailLocale.test.ts` (non-empty in EN and SK, no "úloh", SK uses "tiket"). Extend its `NEW_KEYS` with the new keys. Add a "tiket" assertion for the parent key. There are also `groupLocale.test.ts` and `confirmLocale.test.ts`, which are not relevant here.
- If a parity test between en.json and sk.json exists elsewhere, run the full `src/i18n/__tests__` folder.

### 5. Mock fixtures (`src-tauri/src/fixtures.rs`)
- Subtasks are already modeled on parents:
  - PROJ-1 -> PROJ-7, PROJ-8 (`fixtures.rs:392-398`, `:462`, `:496`)
  - PROJ-9 -> PROJ-10, PROJ-11 (`:1267-1272`)
  - PROJ-23 -> PROJ-24, PROJ-25 (`:2467-2473`)
- The parent-side half is already visible in mock mode. No `"parent"` key exists anywhere in `fixtures.rs` (grep `"parent"` returned 0 hits).
- Minimal change: add a `"parent"` field to the v2 and v3 JSON of one sub-task. PROJ-7 is the best choice (v2 block ~`:1119`, v3 ~`:1153`, next to `"issuetype"`; those are currently `"Task"`). Use this shape:
  `"parent": { "key": "PROJ-1", "fields": { "summary": <PROJ-1 summary>, "status": v2_status(...) } }`
  For v3 use `v3_status("In Progress","indeterminate")`. Optionally change PROJ-7's issuetype to a Sub-task type, but that risks other mock scenarios or tests, so skip it. Optionally add the same to PROJ-8 (~`:1202`/`:1236`) and PROJ-24/25.
- Check for PROJ-1's summary text in `fixtures.rs` around `:385-395`.
- `mock_server.rs:384,738` are the create-issue responses with `"subtasks": []`. No change is needed.
- Rust tests that snapshot fixtures: grep `src-tauri` tests for PROJ-7 before editing, in case something asserts the exact fields. Run `cargo test -p` for the crate (check Cargo.lock is dirty, which is unrelated).

### 6. Tests to extend
- `src/features/tickets/__tests__/OverviewTab.test.tsx`:
  - `makeDetail(overrides)` at lines 78-96 takes `Partial<JiraTicketDetail['fields']>`, so `parent` can be passed through overrides once the type has it.
  - The existing 'renders subtasks when present' test is at `:155`.
  - The schema cache is mocked at the top of the file.
  - Add tests: renders parent row with key, summary and status; parent is not duplicated by AllFieldsSection (assert `getAllByText('PROJ-1')` has length 1); no Parent block when `parent` is absent; clicking a sub-task row calls `useTicketStore.getState().selectTicket` with its key (spy via `vi.spyOn(useTicketStore.getState(), 'selectTicket')`, or reset state and assert `selectedTicketKey`); the relations block precedes the Description label (`compareDocumentPosition`).
  - The rendered text will now be i18n'd. Check whether the test setup initialises i18next (see `TicketDetailPage.test.tsx` and `src/test` setup) and use the EN text.
- Also run `TicketDetailPage.test.tsx`, `TicketDetailPanel.test.tsx` and `a11y.triage.keyboard.test.tsx`, which render OverviewTab. The a11y keyboard test may count focusable elements or tab order, so new buttons could affect it.

## Pitfalls
- A real Jira sub-task's `parent` has the key only. Guard against missing `fields` with `parent.fields?.summary`.
- Do not return `?? []` in a Zustand selector (project memory). Use `getState().selectTicket` in the click handler instead.
- Linked Issues rows should stay as they are (out of scope).

## Environment
No new dependencies and no external tools needed. Frontend: vitest. Backend: cargo tests for the fixtures.

## Assumptions
- A1: The detail page refetches on an `issueKey` prop change (the fetch effect was not read in full). Verify at plan time.
- A2: The test harness initialises i18n with EN (not verified).
