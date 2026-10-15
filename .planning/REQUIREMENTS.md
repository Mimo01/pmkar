# Requirements: Pmkar v0.5.1 Re-triage

**Defined:** 2026-10-15
**Core Value:** Surface relevant tickets from the customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## v0.5.1 Requirements

### Deny linked

- [ ] **RTRI-01**: User can deny an already-Linked ticket from an explicit labelled button in ticket detail (page and panel)
- [ ] **RTRI-02**: Denying a Linked ticket moves it to Not mine and leaves the Cloud ticket untouched (no Jira call)
- [ ] **RTRI-03**: After denying, user sees an Undo toast that returns the ticket to Linked with the same Cloud key
- [ ] **RTRI-04**: Focus lands on a sensible element after Deny (the detail's focused button disappears)

### Re-link

- [ ] **RLNK-01**: User can Link a denied ticket from detail; if it was linked before, it returns to Linked with the same Cloud key and no copy is performed
- [ ] **RLNK-02**: If a denied ticket was never linked, Link opens the normal copy preview
- [ ] **RLNK-03**: A denied ticket with a remembered link shows "previously linked to KEY" in detail and in Not mine, and its Link button states it restores that key
- [ ] **RLNK-04**: Group view offers the same Deny / Link actions through the shared detail

### Link integrity

- [ ] **LINT-01**: The remembered Cloud key survives every triage transition (deny, restore, handled) in both database and in-memory store
- [x] **LINT-02**: A Linked row can never exist without a Cloud key (`set_triage_state` rejects `copied`; re-link goes through a dedicated atomic command)
- [ ] **LINT-03**: Backend refuses to copy a ticket that already has a remembered link, so no duplicate Cloud issue is created
- [x] **LINT-04**: A done ticket's remembered link is not erased by fetch cleanup

### Consistency and QA

- [ ] **RQA-01**: After any Linked ↔ Not mine transition each ticket appears in exactly one tab, with matching counts and group badges
- [ ] **RQA-02**: All new strings exist in EN and SK (Slovak uses "tiket") and pass the i18n guard tests
- [ ] **RQA-03**: Deny/Link buttons are keyboard accessible with screen-reader announcements (WCAG AA)

## Future Requirements

- Cloud existence check on re-link (404 falls back to copy preview) — deferred, adds Jira call
- Suppress notifications / unseen dots for denied tickets — poll engine currently ignores triage state
- EXPRT-01 Excel export, BADGE-01 dock badge, NHIST-01 notification history, ADF editor in copy preview

## Out of Scope

| Feature | Reason |
|---------|--------|
| Deleting/closing the Cloud issue on deny | Deny is triage-only; Cloud copy stays untouched |
| Clearing the remembered link on deny | Link must be restorable |
| Bulk deny/link | Bulk copy is out of scope; review stays ticket-by-ticket |
| Hover row icons / drag & drop | Explicit labelled buttons only |
| New triage state or schema migration | Existing `ignored` + `copied_key` covers it |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RTRI-01 | Phase 36 | Pending |
| RTRI-02 | Phase 35 | Pending |
| RTRI-03 | Phase 35 | Pending |
| RTRI-04 | Phase 36 | Pending |
| RLNK-01 | Phase 35 | Pending |
| RLNK-02 | Phase 35 | Pending |
| RLNK-03 | Phase 36 | Pending |
| RLNK-04 | Phase 36 | Pending |
| LINT-01 | Phase 35 | Pending |
| LINT-02 | Phase 34 | Complete |
| LINT-03 | Phase 34 | Pending |
| LINT-04 | Phase 34 | Complete |
| RQA-01 | Phase 37 | Pending |
| RQA-02 | Phase 36 | Pending |
| RQA-03 | Phase 37 | Pending |

**Coverage:**
- v0.5.1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-10-15*
*Last updated: 2026-10-15 after initial definition*
