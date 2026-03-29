# Phase 15: Change Diff View - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Show users what changed on a ticket since it was last fetched. Two deliverables: (1) a visual indicator in the ticket list marking tickets with unseen changes, and (2) a field-level diff panel in the ticket detail view showing old and new values for each changed field. The diff engine and snapshot storage already exist from Phase 12. This phase is UI-only — no new Rust data layer work beyond adding a "seen" flag.

</domain>

<decisions>
## Implementation Decisions

### Change indicator in ticket list
- **D-01:** Colored dot next to the ticket key in TicketCard — subtle, Linear-style unread indicator
- **D-02:** Dot positioned immediately after the ticket key text (e.g., "CUST-123 ●")
- **D-03:** Tooltip on hover showing brief change summary (e.g., "3 changes: status, priority, comments") — uses existing Tooltip component

### Diff panel placement
- **D-04:** New "Changes" tab added as 6th tab in TicketDetailPanel, alongside overview/comments/worklog/attachments/history
- **D-05:** Changes tab shows a badge count when unseen changes exist
- **D-06:** When opening a ticket that has pending changes, auto-switch to the Changes tab (instead of defaulting to Overview)

### Diff visual format
- **D-07:** Table rows with arrow format — each changed field as a row: Field | Old Value | → | New Value
- **D-08:** Color coding: old value in muted text (gray), new value in normal/slightly accented text — works in both light and dark mode
- **D-09:** For long-text fields (description), show "Description changed" indicator only — no inline diff of full text content

### Change state lifecycle
- **D-10:** Changed indicator clears when user views the Changes tab — like marking an email as read. Viewing other tabs does not clear it
- **D-11:** Changed state persists in SQLite (SnapshotDb) via a `has_unseen_changes` flag per ticket — survives app restarts
- **D-12:** When a field changes multiple times between user views, show the original old value (from when the ticket was last "seen") vs current new value — e.g., Open→In Progress→Done shows "Open → Done"

### Claude's Discretion
- Dot color choice (blue, amber, or brand accent) and size
- Exact table layout and spacing in the Changes tab
- How to store the "last seen snapshot" reference in SnapshotDb (separate column vs. separate table)
- i18n keys structure for change-related strings
- Empty state for Changes tab when no changes detected
- How to fetch FieldChange data from Rust to frontend (new Tauri command or reuse existing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Change tracking requirements
- `.planning/REQUIREMENTS.md` — CHNG-01 (field-level diff on detail page), CHNG-02 (visual indicator in ticket list)
- `.planning/ROADMAP.md` Phase 15 — Success criteria: badge in list, diff panel in detail, comment/worklog changes included

### Snapshot data layer (Phase 12 deliverables)
- `src-tauri/src/snapshot_db.rs` — `FieldChange` struct (field, old_value, new_value), `check_for_changes()`, `detect_changes()`, `WATCHED_FIELDS` constant, `SnapshotDb` struct
- `src-tauri/src/commands.rs` — Existing Tauri command returning `Vec<FieldChange>` (line ~1921)

### Poll engine (Phase 13 deliverables)
- `src-tauri/src/poll_engine.rs` — `PollCompletePayload.changed_keys` emitted after each poll cycle — frontend listens for changed ticket keys

### Ticket UI components
- `src/features/tickets/TicketCard.tsx` — Current card layout with key, summary, status, priority, dates
- `src/features/tickets/TicketDetailPanel.tsx` — Tab system (TabId type, 5 existing tabs), detail loading, tab switching logic
- `src/features/tickets/tabs/HistoryTab.tsx` — Existing tab pattern to follow for the new Changes tab
- `src/features/tickets/TicketListPage.tsx` — List rendering, poll event listener integration point

### UI primitives
- `src/components/ui/tooltip.tsx` — Tooltip component for change summary hover
- `src/components/ui/badge.tsx` — Badge component for tab change count

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FieldChange` struct in Rust — already has field, old_value, new_value; directly maps to table rows
- `SnapshotDb` — stores ticket snapshots; needs minor extension for "seen" state
- `Badge` component (shadcn) — for change count on the tab
- `Tooltip` / `TooltipProvider` — already used in TicketDetailPanel for copy button
- `HistoryTab` pattern — fetch data via `invoke()`, loading/error states, same structure to replicate

### Established Patterns
- Tab system uses `TabId` union type and `activeTab` state in TicketDetailPanel
- Data fetching in tabs via `@tauri-apps/api/core` `invoke()` with useEffect
- i18n via `useTranslation()` hook with namespaced keys (e.g., `detail.tabs.history`)
- Zustand stores for cross-component state (ticketStore, copyStore)
- Brand color tokens: `text-brand-muted`, `bg-brand-surface-hover`, `border-brand-border`

### Integration Points
- `TicketCard` — add dot element after ticket key span (line ~33)
- `TicketDetailPanel` — extend `TabId` type, add Changes tab button and panel
- `ticketStore` or new store — track which tickets have unseen changes (hydrated from SQLite on startup, updated on poll events)
- `PollCompletePayload` listener — existing `listen('poll-complete')` in TicketListPage can trigger change state updates

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

*Phase: 15-change-diff-view*
*Context gathered: 2026-03-29*
