# Research Summary: v0.5.1 Re-triage

## Executive Summary

v0.5.1 lets a user deny a Linked ticket and later restore the same Cloud key with Link. It is a small extension of the existing triage state machine. The backend already keeps `copied_key` across state changes (`set_triage` never clears it), so there are no new dependencies, no schema change and no new triage state.

Deny reuses `set_triage_state('ignored')`. Re-link needs one new atomic command, `relink_ticket`: `UPDATE triage_state SET state='copied' WHERE ticket_key=? AND copied_key IS NOT NULL`, returning the key or `None` (frontend then opens the copy preview).

The real risk is the frontend: every optimistic handler writes `copiedKey: null`, so store and DB disagree. Fix by centralizing transitions in `triageActions.ts`, preserving the key with `{...prev, state}`, and routing both detail components through the shared actions.

## Key Findings

- **Stack:** no new libraries, no schema/CHECK change. `set_triage_state` should reject `'copied'` so a Linked row never has a NULL key.
- **Features:** Deny button on Linked detail; Link on denied ticket (restore if key exists, else copy preview). Anti-features: bulk, hover icons, DnD, deleting/closing the Cloud issue, clearing the key on deny.
- **Architecture:** hydration already returns `copied_key` for every row. Tab predicates and group badges depend only on `state`, so they follow automatically; add transition coverage to the parity tests.
- **Pitfalls:**
  - `fetch_tickets` hard-deletes the triage row (and key) for done tickets; keep rows that have a link.
  - `copy_ticket_v2` has no idempotency guard, so "Restore" to New then Copy would create a duplicate Cloud issue; add an already-linked guard.
  - Poll/notifications ignore triage state (leave as is, document).
  - Zustand `?? []` selector loop; EN/SK "tiket" guards; WebView2 focus loss when a focused button unmounts.

## Suggested Phases

1. **Backend contract and mock:** `relink_ticket`, `'copied'` rejection, done-cleanup keeps linked rows, `copy_ticket_v2` already-linked guard, mock fixture, Rust tests.
2. **Shared frontend actions:** `denyLinkedTicket`, `relinkTicket`, key-preserving `restoreTicket`, Panel/Page routed through shared actions.
3. **Detail and group UI + i18n:** button matrix by state and remembered link, "previously linked" hint, focus handling, EN/SK strings.
4. **Consistency, a11y, UAT:** transition parity tests, WebView2 checklist.

## Open Decisions

- Denied target state: `ignored` (default, matches existing Not mine).
- Cloud existence check on re-link: local-first; defer unless the user wants it.
- Restore-to-New with retained key: keep the key.

## Confidence

Overall HIGH for the core feature (code-read); MEDIUM for Cloud-verification edge cases.
