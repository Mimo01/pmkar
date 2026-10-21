---
status: resolved
trigger: "There is a problem if a link already exists and the story is in 'new'. There is no relink button, only a copy that opens a copy preview which I am unable to submit (that is correct)"
created: 2026-10-21
updated: 2026-10-21
---

## Current Focus
hypothesis: Phase 37.1 confirm-before-moving guard (changed-during-confirmation) compares a snapshot/fingerprint that is stale or differently shaped for new/seen entries with a copied_key, so relink via the new Link button always fails.
test: trace Link button -> restoreLink -> confirm dialog -> triageActions -> backend; find where the "changed during confirmation" check is computed and what it compares
expecting: mismatch between snapshot taken at confirm-open and state compared at submit (or backend expecting different fields) for new/seen entries
next_action: locate the guard and the snapshot/fingerprint code

## Symptoms
expected: When a ticket already has a link (to a counterpart ticket) and the story is in status 'new', a Relink action should be available (or the UI should otherwise offer a sensible way forward).
actual: Only a Copy action is shown; it opens a copy preview that cannot be submitted (submit being blocked is correct behavior because a link already exists).
errors: none reported
timeline: unknown; noticed recently (after Phase 37.x linked/watched/copy changes)
reproduction: Open a ticket detail that already has a link to a counterpart and whose status is 'new'; observe action buttons (no Relink, only Copy).

## Eliminated

## Evidence
- timestamp: 2026-10-21 (round 1 fix verification, human)
  finding: Previous fix (rememberedKey for new/seen + "Link to KEY" button) FAILED in running app. Link button now appears, but clicking it shows toast (SK) "Tiket PROJ-34 sa zmenil počas potvrdzovania. Nič sa nepresunulo." (EN: "Ticket PROJ-34 changed during confirmation. Nothing was moved."). This is the Phase 37.1 stale/changed-during-confirmation guard firing on relink.

## Resolution
root_cause: (round 1, incomplete) rememberedKey in useTriageDetailActions was only set for ignored/watched, so a new/seen entry that still has copied_key fell into the default branch showing Copy; Copy preview then refuses (ensure_not_linked). Round 2: the stale-guard fires on relink for new/seen entries - not yet determined.
fix: round 1 applied (Link button shown); round 2 pending
verification: round 1 failed human verification
files_changed: [src/features/tickets/useTriageDetailActions.ts, TicketDetailPanel.tsx, TicketDetailPage.tsx, __tests__/useTriageDetailActions.test.tsx]

## Round 2
root_cause: onResolve link branch in useTriageDetailActions.ts only accepted state ignored/watched as non-stale. Round 1 made requestLink open the confirm dialog for seen/new entries with copied_key, so on Confirm the guard saw state 'seen' and called notifyStale (triage.confirm.stale toast), never invoking relink_ticket. Backend/Rust not involved.
fix: guard now stale only if entry missing, state copied/handled, or copiedKey changed (same eligibility as rememberedKey).
verification: tsc clean; full vitest 1927 pass; new test 'relink from seen (new)...' fails with old guard, passes with fix. Stale-from-Watched test now flips to 'copied'.
files_changed: [src/features/tickets/useTriageDetailActions.ts, TicketDetailPanel.tsx, TicketDetailPage.tsx, __tests__/useTriageDetailActions.test.tsx]
