---
phase: 32-durability
verified: 2026-10-12T00:00:00Z
status: gaps_found
score: 4/5 roadmap truths fully verified (5th verified with one integrity gap)
overrides_applied: 0
gaps:
  - truth: "Snapshots refresh after each successful fetch (only the fetching server's snapshots are written)"
    status: partial
    reason: "CR-01 confirmed in code. TicketListPage.handleFetch captures fetchSig at fetch start but calls refreshSnapshots(result.issues) / refreshSnapshots(mergedIssues) after the await with no check that the connection/signature is unchanged. Rust derives scope at call time, so a mid-fetch server switch writes server A's ticket JSON over B's snapshots on key collisions (e.g. AB-1). The write is persisted to SQLite."
    artifacts:
      - path: "src/features/tickets/TicketListPage.tsx"
        issue: "refreshSnapshots called unguarded after await (custom path ~line 162, batch path ~line 285)"
      - path: "src-tauri/src/groups_commands.rs"
        issue: "refresh_group_snapshots derives scope at call time, no expected_scope parameter"
    missing:
      - "Gate refreshSnapshots on computeFetchSignature(current) === fetchSig"
      - "Optionally pass expected scope to Rust and no-op on mismatch"
deferred: []
---

# Phase 32: Durability Verification Report

**Phase Goal:** Grouped issues never silently vanish; missing ones are clearly flagged only when that is actually true, and removal is always explicit
**Status:** gaps_found (one integrity gap, CR-01; the core goal is otherwise met)
**Re-verification:** No

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dropped-out issue still renders from snapshot and stays a member | VERIFIED | `refresh_snapshots` (groups_db.rs:629) only UPDATEs snapshots and never touches `group_member`. `gc_snapshots` deletes only unreferenced rows. Rust tests cover membership unchanged and scope isolation. `computeMissingKeys` is key-only with no Jira call. `handleFetch` never calls remove. |
| 2 | After a complete fetch, absent members appear dimmed with the hint and a labelled Remove | VERIFIED | `missingMembers.ts` computes missing keys. GroupViewPage wires missing cards to `removeMissingMember` through `removeFromGroup`. Per plans 04/05, UI is in place; I did not render it, so the visual styling is not checked. |
| 3 | Hint never shows before first fetch, after partial fetch, or on truncated results | VERIFIED | `lastCompleteFetchSignature` starts null (ticketStore:94). Custom path passes null if truncated. Batch path passes the signature only if `failedUsers==0 && !anyTruncated`. Throw and all-failed paths call `markFetchIncomplete` (lines 264, 342). `useHintsEligible` also requires the current signature to equal the stored one. |
| 4 | "Remove all missing" asks for confirmation | VERIFIED | Menu item and header button both open ConfirmRemovePopover. Bulk path rechecks via `readMissingKeysNow` and makes one `remove_issues_from_group` call. |
| 5 | Snapshots refresh after each successful fetch and are cleaned up when unreferenced | PARTIAL | Refresh and GC both exist and are wired (see gap CR-01). Refresh is unguarded against a mid-fetch server change. |

## Requirements Coverage

All six IDs appear in PLAN frontmatter (01: GDUR-01/06, 02: GDUR-04, 03: GDUR-01/04/06, 04: GDUR-02/03/06, 05: GDUR-03/05, 06: GDUR-01/02/03/05, 07: GDUR-05). None is orphaned. REQUIREMENTS.md still shows them as "Pending" and unchecked; update on closure.

| Req | Status | Note |
|-----|--------|------|
| GDUR-01 | SATISFIED | No automatic membership removal anywhere in fetch or refresh paths |
| GDUR-02 | SATISFIED | Snapshot fallback in useGroupMembers |
| GDUR-03 | SATISFIED (code-level) | Visual check needed |
| GDUR-04 | SATISFIED | Signature gating verified |
| GDUR-05 | SATISFIED | Confirm popover plus race guard |
| GDUR-06 | PARTIAL | Refresh and GC present; CR-01 cross-server write risk |

## Review Findings vs Goal

- **CR-01 (confirmed, gap):** Persisted wrong-server data. This undermines snapshot correctness, so it is listed as a gap. The window is narrow (server switch during an in-flight fetch). It does not cause issues to vanish or false "missing" hints, because the hint signature includes baseUrl.
- **WR-01 (confirmed in GroupViewPage.tsx:127-137):** The single-card confirm has no "still missing" recheck, unlike the bulk path. The user explicitly clicked Remove, so removal stays explicit, but it conflicts with the plan's race-guard intent. Should be fixed.
- **WR-02, WR-03, WR-04:** Not goal-blocking. WR-02 is a count mismatch with filters active and hidden unreadable members. WR-03 is the popover closing on failure. WR-04 is one invalid key aborting the batch refresh, which makes snapshots stale but never removes anything.

## Behavioral Checks

I did not re-run the test suites. The orchestrator reported build, vitest 1472/1472 and cargo test all passing. No probes are declared.

## Anti-Patterns

I did not scan for TBD/FIXME/XXX markers in this pass.

## Human Verification (after the gap is closed)

1. In a running app, drop a grouped issue from the fetch. Expected: the card shows dimmed with "No longer in results" and a Remove button.
2. Change the JQL preset without fetching. Expected: the hints disappear. Run a partial or truncated fetch. Expected: no hints.
3. Use Remove all missing from the tab menu. Expected: confirm popover, then one removal, then focus returns to the tab.

## Gaps Summary

The phase delivers the goal's core guarantees. Membership is never auto-removed, hints are gated, and removal is explicit. One integrity gap remains: the unguarded `refreshSnapshots` after await (CR-01), which can persist another server's ticket data. Fix CR-01 and WR-01. WR-02 to WR-04 are recommended follow-ups.
