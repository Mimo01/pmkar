# Technology Stack

**Project:** Pmkar v0.5.1 Re-triage
**Researched:** 2026-10-15
**Overall confidence:** HIGH (conclusions come from reading the repo code, not from external docs)

## Verdict

**No new libraries, no version bumps, and no SQLite schema or CHECK-constraint change.** The feature uses what is already in place. The only backend change is one small new Tauri command, plus frontend changes.

Why no schema change:
- `triage_state` already has `copied_key TEXT`. The CHECK is `state IN ('new','seen','ignored','copied','handled')`. Both "denied but linked" and "linked" are expressible as `(state, copied_key)` pairs.
- "Denied, link remembered" is `state='ignored'` with `copied_key` still set. "Linked" is `state='copied'` with `copied_key` set.
- `TriageDb::set_triage` (triage_db.rs:208) upserts with `ON CONFLICT DO UPDATE SET state=?2, last_updated=?3`. It never touches `copied_key`, so the key already survives a deny today. This is the load-bearing fact.
- Do not widen the CHECK. That would force the table-rebuild migration (`MIGRATE_TRIAGE_CHECK_HANDLED` pattern) for no benefit.
- Do not add a `denied_from_linked` column or a new state such as `'unlinked'`. It would duplicate `copied_key IS NOT NULL` and spread across `TriageState` in types.ts, `set_triage_state` validation, `TriageIndicator`, tab filters and group badges.

## Existing Stack (reuse as-is)

| Technology | Version (in repo) | Role in this feature |
|------------|-------------------|----------------------|
| Tauri | 2.10 | One new `#[tauri::command]` registered in main.rs `generate_handler!` (next to `commands::set_triage_state`, line ~232) |
| rusqlite (bundled) | 0.39 | The new command is a single `UPDATE` / `SELECT` on `triage_state` |
| Zustand `ticketStore` | existing | `triageMap` / `hydrateTriageMap` optimistic updates |
| sonner + i18next | existing | Failure toasts and EN/SK strings. The groups guard test requires SK "tiket", not "úloha" |
| Radix / shadcn Button | existing | Explicit labelled "Deny" and "Link" buttons in detail (project feedback: no hover icons, one entry point per action) |

## Required Backend Change (one command, no schema change)

Add `relink_ticket(ticket_key) -> Option<String>` (name is the roadmap's choice) to `TriageDb` plus a command wrapper in commands.rs:
- Single statement: `UPDATE triage_state SET state='copied', last_updated=?2 WHERE ticket_key=?1 AND copied_key IS NOT NULL`. Return the `copied_key`, or `None` when there is nothing to restore.
- The frontend then does either:
  - restore: set `{state:'copied', copiedKey}` in `triageMap`, or
  - fall back to the existing copy-preview route when `None`.
- Why a dedicated command and not `set_triage_state('copied')`:
  - The current validation accepts `"copied"`, so a frontend call would silently produce `state='copied'` with a NULL `copied_key`. That is a corrupt "Linked" row, and `LinkedTicketsPage` and `TriageIndicator` assume a key exists.
  - Making the "has a key" check part of the same SQL statement is atomic and cannot race the optimistic UI.
- Consider also tightening `set_triage_state` to reject `"copied"` (copy flow uses `set_triage_copied`, not this command). Check test fixtures first.
- Deny needs no backend change. Call the existing `set_triage_state(ticketKey, 'ignored')`.
- Optional: a `deny_ticket` wrapper is unnecessary.

## Integration Points and Gotchas (stack-adjacent, affect the roadmap)

1. **Optimistic updates drop the key.** `restoreTicket` (triageActions.ts) and the ignore/handled handlers in TicketDetailPage.tsx and TicketDetailPanel.tsx write `copiedKey: null` into `triageMap`. The DB keeps the key but the UI loses it. Deny must write `{state:'ignored', copiedKey: <previous>}`, otherwise the Link button cannot tell "had a link" from "never linked" until a reload. Preserve `prev.copiedKey` in these handlers; the existing helper `restoreTicket` should keep it too. Roll back on invoke failure, as `restoreTicket` already does.
2. **Stale remembered keys.** Because `set_triage` never clears `copied_key`, any ignored or seen ticket that was once copied keeps a key. That is the desired behavior for re-link. Product call: restoring a denied ticket to `seen` via the existing Restore also keeps the key, which is harmless since `set_triage_copied` overwrites on a new copy.
3. **Done tickets lose their link.** `fetch` calls `delete_triage_entries` for tickets whose statusCategory is `done`, which deletes the row and the remembered `copied_key`. A done-then-reopened ticket reappears as a fresh `new` with no link. This is acceptable, but note it as an edge case in requirements and tests.
4. **Dedupe.** Without re-link, "Link" on a denied-but-previously-copied ticket would run `copy_ticket_v2` again and create a duplicate Cloud issue. The relink-first decision in the detail Link handler is the dedupe guard. The remote-link origin tracking is not queried.
5. **No Cloud verification.** Do not add a Jira call to verify the Cloud issue still exists. The requirement says "Cloud copy untouched". If the copy was deleted, the link is stale, which is out of scope. Flag as a possible future item.
6. **Consistency surfaces.** The tab filters in ticketListUtils.ts, tab counts, group-view triage badges, `TriageIndicator`, and `LinkedTicketsPage` and `IgnoredTicketsPage` all derive from `(state, copiedKey)`. Keep them derived from `triageMap` only. Do not add a parallel list. Check whether `IgnoredTicketsPage` should show a "was linked → KEY" hint (copiedKey on an ignored row).
7. **Mock server and tests.** No mock-fixture change is needed because no new Jira calls are made. Add Rust unit tests in triage_db.rs (deny keeps key; relink returns key; relink with no key returns None and leaves state unchanged) and Vitest tests for the handlers. The existing in-memory `new_db()` helper covers them.

## What NOT to Add

| Do not add | Why |
|------------|-----|
| New npm or crate dependencies | The feature is state transitions on an existing table; nothing is missing |
| A schema migration or CHECK widening | `copied_key` already persists across state changes (see Verdict) |
| A new triage state such as `unlinked` or `denied` | Duplicates `ignored` + `copied_key`; wide blast radius across TS and Rust |
| A state-machine library (XState etc.) | Two transitions do not justify it |
| rusqlite transactions or a migration framework | Single-statement update is atomic; the repo uses idempotent `ALTER` and rebuild patterns |
| Drag and drop | Project rule: explicit buttons only |
| Jira API re-verification of the Cloud copy | Out of scope; adds audit-log noise and failure modes |

## Installation

```bash
# Nothing to install.
```

## Sources

- Repo (HIGH): src-tauri/src/triage_db.rs (schema, CHECK, `set_triage`, `set_triage_copied`, `delete_triage_entries`), src-tauri/src/commands.rs (`set_triage_state`, `get_triage_state`, fetch triage sync, copy_ticket_v2 Phase 8), src/features/tickets/triageActions.ts, TicketDetailPage.tsx, TicketDetailPanel.tsx, types.ts, and Cargo.toml (tauri 2.10, rusqlite 0.39).
- No external docs consulted; nothing here depends on library behavior beyond standard SQLite `UPDATE ... WHERE` and Tauri 2 command registration, both already used in the codebase.
