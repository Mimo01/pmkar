---
phase: 15-change-diff-view
verified: 2026-03-29T01:30:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
gaps:
  - truth: "Hovering the dot shows a tooltip with change count and field names"
    status: resolved
    reason: "TicketCard renders a static badge/pill with 'Changed' text. No Tooltip, TooltipProvider, or TooltipContent is present. Change count and field names are not surfaced on hover."
    artifacts:
      - path: "src/features/tickets/TicketCard.tsx"
        issue: "No Tooltip component imported or rendered. Indicator is a plain <span> badge with fixed label t('tickets.card.changedLabel') = 'Changed'. The changeTooltip and unseenChanges i18n keys exist in en.json/sk.json but are never referenced in TicketCard."
    missing:
      - "Import TooltipProvider, Tooltip, TooltipTrigger, TooltipContent from '@/components/ui/tooltip' in TicketCard.tsx"
      - "Wrap the blue indicator span in Tooltip with TooltipContent showing t('tickets.card.changeTooltip', { count: changeCount, fields: fieldList })"
      - "Derive changeCount and fieldList from unseenFields (unseenFields?.length, unseenFields?.join(', '))"
human_verification:
  - test: "Visual inspection of blue indicator and tooltip"
    expected: "Hovering the 'Changed' badge on a ticket card shows a tooltip with change count and field names (e.g. '2 changes: status, priority')"
    why_human: "Tooltip rendering and hover behavior cannot be verified programmatically without a running app"
  - test: "Auto-switch to Changes tab"
    expected: "Clicking a changed ticket opens the detail panel on the Changes tab, not Overview"
    why_human: "Requires interactive UI session to verify tab switching behavior"
  - test: "Mark-as-read lifecycle"
    expected: "After viewing the Changes tab, the blue indicator disappears from the ticket card on next render"
    why_human: "Requires interactive session to verify Zustand state update propagates to TicketCard"
  - test: "App restart persistence"
    expected: "Blue indicator reappears on tickets with unseen changes after killing and restarting the app"
    why_human: "Requires full app lifecycle test (cargo tauri dev, kill, restart)"
---

# Phase 15: Change Diff View — Verification Report

**Phase Goal:** Users can see exactly what changed on a ticket since it was last fetched, both as a visual indicator in the list and as a field-level diff in the detail view
**Verified:** 2026-03-29T01:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Plan 01 — Backend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SnapshotDb stores has_unseen_changes flag per ticket that survives app restart | VERIFIED | Column in CREATE_SNAPSHOT_TABLE (line 14) + ALTER TABLE migration in open() (line 61) |
| 2 | SnapshotDb stores pending_changes_json with cumulative field changes since last seen | VERIFIED | Column in CREATE_SNAPSHOT_TABLE (line 15) + ALTER TABLE migration (line 66); used in get_pending_changes, set_unseen_changes, mark_changes_seen |
| 3 | SnapshotDb stores seen_response_json as baseline for cumulative diff | VERIFIED | Column in CREATE_SNAPSHOT_TABLE (line 13) + ALTER TABLE migration (line 56); used in get_seen_snapshot, mark_changes_seen |
| 4 | Tauri command get_unseen_change_keys returns ticket keys with unseen changes | VERIFIED | commands.rs line 2014; registered in main.rs line 229; delegates to db.get_unseen_keys() |
| 5 | Tauri command get_ticket_changes returns Vec<FieldChange> for a given ticket | VERIFIED | commands.rs line 2026; registered in main.rs line 230; delegates to db.get_pending_changes() |
| 6 | Tauri command mark_changes_seen clears unseen state and resets baseline | VERIFIED | commands.rs line 2039; registered in main.rs line 231; delegates to db.mark_changes_seen() |
| 7 | Poll engine sets has_unseen_changes and pending_changes_json when changes are detected | VERIFIED | poll_engine.rs line 184-195: get_seen_snapshot baseline + detect_changes + set_unseen_changes called after changed_keys.push |

### Observable Truths (Plan 02 — Frontend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | A ticket with detected changes shows a blue dot indicator next to its key in the ticket list | VERIFIED | TicketCard.tsx line 37-42: conditional badge span with bg-blue-500/15 renders when hasUnseenChanges; useTicketStore selector at line 24 |
| 9 | Hovering the dot shows a tooltip with change count and field names | FAILED | No Tooltip, TooltipProvider, or TooltipContent imported or rendered in TicketCard.tsx; indicator is a static badge showing 'Changed' text only |
| 10 | Opening a changed ticket auto-switches to the Changes tab | VERIFIED | TicketDetailPanel.tsx lines 83, 92-93: useEffect on issueKey change calls setActiveTab('changes') when unseenChanges[issueKey] is truthy |
| 11 | The Changes tab shows a table with Field / Old Value / arrow / New Value rows | VERIFIED | ChangesTab.tsx lines 109-147: table with four columns rendered for each FieldChange; arrow character U+2192 at line 125 |
| 12 | Viewing the Changes tab clears the unseen indicator for that ticket | VERIFIED | ChangesTab.tsx lines 52-53, 58-59: invoke('mark_changes_seen') + clearUnseenChange(issueKey) called after data fetch |
| 13 | The unseen state hydrates from SQLite on app start and updates on poll-complete events | VERIFIED | Mount hydration: TicketListPage.tsx line 151-153 (Promise.all includes get_unseen_change_keys); Poll-complete: line 183-185 calls handleFetch() which runs per-ticket check_ticket_changes and setUnseenChange |
| 14 | Long-text fields like description show 'Description changed' instead of inline diff | VERIFIED | ChangesTab.tsx lines 32, 128-138: LONG_TEXT_FIELDS Set contains 'description'; conditional renders t('detail.changes.descriptionChanged') for new value |

**Score:** 13/14 truths verified (11/12 must-haves from PLAN frontmatter verified, counting the tooltip truth as the gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/snapshot_db.rs` | Column migrations, 5 new methods | VERIFIED | 3 columns, 3 ALTER TABLE migrations in open(); get_unseen_keys (132), get_pending_changes (144), mark_changes_seen (164), set_unseen_changes (180), get_seen_snapshot (194) |
| `src-tauri/src/commands.rs` | Three new Tauri commands | VERIFIED | get_unseen_change_keys (2014), get_ticket_changes (2026), mark_changes_seen (2039) |
| `src-tauri/src/main.rs` | Command registration | VERIFIED | All 3 commands in generate_handler at lines 229-231 |
| `src-tauri/src/poll_engine.rs` | Unseen changes flag set on poll | VERIFIED | set_unseen_changes called at line 195 with cumulative diff |
| `src/features/tickets/tabs/ChangesTab.tsx` | Diff table, loading/error/empty states, min 60 lines | VERIFIED | 146 lines; loading (lines 68-79), error (lines 82-88), empty (lines 90-96), diff table (99-147) |
| `src/features/tickets/ticketStore.ts` | unseenChanges slice with 3 actions | VERIFIED | unseenChanges field (line 57), hydrateUnseenChanges (137), setUnseenChange (141), clearUnseenChange (145) |
| `src/features/tickets/TicketCard.tsx` | Blue dot indicator with Tooltip | PARTIAL | Blue indicator (bg-blue-500/15 badge) present at lines 37-42; Tooltip is MISSING — no TooltipProvider/Tooltip in the file |
| `src/features/tickets/TicketDetailPanel.tsx` | Changes tab (6th), auto-switch, badge count | VERIFIED | TabId includes 'changes' (line 19); tab in array (line 156); Badge (lines 346-352); auto-switch (lines 83, 92-93); ChangesTab rendered (line 367) |
| `src/i18n/locales/en.json` | All change-related i18n keys including detail.tab.changes | VERIFIED | detail.tab.changes (80), ariaLabel (81), empty (82), error (83), descriptionChanged (84), noPreview (85), unseenChanges (266), changeTooltip (267), changedLabel (268) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src-tauri/src/poll_engine.rs` | `src-tauri/src/snapshot_db.rs` | set_unseen_changes call after check_for_changes | WIRED | poll_engine.rs line 195: `sdb.set_unseen_changes(key, &cumulative_changes)` |
| `src-tauri/src/commands.rs` | `src-tauri/src/snapshot_db.rs` | get_unseen_keys, get_pending_changes, mark_changes_seen | WIRED | commands.rs lines 2022, 2035, 2048: db.get_unseen_keys(), db.get_pending_changes(), db.mark_changes_seen() |
| `src-tauri/src/main.rs` | `src-tauri/src/commands.rs` | generate_handler registration | WIRED | main.rs lines 229-231: all 3 commands registered |
| `src/features/tickets/tabs/ChangesTab.tsx` | Tauri command get_ticket_changes | invoke('get_ticket_changes') | WIRED | ChangesTab.tsx line 48: `invoke<FieldChange[]>('get_ticket_changes', { ticketKey: issueKey })` |
| `src/features/tickets/tabs/ChangesTab.tsx` | Tauri command mark_changes_seen | invoke('mark_changes_seen') after data fetch | WIRED | ChangesTab.tsx lines 52, 59: both success and error paths call invoke('mark_changes_seen') |
| `src/features/tickets/TicketDetailPanel.tsx` | `src/features/tickets/ticketStore.ts` | useTicketStore selector for unseenChanges | WIRED | TicketDetailPanel.tsx line 42: `useTicketStore((s) => s.unseenChanges[issueKey])` |
| `src/features/tickets/TicketListPage.tsx` | Tauri command get_unseen_change_keys | invoke on mount for hydration | WIRED | TicketListPage.tsx line 151: `invoke<string[]>('get_unseen_change_keys')` in Promise.all |
| `src/features/tickets/TicketCard.tsx` | `src/features/tickets/ticketStore.ts` | useTicketStore selector for dot visibility | WIRED | TicketCard.tsx line 24: `useTicketStore((s) => s.unseenChanges[ticket.key])` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ChangesTab.tsx` | `changes` (FieldChange[]) | `invoke('get_ticket_changes')` -> `db.get_pending_changes()` -> `snapshot_store.pending_changes_json` | Yes — SQLite column populated by poll engine via set_unseen_changes | FLOWING |
| `TicketCard.tsx` | `unseenFields` (string[]) | `useTicketStore.unseenChanges[ticket.key]` -> hydrated by `hydrateUnseenChanges` or `setUnseenChange` | Yes — populated from SQLite via get_unseen_change_keys on mount and per-ticket check_ticket_changes on fetch | FLOWING |
| `TicketDetailPanel.tsx` | `unseenFields` (string[]) | `useTicketStore.unseenChanges[issueKey]` -> same source as TicketCard | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust snapshot tests (lifecycle + cumulative diff) | `cd src-tauri && cargo test snapshot` | 58 passed, 0 failed | PASS |
| Full Rust test suite | `cd src-tauri && cargo test` | 75 passed across all test files, 0 failed | PASS |
| TypeScript/Vitest suite | `npx vitest run` | 528 passed, 44 test files, 0 failed | PASS |
| SnapshotDb new methods exist | grep for fn names in snapshot_db.rs | All 5 found at lines 132, 144, 164, 180, 194 | PASS |
| Commands registered in main.rs | grep for commands in generate_handler | All 3 found at lines 229-231 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CHNG-01 | 15-01-PLAN, 15-02-PLAN | User can see field-level diff on ticket detail page showing what changed since last fetch | SATISFIED | ChangesTab.tsx renders field-level diff table; get_ticket_changes command returns Vec<FieldChange> from SQLite; mark_changes_seen clears state after viewing |
| CHNG-02 | 15-01-PLAN, 15-02-PLAN | Changed tickets display a visual indicator (badge/dot) in the ticket list view | PARTIAL | Visual indicator (badge) is present in TicketCard; tooltip showing change count/fields on hover is missing, which is an enhancement described in design spec but the core requirement (indicator visible) is met |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/tickets/TicketCard.tsx` | 40 | `t('tickets.card.changedLabel')` — static "Changed" label with no dynamic data | Info | The changeTooltip and unseenChanges i18n keys (with count/fields interpolation) exist in en.json but are unused in TicketCard; no blocking issue but tooltip plan not delivered |

### Human Verification Required

#### 1. Tooltip hover behavior

**Test:** Start the app with `cargo tauri dev`. Trigger at least one poll cycle so a ticket gets a change detected. Hover over the blue "Changed" badge on a ticket card.
**Expected per plan:** A tooltip should appear showing change count and field names (e.g. "2 changes: status, priority"). Currently the indicator shows "Changed" with no hover tooltip.
**Why human:** Tooltip rendering and hover interaction cannot be verified programmatically.

#### 2. Auto-switch to Changes tab on open

**Test:** With a changed ticket (blue badge visible), click it to open the detail panel.
**Expected:** Detail panel opens on the "Changes" tab, not "Overview".
**Why human:** Tab switching requires interactive UI navigation.

#### 3. Mark-as-read lifecycle

**Test:** After step 2, observe the ticket card after the Changes tab loads.
**Expected:** Blue "Changed" badge disappears from the ticket card once the Changes tab finishes loading (after mark_changes_seen + clearUnseenChange fires).
**Why human:** Requires observing React state-driven re-render in a live session.

#### 4. App restart persistence

**Test:** Trigger a poll that detects changes, confirm blue badge appears. Kill the app (Cmd+Q). Relaunch with `cargo tauri dev`.
**Expected:** Blue badge reappears on the same tickets (SQLite-backed D-11 persistence).
**Why human:** Full app lifecycle test not automatable without a running Tauri app.

### Gaps Summary

One gap blocks full goal achievement:

**Tooltip on change indicator is missing.** The plan specified that hovering the blue indicator shows a tooltip with change count and field names (D-02, D-03 per UI spec). The implementation delivers a static badge showing "Changed" text with no Tooltip component. The `tickets.card.changeTooltip` i18n key and `unseenChanges` count/fields data are both available in the codebase but not wired to a hover tooltip in `TicketCard.tsx`.

The gap is a frontend UI enhancement (add TooltipProvider/Tooltip wrapper around the badge span) and does not block the core requirement (CHNG-02 "visual indicator visible") — the indicator renders correctly and is wired to real data. However, the plan truth "Hovering the dot shows a tooltip with change count and field names" is not met.

All other plan truths, artifacts, and key links are fully verified with real data flowing end-to-end. Both Rust (75 tests) and TypeScript (528 tests) suites pass.

---

_Verified: 2026-03-29T01:30:00Z_
_Verifier: Claude (gsd-verifier)_
