# Roadmap: Pmkar

## Milestones

- ✅ **v0.1.0 MVP** — Phases 1-11 (shipped 2026-03-25)
- ✅ **v0.3.0 Notifications & Change Tracking** — Phases 12-16 (shipped 2026-03-29)
- ✅ **v0.4.0 Configurable Field Mapping** — Phases 17-23 (shipped 2026-04-29)
- ✅ **v0.4.8 Mapping Refinements & Static Values** — Phases 24-27 (shipped 2026-05-20)
- ✅ **v0.5.0 Custom Groups** — Phases 28-33 (shipped 2026-10-15)
- 🚧 **v0.5.1 Re-triage** — Phases 34-37 (in progress)

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

<details>
<summary>✅ v0.5.0 Custom Groups (Phases 28-33) — SHIPPED 2026-10-15</summary>

- [x] Phase 28: Foundations (6/6 plans) — completed 2026-10-12
- [x] Phase 29: Tab Strip & Group View (6/6 plans) — completed 2026-10-12
- [x] Phase 30: Group Management & Reorder (8/8 plans) — completed 2026-10-12
- [x] Phase 31: Membership Entry Points (9/9 plans) — completed 2026-10-12
- [x] Phase 32: Durability (13/13 plans) — completed 2026-10-12
- [x] Phase 33: Polish & Verification (13/13 plans) — completed 2026-10-13

Full details: [milestones/v0.5.0-ROADMAP.md](milestones/v0.5.0-ROADMAP.md)

</details>

### 🚧 v0.5.1 Re-triage (In Progress)

**Milestone Goal:** Move tickets freely between Linked and Not mine without losing the Cloud link.

- [ ] **Phase 34: Link Integrity Backend** - Atomic re-link command, no Linked row without a key, duplicate-copy guard, link survives cleanup
- [ ] **Phase 35: Shared Triage Actions** - Key-preserving deny / re-link / restore transitions in one shared frontend module
- [ ] **Phase 36: Detail and Group UI** - Explicit Deny / Link buttons in detail (page, panel, group view) with hints, focus handling and EN/SK strings
- [ ] **Phase 37: Consistency, Accessibility and UAT** - Each ticket in exactly one tab after any transition; keyboard and screen-reader verified

## Phase Details

### Phase 34: Link Integrity Backend
**Goal**: The backend guarantees a Linked ticket always has a Cloud key, a remembered link is never lost or duplicated, and re-link is a single atomic operation
**Depends on**: Phase 33
**Requirements**: LINT-02, LINT-03, LINT-04
**Success Criteria** (what must be TRUE):
  1. Setting a ticket's triage state to Linked through the generic triage command is rejected, so no Linked row without a Cloud key can be created
  2. A dedicated re-link command returns the remembered Cloud key and marks the ticket Linked in one step, or reports that no link exists
  3. Attempting to copy a ticket that already has a remembered link is refused, so no duplicate Cloud issue is created
  4. A done ticket that has a remembered link keeps that link after a fetch; done tickets without a link are still cleaned up
  5. The mock server and Rust tests cover all of the above
**Plans**: 2 plans

Plans:
- [ ] 34-01-PLAN.md — DB layer: set_triage rejects 'copied', atomic relink + get_copied_key, cleanup keeps linked rows, legacy-shape DB test
- [ ] 34-02-PLAN.md — Command layer: validate_triage_state, relink_ticket command + registration, duplicate-copy guard first in copy_ticket_v2, full suite

### Phase 35: Shared Triage Actions
**Goal**: Deny, re-link and restore behave identically everywhere and never disagree with the database about the remembered Cloud key
**Depends on**: Phase 34
**Requirements**: LINT-01, RTRI-02, RTRI-03, RLNK-01, RLNK-02
**Success Criteria** (what must be TRUE):
  1. Denying a Linked ticket moves it to Not mine, makes no Jira call, and the Cloud ticket is untouched
  2. After deny, an Undo toast returns the ticket to Linked with the same Cloud key
  3. Linking a previously linked denied ticket returns it to Linked with the same key and performs no copy
  4. Linking a never-linked denied ticket opens the normal copy preview
  5. The remembered key is still present after deny, restore and handled transitions, in both the database and the in-memory store (verified after app restart)
**Plans**: TBD

### Phase 36: Detail and Group UI
**Goal**: Users can deny and re-link tickets from an explicit labelled button in every ticket detail, with clear hints about the remembered link
**Depends on**: Phase 35
**Requirements**: RTRI-01, RTRI-04, RLNK-03, RLNK-04, RQA-02
**Success Criteria** (what must be TRUE):
  1. A Linked ticket's detail (page and panel) shows a labelled Deny button
  2. A denied ticket with a remembered link shows "previously linked to KEY" in detail and in Not mine, and its Link button says it restores that key
  3. After Deny, keyboard focus lands on a sensible element rather than being lost
  4. The group view offers the same Deny / Link actions through the shared detail
  5. All new strings exist in EN and SK (Slovak uses "tiket") and pass the i18n guard tests
**Plans**: TBD
**UI hint**: yes

### Phase 37: Consistency, Accessibility and UAT
**Goal**: Re-triage leaves every list, count and badge correct, and is usable by keyboard and screen reader
**Depends on**: Phase 36
**Requirements**: RQA-01, RQA-03
**Success Criteria** (what must be TRUE):
  1. After any Linked to Not mine transition, the ticket appears in exactly one tab, with matching tab counts and group badges
  2. Deny and Link buttons are reachable and operable by keyboard alone
  3. Screen readers announce the result of deny, undo and link (WCAG AA)
  4. A WebView2 manual checklist (focus after deny, Undo toast) is written and run
**Plans**: TBD
**UI hint**: yes

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
| 32. Durability | v0.5.0 | 13/13 | Complete   | 2026-10-12 |
| 33. Polish & Verification | v0.5.0 | 13/13 | Complete   | 2026-10-13 |
| 34. Link Integrity Backend | v0.5.1 | 0/? | Not started | - |
| 35. Shared Triage Actions | v0.5.1 | 0/? | Not started | - |
| 36. Detail and Group UI | v0.5.1 | 0/? | Not started | - |
| 37. Consistency, Accessibility and UAT | v0.5.1 | 0/? | Not started | - |
