# Roadmap: Pmkar

## Milestones

- ✅ **v0.1.0 MVP** — Phases 1-11 (shipped 2026-03-25)
- ✅ **v0.3.0 Notifications & Change Tracking** — Phases 12-16 (shipped 2026-03-29)
- ✅ **v0.4.0 Configurable Field Mapping** — Phases 17-23 (shipped 2026-04-29)

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

## Phase 24: Audit Log Copy-Time Resolution

**Goal:** Add copy-time per-field audit entries to `copy_ticket_v2` so the Field Transformations log reflects actual `apply_mapping` resolution outcomes for `wiki_to_adf` and `user` fields — not just the preview-time pre-fill snapshot.

**Problem:** `CopyPreviewPage.tsx:83` defines `PREFILLABLE_KINDS = Set(['identity','priority'])`. At preview-open time, `wiki_to_adf` and `user` fields are logged as `skipped / target: null` with reason "requires async resolution — runs at copy time." These entries are written to the audit DB before Copy is clicked. The copy-time audit loop was removed from `commands.rs:1544` as "redundant," so the log never shows what `apply_mapping` actually resolved. Users reading the audit tab see `target: null` for every async field and conclude nothing was copied.

**Fix:** After `apply_mapping` completes in `copy_ticket_v2`, write per-field audit rows with actual resolved target values. Distinguish copy-time outcomes from preview-time pre-fill entries (e.g., `outcome = 'copied'` vs `outcome = 'prefill_skipped'`).

**Plans:** 2 plans

Plans:

- [x] 24-01-PLAN.md — Backend: add copy_id to CopyTicketV2Args, copy-time audit loop in copy_ticket_v2, thread previewCopyId through copyStore
- [x] 24-02-PLAN.md — Frontend: 'copied' outcome badge (blue), i18n keys in EN+SK, fieldGrouping tests

## Phase 25: Preview-Time Resolution of wiki_to_adf and User Fields

**Goal:** Resolve `description` (wiki_to_adf) and all `user`-type fields at copy-preview-open time so users can review and edit resolved values in the copy preview modal before clicking Copy.

**Problem:** `CopyPreviewPage.tsx:83` defines `PREFILLABLE_KINDS = Set(['identity','priority'])`. At preview-open time, `wiki_to_adf` and `user` fields log `skipped / target: null` with reason "requires async resolution — runs at copy time." Users see blank target fields for description and assignee in the preview modal and cannot review or edit them before the copy executes.

**Fix:** At preview-open time, (1) fetch `renderedFields` for the source issue and convert the description HTML to ADF via a new Tauri command `resolve_wiki_to_adf`; (2) run Cloud user lookup for all `user`-kind fields using existing `resolve_batch`; (3) store results in `overrideValues` so they appear as editable inputs in the target form. Edits in the modal update `overrideValues` and flow through to `copy_ticket_v2` unchanged.

**Plans:** 2 plans

Plans:

- [x] 25-01-PLAN.md — Backend: resolve_description_to_adf + resolve_users_preview Tauri commands, Rust unit tests, register in main.rs
- [x] 25-02-PLAN.md — Frontend: async pre-fill effect, description read-only display, user picker pre-fill, frontend tests

## Phase 26: Batch Ticket Fetching per Watched User

**Goal:** Replace the single combined JQL fetch with per-user batched requests so that following many users never produces a single oversized or slow call that can time out. Each watched user is fetched independently; results are merged before display. Startup load time is improved by streaming results progressively as each batch completes rather than waiting for all users.

**Depends on:** 3

**Success Criteria:**

1. Fetching tickets for N watched users issues N separate JQL requests, one per user
2. No single fetch request times out regardless of how many users are watched
3. App displays tickets as each user's batch arrives (progressive rendering) rather than blocking on all-or-nothing
4. Total fetch time for a large watch list is within an acceptable threshold (< previous single-call timeout window)
5. Existing filter, sort, triage, and copy flows work unchanged with the merged result set

**Plans:** 1 plan

Plans:

- [x] 26-01-PLAN.md — Refactor handleFetch into sequential per-user batch loop with progress counter, partial-failure warning, and i18n keys

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
| 24. Audit Log Copy-Time Resolution | hotfix | 2/2 | Complete | 2026-05-05 |
| 25. Preview-Time Resolution of wiki_to_adf and User Fields | hotfix | 2/2 | Complete | 2026-05-05 |
| 26. Batch Ticket Fetching per Watched User | — | 1/1 | Complete | 2026-05-06 |

### Phase 27: Add static value mapping to configurable field mapping

**Goal:** Extend the field mapping editor with a 'static' transformer kind so target-only Jira Cloud fields receive a configured constant value on every copy, regardless of any source field.
**Requirements**: STATIC-DB-01, STATIC-DB-02, STATIC-PIPE-01, STATIC-PIPE-02, STATIC-UI-01, STATIC-UI-02, STATIC-UI-03, STATIC-UI-04, STATIC-I18N-01
**Depends on:** Phase 26
**Plans:** 3/4 plans executed

Plans:
**Wave 1**

- [x] 27-01-PLAN.md — Wave 0 test scaffolding for DB, pipeline, and UI components (RED tests for all STATIC-* requirements)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 27-02-PLAN.md — Backend: FieldMappingRow.static_value, DB migration + round-trip, apply_mapping static branch
- [x] 27-03-PLAN.md — TS foundation: FieldMappingRow.staticValue, TransformerKind 'static', 11 new EN+SK i18n keys

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 27-04-PLAN.md — UI: StaticMappingRow + StaticValueWidget + FieldMappingSection wiring (with human-verify checkpoint)
