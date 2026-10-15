# Feature Landscape: Re-triage (v0.5.1)

**Domain:** Triage/inbox state transitions in a Jira-bridging desktop app
**Researched:** 2026-10-15
**Confidence:** MEDIUM. Inbox-tool conventions come from general knowledge (Linear, GitHub notifications, email "move back to inbox"). I did not do a web survey. Codebase findings are HIGH (read directly).

## Codebase facts that shape the features

- `triage_state` has `state` (new/seen/ignored/copied/handled) and a separate `copied_key` column (`src-tauri/src/triage_db.rs`).
- `set_triage()` upserts `state` and `last_updated` only. On conflict it does not touch `copied_key`. So the DB already keeps the Cloud key when a copied ticket moves to ignored/handled. `set_triage_copied()` is the only writer of `copied_key`.
- `get_all_triage` returns `copied_key` regardless of state. After a reload, a denied-but-previously-linked ticket therefore already hydrates as `{state:'ignored', copiedKey:'CLOUD-12'}`.
- The frontend wipes the key in the optimistic updates (`TicketDetailPanel.tsx` ~L57-81 and `triageActions.restoreTicket`, which write `copiedKey: null`). The store and the DB would then disagree until the next hydrate. This is the main correctness trap.
- The detail panel hides every triage button when `isCopied || isIgnored || isHandled` (L271, L333), so the deny entry point does not exist yet for Linked tickets.
- `restoreTicket` sets the state to `'seen'` but leaves `copied_key` in the DB. A restored ticket that was once linked therefore has a stale key.
- There is no "unlink" in the DB model. Deny must mean "state is not copied, key is retained", and the key is the link memory.

## Table Stakes

| Feature | Why Expected | Complexity | Dependencies / Notes |
|---------|--------------|------------|----------------------|
| "Deny" labelled button in detail for a Linked ticket | Core ask. Every inbox tool lets you move an item back out of "done". The user's rule is one explicit labelled button, no hover icon. | Low | `TicketDetailPanel` conditionals. Reuse the `handled` vs `ignored` semantics: pick one target state (see Open Decisions). Call `set_triage_state` with the non-copied state. |
| Cloud copy untouched on deny | Moving a ticket between tabs is a local triage decision. Anything that mutates Cloud is surprising and destructive. | Low | Deny must call no Jira Cloud API. Test that no HTTP or audit rows are written. |
| Link memory preserved across deny | The point of the milestone. | Low | Rust already preserves `copied_key`. Fix the frontend optimistic updates to carry the previous `copiedKey` instead of `null`. Add a Rust test that `set_triage` keeps `copied_key`. |
| "Link" action on a denied ticket restores the prior link when a key exists | Core ask. The same copied key is restored, with no duplicate Cloud issue. | Med | New Rust command, e.g. `restore_link(ticket_key)`: if `copied_key` is present, set state to `copied` without a pipeline run. Otherwise the frontend opens the existing copy preview. Needs an atomic backend check, not only a frontend read of the store. |
| Link on a denied ticket with no prior key opens the normal copy preview | Core ask. | Low | Reuse `copyStore.startPreview`. A denied ticket never copied is the same as today's flow. |
| Immediate, consistent tab lists and counts | Counts that lag or disagree with the lists read as bugs. | Med | Triage map in `ticketStore` drives New / Not mine / Linked lists and counts. Update the map once and derive everything from it. Add tests that a deny moves the ticket from Linked to Not mine with both counts changing. |
| Group membership unchanged by re-triage | Groups are tag-like and orthogonal to triage state. A deny must not drop a ticket from its groups. | Low | Groups only read the triage map for the badge (`groupBadge.ts`). Verify the group view badge flips from "Linked" to "Not mine" and the membership stays. |
| Group view and card badges reflect the new state | The v0.5.0 group view shows triage badges. Stale badges would break the consistency requirement. | Low-Med | `groupBadge.ts`, `GroupViewPage`, `TicketCard`/`TriageIndicator`. All should derive from `triageMap`. |
| Failure rollback plus toast | The existing `restoreTicket` pattern rolls back optimistically and toasts. | Low | Copy that pattern. Roll back to the prior full entry, including `copiedKey`. |
| EN/SK strings, "tiket" in Slovak | Project rule. A guard test enforces it. | Low | New keys for the deny button, tooltip, link-restore button, success/failure toasts and any confirmation text. Slovak uses "tiket", not "úloha". |
| Linked tab / detail display correct for restored link | After re-link, the badge shows `copied → CLOUD-12` and the open-in-Cloud action works. | Low | The existing `isCopied && copiedKey` branch handles it once the state is `copied`. |

## Edge Cases That Must Be Handled

| Edge case | Expected behaviour | Complexity | Notes |
|-----------|--------------------|------------|-------|
| Denied, then re-linked (round trip) | Same Cloud key, no new Cloud issue, no copy pipeline. Repeating deny/link any number of times is idempotent. | Low | Covered by the restore command. |
| Prior link exists but the Cloud issue was deleted | A pure local restore would show a dead link. Best option: on re-link, do a lightweight existence check (GET the Cloud issue). If it returns 404, fall back to the copy preview and clear or replace the stale key. If the network or auth check fails, do not conclude the issue is gone. Restore the link, or warn and let the user choose. | Med-High | New Cloud call. It must go through the audited client or deliberately bypass it, like the preview lookups (precedent: "Preview lookups bypass HTTP audit client"). Needs a mock server case for 404. Also decide what happens to the dead key on the Linked tab. Flag for phase research. |
| Cloud issue moved or renamed (key changed) | Jira redirects by key in the browser, but the REST GET may 404 or redirect. Not detectable without storing the issue id. | Med | Likely out of scope. Documenting it as a known limitation is acceptable. |
| Denied ticket restored to `seen` (via the existing Restore) while a `copied_key` is retained | The ticket then shows as New, but a later Link would offer "restore prior link". Decide whether Restore-to-New clears the key. | Low | Recommendation: keep the key (link memory is the milestone's promise) and let Link on any non-copied ticket check for a key. Do not let "New" with a stale key render as Linked anywhere. |
| Ticket was Linked, denied, then the source ticket changes upstream | Polling and change detection continue as before. Denied tickets already appear under Not mine. The blue dot on a denied ticket must not resurrect it into New. | Low | Check the interaction with `new`-state promotion on poll. |
| Ticket in a group is denied, and the group is open | The row stays in the group view with a changed badge. Selection and "No longer in results" logic is unaffected. | Low | Selection state is keyed by issue key. |
| Ticket denied while its detail is open from the Linked tab | The ticket leaves the Linked list. The detail pane should stay open with the updated state, or cleanly close with focus moved. | Low-Med | WCAG AA: do not strand focus. Announce via the live region, as the group moves do. |
| Rapid double-click, or a stale optimistic state | The backend is the source of truth. The restore command should be idempotent and refuse a double copy. | Low | |
| Two copies for one source (key recorded twice) | Link must never create a second Cloud issue when a key exists. The copy preview's "already copied" guard, if any, should agree with the restore path. | Med | Check whether the copy button is currently disabled for `copied` only. A denied ticket with a key must not be copyable through a back door (e.g. the card or group multi-select). |
| Denied ticket with `copiedKey` appears under Not mine | The Not mine list shows both ignored and handled tickets, and may need to show a "previously linked to CLOUD-12" hint. | Low | See Differentiators. |
| Bulk and multi-select | The group view has multi-select (`SelectionBar`). A bulk Deny or Link is not requested. | n/a | Anti-feature this milestone. |

## Differentiators

Not expected by the milestone text, but cheap and valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Previously linked to CLOUD-12" chip/line on a denied ticket in detail | The user sees the link memory, and why the Link button will restore instead of copy. | Low | Data is already in `triageMap`. Label the Link button "Restore link to CLOUD-12" when a key is retained, so the two outcomes are distinguishable. |
| Different button label for restore vs copy ("Restore link" vs "Link") | Avoids surprise about whether a Cloud issue gets created. | Low | Strongly recommended, because the behaviour differs. |
| Open prior Cloud issue from a denied ticket | Lets the user verify the old copy before restoring. | Low | Reuses `open_external_url`. |
| Confirmation or undo toast on deny | Deny is reversible, so prefer a sonner toast with an "Undo" action over a modal. | Low-Med | Matches inbox-tool norms. The undo calls the restore path. |
| Cloud-existence check on restore (see edge cases) | Prevents a silently dead link. | Med-High | Could ship as a later iteration if scope is tight. |
| Small marker on Not mine cards that have link memory | Scannability. | Low | Optional. Keep it minimal to match the tab/chip style. |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|--------------------|
| Hover-revealed icon on rows for deny/link | Violates the user's explicit-action rule and gives two entry points. | One labelled button in ticket detail. |
| Drag and drop between tabs | Banned by the user. | Buttons only. |
| Deleting or closing the Cloud issue on deny | Destructive and out of scope. Cloud copy stays untouched. | Local state change only. |
| Re-running the copy pipeline on restore | Would create a duplicate Cloud issue. | Restore from the stored key. |
| Forgetting the link on deny (clearing `copied_key`) | Defeats the milestone. | Retain the key. |
| Bulk Deny/Link across selection | Not requested. Bulk copy is already an Out of Scope decision (it defeats the review workflow). | Single-ticket action in detail. Revisit later if asked. |
| Two-way sync of Cloud issue state | Out of Scope (one-time copy with origin tracking). | n/a |
| Auto-deny when the Cloud issue is deleted | Silent state changes surprise users. | Surface the dead link at restore time only. |
| New confirmation modals for a reversible local action | Friction without benefit. | Undo toast (differentiator). |

## Feature Dependencies

```
Fix optimistic updates to carry copiedKey (frontend) --> Deny from Linked (keeps key)
Rust set_triage already keeps copied_key --> Deny from Linked
Deny from Linked --> Link-restore (needs a retained key)
Link-restore (new Rust command) --> Cloud existence check (optional, Med-High)
Link-restore --> Link with no key falls through to existing copyStore.startPreview
triageMap single source of truth --> Tab lists/counts, group view badges, card badges (all derived, no extra work if so)
New i18n keys (EN+SK) --> every user-visible piece above
```

## MVP Recommendation

Prioritize:
1. Frontend data-model fix: keep `copiedKey` through ignore/handled/restore transitions. Add a Rust test that `set_triage` retains `copied_key`.
2. Deny button in detail for Linked tickets (Cloud untouched, optimistic update with rollback and toast).
3. Link on denied tickets: restore command if a key exists, otherwise the normal copy preview. Use a distinct label when restoring.
4. Consistency pass: tab counts, group view badges, cards and the detail pane's focus and live-region behaviour. Add EN/SK strings and tests (including the "tiket" guard).

Include if cheap: "previously linked to X" line and the undo toast.

Defer: the Cloud existence check is the one real unknown. Decide in planning whether it is in scope. If it is not, record the dead-key case as a known limitation, since the restore would simply show a link to a missing issue. Also defer bulk actions and any key-changed or moved-issue handling.

## Open Decisions for the Roadmap

- Which state a denied Linked ticket gets: `ignored` or `handled`. The Not mine tab covers both. `handled` means "dealt with elsewhere" and `ignored` means "not relevant", and the detail panel renders them differently. A reasonable default is `handled`, since the ticket was dealt with. Ask the user.
- Whether Restore-to-New on a ticket with a retained key should clear the key. Recommendation: keep it, and have Link check for one whenever the state is not `copied`.
- Whether the dead-Cloud-issue check ships in v0.5.1.

## Sources

- Codebase (HIGH): `src-tauri/src/triage_db.rs`, `src-tauri/src/commands.rs` (`set_triage_state`), `src/features/tickets/TicketDetailPanel.tsx`, `src/features/tickets/triageActions.ts`, `src/features/tickets/types.ts`, `.planning/PROJECT.md`.
- Inbox-tool conventions (Linear, GitHub notifications, email move-to-inbox, undo toast over confirmation): general domain knowledge, not re-verified (LOW-MEDIUM).
