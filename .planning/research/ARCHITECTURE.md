# Architecture Research: v0.5.1 Re-triage

**Domain:** Triage state machine extension in an existing Tauri 2 / React 19 / Rust app
**Researched:** 2026-10-15
**Confidence:** HIGH (all findings come from reading the current source; no external libraries involved)

## Key Finding: the data layer already supports this

The backend already retains the Cloud link across state changes. The work is mostly frontend (optimistic updates, one new restore path, detail buttons) plus one small backend command.

- `TriageDb::set_triage` (`src-tauri/src/triage_db.rs:208`) upserts with `ON CONFLICT ... DO UPDATE SET state=?2, last_updated=?3`. It does **not** touch `copied_key`. Setting `ignored` on a `copied` row therefore keeps `copied_key` in SQLite.
- `TriageDb::set_triage_copied` (`:197`) is the only writer of `copied_key`. It sets state `copied` and the key. It is called once, at `commands.rs:1852` ("Phase 8 - Update triage state") at the end of `copy_ticket_v2`.
- `get_all_triage` (`:183`) selects `ticket_key, state, copied_key` for every row regardless of state. `get_triage_state` (`commands.rs:1026`) and `fetch_candidate_tickets` (`commands.rs:827-835`, `triage_map` in the response) both map this to `TriageEntryResponse { state, copiedKey }`. So **denied tickets already hydrate with their retained `copiedKey`** on every fetch or poll, after a copy (`CopyResultPage`/`CopyResultModal` call `get_triage_state`), and in `TicketListPage.tsx:404`.
- The CHECK constraint allows `ignored` and `copied`, so no schema migration is needed.
- `set_triage_state` (`commands.rs:1041`) validates only the state enum. Nothing stops `copied` -> `ignored` today.
- Done tickets are purged by `delete_triage_entries` on fetch (`commands.rs:819`). This drops the retained key for done tickets. That is acceptable and matches the existing "done tickets leave all tabs" rule, but it is an edge case to document.

## Where the frontend loses the key (the real gap)

Every optimistic update writes `copiedKey: null` into `triageMap`, while the DB retains the key:

| Location | Write |
|----------|-------|
| `TicketDetailPage.tsx:54-60` `handleIgnore` | `{ state: 'ignored', copiedKey: null }` |
| `TicketDetailPanel.tsx:53-58` (same handlers) | same |
| `handleUnignore`, `handleMarkHandled`, `handleUnhandle` (both files) | `{ state: ..., copiedKey: null }` |
| `triageActions.ts` `restoreTicket` | `optimistic = { state: 'seen', copiedKey: null }` |

Consequences for the new features:

1. **Deny from Linked:** if the new handler copies the existing `handleIgnore` pattern, the store shows `ignored` with `copiedKey: null` even though the DB has the key. The re-link button then cannot decide between "restore" and "open preview" until something rehydrates (next fetch, manual poll, copy result). That would be a flaky, timing-dependent bug.
2. **Rollback:** `restoreTicket` compares `current[issueKey] === optimistic` by reference for rollback. Any change to it must keep that identity check.
3. **Existing "Restore" from Not mine / group view** sets `seen` and nulls the key in the store. The DB keeps the key. After a rehydration the entry reappears as `{seen, copiedKey: 'CLOUD-9'}`. A later fresh copy overwrites it via `set_triage_copied`, which orphans the old Cloud issue and creates a duplicate. Decide explicitly how this path behaves (see Open Decisions).

Rule for the build: every optimistic triage write must spread the previous entry (`{ ...prev, state }`) or explicitly pass `prev?.copiedKey ?? null`, so the store mirrors the DB. Only `set_triage_copied` and "forget link" ever change the key.

## Recommended Architecture

### State machine (per ticket, `triage_state` row)

```
new --seen--> seen --copy--> copied(key=K)
                |  ^            |  ^
        ignore/handled |        | deny (NEW)      relink-with-key (NEW)
                v  |            v  |   state=ignored, key=K retained
             ignored/handled ---+  +--- state=copied, key=K (no Cloud call)
                                |
        relink-without-key: open copy preview -> copy_ticket_v2 -> copied(key=K2)
```

Invariant: `copied_key IS NOT NULL` for any ticket that has ever been copied; state `copied` is the only state that renders it as a live link.

### Backend changes (small)

| Item | Type | Detail |
|------|------|--------|
| `TriageDb::restore_linked(key) -> AppResult<Option<String>>` | NEW | Single statement: `UPDATE triage_state SET state='copied', last_updated=? WHERE ticket_key=? AND copied_key IS NOT NULL`. Returns the key if a row was updated, `None` otherwise. Atomic, so the "does a key exist" check cannot race the frontend's view. |
| `relink_ticket` Tauri command (`commands.rs`, near `set_triage_state`) | NEW | Wraps `restore_linked`; returns `Option<String>` (the restored `copiedKey`, or `null` meaning "no prior link, open preview"). Register in `main.rs` `generate_handler!`. |
| `set_triage_state` | MODIFY (guard) | Reject `state='copied'` from the generic command, because it would produce `copied` with a null key. Keeps `copied` writable only via `set_triage_copied` and `restore_linked`. Existing frontend never sends `copied` through it. |
| `set_triage` | UNCHANGED | Already preserves `copied_key`. Add a Rust test asserting this explicitly (copied -> ignored keeps key; ignored -> seen keeps key). |
| Deny | NO NEW COMMAND | Reuse `set_triage_state('ignored')`. No Cloud API call: the Cloud copy is untouched by requirement. |
| `copy_ticket_v2` / `set_triage_copied` | UNCHANGED | Fresh copy path stays the same. |

Alternative considered: have the frontend decide via `triageMap[k].copiedKey` and call `set_triage_state('copied')`. Rejected: needs a state-enum loosening, depends on store freshness, and can create `copied` rows with null key. The atomic command is simpler to test.

### Frontend changes

| Item | Type | Detail |
|------|------|--------|
| `triageActions.ts` | MODIFY + NEW exports | Add `denyLinkedTicket(key)` and `relinkTicket(key, onNeedsCopy)` next to `restoreTicket`. Both use the optimistic + reference-identity rollback pattern already in `restoreTicket`. |
| `denyLinkedTicket` | NEW | Optimistic `{ ...prev, state: 'ignored' }` (copiedKey preserved from `prev`), then `invoke('set_triage_state', { state: 'ignored' })`. On error roll back and toast. |
| `relinkTicket` | NEW | `invoke<string \| null>('relink_ticket')`. If a key returns: `hydrateTriageMap` with `{ state: 'copied', copiedKey }`. If `null`: call the copy-preview entry (`useCopyStore.startPreview(detail, baseUrl, cloudBaseUrl)`), no triage change. Do not flip state optimistically, because the outcome is only known after the backend answers. |
| `restoreTicket` | MODIFY | Preserve `prev.copiedKey` in the optimistic entry (`{ state: 'seen', copiedKey: prev?.copiedKey ?? null }`) so store matches DB. Update `triageActions.test.ts` expectations. |
| Detail handlers | MODIFY | `handleIgnore/Unignore/MarkHandled/Unhandle` in `TicketDetailPage.tsx` and `TicketDetailPanel.tsx` must keep `copiedKey`. These two files duplicate the handlers; better to route them through shared `triageActions` helpers while in there (small refactor, avoids fixing the bug twice). |
| `ticketListUtils.ts` | UNCHANGED | Predicates key off `state` only. `copied` -> Linked, `ignored`/`handled` -> Not mine, so deny/relink automatically move the ticket between tabs. `groupBadgeKey` and `GroupViewPage` badge follow for free. |
| `ticketStore` counts | VERIFY | `hydrateTriageMap` recomputes `newCount` (`ticketStore.ts:208-211`). Tab counts are derived from predicates. Verify the Linked/Not mine counters (nav badges, tab labels) read from predicates or from `triageMap` and not a cached value. |
| `TicketDetailPage.tsx` / `TicketDetailPanel.tsx` | MODIFY | Linked branch (`isCopied && copiedKey`): add explicit labelled "Not mine" (deny) button next to the open-in-Jira buttons. Ignored branch: when `triageEntry?.copiedKey` exists, show a "Link" button (re-link) in addition to or instead of the plain "Ignored" un-ignore button. Per user preference, explicit labelled buttons in detail, one entry point per action, no hover icons. Handle the `Copy` button's visibility condition (`!isCopied && !isIgnored && !isHandled`): the no-key relink path calls `startPreview` directly from the Link button. |
| `IgnoredTicketsPage.tsx`, `GroupViewPage.tsx` | MODIFY (minor) | Their "Restore" calls `restoreTicket`. For entries that have a retained `copiedKey`, decide label/behaviour (see Open Decisions). Cards can show a small "was linked to KEY" hint via `TriageIndicator` (already takes `copiedKey`). |
| `TriageIndicator.tsx` | MODIFY (optional) | Currently only renders the link for `state === 'copied'`; ignored branch shows plain "Ignored". Optionally show retained key. |
| `LinkedTicketsPage.tsx` | UNCHANGED | Uses `isLinkedCandidate`; denied tickets drop out automatically. |
| i18n EN/SK (`detail.deny`, `detail.relink`, tooltips, failure toasts) | NEW keys | Slovak must use "tiket" not "uloha" (guard test enforces it). Add both locales together to satisfy parity tests. |
| Groups | UNCHANGED | Membership is independent of triage. Group view badge recomputed from `triageMap`. Group snapshots untouched. |

### Component boundaries

| Component | Responsibility | Talks to |
|-----------|---------------|----------|
| `triage_db.rs` | Sole owner of `triage_state` incl. retained `copied_key`; adds atomic `restore_linked` | `commands.rs` |
| `commands.rs` `relink_ticket` | Decide restore vs needs-copy, atomically | `triage_db`, frontend |
| `triageActions.ts` | All optimistic triage transitions + rollback (single place) | `ticketStore`, `invoke`, copy store |
| `ticketStore.triageMap` | Mirror of DB incl. retained key | Selectors/predicates |
| Detail page/panel | Explicit Deny / Link buttons only; no state logic | `triageActions` |

## Data Flow

### Deny a Linked ticket
```
Detail "Not mine" button -> denyLinkedTicket(key)
  -> store: {state:'ignored', copiedKey:K} (K kept)   [optimistic]
  -> invoke set_triage_state(key,'ignored')           [DB keeps copied_key]
  -> predicates: leaves Linked tab, enters Not mine; group badge flips
  -> failure: rollback to prev (reference-identity guard) + toast
```

### Re-link a denied ticket
```
Detail "Link" button -> relinkTicket(key)
  -> invoke relink_ticket(key)  (UPDATE ... WHERE copied_key IS NOT NULL)
       key K  -> store {state:'copied', copiedKey:K}; no Jira call; Cloud copy not re-created
       null   -> useCopyStore.startPreview(...) -> normal copy flow -> set_triage_copied
```

### Hydration of the retained key
`copiedKey` for non-copied rows reaches the store through the existing paths: `fetch_candidate_tickets.triage_map`, `get_triage_state` (TicketListPage mount at `:404`, CopyResult page/modal). No new hydration command is required, provided optimistic writes preserve the key. The new `relink_ticket` returns the key itself, so re-link does not depend on prior hydration at all.

## Anti-Patterns

### Optimistic write that nulls the key
**What people do:** copy the existing `{ state: 'ignored', copiedKey: null }` literal.
**Why it's wrong:** store and DB diverge; Link button picks the wrong branch until a refetch.
**Do this instead:** spread `prev` and change only `state`.

### Letting the frontend infer "has link" for re-link
**Why it's wrong:** stale store and two writers. **Instead:** let the backend decide atomically.

### Re-copying a denied ticket that has a key
**Why it's wrong:** `set_triage_copied` overwrites `copied_key`, orphaning the old Cloud issue and creating a duplicate. **Instead:** the Link button always goes through `relink_ticket` first; only a `null` result opens the preview.

## Open Decisions (for requirements/roadmap)

1. "Restore" on a denied-with-key ticket in Not mine / group view: either keep it (-> `seen`, New tab, key retained, risk of duplicate copy later) or show "Link" there too. Recommendation: in Not mine, keep "Restore" for tickets without a key; for ones with a key, label the action "Link" and route to `relinkTicket` so one action maps to one outcome. Needs a decision.
2. Whether `handled` -> relink should be allowed (state `handled` also retains key). Recommendation: same behaviour as `ignored`.
3. Should the Cloud issue get a marker (label/comment) on deny? Requirement says untouched; recommend no Cloud calls.
4. Done tickets lose the retained key via `delete_triage_entries` (purged at fetch). Acceptable; note in docs.

## Suggested Build Order

1. **Backend + tests**: `restore_linked` in `triage_db.rs` (+ tests: deny preserves key, restore with/without key, ignored->seen preserves key), `relink_ticket` command + `main.rs` registration, `set_triage_state` guard against `copied`. No UI dependency.
2. **Store/actions**: fix key-preservation in `restoreTicket`; add `denyLinkedTicket` / `relinkTicket` in `triageActions.ts`; unit tests (optimistic, rollback, null-vs-key branch). Depends on 1.
3. **Detail UI + i18n**: Deny button in Linked branch and Link button in ignored branch of `TicketDetailPage` and `TicketDetailPanel`, move their duplicated handlers onto `triageActions`, EN/SK keys. Depends on 2.
4. **Consistency pass**: Not mine / group view Restore vs Link decision, `TriageIndicator` retained-key hint, verify tab counts and group badge after deny/relink (add regression tests alongside `ticketListParity`, `groupBadge`, `membershipRegression`), mock server scenario for the no-key branch.

## Sources

Read directly (HIGH confidence): `src-tauri/src/triage_db.rs`, `src-tauri/src/commands.rs` (triage commands ~1015-1060, fetch ~795-835, copy triage update ~1852), `src/features/tickets/{triageActions.ts,ticketListUtils.ts,ticketStore.ts,TicketDetailPage.tsx,TicketDetailPanel.tsx,IgnoredTicketsPage.tsx,LinkedTicketsPage.tsx,TriageIndicator.tsx,types.ts,TicketListPage.tsx,CopyResultPage.tsx,CopyResultModal.tsx}`, `src/features/groups/{GroupViewPage.tsx,groupBadge.ts}`, `.planning/PROJECT.md`.

---
*Architecture research for: Re-triage (v0.5.1)*
*Researched: 2026-10-15*
