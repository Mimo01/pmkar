# Phase 34: Link Integrity Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 34-link-integrity-backend
**Areas discussed:** Re-link command contract, Rejecting 'copied' in set_triage_state, Duplicate-copy guard, Done-ticket cleanup, Older data

---

## Re-link command contract

| Option | Description | Selected |
|--------|-------------|----------|
| Ok(None) when no link | Not an error; frontend opens copy preview | ✓ |
| Typed error | Frontend must catch and branch | |
| Idempotent on already-Linked: return key | Harmless double-click | ✓ |
| Error on already-Linked | Strict | |
| Any state with a key | Single UPDATE WHERE copied_key IS NOT NULL | ✓ |
| Only from 'ignored' | Tighter | |

**User's choice:** Recommended options for all three.

---

## Rejecting 'copied' in set_triage_state

| Option | Description | Selected |
|--------|-------------|----------|
| Return an error | Fail loudly | ✓ |
| Silent no-op | Hides bugs | |
| Both layers (command + set_triage) | No bypass for Rust callers | ✓ |
| Command only | Smaller change | |

**User's choice:** Recommended options.

---

## Duplicate-copy guard

| Option | Description | Selected |
|--------|-------------|----------|
| copied_key IS NOT NULL | Any state | you decide → this |
| state = 'copied' only | Misses restore-to-New | |
| Guard first, before any Jira call | Cheap refusal | you decide → this |
| Just before create-issue | More work first | |
| Error carrying existing key | UI can say "already linked to KEY" | ✓ |
| Generic error | No key | |
| No override | Matches LINT-03 | ✓ |
| Force flag | New capability | |

**User's choice:** Error with key, no override; "you decide" on rule and placement.
**Notes:** Claude's discretion resolved to the recommended options.

---

## Done-ticket cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the whole row | Skip deletion when key present | ✓ |
| Keep only the key | Adds a state change | |
| Rule in delete_triage_entries | Protects fetch and delete_done_triage | ✓ |
| Only in fetch_tickets | delete_done_triage can wipe links | |

**User's choice:** Recommended options.

---

## Older data

| Option | Description | Selected |
|--------|-------------|----------|
| No migration; relink returns None for gaps | Keyed rows just work | ✓ |
| Startup audit + report | Extra scope | |
| Recover from audit log | Unreliable, no source key | |
| Old-shape DB test | Seed old schema, migrate, assert | ✓ |
| Code review only | | |

**User's choice:** Free-text requirement: previously linked stories must be re-linkable. Recommended options for both follow-ups.
**Notes:** Rows since Phase 4 carry copied_key and deny never clears it. Keyless Linked rows and already-cleaned-up done tickets are accepted gaps.

---

## Claude's Discretion

- Guard condition and placement (user said "you decide").
- Error wording, AppError variant, mock fixture shape.

## Deferred Ideas

- Cloud existence check on re-link
- Force re-copy override
- Startup report of keyless Linked rows
