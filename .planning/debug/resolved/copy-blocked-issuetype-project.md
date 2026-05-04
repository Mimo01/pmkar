---
slug: copy-blocked-issuetype-project
status: resolved
trigger: "Can't copy some stories — Copy button permanently blocked. Screenshots show Typ úlohy (issuetype) and Projekt (project) as required gap fields with UnsupportedFieldHint and no way to fill them."
created: 2026-05-03
updated: 2026-05-03
---

# Debug Session: copy-blocked-issuetype-project

## Symptoms

- expected: Copy button enabled once non-pipeline fields are satisfied
- actual: Copy button permanently disabled; tooltip listed "Typ úlohy, Projekt" as missing fields
- scope: Only affects issue types whose createmeta lists `issuetype` and/or `project` as required
- timeline: Emerged after Phase 22 gap-fields work; copy log from earlier attempts showed successful copies of other story types
- reproduction: Open copy dialog for a story in a project/issue-type config where createmeta returns issuetype or project as required — no mapping configured for them

## Current Focus

hypothesis: "computeGapFields excluded only summary; issuetype and project slipped through as non-editable gaps that could never be filled"
test: "Code inspection confirmed copy_ticket_v2 always injects both fields (commands.rs:1530-1537)"
expecting: "Excluding issuetype and project from PIPELINE_MANAGED_FIELDS removes them from gapFields, unblocking the Copy button"
next_action: "resolved"

## Evidence

- timestamp: 2026-05-03
  type: code_read
  note: "copy_ticket_v2 (commands.rs:1530-1537) forcefully inserts project and issuetype into create_fields — they are never sourced from the mapping pipeline"

- timestamp: 2026-05-03
  type: code_read
  note: "computeGapFields.ts excluded only summary; issuetype and project passed all four gap conditions and landed in gapFields"

- timestamp: 2026-05-03
  type: code_read
  note: "GapsSection renders UnsupportedFieldHint for non-editable schema types (isEditableSchemaType returns false for issuetype/project); no input means isOverrideValueFilled can never return true"

- timestamp: 2026-05-03
  type: hypothesis_confirmed
  note: "unfilledGapFields always contained issuetype and/or project → isGated=true → isCopyDisabled=true permanently"

- timestamp: 2026-05-03
  type: fix_applied
  note: "Added issuetype and project to PIPELINE_MANAGED_FIELDS set in computeGapFields.ts; 3 new unit tests added; 11/11 pass"

## Eliminated

- Regression from isOverrideValueFilled fix (17d8fcd) — unrelated; that fix was for editable gap fields
- SQLite mapping rows — correct; the fields simply had no mapping and createmeta listed them required
- Backend copy failure — backend never had an issue; blocking was purely frontend gate

## Resolution

root_cause: "computeGapFields.ts only excluded summary from the required-field gate. The target createmeta for certain issue type configurations lists issuetype and project as required. Since their schema types are non-editable, GapsSection rendered UnsupportedFieldHint with no input, isOverrideValueFilled always returned false, and unfilledGapFields permanently contained them — keeping isGated=true. The backend (copy_ticket_v2) always injects both fields unconditionally, so they were never genuine gaps."
fix: "Added issuetype and project to PIPELINE_MANAGED_FIELDS constant in computeGapFields.ts alongside summary. All three are injected by the copy pipeline and must never gate the Copy button."
verification: "11 computeGapFields unit tests pass including 3 new cases for issuetype/project exclusion."
files_changed:
  - src/features/tickets/computeGapFields.ts
  - src/features/tickets/__tests__/computeGapFields.test.ts
