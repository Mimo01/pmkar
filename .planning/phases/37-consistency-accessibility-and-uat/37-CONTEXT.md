# Phase 37: Consistency, Accessibility and UAT - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-triage leaves every list, count and badge correct, and is usable by keyboard and screen reader. Covers RQA-01 and RQA-03. Verification and accessibility hardening of the Phase 35-36 work: an automated consistency invariant, a dedicated screen-reader live region, a keyboard/focus audit, and one WebView2 manual checklist. No new triage capabilities.

</domain>

<decisions>
## Implementation Decisions

### Consistency proof (RQA-01)
- **D-01:** Proven by an automated Vitest invariant only (no manual consistency steps). Drive deny, undo, link (relink), restore and handled over a fixture set and assert: each issue key appears in exactly one tab list, tab counts equal list lengths, and group badge counts match.
- **D-02:** The test exercises the real derivation code (`ticketListUtils`, `groupBadge`, `triageMap` in `ticketStore`), not re-implemented logic. Include a hydrate round-trip (re-hydrate from mocked `get_triage_state`) so the invariant also holds after restart.

### Screen-reader announcements (RQA-03)
- **D-03:** Add one dedicated app-level polite `aria-live` region, updated by `triageActions.ts` on deny, undo, link/relink and restore, so announcements do not depend on sonner behavior. Link-restore (which shows no toast) is announced too.
- **D-04:** Announcement strings are localized (EN + SK, Slovak uses "tiket"), pass the i18n guard tests, and include the ticket key and outcome (e.g. denied, restored to Linked KEY).
- **D-05:** Delegated: avoiding double announcement with the sonner toast (deny/undo) is Claude's call; the live region is the authoritative announcement.

### Keyboard and focus audit (RQA-03)
- **D-06:** Audit-and-fix scope: verify Deny and Link are reachable and operable by keyboard alone (Tab order, Enter/Space) in detail page, panel and group view, and fix any gaps found. Phase 36 focus rules (focus "Restore link to KEY" after deny, Linked badge after link, Dismiss after restore) are verified, not redesigned.
- **D-07:** Undo reachability: verify and document only. Sonner's hotkey and Tab reach the toast; after it expires the Not mine Link/Restore buttons are the keyboard path back. No new Undo shortcut and no longer-toast-on-keyboard behavior.

### WebView2 manual checklist
- **D-08:** One file, `37-HUMAN-UAT.md`, covers: focus after deny/link/restore (page and panel), Undo toast, live-region announcements with Narrator/NVDA, EN and SK. It folds in the 2 pending Phase 36 HUMAN-UAT items so they close together; `36-HUMAN-UAT.md` is marked superseded/closed by it.
- **D-09:** The checklist is written in this phase and run by the user on Windows/WebView2 (cannot be run in this environment).

### Claude's Discretion
- D-05 (double-announcement avoidance), exact live-region component placement and API shape, announcement wording, and which fixture set the invariant test uses.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` §Phase 37 — goal and 4 success criteria
- `.planning/REQUIREMENTS.md` — RQA-01, RQA-03 (RQA-02 done in Phase 36)
- `.planning/phases/35-shared-triage-actions/35-CONTEXT.md` — shared module contract, Undo toast (8 s, global)
- `.planning/phases/35-shared-triage-actions/35-UI-SPEC.md` — toast contract
- `.planning/phases/36-detail-and-group-ui/36-CONTEXT.md` — button layout, focus rules (D-05), visible-text hint rule
- `.planning/phases/36-detail-and-group-ui/36-UI-SPEC.md` — design tokens
- `.planning/phases/36-detail-and-group-ui/36-HUMAN-UAT.md` — 2 pending items to fold in
- `.planning/phases/36-detail-and-group-ui/36-VERIFICATION.md` — human_needed items

### Frontend code
- `src/features/tickets/triageActions.ts` — `denyTicket`, `linkTicket`, `restoreTicket`, `markHandled`; toast and error paths (announce hook point)
- `src/features/tickets/useTriageDetailActions.ts` — shared detail handlers
- `src/features/tickets/ticketStore.ts` (`triageMap`, `hydrateTriageMap`), `ticketListUtils.ts`, `src/features/groups/groupBadge.ts` — tab/count/badge derivation under test
- `src/features/tickets/TicketListPage.tsx`, `LinkedTicketsPage.tsx`, `IgnoredTicketsPage.tsx`, `src/features/groups/GroupViewPage.tsx` — tab lists and rows
- `src/features/tickets/TicketDetailPage.tsx`, `TicketDetailPanel.tsx` — Deny/Link buttons and focus handling
- `src/App.tsx` (Toaster mounted ~L211, ~L235) — mount point for the live region
- `src/i18n/` EN and SK locale files and guard tests (`src/features/groups/__tests__`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `triageActions.ts` is the single writer of triage transitions: one place to emit announcements.
- Existing `aria-live` usages (e.g. `TicketCard.tsx`, `TicketListPage.tsx`) show the app's live-region conventions.
- `hydrateTriageMap` + mocked `get_triage_state` for restart simulation in tests.

### Established Patterns
- Tooltips are `aria-hidden`; essential info must be visible text.
- Sonner `Toaster` is mounted twice in `App.tsx`; Undo toast id is `deny-${issueKey}`.
- Tab lists and counts derive from `triageMap` through `ticketListUtils`/`groupBadge`.

### Integration Points
- New live region mounted once in `App.tsx` beside the Toaster; `triageActions.ts` pushes messages to it.

</code_context>

<specifics>
## Specific Ideas

No specific requirements: open to standard approaches, following the explicit-labelled-button and one-entry-point preferences.

</specifics>

<deferred>
## Deferred Ideas

- Keyboard shortcut for Undo (e.g. Ctrl+Z) — new capability, not this phase.
- Longer Undo toast when triggered by keyboard — not this phase.
- Cloud existence check on re-link, suppress notifications for denied tickets (already in Future Requirements).

</deferred>

---

*Phase: 37-consistency-accessibility-and-uat*
*Context gathered: 2026-10-15*
