# Phase 34: Link Integrity Backend - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The backend guarantees a Linked ticket always has a Cloud key, a remembered link is never lost or duplicated, and re-link is a single atomic operation. Covers LINT-02, LINT-03, LINT-04. Backend + mock server + Rust tests only; no frontend changes (those are Phases 35-36).

</domain>

<decisions>
## Implementation Decisions

### Re-link command (`relink_ticket`)
- **D-01:** New Tauri command `relink_ticket(ticket_key)` does one atomic `UPDATE triage_state SET state='copied', last_updated=? WHERE ticket_key=? AND copied_key IS NOT NULL` and returns `Option<String>` (the remembered Cloud key).
- **D-02:** No remembered link returns `Ok(None)`, not an error. The frontend treats `None` as "open the copy preview" (RLNK-02).
- **D-03:** Idempotent: calling it on an already-Linked ticket returns the key again (no error), so double-clicks and races are harmless.
- **D-04:** Allowed from any state as long as `copied_key` is set (ignored, new, seen, handled, copied). Covers a ticket restored to New that still carries its key.
- **D-05:** `copied_key` is never changed by relink. It only flips `state`.

### Rejecting `copied` in the generic command
- **D-06:** `set_triage_state` with `state='copied'` returns an error (fail loudly, message points to the re-link / copy flow). Remove `copied` from the accepted states in the command validator.
- **D-07:** Enforce at both layers: `TriageDb::set_triage()` also refuses `'copied'`. `set_triage_copied()` (called from `copy_ticket_v2` Phase 8) stays the only writer that creates a Linked row, and `relink_ticket` the only other path into `copied`.

### Duplicate-copy guard (`copy_ticket_v2`)
- **D-08:** Guard condition is `copied_key IS NOT NULL` for the source ticket, regardless of current state (Linked, Not mine, New after restore). This is the case that prevents a duplicate Cloud issue after restore-to-New then Copy.
- **D-09:** Guard runs first in `copy_ticket_v2`, before credentials, mapping load or any Jira call, so refusal is cheap and leaves no partial steps or audit rows.
- **D-10:** The refusal is an `AppError` whose message carries the existing Cloud key, so the UI can say "already linked to KEY" and Phase 35 can route to relink.
- **D-11:** No override or force flag. A forced re-copy is a future capability, not this phase.

### Done-ticket cleanup
- **D-12:** A done ticket with a remembered link keeps its **whole row** (state untouched, key untouched). Done tickets without a key are still deleted.
- **D-13:** The rule lives in `TriageDb::delete_triage_entries` (SQL guard `AND copied_key IS NULL`), so both `fetch_tickets` cleanup and the `delete_done_triage` command are protected. No caller can erase a link.

### Older data (linked before this update)
- **D-14:** No migration and no schema change. Rows written since Phase 4 already carry `copied_key`, and deny never clears it, so previously linked tickets re-link with no extra work. Required behaviour: previously linked stories must be re-linkable.
- **D-15:** Known gaps, accepted: (a) a Linked row with a NULL key, if one exists, and (b) linked tickets that went done and were already cleaned up before this update (row and key are gone). Both make `relink_ticket` return `None`, so Link falls back to the copy preview. The audit log can't recover the source key, so no recovery is attempted. For case (a) the duplicate guard can't see a link, so a duplicate Cloud issue is possible there.
- **D-16:** A Rust test seeds an old-shape DB (pre-`handled` CHECK constraint, `copied_key` column added by ALTER), runs the normal migrations, then asserts relink, the guard and cleanup behave on pre-existing Linked rows and ignored-with-key rows.

### Tests and mock
- **D-17:** Mock server and Rust tests cover all of the above (success criterion 5): relink hit / miss / idempotent / any-state, `copied` rejection at command and DB layer, guard refusal with key in the message and no Jira call made, cleanup keeps linked done rows and deletes keyless done rows, and the old-shape test (D-16).

### Claude's Discretion
- Exact error wording and `AppError` variant for the `copied` rejection and the guard refusal.
- Return type of `delete_triage_entries` (still a deleted-row count) and how the guard test asserts "no Jira call".
- Mock fixture shape for a pre-linked ticket.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` §Phase 34 — goal and 5 success criteria
- `.planning/REQUIREMENTS.md` — LINT-02, LINT-03, LINT-04, and the Out of Scope table (no schema change, no key clearing, no Cloud delete)
- `.planning/research/SUMMARY.md` — v0.5.1 research: `relink_ticket` SQL sketch, done-cleanup and no-idempotency pitfalls

### Backend code
- `src-tauri/src/commands.rs` (`set_triage_state` ~L1041, `delete_done_triage` ~L1058, `fetch_tickets` done cleanup ~L800-820, `copy_ticket_v2` ~L1611, Phase 8 triage update ~L1852)
- `src-tauri/src/triage_db.rs` (`set_triage` ~L208, `set_triage_copied` ~L197, `delete_triage_entries` ~L449, schema/migrations ~L36-130, existing tests ~L500+)
- `src-tauri/src/main.rs` (~L231 command registration; register `relink_ticket` here)
- `src-tauri/src/fixtures.rs`, `src-tauri/src/mock_server.rs`, `src-tauri/tests/` — mock server and integration tests (`copy_ticket_v2_integration.rs`, `mock_server_scenarios.rs`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TriageDb::set_triage_copied`: the only existing writer of a Linked row; the pattern for the relink UPDATE.
- `ignore_duplicate_column` and the existing CHECK-rebuild migration: reuse when building the old-shape test DB.
- `copy_ticket_v2_integration.rs` and the mock server: base for the guard test (assert no create-issue request reaches the mock).

### Established Patterns
- `set_triage` never touches `copied_key`, so deny/restore already preserve it in the DB.
- Commands lock `Arc<Mutex<TriageDb>>` and map poison to `AppError::Internal`.
- `fetch_tickets` and `delete_done_triage` both go through `delete_triage_entries`.

### Integration Points
- New `relink_ticket` command: register in `main.rs` and expose to the frontend (the frontend consumer is Phase 35).
- `TriageEntryResponse { state, copied_key }` hydration already returns `copied_key` for every row.

</code_context>

<specifics>
## Specific Ideas

User requirement: the feature must work for tickets linked before this update; previously linked stories must be re-linkable.

</specifics>

<deferred>
## Deferred Ideas

- Cloud existence check on re-link (404 falls back to copy preview) — already in Future Requirements.
- Force re-copy override for a ticket with a remembered link — future capability.
- Startup audit/report of keyless Linked rows — rejected as extra scope.

</deferred>

---

*Phase: 34-link-integrity-backend*
*Context gathered: 2026-10-15*
