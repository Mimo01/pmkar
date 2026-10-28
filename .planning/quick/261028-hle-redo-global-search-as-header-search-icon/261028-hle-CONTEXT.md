# Quick Task 261028-hle: Redo global search as header search icon opening a search modal overlay - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Task Boundary

Redo the Phase 37.3 global ticket search UI. Remove the inline header search field (`AppShell` → `role="search"` wrapper around `GlobalSearch`). Add a search icon button to the header icon toolbar on the right; clicking it opens a search modal/overlay that holds the input and results. Search logic (`searchIndex`, `useSearchCorpus`, `SearchResultRow`, `Highlight`, `searchStore`, debouncing, ARIA combobox keyboard nav, live announcements, `onOpenTicket` contract) is reused, not rewritten.

</domain>

<decisions>
## Implementation Decisions

### Overlay style
- Command palette: centered modal near the top of the window (e.g. ~15vh from top), dimmed backdrop, input on top, results list below. Use existing Radix `src/components/ui/dialog.tsx`.
- Width about 560-640px, max `calc(100vw - 32px)`; results area scrolls (max-h around 480px).
- Escape / backdrop click / close closes the modal. Focus returns to the search icon button on close (Radix default).
- Opening a ticket (Enter or click on a result, when `onOpenTicket` returns true) closes the modal.

### Query persistence
- Keep the query across close/reopen (existing `searchStore`). On open, input is focused and its text is selected so typing replaces it; previous results are shown immediately if the query is long enough.

### Icon placement
- New search icon button is FIRST in the header icon toolbar: Search · Audit/Terminal · Settings. Same style as existing icon buttons (w-7 h-7, lucide `Search` w-[15px] h-[15px], tooltip with label + shortcut hint, `aria-label`, `aria-keyshortcuts`).

### Shortcuts
- Ctrl/Cmd+K and Ctrl/Cmd+F open the modal (and focus+select the input). Still skipped when another modal/dialog is already open (existing `isModalOpen` guard — note the search dialog itself must not block reopening/refocusing; if it is already open, the shortcut just refocuses + selects).

### Claude's Discretion
- Inside the modal, Escape closes the modal (single press). The in-input clear (X) button stays.
- Whether results show while the query is under min chars: show a short hint line (reuse existing i18n where possible; add SK/EN keys if needed, SK uses "tiket").
- Header layout after removing the field: brand left, icons right (justify-between already).
- Update/replace `GlobalSearch.test.tsx` and AppShell tests to the new interaction; keep shortcut tests passing.

</decisions>

<specifics>
## Specific Ideas

- Look and feel like a VS Code / Linear ⌘K palette, but app-native tokens (`bg-brand-surface`, `border-brand-border`, existing focus ring). No undefined tokens (no `brand-accent`; no `text-brand-muted` on text).
- No drag & drop, no hover-revealed actions.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/phases/37.3-global-ticket-search-across-all-categories-by-key-summary-de/37.3-UI-SPEC.md` (result row, typography, colors — still valid for the results list)
- `.planning/phases/37.3-global-ticket-search-across-all-categories-by-key-summary-de/37.3-CONTEXT.md` (D-01..D-17)

</canonical_refs>
</content>
</invoke>
