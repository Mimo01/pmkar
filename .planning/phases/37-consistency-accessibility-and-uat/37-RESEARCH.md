# Phase 37: Consistency, Accessibility and UAT - Research

**Researched:** 2026-10-15
**Domain:** React 19 / Zustand 5 / Vitest 4 accessibility hardening and invariant testing (Tauri + WebView2)
**Confidence:** HIGH (codebase-verified); MEDIUM for screen-reader double-speech behavior (needs the manual run)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Proven by an automated Vitest invariant only (no manual consistency steps). Drive deny, undo, link (relink), restore and handled over a fixture set and assert: each issue key appears in exactly one tab list, tab counts equal list lengths, and group badge counts match.
- **D-02:** The test exercises the real derivation code (`ticketListUtils`, `groupBadge`, `triageMap` in `ticketStore`), not re-implemented logic. Include a hydrate round-trip (re-hydrate from mocked `get_triage_state`) so the invariant also holds after restart.
- **D-03:** Add one dedicated app-level polite `aria-live` region, updated by `triageActions.ts` on deny, undo, link/relink and restore, so announcements do not depend on sonner behavior. Link-restore (which shows no toast) is announced too.
- **D-04:** Announcement strings are localized (EN + SK, Slovak uses "tiket"), pass the i18n guard tests, and include the ticket key and outcome.
- **D-05:** Delegated: avoiding double announcement with the sonner toast (deny/undo) is Claude's call; the live region is the authoritative announcement.
- **D-06:** Audit-and-fix scope: verify Deny and Link are reachable and operable by keyboard alone (Tab order, Enter/Space) in detail page, panel and group view, and fix any gaps found. Phase 36 focus rules are verified, not redesigned.
- **D-07:** Undo reachability: verify and document only. No new Undo shortcut and no longer-toast-on-keyboard behavior.
- **D-08:** One file, `37-HUMAN-UAT.md`, covers focus after deny/link/restore (page and panel), Undo toast, live-region announcements with Narrator/NVDA, EN and SK. Folds in the 2 pending Phase 36 HUMAN-UAT items; `36-HUMAN-UAT.md` is marked superseded/closed by it.
- **D-09:** The checklist is written in this phase and run by the user on Windows/WebView2.

### Claude's Discretion
- D-05, exact live-region component placement and API shape, announcement wording, and which fixture set the invariant test uses.

### Deferred Ideas (OUT OF SCOPE)
- Keyboard shortcut for Undo (e.g. Ctrl+Z)
- Longer Undo toast when triggered by keyboard
- Cloud existence check on re-link, suppress notifications for denied tickets
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RQA-01 | After any Linked <-> Not mine transition each ticket appears in exactly one tab, with matching counts and group badges | Predicates in `ticketListUtils.ts` are mutually exclusive by construction; invariant test design below |
| RQA-03 | Deny/Link buttons keyboard accessible with screen-reader announcements (WCAG AA) | `LiveAnnouncer` + `announce()` hooked in `triageActions.ts`; keyboard audit checklist; manual UAT |
</phase_requirements>

## Summary

No new libraries are needed. The phase is: (1) a Vitest invariant test over real derivation code, (2) a small Zustand-backed visually hidden live region plus `announce()` called from the single triage writer `triageActions.ts`, (3) a keyboard/focus audit with fixes only where the audit finds gaps, (4) `37-HUMAN-UAT.md`.

Derivation facts verified in code: `isNewCandidate` / `isNotMineCandidate` / `isLinkedCandidate` in `src/features/tickets/ticketListUtils.ts` partition by `triageMap[key].state` (`ignored|handled` => Not mine; `copied` => Linked; everything else not done => New) and all three exclude done tickets (`isDoneTicket`). `groupBadgeKey` (`src/features/groups/groupBadge.ts`) calls the same predicates in the order notMine, linked, new, else `groups.badge.done`. So the invariant is: for each ticket, exactly one tab matches if not done, zero if done (badge = done). "Exactly one tab" must be asserted as "non-done => exactly one; done => none", otherwise the test is wrong for done fixtures.

Writes: `triageActions.ts` goes through `writeEntry` -> `hydrateTriageMap`, which recomputes `newCount` (count of state === 'new'). Note `newCount` counts raw `'new'` entries regardless of done status, while the New tab list also excludes done tickets, so `newCount` can legitimately differ from the New list length for done tickets. Do not assert `newCount === newList.length` unless fixtures have no done 'new' tickets; assert tab counts as list lengths (what pages render via `resultCount={sorted.length}`) and treat `newCount` separately [VERIFIED: codebase grep ticketStore.ts L142-211, IgnoredTicketsPage.tsx, LinkedTicketsPage.tsx].

**Primary recommendation:** Build `announce()` as a tiny Zustand store (`{message, nonce}`) with `LiveAnnouncer` rendered beside every `<Toaster />` in `App.tsx` (5 sites: L211, 235, 248, 274, 319); call `announce(i18n.t('a11y.*'))` in `triageActions.ts` strictly after the store write succeeds; write the invariant test against real store + real utils with `invoke` mocked.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab/count/badge derivation | Browser/Client (pure fns over Zustand) | — | Derived from `triageMap`; no backend work |
| Triage persistence | Tauri backend (`set_triage_state`, `relink_ticket`, `get_triage_state`) | Client | Already exists; only mocked in tests |
| Announcements | Browser/Client (live region) | — | DOM-level a11y concern |
| Keyboard/focus | Browser/Client (components + `useTriageDetailActions`) | — | Existing hook owns focus targets |
| Manual WebView2 verification | Human on Windows | — | Cannot run here (D-09) |

## Standard Stack

No new dependencies. Use what is installed [VERIFIED: package.json]:

| Library | Version | Purpose |
|---------|---------|---------|
| zustand | ^5.0.12 | `announce` store |
| sonner | ^2.0.7 | existing toast (unchanged) |
| vitest | ^4.1.1 | invariant test |
| @testing-library/react / user-event | ^16.3.2 / ^14.6.1 | LiveAnnouncer and keyboard tests |
| vitest-axe | ^0.1.0 | optional axe check (pattern exists: `src/features/groups/__tests__/a11y.axe.test.tsx`) |
| react-i18next / i18n | existing | strings; flat dotted keys in `src/i18n/locales/{en,sk}.json` |

## Package Legitimacy Audit

No external packages are installed in this phase. Packages removed: none. Packages flagged: none.

## Architecture Patterns

### Flow
```
UI button (Deny/Link/Restore) -> useTriageDetailActions / row handlers
   -> triageActions.ts (single writer)
        -> invoke(set_triage_state | relink_ticket)   [Tauri]
        -> writeEntry -> ticketStore.triageMap  -> ticketListUtils / groupBadge -> tab lists, counts, badges
        -> toast (sonner, visual, 8 s Undo)
        -> announce(i18n.t('a11y.*'))  -> announcerStore {message,nonce} -> <LiveAnnouncer role=status sr-only>
```

### Recommended structure
```
src/components/LiveAnnouncer.tsx      # component + announce() + store
src/components/__tests__/LiveAnnouncer.test.tsx
src/features/tickets/__tests__/triageConsistency.test.tsx   # RQA-01 invariant
src/features/tickets/__tests__/triageActions.test.ts        # extend: announce calls
src/i18n/__tests__/a11yLocale.test.ts                       # key parity/placeholders/"tiket"
```

### Pattern: live region (WCAG 4.1.3 status messages)
```tsx
// Source: UI-SPEC Interaction Contract; MDN ARIA live regions
import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface AnnouncerState { message: string; nonce: number }
export const useAnnouncerStore = create<AnnouncerState>(() => ({ message: '', nonce: 0 }));

export function announce(message: string): void {
  useAnnouncerStore.setState((s) => ({ message, nonce: s.nonce + 1 }));
}

export function LiveAnnouncer() {
  const message = useAnnouncerStore((s) => s.message);
  const nonce = useAnnouncerStore((s) => s.nonce);
  const [text, setText] = useState('');
  useEffect(() => {
    setText('');                                   // clear so identical repeats re-announce
    const id = requestAnimationFrame(() => setText(message));
    return () => cancelAnimationFrame(id);
  }, [message, nonce]);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{text}</div>
  );
}
```
Design notes:
- Multiple `LiveAnnouncer` instances: only one App.tsx branch renders at a time (branches are early returns), so there is one region in the DOM at a time. Confirm during implementation; if two could co-exist, announcements would double.
- Use `nonce` in the effect deps (message alone would not retrigger on identical text).
- Tests with rAF: use `vi.useFakeTimers()` with `toFake` including `requestAnimationFrame` or `waitFor`; jsdom provides rAF with `pretendToBeVisual`, otherwise it may be absent. Check `src/test-setup.ts` and prefer `waitFor(() => expect(status).toHaveTextContent(...))`. Safer alternative with no rAF: `setTimeout(…, 0)` for the set step.
- `sr-only` is a Tailwind v4 utility (clip/1px), keeps node in the accessibility tree; never `hidden`/`display:none` [CITED: tailwindcss.com/docs/display, UI-SPEC].

### Announcement hook points in `triageActions.ts`
- `denyTicket`: after `applyState` ok -> `announce(t('a11y.denied',{key}))`. Fires also with no remembered key (toast only appears with a remembered key).
- `undoDeny`: on success after `writeEntry` -> `a11y.undone` with `{key, cloudKey}`; on failure -> announce `triage.undoFailed` (existing toast.error site).
- `linkTicket`: on `'relinked'` after `writeEntry` -> `a11y.linked` `{key, cloudKey}`. `needs-copy` not announced. Failure paths (two `toast.error(triage.linkFailed)`) announce.
- `restoreTicket` / `markHandled`: announce `a11y.restored` / `a11y.handled` on ok.
- `applyState` failure (`toast.error(failKey)`): announce the same text. Put this once in `applyState`, which covers deny/restore/handled failures.
- Cleanest: a local helper `notifyError(key, opts)` doing `toast.error` + `announce` so error sites cannot diverge.

### D-05 double-announcement recommendation
Sonner v2 renders its own `aria-live` region (`<section aria-live="polite" aria-relevant="additions text">`), so a toast is likely spoken as well as the live-region message [ASSUMED: sonner v2 internals; verify in node_modules/sonner]. UI-SPEC contract: live region authoritative, keep toast as visual affordance, verify by ear in UAT, and only if double-speech is confirmed add a mitigation. Prescriptive plan: ship without suppression, make the UAT item explicit, and note the fallback (sonner `toastOptions` / wrapper `aria-hidden` on non-action toasts is risky because the Undo action must remain keyboard reachable; do not `aria-hidden` the Undo toast). Prefer to accept a brief repeat over hiding the Undo button from AT.

### Anti-patterns
- `display:none`/`hidden` on region; conditional mounting of the region at announce time (must pre-exist in DOM).
- Announcing before the store write (spec requires after).
- Selector `?? []` in Zustand (project memory: infinite loop). Use `''`.
- Re-implementing tab predicates in the invariant test.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Tab membership logic in tests | `isNewCandidate/isNotMineCandidate/isLinkedCandidate`, `groupBadgeKey` | D-02 requires real code |
| Toast stacking/timers | sonner | existing |
| Visually-hidden CSS | Tailwind `sr-only` | standard |
| Focus ring | existing `focus-visible` classes on buttons | UI-SPEC |

## Common Pitfalls

1. **Done tickets in invariant.** Done tickets match no tab; assert 0 matches and badge `groups.badge.done`. A naive "exactly one" fails on them.
2. **`newCount` vs New list length** (see Summary): includes done 'new' tickets; assert separately or exclude done fixtures from that assertion.
3. **`handled` is Not mine.** `markHandled` moves Linked -> Not mine; `restore` moves to `seen` => New (not back to Linked). Restore of a denied-with-key ticket goes to New; only `relink_ticket` returns to Linked. Fixtures should cover: copied->ignored (deny), ignored->copied (undo, link), ignored->seen (restore), handled->seen, copied->handled.
4. **Rollback races.** `applyState` rolls back only if the entry is still the optimistic object; include a failing `set_triage_state` case and assert invariant still holds after rollback.
5. **Hydrate round-trip.** `get_triage_state` mock should return the persisted shape `Record<string, TriageEntry>`; call `hydrateTriageMap` with it and re-run the invariant. Check the exact invoke name/shape used at startup (grep `get_triage_state` in `src/`) when writing the mock.
6. **Repeat announcements** swallowed without the clear-then-set step.
7. **Terminology drift.** Existing toast `triage.denied` says "Moved {{key}} to Ignored." while the tab is labeled "Dismissed" (`nav.notMine`), and nav key `nav.ignored` = "Ignored" exists. UI-SPEC announcements say "Dismissed"/"Zamietnuté". Prefer interpolating `i18n.t('nav.notMine')` to avoid drift; flag the pre-existing toast mismatch to the user as out-of-scope (do not silently change `triage.denied`, other tests may assert it).
8. **Disabled button focus loss.** `useTriageDetailActions` sets `linking` (button disabled while in flight). A focused `disabled` button drops focus to `<body>` in Chromium/WebView2; audit whether the Link button focus is lost (then use `aria-disabled` + guarded handler, as UI-SPEC prescribes). `handleLink` already guards via `linkingRef`, so switching to `aria-disabled` is cheap.
9. **Five Toaster sites.** Missing one branch leaves the region absent; consider extracting nothing, just add the component at each site and add a test that renders App branches if feasible, else grep-assert count equality of `<Toaster />` and `<LiveAnnouncer />` in App.tsx.
10. **i18n guards.** `src/i18n/__tests__/{translations,detailLocale,groupLocale,noLiteralStrings}.test.ts` exist; add `a11yLocale.test.ts` mirroring `detailLocale.test.ts` (existence, no "úloh", "tiket" present, placeholders match). `noLiteralStrings` may flag literal JSX text; the region renders `text` state, so ok.

## Keyboard / Focus Audit Method

Automated (jsdom, user-event) in a new `a11y.triage.keyboard.test.tsx`, patterned on `src/features/groups/__tests__/a11y.keyboard.test.tsx` and `groupDetailTriage.test.tsx`:
- Render `TicketDetailPage` and `TicketDetailPanel` with a New ticket: `userEvent.tab()` until Deny focused; `keyboard('{Enter}')` and (separately) `keyboard(' ')` => `denyTicket` invoked (mock `invoke`), then `document.activeElement` is "Restore link to KEY" button (or Copy if never linked).
- Link: Enter/Space on Link -> `relink_ticket`; focus on the Linked badge (`tabIndex=-1`).
- Restore: focus -> Dismiss (panel fallback: close button).
- Static asserts: buttons are `button[type=button]`, none with `tabindex=-1`, none under `[aria-hidden=true]`, accessible name equals visible text (`getByRole('button',{name})`).
- jsdom cannot verify visible focus ring or real WebView2 focus behavior: those go to the manual checklist. Run `vitest-axe` on the rendered detail for the region/buttons.
- Group view: Not mine row Restore button reachable via Tab in `GroupViewPage`.
Undo (D-07): documentation only; sonner hotkey is `alt+T` per UI-SPEC [CITED: sonner docs, hotkey default `['altKey','KeyT']`]; verify in the manual run.

## Invariant Test Design (RQA-01)

- Real `useTicketStore`, real `ticketListUtils`, real `groupBadgeKey`; mock only `@tauri-apps/api/core` and `sonner` (as `triageActions.test.ts` does).
- Fixture: ~8 `JiraTicket`s (reuse a fixture builder from `ticketListParity.test.tsx` / `triageActions.test.ts` neighbors) covering states new/seen/ignored(with and without copiedKey)/copied/handled and one or two done tickets.
- `assertInvariant(tickets)`: for each ticket compute `tabs = [new, notMine, linked].filter(pred)`; non-done => `tabs.length === 1`; done => 0 and badge `groups.badge.done`; badge key matches the single tab's label key (`nav.new|nav.notMine|nav.linked`); sum of three list lengths === non-done ticket count; each list contains the key at most once.
- Drive via real exported actions: `denyTicket`, undo via captured toast `action.onClick` from the mocked `toast` call, `linkTicket` (invoke `relink_ticket` -> key), `restoreTicket`, `markHandled`, plus a failing-invoke variant; call `assertInvariant` after each (await flush).
- Optionally a short property-style loop of random action sequences with a seeded PRNG (cheap, strong evidence).
- Hydrate round-trip: snapshot `triageMap`, reset store, `hydrateTriageMap(snapshot)` (simulating mocked `get_triage_state`), re-assert and assert lists equal pre-restart lists.
- Also assert list/ page counts via rendering `LinkedTicketsPage`/`IgnoredTicketsPage` if a light render is feasible (existing tests render them); minimum is lengths of util-derived lists since pages use `resultCount={sorted.length}`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.1, jsdom, Testing Library, vitest-axe |
| Config file | existing (vite/vitest config; `src/test-setup.ts`) |
| Quick run | `npx vitest run src/features/tickets/__tests__/triageConsistency.test.tsx` |
| Full suite | `npm test` (`vitest run`) |

### Phase Requirements -> Test Map
| Req | Behavior | Type | Command | Exists |
|-----|----------|------|---------|--------|
| RQA-01 | one tab per ticket, counts/badges match, incl. hydrate | integration | `npx vitest run src/features/tickets/__tests__/triageConsistency.test.tsx` | Wave 0 |
| RQA-03 | announce() called per event w/ right text, after write | unit | `npx vitest run src/features/tickets/__tests__/triageActions.test.ts` | extend |
| RQA-03 | LiveAnnouncer role/status, repeat re-announce | unit | `npx vitest run src/components/__tests__/LiveAnnouncer.test.tsx` | Wave 0 |
| RQA-03 | a11y strings EN/SK parity, "tiket" | unit | `npx vitest run src/i18n/__tests__/a11yLocale.test.ts` | Wave 0 |
| RQA-03 | keyboard operability + focus targets | integration | `npx vitest run src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx` | Wave 0 |
| RQA-03 | real WebView2 focus, ring, Narrator/NVDA speech, EN/SK | manual | `37-HUMAN-UAT.md` | Wave 0 |

Sampling: per commit run the touched test file; per wave `npm test`; phase gate full suite green. Existing tests asserting `toast` calls must stay green (announce is additive).

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V5 Input Validation | minimal | announcement text built from i18n templates; issue keys rendered as React text (auto-escaped); never `dangerouslySetInnerHTML`. `cloudKey` comes from the DB-returned `relink_ticket` value only (T-35-03) |
| V2/V3/V4/V6 | no | no auth/session/crypto changes |

Threat: injection via key into live region — mitigated by text node rendering. i18next `escapeValue` setting: check `src/i18n/index.ts`; if `escapeValue: false`, text is still rendered as React text so no HTML injection.

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|-------------|-----------|----------|
| node/npm/vitest | tests | yes (repo toolchain) | — |
| Windows + WebView2 + Narrator/NVDA | manual UAT | no (macOS dev) | User runs checklist (D-09) |

## 37-HUMAN-UAT.md Structure

Frontmatter like 36-HUMAN-UAT (`status: partial`, `source`, dates). Sections per UI-SPEC checklist contract: (1) folded Phase 36 items (focus after Deny/Link/Restore page+panel; tooltips and remembered-link hint EN/SK in page, panel, Not mine rows, group rows), (2) focus table, (3) keyboard-only run, (4) Undo toast alt+T/Tab within 8 s and post-expiry recovery, (5) announcements per event + once-only speech + link-restore announced, (6) SK run, (7) focus ring. Each item: steps, expected, `result: [pending]`. Then edit `36-HUMAN-UAT.md` header: `status: superseded` with pointer to 37 and mark its 2 tests as moved. No consistency steps.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sonner v2 renders its own polite aria-live section, so a double speech is possible | D-05 | Low: UAT item catches it |
| A2 | Sonner default hotkey is alt+T | Keyboard audit | Low: documented only; UI-SPEC states the same |
| A3 | Only one App.tsx branch renders at a time (early returns) | Live region | Medium: duplicate regions double-announce; verify in App.tsx |
| A4 | jsdom in this repo supports requestAnimationFrame | Tests | Low: use setTimeout fallback |
| A5 | NVDA/Narrator treat `role=status` + aria-atomic in WebView2 as expected | Live region | Medium: only the manual run can prove |

## Open Questions

1. Pre-existing toast wording "Ignored" vs tab "Dismissed"? Recommendation: leave `triage.denied` unchanged, announce with "Dismissed" per UI-SPEC, mention to user.
2. Which exact `get_triage_state` call shape is used at startup? Grep when writing the round-trip mock; the invariant only needs `hydrateTriageMap(map)`.

## Sources

### Primary (HIGH)
- Codebase: `triageActions.ts`, `useTriageDetailActions.ts`, `ticketListUtils.ts`, `groupBadge.ts`, `ticketStore.ts`, `App.tsx`, `components/ui/sonner.tsx`, i18n locales and guard tests, existing a11y tests
- 37-CONTEXT.md, 37-UI-SPEC.md, REQUIREMENTS.md

### Secondary / Tertiary
- General ARIA live region and WCAG 2.1 SC 4.1.3 knowledge [ASSUMED, training data]; sonner internals [ASSUMED]

## Project Constraints (from CLAUDE.md)

No CLAUDE.md exists. Applicable memory-derived constraints: no drag and drop; explicit labelled buttons, one entry point per action; never `?? []` in a Zustand selector; Slovak uses "tiket" (groups guard test enforces).

## Metadata

**Confidence:** stack HIGH (no new deps), architecture HIGH, pitfalls HIGH on derivation, MEDIUM on screen-reader behavior.
**Research date:** 2026-10-15; **valid until:** 2026-11-15
