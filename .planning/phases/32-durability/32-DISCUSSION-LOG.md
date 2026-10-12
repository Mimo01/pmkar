# Phase 32: Durability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 32-durability
**Areas discussed:** Resolved (Done) members, Missing card look & Remove, Remove all missing, Gating edge cases

---

## Resolved (Done) members

| Option | Description | Selected |
|--------|-------------|----------|
| Look up missing by key | After a complete fetch, run a `key in (...)` query on absent members to refresh their status | (picked first, then rejected) |
| Treat as missing | Dimmed with the hint; the snapshot keeps the last-seen status | ✓ |
| Missing + explaining hint | Same behaviour, with "may be resolved or out of scope" copy | |

**User's choice:** Treat as missing.
**Notes:** The user first accepted the key lookup, along with two follow-ups: lookup failure counts as incomplete, and the lookup runs on every complete fetch. They then interrupted: "wait, i dont want a key lookup". All lookup-related answers were discarded.

---

## Missing card look & Remove

| Question | Options | Selected |
|----------|---------|----------|
| Order | Sink to bottom / Stay in sort position | Sink to bottom |
| Card layout | Hint line + Remove at the right / Replace metadata row | Hint line + Remove at the right |
| Per-card Remove | One click with a toast / Small confirm popover | Small confirm popover |
| Open detail | Yes, from snapshot / Not clickable | "you decide what is simplest" → keep clickable, no detail changes (detail already loads live by key) |
| Tab count | Total members / Present only | Total members |
| Divider | Subheading with count / None | Subheading with count |

---

## Remove all missing

| Question | Options | Selected |
|----------|---------|----------|
| Placement | On the subheading / Also in the group … menu | Also in the group … menu (both) |
| Confirm | Popover anchored to the button / Modal alertdialog | Popover |
| When only 1 is missing | Only when 2+ / Always when any | Always when any |
| Menu item | Hidden unless missing / Always shown but disabled | Hidden unless missing |

---

## Gating edge cases

| Question | Options | Selected |
|----------|---------|----------|
| A later fetch is partial or truncated | Hide all hints / Keep last known | you decide → Hide all hints |
| JQL changed, not yet fetched | Hide until the next fetch / Keep | you decide → Hide |
| Which fetches count | Any fully successful fetch / Manual only | Any fully successful fetch |
| Snapshot refresh | Any successful fetch / Complete fetches only | you decide → Any successful fetch |

## Claude's Discretion

- The "you decide" answers in the gating questions (above).
- Opening detail from a missing card.
- Where fetch-completeness state lives, the dimming values, select-mode interplay, and the copy.

## Deferred Ideas

- Looking up missing members by key (rejected).
