---
status: resolved
trigger: "In settings there is a text 'Tikety priradené vám, kde ste zmienený, alebo ktoré sledujete'. We have recently changed 'mine' to be only tickets where I am assignee or where I am watcher"
slug: settings-mine-filter-stale-text
created: 2026-05-06
updated: 2026-05-06
---

## Symptoms

- expected: Settings description text reflects current 'mine' filter behavior (assignee + watcher only)
- actual: Settings text still read 'Tikety priradené vám, kde ste zmienený, alebo ktoré sledujete' — includes 'kde ste zmienený' (where you are mentioned) which is no longer part of the filter
- errors: none
- timeline: After recent change to 'mine' filter behavior (assignee + watcher only)
- reproduction: Open settings, observe the description text for the 'mine' ticket filter section

## Scope

- Fix stale settings description text (remove 'kde ste zmienený' clause)
- Verify filter logic in backend/frontend does NOT still include 'mentioned' tickets

## Current Focus

hypothesis: "Stale i18n text only — filter logic already correct"
test: "Verified buildMineBatchJql in TicketListPage.tsx"
expecting: "JQL = assignee OR watchedIssues, no mention clause"
next_action: "done"
reasoning_checkpoint: "Filter logic was already updated (line 30: assignee = currentUser OR issueKey in watchedIssues()). Only the description strings in both locales were stale."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-06
  file: src/features/tickets/TicketListPage.tsx
  line: 30
  note: "buildMineBatchJql uses 'assignee = currentUser OR issueKey in watchedIssues()' — no mentioned clause. Filter logic is correct."

- timestamp: 2026-05-06
  file: src/i18n/locales/en.json
  line: 50
  note: "Was: 'Tickets assigned to you, where you're mentioned, or that you're watching'. Stale — mentioned clause still present."

- timestamp: 2026-05-06
  file: src/i18n/locales/sk.json
  line: 50
  note: "Was: 'Tikety priradené vám, kde ste zmienený, alebo ktoré sledujete'. Stale — kde ste zmienený clause still present."

## Eliminated

- Backend filter logic — TicketListPage.tsx buildMineBatchJql already excludes mentioned; only assignee + watcher
- Any Rust/backend JQL build — no backend JQL construction found referencing mentioned

## Resolution

root_cause: "i18n description strings for settings.preset.mine.desc in both en.json and sk.json were not updated when the mine filter logic was changed to assignee + watcher only"
fix: "Removed 'where you're mentioned' clause from en.json and 'kde ste zmienený' clause from sk.json. Both now read: assignee or watching only."
verification: "grep confirms new values in both files; filter logic in TicketListPage.tsx was already correct and required no change"
files_changed:
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
