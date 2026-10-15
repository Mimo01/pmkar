# Pitfalls Research

**Domain:** Re-triage (Linked -> Denied -> Linked, keeping the Cloud link) added to the existing Pmkar triage system
**Researched:** 2026-10-15
**Confidence:** HIGH for pitfalls grounded in current code (triage_db.rs, commands.rs, poll_engine.rs, triageActions.ts, TicketDetailPanel.tsx, ticketListUtils.ts, groupBadge.ts). MEDIUM for Jira Cloud remote-link behavior (not re-verified against live docs). The WebView2 notes are LOW confidence.

## Code facts the pitfalls rest on

- `triage_state.copied_key` is only written by `set_triage_copied`. `set_triage(key, state)` upserts `state` and `last_updated` and leaves `copied_key` untouched. So the DB already retains the key across deny, but only by accident.
- Every frontend handler (`handleIgnore`, `handleUnignore`, `handleMarkHandled`, `handleUnhandle`, `restoreTicket`) writes `copiedKey: null` into the store optimistically. The DB keeps the old key. The store and the DB therefore already disagree. The next `get_triage_state` hydrate (`CopyResultPage.handleClose`, fetch) resurrects the key.
- `fetch_tickets` calls `delete_triage_entries(done_keys)` for every issue whose status category is `done`. That row, including `copied_key`, is hard-deleted.
- Tab predicates are state-only: `isLinkedCandidate` = `state === 'copied'`, `isNotMineCandidate` = `ignored` or `handled`, `isNewCandidate` = not `ignored`, `copied` or `handled`. They never look at `copiedKey`. `groupBadgeKey` derives from the same predicates.
- `TriageIndicator` shows `copiedKey` only when `state === 'copied'`.
- `copy_ticket_v2` ends with `set_triage_copied`, which overwrites `copied_key` unconditionally. `add_remote_link` uses `globalId = pmkar-source=<url>&key=<sourceKey>`.
- `poll_engine::do_poll` and `dispatch_notifications` never consult triage state. A denied ticket keeps producing change records, unseen-change dots and OS notifications.
- `TicketDetailPanel` and `TicketDetailPage` are duplicated components. Both hold the same five handlers.

## Critical Pitfalls

### Pitfall 1: Link memory is lost when the ticket goes Done (hard delete)

**What goes wrong:**
`fetch_tickets` deletes the whole triage row for any done ticket. A Linked or Denied ticket that is resolved loses its `copied_key`. If the ticket is reopened it comes back as `new` with no link. Copying it again creates a second Cloud issue. The v0.5.1 promise ("link remembered") then holds only until the ticket is resolved.

**Why it happens:**
The delete is a v0.1-era cleanup for finished tickets. Nothing ever depended on a durable `copied_key` for non-copied states.

**How to avoid:**
- Change the done cleanup so it only deletes rows with no link memory: `DELETE ... WHERE ticket_key IN (...) AND copied_key IS NULL`.
- Or keep the row and let the predicates' `!isDoneTicket` carry the hiding.
- Add a Rust test: set copied, deny, fetch with the issue done, assert `copied_key` survives.

**Warning signs:**
A reopened ticket shows as New. `get_all_triage` has fewer rows than expected after a fetch.

**Phase to address:**
Backend phase (first phase), before any UI work.

---

### Pitfall 2: Stale or ambiguous `copied_key` on non-copied rows

**What goes wrong:**
Once a key survives deny, "has a key" no longer implies "is Linked". Several things break:
- "Restore" from Not mine (`ignored` -> `seen`) leaves a key on a `seen` row. The ticket now appears in New with a hidden key.
- A fresh Copy then overwrites the old key via `set_triage_copied`. The earlier Cloud issue is orphaned with no trace.
- Any new code that tests `copiedKey` instead of `state` will misclassify tickets.

**Why it happens:**
The schema encodes two things in one column pair: current triage state and remembered link. The existing code treats `copiedKey` as an attribute of the `copied` state only.

**How to avoid:**
- Make the semantics explicit in one place. Recommended: `state` stays the single source of truth for tabs, and `copied_key` means "last known Cloud twin". "Link" is offered when `state in (ignored, handled) && copiedKey`.
- Decide up front what Restore from Not mine does to the key. Recommended: keep it. A later copy of a ticket with a remembered key must either reuse the key or warn, never silently overwrite.
- Add a TS helper such as `hasRememberedLink(entry)` and use it everywhere instead of inline `entry?.copiedKey` checks.
- Add a Rust `set_triage_denied` / `set_triage_relinked` with named intent, so the retention is deliberate and tested. Do not rely on the upsert quirk.

**Warning signs:**
A New-tab ticket whose DB row has a `copied_key`. `copied_key` values changing between two copies of the same source key.

**Phase to address:**
Backend phase (data model and command contract). Re-check in the detail UI phase.

---

### Pitfall 3: Optimistic update writes `copiedKey: null` and diverges from the DB

**What goes wrong:**
Copy-pasting the existing handler pattern (`{ state: 'ignored', copiedKey: null }`) makes the optimistic entry drop the key while the DB keeps it. The Link button, which is gated on `copiedKey`, vanishes until the next hydrate. After the next hydrate it appears. Users see a "flicker" bug and a Link button that exists only sometimes.

**Why it happens:**
All five existing handlers hardcode `copiedKey: null`. They were correct only while the key could not matter outside `copied`.

**How to avoid:**
- Build optimistic entries as `{ ...prev, state }`, preserving `copiedKey`. The optimistic entry equals what the DB will return.
- Fix the existing deny, restore and handled handlers in the same change, or the milestone leaves inconsistent behavior.
- Add a parity test: for each transition, assert optimistic entry === what `get_triage_state` returns after the command.

**Warning signs:**
Link button state differs before and after an F5 fetch or after closing CopyResult. Tests only assert `copiedKey: null`.

**Phase to address:**
Frontend actions phase (shared triage actions).

---

### Pitfall 4: Rollback races and fire-and-forget errors

**What goes wrong:**
The detail handlers use `.catch(() => {})` and never roll back, so a failed deny leaves the UI showing Not mine while the DB says Linked. `restoreTicket` has the safer pattern (rollback only if `current[issueKey] === optimistic`), but it compares by reference. Pitfalls:
- A re-link is a multi-step flow: validate the Cloud key, then write. If a second action (a poll hydrate, a group toggle, a rapid double click) replaces the entry in between, the reference check silently skips the rollback or rolls back over newer state.
- `hydrateTriageMap({...getState().triageMap, ...})` rewrites the whole map from a snapshot. Two overlapping actions on different tickets can clobber each other if one snapshot is taken before the other's write.
- A poll or fetch hydrate landing between the optimistic write and the invoke result replaces the optimistic entry, so the reference check fails and an error leaves the UI stale.

**Why it happens:**
A whole-map replace with no per-key patch API, plus reference equality as the race guard.

**How to avoid:**
- Add one shared `denyLinkedTicket` / `relinkTicket` in `triageActions.ts`, modeled on `restoreTicket`. Both detail components call it, and nothing inline survives.
- Add a per-key store setter (`setTriageEntry(key, entry)`) so actions do not copy the whole map.
- Compare rollback on a field value (`state` and `copiedKey`), not on object identity. Or use a per-key in-flight token.
- Disable the button while pending, so double clicks cannot interleave.
- On failure, re-fetch `get_triage_state` rather than hand-rolling the rollback.
- Test: fail the invoke after a hydrate lands, and assert the final state equals the DB.

**Warning signs:**
`.catch(() => {})` in a new handler. A test that only covers the happy path.

**Phase to address:**
Frontend actions phase.

---

### Pitfall 5: Re-link restores a dead or wrong Cloud issue

**What goes wrong:**
Link-from-detail restores `copied_key` without looking at the Cloud. The issue may have been deleted, moved to another project (key changed) or archived. The ticket shows green "Linked -> CLOUD-123" pointing at nothing. The "Open in Cloud" button gives a 404.

**Why it happens:**
The restore is a local DB flip, so it feels free. The Cloud copy was explicitly left "untouched" and may have changed independently.

**How to avoid:**
- Do a cheap check before restoring. A single `GET /rest/api/3/issue/{key}?fields=summary` through the Cloud client lets the user see "Linked to CLOUD-123 - <summary>".
- On 404, fall back to the normal copy preview and tell the user why. Do not delete the stale key until the new copy succeeds.
- On network or auth error, do not fall back to copy. Surface the error, because falling back risks a duplicate.
- Use a backend command, for example `relink_ticket(source_key) -> { restored | needs_copy }`. Do not decide this in the frontend from the cached `copiedKey`.
- Decide (and document) whether a project move is handled. A GET by the old key normally resolves, and the response carries the current key. Save that current key.

**Warning signs:**
Re-link works offline. There is no Cloud call in the re-link path or tests.

**Phase to address:**
Re-link backend + flow phase.

---

### Pitfall 6: Re-copy creates a duplicate Cloud issue

**What goes wrong:**
The "otherwise open the normal copy preview" fallback is also reachable by mistake:
- The key is lost (Pitfall 1).
- The user hits Copy on a `seen` ticket that has a remembered key (Pitfall 2).
- The check at re-link time was transient (Pitfall 5).
- Double clicks, or a copy preview opened before the deny landed.
`copy_ticket_v2` has no idempotency check. It always creates an issue and then overwrites `copied_key`.

**Why it happens:**
The copy pipeline assumes "a ticket in copy preview has never been copied".

**How to avoid:**
- Guard in `copy_ticket_v2` (backend, not the UI). If a remembered key exists and the Cloud issue still resolves, return a typed `AlreadyLinked { key }` result. Continue only with an explicit `force`/"copy anyway" argument.
- Fallback signal: also search the Cloud by the remote link `globalId` (`pmkar-source=...&key=<source>`). It is a recovery path for a lost `copied_key`. Treat it as optional, MEDIUM confidence, and do not make it the primary guard.
- Disable "Copy to Cloud" in the detail header when `hasRememberedLink`. The Link button becomes the primary action.
- Test: deny, then copy again, and assert the guard fires with no create call to the mock Cloud.

**Warning signs:**
Two Cloud issues for the same source key. The mock server's issue count rises after a deny and re-link.

**Phase to address:**
Re-link backend + flow phase (guard), Detail UI phase (button gating).

---

### Pitfall 7: "Copied" origin remote link semantics

**What goes wrong:**
- Deny does not touch the Cloud, but a developer "cleans up" the origin remote link on deny or re-link. This breaks the "Cloud copy untouched" requirement.
- On re-link the developer re-adds the remote link, creating a duplicate link on the Cloud issue.
- On re-copy after a lost key, the new Cloud issue also gets a remote link with the same `globalId`, so two Cloud issues point back at one source.

**Why it happens:**
Remote link creation lives inside the copy pipeline (`add_remote_link`), so devs reuse the pipeline for re-link.

**How to avoid:**
- Re-link never calls `copy_ticket_v2` or any pipeline step. It only writes triage state, plus the optional existence GET.
- Deny writes nothing to Cloud. Add a test that asserts zero Cloud calls on deny.
- Origin link on Cloud is permanent audit history. Note that in the requirements.
- Keep the stable `globalId` format. Jira's remote-link API treats a matching `globalId` as an update, so retrying is idempotent (MEDIUM confidence, verify on the first real run).

**Warning signs:**
Cloud issue shows two "Pmkar source" links. A re-link audit-log entry contains `remotelink`.

**Phase to address:**
Re-link backend + flow phase.

---

### Pitfall 8: Notifications and unseen-change dots for denied tickets

**What goes wrong:**
The poll engine ignores triage state. Today's Not mine tickets already trigger OS notifications and blue dots. After this milestone, a user who denies a Linked ticket expects silence, and gets pinged on every comment. Worse, a Linked ticket's updates are probably the ones the user cares about most, so the two cases pull in opposite directions.

**Why it happens:**
`process_tickets` and `dispatch_notifications` receive no triage context. Nothing so far has needed a "do not notify" state.

**How to avoid:**
- Make an explicit product decision before the phase: should Denied (including denied-with-link) tickets suppress OS notifications and dots?
- If yes, filter in `do_poll` (read `get_all_triage()` once, before the dispatch loop), and keep snapshots updating. Skipping snapshots would make the diff huge when the ticket is re-linked, so change detection must keep running and only dispatch is skipped.
- Never gate on `copied_key`. Gate on `state in (ignored, handled)`.
- Make sure the unseen-change dot is not shown for hidden rows. Dots on a hidden ticket inflate the tab or app counts.
- If nothing changes, record it as a known and intended behavior so UAT does not file it as a bug.

**Warning signs:**
A notification for a ticket visible only in Not mine. Unseen counts that differ from visible dots.

**Phase to address:**
Notifications decision in roadmap scoping. Implementation in the backend phase (small), unless the decision is "leave as is".

---

### Pitfall 9: Group view badges and tab counts go inconsistent

**What goes wrong:**
- `groupBadgeKey` is derived from the three predicates in order (Not mine, Linked, New, else Done). If a new "denied but has link" notion leaks into one predicate and not the others, a ticket can be counted in two tabs or none.
- The re-link and deny actions update `triageMap` but group-view derived lists and counts (`useGroupMembers`, tab count selectors, `CountPill`) may be memoized on the ticket list alone and stay stale.
- A group-view row for a Linked ticket shows the `copiedKey` chip only when `badge === 'nav.linked'`. After deny it must disappear. The reverse transition must restore it, but only after the store entry has been updated.
- Group view has its own restore button (`ignored.restore`). A new Link action must exist there too, or the group view diverges from detail (one entry point per action, per the feedback memory).

**Why it happens:**
Counts and badges derive from `triageMap`, `tickets` and `isDoneTicket` separately in multiple places (list pages, tab strip, group view).

**How to avoid:**
- Do not change the predicates. Re-triage only moves `state` between `copied` and `ignored`, so the existing exclusive predicates stay exclusive.
- Add a transition test matrix: for each of {copied -> ignored, ignored -> copied} assert the key is in exactly one of New / Not mine / Linked, the counts sum correctly, and the group badge changes.
- Extend `ticketListParity.test.tsx` with the re-triage transitions.
- Verify the Linked page "Cloud key" column, the TriageIndicator and the group view row all read the same entry.

**Warning signs:**
Count badge says 3 but the list shows 2. A ticket visible in two tabs. A badge that changes only after a reload.

**Phase to address:**
Detail UI phase (wire-up) and a final consistency/QA phase (parity tests).

---

### Pitfall 10: Zustand selectors and infinite re-render

**What goes wrong:**
New selectors for "denied with link" or "linked keys" written as `useTicketStore(s => s.list.filter(...) ?? [])` or `s => Object.entries(...)` return a new reference each time and trigger an infinite render loop (the known project pitfall). `?? []` in a selector is the classic cause.

**Why it happens:**
Derived values are convenient in selectors, and the project pitfall is easy to forget when copying nearby code.

**How to avoid:**
- Select the raw entry only: `useTicketStore(s => s.triageMap[issueKey])`. This is already stable, so derive booleans from it in render.
- For lists, use a `null` fallback or `useShallow`, or compute with `useMemo` on stable inputs.
- Add a render-count test on the new detail buttons and the count selectors.

**Warning signs:**
"Maximum update depth exceeded" in the console. A frozen window after clicking Deny.

**Phase to address:**
Detail UI phase, and verify in code review of every phase that touches selectors.

---

### Pitfall 11: Duplicated detail components drift

**What goes wrong:**
`TicketDetailPanel.tsx` and `TicketDetailPage.tsx` contain near-identical handler blocks. Adding Deny and Link to one and forgetting the other (or handling errors differently) gives different behavior depending on how the user opened the ticket. Group view may open a third entry point.

**Why it happens:**
The copies exist already, and a copy-paste edit is the cheapest change.

**How to avoid:**
- Put the new actions in `triageActions.ts` first (shared), and have both components call them. Remove the inline handlers they replace.
- One test per component asserting the same buttons with the same visibility rules.

**Warning signs:**
A diff touching one component only. Different toast keys between the two.

**Phase to address:**
Frontend actions phase, then Detail UI phase.

---

### Pitfall 12: Detail button gating and confusing explicit actions

**What goes wrong:**
- Deny appears on Linked tickets but the old Mark-as-handled and Ignore buttons also appear, giving three overlapping ways to leave Linked. The feedback memory says: explicit labelled buttons in detail, one entry point per action.
- Link appears on every Not mine ticket, even ones that never had a link. For those it should read as "Copy to Cloud" (the existing action).
- Denying from the Linked tab removes the ticket from the list while the detail pane stays open on it, showing a stale state or an empty pane.

**How to avoid:**
- Define the button matrix by `state` x `hasRememberedLink`: copied -> Open in Cloud + Deny. ignored/handled with link -> Link (primary) and Restore. ignored/handled without link -> Copy and Restore. Confirm this in requirements.
- Decide what happens to the selection after Deny (stay on the ticket with new state, or advance to the next row). Test both selection and focus. WCAG: move focus to a predictable element and announce the result in the existing live region.
- Should Deny confirm? The Cloud copy is untouched and the action is reversible, so use no confirmation, but show a toast with the target key and "Undo" if cheap.

**Phase to address:**
Detail UI phase.

---

## Moderate Pitfalls

### Pitfall 13: i18n EN/SK drift and the "tiket" guard

**What goes wrong:**
New strings (Deny, Link, toasts, aria announcements, confirmation, "kept link" hints) are added to EN only, or the SK text uses "uloha". The groups guard test enforces "tiket" for issues. Slovak plurals for new counts need the existing plural forms (`_one`, `_few`, `_other`). Reusing "Not mine"/"Linked" nouns with inconsistent translations produces mixed terminology.

**Prevention:**
- Add keys to both locales in the same commit. Reuse existing `nav.linked` / `nav.notMine` labels in sentences.
- Run the existing key-parity test and the SK guard. Extend the guard's scope (or add a second one) to cover the new keys.
- Words to avoid: "úloha". Use "tiket".
- Translate the failure toasts and the aria-live announcements too, not only the button labels.

**Phase to address:**
Every UI phase writes both locales; a final QA phase runs the guards.

### Pitfall 14: Backend command contract drift (`set_triage_state` accepts any state)

**What goes wrong:**
`set_triage_state` accepts `copied` from the frontend with no key. A path that sets `copied` without a key (a naive "re-link" implemented as `set_triage_state('copied')`) produces `state=copied, copied_key=NULL`: a green Linked row with no Cloud link and no way to open it.

**Prevention:**
- Remove `copied` from the allowed set in `set_triage_state`, or reject it. Re-link goes through a dedicated command that sets `copied` only with a non-null `copied_key` from the DB.
- Add a CHECK-like invariant test: `state='copied' => copied_key IS NOT NULL`.
- The frontend never supplies the key. The backend reads its remembered value.
- Rust test and frontend test for each command.

**Phase to address:**
Backend phase.

### Pitfall 15: Existing rows with old data

**What goes wrong:**
Rows already in users' DBs: `ignored` rows that were copied before v0.5.0 may or may not have a key (handlers did not clear the DB key, so some old denied-after-copy rows may carry one). The first run after upgrade shows Link on tickets the user ignored years ago. Others have none.

**Prevention:**
- Accept it: the key is genuinely the last Cloud twin. The pre-check from Pitfall 5 makes it safe.
- No migration needed. Do not add a destructive backfill. If a CHECK widening is needed, reuse the `migrate_triage_check_constraint` pattern. It rebuilds the table, so run it in a transaction and test against a populated DB.
- Add a Rust test with a legacy row (`ignored` + `copied_key`).

**Phase to address:**
Backend phase.

### Pitfall 16: Snapshot "seen baseline" after a long deny

**What goes wrong:**
While denied, changes pile up as unseen. On re-link the user gets a long cumulative diff, or the Changes tab auto-switches (it does so when `hasUnseenChanges`). It is not wrong, but it surprises.

**Prevention:**
Keep the behavior. Make sure the Changes tab auto-switch ref (`initialTabRef`) still works after the state flip and the detail re-render. Mark seen on re-link only if that is an explicit product decision.

**Phase to address:**
Detail UI phase (verify).

### Pitfall 17: Mock server cannot exercise the new paths

**What goes wrong:**
The mock Cloud has no issue-by-key GET for deleted issues and no way to simulate 404 or duplicates (see mock fixtures memory: issue response and field list are independent). The re-link existence check and the duplicate guard then ship untested end to end.

**Prevention:**
- Extend the mock Cloud in the backend phase: GET issue 404 for a sentinel key, a counter of created issues, and a fixture that is a linked ticket with a known Cloud key.
- Add the fixtures before the UI phase, so UAT can be done without a real PAT.

**Phase to address:**
Backend phase (mock extension first).

## Minor Pitfalls

### Pitfall 18: Windows WebView2 specifics (LOW confidence)

**What goes wrong:**
Focus and tooltip behavior differ in WebView2. The project already had a tooltip-on-handoff bug (WR-01) that needed a manual WebView2 check. A button that disappears (Deny on a ticket that leaves the list) while focused drops focus to `body` on WebView2, and keyboard users lose their place. Native `title` tooltips on the Link button can stick after the element unmounts.

**Prevention:**
Move focus deliberately after the action, avoid `title`-based tooltips on buttons that unmount on click (the group chip redesign already removed chip tooltips), and add the Deny/Link flow to the manual WebView2 UAT checklist.

**Phase to address:**
Final QA/UAT phase.

### Pitfall 19: Audit log gaps

**What goes wrong:**
Deny writes nothing to the audit log and re-link's existence GET might bypass the audited client (preview lookups bypass it by design). The audit viewer then cannot explain why a ticket changed state.

**Prevention:**
Decide: the Cloud GET goes through the audited client (it is a real Cloud call), while local-only transitions are not logged. Redaction rules still apply.

**Phase to address:**
Re-link backend phase.

### Pitfall 20: Removing a "Linked" ticket from a group's tab count

**What goes wrong:**
Group counts are not affected by triage moves unless they count by badge. If a group tab shows a per-badge breakdown, update it in the same parity test.

**Prevention:**
Check `CountPill` / `groupTabs.ts` inputs, and add a case to the group tests.

**Phase to address:**
Consistency/QA phase.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Rely on `set_triage` upsert not clearing `copied_key` | Zero backend change | Silent break if anyone later "cleans" the upsert; undocumented invariant | Never; add a named command and a test |
| Copy-paste the five inline handlers for Deny/Link | Fast | Panel/Page drift, `copiedKey: null` bug propagated | Never |
| Re-link as a pure local flip (no Cloud check) | No network, instant | Dead links, duplicates on fallback | Only if the badge clearly says "unverified" (not recommended) |
| Frontend-supplied `copiedKey` to the backend | Fewer backend changes | Stale key written back; wrong key on race | Never |
| Skip the duplicate guard in `copy_ticket_v2` | Smaller change | Duplicate Cloud issues, irreversible by the app | Never |
| Notification suppression by hiding in the UI only | No Rust change | OS notifications still fire | Only if the product decision is "leave notifications as-is" |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Jira Cloud GET issue | Treating any error as "dead link" and falling back to copy | Only 404 (and clear "issue does not exist") falls back; 401/403/5xx/network surface an error with no state change |
| Jira Cloud remote link | Re-adding the origin link on re-link | Never touch remote links outside `copy_ticket_v2`; keep stable `globalId` |
| Jira Cloud project move | Saving the old key forever | Use the key in the GET response as the current key and update `copied_key` |
| Server fetch (done tickets) | Hard-deleting the triage row | Preserve link memory (Pitfall 1) |
| Poll engine | Assuming triage state is absent from it | Read triage map once per poll if suppression is decided |
| Tauri commands | Passing state strings with a loose allow-list | Dedicated typed commands for deny and re-link |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Whole-map `hydrateTriageMap({...map})` per click | Re-renders every card and tab count | Per-key setter | Roughly a few thousand tickets in `triageMap` |
| Cloud GET per row to "verify links" for the list | Slow list, API rate limits | Verify only on the explicit Link click | More than a few dozen denied-with-link rows |
| Count selectors scanning tickets x triage x groups on every store change | Jank on bulk actions | Memoize on stable inputs; select primitives | Large fetch results (pagination cap) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Building the Cloud URL from a frontend-supplied base | Credential-bearing request to an arbitrary host (CR-01 class of bug, fixed in v0.4.8) | The re-link GET takes its base URL from the keychain/connection meta, never from the frontend |
| Logging the Cloud response with verbose bodies | PII in the audit log | Keep existing redaction; GET only needs key and summary (`fields=summary`) |
| Opening `/browse/<copiedKey>` with an unvalidated key | URL injection into `open_external_url` | Validate key format `^[A-Z][A-Z0-9_]+-\d+$` on write (backend) and before opening |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Deny with no feedback because the row vanishes | User unsure it worked, cannot find the ticket | Toast naming the target tab and the kept link; announce via the live region |
| Link button on denied tickets that never had a link | Confusing "Link" that opens a copy flow | Label by outcome: "Link to CLOUD-123" vs "Copy to Cloud" |
| Silent fallback to the copy preview | User thinks the link was restored | Explain: "CLOUD-123 no longer exists, copy again?" |
| Hover-revealed row icons for Deny | Violates explicit-action preference | Labelled detail button only; no row icon |
| Linked tab count drops and the user cannot tell why | Distrust of counts | Toast + consistent counts (Pitfall 9) |

## "Looks Done But Isn't" Checklist

- [ ] **Deny:** DB row keeps `copied_key` after a fetch, restart and a done-status fetch. Verify with a Rust test and a restart UAT.
- [ ] **Deny:** optimistic entry equals the DB entry (key preserved); the Link button does not flicker after F5.
- [ ] **Re-link:** performs a Cloud existence check; 404 falls back to preview; network error does not.
- [ ] **Re-link:** mock Cloud issue count unchanged; no remote link call; audit log shows only the GET.
- [ ] **Copy guard:** copying a ticket with a live remembered key returns `AlreadyLinked`, not a new issue.
- [ ] **Invariant:** no row can reach `state='copied'` with a NULL `copied_key` (`set_triage_state('copied')` rejected).
- [ ] **Consistency:** every ticket is in exactly one of New / Not mine / Linked after each transition; tab counts, list, group badge and TriageIndicator agree.
- [ ] **Both entry points:** Panel and Page and the group view behave the same.
- [ ] **Selectors:** no `?? []` or fresh-array return in a Zustand selector; no render loop.
- [ ] **i18n:** EN and SK keys present, SK uses "tiket", plural forms right, guard test passes, toasts and aria text translated.
- [ ] **Notifications:** behavior for denied tickets is a recorded decision and matches the implementation.
- [ ] **Focus (WebView2):** focus lands somewhere sensible after Deny/Link removes the focused button; verified on Windows.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Link memory lost for done tickets | MEDIUM | Recover keys from the Cloud by searching remote link `globalId`, or from the audit log copy rows; manual re-link |
| Duplicate Cloud issue | MEDIUM | Delete or close the extra in Cloud; point `copied_key` at the intended one; the app has no tooling for this, so prevention is key |
| `copied` row with NULL key | LOW | One-off fix: set the row back to `seen`, or set the key manually; add a startup repair that downgrades such rows |
| Store/DB divergence | LOW | Re-hydrate from `get_triage_state` (already happens on fetch and CopyResult close) |
| Dead restored link | LOW | Re-run Link (existence check fails, fallback to copy); the stale key is overwritten by the new copy |

## Pitfall-to-Phase Mapping

Suggested phase shape for the milestone: (1) Backend + mock, (2) Shared frontend actions, (3) Detail/group UI + i18n, (4) Consistency, a11y and UAT.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Done-ticket row deletion | 1 Backend | Rust test: deny, then fetch with a done issue, key kept |
| 2 Ambiguous key on non-copied rows | 1 Backend | Named commands; documented semantics; tests for Restore and re-copy |
| 3 `copiedKey: null` optimistic divergence | 2 Actions | Parity test optimistic vs `get_triage_state` |
| 4 Rollback races | 2 Actions | Test with a hydrate between optimistic write and failure |
| 5 Dead Cloud issue on re-link | 1 Backend | Mock 404 and 5xx cases |
| 6 Duplicate re-copy | 1 Backend (guard), 3 UI (gating) | Mock created-issue counter |
| 7 Remote link semantics | 1 Backend | Zero Cloud writes on deny and re-link |
| 8 Notifications for denied tickets | Scoping decision, then 1 Backend | Poll test with a denied ticket |
| 9 Badges and counts | 3 UI, 4 QA | Extended `ticketListParity` transition matrix |
| 10 Zustand selector loop | 3 UI | Render-count tests; review checklist |
| 11 Panel/Page drift | 2 Actions, 3 UI | Same tests run against both components |
| 12 Button matrix and focus | 3 UI | Component tests per state; a11y UAT |
| 13 i18n | 3 UI, 4 QA | Key parity and SK guard tests |
| 14 Loose `set_triage_state` | 1 Backend | Invariant test |
| 15 Legacy rows | 1 Backend | Populated-DB migration test |
| 16 Seen baseline | 3 UI | Manual check |
| 17 Mock gaps | 1 Backend (first) | Mock fixtures merged before UI work |
| 18 WebView2 | 4 QA | Manual Windows checklist |
| 19 Audit gaps | 1 Backend | Audit rows reviewed |
| 20 Group tab counts | 4 QA | Group tests |

## Sources

- Code inspected: `/Users/mimo/Documents/Projects/pmkar/src-tauri/src/triage_db.rs` (set_triage, set_triage_copied, delete_triage_entries, CHECK migration), `/Users/mimo/Documents/Projects/pmkar/src-tauri/src/commands.rs` (fetch triage sync and done cleanup, set_triage_state allow-list, copy_ticket_v2 end), `/Users/mimo/Documents/Projects/pmkar/src-tauri/src/copy_pipeline.rs` (add_remote_link globalId), `/Users/mimo/Documents/Projects/pmkar/src-tauri/src/poll_engine.rs` and `notification_dispatcher.rs` (no triage gating), `/Users/mimo/Documents/Projects/pmkar/src/features/tickets/triageActions.ts`, `TicketDetailPanel.tsx`, `TicketDetailPage.tsx`, `TriageIndicator.tsx`, `ticketListUtils.ts`, `/Users/mimo/Documents/Projects/pmkar/src/features/groups/groupBadge.ts`, `GroupViewPage.tsx`.
- Project context: `/Users/mimo/Documents/Projects/pmkar/.planning/PROJECT.md` and the user's memory notes (Zustand selector rule, explicit-action preference, SK "tiket" guard, no drag and drop).
- Jira remote link `globalId` update semantics and project-move key resolution: training knowledge only, not re-verified in this pass (MEDIUM/LOW). Verify against the Atlassian Cloud REST v3 docs when the re-link phase is planned.
- WebView2 focus/tooltip notes: project history (WR-01) plus general knowledge, LOW confidence.

---
*Pitfalls research for: Pmkar v0.5.1 Re-triage*
*Researched: 2026-10-15*
