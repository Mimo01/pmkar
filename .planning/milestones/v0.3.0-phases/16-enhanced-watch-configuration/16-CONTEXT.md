# Phase 16: Enhanced Watch Configuration - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can add a watch selector by email domain (e.g., @acme.com); the app resolves matching users from Jira at configuration time and stores the resulting user list. This is a bulk-add tool for the existing watched users feature — not a new watch mechanism.

</domain>

<decisions>
## Implementation Decisions

### Domain input UX
- **D-01:** Domain selector lives inside the existing "Watched Users" section in SettingsPage as a sub-section below the individual user search — keeps all watch config in one place
- **D-02:** Auto-prepend @ and validate format — user types "acme.com" or "@acme.com", both accepted. Invalid formats (no dot, special chars) show inline error

### Resolution & confirmation flow
- **D-03:** After entering a domain and triggering search, the app queries Jira for users matching that email domain and presents results for confirmation before adding

### Privacy warning
- **D-04:** When Jira Cloud email privacy hides addresses, display an inline yellow warning banner below search results explaining the privacy issue and suggesting the user contact their Jira admin. Non-blocking — user can still add users manually

### Storage & integration
- **D-05:** Dedup silently — single entry per user regardless of how they were added (domain vs manual). No duplicates in the watchedUsers list

### Claude's Discretion
- Results UI design: how matched users are presented (table, chips, etc.) and selection mechanism (checkboxes, select-all, pre-selected removable chips)
- Search UX: whether results appear inline below input, in a modal, or another pattern
- Privacy warning trigger timing: on empty results only vs always for Cloud connections vs pre-check
- Storage model: whether domain-resolved users merge into the same flat watchedUsers list or use separate storage with domain rule tracking (decision should weigh simplicity vs re-resolve capability)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Watch configuration requirements
- `.planning/REQUIREMENTS.md` — WTCH-01 (domain selector), WTCH-02 (config-time resolution with confirmation)
- `.planning/ROADMAP.md` Phase 16 — Success criteria, dependency on Phase 13

### Existing watch infrastructure
- `src/features/connections/SettingsPage.tsx` — Current Watched Users section with individual user search typeahead (lines ~210-750)
- `src/features/tickets/ticketStore.ts` — `watchedUsers` state, `setWatchedUsers`, `hydrateFetchConfig`
- `src-tauri/src/triage_db.rs` — `FetchConfig.watched_users: Vec<String>`, SQLite schema, persistence
- `src-tauri/src/commands.rs` — `search_jira_users` command (Jira Server v2 API: `/rest/api/2/user/search`)
- `src-tauri/src/poll_engine.rs` — `build_jql` uses `watched_users` for `all_watched` preset JQL

### Jira Cloud email privacy concern
- `.planning/STATE.md` Blockers section — "Jira Cloud email privacy behavior under different org/PAT settings is unvalidated"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SettingsPage.tsx` Watched Users section: typeahead search pattern with debounced input, suggestion dropdown, add/remove handlers — can be extended for domain input
- `search_jira_users` Tauri command: searches Jira Server v2 API by username — needs Cloud equivalent or adaptation for email domain search
- `SectionCard` component: consistent settings section wrapper used throughout SettingsPage
- `useTicketStore` Zustand store: `watchedUsers` state with `setWatchedUsers` setter and `persistFetchConfigWith` helper

### Established Patterns
- Settings sections use nav sidebar items mapped to `activeSection` state with `SectionCard` rendering
- User search uses debounced `useEffect` with `invoke<JiraUser[]>('search_jira_users', ...)` pattern
- All settings changes persist immediately (no save button) — consistent with language/theme/poll frequency toggles
- i18n keys follow `settings.{section}.{key}` pattern

### Integration Points
- New domain input UI integrates into existing Watched Users section (SettingsPage.tsx ~line 651)
- New Rust command needed for Jira Cloud user search by email domain (or adapt existing `search_jira_users`)
- Results merge into `watchedUsers` array via `setWatchedUsers` — same dedup logic as individual add
- Mock server (`mock_server.rs`) needs Cloud user search endpoint for testing

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-enhanced-watch-configuration*
*Context gathered: 2026-03-29*
