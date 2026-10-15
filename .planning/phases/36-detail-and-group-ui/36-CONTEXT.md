# Phase 36: Detail and Group UI - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can deny and re-link tickets from an explicit labelled button in every ticket detail (page, panel, and the group view via the shared detail), with clear hints about the remembered link. Covers RTRI-01, RTRI-04, RLNK-03, RLNK-04, RQA-02. Wiring only: the shared `triageActions.ts` module (`denyTicket`, `linkTicket`, `restoreTicket`, `markHandled`) and backend `relink_ticket` already exist (Phases 34-35). Consistency/a11y UAT and screen-reader announcements are Phase 37.

</domain>

<decisions>
## Implementation Decisions

### Link button label (RLNK-03)
- **D-01:** When a denied ticket has a remembered key, the Link button reads "Restore link to KEY" (e.g. "Restore link to PROJ-123"). A never-linked denied ticket keeps the normal copy wording.

### Detail button layout (RTRI-01, RLNK-04)
- **D-02:** Deny is a labelled, neutral outlined button (same style as Ignore / Handled; no destructive styling since Deny is undoable). It appears in detail page and panel for Linked tickets. Group view gets it by reusing the same shared detail, not a separate implementation.
- **D-03:** Delegated: exact placement of Deny within the status row, and the denied-state button set. Recommended: Deny sits on the status row after the Cloud-key link; the denied state shows Link (primary) plus an explicit Restore to "seen", replacing the toggle-like "Ignored" button. All handlers call `triageActions.ts`; no inline `set_triage_state` writes.

### Remembered-link hint (RLNK-03)
- **D-04:** Delegated. Constraints: "previously linked to KEY" is always visible text (not tooltip-only, since tooltips are `aria-hidden`); appears in detail and on Not mine rows (muted, consistent with the existing linked-key chip in `GroupViewPage`). Shown only when `copiedKey` is set on an `ignored` entry.

### Focus after Deny / Link (RTRI-04)
- **D-05:** Delegated. Constraint: focus must never be lost to `<body>` when the Deny button unmounts. Recommended: move focus to the new primary action (Link) in the denied state; apply the same rule after Link-restore (focus a stable element such as the status badge or close button). Must be verified in WebView2 (Phase 37 checklist).

### List rows
- **D-06:** Delegated. Recommended: detail-only for Deny/Link; rows keep existing Restore and show the hint (D-04). No hover-revealed icons (explicit-actions preference).

### Strings (RQA-02)
- **D-07:** All new strings added to EN and SK; Slovak uses "tiket" never "úloha"; must pass the i18n guard tests (including the groups guard).

### Claude's Discretion
D-03 (placement and denied-state set), D-04 (hint styling), D-05 (focus target), D-06 (list rows) were all delegated ("you decide"). Planner/UI-spec may choose within the stated constraints.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` §Phase 36 — goal and 5 success criteria
- `.planning/REQUIREMENTS.md` — RTRI-01, RTRI-04, RLNK-03, RLNK-04, RQA-02
- `.planning/phases/35-shared-triage-actions/35-CONTEXT.md` — shared module contract (D-01..D-13), Undo toast
- `.planning/phases/35-shared-triage-actions/35-UI-SPEC.md` — design tokens, toast contract
- `.planning/phases/34-link-integrity-backend/34-CONTEXT.md` — `relink_ticket` contract

### Frontend code
- `src/features/tickets/triageActions.ts` — `denyTicket`, `linkTicket` (returns `'relinked' | 'needs-copy' | 'failed'`), `restoreTicket`, `markHandled`
- `src/features/tickets/TicketDetailPanel.tsx` (status/action row ~L216-350), `TicketDetailPage.tsx`
- `src/features/tickets/IgnoredTicketsPage.tsx`, `src/features/groups/GroupViewPage.tsx` (row Restore, linked-key chip ~L174)
- `src/features/tickets/ticketStore.ts` (`triageMap`), `types.ts` (`TriageEntry`)
- `src/i18n/` EN and SK locale files and guard tests (`src/features/groups/__tests__`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Shared `triageActions.ts` module already handles optimistic deny, Undo toast, relink and copy-preview hand-off.
- Existing neutral outlined button style and `Tooltip` wrappers in the detail action row.

### Established Patterns
- Denied (`ignored`) detail currently shows an "Ignored" button that restores to "seen"; Linked detail shows only a badge and open-in-Jira links, no triage action.
- Tooltips are `aria-hidden`, so essential info must be visible text.
- Panel focuses the close button on load; no focus management after triage actions yet.
- Detail page and panel duplicate the same handlers.

### Integration Points
- Detail page/panel button row; group view opens the same shared detail.
- Not mine (`IgnoredTicketsPage`) and group-view rows for the hint.

</code_context>

<specifics>
## Specific Ideas

User chose the label "Restore link to KEY". Everything else delegated to Claude with the explicit-labelled-button preference.

</specifics>

<deferred>
## Deferred Ideas

- Keyboard/screen-reader announcements and WebView2 checklist — Phase 37.
- Link action on list rows — not in this phase.

</deferred>

---

*Phase: 36-detail-and-group-ui*
*Context gathered: 2026-10-15*
