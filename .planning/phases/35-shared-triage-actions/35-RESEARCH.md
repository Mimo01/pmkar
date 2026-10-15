# Phase 35: Shared Triage Actions - Research

**Researched:** 2026-10-15
**Domain:** Frontend (React 19 / Zustand / sonner 2.x / Tauri IPC) triage state transitions
**Confidence:** HIGH (all findings from reading the codebase directly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Deny shows a sonner toast with an Undo action that stays ~8 seconds.
- D-02: Undo is global, not tied to the current screen: calls `relink_ticket` for that key and restores Linked with the same Cloud key even if the user navigated elsewhere. No dismiss-on-navigation.
- D-03: If Undo's `relink_ticket` fails or returns `None`, show an error toast and leave the ticket in Not mine (store matches DB).
- D-04: Deny is optimistic: set the store entry to `ignored` (keeping `copiedKey`), call `set_triage_state('ignored')`. No Jira call anywhere in this path.
- D-05: On IPC failure, roll back only if the entry is unchanged since the optimistic write (same pattern as today's `restoreTicket`), show an error toast, and show no Undo toast.
- D-06: `linkTicket(key)` calls `relink_ticket`. A returned key sets the store entry to `copied` with that key and performs no copy. `None` hands off to the existing copy-preview flow.
- D-07: The shared module owns the hand-off (navigates to / starts the existing copy preview), so every entry point behaves the same. It returns a result (`'relinked' | 'needs-copy'`) for callers that need it.
- D-08: Link is not optimistic: the store changes only after `relink_ticket` answers.
- D-09: Every transition (deny, restore, handled) builds the new store entry by carrying the previous entry's `copiedKey`. Nothing writes `copiedKey: null` for an existing entry.
- D-10: Call sites stop writing `triageMap` directly; they call the shared module. No store-level defensive merge is required.
- D-11: Verification is by Vitest per transition plus a hydrate round-trip (re-hydrating from a mocked `get_triage_state`, simulating restart) asserting the key survives and the `invoke` args are right. Phase 34 Rust tests already cover the DB side.
- D-12: `triageActions.ts` exposes `denyTicket`, `linkTicket`, `restoreTicket`, `markHandled` (names at planner's discretion). Single place that writes triage transitions.
- D-13: All existing call sites migrate now: `TicketDetailPage`, `TicketDetailPanel`, the Dismissed page restore, group view, list cards.

### Claude's Discretion
- Exact function names, signature shapes, how the preview hand-off is wired.
- Toast i18n key names for Phase 35 (only strings needed for Undo and error toasts).

### Deferred Ideas (OUT OF SCOPE)
- Labelled Deny / Link buttons, "previously linked to KEY" hint, focus handling, broader EN/SK strings (Phase 36).
- Cloud existence check on re-link (future).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINT-01 | Remembered Cloud key survives deny/restore/handled in DB and store | DB `set_triage` already preserves `copied_key` (UPSERT only touches state, last_updated). Bug is purely frontend: 8 inline + 1 shared write of `copiedKey: null`. Fix by spreading `prev.copiedKey`. |
| RTRI-02 | Deny Linked ticket -> Not mine, no Jira call | `denyTicket` = optimistic store write + `set_triage_state('ignored')` only. |
| RTRI-03 | Undo toast returns to Linked with same key | sonner `toast(msg, {id, duration: 8000, action:{label,onClick}})`; onClick calls `relink_ticket`. |
| RLNK-01 | Link previously-linked denied ticket -> Linked, same key, no copy | `relink_ticket` returns `Some(key)`; store set to `{state:'copied', copiedKey:key}`. |
| RLNK-02 | Never-linked -> normal copy preview | `relink_ticket` returns `None`; hand off to `useCopyStore.startPreview(detail, ...)`. |
</phase_requirements>

## Summary

The backend is finished (Phase 34). `TriageDb::set_triage` is an UPSERT that sets only `state` and `last_updated`, so the DB never loses `copied_key` on deny/restore/handled `[VERIFIED: src-tauri/src/triage_db.rs L238-253]`. `relink` does `UPDATE ... SET state='copied' WHERE copied_key IS NOT NULL` and returns the key or `None` `[VERIFIED: triage_db.rs L226-236]`. `set_triage_state('copied')` is rejected by the DB. The only "disagreement" with the database is in the in-memory Zustand `triageMap`: every inline handler in `TicketDetailPage.tsx` (L54-83) and `TicketDetailPanel.tsx` (L53-82), plus `restoreTicket` in `triageActions.ts`, writes `copiedKey: null`. After a restart the key reappears (hydrated from DB), so store and DB diverge until restart, and the UI (e.g. `isCopied && triageEntry?.copiedKey`) loses the key in-session.

The work is therefore: rewrite `triageActions.ts` as the single writer of triage transitions (deny, restore, markHandled, link, plus the existing `unhandle` which is just restore), add an Undo toast, and migrate the call sites. No new packages. No backend change.

**Primary recommendation:** Build one internal helper `writeEntry(key, state)` that does `{ state, copiedKey: prev?.copiedKey ?? null }` and reuse the existing optimistic/rollback pattern in all of deny/restore/markHandled; implement `linkTicket` as non-optimistic `invoke('relink_ticket')`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persisting triage state and remembered key | Database (SQLite via Tauri cmds) | — | Already done in Phase 34; DB decides if a key exists |
| Triage transitions + optimistic store sync | Browser/Client (`triageActions.ts`) | Zustand `ticketStore` | Frontend-only phase; one writer |
| Undo toast | Browser/Client (sonner) | — | Global Toaster mounted in App.tsx |
| Copy-preview hand-off | Browser/Client (`copyStore.startPreview`; rendered by App.tsx on `copyPhase`) | Backend `fetch_cloud_meta` | Preview is global, not route-bound |

## Standard Stack

### Core (all already installed; no installs)
| Library | Version | Purpose |
|---------|---------|---------|
| zustand | existing | `ticketStore.triageMap` / `hydrateTriageMap` |
| sonner | ^2.0.7 `[VERIFIED: package.json]` | toast with `action` |
| @tauri-apps/api | existing | `invoke` |
| vitest | ^4.1.1 `[VERIFIED: package.json]` | tests |
| i18next / react-i18next | existing | `i18n.t` used outside components in `triageActions.ts` |

## Package Legitimacy Audit

No external packages are installed in this phase. Slopcheck not applicable.

**Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### Data flow
```
UI call sites (DetailPage, DetailPanel, IgnoredTicketsPage, GroupViewPage)
        |
        v
triageActions.ts  --- denyTicket / restoreTicket / markHandled --> optimistic store write (carry copiedKey)
        |                                                       --> invoke set_triage_state --> (fail) rollback-if-unchanged + toast.error
        |                                                       --> deny success: toast(Undo, 8s, id deny-KEY)
        |--- linkTicket --> invoke relink_ticket
        |                      |-- Some(key) -> store {copied, key}  => 'relinked'
        |                      |-- None      -> copyStore.startPreview(detail) => 'needs-copy' (App.tsx renders CopyPreviewPage)
        |                      '-- reject    -> toast.error(triage.linkFailed), store unchanged
        '--- Undo onClick --> invoke relink_ticket (same path as link, but None/err => toast.error(undoFailed))
```

### Pattern 1: carry-key transition with conditional rollback (extend existing `restoreTicket`)
```typescript
// Source: existing src/features/tickets/triageActions.ts, adapted
function applyState(issueKey: string, state: TriageState, failMsg: string): TriageEntry | null {
  const store = useTicketStore.getState();
  const prev = store.triageMap[issueKey];
  const optimistic: TriageEntry = { state, copiedKey: prev?.copiedKey ?? null }; // LINT-01 / D-09
  store.hydrateTriageMap({ ...store.triageMap, [issueKey]: optimistic });
  return invoke('set_triage_state', { ticketKey: issueKey, state })
    .then(() => true)
    .catch(() => {
      const current = useTicketStore.getState().triageMap;
      if (current[issueKey] === optimistic) {            // identity compare, per D-05
        const next = { ...current };
        if (prev === undefined) delete next[issueKey]; else next[issueKey] = prev;
        useTicketStore.getState().hydrateTriageMap(next);
      }
      toast.error(failMsg);
      return false;
    });
}
```
Make `denyTicket` async/return a Promise so the toast is fired only after `.then(true)`; the Undo toast must only appear on success (D-05).

### Pattern 2: sonner action toast (first in the app)
```typescript
// Source: sonner API (action: {label, onClick}, id, duration)
toast(i18n.t('triage.denied', { key }), {
  id: `deny-${key}`,           // repeated denies replace, not stack
  duration: 8000,
  action: { label: i18n.t('triage.undo'), onClick: () => { void undoDeny(key); } },
});
```
The existing Toaster wrapper already styles `actionButton` (`bg-brand text-white`) `[VERIFIED: components/ui/sonner.tsx L14]`.

### Pattern 3: link + hand-off
`startPreview` requires a full `JiraTicketDetail` (it reads `ticket.fields.*`) `[VERIFIED: copyStore.ts L88-]`, not just a key. `linkTicket(key, detail?)`: on `None`, if `detail` is supplied call `useCopyStore.getState().startPreview(detail, baseUrl, cloudBaseUrl)` (args after ticket are unused `_` params; pull from `useConnectionStore`). If no detail is available (a list-level caller), fetch via `invoke('fetch_ticket_detail', { baseUrl, issueKey })` using `useConnectionStore.getState().serverConnection?.baseUrl`, then start preview; on fetch failure show `triage.linkFailed`. Preview display is global: App.tsx renders `CopyPreviewPage` on `copyPhase` `loading_preview|previewing...` `[VERIFIED: App.tsx L258-265]`, so no navigation code is needed. Return `'needs-copy'`.

On `Some(key)`: write `{state:'copied', copiedKey: key}` to the store. Phase 34 DB already did it atomically, so no follow-up `set_triage_state`.

### Migration map (from grep)
| File | Current | Replace with |
|------|---------|--------------|
| `TicketDetailPage.tsx` L53-83 handleIgnore/Unignore/MarkHandled/Unhandle | inline invoke + `copiedKey:null` | `denyTicket`, `restoreTicket`, `markHandled`, `restoreTicket` |
| `TicketDetailPanel.tsx` L53-82 | identical duplicate | same |
| `IgnoredTicketsPage.tsx` L121 | `restoreTicket` | unchanged call; behaviour fixed inside module |
| `GroupViewPage.tsx` L166 | `restoreTicket` | unchanged call |
| `TicketListPage.tsx` L452 `handleSelectTicket` | `store.markSeen` + fire-and-forget `set_triage_state('seen')` | already key-preserving (`markSeen` spreads `...current`); only moves 'new'->'seen'. Leave, or optionally route through module; do NOT change semantics (it only fires for new tickets; note it persists 'seen' even for non-new tickets, which could overwrite a 'copied' DB state if called on a Linked card; verify card click path, see Pitfall 4). |
| `ticketStore.markSeen` | preserves key | leave |
| `CopyResultPage`/`CopyResultModal` | hydrate from `get_triage_state` | leave (DB is source of truth) |

Handlers in Detail page/panel have an obvious `handleStartCopy`; Phase 36 will wire Link buttons, so Phase 35 only needs the `linkTicket` function plus tests (no UI call site exists yet). Keep the `handleUnignore` / `handleUnhandle` names or inline-call `restoreTicket`.

### Anti-Patterns to Avoid
- Writing `triageMap` anywhere outside `triageActions.ts` (and `ticketStore` internals/hydrate).
- Returning `?? []` in a Zustand selector (project feedback; use `null`).
- Optimistic Link (D-08) or setting `'copied'` via `set_triage_state` (DB rejects it).
- Dismissing the deny toast on navigation (D-02) or using a toast tied to component lifecycle: the Undo callback must use `useTicketStore.getState()` not hooks/closures from a component.
- Calling `markHandled` on a Linked ticket and clearing the key; carry it.

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Undo UI | sonner `toast` `action` | already mounted; a11y (polite live region, Alt+T) |
| Restart simulation | `hydrateTriageMap` with mocked `get_triage_state` payload | the same path `TicketListPage` L405 uses |
| Key persistence | Phase 34 `relink_ticket` | atomic, idempotent |

## Common Pitfalls

### Pitfall 1: Rollback identity check broken
Rollback compares `current[issueKey] === optimistic`; building the entry via spread/clone elsewhere breaks identity. Keep the same object reference stored in the map `[VERIFIED: existing pattern, test 'does not clobber a newer triage change']`.

### Pitfall 2: Undo after state drift
User may deny, then re-link or restore before Undo. Undo calls `relink_ticket` which is idempotent and works on any state with a key, so it is safe; if the entry has meanwhile been changed to something else the Undo still returns to Linked, matching D-02. Dismiss toast (`toast.dismiss('deny-KEY')`) when a successful `linkTicket`/`restoreTicket` of that key happens to avoid a stale Undo (planner decision; cheap).

### Pitfall 3: Deny of a ticket with no key (New/Seen)
`denyTicket` is also used for ordinary Ignore from New. The Undo toast (return to Linked) is meaningless if `prev.copiedKey` is null. Show the Undo toast only when `prev?.state === 'copied'`/key exists; otherwise (plain ignore) show no toast, or an Undo that calls restore. CONTEXT scopes Undo to "denying a Linked ticket"; recommend: toast + Undo only when a remembered key exists, with no toast for plain ignore (preserves today's behaviour). Flag for planner/user (A1).

### Pitfall 4: `handleSelectTicket` persists 'seen' unconditionally
`TicketListPage.tsx` L452 invokes `set_triage_state('seen')` for any clicked ticket. DB `set_triage` sets state='seen' for rows that are 'copied' in the DB while the store's `markSeen` only changes 'new'; that is a pre-existing store/DB disagreement if the list card is clickable for Linked/ignored tickets. Check which list contexts call it; guard to `prev?.state === 'new'`. Small fix, in-scope for "never disagree with the database" (A2: confirm scope with user if unsure).

### Pitfall 5: `i18n.t` interpolation and guard tests
Add `triage.*` keys to BOTH `en.json` and `sk.json` `[VERIFIED: tests in src/i18n/__tests__/translations.test.ts, noLiteralStrings.test.ts exist]`; SK must say "tiket", never "úloha". Interpolation uses `{{key}}` in i18next, not `{KEY}`: UI-SPEC shows `{KEY}` loosely; use `{{key}}` in JSON (check existing interpolation convention in en.json).

### Pitfall 6: existing test mock of sonner
`triageActions.test.ts` mocks `sonner` as `{ toast: { error } }`. The new code calls `toast(...)` as a function plus `toast.error`, `toast.dismiss`; update the mock to `Object.assign(vi.fn(), { error, dismiss })`. Other tests importing components that import `triageActions` (IgnoredTicketsPage, GroupViewPage, DetailPage tests) may mock sonner or `invoke` differently; run full suite.

## Code Examples

### Hydrate round-trip test (D-11)
```typescript
useTicketStore.getState().hydrateTriageMap({ 'T-1': { state: 'copied', copiedKey: 'CLD-9' } });
invokeMock.mockResolvedValue(undefined);
await denyTicket('T-1');
expect(useTicketStore.getState().triageMap['T-1']).toEqual({ state: 'ignored', copiedKey: 'CLD-9' });
expect(invokeMock).toHaveBeenCalledWith('set_triage_state', { ticketKey: 'T-1', state: 'ignored' });
expect(invokeMock).not.toHaveBeenCalledWith('fetch_ticket_detail', expect.anything());
// simulate restart
invokeMock.mockResolvedValueOnce({ 'T-1': { state: 'ignored', copiedKey: 'CLD-9' } });
const map = await invoke('get_triage_state'); useTicketStore.getState().hydrateTriageMap(map);
// then Undo: relink_ticket -> 'CLD-9'
```
Note the mocked `get_triage_state` payload shape must match what the real command returns (`TriageEntry` with camelCase `copiedKey`); check serde rename in the Rust struct when writing the mock.

## State of the Art
Nothing deprecated. sonner 2.x `toast(message, { action, id, duration })` is current `[ASSUMED: from sonner API knowledge, not re-fetched this session]`; verify in the first test (action object appears in the mock call).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Undo toast only when a remembered key exists (plain ignore of New ticket shows no Undo) | Pitfall 3 | If user wants Undo on every deny, change one condition |
| A2 | Guarding `handleSelectTicket` 'seen' persist to only 'new' tickets is in scope | Pitfall 4 | Extra small change; otherwise leave as-is |
| A3 | sonner 2.x `toast()` accepts `{id, duration, action:{label,onClick}}` | Pattern 2 | Toast API shape; verify in test |
| A4 | i18next interpolation uses `{{key}}` in this project | Pitfall 5 | String shows literal braces |

## Open Questions (RESOLVED)

1. **What Undo does for a deny from non-Linked states.**
   - Recommendation: no Undo toast without a remembered key (A1).
   - RESOLVED: 35-01 Task 2 shows the Undo toast only when a remembered key exists.
2. **Where should `linkTicket` get `JiraTicketDetail` when called from a list?**
   - Recommendation: optional `detail` param; fall back to `fetch_ticket_detail`. Phase 36 call sites (detail) always have `detail`.
   - RESOLVED: 35-01 Task 2 adds optional `detail` with `fetch_ticket_detail` fallback.

## Environment Availability

Step 2.6 SKIPPED (frontend code only; node/vitest already in use).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.1 + @testing-library/react, vitest-axe |
| Config file | `/Users/mimo/Documents/Projects/pmkar/vitest.config.ts` |
| Quick run command | `npx vitest run src/features/tickets/__tests__/triageActions.test.ts` |
| Full suite command | `npm test` (plus `npm run lint`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINT-01 | deny/restore/markHandled keep `copiedKey` in store; invoke args correct | unit | `npx vitest run src/features/tickets/__tests__/triageActions.test.ts` | extend (exists; existing restore test asserts `copiedKey:null` for a null-key start, still valid) |
| LINT-01 | hydrate round-trip preserves key | unit | same | Wave 0 add |
| RTRI-02 | deny: only `set_triage_state('ignored')` invoked, no `fetch_*`/copy command | unit | same | Wave 0 add |
| RTRI-02 | deny failure: rollback only if unchanged, error toast, no Undo toast | unit | same | Wave 0 add |
| RTRI-03 | Undo toast: id `deny-KEY`, duration 8000, action label; click -> `relink_ticket` -> store `copied` same key; None/reject -> error toast, store stays ignored | unit | same | Wave 0 add |
| RLNK-01 | `linkTicket` Some(key) -> store copied/key, returns 'relinked', startPreview not called | unit | same | Wave 0 add |
| RLNK-02 | `linkTicket` None -> startPreview called (spy on `useCopyStore.getState().startPreview`), returns 'needs-copy'; reject -> error toast, store unchanged | unit | same | Wave 0 add |
| D-13 | Detail page & panel handlers call module, no `copiedKey:null` | component | `npx vitest run src/features/tickets/__tests__/TicketDetailPage.test.tsx` (+ panel test if present) | extend |
| i18n | new keys in EN+SK, no "úloha" | unit | `npx vitest run src/i18n/__tests__` | existing guards |

Static check: `grep -rn "copiedKey: null" src --include='*.tsx' --include='*.ts'` outside tests/types should return only the fallback inside `triageActions.ts` (`prev?.copiedKey ?? null`).

### Sampling Rate
- Per task commit: quick run command above
- Per wave merge: `npm test && npm run lint`
- Phase gate: full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update sonner mock in `triageActions.test.ts` to callable `toast` with `.error`/`.dismiss`
- [ ] New describe blocks for deny/link/markHandled/undo/round-trip
- [ ] Mock `useCopyStore.startPreview` via `vi.spyOn` for hand-off tests
- [ ] Manual (cannot automate): WebView2 check of 8 s toast + Alt+T keyboard reach of Undo; real restart check of success criterion 5 (add to UAT)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3 Auth/Session | no | — |
| V4 Access Control | no | local single-user desktop app |
| V5 Input Validation | yes (minimal) | Backend `validate_triage_state` already validates states; frontend passes only literal state strings |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Ticket key interpolated in toast text | Tampering/XSS | i18next/React render as text; do not enable `escapeValue:false` / HTML in toast |
| Deny path accidentally touching Jira | Integrity | Test asserts only `set_triage_state` is invoked |
| Undo applying wrong key | Integrity | Undo uses DB-returned key from `relink_ticket`, never a client-cached key |

## Sources

### Primary (HIGH confidence, direct code reads)
- `src-tauri/src/triage_db.rs` (`relink`, `set_triage`, `get_all_triage`), `src-tauri/src/commands.rs` (`relink_ticket`, `set_triage_state`, `ensure_not_linked`)
- `src/features/tickets/triageActions.ts`, `ticketStore.ts`, `copyStore.ts`, `TicketDetailPage.tsx`, `TicketDetailPanel.tsx`, `TicketListPage.tsx`, `App.tsx`, `components/ui/sonner.tsx`, `__tests__/triageActions.test.ts`
- `.planning/phases/35-shared-triage-actions/35-CONTEXT.md`, `35-UI-SPEC.md`, `.planning/REQUIREMENTS.md`

### Tertiary (LOW)
- sonner API shape from training knowledge (A3); not re-fetched.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (nothing new)
- Architecture: HIGH (code read)
- Pitfalls: MEDIUM-HIGH (Pitfall 4 reasoned from code, call paths not fully traced)

**Research date:** 2026-10-15
**Valid until:** 2026-11-15
