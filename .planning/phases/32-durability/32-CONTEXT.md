# Phase 32: Durability - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes sure grouped issues never silently vanish.

- Members absent from a fetch keep rendering from their stored snapshot and stay members.
- After a fully complete fetch, absent members are shown dimmed with a "No longer in results" hint and an explicit Remove. They are never flagged before the first fetch of a session, after a partial or failed fetch, or on truncated results.
- A group can remove all of its missing members at once, after a confirmation.
- Snapshots are refreshed from fetch results and cleaned up once no group references them.

Requirements: GDUR-01..06.

</domain>

<decisions>
## Implementation Decisions

### Resolved (Done) members
- **D-01:** **There is no key lookup.** The user explicitly rejected fetching absent members by key, so no extra Jira requests are made for them.
  - A member is "missing" if it is absent from the latest complete fetch, whatever the reason.
  - That includes issues that were resolved. Every built-in preset filters with `statusCategory != Done`, so resolving an issue is the most common reason it goes missing.
  - These members are dimmed with the hint. Their card shows the **last-seen snapshot status**, which may be stale. That is accepted.
- **D-02:** The hint copy is just **"No longer in results"**, with no explanation of why. The user chose this over a wording like "may be resolved or out of scope".

### Missing card look & Remove
- **D-03:** **Missing cards sink to the bottom** of the group list as one block.
  - Present members follow the chosen sort as usual.
  - Missing members follow after them, in the same sort order among themselves.
  - Search and filter apply to both blocks.
- **D-04:** The block starts with a **subheading with a count**, e.g. "No longer in results (3)", in EN and SK with Slovak plurals. The subheading also holds the "Remove all missing" button (D-09).
- **D-05:** On a missing card, the **content is dimmed** with reduced opacity, but the **controls are not**. Under the card it gets:
  - a small "No longer in results" text line;
  - a labelled **"Remove"** button at the right of that line, kept at full contrast to meet WCAG AA.
- **D-06:** The per-card **Remove asks for confirmation** in a **small popover anchored to the button**: "Remove ‘KEY’ from ‘<group>’?" with Cancel / Remove.
  - This mirrors the Phase 31 detail chip × (Phase 31 D-05).
  - The user chose this over a one-click remove. Read GDUR-03's "one-click" as one explicit button, not as "no confirmation".
  - Give non-silent feedback on failure, using the Phase 30/31 pattern.
- **D-07:** **Missing cards stay clickable** and open detail exactly as today; detail needs no changes.
  - `TicketDetailPage` already loads the issue live by key, so the user sees current data or the existing error state.
  - Chips and other card controls keep working.
- **D-08:** The **tab count still includes missing members**, so the list length always equals the tab count (Phase 29 D-14). Missing is a state of a member, not a separate bucket.

### Remove all missing
- **D-09:** There are **two entry points**:
  1. A labelled **"Remove all missing"** button at the right of the missing subheading (D-04).
  2. A **"Remove all missing (N)" item in the group's … menu**, placed above `Delete group…`.
- **D-10:** Both entry points appear **whenever there is at least one missing member**, including when there is only one, and only while the hint gating holds (D-12..D-14).
  - The menu item is **hidden**, not disabled, when nothing is missing or the gating doesn't hold.
- **D-11:** The confirmation is a **popover**: "Remove N issues from ‘<group>’? They are no longer in results." with Cancel / Remove and Slovak plurals.
  - From the subheading button, the popover is anchored to that button.
  - From the menu item, it is anchored to the group tab, like Rename in Phase 30 D-06.
  - Removal is **one atomic bulk call**, `removeMembers` (Phase 28 D-21). A sonner toast confirms it.

### Gating
- **D-12:** **Every fully successful fetch counts**: manual, F5, a poll-triggered refetch, a preset, or custom JQL.
  - "Fully successful" means **every batch succeeded**, `truncated` is false, and there is no error.
- **D-13:** Hints **always reflect only the latest fetch**.
  - If the latest fetch is partial, truncated or failed, **no member is flagged**. Absent members render normally from their snapshot, undimmed.
  - Hints come back after the next complete fetch.
  - No hints appear before the first complete fetch of the session (GDUR-04).
- **D-14:** **Changing the JQL preset or custom JQL hides all hints until the next fetch**, because the results on screen came from a different query.

### Snapshot refresh & cleanup
- **D-15:** **Any successful fetch refreshes snapshots**, even a partial or truncated one. Each member that the fetch returned gets its stored snapshot updated. Only the missing flags need a complete fetch.
- **D-16:** Cleanup already exists: `gc_snapshots` runs on remove and on delete (Phase 28 D-20). Make sure Remove and Remove-all-missing go through the same path, and add regression tests.

### Carried forward (locked, not re-discussed)
- Phase 28 D-20/D-21: `issue_snapshot` table; atomic bulk membership; never hold the triage lock while taking the groups lock.
- Phase 28 D-22: never `?? []` in a Zustand selector.
- Phase 29 D-14: absent members render from snapshot, and a live ticket is preferred when present. This phase adds the dimmed/missing state on top.
- Phase 29 D-15: group views have no fetch controls. Fetch stays on the New tab.
- Phase 30 D-03: … menu order. "Remove all missing" is inserted above `Delete group…` (D-09).
- Phase 31 D-05/D-18: confirmation-popover pattern.
- Explicit labelled controls, never hover-revealed. No drag and drop.

### Claude's Discretion
- Where fetch-completeness state lives. `failedUserNames` is currently local React state in `TicketListPage`. It probably needs to move into `ticketStore` as a session-only "last fetch complete" flag, plus the query identity (D-14), so `GroupViewPage` can read it.
- How a snapshot refresh is wired: one Rust command for bulk upsert after `setTickets`, applied only to keys that are members, in scope.
- Exact dimming values, as long as WCAG AA holds for the hint text and the Remove button.
- How missing cards interact with select mode, e.g. they can be selected like any card. Keep behaviour consistent.
- Exact EN/SK copy and toast wording.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md`: GDUR-01..06.
- `.planning/ROADMAP.md`: Phase 32 success criteria and the research flag. The JQL-preset Done question is now answered: presets exclude Done (D-01).

### Prior phase decisions
- `.planning/phases/28-foundations/28-CONTEXT.md`: D-19..D-22, covering storage, `issue_snapshot`, GC and atomicity.
- `.planning/phases/29-tab-strip-group-view/29-CONTEXT.md`: D-14..D-16, covering snapshot rendering and no fetch controls in group views.
- `.planning/phases/30-group-management-reorder/30-CONTEXT.md`: D-03, the menu order and primitives.
- `.planning/phases/31-membership-entry-points/31-CONTEXT.md`: D-05 and D-18 confirm popovers, and the card restructure in D-10.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/groups_db.rs`:
  - the `issue_snapshot` table;
  - `add_members` upserts snapshots;
  - `remove_members` and `delete_group` call `gc_snapshots`.
  - There is no standalone snapshot-refresh method yet.
- `src/features/groups/useGroupMembers.ts`: merges live tickets with parsed snapshots. This is where the present/missing split and the block ordering hook in.
- `src/features/groups/GroupViewPage.tsx`, `GroupMenuItems.tsx`, `membershipActions.ts`, `SelectionBar.tsx`: the existing remove flows, confirm popovers and toasts.
- `src/features/tickets/TicketCard.tsx`: the restructured card (outer div with a stretched button and sibling controls) can host the Remove button.

### Established Patterns
- `src/features/tickets/TicketListPage.tsx` `handleFetch`:
  - Custom JQL does a single invoke.
  - Otherwise it runs sequential batches with per-batch failure tolerance (`localFailedUsers`).
  - If all batches fail, it sets error status and keeps the existing tickets.
  - `anyTruncated` is aggregated across batches, and `setHasFetchedThisSession(true)` runs on success.
  - Poll-complete triggers `handleFetch` when keys changed.
- `ticketStore`: `truncated` and `hasFetchedThisSession` are session-only and never persisted. The completeness flag should follow the same rule.
- Presets: `buildMineBatchJql` and `buildUserBatchJql` both filter on `statusCategory != Done`.

### Integration Points
- After `store.setTickets(...)` in both the custom and batch paths of `handleFetch`, add snapshot refresh (D-15) and record whether the fetch was complete (D-12/D-13).
- `setJqlPreset` / `setJqlCustom`: invalidate hint eligibility (D-14).

</code_context>

<specifics>
## Specific Ideas

- The user does **not** want a key lookup or any per-issue requests for missing members. Keep the feature request-free beyond the normal fetch.
- The missing block works like a mini-section with a subheading. That subheading is the main home for "Remove all missing".

</specifics>

<deferred>
## Deferred Ideas

- **Looking up missing members by key** to refresh their status and tell "resolved" apart from "gone" was considered and **rejected** by the user.
- Undo after remove remains GRP-F1, which is already deferred.

</deferred>

---

*Phase: 32-durability*
*Context gathered: 2026-10-12*
