# Phase 35: Shared Triage Actions - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deny, re-link and restore behave identically everywhere and never disagree with the database about the remembered Cloud key. Frontend-only: one shared triage module (`triageActions.ts`) plus migration of existing call sites. Covers LINT-01, RTRI-02, RTRI-03, RLNK-01, RLNK-02. The labelled Deny / Link buttons, "previously linked to KEY" hints, focus handling and new i18n strings are Phase 36; consistency/a11y UAT is Phase 37. Backend (`relink_ticket`, copied rejection, duplicate guard) shipped in Phase 34.

</domain>

<decisions>
## Implementation Decisions

### Undo toast (RTRI-03)
- **D-01:** Deny shows a sonner toast with an Undo action that stays ~8 seconds (long enough for deliberate and screen-reader use).
- **D-02:** Undo is global, not tied to the current screen: it calls `relink_ticket` for that key and restores Linked with the same Cloud key even if the user navigated elsewhere. No dismiss-on-navigation.
- **D-03:** If Undo's `relink_ticket` fails or returns `None`, show an error toast and leave the ticket in Not mine (store matches DB).

### Deny (RTRI-02)
- **D-04:** Deny is optimistic: set the store entry to `ignored` (keeping `copiedKey`), call `set_triage_state('ignored')`. No Jira call anywhere in this path.
- **D-05:** On IPC failure, roll back only if the entry is unchanged since the optimistic write (same pattern as today's `restoreTicket`), show an error toast, and show no Undo toast.

### Link (RLNK-01, RLNK-02)
- **D-06:** `linkTicket(key)` calls `relink_ticket`. A returned key sets the store entry to `copied` with that key and performs no copy. `None` hands off to the existing copy-preview flow.
- **D-07:** The shared module owns the hand-off (navigates to / starts the existing copy preview), so every entry point behaves the same. It returns a result (`'relinked' | 'needs-copy'`) for callers that need it.
- **D-08:** Link is not optimistic: the store changes only after `relink_ticket` answers, since the DB decides whether a key exists.

### Key preservation (LINT-01)
- **D-09:** Every transition (deny, restore, handled) builds the new store entry by carrying the previous entry's `copiedKey`. Nothing writes `copiedKey: null` for an existing entry.
- **D-10:** Call sites stop writing `triageMap` directly; they call the shared module. No store-level defensive merge is required.
- **D-11:** Verification is by Vitest per transition plus a hydrate round-trip (re-hydrating from a mocked `get_triage_state`, simulating restart) asserting the key survives and the `invoke` args are right. Phase 34 Rust tests already cover the DB side.

### Module API and migration scope
- **D-12:** `triageActions.ts` exposes `denyTicket`, `linkTicket`, `restoreTicket`, `markHandled` (names at planner's discretion). It stays the single place that writes triage transitions.
- **D-13:** All existing call sites migrate now: `TicketDetailPage`, `TicketDetailPanel`, the Dismissed page restore, group view, list cards. They currently write `copiedKey: null` inline, which breaks LINT-01. Phase 36 then only adds buttons, hints and strings.

### Claude's Discretion
- D-09 to D-13 were delegated ("you decide"); exact function names, signature shapes, and how the preview hand-off is wired.
- Toast i18n key names for Phase 35 (only the strings that must exist for Undo and error toasts; broader strings are Phase 36).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` §Phase 35 — goal and 5 success criteria
- `.planning/REQUIREMENTS.md` — LINT-01, RTRI-02, RTRI-03, RLNK-01, RLNK-02, plus Out of Scope table (no Cloud delete, no key clearing, no bulk)
- `.planning/phases/34-link-integrity-backend/34-CONTEXT.md` — `relink_ticket` contract (returns `Option<String>`, idempotent, any state), `copied` rejected in `set_triage_state`, duplicate-copy guard message carries the key
- `.planning/research/SUMMARY.md` — v0.5.1 research

### Frontend code
- `src/features/tickets/triageActions.ts` — current `restoreTicket` (optimistic + rollback pattern; sets `copiedKey: null`)
- `src/features/tickets/ticketStore.ts` (`triageMap`, `hydrateTriageMap` ~L208)
- `src/features/tickets/types.ts` (`TriageEntry`)
- `src/features/tickets/TicketDetailPage.tsx` and `TicketDetailPanel.tsx` (inline `set_triage_state` + `copiedKey: null` writes ~L54-82)
- `src/features/tickets/IgnoredTicketsPage.tsx`, `LinkedTicketsPage.tsx`, `TicketListPage.tsx` (~L404 hydrates from `get_triage_state`), `CopyResultPage.tsx`, `CopyResultModal.tsx`
- `src/features/groups/GroupViewPage.tsx` (uses `restoreTicket`)
- `src/features/tickets/copyStore.ts` and `CopyPreviewModal.tsx` / `CopyPreviewPage.tsx` — existing copy-preview entry for the `needs-copy` hand-off

### Backend
- `src-tauri/src/commands.rs` (`relink_ticket`, `set_triage_state`, `copy_ticket_v2` duplicate guard)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `restoreTicket` in `triageActions.ts`: optimistic write + conditional rollback + error toast; template for the other actions.
- `sonner` `toast` already imported there; no Undo/action toast exists yet in the app, so this is the first.
- `hydrateTriageMap` + `get_triage_state`: used to re-sync and to simulate restart in tests.

### Established Patterns
- Optimistic store update, `invoke(...)`, rollback only if `current[issueKey] === optimistic`.
- Detail page/panel duplicate the same four inline handlers (ignore, restore, handled, unhandle), all writing `copiedKey: null`.
- Zustand selectors must not return `?? []` (use `null` fallback); no drag and drop; explicit labelled buttons preferred over hover icons.

### Integration Points
- `relink_ticket` Tauri command (Phase 34) is the only path back into Linked.
- Copy preview start via `copyStore.startPreview` for the `needs-copy` outcome.
- Phase 36 will consume the module for Deny / Link buttons.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the roadmap. Success criterion 5 requires the key to survive after app restart, in both DB and store.

</specifics>

<deferred>
## Deferred Ideas

- Labelled Deny / Link buttons, "previously linked to KEY" hint, focus handling, EN/SK strings — Phase 36.
- Cloud existence check on re-link — future requirement.

</deferred>

---

*Phase: 35-shared-triage-actions*
*Context gathered: 2026-10-15*
