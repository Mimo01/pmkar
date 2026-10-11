# Research Summary: v0.5.0 Custom Groups

**Synthesized:** 2026-10-11 from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

Custom Groups is a Gmail-label-style overlay on Pmkar's triage inbox. Membership is many-to-many and independent of New / Not mine / Linked, so a grouped issue still shows in its core tab.

Build it as a separate, orthogonal layer:
- a new `groups.db` (db-per-concern, no new Rust crates);
- a new `useGroupStore`, hydrated at App startup;
- a pure memoised `resolveGroupItems` that joins membership against `tickets[]`;
- `@dnd-kit/core`, `@dnd-kit/sortable` and `@dnd-kit/utilities` for tab drag-reorder, plus `@radix-ui/react-checkbox` for multi-select;
- a fixed token palette instead of a color picker.

Two refactors come first:
- extract the filter/sort logic that is duplicated across three list pages;
- restructure `TicketCard` (currently a single `<button>`) so a checkbox can sit beside it.

The main risk is silently losing or mislabelling grouped issues. A naive "not in `tickets[]`" check gives false "no longer in results" hints:
- before the first fetch;
- after a partial per-user batch failure;
- on truncated results;
- for done issues.

Mitigations:
- the group view is driven by membership, not by the fetch;
- each grouped issue keeps a minimal persisted snapshot;
- the hint shows only when `hasFetchedThisSession && !truncated && !lastFetchHadFailures`;
- membership is never auto-pruned.

## Key Findings

### Stack
- **Add:**
  - `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0 and `@dnd-kit/utilities` ^3.2.2;
  - `@radix-ui/react-checkbox`.
- **No new Rust crates.**
- **Do not add:**
  - `@dnd-kit/react` 0.5.0 (pre-1.0);
  - react-beautiful-dnd (deprecated);
  - a color-picker library;
  - a migration framework.
- **SQLite:** idempotent `CREATE TABLE IF NOT EXISTS`, with `PRAGMA foreign_keys = ON` per connection.
- **Palette:** store the token name, not a hex value.
- **i18n:** new `groups.*`, `selection.*` and `copy.step.*` keys.

### Features
- **Table stakes:**
  - group CRUD with a fixed palette;
  - drag-reorder with a keyboard fallback;
  - tab strip with a divider, ＋ and overflow handling;
  - "Add to group" popover in ticket detail, with inline create;
  - bulk add/remove from multi-select;
  - at most 2 chips per card, then "+N";
  - group view with a triage badge on each card;
  - "no longer in results" hint with one-click remove;
  - EN+SK strings and CONI-01.
- **Cheap differentiators:** a "…" menu on each tab, and distinct styling for missing members.
- **Defer to v0.5.x:** undo toast, picker shortcut, chip-click navigation, "Remove all missing".
- **Defer further out:** export, per-group notifications, auto-rules.
- **Anti-features:** nested groups, free-text tags, icons revealed on hover, silent pruning of missing issues.

### Architecture
- **New:**
  - `groups_db.rs` and its commands;
  - `groupStore.ts`, `colors.ts`, `types.ts`;
  - a data-driven `AppShell` with `TabId = 'new' | 'not-mine' | 'linked' | group:${id}`;
  - `GroupTicketsPage`;
  - `GroupMembershipButton` / `GroupPicker`;
  - `SelectionBar` and `useSelection`;
  - `GroupManageDialog` and `GroupChips`;
  - `ticketListUtils.ts` and `copyStepLabel.ts`.
- **Modified:**
  - `ticketStore` gets a `lastFetchHadFailures` flag;
  - `TicketCard` is restructured;
  - the frontend refreshes snapshots after the final merged `setTickets`.
- **Lock ordering:** never hold the triage lock while acquiring the groups lock.
- **CONI-01 root cause:**
  - Rust emits `add_remotelink`, `fetch_source`, `update_triage` and `worklog:fetch`, but the UI expects `add_remote_link`.
  - `worklog:fetch` is mis-parsed as a worklog number.
  - `stepLabel` is duplicated in `CopyResultModal` and `CopyResultPage`, so the fix is a shared helper plus the new keys.

### Pitfalls (top 5)
1. Grouped issues lost or mislabelled.
2. No source scope on issue identity.
3. Fragile migrations, and FK cascade that does nothing without the pragma.
4. Zustand selector loops: never `?? []`; use a reverse index with a `null` fallback.
5. Tab accessibility conflicting with dnd-kit keyboard handling.

**Also:**
- selection leaking across tabs;
- color contrast, and color as the only signal;
- name validation (NFC, case-insensitive, reserved core-tab names);
- delete safety;
- card clutter;
- atomic bulk commands.

## Roadmap Implications (suggested 6 phases)

1. **Foundations**
   - `groups.db`, commands, store;
   - palette and its contrast test;
   - `ticketListUtils` extraction;
   - CONI-01 with a test that every emitted step has a key.
2. **Tab strip and read-only group view**
   - data-driven AppShell, divider, overflow;
   - `GroupTicketsPage` with triage badge and empty state;
   - fallback tab when the active group is deleted.
3. **Group management and drag-reorder**
   - create / rename / recolor / delete;
   - delete AlertDialog showing the issue count;
   - dnd-kit sortable tabs with a Move left/right fallback and live-region announcements.
4. **Membership entry points**
   - detail picker with inline create, and chips;
   - TicketCard restructure;
   - `useSelection` and `SelectionBar`.
5. **Durability**
   - `lastFetchHadFailures` flag and snapshot refresh;
   - gated "no longer in results" hint;
   - one-click remove;
   - tests for each edge case.
6. **Polish and verification**
   - i18n parity;
   - accessibility: axe and a keyboard walkthrough;
   - overflow with 25 groups;
   - contrast in both themes;
   - card clutter review.

## Research Flags
- **Phase 1:** decide identity scope, snapshot table and group id type.
- **Phase 3:** verify the dnd-kit API against current docs, its keyboard handling alongside Radix Tabs, and that it runs on React 19.
- **Phase 5:** check whether the default JQL presets include done issues, and pin down the exact gating rules.

## Gaps and Resolutions
- **Group id type:** INTEGER AUTOINCREMENT, which never reuses ids and gives simple `group:${id}` tab ids.
- **Snapshot placement:** a dedicated `issue_snapshot` table holding `ticket_json`, garbage-collected when no group references it. Not `snapshot.db`, which has its own poll/prune lifecycle.
- **Source scope:** include a scope column now, because retrofitting it is costly. Record the same latent flaw in triage, but do not fix it in this milestone.
- **Name uniqueness:** compare NFC-normalised, case-folded names in Rust, because SQLite `LOWER()` is ASCII-only.
- **Slovak plurals:** verify the key set (`_one/_few/_many/_other`) against the project's i18next version.
- **Unverified:**
  - whether list multi-select already exists;
  - whether `TicketDetailPanel.tsx` is dead code.
- **Missing members in tab count:** count them, with a separate missing indicator.
- **Mock server:** cover the "missing issue" scenario in frontend unit tests that run two sequential fetches, not in static fixtures.
