# Quick 261028-hle: Global search as header icon + command-palette modal - Research

**Researched:** 2026-10-28
**Domain:** Radix Dialog hosting an ARIA combobox; global keyboard shortcut; test migration
**Confidence:** HIGH (all claims checked against repo source and installed `node_modules`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Command palette: centered modal near the top of the window (~15vh), dimmed backdrop, input on top, results below. Use existing Radix `src/components/ui/dialog.tsx`.
- Width ~560-640px, max `calc(100vw - 32px)`; results scroll (max-h ~480px).
- Escape / backdrop click / close closes the modal. Focus returns to the search icon button on close (Radix default).
- Opening a ticket (Enter or click on a result, when `onOpenTicket` returns true) closes the modal.
- Keep the query across close/reopen (`searchStore`). On open, input focused with text selected; previous results shown immediately if query long enough.
- Search icon button FIRST in header toolbar: Search · Audit/Terminal · Settings. Same style (w-7 h-7, lucide `Search` w-[15px] h-[15px], tooltip with label + shortcut hint, `aria-label`, `aria-keyshortcuts`).
- Ctrl/Cmd+K and Ctrl/Cmd+F open the modal (focus+select input). Skipped when another modal is open; the search dialog itself must not block — if already open, the shortcut refocuses + selects.

### Claude's Discretion
- Inside the modal, Escape closes the modal (single press). In-input clear (X) button stays.
- Under-min-chars: show a short hint line (reuse i18n where possible; add SK/EN keys if needed, SK uses "tiket").
- Header layout: brand left, icons right (justify-between already).
- Update/replace `GlobalSearch.test.tsx` and AppShell tests; keep shortcut tests passing.

### Deferred Ideas (OUT OF SCOPE)
- None listed. Also: no DnD, no hover-revealed actions, no `brand-accent`, no `text-brand-muted` on text.
</user_constraints>

## Summary

Put the existing `GlobalSearch` combobox inside a new `SearchDialog` launcher component (icon button + tooltip + Radix `Dialog` + shortcut hook). The launcher owns `open` as **local state**; no store change is needed because every successful navigation closes the dialog anyway, and an AppShell remount (App.tsx early-return branches) resetting it to closed is the desired behaviour. The query keeps living in `searchStore`.

Three non-obvious things drive the plan: (1) Radix's Escape handler runs in the **document capture phase** and calls `preventDefault()` before the input's React `onKeyDown` fires, so the combobox's own Escape branch would still run and **clear the query** unless it is removed/guarded. (2) Radix `hideOthers` sets `aria-hidden` on everything outside the portal, including the app-level `<LiveAnnouncer />`, so result-count announcements would be silent while the modal is open. (3) `isModalOpen()` matches the search dialog itself (`role="dialog"` + `data-state="open"`), so the shortcut must exclude it explicitly.

**Primary recommendation:** New `src/features/search/SearchDialog.tsx` rendered by AppShell only when `onOpenTicket` is set; GlobalSearch becomes an always-expanded "inline" combobox (no click-outside, no absolute dropdown, no Tab/Escape branches) that accepts an external `inputRef` and an `onOpenTicket` already wrapped to close the dialog on `true`.

## Architectural Responsibility Map

| Capability | Owner | Rationale |
|---|---|---|
| Open/close state, focus-on-open, shortcut | `SearchDialog` (new, client) | Always mounted with AppShell; GlobalSearch only mounts while open |
| Query persistence | `searchStore` (unchanged) | Survives AppShell remounts |
| Combobox, debounce, results, announcements | `GlobalSearch` (trimmed) | Logic reused, only dropdown chrome removed |
| Navigation decision | `App.openTicketFromSearch` (unchanged) | Returns bool; launcher closes on `true` |

## Verified Facts (repo + node_modules)

| Fact | Source |
|---|---|
| `@radix-ui/react-dialog` 1.1.15 installed | `node_modules/@radix-ui/react-dialog/package.json` [VERIFIED] |
| Escape listener is `ownerDocument.addEventListener('keydown', h, { capture: true })` | `react-use-escape-keydown/dist/index.mjs:12` [VERIFIED] |
| DismissableLayer: `onEscapeKeyDown?.(e); if (!e.defaultPrevented) { e.preventDefault(); onDismiss(); }` | `react-dismissable-layer/dist/index.mjs:59-66` [VERIFIED] |
| Modal content calls `hideOthers(content)` (aria-hidden on siblings) | `react-dialog/dist/index.mjs:137` [VERIFIED] |
| Content gets `role="dialog"` + `aria-describedby`; no `aria-modal` | `react-dialog/dist/index.mjs:223-225` [VERIFIED] |
| Missing-description warning suppressed by `aria-describedby={undefined}`; missing Title -> console.error | `react-dialog/dist/index.mjs:280-306` [VERIFIED]; repo pattern in `dialog.test.tsx` |
| Tooltip trigger `onFocus: if (!isPointerDownRef.current) context.onOpen()` | `react-tooltip/dist/index.mjs:202-203` [VERIFIED] |
| No `tailwindcss-animate`/`tw-animate-css` in `package.json`/`index.css` -> `animate-in`/`slide-in-*` classes in dialog.tsx are no-ops, Presence unmounts immediately on close | `package.json`, `src/index.css` [VERIFIED] |
| Detail page/panel Escape listeners are bubble-phase on `document` and check `!e.defaultPrevented` | `TicketDetailPage.tsx:108-118`, `TicketDetailPanel.tsx:126-136` [VERIFIED] |
| `jsdom` test-setup already polyfills pointer capture + `scrollIntoView` | `src/test-setup.ts` [VERIFIED] |

## Architecture Patterns

### Data flow
```
Click icon / Ctrl|Cmd+K|F (window keydown)
   -> isOtherModalOpen()? yes -> ignore
   -> setOpen(true)  (or, if already open: input.focus(); input.select())
Dialog onOpenAutoFocus -> preventDefault; inputRef.focus(); inputRef.select()
GlobalSearch (mounted fresh): debounced = store.query -> results render inline
Enter/click hit -> wrapped onOpenTicket(key)
   true  -> setOpen(false) -> App navigates (may remount AppShell)
   false -> stay open (copy flow active)
Escape / overlay click -> Radix closes -> focus back to trigger
```

### SearchDialog skeleton
```tsx
// src/features/search/SearchDialog.tsx
const [open, setOpen] = useState(false);
const inputRef = useRef<HTMLInputElement>(null);
useSearchShortcut(() => {
  if (open) { inputRef.current?.focus(); inputRef.current?.select(); }
  else setOpen(true);
});
const handleOpen = (key: string) => { const ok = onOpenTicket(key); if (ok) setOpen(false); return ok; };

<Dialog open={open} onOpenChange={setOpen}>
  <Tooltip>
    <TooltipTrigger asChild>
      <DialogTrigger asChild>
        <button type="button" aria-label={t('search.open')} aria-keyshortcuts="Control+K Meta+K Control+F Meta+F" className="...same as Settings button...">
          <Search className="w-[15px] h-[15px]" aria-hidden="true" />
        </button>
      </DialogTrigger>
    </TooltipTrigger>
    <TooltipContent aria-hidden="true">{t('search.open')} {shortcutHint()}</TooltipContent>
  </Tooltip>
  <DialogContent
    data-search-dialog=""
    hideClose
    aria-describedby={undefined}
    className="top-[15vh] translate-y-0 w-[600px] max-w-[calc(100vw-32px)] p-0 gap-0 bg-brand-surface border-brand-border rounded-lg overflow-hidden"
    onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }}
  >
    <DialogTitle className="sr-only">{t('search.label')}</DialogTitle>
    <GlobalSearch inputRef={inputRef} onOpenTicket={handleOpen} />
    <LiveAnnouncer />  {/* see Pitfall 2 */}
  </DialogContent>
</Dialog>
```
- `DialogTrigger` nested in `TooltipTrigger asChild` composes via Slot; Radix then returns focus to the trigger on close (the locked "Radix default"). When opened by shortcut, the trigger is still the return target because `DialogTrigger` registers `triggerRef`.
- `tailwind-merge` 3.x resolves `top-[50%]`->`top-[15vh]` and `translate-y-[-50%]`->`translate-y-0`; the slide/zoom animation classes are inert (no plugin), so no override needed.
- Render `SearchDialog` inside AppShell's existing `TooltipProvider`, first child. Delete the `role="search"` wrapper div.

### GlobalSearch changes (reuse, do not rewrite)
- Accept optional `inputRef?: RefObject<HTMLInputElement | null>` prop (fallback to internal ref); remove `useSearchShortcut(inputRef)` call (moves to launcher).
- `activated` initial state `true` (mounting == user opened search), otherwise `useSearchCorpus(false)` is not ready and the "previous results shown immediately" decision fails.
- `debounced` is already `useState(query)` -> reopen shows prior results with no debounce delay. Good.
- Drop the dropdown concept: `panelVisible = ready && debounced.trim().length >= SEARCH_MIN_CHARS` (no `open`). Keep a `navigatedRef`/flag in place of `open` for the WR-01 "no announce after navigation" guard (the debounce timer is cleared on unmount anyway since Presence unmounts synchronously, but the refused-then-retype path still needs the count).
- Delete: click-outside `mousedown` effect + `wrapperRef`, `Tab` case, `Escape` case, the ArrowDown "re-open" branch, and the `absolute left-0 top-full mt-1 w-[560px] ... z-50 shadow-lg` panel wrapper -> replace with an in-flow `max-h-[480px] overflow-y-auto border-t border-brand-border` block.
- Under-min-chars hint: when `query.trim().length < SEARCH_MIN_CHARS`, render a `text-xs text-brand-text-secondary` line, new key `search.hint.minChars` (EN "Type at least 2 characters to search tickets", SK "Zadajte aspoň 2 znaky na hľadanie tiketov"). Use `{{count}}`-free text or pass `SEARCH_MIN_CHARS` as `{{min}}` in both locales (placeholder parity is tested).
- Input styling: larger palette input (h-11, `text-base`, no border, `focus:outline-none`, `border-b border-brand-border` on the wrapper). Keep the X clear button; replace the `⌘K` kbd hint inside the input with nothing (hint now lives in the tooltip).
- `aria-keyshortcuts` moves to the icon button; the existing GlobalSearch test asserts it on the input — either keep on both or update the test.

### Shortcut changes (`shortcut.ts`)
```ts
const SEARCH_DIALOG_ATTR = 'data-search-dialog';
export function isModalOpen(): boolean {
  return Array.from(document.querySelectorAll(MODAL_SELECTOR))
    .some((el) => !el.closest(`[${SEARCH_DIALOG_ATTR}]`));
}
export function useSearchShortcut(onActivate: () => void): void { /* same guards; e.preventDefault(); onActivate(); */ }
```
- Store `onActivate` in a ref (`useRef` + assign each render) so the window listener is attached once and always sees current `open`.
- Radix passes `data-*` props to the content element, so `data-search-dialog` lands on the `role="dialog"` node. [VERIFIED: dialog.tsx spreads `...props` onto `DialogPrimitive.Content`]
- Only mount the hook when `onOpenTicket` exists (setup wizard has no search) — satisfied by rendering `SearchDialog` conditionally.

## Common Pitfalls

### 1. Escape clears the persisted query
**What goes wrong:** Radix (capture) closes the dialog and `preventDefault`s; the event still bubbles to the input's React `onKeyDown`, whose `Escape` branch runs `clearQuery()` (dropdown `open` is not the gate any more). Query persistence breaks.
**Avoid:** Remove the `Escape` case entirely (or `if (e.defaultPrevented) return`). Do not stop propagation in `onEscapeKeyDown`; the `defaultPrevented` flag is what keeps `TicketDetailPage`/`TicketDetailPanel` from also navigating back.
**Test:** in detail view, open search, Esc -> dialog gone, `selectedTicketKey` unchanged, reopen -> input value intact.

### 2. Live announcements are silenced by `hideOthers`
**What goes wrong:** `<LiveAnnouncer />` lives in `#root` beside AppShell; while the modal is open it carries `aria-hidden="true"` and screen readers drop `search.live.count`.
**Avoid:** Render `<LiveAnnouncer />` inside `DialogContent` (it already ignores the nonce present at mount, so no stale re-announce). Testing Library `getByRole('status')` skips aria-hidden nodes, so tests see only the in-dialog one.

### 3. Tooltip pops on focus return
**What goes wrong:** After close, Radix focuses the trigger; Tooltip `onFocus` opens unless a pointerdown is in flight (it is not after an Escape or after a click+close cycle). Same class of bug as quick WR-01 (7f5f380).
**Avoid:** Control the tooltip: `const suppressTip = useRef(false)`; set true in `onOpenChange(false)`; Tooltip `open={tipOpen}` / `onOpenChange={(o) => { if (o && suppressTip.current) { suppressTip.current = false; return; } setTipOpen(o); }}`. Also keep tooltip closed while dialog `open`. Verify manually in WebView2.

### 4. Shortcut self-blocking
`isModalOpen()` matches the open search dialog -> Ctrl+K inside the palette does nothing (focus stays but text not selected). Fix via `data-search-dialog` exclusion above; add a shortcut test for it.

### 5. Same-branch navigation does not remount
Detail -> another detail keeps the same AppShell instance (App.tsx detail branch), so relying on remount to close fails. Always close via the wrapped `onOpenTicket` on `true`.

### 6. Zustand selector stable refs
Keep scalar selectors (`s.query`, `s.setQuery`); never `?? []` / object literals in a selector (project memory). Do not add `open` to `searchStore`.

### 7. Radix + jsdom
- Modal sets `pointer-events: none` on `body`; `userEvent.click` on anything outside the content throws while open. Close first (Esc) before clicking header buttons in App tests.
- Outside nodes are aria-hidden while open -> `getByRole('button', { name: 'Settings' })` fails; query before opening.
- Always render `DialogTitle` (sr-only) and pass `aria-describedby={undefined}` or Radix logs errors/warnings in test output.

## Tests: what breaks and how to adapt

| File | Breaks | Adaptation |
|---|---|---|
| `src/features/search/__tests__/shortcut.test.tsx` | `Probe` passes a ref | Probe passes `() => { ref.current?.focus(); ref.current?.select(); }`; all existing cases keep asserting focus/selection. Add: `<div role="dialog" data-state="open" data-search-dialog>` does NOT block. |
| `src/features/search/__tests__/GlobalSearch.test.tsx` (435 lines) | "starts collapsed", "opens only after focus", Escape 3-step, Tab closes, mousedown outside, "does not auto-open on remount", ArrowDown re-open, `aria-keyshortcuts` on input | Delete Escape/Tab/mousedown/remount-collapsed cases. Rewrite "opens only for 2+ chars" as "shows hint under 2 chars, listbox after debounce" (no focus needed). "Remount" -> "mount with stored query shows results immediately". Keep all Enter/CR-01*/WR-01* cases (they use `type()` which calls focus — harmless). Add: Escape on input does not clear query. |
| New `src/features/search/__tests__/SearchDialog.test.tsx` | — | icon click opens, input focused + selected (`selectionStart 0 / selectionEnd len`); Ctrl+K opens; Ctrl+K while open reselects; blocked by other `role=dialog`; Esc closes and focus returns to button; `onOpenTicket` true closes, false keeps open; axe on open dialog (`AXE_OPTIONS` region disabled as existing). Mock `useSearchCorpus` like GlobalSearch.test. |
| `src/App.search.test.tsx` | `getByRole('search')` landmark test; `searchFor()` finds combobox directly; "returns to tab... keeps query" reads combobox without opening; "Esc ... closes dropdown" | `searchFor`: click `button {name: 'Search tickets'}` (new label) then find combobox. Landmark test -> "shows the search button and opens a dialog with the combobox". Setup-wizard test: assert no search button. Esc test: `queryByRole('dialog')` gone + still in detail. Copy-flow test: dialog + listbox still present. |
| `src/components/ui/__tests__/AppShell.navKeys.test.tsx` | Nothing (no `onOpenTicket` passed) | Optional: add a toolbar-order test (Search before Terminal before Settings) with `onOpenTicket`. |
| `src/i18n/__tests__/searchLocale.test.ts` | Nothing if keys added to both locales with equal placeholders; `>= 24` keys still holds | Remove `search.regionLabel` from both locales (now unused). SK strings must not contain "úloh". |

No e2e/Playwright suite exists (`package.json` has only `vitest run`). [VERIFIED]

### i18n keys
- Add (EN/SK): `search.open` ("Search tickets" / "Hľadať tikety"), `search.hint.minChars` (see above). `search.label` stays as DialogTitle + input aria-label.
- Remove: `search.regionLabel` (both).
- `noLiteralStrings.test.ts` exists — keep all visible text in `t()`.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest 4.1 + jsdom 29 + Testing Library + vitest-axe |
| Quick run | `npx vitest run src/features/search src/App.search.test.tsx src/i18n/__tests__/searchLocale.test.ts` |
| Full suite | `npm test` |

## Security Domain
No new trust boundary: client-only UI change, no new inputs beyond the existing local query. V5 input handling unchanged (search is in-memory; wiki/macro regex bounds from 37.3 WR-02 untouched).

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Nesting `DialogTrigger asChild` inside `TooltipTrigger asChild` composes handlers/refs correctly in Radix 1.1.x [ASSUMED, common shadcn pattern] | Tooltip or dialog trigger misbehaves; fallback: no `DialogTrigger`, controlled open + manual `onCloseAutoFocus` focusing a button ref |
| A2 | Real screen readers ignore updates to an `aria-hidden` live region [ASSUMED] | Pitfall 2 mitigation is harmless either way |
| A3 | SK/EN wording for new keys [ASSUMED] | Copy tweak only |

## Sources
- Installed packages: `@radix-ui/react-dialog@1.1.15`, `react-dismissable-layer`, `react-use-escape-keydown`, `react-tooltip` dist files (lines cited above)
- Repo: `src/components/ui/AppShell.tsx`, `dialog.tsx`, `src/features/search/*`, `src/App.tsx`, `src/App.search.test.tsx`, `TicketDetailPage.tsx`, `TicketDetailPanel.tsx`, `ConfirmTransitionDialog.tsx` (onOpenAutoFocus pattern), `LiveAnnouncer.tsx`, `src/test-setup.ts`, commit 7f5f380

**Valid until:** 2026-11-27
