# Phase 28: Foundations - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 28 delivers the following, with **no new user-facing group UI** (tabs, picker and management arrive in Phases 29–31):

- A durable, restart-safe home for custom groups: `groups.db`, Rust commands and `useGroupStore` hydrated at startup.
- The shared building blocks later phases rely on:
  - `ticketListUtils` filter/sort extraction, with exact behaviour parity;
  - the group color palette tokens, plus a contrast test;
  - name normalisation and validation rules.
- Full EN/SK translation of copy-step labels on the copy result screens (CONI-01).

Requirements: GRP-06, CONI-01.

</domain>

<decisions>
## Implementation Decisions

### Source scope (connection change)
- **D-01:** Groups are scoped to the source Jira instance.
  - If the user reconfigures the source connection to a different base URL, groups for the old instance are **hidden but kept on disk**.
  - Switching back to that URL restores them. Groups are never wiped on a connection change.
- **D-02:** The scope key is the **normalised source base URL**: lower-cased, trailing slash stripped, and Claude may apply other trivial normalisation.
  - A username or PAT change on the same URL keeps the groups.
- **D-03:** The **whole group** is scoped: definition (name, color, order) and membership. Each Jira instance has its own independent set of groups.
  - The scope column therefore lives on the group row (and on `issue_snapshot`), not only on memberships.
- **D-04:** Triage (`triage_state`) has the same latent no-scope flaw. Record it in the research doc, but do **not** fix it in this milestone (per the research summary).

### Color palette
- **D-05:** Eight hues with **no red**, in this palette order: blue, teal, green, amber, orange, purple, pink, slate.
  - Red is excluded because it collides with the brand/active color (`#c02232`) and with destructive/error red.
- **D-06:** Store the **token name** in the DB, not a hex value.
  - Each token has a light-theme and a dark-theme variant.
  - A test verifies WCAG AA contrast against the card/background surfaces in both themes.
- **D-07:** Rendering style is a **colored dot next to neutral text** on chips and tabs. Do not use tinted backgrounds.
  - Color is never the only signal, since the name is always visible.
  - The dot needs non-text contrast of at least 3:1 against the surface.
- **D-08:** The default color for a new group is the **least-used color** within the current scope; ties go to palette order.

### Copy-step labels (CONI-01)
- **D-09:** One shared helper, `copyStepLabel`, replaces the duplicated `stepLabel` functions in `CopyResultModal.tsx` and `CopyResultPage.tsx`.
  - It must correctly match the ids Rust actually emits: `fetch_source`, `create_issue`, `convert_description`, `upload_image*`, `add_remotelink`, `attach:{filename}`, `comment:{n}`, `worklog:fetch` (special case, **not** a worklog number), `worklog:{n}`, `subtask:{key}`, `update_triage`.
  - Keep the existing label tone: "X copied" / "X — {detail}".
- **D-10:** For an unknown step id at runtime, show a **translated generic label that includes the raw id**, e.g. "Step: foo_bar — completed/failed". The label is never blank.
- **D-11:** Add a test that fails if Rust emits a step id with no translation key.
  - The id list must be derived from or kept in sync with the Rust source.
  - Claude decides the mechanism, e.g. a Rust-side const list exported or snapshotted, or a test that greps the source.
- **D-12:** **Sweep both copy result screens** (`CopyResultModal` and `CopyResultPage`) for other hardcoded English, such as `Created: {targetKey}` at `CopyResultModal.tsx:125`, and translate it.
  - Stay inside those two screens.
- **D-13:** Rust/Jira `detail` error text stays **as-is** (diagnostic English).
  - Only the surrounding label is translated.
  - Hardcoded English fallbacks such as `'failed'` and `'attachment failed'` become translated keys.

### Group data limits and validation
- **D-14:** The maximum name length is **40 characters**, counted after trim and NFC normalisation.
- **D-15:** There is **no hard cap** on the number of groups.
- **D-16:** **Rust is authoritative**: create and rename validate in Rust and return typed error codes (`empty`, `too_long`, `duplicate`, `reserved`).
  - The UI mirrors the same rules in TS so it can show inline messages instantly (consumed in Phases 29–30).
  - Ship shared test vectors so the Rust and TS implementations agree.
- **D-17:** Duplicate check:
  - Trim, apply NFC, case-fold, **and strip diacritics**, so "Úlohy" == "ulohy" == "ULOHY".
  - Uniqueness is per source scope.
  - SQLite `LOWER()` is ASCII-only, so compare in Rust.
- **D-18:** Reserved names are the core tab labels **in both EN and SK**, regardless of the current UI language, compared with the same normalisation as D-17.
  - Read the labels from the actual locale strings; do not hand-copy them.

### Carried from research (locked, not re-discussed)
- **D-19:** Storage:
  - a separate `groups.db` (db-per-concern);
  - `INTEGER PRIMARY KEY AUTOINCREMENT` group id;
  - idempotent `CREATE TABLE IF NOT EXISTS`;
  - `PRAGMA foreign_keys = ON` per connection.
- **D-20:** A dedicated `issue_snapshot` table holding `ticket_json`, garbage-collected when no group references the issue. Do not use `snapshot.db`.
- **D-21:** Bulk membership commands are atomic, in one transaction. Never hold the triage lock while acquiring the groups lock.
- **D-22:** Zustand: never `?? []` inside a selector; use a reverse index with a `null` fallback (see memory feedback_zustand_selector_stable_ref).
- **D-23:** The `ticketListUtils` extraction must keep New / Not mine / Linked filtering and sorting **exactly** as before; add regression tests before refactoring.

### Claude's Discretion
- How the step-id ↔ translation-key sync test is wired (D-11).
- Exact light and dark hex values per palette token, as long as AA is met.
- How diacritic stripping is done in Rust. Prefer an existing or transitive crate such as `unicode-normalization` if one is already in `Cargo.lock`. If not, it is a tiny, justified addition; flag it in research.
- Exact URL normalisation beyond lower-casing and stripping the trailing slash, e.g. default ports and `/jira` context paths.
- Behaviour when no source connection is configured: there is no scope, so groups are empty or hidden.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research
- `.planning/research/SUMMARY.md` — synthesized decisions: groups.db, issue_snapshot, id type, scope column, CONI-01 root cause
- `.planning/research/ARCHITECTURE.md` — new/modified modules (groups_db.rs, groupStore.ts, colors.ts, ticketListUtils.ts, copyStepLabel.ts), lock ordering
- `.planning/research/PITFALLS.md` — identity scope, migrations/FK pragma, Zustand selector loops, name validation
- `.planning/research/STACK.md` — no new Rust crates; i18next plural key set to verify
- `.planning/research/FEATURES.md` — feature framing for later phases

### Requirements
- `.planning/REQUIREMENTS.md` — GRP-06, CONI-01 (this phase); GRP-01/GRP-03 validation and palette rules consumed by later phases
- `.planning/ROADMAP.md` §Phase 28 — success criteria and research flags

### Existing code to follow or modify
- `src-tauri/src/triage_db.rs` — db-per-concern pattern, idempotent CREATE/ALTER migrations
- `src-tauri/src/snapshot_db.rs`, `src-tauri/src/field_mapping_db.rs` — newer db module precedents
- `src-tauri/src/copy_pipeline.rs`, `src-tauri/src/commands.rs` (~1671–1855) — where copy step ids are emitted
- `src/features/tickets/CopyResultModal.tsx`, `src/features/tickets/CopyResultPage.tsx` — duplicated `stepLabel`, hardcoded strings
- `src/features/tickets/TicketListPage.tsx`, `IgnoredTicketsPage.tsx`, `LinkedTicketsPage.tsx`, `TicketFilterBar.tsx`, `utils.ts` — filter/sort logic to extract
- `src/i18n/locales/en.json` (+ SK file) — existing `copy.step.*` keys
- `src/index.css` — theme tokens (brand red `#c02232`, destructive `#dc2626`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing `copy.step.*` i18n keys (en.json ~143–158): extend these instead of replacing them.
- The triage/snapshot/mapping db modules provide the Rust `Connection` wrapper and command registration pattern.
- `schemaCacheStore.ts` is a precedent for a store hydrated from Tauri commands.

### Established Patterns
- Migrations use idempotent `CREATE TABLE IF NOT EXISTS`, plus `ALTER ... ADD COLUMN` with the error ignored. There is no migration framework.
- Clippy pedantic applies: put doc identifiers in backticks and use `i64::from(bool)`.
- i18next is `^25.10.9`. Verify the Slovak plural suffixes (`_one/_few/_many/_other`) before adding count strings.
- The Rust step id format is `kind` or `kind:arg`; `worklog:fetch` is the one non-numeric worklog arg.

### Integration Points
- Store hydration happens at App startup, with `useGroupStore` alongside the existing stores.
- The source connection base URL comes from `connection_meta` (triage.db) or the keychain. The groups scope is derived from it.
- Copy result screens consume `CopyStepResult { step, success, detail }` from `commands.rs:154`.

</code_context>

<specifics>
## Specific Ideas

- Palette order: blue, teal, green, amber, orange, purple, pink, slate.
- Dot + neutral text style, similar to Linear's label dots and not GitHub's tinted pills.
- An unknown step renders as "Step: {id} — …". It should stay debuggable and never be blank.

</specifics>

<deferred>
## Deferred Ideas

- Translating common Jira/HTTP error categories (401/403/404/timeout) in copy step details. That would be its own scope.
- Fixing the source-scope gap in `triage_state`. Noted as latent; it is out of this milestone.

</deferred>

---

*Phase: 28-Foundations*
*Context gathered: 2026-10-11*
