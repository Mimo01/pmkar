# Phase 36: Detail and Group UI - Research

**Researched:** 2026-10-15
**Domain:** React 19 / Tauri frontend wiring (shared triage actions into ticket detail, hints, focus, i18n)
**Confidence:** HIGH (all findings are from direct codebase inspection; no new libraries)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** When a denied ticket has a remembered key, the Link button reads "Restore link to KEY" (e.g. "Restore link to PROJ-123"). A never-linked denied ticket keeps the normal copy wording.
- **D-02:** Deny is a labelled, neutral outlined button (same style as Ignore / Handled; no destructive styling since Deny is undoable). It appears in detail page and panel for Linked tickets. Group view gets it by reusing the same shared detail, not a separate implementation.
- **D-03:** Delegated: exact placement of Deny within the status row, and the denied-state button set. Recommended: Deny sits on the status row after the Cloud-key link; the denied state shows Link (primary) plus an explicit Restore to "seen", replacing the toggle-like "Ignored" button. All handlers call `triageActions.ts`; no inline `set_triage_state` writes.
- **D-04:** Delegated. Constraints: "previously linked to KEY" is always visible text (not tooltip-only, since tooltips are `aria-hidden`); appears in detail and on Not mine rows (muted, consistent with the existing linked-key chip in `GroupViewPage`). Shown only when `copiedKey` is set on an `ignored` entry.
- **D-05:** Delegated. Constraint: focus must never be lost to `<body>` when the Deny button unmounts. Recommended: move focus to the new primary action (Link) in the denied state; apply the same rule after Link-restore (focus a stable element such as the status badge or close button). Must be verified in WebView2 (Phase 37 checklist).
- **D-06:** Delegated. Recommended: detail-only for Deny/Link; rows keep existing Restore and show the hint (D-04). No hover-revealed icons (explicit-actions preference).
- **D-07:** All new strings added to EN and SK; Slovak uses "tiket" never "úloha"; must pass the i18n guard tests (including the groups guard).

### Claude's Discretion
D-03 (placement and denied-state set), D-04 (hint styling), D-05 (focus target), D-06 (list rows) were all delegated. Planner/UI-spec may choose within the stated constraints. (Already resolved in the approved 36-UI-SPEC.md.)

### Deferred Ideas (OUT OF SCOPE)
- Keyboard/screen-reader announcements and WebView2 checklist - Phase 37.
- Link action on list rows - not in this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RTRI-01 | Deny a Linked ticket from an explicit labelled button in detail (page and panel) | Add Deny button to the `isCopied && copiedKey` branch of both `TicketDetailPage.tsx` and `TicketDetailPanel.tsx`; handler is already `denyTicket` |
| RTRI-04 | Focus lands sensibly after Deny | Ref + effect keyed on `triageEntry?.state` (see Focus pattern) |
| RLNK-03 | Denied ticket shows "previously linked to KEY" in detail and Not mine; Link button says it restores that key | `triageEntry.copiedKey` on `ignored` entries; new keys `detail.restoreLink`, `detail.previouslyLinked`; hint in detail, `IgnoredTicketsPage`, `GroupViewPage` Not-mine branch |
| RLNK-04 | Group view offers same Deny/Link via shared detail | `GroupViewPage` row click calls `selectTicket(key)`; `App.tsx` renders `TicketDetailPage` for any selected key. No group-specific work beyond the row hint |
| RQA-02 | New strings in EN and SK, "tiket", pass guards | Flat-key JSON in `src/i18n/locales/{en,sk}.json`; see i18n section |
</phase_requirements>

## Summary

This is a pure wiring phase. `triageActions.ts` already exports `denyTicket`, `linkTicket` (returns `'relinked' | 'needs-copy' | 'failed'`), `restoreTicket`, `markHandled`. `linkTicket` writes `{state:'copied', copiedKey}` through the store itself on `relinked`, and calls `useCopyStore.startPreview` itself on `needs-copy` (fetching detail if none passed), so detail components only need to pass `detail` and react to the result for focus. [VERIFIED: src/features/tickets/triageActions.ts]

Two details are live: `TicketDetailPage.tsx` (rendered by `App.tsx` when `selectedTicketKey` is set; this is also what the group view reaches) and `TicketDetailPanel.tsx`. A grep found the Panel is imported only by its own test file (not by any live screen), but CONTEXT/requirements say "page and panel", so both must be updated. They duplicate handlers and markup with different component sets (Page uses `Button` from shadcn; Panel uses raw `<button>` with Tailwind classes). The UI-SPEC asks to extract a shared button set; recommended: a small shared hook (`useTriageDetailActions(issueKey, detail)`) plus a shared hint component, while keeping each file's own button primitives, to avoid a visual regression in either layout. [VERIFIED: codebase grep]

**Primary recommendation:** Create one shared hook and one `RememberedLinkHint` component in `src/features/tickets/`, wire both detail files to it, add the hint to the two Not-mine row slots, add 5 i18n keys in both locales plus a parity/forbidden-term test, and update the existing panel test that clicks `/^ignored$/`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deny / Link / Restore buttons | Browser (React UI) | - | Pure presentation; handlers call `triageActions.ts` |
| Triage state mutation, relink | API/Backend (Tauri `relink_ticket`, `set_triage_state`) | Browser (optimistic store write) | Already built in Phases 34-35; no change |
| Remembered-key hint | Browser | Store (`triageMap`) | Derived from `TriageEntry.copiedKey` |
| Focus management | Browser (DOM refs/effects) | - | Client-only |
| Strings | Browser (i18n JSON) | - | EN/SK locale files |

## Standard Stack

No new packages. Reuse: React 19, react-i18next, zustand (`useTicketStore`), sonner, lucide-react, shadcn `Button`/`Tooltip`, vitest + @testing-library/react + vitest-axe, biome 2.4.8. [VERIFIED: package.json, existing imports]

## Package Legitimacy Audit

No external packages installed in this phase. Slopcheck not applicable. **Packages removed:** none. **Flagged [SUS]:** none.

## Architecture Patterns

### Data flow

```
User click (Deny / Restore link / Restore)
   -> detail component handler (Page or Panel, via shared hook)
   -> triageActions.denyTicket | linkTicket | restoreTicket
        -> optimistic write to useTicketStore.triageMap (hydrateTriageMap)
        -> invoke set_triage_state | relink_ticket (Tauri)
        -> toast (Undo / error) or copyStore.startPreview (needs-copy)
   -> triageMap[issueKey] subscribers re-render:
        detail row (button set + hint), Not mine rows (hint), group rows (badge)
   -> focus effect (keyed on triageEntry?.state) moves focus to new target
```

Group view: `GroupViewPage` row `onClick -> selectTicket(key)` -> `App.tsx` shows `TicketDetailPage`. Nothing to build for RLNK-04 except confirming with a test that the group-opened detail renders Deny.

### Recommended structure
```
src/features/tickets/
├── useTriageDetailActions.ts   # NEW: handlers + focus refs shared by Page & Panel
├── RememberedLinkHint.tsx      # NEW: <p> detail hint (and compact span variant for rows)
├── TicketDetailPage.tsx        # edit
├── TicketDetailPanel.tsx       # edit
└── IgnoredTicketsPage.tsx      # edit: hint in actionSlot
src/features/groups/GroupViewPage.tsx  # edit: hint in nav.notMine branch of actionSlot
```
If the planner prefers minimal change, inline in both files is acceptable; the hook is the lower-risk way to stop divergence.

### Pattern 1: Denied-state button set (per UI-SPEC)
- Linked (`isCopied && copiedKey`): existing badge + links, then **Deny** neutral outlined after the Cloud-key link -> `denyTicket(issueKey)`.
- Denied with `copiedKey`: **Restore link to KEY** (primary) -> `linkTicket(issueKey, detail)`; **Restore** (`ignored.restore`) -> `restoreTicket`.
- Denied without `copiedKey`: primary `detail.copy` button (existing wording; use `linkTicket(issueKey, detail)` so `needs-copy` path is identical, or keep `startPreview`; `linkTicket` returns `needs-copy` when no key is stored, and the backend is the source of truth for that) plus **Restore**.
- Replace the `detail.ignored` toggle button in both files. Page currently also shows `Open in Jira` last for non-linked states; keep it.
- Page uses `size="lg"`; Page must stay consistent with its own Button variants (`secondary` for neutral, `default` for primary) rather than copying Panel classes. The UI-SPEC class strings apply to the Panel only.

### Pattern 2: Focus after state change (RTRI-04)
Use `useEffect` keyed on `triageEntry?.state` with a "previous state" ref so it fires only on transitions initiated by the user, not on first mount (the Panel already focuses the close button on load; do not steal that).

```tsx
// Sketch; refs: primaryRef (denied primary), denyRef, badgeRef (tabIndex=-1), dismissRef
const prevState = useRef(triageEntry?.state);
const pendingFocus = useRef<'denied' | 'linked' | 'seen' | null>(null);
useEffect(() => {
  const now = triageEntry?.state;
  if (prevState.current !== now && pendingFocus.current) {
    const target =
      pendingFocus.current === 'denied' ? primaryRef.current
      : pendingFocus.current === 'linked' ? (badgeRef.current ?? denyRef.current)
      : (dismissRef.current ?? closeButtonRef?.current);
    target?.focus();
    pendingFocus.current = null;
  }
  prevState.current = now;
}, [triageEntry?.state]);
```
Handlers set `pendingFocus.current` before calling the action (only the user's click sets it; Undo from toast and external changes do not, which matches UI-SPEC "not managed here"). If the Deny IPC fails, state rolls back to `copied`, the effect sees the state back to the same value, and `pendingFocus` should be cleared on a `false` return so a later unrelated change does not steal focus. `denyTicket` returns `Promise<boolean>`: clear `pendingFocus` when it resolves `false`. For `linkTicket`, set pending `'linked'` only when the result is `'relinked'`.

Caveat: because `denyTicket` is optimistic, the state flips and the button unmounts before the IPC resolves; the effect runs on that flip. If the IPC then fails, the Deny button remounts and focus sits on the former target (a Link button that then unmounts, so focus drops to body). Mitigation: on `false` result, call `denyRef.current?.focus()` after a microtask/`requestAnimationFrame`-free effect (e.g. set state `focusDenyOnRollback` consumed by the same effect). UI-SPEC states "focus stays on the Deny button" on rollback; plan a test for this.

Page vs Panel: Page has no focus-on-load, Panel focuses close button on `detail` load. Page header buttons (back) exist; fallback target for "seen" in Page is the Dismiss button, which exists in the New state; as a safe fallback use the back button ref.

### Pattern 3: Selector stability
`useTicketStore((s) => s.triageMap[issueKey])` is already used and returns `undefined` or a stable object; keep it. Never `?? []` in a selector. [VERIFIED: memory feedback_zustand_selector_stable_ref]

### Anti-Patterns
- Inline `invoke('set_triage_state')` in components (violates D-03).
- Tooltip-only information (tooltips are `aria-hidden`).
- Timeouts for focus (use effect on state).
- Hover-revealed row icons, drag and drop.
- Deriving the "never linked" case from `copiedKey` in the component alone for the primary action: call `linkTicket` and let it decide (`relink_ticket` returns null when there is no remembered link); the label is the only thing derived from `copiedKey`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Deny / relink / restore + optimistic rollback + Undo toast | New invoke code | `triageActions.ts` |
| Copy preview hand-off | Own fetch + startPreview | `linkTicket(key, detail)` returns `needs-copy` after starting preview |
| Tooltips | Custom hover element | `components/ui/tooltip` (supplementary only) |
| Focus trapping/restoration | Custom | Plain ref `.focus()` in effect; no new lib |

## Common Pitfalls

### Pitfall 1: Existing test selects the removed button
`TicketDetailPanel.test.tsx` "Restoring from Ignored keeps CLD-9" clicks `/^ignored$/i`. With the toggle gone this fails. Update it to click the `Restore` button (`getByRole('button', {name: /^restore$/i})`; note it must not match "Restore link to CLD-9", hence anchored regex). Also check `__tests__/TicketDetailPage.test.tsx` and `LinkedTicketsPage.test.tsx` for `detail.ignored` / "Ignored" button queries. [VERIFIED: grep of TicketDetailPanel.test.tsx; others ASSUMED to need checking]

### Pitfall 2: Dismiss vs Deny wording
Existing `detail.ignore` is "Dismiss" (EN) / "Zamietnuť" (SK) and calls `denyTicket` for non-linked tickets. New `detail.deny` ("Deny"/"Zamietnuť" per UI-SPEC) is a second button doing the same action in the Linked state, and the EN tab is called "Dismissed" (`nav.notMine`), while triage toasts say "Ignored". SK `detail.deny` equals SK `detail.ignore` ("Zamietnuť"), which is consistent. For EN, UI-SPEC and the roadmap say "Deny", so keep it; flag the Dismiss/Deny/Dismissed/Ignored drift as a known terminology issue (UI-SPEC already notes it). Tooltip text should interpolate `t('nav.notMine')` rather than hardcode "Not mine" (EN tab says "Dismissed", SK "Zamietnuté"). Recommended tooltip: "Move this ticket to the {{tab}} tab. The link to {{key}} is remembered, and you can undo this." [VERIFIED: en.json/sk.json lines 5, 110]

### Pitfall 3: `detail.deny` and `detail.deny.tooltip` flat keys
Locale files are flat JSON with dotted keys (`detail.ignored` and `detail.ignored.tooltip` coexist), so this pattern is safe. Do not nest. [VERIFIED: en.json]

### Pitfall 4: `seen` state keeps `copiedKey`
`applyState` carries `copiedKey` across states, so a `seen`/`handled` ticket may have a stale `copiedKey`. The hint and Restore-link label must be gated on `state === 'ignored' && copiedKey`, exactly. The `seen` state still shows normal Dismiss/Handled/Copy. [VERIFIED: triageActions.ts L16-L20]

### Pitfall 5: Double submit
UI-SPEC wants the clicked button `disabled` while in flight. `denyTicket` is optimistic so Deny unmounts immediately; the real in-flight window is `linkTicket` (not optimistic). Add local `linking` state (or reuse `copyPhase === 'loading_preview'` for needs-copy) and disable the Restore-link button. Reset in `finally`.

### Pitfall 6: i18n guard tests
- `translations.test.ts` requires identical key sets in `en.json`/`sk.json`, no empty values, and >80% of SK values differing from EN. Add both locales together.
- `groupLocale.test.ts` forbidden-term regex (`úloh|záložk|zmaza|...|\bissue\b`) applies only to `groups.*` keys, so it will NOT cover `detail.*`. To satisfy "SK uses tiket" for RQA-02, add a small test asserting the new `detail.*` SK strings do not match `/úloh/i` and that interpolation placeholders (`{{key}}`) match EN. [VERIFIED: groupLocale.test.ts L66-L77]
- `noLiteralStrings.test.ts` scans `src/features/groups` plus a short EXTRA_FILES list (TicketCard, TicketFilterBar, TicketListPage, AppShell). `GroupViewPage.tsx` is covered: any JSX literal text with letters or a dynamic `t(expr)` not in the allowlist fails. The new hint in `GroupViewPage` must use a literal key `t('detail.previouslyLinked', { key })`. Detail Page/Panel and `IgnoredTicketsPage` are not scanned but must follow the same rule. Do not add t() calls with dynamic keys. [VERIFIED: noLiteralStrings.test.ts]

### Pitfall 7: a11y of status badge as focus target
Making the badge `tabIndex={-1}` is fine for programmatic focus, but a span with no role gets no announcement; announcements belong to Phase 37. Add `outline-none` only if a visible indicator is not needed (focus via programmatic route); axe tests in `groups/__tests__/a11y.axe.test.tsx` may run on GroupViewPage, so re-run them.

### Pitfall 8: WebView2 focus
Focus on a newly mounted element in the same commit works with an effect; verification in WebView2 is Phase 37. Do not use `autoFocus` attribute.

## Code Examples

### Hint component
```tsx
// Detail variant (UI-SPEC): <p className="text-xs text-brand-muted mt-1">
export function RememberedLinkHint({ entry, variant }: { entry?: TriageEntry; variant: 'detail' | 'row' }) {
  const { t } = useTranslation();
  if (entry?.state !== 'ignored' || !entry.copiedKey) return null;
  const key = <span className="font-mono">{entry.copiedKey}</span>;
  return variant === 'detail'
    ? <p className="text-xs text-brand-muted mt-1">{t('detail.previouslyLinked', { key: entry.copiedKey })}</p>
    : <span className="text-xs text-brand-text-secondary whitespace-nowrap">{t('detail.previouslyLinked', { key: entry.copiedKey })}</span>;
}
```
To render the key in `font-mono` inside a translated sentence, use `<Trans>` with a component placeholder, or accept plain text. Simplest compliant option: plain interpolation (UI-SPEC's font-mono is a styling nicety; use `Trans` with `components={{ k: <span className="font-mono" /> }}` and value `Previously linked to <k>{{key}}</k>` only if you want it, and then add parity check for the tags in both locales). Recommend plain interpolation to keep guard tests simple. [ASSUMED: acceptable deviation, confirm]

### Locale entries (add to both files)
```
"detail.deny": "Deny" / "Zamietnuť"
"detail.deny.tooltip": EN "Move this ticket to the {{tab}} tab. The link to {{key}} is remembered, and you can undo this." / SK "Presunie tiket na kartu {{tab}}. Prepojenie s {{key}} sa zapamätá a môžete to vrátiť späť."
"detail.restoreLink": "Restore link to {{key}}" / "Obnoviť prepojenie s {{key}}"
"detail.restoreLink.tooltip": "Link this ticket to {{key}} again. No new Jira issue is created." / "Znova prepojí tiket s {{key}}. Nevytvorí sa nový Jira tiket."
"detail.previouslyLinked": "Previously linked to {{key}}" / "Predtým prepojené s {{key}}"
```
The Deny tooltip needs a key only for a linked ticket (key known). Note `i18n` escapes interpolated values by default only if `escapeValue` is true; check `src/i18n/index.ts` (React usually sets false). [ASSUMED]

### Row hint placement
`IgnoredTicketsPage` actionSlot: place `<RememberedLinkHint variant="row" entry={triageMap[ticket.key]} />` before the Restore button. `GroupViewPage` inside the `badge === 'nav.notMine'` fragment, before the Restore button, using `entry`. Note `IgnoredTicketsPage` lists `handled` and `ignored` (and possibly others via `isNotMineCandidate`); the hint component's own state gate handles that.

## State of the Art

No ecosystem change relevant. The "Ignored" toggle button in detail is superseded by explicit Restore and Link buttons (explicit-actions preference).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Other tests (`TicketDetailPage.test.tsx`, `LinkedTicketsPage.test.tsx`) may query the old "Ignored" button | Pitfalls | Extra test fixes at execution; grep first |
| A2 | Plain interpolation for the hint key (no `font-mono`) is acceptable | Code Examples | Minor UI-SPEC deviation; use `Trans` if user wants mono |
| A3 | i18n `escapeValue` is false so keys with special characters render unescaped | Code Examples | Rare key characters would render escaped; keys are `ABC-123` so no practical risk |

## Open Questions

1. **Should Page and Panel share a hook or just duplicate edits?**
   - Recommendation: shared hook (`useTriageDetailActions`) and hint component; keep separate JSX.
2. **Terminology drift ("Dismissed"/"Ignored"/"Not mine")**
   - Recommendation: interpolate `t('nav.notMine')` in tooltips; do not rename tabs here.
3. **Panel is not rendered by any live screen.**
   - Recommendation: still implement (requirement text says panel); test through its existing test file.

## Environment Availability

Step 2.6: SKIPPED (code/config-only change; node/vitest/biome already used by the project).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1 + @testing-library/react + vitest-axe |
| Config file | existing (vite/vitest config in repo root) |
| Quick run command | `npx vitest run src/features/tickets src/i18n` |
| Full suite command | `npm test` (vitest run) ; lint: `npm run lint` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RTRI-01 | Linked detail (Page and Panel) shows labelled Deny; click calls `set_triage_state` ignored, no Jira call | component | `npx vitest run src/features/tickets/TicketDetailPanel.test.tsx src/features/tickets/__tests__/TicketDetailPage.test.tsx` | Panel test yes (extend); Page test yes (extend) |
| RTRI-04 | After Deny, `document.activeElement` is the Link / Restore-link button; after relink, the badge; after Restore, Dismiss; rollback returns to Deny | component | same | extend |
| RLNK-03 | Denied + copiedKey: hint text visible, button named "Restore link to CLD-9"; never-linked: `Copy to ...` and no hint; hint in `IgnoredTicketsPage` and GroupViewPage Not-mine row | component | `npx vitest run src/features/tickets src/features/groups/__tests__/GroupViewPage.test.tsx` | extend; new `RememberedLinkHint.test.tsx` |
| RLNK-04 | Opening a ticket from GroupViewPage and rendering detail shows Deny/Link | component/integration | `npx vitest run src/features/groups` | extend GroupViewPage.test or add |
| RQA-02 | EN/SK parity, non-empty, SK has no "úloh" and matching placeholders; noLiteralStrings and groupLocale still green | unit | `npx vitest run src/i18n` | translations/noLiteralStrings exist; add new detail-key test |
| (regression) | Restore-link `needs-copy` path starts preview; `failed` shows toast | component | mock `invoke` for `relink_ticket` returning null / reject | extend |

### Sampling Rate
- Per task commit: `npx vitest run <touched dirs>` and `npx biome check <touched files>`
- Per wave merge: `npm test`
- Phase gate: full suite and `npm run lint` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `TicketDetailPanel.test.tsx` "Restoring from Ignored" test to the new Restore button (anchored regex)
- [ ] Add a `detail.*` SK forbidden-term / placeholder-parity test (e.g. `src/i18n/__tests__/detailLocale.test.ts`)
- None for framework install.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3 Auth/Session | no | - |
| V4 Access Control | no | No new IPC; reuse existing commands |
| V5 Input Validation | minimal | Key comes from the DB via `relink_ticket`; rendered through React text nodes (auto-escaped). Do not use `dangerouslySetInnerHTML`/`Trans` with raw HTML |
| V6 Cryptography | no | - |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Rendering a remembered key containing markup | Tampering/XSS | React text interpolation only; use DB-returned key (as `undoDeny` already does, T-35-03) |
| Double-submit relink | Tampering | Disable button while in flight |

## Sources

### Primary (HIGH confidence, direct code inspection)
- src/features/tickets/triageActions.ts, TicketDetailPanel.tsx, TicketDetailPage.tsx, IgnoredTicketsPage.tsx, TicketDetailPanel.test.tsx
- src/features/groups/GroupViewPage.tsx (row actionSlot), src/App.tsx (detail routing)
- src/i18n/locales/en.json, sk.json; src/i18n/__tests__/translations.test.ts, groupLocale.test.ts, noLiteralStrings.test.ts
- .planning/phases/36-detail-and-group-ui/36-CONTEXT.md, 36-UI-SPEC.md; REQUIREMENTS.md

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new dependencies)
- Architecture: HIGH (existing modules inspected)
- Pitfalls: HIGH for i18n/test items, MEDIUM for focus-on-rollback (untested in WebView2)

**Research date:** 2026-10-15
**Valid until:** 2026-11-15 (stable internal code)
