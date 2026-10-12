# Requirements: Pmkar v0.5.0 Custom Groups

**Defined:** 2026-10-11
**Core Value:** Surface relevant tickets from the customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

**Milestone goal:** Let users organise issues into their own named groups, layered on top of the core New / Not mine / Linked triage (which stays unchanged), with a polished, uncluttered UX.

## v0.5.0 Requirements

### Group Management (GRP)

- [ ] **GRP-01**: User can create a named group from a `＋` control at the end of the tab bar; empty and whitespace-only names keep Create disabled; duplicate (case- and diacritic-aware) and reserved core-tab names are rejected with an inline message
- [ ] **GRP-02**: User can rename a group from the group tab's "…" menu, with the same validation as create
- [ ] **GRP-03**: User can pick a group color from a fixed palette (~8 colors, WCAG AA legible in light and dark); a new group gets the next unused color by default
- [ ] **GRP-04**: User can delete a group after a confirmation dialog that states the issue count and that issues themselves are not affected; if the deleted group was the active tab, the app falls back to a core tab
- [ ] **GRP-05**: User can reorder group tabs via "Move left / Move right" actions in the tab's "…" menu (keyboard accessible, new position announced to screen readers); core tabs stay fixed
- [x] **GRP-06**: Groups, their names, colors, order and memberships persist across app restarts in local storage

### Navigation & Group View (GVIEW)

- [ ] **GVIEW-01**: Group tabs appear to the right of the three core tabs, separated by a visual divider, each showing its color and member count
- [ ] **GVIEW-02**: When there are more group tabs than fit, the tab bar scrolls horizontally without wrapping or shifting the core tabs; long names are truncated with a tooltip
- [ ] **GVIEW-03**: Opening a group tab shows its members as one flat list, each card showing a New / Not mine / Linked triage badge
- [ ] **GVIEW-04**: Cards in a group view support the same actions as in core tabs (open detail, copy, dismiss/restore), and triage changes are reflected immediately in both the group view and the core tabs
- [ ] **GVIEW-05**: An empty group shows an empty state explaining how to add issues
- [ ] **GVIEW-06**: Group view supports the same search/filter/sort controls as the core tabs

### Membership (GMEM)

- [ ] **GMEM-01**: An issue can belong to any number of groups regardless of its triage state, and it continues to appear in its core tab
- [ ] **GMEM-02**: Ticket detail has an explicit "Groups" button opening a searchable picker with a checkbox per group; toggling a checkbox adds/removes the issue immediately
- [ ] **GMEM-03**: User can create a new group inline from the picker ("Create '<typed name>'") and the issue is added to it in one step
- [ ] **GMEM-04**: Cards show the issue's group memberships as small colored name chips (max 2, then "+N" with a tooltip listing the rest); inside a group view, that group's own chip is hidden
- [ ] **GMEM-05**: Clicking a group chip on a card switches to that group's tab
- [ ] **GMEM-06**: Each list (core tabs and group tabs) has a "Select" toggle in its header that reveals per-card checkboxes; shift-click selects a range; selection clears on tab change or when leaving select mode
- [ ] **GMEM-07**: With issues selected, a selection bar shows the count and an "Add to group" action (picker with inline create) that adds all selected issues in one atomic operation
- [ ] **GMEM-08**: Inside a group view, the selection bar also offers "Remove from group" for the selected issues
- [ ] **GMEM-09**: User can remove an issue from a group via the detail picker or the chip on the detail view

### Durability (GDUR)

- [ ] **GDUR-01**: Grouped issues are never removed from a group automatically; membership only changes through explicit user action or deleting the group
- [ ] **GDUR-02**: A minimal snapshot of each grouped issue (key, summary, status, triage state, etc.) is persisted so its card renders even when the issue is absent from the current fetch
- [ ] **GDUR-03**: After a complete, successful fetch, grouped issues missing from the results are shown dimmed with a "No longer in results" hint and a labelled one-click "Remove" button
- [ ] **GDUR-04**: The "No longer in results" hint is never shown before the first fetch of a session, after a partially failed fetch, or on truncated results
- [ ] **GDUR-05**: A group with missing issues offers a "Remove all missing" action (with confirmation)
- [ ] **GDUR-06**: Snapshots of grouped issues are refreshed after each successful fetch and cleaned up when no group references the issue any more

### Copy i18n (CONI)

- [x] **CONI-01**: All copy-step labels in CopyResultModal / CopyResultPage are translated in EN and SK (Rust step ids matched correctly, including `add_remotelink`, `fetch_source`, `update_triage`, `worklog:fetch`), via one shared helper, with a test that every emitted step has a key

### Quality (GQA)

- [ ] **GQA-01**: All new UI strings exist in EN and SK, including correct Slovak plural forms for counts
- [ ] **GQA-02**: New UI meets WCAG AA: keyboard reachable tabs/menus/picker/selection, focus returns after dialogs, color is never the only signal, palette contrast verified in both themes

## Future Requirements (deferred)

- **GRP-F1**: Undo toast after bulk add/remove and group delete
- **GMEM-F1**: Keyboard shortcut (e.g. `G`) to open the group picker
- **GRP-F2**: Export a group (ties to EXPRT-01)
- **GRP-F3**: Per-group notification / badge settings

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drag & drop reordering | App has no drag & drop anywhere; keep interaction model consistent — menu-based Move left/right instead |
| Nested groups | Complicates tab UI, reorder and membership semantics |
| Free-text tags | Typos and sprawl; managed list with inline create covers the need |
| Auto-rules (JQL/status-based membership) | Duplicates core triage; hidden membership is confusing |
| Exclusive (folder) membership | Contradicts tag model; would break core triage |
| Free color picker / custom icons | Contrast failures and visual noise; fixed palette instead |
| Hover-revealed row icons | Conflicts with explicit-actions preference |
| Bulk copy from a group | Copy stays ticket-by-ticket (existing out-of-scope decision) |
| Sharing / syncing groups | Local-only app; no backend |
| Changes to core New / Not mine / Linked behaviour | Core behaviour stays intact |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRP-01 | Phase 29 | Pending |
| GRP-02 | Phase 30 | Pending |
| GRP-03 | Phase 30 | Pending |
| GRP-04 | Phase 30 | Pending |
| GRP-05 | Phase 30 | Pending |
| GRP-06 | Phase 28 | Complete |
| GVIEW-01 | Phase 29 | Pending |
| GVIEW-02 | Phase 29 | Pending |
| GVIEW-03 | Phase 29 | Pending |
| GVIEW-04 | Phase 29 | Pending |
| GVIEW-05 | Phase 29 | Pending |
| GVIEW-06 | Phase 29 | Pending |
| GMEM-01 | Phase 31 | Pending |
| GMEM-02 | Phase 31 | Pending |
| GMEM-03 | Phase 31 | Pending |
| GMEM-04 | Phase 31 | Pending |
| GMEM-05 | Phase 31 | Pending |
| GMEM-06 | Phase 31 | Pending |
| GMEM-07 | Phase 31 | Pending |
| GMEM-08 | Phase 31 | Pending |
| GMEM-09 | Phase 31 | Pending |
| GDUR-01 | Phase 32 | Pending |
| GDUR-02 | Phase 32 | Pending |
| GDUR-03 | Phase 32 | Pending |
| GDUR-04 | Phase 32 | Pending |
| GDUR-05 | Phase 32 | Pending |
| GDUR-06 | Phase 32 | Pending |
| CONI-01 | Phase 28 | Complete |
| GQA-01 | Phase 33 | Pending |
| GQA-02 | Phase 33 | Pending |

**Coverage:**
- v0.5.0 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-10-11*
*Last updated: 2026-10-11 after roadmap creation*
