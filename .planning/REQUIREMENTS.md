# Requirements: Pmkar v0.5.1 Re-triage

**Defined:** 2026-10-15
**Core Value:** Surface relevant tickets from the customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## v0.5.1 Requirements

### Deny linked

- [x] **RTRI-01**: User can deny an already-Linked ticket from an explicit labelled button in ticket detail (page and panel)
- [x] **RTRI-02**: Denying a Linked ticket moves it to Not mine and leaves the Cloud ticket untouched (no Jira call)
- [x] **RTRI-03**: After denying, user sees an Undo toast that returns the ticket to Linked with the same Cloud key
- [x] **RTRI-04**: Focus lands on a sensible element after Deny (the detail's focused button disappears)

### Re-link

- [x] **RLNK-01**: User can Link a denied ticket from detail; if it was linked before, it returns to Linked with the same Cloud key and no copy is performed
- [x] **RLNK-02**: If a denied ticket was never linked, Link opens the normal copy preview
- [x] **RLNK-03**: A denied ticket with a remembered link shows "previously linked to KEY" in detail and in Not mine, and its Link button states it restores that key
- [x] **RLNK-04**: Group view offers the same Deny / Link actions through the shared detail

### Link integrity

- [x] **LINT-01**: The remembered Cloud key survives every triage transition (deny, restore, handled) in both database and in-memory store
- [x] **LINT-02**: A Linked row can never exist without a Cloud key (`set_triage_state` rejects `copied`; re-link goes through a dedicated atomic command)
- [x] **LINT-03**: Backend refuses to copy a ticket that already has a remembered link, so no duplicate Cloud issue is created
- [x] **LINT-04**: A done ticket's remembered link is not erased by fetch cleanup

### Consistency and QA

- [ ] **RQA-01**: After any Linked ↔ Not mine transition each ticket appears in exactly one tab, with matching counts and group badges
- [x] **RQA-02**: All new strings exist in EN and SK (Slovak uses "tiket") and pass the i18n guard tests
- [ ] **RQA-03**: Deny/Link buttons are keyboard accessible with screen-reader announcements (WCAG AA)

### Transition confirmation

- [x] **CONF-01**: Denying a Linked ticket requires explicit confirmation in a dialog; Cancel or Esc leaves it Linked with no backend call
- [x] **CONF-02**: Restoring the remembered link of a Not mine ticket requires explicit confirmation; a never-linked ticket goes to the copy preview, which is its own confirmation
- [x] **CONF-03**: No Linked ↔ Not mine transition happens automatically: Undo restores only the true prior state, fetch/poll never change Linked or Not mine rows, and a static guard locks the only callers
- [x] **CONF-04**: Confirmation strings exist in EN and SK (Slovak uses "tiket"), the dialog is keyboard and screen-reader accessible, and a WebView2 checklist covers it

### Watched category

- [ ] **WATCH-01**: A new triage state Watched is persisted (SQLite CHECK widened by an idempotent table-rebuild migration from older schemas, accepted by set_triage_state, `copied` still rejected) and the remembered Cloud key survives every transition into and out of Watched.
- [ ] **WATCH-02**: A Watched nav tab with a count badge opens a Watched page that lists only Watched tickets with the remembered-link hint and a Restore button; Watched tickets are excluded from the New list and new count, and group views label them Watched.
- [ ] **WATCH-03**: Detail page, panel and group view offer explicit labelled buttons per state (Linked: Deny, Watch; Dismissed: Link or Restore link to KEY, Watch, Restore; Watched: Link or Restore link to KEY, Deny, Restore). Linked to Watched and Watched to Linked require confirmation, Watched to Linked relinks the remembered key and never creates a copy, and a never-linked Watched ticket goes to the copy preview.
- [ ] **WATCH-04**: Dismissed to Watched and Watched to Dismissed are instant with an 8 s Undo toast that restores the true prior state and can never make a ticket Linked.
- [ ] **WATCH-05**: All Watched transitions go through triageActions behind the static transition guard, and fetch/poll never change a Watched row.
- [ ] **WATCH-06**: All new strings exist in EN and SK (Slovak uses "tiket"), every transition is announced in the live region, focus never falls to body, axe passes, and the WebView2 checklist covers Watched.

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
| New triage state or schema migration | Superseded by Phase 37.2 (Watched state, WATCH-01) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RTRI-01 | Phase 36 | Complete |
| RTRI-02 | Phase 35 | Complete |
| RTRI-03 | Phase 35 | Complete |
| RTRI-04 | Phase 36 | Complete |
| RLNK-01 | Phase 35 | Complete |
| RLNK-02 | Phase 35 | Complete |
| RLNK-03 | Phase 36 | Complete |
| RLNK-04 | Phase 36 | Complete |
| LINT-01 | Phase 35 | Complete |
| LINT-02 | Phase 34 | Complete |
| LINT-03 | Phase 34 | Complete |
| LINT-04 | Phase 34 | Complete |
| RQA-01 | Phase 37 | Pending |
| RQA-02 | Phase 36 | Complete |
| RQA-03 | Phase 37 | Pending |
| CONF-01 | Phase 37.1 | Complete |
| CONF-02 | Phase 37.1 | Complete |
| CONF-03 | Phase 37.1 | Complete |
| CONF-04 | Phase 37.1 | Complete |
| WATCH-01 | Phase 37.2 | Pending |
| WATCH-02 | Phase 37.2 | Pending |
| WATCH-03 | Phase 37.2 | Pending |
| WATCH-04 | Phase 37.2 | Pending |
| WATCH-05 | Phase 37.2 | Pending |
| WATCH-06 | Phase 37.2 | Pending |

**Coverage:**
- v0.5.1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-10-15*
*Last updated: 2026-10-21 (Phase 37.2 WATCH requirements added)*
