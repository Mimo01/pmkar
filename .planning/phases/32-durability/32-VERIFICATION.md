---
phase: 32-durability
verified: 2026-10-12T22:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "CR-01 (cross-server stale list / add-path scope veto) closed by 32-10, 32-11"
    - "WR-05 (stale confirm state re-opens popover) closed by 32-12"
    - "WR-06 (recheck during in-flight fetch) closed by 32-13"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
follow_ups:
  - {id: WR-07, classification: "WARNING advisory (UI state of a new server can be disturbed by an orphaned fetch; fails safe)"}
  - {id: WR-08, classification: "WARNING advisory UX (removals silently no-op during fetch; fails safe)"}
  - {id: WR-09, classification: "WARNING advisory (veto compares connection scope; misleading copy on drift)"}
human_verification:
  - test: "Drop a grouped issue from the fetch results in a running app"
    expected: "Card dimmed from snapshot with 'No longer in results' and a labelled Remove button"
    why_human: "Visual styling and layout"
  - test: "Change the JQL preset without fetching, then run a partial or truncated fetch"
    expected: "No missing hints in either case"
    why_human: "End-to-end real fetch pipeline"
  - test: "Use 'Remove all missing' from tab menu and header; also click Remove while a poll fetch is loading"
    expected: "Confirm popover, one removal, acceptable focus; note WR-08 behaviour during loading"
    why_human: "Focus and popover UX"
---

# Phase 32: Durability Verification Report (re-verification)

**Phase Goal:** Grouped issues never silently vanish; missing ones are clearly flagged only when that is actually true, and removal is always explicit
**Verified:** 2026-10-12
**Status:** human_needed (all automated checks pass; visual and UX checks remain)
**Re-verification:** Yes, after gap closure plans 32-10..32-13

## Prior Gaps (re-checked in code)

| Prior gap | Status | Evidence |
|-----------|--------|----------|
| CR-01 stale list + unscoped add | CLOSED | ticketStore.ts:202-208 subscription calls resetForServerSwitch on A->B / A->null; TicketListPage.tsx:157-183, 291 gate setTickets with isSameServerAsFetch; groups_commands.rs:142-144 returns ScopeMismatch before the lock when expected URL differs from derived scope |
| WR-05 stale confirmKey/confirmAll | CLOSED | GroupViewPage.tsx:84-89 effect clears both when card/block disappears |
| WR-06 recheck during in-flight fetch | CLOSED | useHintsEligible.ts:43-49 readHintsEligibleNow returns false while fetchStatus==='loading'; membershipActions.ts removeMissingMember rechecks via readMissingKeysNow |

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dropped-out issue stays a member and renders from snapshot | VERIFIED | Fetch paths never touch membership; refresh only updates snapshots |
| 2 | Complete fetch: absent members dimmed, hint, labelled Remove | VERIFIED (code) | Visual part in human list |
| 3 | Hint never before first fetch, after partial/truncated fetch, or after query change | VERIFIED | lastCompleteFetchSignature is set only inside setTickets (ticketStore.ts:124), which is now gated by server identity; markFetchIncomplete on every failure/discard path; useHintsEligible requires signature equality |
| 4 | Remove all missing asks confirmation, rechecks at confirm | VERIFIED | ConfirmRemovePopover / RemoveMissingPopover, readMissingKeysNow |
| 5 | Snapshots refreshed after successful fetch (correct server only) and GC'd | VERIFIED | Frontend gate + Rust scope veto; add path now vetoed too |

**Score:** 5/5. Requirements GDUR-01..06 are all claimed by plan frontmatter (plans 01-13); none orphaned. All satisfied in code; REQUIREMENTS.md checkboxes (lines 42-47, 105-110) still read Pending and should be ticked after the human checks.

## Assessment of new warnings

All three fail safe: none can cause a member to be removed without explicit user confirmation, and none can make a hint appear when untrue. Every orphan or abort path only clears the signature (hides hints) or aborts removal.

- **WR-07** (orphaned fetch after TicketListPage unmount): can show a stale error banner / wipe the new server's complete signature, hiding hints (false negative) or drop a loader. Cannot write cross-scope data (list gate and Rust veto hold) and cannot set the signature (only reachable via the gated setTickets). Advisory. Does not violate "flagged only when true".
- **WR-08** (confirm silently no-ops during any fetch): Remove stays visible while the recheck refuses during loading. Removal remains explicit and safe, but a user click can do nothing with no feedback. This is a UX defect from the WR-06 fix, not a goal violation. Advisory, but the most user-visible of the three; recommend a quick fix (disable triggers or toast while loading) before milestone close.
- **WR-09** (veto compares connection scope): fires only on frontend/Rust drift; ticket-origin protection rests on the reset subscription, which is sound for current ticket sources. Misleading copy and the swallowed set_connection_meta failure are robustness issues. Advisory.

Deferred WR-02/03/04 and IN-* remain open and non-blocking.

## Behavioral Checks

Not re-run by me. Orchestrator reported build OK, vitest 1497/1497, cargo test all pass; review reported groups+tickets vitest 1026/1026 and cargo groups 43/43. Key guards read directly in source. The reviewer independently reported 915/915 vitest in the groups and tickets directories and 37/37 Rust groups tests. I did read the key guards in the source directly (see above). No probes are declared for this phase.

## Anti-Patterns

grep for TBD/FIXME/XXX across `src/features/groups`, `src/features/tickets`, `groups_commands.rs`, `groups_db.rs` returned no matches.

## Human Verification Required

1. Drop a grouped issue from fetch results. Expected: dimmed card, "No longer in results", labelled Remove button.
2. Change the JQL preset without fetching; run a partial or truncated fetch. Expected: no hints.
3. Use "Remove all missing" (tab menu and header). Expected: confirm popover, a single removal, sensible focus.

## Gaps Summary (updated)

No blocking gaps. CR-01, WR-05 and WR-06 are closed in code. New warnings WR-07, WR-08, WR-09 are advisory follow-ups (all fail safe). After the human checks pass, mark GDUR-01..06 complete in REQUIREMENTS.md.

---

_Verified: 2026-10-12_
_Verifier: Claude (gsd-verifier)_
