---
phase: quick-261028-hle
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/search/shortcut.ts
  - src/features/search/GlobalSearch.tsx
  - src/features/search/SearchDialog.tsx
  - src/components/ui/AppShell.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/features/search/__tests__/shortcut.test.tsx
  - src/features/search/__tests__/GlobalSearch.test.tsx
  - src/features/search/__tests__/SearchDialog.test.tsx
  - src/App.search.test.tsx
  - src/components/ui/__tests__/AppShell.navKeys.test.tsx
autonomous: true
requirements: [QUICK-261028-hle]

must_haves:
  truths:
    - "Header no longer shows an inline search field; brand on the left, icon toolbar on the right in order Search, Audit/Terminal, Settings"
    - "Clicking the search icon opens a centered command-palette dialog near the top (~15vh) with a dimmed backdrop, input on top and results below"
    - "Ctrl/Cmd+K and Ctrl/Cmd+F open the dialog with the input focused and its text selected; pressing them while the palette is open re-focuses and re-selects; they do nothing while a different dialog is open"
    - "The query survives close/reopen, and reopening with a query of 2+ characters shows the previous results right away"
    - "Escape, a backdrop click or the close action closes the palette without clearing the query, and focus returns to the search icon button; Escape does not also navigate back out of ticket detail"
    - "Opening a ticket (Enter or click) closes the palette when onOpenTicket returns true and keeps it open when it returns false"
    - "Under 2 characters the palette shows a short hint line; result-count announcements still reach screen readers while the modal is open"
  artifacts:
    - path: "src/features/search/SearchDialog.tsx"
      provides: "Icon button + tooltip + Radix Dialog launcher hosting GlobalSearch, owns open state and shortcut"
      exports: ["SearchDialog"]
    - path: "src/features/search/shortcut.ts"
      provides: "useSearchShortcut(onActivate) callback API; isModalOpen ignores [data-search-dialog]"
      contains: "data-search-dialog"
    - path: "src/features/search/GlobalSearch.tsx"
      provides: "Always-expanded inline combobox (no dropdown, no click-outside, no Tab/Escape branches), optional external inputRef"
    - path: "src/features/search/__tests__/SearchDialog.test.tsx"
      provides: "Open/close/focus/shortcut/navigation/axe coverage for the palette"
  key_links:
    - from: "src/components/ui/AppShell.tsx"
      to: "src/features/search/SearchDialog.tsx"
      via: "rendered as first child inside the header TooltipProvider when onOpenTicket is set"
      pattern: "<SearchDialog"
    - from: "src/features/search/SearchDialog.tsx"
      to: "src/features/search/GlobalSearch.tsx"
      via: "inputRef + wrapped onOpenTicket that closes the dialog on true"
      pattern: "<GlobalSearch"
    - from: "src/features/search/SearchDialog.tsx"
      to: "src/features/search/shortcut.ts"
      via: "useSearchShortcut(onActivate)"
      pattern: "useSearchShortcut\\("
---

<objective>
Replace the inline header search field from Phase 37.3 with a search icon button (first in the header toolbar) that opens a Radix-Dialog command palette containing the existing GlobalSearch combobox and results. Search logic (searchIndex, useSearchCorpus, SearchResultRow, Highlight, searchStore, debounce, combobox keyboard nav, live announcements, onOpenTicket contract) is reused, not rewritten.

Purpose: The inline field took up header space. A ⌘K-style palette gives search more room and keeps the header minimal.
Output: New `SearchDialog.tsx`, a trimmed `GlobalSearch.tsx`, a callback-based `useSearchShortcut`, updated AppShell, i18n keys, and migrated tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261028-hle-redo-global-search-as-header-search-icon/261028-hle-CONTEXT.md
@.planning/quick/261028-hle-redo-global-search-as-header-search-icon/261028-hle-RESEARCH.md
@.planning/phases/37.3-global-ticket-search-across-all-categories-by-key-summary-de/37.3-UI-SPEC.md
@src/features/search/GlobalSearch.tsx
@src/features/search/shortcut.ts
@src/components/ui/AppShell.tsx
@src/components/ui/dialog.tsx

<interfaces>
From src/features/search/shortcut.ts (current):
- `SHORTCUT_HINT_MAC = '⌘K'`, `SHORTCUT_HINT_OTHER = 'Ctrl K'`, `isMacPlatform()`, `shortcutHint()`
- `MODAL_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [aria-modal="true"]'`
- `isModalOpen(): boolean` — `document.querySelector(MODAL_SELECTOR) !== null`
- `useSearchShortcut(inputRef: RefObject<HTMLInputElement | null>): void` — window keydown, guards: ctrl|meta, no alt/shift, not defaultPrevented, key k|f, `!isModalOpen()`; then preventDefault + focus + select.

From src/features/search/GlobalSearch.tsx (current):
- `interface GlobalSearchProps { onOpenTicket: (key: string) => boolean }`, `export function GlobalSearch(...)`
- internal: `activated` state (false initially, feeds `useSearchCorpus(activated)`), `wrapperRef` + mousedown click-outside effect, `useSearchShortcut(inputRef)` call, keydown switch with `Escape` and `Tab` cases, absolute dropdown panel.

From src/components/ui/dialog.tsx:
- `DialogContent` accepts `hideClose?: boolean` and spreads other props (incl. `data-*`) onto `DialogPrimitive.Content`. Exports Dialog, DialogTrigger, DialogContent, DialogTitle, etc.

From src/components/ui/AppShell.tsx:
- prop `onOpenTicket?: (key: string) => boolean`; lines ~65-72 render `<div role="search" aria-label={t('search.regionLabel')}><GlobalSearch .../></div>` when set; lines ~78-109 a `TooltipProvider delayDuration={300}` holding Audit (`aria-label={t('audit.open')}`) and Settings (`aria-label={t('common.settings')}`) icon buttons.

Locales: `src/i18n/locales/en.json`, `src/i18n/locales/sk.json` (`search.regionLabel` is only used by AppShell).
LiveAnnouncer component is rendered at App level; see RESEARCH Pitfall 2.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Callback-based shortcut + always-expanded GlobalSearch</name>
  <files>src/features/search/shortcut.ts, src/features/search/GlobalSearch.tsx, src/features/search/__tests__/shortcut.test.tsx, src/features/search/__tests__/GlobalSearch.test.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <behavior>
    - shortcut: Ctrl+K / Meta+K / Ctrl+F / Meta+F call onActivate and preventDefault; alt/shift/defaultPrevented/other keys ignored
    - shortcut: an open `[role=dialog][data-state=open]` without `data-search-dialog` blocks; one that has (or is inside) `[data-search-dialog]` does NOT block
    - GlobalSearch: with query under 2 chars renders the `search.hint.minChars` line and no listbox
    - GlobalSearch: mounting with a stored 2+ char query shows the listbox immediately (no focus, no debounce wait)
    - GlobalSearch: Escape keydown on the input does not clear the query
    - GlobalSearch: existing Enter / CR-01* / WR-01* (no announce after navigation) cases still pass
    - GlobalSearch: when given an external `inputRef`, that ref points at the combobox input
  </behavior>
  <action>
    In `shortcut.ts`: change `isModalOpen()` to return true only if some element matching MODAL_SELECTOR is not inside `[data-search-dialog]` (use `querySelectorAll` + `el.closest('[data-search-dialog]')`; export a `SEARCH_DIALOG_ATTR = 'data-search-dialog'` constant). Change `useSearchShortcut` signature to `(onActivate: () => void)`; keep all existing guards; store onActivate in a ref updated each render so the window listener attaches once (empty deps) and always calls the latest callback. Per CONTEXT shortcut decision, the search dialog itself must not block re-activation.

    In `GlobalSearch.tsx` (reuse, do not rewrite search logic): add optional prop `inputRef?: React.RefObject<HTMLInputElement | null>` (fall back to an internal ref). Remove the `useSearchShortcut` call (moves to the launcher). Initialise `activated` to true so `useSearchCorpus` is ready on mount (mount == user opened the palette). Remove the dropdown concept: delete `wrapperRef` and the mousedown click-outside effect, the `Tab` and `Escape` keydown cases (RESEARCH Pitfall 1 — Radix closes on Escape in capture phase; the input must not clear the query), and the ArrowDown "re-open" branch; panel visibility becomes `ready && debounced.trim().length >= SEARCH_MIN_CHARS`. Keep the WR-01 guard (no count announcement after Enter navigated) using a navigated flag/ref in place of the old `open` state. Replace the absolutely positioned `w-[560px] ... z-50 shadow-lg` panel with an in-flow block `max-h-[480px] overflow-y-auto border-t border-brand-border`. Palette input styling: wrapper `border-b border-brand-border`, input roughly `h-11 text-base bg-transparent border-0 focus:outline-none` with the leading search icon kept, X clear button kept, the inline kbd shortcut hint removed (hint moves to the icon tooltip). Remove `aria-keyshortcuts` from the input (it moves to the icon button). When `query.trim().length < SEARCH_MIN_CHARS` render a hint line `px-3 py-2 text-xs text-brand-text-secondary` with `t('search.hint.minChars', { min: SEARCH_MIN_CHARS })`. Do not use `text-brand-muted` on text or any `brand-accent` token. Keep Zustand selectors scalar (no `?? []` in selectors).

    i18n: add `search.hint.minChars` to both locales with the same `{{min}}` placeholder — EN "Type at least {{min}} characters to search tickets", SK "Zadajte aspoň {{min}} znaky na hľadanie tiketov" (SK uses "tiket", never "úloh"). Add `search.open` now too — EN "Search tickets", SK "Hľadať tikety". Leave `search.regionLabel` in place for now (removed in Task 2 together with its AppShell usage).

    Tests: update `shortcut.test.tsx` Probe to pass a callback that focuses+selects its input; keep all existing cases; add the `data-search-dialog` non-blocking case. In `GlobalSearch.test.tsx` delete the collapsed/opens-on-focus, Escape 3-step, Tab-closes, mousedown-outside, remount-collapsed, ArrowDown re-open and input `aria-keyshortcuts` cases; rewrite them per the behavior list above; keep all Enter/CR-01*/WR-01* cases.
  </action>
  <verify>
    <automated>npx vitest run src/features/search src/i18n/__tests__</automated>
  </verify>
  <done>shortcut and GlobalSearch tests pass with the new callback API and always-expanded combobox; i18n locale tests pass with new keys present in EN and SK with matching placeholders.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SearchDialog launcher + AppShell header wiring</name>
  <files>src/features/search/SearchDialog.tsx, src/features/search/__tests__/SearchDialog.test.tsx, src/components/ui/AppShell.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json, src/components/ui/__tests__/AppShell.navKeys.test.tsx</files>
  <behavior>
    - Clicking the "Search tickets" button opens a role=dialog containing the combobox; the input is focused and fully selected (selectionStart 0, selectionEnd = value length)
    - Ctrl+K opens it; Ctrl+K while open re-selects the input text; Ctrl+K is ignored when another non-search dialog is open
    - Escape closes the dialog, focus returns to the search button, query in searchStore is unchanged, tooltip does not pop open on focus return
    - onOpenTicket returning true closes the dialog; returning false keeps it open
    - axe finds no violations on the open dialog (use the existing AXE_OPTIONS pattern)
    - AppShell with onOpenTicket renders no role=search landmark and the toolbar order is Search, Audit/Terminal, Settings; without onOpenTicket no search button renders
  </behavior>
  <action>
    Create `src/features/search/SearchDialog.tsx` exporting `SearchDialog({ onOpenTicket }: { onOpenTicket: (key: string) => boolean })`, following the RESEARCH "SearchDialog skeleton". Own `open` as local `useState` (do NOT add it to searchStore — RESEARCH Pitfall 6) and an `inputRef`. Call `useSearchShortcut(() => open ? focus+select input : setOpen(true))`. Wrap onOpenTicket: call it, `setOpen(false)` when it returns true, return the boolean (Pitfall 5: same-branch detail navigation does not remount AppShell). Structure: `Dialog open onOpenChange` > `Tooltip` > `TooltipTrigger asChild` > `DialogTrigger asChild` > `button` with `type="button"`, `aria-label={t('search.open')}`, `aria-keyshortcuts="Control+K Meta+K Control+F Meta+F"`, the same className as the existing Settings icon button in AppShell (w-7 h-7) and lucide `Search` icon `w-[15px] h-[15px] aria-hidden`. TooltipContent shows `t('search.open')` plus `shortcutHint()`, `aria-hidden="true"` like siblings. Make the tooltip controlled and suppress the reopen-on-focus-return after close and keep it closed while the dialog is open (RESEARCH Pitfall 3; same bug class as 7f5f380). If A1 (DialogTrigger inside TooltipTrigger) misbehaves, fall back to a plain button with onClick setOpen(true) and `onCloseAutoFocus` focusing a button ref. `DialogContent` gets `data-search-dialog=""`, `hideClose`, `aria-describedby={undefined}`, `onOpenAutoFocus` that preventDefaults then focuses+selects inputRef, and className overriding position/size: `top-[15vh] translate-y-0 w-[600px] max-w-[calc(100vw-32px)] p-0 gap-0 bg-brand-surface border-brand-border rounded-lg overflow-hidden` (backdrop dimming comes from the existing DialogOverlay). Inside: sr-only `DialogTitle` with `t('search.label')`, `<GlobalSearch inputRef={inputRef} onOpenTicket={wrapped} />`, and a `<LiveAnnouncer />` so announcements are not hidden by Radix `hideOthers` (Pitfall 2). Do not stop propagation in `onEscapeKeyDown` — the defaultPrevented flag keeps detail page/panel from navigating back.

    In `AppShell.tsx`: delete the `role="search"` wrapper and GlobalSearch import; render `{onOpenTicket && <SearchDialog onOpenTicket={onOpenTicket} />}` as the first child inside the existing header `TooltipProvider` so order is Search, Audit, Settings. Header stays `justify-between` (brand left, icons right). Remove `search.regionLabel` from both locales.

    Tests: create `SearchDialog.test.tsx` covering the behavior list (mock `useSearchCorpus` the same way GlobalSearch.test does; reset searchStore between tests). In `AppShell.navKeys.test.tsx` add the toolbar-order test and the no-search-button-without-onOpenTicket test.
  </action>
  <verify>
    <automated>npx vitest run src/features/search src/components/ui src/i18n/__tests__</automated>
  </verify>
  <done>SearchDialog tests pass (open via click and shortcut, focus+select, reselect while open, blocked by other dialog, Esc closes with focus return and query kept, close-on-true / stay-on-false, axe clean); AppShell renders the icon first with no inline field; `search.regionLabel` no longer exists in src.</done>
</task>

<task type="auto">
  <name>Task 3: Migrate App-level search tests and run full suite</name>
  <files>src/App.search.test.tsx</files>
  <action>
    Adapt `src/App.search.test.tsx` to the palette interaction per the RESEARCH test table: `searchFor()` first clicks `getByRole('button', { name: 'Search tickets' })` then finds the combobox inside the dialog. Replace the `role=search` landmark test with "shows the search button and opens a dialog with the combobox". Setup-wizard test asserts no search button. The "returns to tab ... keeps query" test reopens the palette and asserts the input value persisted. The Esc test asserts `queryByRole('dialog')` is gone AND the app is still on ticket detail (Escape must not also navigate back). Copy-flow (onOpenTicket returns false) test asserts dialog and listbox remain. Respect Radix+jsdom constraints (RESEARCH Pitfall 7): query header buttons before opening, close the dialog with Esc before clicking anything outside it. Then run the full suite and fix any regressions caused by this change (e.g. noLiteralStrings, searchLocale, other tests referencing `search.regionLabel` or the inline field). Run `npx tsc --noEmit` (or the project's typecheck script) to confirm types.
  </action>
  <verify>
    <automated>npx vitest run src/App.search.test.tsx && npm test && npx tsc --noEmit</automated>
    <human-check>In the desktop app (WebView2): click the search icon, palette appears ~15vh from top with dimmed backdrop; Ctrl+K / Ctrl+F open it with text selected; Esc closes, no tooltip pops on the icon afterwards; reopening shows the previous results; opening a ticket closes the palette.</human-check>
  </verify>
  <done>App.search tests pass against the palette flow; full `npm test` green; typecheck clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Client-only UI restructuring; the search query is local in-memory text against already-loaded data |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-hle-01 | Denial of Service | searchIndex / wikiText regexes | accept | Unchanged by this task; 37.3 WR-02 regex bounds remain untouched |
| T-hle-02 | Tampering | Keyboard shortcut capture | mitigate | Shortcut keeps existing guards (modifier checks, defaultPrevented, other-modal guard) so it cannot hijack keys inside other dialogs |
</threat_model>

<verification>
- `npx vitest run src/features/search src/components/ui src/App.search.test.tsx src/i18n/__tests__` passes
- `npm test` passes; `npx tsc --noEmit` clean
- `grep -rn 'role="search"' src/components/ui/AppShell.tsx` returns nothing; `grep -rn "search.regionLabel" src` returns nothing
- `grep -rn "brand-accent" src/features/search` returns nothing
</verification>

<success_criteria>
- Header shows Search, Audit/Terminal, Settings icons; no inline field
- Palette opens via icon, Ctrl/Cmd+K, Ctrl/Cmd+F with input focused+selected; query persists; Esc/backdrop closes with focus return and no query loss; opening a ticket closes it
- All search logic reused; tests migrated and green
</success_criteria>

<output>
Create `.planning/quick/261028-hle-redo-global-search-as-header-search-icon/261028-hle-SUMMARY.md` when done
</output>
