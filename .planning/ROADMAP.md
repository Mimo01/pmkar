# Roadmap: Pmkar

## Milestones

- ✅ **v0.1.0 MVP** — Phases 1-11 (shipped 2026-03-25)
- ✅ **v0.3.0 Notifications & Change Tracking** — Phases 12-16 (shipped 2026-03-29)
- ✅ **v0.4.0 Configurable Field Mapping** — Phases 17-23 (shipped 2026-04-29)
- ✅ **v0.4.8 Mapping Refinements & Static Values** — Phases 24-27 (shipped 2026-05-20)
- 🚧 **v0.5.0 Custom Groups** — Phases 28-33 (in progress)

## Phases

<details>
<summary>✅ v0.1.0 MVP (Phases 1-11) — SHIPPED 2026-03-25</summary>

- [x] Phase 1: Foundation (4/4 plans) — completed 2026-03-20
- [x] Phase 2: Connection Setup (3/3 plans) — completed 2026-03-20
- [x] Phase 3: Ticket Fetch and Review (5/5 plans) — completed 2026-03-21
- [x] Phase 4: Copy — Core Fields (5/5 plans) — completed 2026-03-22
- [x] Phase 5: Copy — Attachments and Comments (3/3 plans) — completed 2026-03-22
- [x] Phase 6: Triage and Audit (3/3 plans) — completed 2026-03-23
- [x] Phase 7: Internationalization (3/3 plans) — completed 2026-03-23
- [x] Phase 8: UI Redesign (6/6 plans) — completed 2026-03-24
- [x] Phase 9: Accessibility (4/4 plans) — completed 2026-03-24
- [x] Phase 10: Codebase Quality (5/5 plans) — completed 2026-03-25
- [x] Phase 11: Deployment & Auto-Updates (4/4 plans) — completed 2026-03-25

Full details: [milestones/v0.1.0-ROADMAP.md](milestones/v0.1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v0.3.0 Notifications & Change Tracking (Phases 12-16) — SHIPPED 2026-03-29</summary>

- [x] Phase 12: Snapshot Foundation (2/2 plans) — completed 2026-03-27
- [x] Phase 13: Background Polling Engine (2/2 plans) — completed 2026-03-27
- [x] Phase 14: Notification Dispatch (2/2 plans) — completed 2026-03-28
- [x] Phase 15: Change Diff View (2/2 plans) — completed 2026-03-28
- [x] Phase 16: Enhanced Watch Configuration (2/2 plans) — completed 2026-03-29

Full details: [milestones/v0.3.0-ROADMAP.md](milestones/v0.3.0-ROADMAP.md)

</details>

<details>
<summary>✅ v0.4.0 Configurable Field Mapping (Phases 17-23) — SHIPPED 2026-04-29</summary>

- [x] Phase 17: Field Discovery + Mock Schema Fidelity (5/5 plans) — completed 2026-04-28
- [x] Phase 18: v2→v3 Translation Layer (5/5 plans) — completed 2026-04-28
- [x] Phase 19: Mapping Persistence + CRUD Commands (2/2 plans) — completed 2026-04-27
- [x] Phase 20: Renderer Registry + Field-Type-Aware Controls (5/5 plans) — completed 2026-04-28
- [x] Phase 21: Mapping Editor (Settings UI) (3/3 plans) — completed 2026-04-28
- [x] Phase 22: Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating (4/4 plans) — completed 2026-04-28
- [x] Phase 23: copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks (4/4 plans) — completed 2026-04-28

Full details: [milestones/v0.4.0-ROADMAP.md](milestones/v0.4.0-ROADMAP.md)

</details>

<details>
<summary>✅ v0.4.8 Mapping Refinements & Static Values (Phases 24-27) — SHIPPED 2026-05-20</summary>

- [x] Phase 24: Audit Log Copy-Time Resolution (2/2 plans) — completed 2026-05-05
- [x] Phase 25: Preview-Time Resolution of wiki_to_adf and User Fields (2/2 plans) — completed 2026-05-05
- [x] Phase 26: Batch Ticket Fetching per Watched User (1/1 plan) — completed 2026-05-06
- [x] Phase 27: Static Value Mapping (4/4 plans) — completed 2026-05-20

Full details: [milestones/v0.4.8-ROADMAP.md](milestones/v0.4.8-ROADMAP.md)

</details>

<details open>
<summary>🚧 v0.5.0 Custom Groups (Phases 28-33) — IN PROGRESS</summary>

- [x] **Phase 28: Foundations** - Durable groups storage and store, shared list utilities, palette, and translated copy-step labels (completed 2026-10-12)
- [x] **Phase 29: Tab Strip & Group View** - Create groups from the tab bar and browse each group as a flat triage-badged list (completed 2026-10-12)
- [x] **Phase 30: Group Management & Reorder** - Rename, recolor, delete, and reorder groups via Move left/right (completed 2026-10-12)
- [x] **Phase 31: Membership Entry Points** - Add/remove issues via detail picker, card chips, and multi-select with selection bar (completed 2026-10-12)
- [ ] **Phase 32: Durability** - Snapshots keep grouped issues visible; gated "No longer in results" hint with explicit remove
- [ ] **Phase 33: Polish & Verification** - EN/SK parity with Slovak plurals and WCAG AA verification across all new UI

### Phase 28: Foundations

**Goal**: Groups have a durable, restart-safe home and the shared building blocks later phases rely on exist, while copy-step labels are fully translated
**Depends on**: Nothing (first phase of milestone)
**Requirements**: GRP-06, CONI-01
**Success Criteria** (what must be TRUE):

  1. Groups, names, colors, order and memberships written through the app are still present after restarting the app
  2. Copy progress/result screens show translated EN and SK labels for every step, including add_remotelink, fetch_source, update_triage and worklog:fetch
  3. A test fails if the Rust side emits a copy step id that has no translation key
  4. Existing New / Not mine / Linked lists filter and sort exactly as before after the shared list utilities extraction

**Plans:** 6/6 plans complete
**Wave 1**

- [x] 28-01-PLAN.md — Characterize then extract New/Not mine/Linked filter+sort into ticketListUtils (SC4)
- [x] 28-02-PLAN.md — Shared copyStepLabel helper, EN/SK keys, Rust step-id sync test, translate result screens (CONI-01)
- [x] 28-03-PLAN.md — Group color palette tokens (colors.ts + CSS vars) with contrast and parity tests
- [x] 28-04-PLAN.md — groups.db data layer: scope, validation, CRUD, atomic membership, shared vectors (crate checkpoint)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-05-PLAN.md — Tauri group commands with Rust-derived scope and lock ordering; open groups.db at startup

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-06-PLAN.md — useGroupStore, TS validation mirror, App hydration on startup and source change

**Research flag**: Decide identity scope column, snapshot table shape (issue_snapshot with ticket_json) and INTEGER AUTOINCREMENT group id; verify Slovak plural key set against the installed i18next version

### Phase 29: Tab Strip & Group View

**Goal**: Users can create groups and open each as a flat, filterable list alongside the unchanged core tabs
**Depends on**: Phase 28
**Requirements**: GRP-01, GVIEW-01, GVIEW-02, GVIEW-03, GVIEW-04, GVIEW-05, GVIEW-06
**Success Criteria** (what must be TRUE):

  1. User can click the end-of-bar plus control, type a name, and a new group tab appears; an empty or whitespace-only name keeps Create disabled, and duplicate, reserved, and too-long names show an inline rejection message
  2. Group tabs sit right of the three core tabs after a divider, each showing its color and member count; with many groups the bar scrolls horizontally, core tabs stay put, and long names truncate with a tooltip
  3. Opening a group shows its members as one flat list with a New / Dismissed / Already Linked / Done badge (core tab labels) on each card; an empty group explains how to add issues
  4. User can search, filter, sort, open detail, copy, and dismiss/restore from a group view, and triage changes appear immediately in both the group view and core tabs

**Plans:** 6/6 plans complete
**Wave 1**

- [x] 29-01-PLAN.md — Fix Phase 28 WR-01..WR-04: hydrate sequencing + keep last good state; TS/Rust trim and zero-width alignment with shared vectors
- [x] 29-02-PLAN.md — Tab-id helpers + active-group fallback + overflow math, triage pill mapping, shared restoreTicket, all groups.* EN/SK strings
- [x] 29-03-PLAN.md — Automated legitimacy check and exact-pinned install of @radix-ui/react-popover; shadcn Popover primitive

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-04-PLAN.md — CreateGroupPopover: live validation, Rust error mapping, onCreated (GRP-01)
- [x] 29-05-PLAN.md — useGroupMembers (live + snapshot) and GroupViewPage with pills, actions, filter bar, empty state (GVIEW-03..06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-06-PLAN.md — GroupTabStrip (divider, overflow scroll, arrows/fades, create-then-focus) wired into AppShell and App.tsx (GVIEW-01, GVIEW-02)
**UI hint**: yes

### Phase 30: Group Management & Reorder

**Goal**: Users can fully manage existing groups: rename, recolor, delete safely, and reorder tabs via Move left/right menu actions
**Depends on**: Phase 29
**Requirements**: GRP-02, GRP-03, GRP-04, GRP-05
**Success Criteria** (what must be TRUE):

  1. User can rename a group from the tab's "..." menu with the same validation as create
  2. User can choose a group color from a fixed palette; a newly created group defaults to the next unused color
  3. Deleting a group asks for confirmation stating the issue count and that issues are not affected; if it was the active tab the app lands on a core tab
  4. User can reorder group tabs with "Move left / Move right" in the tab menu (mouse or keyboard); core tabs stay fixed, a screen reader announces the new position, and the order survives restart

**Plans:** 8/8 plans complete
**Wave 1**

- [x] 30-01-PLAN.md — Legitimacy gate + exact-pinned Radix dropdown/context menu packages, shadcn wrappers, jsdom stubs (checkpoint)
- [x] 30-02-PLAN.md — EN/SK copy (menu, rename, color names, delete plurals, move announce, errors), groupMoves helpers, focusCoreTab + AppShell data-tab-id

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 30-03-PLAN.md — Shared useGroupNameForm/GroupNameForm extraction, GroupColorSwatches radiogroup, Create popover swatch row + triggerRef
- [x] 30-04-PLAN.md — DeleteGroupDialog (alertdialog, frozen count, Slovak plurals) + DialogContent hideClose
- [x] 30-05-PLAN.md — GroupMenuItems, GroupTab `…` + right-click/Shift+F10 menu, Move left/right with announcement and focus return

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 30-06-PLAN.md — RenameGroupPopover and ChangeColorPopover (virtualRef-anchored, controlled)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 30-07-PLAN.md — Strip wiring of rename/color/delete overlays, delete fallback to New and D-14 focus targets

**Gap closure** *(UAT Test 1)*

- [x] 30-08-PLAN.md — Move light --color-group-* palette out of Tailwind @theme into :root so all 8 colors are emitted; parity + regression tests, build check

**UI hint**: yes

### Phase 31: Membership Entry Points

**Goal**: Users can put issues into and take them out of any number of groups from detail, cards, and multi-select
**Depends on**: Phase 30
**Requirements**: GMEM-01, GMEM-02, GMEM-03, GMEM-04, GMEM-05, GMEM-06, GMEM-07, GMEM-08, GMEM-09
**Success Criteria** (what must be TRUE):

  1. From ticket detail, the "Groups" button opens a searchable checkbox picker where toggling adds/removes immediately, and "Create '<name>'" makes a group and adds the issue in one step
  2. An issue can be in several groups at once and still appears in its core tab; its card shows up to 2 colored chips plus "+N" with a tooltip, hidden for the current group inside a group view
  3. Clicking a chip switches to that group's tab; user can also remove the issue from a group via the detail picker or detail chip
  4. A "Select" toggle in every list header reveals checkboxes with shift-click range selection; selection clears on tab change or leaving select mode
  5. The selection bar shows the count and adds all selected issues to a group atomically (with inline create); inside a group view it also offers "Remove from group"

**Plans:** 9/9 plans complete
**Wave 1**

- [x] 31-01-PLAN.md — EN/SK strings for picker, chips, select mode, bar, toasts (Slovak plurals, D-18 check)
- [x] 31-02-PLAN.md — NavigationContext + App navigateToGroup + GroupTabStrip focusRequest

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 31-03-PLAN.md — useListSelection hook (shift range, prune, Esc) + Select toggle in TicketFilterBar
- [x] 31-04-PLAN.md — GroupPicker (checkbox + list modes, inline create) + membershipActions feedback helpers
- [x] 31-05-PLAN.md — Card group chips (max 2 + "+N") + TicketCard restructure with select mode

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 31-06-PLAN.md — SelectionBar (count live region, atomic Add, confirmed Remove)
- [x] 31-07-PLAN.md — Detail Groups row (picker, chips with × confirm, chip navigation, Esc guard)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 31-08-PLAN.md — GroupViewPage select mode + Remove from group + hide current-group chip
- [x] 31-09-PLAN.md — Core lists select mode + GMEM-01 regression + App-level tab-change clearing and detail chip navigation
**UI hint**: yes

### Phase 32: Durability

**Goal**: Grouped issues never silently vanish; missing ones are clearly flagged only when that is actually true, and removal is always explicit
**Depends on**: Phase 31
**Requirements**: GDUR-01, GDUR-02, GDUR-03, GDUR-04, GDUR-05, GDUR-06
**Success Criteria** (what must be TRUE):

  1. A grouped issue that drops out of fetch results still renders its card in the group from its stored snapshot and stays a member until the user removes it or deletes the group
  2. After a complete successful fetch, absent members appear dimmed with "No longer in results" and a labelled "Remove" button
  3. The hint never appears before the first fetch of a session, after a partially failed fetch, or on truncated results
  4. A group with missing members offers "Remove all missing", which asks for confirmation before removing
  5. Snapshots refresh after each successful fetch and are cleaned up once no group references the issue

**Plans:** 7/7 plans complete
**Wave 1**

- [x] 32-01-PLAN.md — Rust UPDATE-only refresh_snapshots + refresh_group_snapshots command; GC regression tests (GDUR-01, GDUR-06)
- [x] 32-02-PLAN.md — Session-only completeness signature in ticketStore, computeFetchSignature, useHintsEligible (GDUR-04)
- [x] 32-03-PLAN.md — EN/SK missing-member copy, shared ConfirmRemovePopover, missing-removal helpers (GDUR-03, GDUR-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 32-04-PLAN.md — groupStore.refreshSnapshots + snapshotRevision, missingMembers helpers, useGroupMembers.missingKeys (GDUR-02, GDUR-03, GDUR-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 32-05-PLAN.md — handleFetch completeness gating + fire-and-forget snapshot refresh (GDUR-01, GDUR-04, GDUR-06)
- [x] 32-06-PLAN.md — TicketCard dimmed/footer slot; GroupViewPage missing block, per-card Remove, Remove all missing (GDUR-01..03, GDUR-05)
- [x] 32-07-PLAN.md — Group menu "Remove all missing (N)" with tab-anchored confirm (GDUR-05)
**Research flag**: Check whether default JQL presets include done issues and pin down exact gating rules

### Phase 33: Polish & Verification

**Goal**: All new group UI is fully bilingual and meets WCAG AA in both themes
**Depends on**: Phase 32
**Requirements**: GQA-01, GQA-02
**Success Criteria** (what must be TRUE):

  1. Switching to Slovak shows no untranslated or English-fallback strings in any group UI, and counts use correct Slovak plural forms
  2. Tabs, tab menus, picker, selection mode and bar, and dialogs are fully operable by keyboard alone, with focus returning to the trigger after dialogs close
  3. Group colors are never the only signal (names, counts, text accompany them) and palette contrast passes WCAG AA in light and dark themes
  4. With about 25 groups the tab bar and cards remain usable and uncluttered

**Plans**: TBD
**UI hint**: yes

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v0.1.0 | 4/4 | Complete | 2026-03-20 |
| 2. Connection Setup | v0.1.0 | 3/3 | Complete | 2026-03-20 |
| 3. Ticket Fetch and Review | v0.1.0 | 5/5 | Complete | 2026-03-21 |
| 4. Copy — Core Fields | v0.1.0 | 5/5 | Complete | 2026-03-22 |
| 5. Copy — Attachments and Comments | v0.1.0 | 3/3 | Complete | 2026-03-22 |
| 6. Triage and Audit | v0.1.0 | 3/3 | Complete | 2026-03-23 |
| 7. Internationalization | v0.1.0 | 3/3 | Complete | 2026-03-23 |
| 8. UI Redesign | v0.1.0 | 6/6 | Complete | 2026-03-24 |
| 9. Accessibility | v0.1.0 | 4/4 | Complete | 2026-03-24 |
| 10. Codebase Quality | v0.1.0 | 5/5 | Complete | 2026-03-25 |
| 11. Deployment & Auto-Updates | v0.1.0 | 4/4 | Complete | 2026-03-25 |
| 12. Snapshot Foundation | v0.3.0 | 2/2 | Complete | 2026-03-27 |
| 13. Background Polling Engine | v0.3.0 | 2/2 | Complete | 2026-03-27 |
| 14. Notification Dispatch | v0.3.0 | 2/2 | Complete | 2026-03-28 |
| 15. Change Diff View | v0.3.0 | 2/2 | Complete | 2026-03-28 |
| 16. Enhanced Watch Configuration | v0.3.0 | 2/2 | Complete | 2026-03-29 |
| 17. Field Discovery + Mock Schema Fidelity | v0.4.0 | 5/5 | Complete | 2026-04-28 |
| 18. v2→v3 Translation Layer | v0.4.0 | 5/5 | Complete | 2026-04-28 |
| 19. Mapping Persistence + CRUD Commands | v0.4.0 | 2/2 | Complete | 2026-04-27 |
| 20. Renderer Registry + Field-Type-Aware Controls | v0.4.0 | 5/5 | Complete | 2026-04-28 |
| 21. Mapping Editor (Settings UI) | v0.4.0 | 3/3 | Complete | 2026-04-28 |
| 22. Copy Preview Override Panel + Issue-Type Chooser + Required-Field Gating | v0.4.0 | 4/4 | Complete | 2026-04-28 |
| 23. copy_ticket_v2 Wiring + Pipeline Refactor + Audit Hooks | v0.4.0 | 4/4 | Complete | 2026-04-28 |
| 24. Audit Log Copy-Time Resolution | v0.4.8 | 2/2 | Complete | 2026-05-05 |
| 25. Preview-Time Resolution of wiki_to_adf and User Fields | v0.4.8 | 2/2 | Complete | 2026-05-05 |
| 26. Batch Ticket Fetching per Watched User | v0.4.8 | 1/1 | Complete | 2026-05-06 |
| 27. Static Value Mapping | v0.4.8 | 4/4 | Complete | 2026-05-20 |
| 28. Foundations | v0.5.0 | 6/6 | Complete    | 2026-10-12 |
| 29. Tab Strip & Group View | v0.5.0 | 6/6 | Complete   | 2026-10-12 |
| 30. Group Management & Reorder | v0.5.0 | 8/8 | Complete    | 2026-10-12 |
| 31. Membership Entry Points | v0.5.0 | 9/9 | Complete   | 2026-10-12 |
| 32. Durability | v0.5.0 | 7/7 | Gaps found | - |
| 33. Polish & Verification | v0.5.0 | 0/TBD | Not started | - |
