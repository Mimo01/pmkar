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

### Global search

- [ ] **SRCH-01**: An always-visible header search field (ARIA combobox, results dropdown) is present on every post-setup screen. Ctrl/Cmd+K and Ctrl/Cmd+F focus it, but not while a modal dialog is open. Ctrl+F is best-effort and checked in WebView2 UAT (D-01, D-03, D-11).
- [ ] **SRCH-02**: Matching is local. Every whitespace-separated word must appear as a case- and diacritic-insensitive substring of key, summary, description, assignee, labels, components, fix versions or the remembered linked Cloud key. Comments are not searched (D-05, D-13, D-14).
- [ ] **SRCH-03**: Scope is every known ticket, deduplicated: live fetch results in all triage states including Done, plus group members that exist only as snapshots (D-06).
- [ ] **SRCH-04**: Both list fetch paths request `description`. Real description edits keep triggering change dots and notifications as today, and the first fetch after the update raises nothing new (D-04, D-07 revised).
- [ ] **SRCH-05**: Result rows show KEY, summary, priority, assignee, a neutral category badge (no badge for Done) and non-interactive tinted group chips. A one-line snippet appears when a match lies outside key and summary. Matches are highlighted, the top 20 are shown with a "Showing 20 of N" footer, and a no-results hint lists the searched fields (D-08, D-10, D-12, D-16).
- [ ] **SRCH-06**: Ranking goes exact key or exact linked key, then key prefix, then key/summary hits, then other fields, with ties broken by most recently updated. Selecting a hit opens the full detail page from any screen. Back returns to the previous tab and the query is kept (D-09, D-15).
- [ ] **SRCH-07**: The per-tab filter matches key or summary with the same normalization. Placeholder and aria strings are updated in EN and SK (D-02).
- [ ] **SRCH-08**: Every new string exists in EN and SK, with SK using "tiket" and never "úloha". The i18n guards scan the search UI, and the WebView2 checklist covers the search box, shortcuts and dropdown (D-17).

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
| SRCH-01 | Phase 37.3 | Pending |
| SRCH-02 | Phase 37.3 | Pending |
| SRCH-03 | Phase 37.3 | Pending |
| SRCH-04 | Phase 37.3 | Pending |
| SRCH-05 | Phase 37.3 | Pending |
| SRCH-06 | Phase 37.3 | Pending |
| SRCH-07 | Phase 37.3 | Pending |
| SRCH-08 | Phase 37.3 | Pending |

**Coverage:**
- v0.5.1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-10-15*
*Last updated: 2026-10-28 (Phase 37.3 SRCH requirements added)*
