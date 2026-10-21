---
status: awaiting_human_verify
trigger: "When I have already linked a ticket and it is currently in denied, restoring it puts it into 'new', not already linked with the link restored"
created: 2026-10-21
updated: 2026-10-21
---

## Current Focus

hypothesis: Restore (restoreTicket) is deliberately 'seen'/New keeping copiedKey; relink is a separate 'Restore link' action. Not a code defect but a design/UX conflict.
test: tried making restoreTicket relink when copiedKey exists (reverted)
expecting: n/a
next_action: await user decision (A: Restore relinks when key remembered; B: keep, expose Restore link on list rows)

## Symptoms

expected: Restoring a denied ticket that was already linked returns it to the "already linked" state with its link restored.
actual: Restoring puts the ticket into "new" with no link.
errors: none reported
timeline: unknown
reproduction: Link a ticket, move/deny it so it is in the denied list, restore it.

## Evidence

- checked: triageActions.restoreTicket, triageConsistency.test 'restore moves handled and ignored tickets to New', a11y.triage.keyboard tests
  found: restoreTicket -> set_triage_state 'seen' keeping copiedKey (D-09) by design; detail view has separate 'Restore link' (relink_ticket). List rows (IgnoredTicketsPage, GroupViewPage) offer only plain Restore. Making Restore relink broke 5 tests encoding the deliberate behavior.
  implication: needs product decision

## Eliminated

## Resolution

root_cause: restoreTicket always wrote 'seen' (D-09), dropping the link state for denied tickets with a remembered Cloud key.
fix: restoreTicket relinks (relink_ticket -> copied) for ignored tickets with copiedKey; falls back to seen on failure. Detail hook focuses Linked badge after relink restore.
verification: src/features vitest 1687 pass; new tests for relink and fallback.
files_changed: [src/features/tickets/triageActions.ts, src/features/tickets/useTriageDetailActions.ts, tests]
