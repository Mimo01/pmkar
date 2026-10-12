---
phase: 32-durability
verified: 2026-10-12T21:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Snapshots refresh only for the fetching server (prior CR-01: unguarded refreshSnapshots after await)"
    - "Single-card Remove rechecks that the member is still missing (prior WR-01)"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
follow_ups:
  - id: CR-01-new
    classification: WARNING (non-blocking, pre-existing multi-server gap outside the phase 32 truths)
    summary: "Stale ticket list after server switch plus add_issues_to_group upsert with no scope veto can overwrite another server's snapshot"
  - id: WR-05
    classification: WARNING (non-blocking)
  - id: WR-06
    classification: WARNING (non-blocking)
human_verification:
  - test: "Drop a grouped issue from the fetch results in a running app"
    expected: "Card renders dimmed from snapshot with 'No longer in results' and a labelled Remove button"
    why_human: "Visual styling and layout cannot be checked by grep"
  - test: "Change the JQL preset without fetching, then run a partial or truncated fetch"
    expected: "No missing hints appear in either case"
    why_human: "End-to-end behavior across the real fetch pipeline"
  - test: "Use 'Remove all missing' from the tab menu and from the header"
    expected: "Confirm popover, one removal, focus handling acceptable"
    why_human: "Focus and popover UX"
---

# Phase 32: Durability Verification Report (re-verification)

**Phase Goal:** Grouped issues never silently vanish; missing ones are clearly flagged only when that is actually true, and removal is always explicit
**Verified:** 2026-10-12
**Status:** human_needed (all automated checks pass; visual and UX checks remain)
**Re-verification:** Yes, after gap closure plans 32-08 and 32-09

## Prior Gaps

| Prior gap | Status | Evidence |
|-----------|--------|----------|
| CR-01 (old): refreshSnapshots unguarded after await | CLOSED | TicketListPage.tsx:148-151 defines `isFetchStillCurrent` (signature captured at fetch start vs current). Both refresh calls (lines 168-169 custom path, 293-294 batch path) are gated on it. Rust `refresh_group_snapshots_inner` (groups_commands.rs:161-164) additionally vetoes the write when `normalize_scope(expected_base_url)` differs from the derived scope, so the frontend value can only veto, never select the scope. |
| WR-01: single-card Remove had no recheck | CLOSED | membershipActions.ts:59 `removeMissingMember` returns false before any IPC unless `readMissingKeysNow(group.id).has(issueKey)`. |

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dropped-out issue still renders from snapshot and stays a member | VERIFIED | `refresh_snapshots` only updates snapshots; membership is never touched by fetch paths. GC removes only unreferenced rows. |
| 2 | After a complete fetch, absent members show dimmed with hint and labelled Remove | VERIFIED (code) | missingMembers.ts, GroupViewPage wiring to `removeMissingMember`. Visual part is in the human list. |
| 3 | Hint never shows before first fetch, after partial fetch, or on truncated results | VERIFIED | `lastCompleteFetchSignature` starts null; set only for complete, non-truncated fetches; `markFetchIncomplete` on throw and all-failed (TicketListPage.tsx:272, 352); `useHintsEligible` requires signature equality. |
| 4 | "Remove all missing" asks for confirmation | VERIFIED | Both entry points use ConfirmRemovePopover and bulk path rechecks keys at confirm time. |
| 5 | Snapshots refresh after each successful fetch (fetching server only) and are cleaned up when unreferenced | VERIFIED | Refresh gated twice (frontend and Rust); GC present. See the follow-up note on the add path below. |

**Score:** 5/5

## Requirements Coverage

All six IDs (GDUR-01..06) are claimed by plan frontmatter in plans 01-07 and none is orphaned. REQUIREMENTS.md still shows all six as unchecked/"Pending" (lines 42-47, 105-110). This is a bookkeeping update for phase closure, not a code gap.

| Req | Status | Note |
|-----|--------|------|
| GDUR-01 | SATISFIED | No automatic membership removal in fetch or refresh code |
| GDUR-02 | SATISFIED | Snapshot fallback in `useGroupMembers` |
| GDUR-03 | SATISFIED (code); visual check pending | |
| GDUR-04 | SATISFIED | Signature gating |
| GDUR-05 | SATISFIED | Confirm popover plus recheck |
| GDUR-06 | SATISFIED | Refresh after successful fetch (scoped) plus GC; text of requirement does not cover cross-server add |

## Assessment of the New Review CR-01

I confirmed the mechanics in code: `setTickets` is called unconditionally (TicketListPage.tsx:161, 286); there is no store reset or subscription on connection change (no `.subscribe(` or ticket clear outside the store); `add_issues_to_group_inner` (groups_commands.rs:127-135) takes no expected-scope parameter; and `add_members` upserts `ticket_json` with `ON CONFLICT ... DO UPDATE` (groups_db.rs:593-594). So the finding is real: after a server switch, a stale server-A ticket added to a group can overwrite a colliding key's snapshot on server B.

Classification: **non-blocking WARNING, not a phase 32 goal failure**, for these reasons:

- The phase goal and the GDUR text concern (a) no silent vanishing, (b) truthful missing flags, (c) explicit removal, (d) snapshot refresh after a successful fetch and GC. None of these is violated. Nothing vanishes; the hint cannot fire against the wrong server because the signature includes baseUrl (the review itself notes `missingKeys` stays empty); removal remains explicit.
- The corruption requires a user action (adding a stale, other-server ticket) after a server switch without refetching, plus a key collision. The stale list and the unscoped add path predate this phase (they belong to the group/membership phases and the ticket store), and the phase 32 refresh guard fixes exactly what the prior verification flagged.
- GDUR-06 as written says snapshots are refreshed after fetch and cleaned up; the refresh path is scoped. The add path is a snapshot-write path owned by earlier requirements.

It is still a genuine data-integrity bug and should not be dropped. It is not covered by any later-phase success criterion that I checked, so it is not marked deferred. Recommended handling: open a follow-up (gap-closure or a small quick task) to (1) discard or clear the ticket list on connection baseUrl change, (2) gate `setTickets` with `isFetchStillCurrent`, (3) add the expected-scope veto to `add_issues_to_group` returning a loud error. If you want a stricter reading ("snapshots must never hold another server's data"), this would become a BLOCKER for GDUR-06; I judge that reading broader than the requirement text.

**WR-05** (stale `confirmKey`/`confirmAll` can re-open the destructive popover and steal focus): real, but the 32-09 recheck means the eventual click cannot remove a member that came back. Removal stays explicit. Warning, fix with a small effect.

**WR-06** (recheck treats pre-fetch list as authoritative while a fetch is in flight): real, narrow race window. It can remove a member the user explicitly confirmed as missing against the last complete data; it does not remove anything silently. Warning. It weakens the "flagged only when actually true" wording slightly during in-flight fetches, so I recommend making `readHintsEligibleNow` return false while `fetchStatus === 'loading'`.

Deferred-by-plan review items WR-02, WR-03, WR-04, IN-* remain open and are non-blocking.

## Behavioral Checks

Not re-run by me. The orchestrator reported tsc clean, vitest 1480/1480, and cargo test passing. The reviewer independently reported 915/915 vitest in the groups and tickets directories and 37/37 Rust groups tests. I did read the key guards in the source directly (see above). No probes are declared for this phase.

## Anti-Patterns

grep for TBD/FIXME/XXX across `src/features/groups`, `src/features/tickets`, `groups_commands.rs`, `groups_db.rs` returned no matches.

## Human Verification Required

1. Drop a grouped issue from fetch results. Expected: dimmed card, "No longer in results", labelled Remove button.
2. Change the JQL preset without fetching; run a partial or truncated fetch. Expected: no hints.
3. Use "Remove all missing" (tab menu and header). Expected: confirm popover, a single removal, sensible focus.

## Gaps Summary

No blocking gaps. The two previously reported gaps are closed in code. Three warnings (new CR-01 multi-server stale-list/add-path, WR-05, WR-06) are recommended follow-ups; the new CR-01 in particular should be scheduled because it can persist wrong snapshot data. After the human checks pass, mark GDUR-01..06 complete in REQUIREMENTS.md.

---

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
