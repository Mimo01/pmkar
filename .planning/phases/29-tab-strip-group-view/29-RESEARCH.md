# Phase 29: Tab Strip & Group View - Research

**Researched:** 2026-10-12
**Domain:** React 19 + Zustand 5 + Tailwind v4 + shadcn/Radix UI inside a Tauri app (frontend-only phase; Rust commands already exist from Phase 28)
**Confidence:** HIGH (almost entirely codebase-derived; one new dependency, `@radix-ui/react-popover`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `＋` opens a **popover** anchored to it: "New group" title, autofocused name input, inline error line, Cancel and Create buttons. Enter submits, Esc cancels or closes. No inline tab input, no modal.
- **D-02:** After a successful create, **switch to the new group's tab** (the user lands on its empty state).
- **D-03:** Popover asks for the **name only**. Color is auto-assigned as least-used (Phase 28 D-08). The color picker is Phase 30.
- **D-04:** Validation runs **live** with the TS mirror in `src/features/groups/validation.ts`. `duplicate`, `reserved`, `too_long` show an inline message and disable Create. `empty` (including whitespace-only) only disables Create, no message. Rust is authoritative: a Rust error code on submit (race, `no_scope`) is shown inline in the same error line; `internal` gets a generic message.
- **D-05:** Tab anatomy is **color dot · name · muted count** (`● Sprint 12  3`), dot plus neutral text (Phase 28 D-07), no tinted background. Active group tab uses the **same brand underline and semibold** as core tabs.
- **D-06:** Layout: core tabs (fixed), divider, scrollable group section, `＋` **pinned at the right edge**. Only the group section scrolls.
- **D-07:** Overflow is **horizontal scroll** with fade edges, `‹` `›` arrow buttons shown **only when overflowing in that direction**, wheel and trackpad scrolling, and the activated or newly created tab scrolled into view. No "More" dropdown, no wrap.
- **D-08:** Long names truncate with ellipsis plus tooltip with full name. Claude picks the width cap (research suggests about 24 chars; 40-char max name).
- **D-09:** Active tab is **not persisted across restarts**. App always starts on New.
- **D-10:** Zero groups: **divider plus icon-only `＋`**, tooltip and aria-label "New group". No labelled CTA.
- **D-11:** Badge mapping follows the **core-tab predicates exactly** from `ticketListUtils`: `isNewCandidate` -> New; `isNotMineCandidate` -> Not mine; `isLinkedCandidate` -> Linked; `isDoneTicket` -> neutral **Done**.
- **D-12:** Badge is a **small neutral text pill** carrying the core tab's name, beside the issue key. Existing per-card details (TriageIndicator red dot / copied key, "Handled" badge, blue change indicator) still appear.
- **D-13:** Card actions are **the same as in that card's core tab**: Not-mine cards get "Restore"; Linked cards get the copied-key badge; clicking a card opens detail where copy and dismiss work as today. Badges and actions read shared `useTicketStore().triageMap`, so triage changes update everywhere immediately.
- **D-14:** Members **absent from the current fetch**, or shown before first fetch, **render as normal cards from the stored snapshot** (`ticket_json` via `getGroupMembers`). Never hide a member; list length equals tab count. Prefer the live ticket from `ticketStore` when present. No dimming or hint (Phase 32).
- **D-15:** Group view has **no fetch controls** (no Fetch button, last-checked line or fetch warnings). View = filter bar plus list.
- **D-16:** Search, filter and sort state **resets on each visit**, default sort Updated descending, local `useState`. Reuse `TicketFilterBar`, `filterTickets`, `sortTickets` unchanged.
- **D-17:** **Done** members shown by default with the Done badge; no "show done" toggle.
- **D-18:** Empty-group state uses **final copy now** (EN and SK): heading like "No issues in this group yet"; body explains both entry points (open an issue and use "Groups", or select issues in any list and choose "Add to group"). Phase 31 verifies wording.
- **D-19:** **Automated tests only** for populated group views; tests seed `useGroupStore` and `useTicketStore` directly. Manual UAT covers create, tab strip, overflow, empty state. No dev-only seed actions, no early "Add to group" button.
- Carried forward: Phase 28 D-07/D-08, D-14/D-16/D-17/D-18 (40-char max, Rust-authoritative with TS mirror, diacritic-aware duplicate/reserved), D-22 (never `?? []` in a Zustand selector; use `null` fallback). No drag and drop. Prefer explicit labelled actions over hover-revealed icons.

### Claude's Discretion
- Exact truncation width, fade and arrow styling.
- How `currentTab` widens to carry a group id (discriminated union vs string ids).
- Fallback to New if the active group disappears (scope change, rehydrate failure). Phase 30 handles delete explicitly.
- Keyboard semantics of the tab strip (existing `<nav>` buttons with `aria-current` vs roving tabindex). Must meet WCAG AA and be consistent with core tabs.
- Whether to add `@radix-ui/react-popover` (shadcn Popover) for D-01.
- Exact EN/SK wording; Slovak plurals via i18next `_one/_few/_many/_other`.

### Deferred Ideas (OUT OF SCOPE)
None. Explicitly rejected scope creep: color picker at create (Phase 30), early "Add to group" button, dev seed tool. Also out of scope: rename/recolor/delete/reorder and tab "…" menu (Phase 30), any add/remove-issue UI (Phase 31), "no longer in results" dimming/hint/removal (Phase 32).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-01 | Create a named group from `＋`; empty/whitespace/duplicate/reserved rejected inline | `validateGroupName` (live), `useGroupStore.createGroup` returns typed `GroupResult`; Popover component; error-code to i18n map |
| GVIEW-01 | Group tabs right of core tabs after divider, showing color and count | `AppShell` nav extension; `groups[].color`, `memberCount`; `groupColorVar` in `colors.ts` |
| GVIEW-02 | Horizontal scroll, core tabs fixed, truncation + tooltip | Scroll container with scroll-state tracking, `scrollIntoView({inline:'nearest'})`, `max-w-[160px] truncate`, Tooltip |
| GVIEW-03 | Flat list with New/Not mine/Linked badge per card | New `GroupViewPage`, `TicketCard actionSlot`, predicate-based `groupBadgeFor()` helper, member resolution (live join + snapshot fallback) |
| GVIEW-04 | Same card actions; triage changes live in group view and core tabs | Reuse shared `ticketStore.triageMap`; reuse restore path (`set_triage_state` + `hydrateTriageMap`) |
| GVIEW-05 | Empty group explains how to add issues | Empty-state block mirroring `ignored.empty.*`, new `groups.empty.*` keys |
| GVIEW-06 | Same search/filter/sort controls | `TicketFilterBar`, `filterTickets`, `sortTickets` unchanged |
</phase_requirements>

## Summary

This is a frontend-only phase on top of a finished Phase 28 backend. Everything needed exists: `useGroupStore` (hydrated at startup, with `groups`, `memberKeysByGroup`, `createGroup`, `getGroupMembers`), the TS validation mirror, the color tokens, and the shared list-page building blocks (`TicketCard` with `actionSlot`, `TicketFilterBar`, `filterTickets`/`sortTickets`, the `is*Candidate` predicates). The work is (1) widen `currentTab` and `AppShell` props, (2) build a `GroupTabStrip` (scroll container, fade edges, arrows, `＋`), (3) a `CreateGroupPopover`, (4) a `GroupViewPage` that mirrors `IgnoredTicketsPage`/`LinkedTicketsPage`, and (5) i18n keys.

The one substantive design question is **member resolution** (D-14): `memberKeysByGroup[id]` gives keys only; snapshots (`ticketJson`) live behind the async `getGroupMembers` command. The view must load snapshots on mount/when membership changes, and render `live ?? snapshot` for each key. The list length must equal the tab count, so the key list is the source of truth and the snapshot is the fallback.

A real discrepancy to flag: `nav.notMine` is **"Dismissed"** and `nav.linked` is **"Already Linked"** (SK "Zamietnuté", "Už prelinkované") in the locale files, while the CONTEXT/UI-SPEC say "Not mine"/"Linked". D-12 says the pill carries the *core tab's name*, and UI-SPEC says to reuse `nav.*` values, so the pill must render what the tab actually says (Dismissed / Already Linked), not hard-coded "Not mine" / "Linked". `nav.new` is "New" / "Nové". Only "Done" needs a new key.

**Primary recommendation:** Add `@radix-ui/react-popover` via a shadcn-style `popover.tsx`; keep `currentTab` as a discriminated-free string union (`'new'|'not-mine'|'linked'|` `` `group:${number}` ``) parsed by one helper; extract the strip into `GroupTabStrip.tsx`; build `GroupViewPage` as a near-copy of the Ignored/Linked pages with a `useGroupMembers` hook; wire a fallback effect in `App.tsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group name validation (UX) | Browser / Client (`validation.ts`) | API / Backend (Rust, authoritative) | Live feedback in TS; Rust re-validates every write (Phase 28 D-16) |
| Group create / persistence | API / Backend (Tauri `create_group`) | Browser (store call + rehydrate) | Rust owns SQLite and scope |
| Active tab state | Browser / Client (`App.tsx` useState) | — | D-09: not persisted |
| Tab strip layout, overflow, scroll | Browser / Client | — | Pure DOM/CSS |
| Member list resolution | Browser / Client (join keys with `ticketStore.tickets`) | API / Backend (`get_group_members` snapshot) | Live preferred, snapshot fallback (D-14) |
| Triage badge / actions | Browser / Client (predicates over `triageMap`) | API / Backend (`set_triage_state` write) | Same path as Restore on Ignored page |
| Search/filter/sort | Browser / Client (`ticketListUtils`) | — | Existing pure functions |

## Standard Stack

### Core (all already in the repo)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | ^19 [VERIFIED: package.json] | UI | existing |
| zustand | ^5.0.12 [VERIFIED: package.json] | `useGroupStore`, `useTicketStore` | existing; selector stable-ref rule applies |
| i18next / react-i18next | ^25.10.9 / ^16.6.6 [VERIFIED: package.json] | EN/SK strings, plurals | existing |
| @radix-ui/react-tooltip | ^1.2.8 [VERIFIED: package.json] | truncation + icon button tooltips | existing `tooltip.tsx` |
| lucide-react | existing | `Plus`, `ChevronLeft`, `ChevronRight`, `AlertCircle` | existing icon set |
| vitest ^4.1.1 + @testing-library/react ^16.3.2 + user-event ^14.6.1 | [VERIFIED: package.json] | tests | existing |

### New dependency
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @radix-ui/react-popover | 1.3.0 (npm latest, modified 2026-10-12) [VERIFIED: npm view] | Create popover (D-01); Phase 31 picker reuses it | shadcn Popover is the project's component library convention; handles focus, Esc, outside click, anchoring |

`@radix-ui/react-popper`, `react-focus-scope`, `react-dismissable-layer` are already in `node_modules` as transitive deps of dialog/tooltip [VERIFIED: ls node_modules/@radix-ui].

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Popover | Hand-built absolutely positioned div | Loses focus return, Esc/outside-click, collision handling; do not do this |
| Horizontal `ScrollArea` | Native `overflow-x-auto` div | Radix ScrollArea hides the native scroll API (`scrollBy`, `scrollIntoView` work on viewport only); UI-SPEC specifies a plain `overflow-x-auto` with hidden scrollbar. Use native |

**Installation:**
```bash
npm install @radix-ui/react-popover
```
Then add `src/components/ui/popover.tsx` (shadcn pattern: `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverContent` with `Portal`, mirroring `tooltip.tsx` style and `cn`).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @radix-ui/react-popover | npm | multi-year (same monorepo as installed react-dialog/tooltip) | very high | github.com/radix-ui/primitives | not run (not installed in this session) | Approved, tagged [ASSUMED] for slopcheck purposes; no postinstall script returned by `npm view` |

`npm view` confirmed existence, repo URL `radix-ui/primitives`, and no `scripts.postinstall`. It is the same org/monorepo as five packages already in `package.json`, so the slopsquat risk is minimal. Per protocol the planner should still gate the install with a brief `checkpoint:human-verify` OR accept it given the shadcn convention (the UI-SPEC already lists it and was approved). **Packages removed:** none. **Flagged [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
App.tsx  (currentTab: 'new' | 'not-mine' | 'linked' | `group:<id>`)
   |                                   ^ onTabChange(tab)
   v                                   |
AppShell <nav>
   |-- core tabs (New | Dismissed | Already Linked)  -- fixed
   |-- divider
   |-- GroupTabStrip  <-- useGroupStore.groups (position order, memberCount, color)
   |      |-- scroll container (overflow-x-auto, hidden scrollbar)
   |      |      |-- GroupTab buttons (dot, truncated name + Tooltip, count)
   |      |-- fade edges + ‹ › buttons (scroll-state from scrollLeft/clientWidth/scrollWidth)
   |-- CreateGroupPopover (＋, pinned right)
   |        input -> validateGroupName(live, existing names) -> enable/disable Create
   |        submit -> useGroupStore.createGroup(name)
   |                    -> invoke create_group (Rust authoritative) -> hydrate()
   |                    -> ok: onCreated(group.id) => App sets currentTab = group:<id>
   |                    -> !ok: code -> i18n message in same error line
   v
{children} in App:
   currentTab group:<id>  --> GroupViewPage(groupId)
        keys = memberKeysByGroup[id]  (null fallback)
        snapshots = getGroupMembers(id)  (async, re-run when keys change)
        live = ticketStore.tickets (by key)  ; triageMap
        members = keys.map(k => live[k] ?? parse(snapshots[k]))
        -> filterTickets -> sortTickets -> TicketCard(actionSlot by predicate)
        -> click -> ticketStore.selectTicket(key) -> App shows TicketDetailPage
   Restore -> invoke('set_triage_state') + ticketStore.hydrateTriageMap  --> core tabs + group view update
```

### Recommended Project Structure
```
src/
├── components/ui/
│   ├── popover.tsx                 # NEW (shadcn)
│   └── AppShell.tsx                # widen props; render GroupTabStrip + divider + ＋
├── features/groups/
│   ├── GroupTabStrip.tsx           # NEW: scroll container, tabs, arrows, fades
│   ├── GroupTab.tsx                # NEW (or inline): dot + name + count, Tooltip
│   ├── CreateGroupPopover.tsx      # NEW
│   ├── GroupViewPage.tsx           # NEW: mirrors IgnoredTicketsPage
│   ├── useGroupMembers.ts          # NEW: keys + snapshot + live resolution
│   ├── groupTabs.ts                # NEW: tab id helpers (toGroupTabId / parseTabId)
│   └── __tests__/                  # new tests here
├── features/tickets/
│   └── TriageBadge helper / groupBadge.ts  # predicate -> label key (or in groups/)
└── i18n/locales/{en,sk}.json       # groups.* keys
```
Where exactly `AppShell` stays a presentational shell: either pass `groups`/`onCreateGroup` props or let `GroupTabStrip` read `useGroupStore` directly. Recommended: `GroupTabStrip` reads the store itself (selectors for `groups`), `AppShell` only receives `activeTab: string` and `onTabChange(tab: string)`. This keeps `AppShell` tests and the many other `<AppShell>` usages (no `onTabChange` -> no nav) unaffected.

### Pattern 1: Tab id as a string union with one parser (recommended for `currentTab`)
**What:** `type TabId = 'new' | 'not-mine' | 'linked' | \`group:${number}\``, plus `groupTabId(id)` and `parseGroupTabId(tab): number | null`. Keeps `AppShell`'s `activeTab === tab.id` comparison and `aria-current` logic unchanged and avoids object identity pitfalls in `useState`/`useEffect` deps.
**When:** Always for this phase; the discriminated union adds no value because there are only two kinds.

### Pattern 2: Member resolution hook
```typescript
// useGroupMembers.ts  (sketch; types from existing modules)
const keys = useGroupStore((s) => s.memberKeysByGroup[groupId] ?? null); // null fallback, NOT []
const tickets = useTicketStore((s) => s.tickets);
const [snapshots, setSnapshots] = useState<Record<string, JiraTicket> | null>(null);

useEffect(() => {
  let cancelled = false;
  void useGroupStore.getState().getGroupMembers(groupId).then((r) => {
    if (cancelled || !r.ok) return;
    const map: Record<string, JiraTicket> = {};
    for (const m of r.value) {
      try { map[m.issueKey] = JSON.parse(m.ticketJson) as JiraTicket; } catch { /* skip corrupt */ }
    }
    setSnapshots(map);
  });
  return () => { cancelled = true; };
}, [groupId, keys]); // keys identity changes on every hydrate -> snapshot refresh

const members = useMemo(() => {
  if (!keys) return [];
  const live = new Map(tickets.map((t) => [t.key, t]));
  return keys.flatMap((k) => { const t = live.get(k) ?? snapshots?.[k]; return t ? [t] : []; });
}, [keys, tickets, snapshots]);
```
Note on `?? null`: the project rule forbids `?? []` *inside the selector*; `?? null` is correct, then handle `null` outside the selector (inside `useMemo`/render). Build the `Map` once per `tickets` change, not per key.

**Edge:** `JSON.parse` can fail or produce shapes missing fields (`fields.status` etc.). Guard: skip entries failing a minimal shape check (`fields?.status?.name`, `fields.priority`, `fields.updated`), because `TicketCard`/`sortTickets` dereference `fields.priority.id`, `fields.status.name` unguarded. A member whose snapshot cannot be parsed AND has no live ticket would make `list length != tab count`; this is the only permitted exception, and should be documented in a code comment. Before snapshots load (first render), live-only members are shown and the rest appear when `getGroupMembers` resolves; to avoid a flash of an empty-state for a non-empty group, treat `keys.length > 0 && members.length === 0 && snapshots === null` as loading (render `SkeletonCards`, which already exists in `TicketCard.tsx`) and never show the empty state until `keys` is known to be empty. Use `keys !== null && keys.length === 0` (with `hydrated`) as the empty-state condition.

### Pattern 3: Badge selection
```typescript
// Order matters: core predicates first, Done only if none match (they all include !isDoneTicket)
function triageBadgeKey(t: JiraTicket, triageMap): 'nav.new'|'nav.notMine'|'nav.linked'|'groups.badge.done' {
  if (isNotMineCandidate(t, triageMap)) return 'nav.notMine';
  if (isLinkedCandidate(t, triageMap)) return 'nav.linked';
  if (isNewCandidate(t, triageMap)) return 'nav.new';
  return 'groups.badge.done';
}
```
The three predicates are mutually exclusive for non-done tickets (`isNewCandidate` excludes ignored/copied/handled). Any order works; Done is the fallthrough. Unit-test the full matrix (states `new, seen, ignored, handled, copied, undefined` x done/not done).

### Pattern 4: Action slot per card (reuse, do not reinvent)
`TicketCard` renders `actionSlot` inside the line-1 left cluster after the unseen-changes badge, so the pill goes first in the slot, followed by Handled badge + Restore (Not mine) or copied-key `Badge` (Linked). Compose in one fragment/`div className="flex items-center gap-2"`. Restore handler is currently a **module-private function in `IgnoredTicketsPage.tsx`**: extract it (e.g. `restoreTicket(key)` exported from `ticketStore.ts` or `ticketListUtils`) and have both pages use it, rather than duplicating. Keep the optimistic `hydrateTriageMap({...triageMap, [key]: {state:'seen', copiedKey:null}})` semantics exactly (existing `IgnoredTicketsPage.test.tsx` asserts on it).

Note `TicketCard` already takes `triageEntry` but ignores it (only `ticket`, `onClick`, `actionSlot` destructured). The "red dot / TriageIndicator" per D-12 is not rendered by `TicketCard` itself; check `TriageIndicator.tsx` usage in `TicketListPage` when building the New-state card (see Open Questions 2).

### Pattern 5: Scroll strip with overflow state
- Container `ref`; state `{canLeft, canRight}` computed from `scrollLeft > 0` and `scrollLeft + clientWidth < scrollWidth - 1`.
- Recompute on: `scroll` event, `ResizeObserver` on container (and on `groups` change). **jsdom has no `ResizeObserver`** and no layout (all sizes 0) [ASSUMED from known jsdom behavior; `test-setup.ts` defines none, verified by reading it]: guard `typeof ResizeObserver !== 'undefined'` in the component or stub it in tests. Component logic should be factored (`computeOverflow(el)` pure function taking `{scrollLeft, clientWidth, scrollWidth}`) so overflow logic is unit-testable without layout.
- Wheel: attach a **non-passive** native `wheel` listener via `addEventListener('wheel', h, {passive:false})` in `useEffect` (React's `onWheel` is passive, so `preventDefault` is ignored and the page may scroll). Map `deltaY` to `scrollLeft` only when `Math.abs(deltaY) > Math.abs(deltaX)` and the strip actually overflows; otherwise do not `preventDefault`.
- Smooth scroll: `el.scrollBy({left: ±200, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'})`. Guard `window.matchMedia` (not present in jsdom unless mocked).
- Scroll active tab into view: `useEffect` on `activeTab`: `buttonRef.scrollIntoView?.({inline:'nearest', block:'nearest'})` (optional-call because jsdom lacks `scrollIntoView`; a missing stub throws `TypeError` in tests). Use `block:'nearest'` too so the page itself does not scroll vertically.
- Fades/arrows: render as absolutely positioned siblings within a `relative` wrapper around the scroll container; fades `pointer-events-none`. Arrow buttons conditional on `canLeft/canRight` (so they leave the tab order when hidden, per UI-SPEC).
- Hidden scrollbar in Tailwind v4: `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.
- No width jitter on active semibold: use the grid-stack trick (`<span class="grid"><span class="col-start-1 row-start-1 font-semibold invisible" aria-hidden>{name}</span><span class="col-start-1 row-start-1">{name}</span></span>`) or an `after:content-[attr(data-label)] font-semibold h-0 invisible` pseudo element. The grid-stack is simpler but doubles text for `getByText` queries in tests; give the hidden copy `aria-hidden` and query by role/name (the button has `aria-label`).

### Pattern 6: Create popover state machine
- Controlled `open`. On open: reset `name`, `submitError`, `submitting`. Radix `PopoverContent` `onOpenAutoFocus` focuses the first focusable (the input) by default, so `autoFocus` is redundant but harmless; prefer relying on Radix default, or explicitly `inputRef.focus()` in `onOpenAutoFocus` with `preventDefault`.
- Derive validation with `useMemo(() => validateGroupName(name, groups.map(g=>g.name)), [name, groups])`. Error message shown only for `duplicate|reserved|too_long`; `empty` => Create disabled, no message. Submit error from Rust overrides validation error text only when set; clear `submitError` on next keystroke.
- Submit: `if (!v.ok || submitting) return`; `setSubmitting(true)`; `const r = await createGroup(v.display)`; on `ok` -> `setOpen(false)`, `onCreated(r.value.id)`; on failure map `r.code` via a `Record<GroupErrorCode, i18nKey>` with `default => internal`. Always `setSubmitting(false)` in `finally`/both branches. Guard double submit via Enter held down.
- Pass `v.display` (trimmed, NFC-normalized) — Rust also normalizes, but pass the normalized form.
- Esc/outside-click close and focus return to trigger is Radix default when the trigger is `PopoverTrigger`. The UI-SPEC wants `aria-haspopup="dialog"` and `aria-expanded`: Radix `PopoverTrigger` sets both automatically.
- `<form onSubmit>` wrapping the input and buttons gives Enter-submit for free; set `type="button"` on Cancel.
- After create succeeds, focus should move to the new tab button: popover close will otherwise restore focus to `＋`. Set a `pendingFocusGroupId` ref/state in the strip and focus the matching tab in an effect once it renders, and call `onCloseAutoFocus={(e) => e.preventDefault()}` conditionally when creation succeeded. This ordering is the fiddliest bit of the phase; test it.
- Timing: `createGroup` awaits `hydrate()` inside `mutate` before returning, so by the time `onCreated(id)` runs, `groups` already contains the new group. Good: `setCurrentTab` will not briefly point at a missing group. (Subject to the WR-01 race below.)

### Anti-Patterns to Avoid
- **`?? []` inside a Zustand selector** (infinite re-render; project rule). Use `?? null` and handle after.
- **Selecting a derived array inside the selector** (e.g. `s.groups.map(...)`) — new reference every call. Select `groups` and derive in `useMemo`.
- **Drag and drop / hover-revealed icons** — forbidden by project memory.
- **Hard-coding "Not mine"/"Linked" pill text** — the tab labels are Dismissed/Already Linked.
- **Fetching or showing fetch warnings in the group view** (D-15).
- **Filtering out members missing from the live fetch** (D-14).
- **Persisting `currentTab`** (D-09).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover positioning, focus return, Esc, outside click | Custom portal/div | `@radix-ui/react-popover` via shadcn `popover.tsx` | A11y and collision handling |
| Name validation | New rules | `validateGroupName` from `validation.ts` | Shared vectors with Rust; diacritic and reserved handling |
| Color for dot | New hex values | `groupColorVar(color)` / `--color-group-*` tokens from `colors.ts` | Contrast verified in Phase 28 |
| Filter/sort | New list logic | `filterTickets`, `sortTickets` | Spec: unchanged |
| Filter bar | New bar | `TicketFilterBar` | Controlled, reusable |
| Loading skeleton | New skeleton | `SkeletonCards` from `TicketCard.tsx` | Exists |
| Plural handling | `count === 1 ?` branches | i18next `_one/_few/_many/_other` | SK has four forms |
| Tooltip | Title attribute | `Tooltip` from `ui/tooltip.tsx` | Consistency; `title` has poor a11y |
| Restore write path | A second copy of `handleRestore` | Extract and share the existing one | One path => core tabs update identically |

**Key insight:** every behavior in this phase already has a precedent in the codebase; deviation creates inconsistent triage state or a11y regressions.

## Runtime State Inventory

Not applicable (greenfield UI addition, no rename/refactor/migration). No stored data, service config, OS registration, secrets or build artifacts are renamed or migrated. The new `groups.*` i18n keys are additive.

## Common Pitfalls

### Pitfall 1: Zustand selector loop
**What goes wrong:** `useGroupStore((s) => s.memberKeysByGroup[id] ?? [])` returns a fresh array each call -> infinite re-render. **Avoid:** `?? null`. **Warning sign:** "Maximum update depth exceeded" / test hang. Add a test that renders `GroupViewPage` for a group with no entry in `memberKeysByGroup`.

### Pitfall 2: Phase 28 review warnings land on this phase
STATE/memory say four unfixed Phase 28 review warnings "should be fixed before or during Phase 29" (28-REVIEW.md): **WR-01** hydrate race (overlapping hydrates; stale commit or torn `groups` vs `memberKeysByGroup`), **WR-02** a failed hydrate wipes all groups (tabs would vanish and the active-group fallback would kick the user to New), **WR-03** TS/Rust whitespace trim mismatch (`empty`/`duplicate` disagree), **WR-04** invisible/zero-width names pass validation. Phase 29 is the first UI surface that exposes all four: WR-01/02 directly affect tab strip stability and the create-then-switch flow; WR-03/04 produce confusing "Rust says duplicate but TS says ok" on the popover. **Recommendation:** include a small Wave 0/1 plan to fix WR-01 (generation counter in `hydrate`) and WR-02 (keep last good state, add `hydrateError`) in `groupStore.ts`, and WR-03/04 in both `validation.ts` and `groups_db.rs` with new shared vectors. At minimum WR-01 and WR-02 should be done before wiring the active-tab fallback, otherwise a transient IPC error silently changes the user's tab. The planner should confirm scope with the user (see Open Questions 1).

### Pitfall 3: Active-group fallback races hydration
**What goes wrong:** An effect "if active group not in `groups`, go to New" runs before the first hydrate (or right after `createGroup` before state propagates) and bounces the user. **Avoid:** only run the fallback when `hydrated === true`, and compare against current `groups`. Because `mutate` hydrates before returning, `setCurrentTab` after `createGroup` is safe; still, gate on `hydrated`. Implement as a derived value rather than an effect where possible: `const effectiveTab = isGroupTab && !groupExists ? 'new' : currentTab` computed in render, plus an effect that normalizes state, so there is no flash of a missing-group view.

### Pitfall 4: Detail round-trip remounts the page
Opening detail replaces the whole `App` body (`showDetail` renders a different `AppShell` without `onTabChange`), so `GroupViewPage` unmounts and its local filter state resets on return. This matches D-16 ("resets on each visit") and the existing pages; `currentTab` lives in `App`, so the user returns to the same group tab. Do not "fix" it. The tab strip also unmounts and remounts, so the scroll position of the strip resets: the active-tab `scrollIntoView` effect must run on mount, not only on change.

### Pitfall 5: jsdom limitations in tests
No layout (`clientWidth`, `scrollWidth` = 0), no `ResizeObserver`, no `scrollIntoView`, no `matchMedia`; Radix Popover/Tooltip portal and pointer-event quirks (`hasPointerCapture`, `scrollIntoView` for some Radix primitives). Add guarded access in components, and put minimal stubs in the specific test files (not global setup unless needed by several files). For Radix Popover in jsdom, `user.click` on the trigger works; `fireEvent.click` may not trigger `onPointerDown`-driven behaviors for outside-click. Prefer `userEvent`.

### Pitfall 6: Slovak plurals and key style
Locale files are **flat dotted keys** (`"nav.new": ...`, `"ignored.empty.heading"`), not nested JSON. i18next plural suffixes are appended to the flat key: `"groups.tab.aria_one"`, `"groups.tab.aria_few"`, `"groups.tab.aria_many"`, `"groups.tab.aria_other"`. `translations.test.ts` requires **identical key sets** in en/sk, so EN must also define all keys it uses; EN only needs `_one`/`_other` for i18next (but the parity test compares raw key names, so the EN file must carry the same four suffixes or the test fails). Plan on defining `_one/_few/_many/_other` in both files (EN `_few`/`_many` duplicating `_other` text). Verify: first confirm how existing plural keys in `en.json` are declared (grep `_one`/`_other`) and mirror it. [ASSUMED: i18next v25 CLDR suffix behavior; confirm with a test calling `t(key, {count: 2|5|1|0})` in `sk`.] The same test also asserts at least 80% of SK values differ from EN; fine here.

### Pitfall 7: Reserved-name list follows tab labels
`RESERVED_NAME_KEYS` is built from `nav.new`, `nav.notMine`, `nav.linked` in both locales, so "Dismissed", "Already Linked", "Zamietnuté" etc. are reserved but "Not mine"/"Linked" are not. Not a bug; do not add pill labels (e.g. "Done") to reserved names (a group named "Done" must remain valid).

### Pitfall 8: Tooltip on every tab
`Tooltip` around each group tab inside a horizontally scrolling container works, but a `TooltipProvider` is required (AppShell wraps it only around header icons). Wrap the nav strip in one `TooltipProvider delayDuration={300}`. Only render the tooltip when the name is actually truncated (`scrollWidth > clientWidth` measured on hover/focus), or always (UI-SPEC accepts always). Recommend always, for simplicity and testability, but keep the full name in `aria-label` on the button (the tooltip content is `aria-hidden`).

### Pitfall 9: `aria-label` overriding visible text
The group tab button gets `aria-label="{name}, {count} issues"`; WCAG 2.5.3 requires the accessible name to contain the visible label text: the name is first, so it passes. Ensure the count text visible is just the number.

### Pitfall 10: Radix focus-return versus "focus the new tab"
See Pattern 6; tests should assert `document.activeElement` is the new tab after create.

## Code Examples

### Tab id helpers
```typescript
// groupTabs.ts
export type CoreTab = 'new' | 'not-mine' | 'linked';
export type TabId = CoreTab | `group:${number}`;
export const groupTabId = (id: number): TabId => `group:${id}`;
export function parseGroupTabId(tab: string): number | null {
  const m = /^group:(\d+)$/.exec(tab);
  return m ? Number(m[1]) : null;
}
```

### App.tsx wiring (shape)
```tsx
const [currentTab, setCurrentTab] = useState<TabId>('new');
const hydrated = useGroupStore((s) => s.hydrated);
const groups = useGroupStore((s) => s.groups);
const activeGroupId = parseGroupTabId(currentTab);
const activeGroupExists = activeGroupId !== null && groups.some((g) => g.id === activeGroupId);
useEffect(() => { if (hydrated && activeGroupId !== null && !activeGroupExists) setCurrentTab('new'); },
  [hydrated, activeGroupId, activeGroupExists]);
...
{currentTab === 'new' && <TicketListPage />}
...
{activeGroupExists && activeGroupId !== null && <GroupViewPage key={activeGroupId} groupId={activeGroupId} />}
```
`key={activeGroupId}` guarantees filter state reset when switching between groups (D-16: reset on each visit) — without it React reuses the instance and keeps search/sort across two group tabs. Note: `App.tsx` already has a local `hydrated` (app settings) variable at the top of the component (`if (!hydrated) return null`), so name the group one `groupsHydrated` to avoid shadowing. Hooks must run before that early return (rules of hooks): place the new `useGroupStore` selectors and the fallback `useEffect` above `if (!hydrated) return null`.

### Popover shadcn skeleton
```tsx
import * as PopoverPrimitive from '@radix-ui/react-popover';
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef<...>(({ className, align = 'end', sideOffset = 4, ...p }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset}
      className={cn('z-50 w-70 rounded-md border border-brand-border bg-popover p-4 text-popover-foreground shadow-md outline-none ...', className)} {...p} />
  </PopoverPrimitive.Portal>));
```
(Mirror `tooltip.tsx` conventions; `w-70` is a Tailwind v4 spacing-scale class = 280px.)

### Testing triage propagation (GVIEW-04)
Seed `useGroupStore.setState({groups:[...], memberKeysByGroup:{1:['T-1']}, hydrated:true})` and `useTicketStore.setState({tickets:[t1], triageMap:{}})`, mock `@tauri-apps/api/core` `invoke` (`get_group_members` returns `[{issueKey, ticketJson, addedAt}]`, `set_triage_state` resolves), render `GroupViewPage` (wrap with `renderWithI18n`), click Restore on a Not-mine card, assert `useTicketStore.getState().triageMap['T-1'].state === 'seen'` and the pill flips from the Dismissed label to the New label.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Roving-tabindex tablist | Plain `<nav>` of buttons with `aria-current="page"` (project convention, UI-SPEC locked) | Do not introduce `role="tablist"`; keep consistent with core tabs |
| React `onWheel` for scroll hijack | Native non-passive listener | `preventDefault` only works non-passive |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | jsdom lacks `ResizeObserver`, `scrollIntoView`, `matchMedia`, layout metrics | Pitfall 5 / Pattern 5 | Tests might not need stubs; low risk (guard code is harmless) |
| A2 | i18next v25 resolves flat-key plural suffixes `_one/_few/_many/_other` for `sk` | Pitfall 6 | Plural strings render wrong; mitigated by a plural test |
| A3 | `@radix-ui/react-popover` is safe (slopcheck not run) | Package Legitimacy Audit | Very low; same monorepo as installed packages |
| A4 | `TicketCard` ignores `triageEntry` and does not render TriageIndicator itself | Pattern 4 | The red dot may need to be placed by the group view; confirm by reading `TicketListPage`/`TriageIndicator` usage |
| A5 | Fixing Phase 28 WR-01..WR-04 inside Phase 29 is wanted | Pitfall 2 | Scope/time; needs user confirmation |

## Open Questions (RESOLVED)

1. **Fix Phase 28 review warnings WR-01..04 in this phase?**
   - Known: memory and STATE say they should be fixed "before or during Phase 29". WR-01/02 directly affect tab stability.
   - Recommendation: add one early plan fixing WR-01, WR-02 (store) and WR-03/04 (validation both sides, shared vectors). If user declines, at least gate the active-tab fallback on `hydrated` and tolerate `groups: []` blips.
   - RESOLVED: User chose to fix WR-01..04 in Phase 29 (plan 29-01).
2. **Where does the TriageIndicator (red dot / copied key) render for cards?**
   - `TicketCard` ignores `triageEntry`; check `TicketListPage.tsx` and `TriageIndicator.tsx` for how the New tab shows its red dot (likely via `actionSlot`). The group view must reproduce whatever the New tab passes for New-state cards.
   - RESOLVED: TriageIndicator is unused in production; group view does not reproduce a red dot (pill + actionSlot only).
3. **Pill wording:** CONTEXT says "Not mine"/"Linked", locale says "Dismissed"/"Already Linked". Recommendation: reuse `nav.*` (matches D-12 "carries the core tab's name" and UI-SPEC "reuse nav.* values"). Mention to user at review time.
   - RESOLVED: User chose to reuse `nav.*` labels; only `groups.badge.done` is new.
4. **Unparseable snapshot with no live ticket:** skip silently (documented exception to D-14) vs render a stub card. Recommendation: skip and `console.warn`; extremely unlikely since Rust validates `ticket_json` on add.
   - RESOLVED: Skip and `console.warn` (plan 29-05).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npm | install, vitest | ✓ | `npm view` works | — |
| @radix-ui/react-popover | D-01 popover | ✗ (not yet installed) | 1.3.0 on registry | none needed; install |
| vitest, Testing Library, user-event | tests | ✓ | per package.json | — |
| Rust commands `create_group`, `get_group_members`, `list_groups`, `list_group_memberships` | all | ✓ (Phase 28) | — | — |

No Tauri/Rust changes are required for this phase unless WR-03/04 are fixed (then `groups_db.rs` and shared vectors change).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1, jsdom, @testing-library/react ^16, user-event ^14 |
| Config file | `vite.config.ts` (`test.environment: 'jsdom'`, `setupFiles: ./src/test-setup.ts`, alias `@`) |
| Quick run command | `npx vitest run src/features/groups src/components/ui` |
| Full suite command | `npm test` (and `npm run lint`, `npx tsc --noEmit`) |

Known baseline failures that are NOT regressions: vitest `TicketListPage` x2, `StaticMappingRow` x3, `SettingsPage` domain search x2; Rust createmeta two-page fixture tests x2 [CITED: project memory / STATE].

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRP-01 | Typing valid name enables Create; empty/whitespace disables with no message; duplicate/reserved/too_long show inline message and disable | component | `npx vitest run src/features/groups/__tests__/CreateGroupPopover.test.tsx` | ❌ Wave 0 |
| GRP-01 | Submit calls `create_group`, closes popover, calls `onCreated(id)`; Rust code (`duplicate`, `no_scope`, `internal`) shown inline; double-submit guarded | component | same file | ❌ Wave 0 |
| GRP-01 | Esc closes and returns focus to `＋`; state resets on reopen | component | same file | ❌ Wave 0 |
| GVIEW-01 | Group tabs render after divider with dot color var, name, count; `aria-label` plural (EN and SK) | component | `npx vitest run src/features/groups/__tests__/GroupTabStrip.test.tsx` | ❌ Wave 0 |
| GVIEW-01 | Zero groups: divider + icon-only `＋` with aria-label "New group" | component | same | ❌ Wave 0 |
| GVIEW-02 | `computeOverflow` pure function; arrows appear only when overflowing that direction (mock metrics via `Object.defineProperty`); arrow click calls `scrollBy`; active tab `scrollIntoView` called; long names truncated class + tooltip | unit/component | same | ❌ Wave 0 |
| GVIEW-03 | Flat list of all members with correct pill per state (matrix incl. Done); list length equals key count including snapshot-only members | unit + component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` and `.../groupBadge.test.ts` | ❌ Wave 0 |
| GVIEW-04 | Click card -> `selectTicket(key)`; Restore writes `set_triage_state` and updates `triageMap`; pill flips; core `isNewCandidate` reflects same map | component/integration | GroupViewPage.test.tsx | ❌ Wave 0 |
| GVIEW-05 | Empty group (`memberKeysByGroup` lacks id or `[]`) shows heading+body, no Add control; no flash while keys non-empty but snapshots loading | component | GroupViewPage.test.tsx | ❌ Wave 0 |
| GVIEW-06 | Search by key, assignee filter, sort field/direction change order; default Updated desc; state resets on remount | component | GroupViewPage.test.tsx | ❌ Wave 0 |
| (cross) | `en.json`/`sk.json` key parity incl. new `groups.*` keys | unit | `npx vitest run src/i18n/__tests__/translations.test.ts` | ✅ exists |
| (cross) | `App` fallback: active group removed -> New (after hydrated) | component | `npx vitest run src/__tests__/App...` or a small `useActiveTab` unit test | ❌ Wave 0 (extract logic into `groupTabs.ts` helper to make it unit-testable) |
| (cross) | No `?? []` selector loop: render page with missing group entry completes | component | GroupViewPage.test.tsx | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/groups` (plus any touched ui test)
- **Per wave merge:** `npm test && npm run lint && npx tsc --noEmit`
- **Phase gate:** full suite green except the documented baseline failures, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/groups/__tests__/CreateGroupPopover.test.tsx`
- [ ] `src/features/groups/__tests__/GroupTabStrip.test.tsx` (stubs for `ResizeObserver`, `scrollIntoView`, `matchMedia`)
- [ ] `src/features/groups/__tests__/GroupViewPage.test.tsx`
- [ ] `src/features/groups/__tests__/groupBadge.test.ts` and `groupTabs.test.ts`
- [ ] Framework install: none; `npm install @radix-ui/react-popover` for the component
- [ ] Manual UAT (per D-19): create flow, strip overflow with ~15 groups (create via popover), long name truncation + tooltip, empty state, EN/SK switch, light/dark, keyboard-only walk-through. Populated-view UAT deferred to Phase 31.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no (scope is derived in Rust from the server connection) | Rust `require_scope` |
| V5 Input Validation | yes | `validateGroupName` for UX; Rust `create_group` authoritative |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Group name rendered into DOM (XSS) | Tampering | Render via React text nodes only; never `dangerouslySetInnerHTML`; names are also used in `aria-label` and tooltip text (safe) |
| Corrupt/hostile `ticket_json` snapshot | Tampering | `JSON.parse` in try/catch plus shape guard before rendering; render summary as text (cards already do) |
| Invisible/zero-width names (spoofing duplicates) | Spoofing | Phase 28 WR-04 fix; Rust authoritative |
| IPC error detail leakage | Info disclosure | Show mapped i18n copy only, never raw error strings |

## Sources

### Primary (HIGH confidence)
- Codebase read directly: `AppShell.tsx`, `App.tsx`, `groupStore.ts`, `types.ts`, `validation.ts`, `ticketListUtils.ts`, `utils.ts` (`isDoneTicket`), `TicketCard.tsx`, `IgnoredTicketsPage.tsx`, `LinkedTicketsPage.tsx`, `TicketFilterBar.tsx`, `tooltip.tsx`, `test-setup.ts`, `renderWithI18n.tsx`, `translations.test.ts`, `en.json`/`sk.json` nav keys, `groups_commands.rs`
- `.planning/phases/29-.../29-CONTEXT.md`, `29-UI-SPEC.md`, `28-REVIEW.md`, `28-03-SUMMARY.md`, `REQUIREMENTS.md`, `config.json`
- npm registry: `npm view @radix-ui/react-popover` (version 1.3.0, repo radix-ui/primitives, no postinstall)

### Secondary / Tertiary
- Training knowledge for jsdom limitations, i18next plural suffixes, passive wheel listeners (tagged [ASSUMED] above). Context7 was not consulted this session; the Popover API surface used (`Root/Trigger/Portal/Content`, `onOpenAutoFocus`, `onCloseAutoFocus`) is stable across Radix versions but should be checked against the installed 1.3.0 types at implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — everything reused except one Radix package from the same monorepo
- Architecture: HIGH — direct precedent in existing pages; member-resolution hook is the only new design
- Pitfalls: MEDIUM-HIGH — Phase 28 warnings and flat-key plural handling are verified in repo; jsdom/i18next specifics are assumed

**Research date:** 2026-10-12
**Valid until:** 2026-11-11
