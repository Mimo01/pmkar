---
status: resolved
trigger: "I cant mark a new ticket as watched, there is no button for it"
created: 2026-10-21
updated: 2026-10-21
---

## Current Focus
hypothesis: (none yet) Phase 37.2 introduced Watched as a third non-linked triage state; the Watch action is probably gated on a condition that excludes "new" tickets
test: locate the Watch button/action in the ticket detail + triage UI and its visibility conditions
expecting: a condition on triage state / linked status hiding the button for new tickets
next_action: gather initial evidence

## Symptoms
expected: A new (untriaged) ticket offers an explicit labelled "Watch" button in detail (see feedback: explicit labelled buttons, one entry point per action)
actual: No button to mark a new ticket as watched
errors: none reported
timeline: unknown; Phase 37.2 (watched main category) recently added
reproduction: open a new ticket in the app, look for a Watch action

## Eliminated

## Evidence

## Resolution
root_cause: Phase 37.2 rendered the Watch button only for Linked and Dismissed tickets; the New branch had no button and requestWatch ignored new tickets. Tests asserted New never shows Watch.
fix: Added labelled Watch button (with tooltip) for New tickets in TicketDetailPage and TicketDetailPanel; requestWatch moves New straight to watched without confirmation.
verification: tsc clean, 819 tests in src/features/tickets pass; user approved 2026-10-21.
files_changed: [src/features/tickets/TicketDetailPage.tsx, src/features/tickets/TicketDetailPanel.tsx, src/features/tickets/useTriageDetailActions.ts, src/features/tickets/TicketDetailPanel.test.tsx, src/features/tickets/__tests__/TicketDetailPage.test.tsx]
