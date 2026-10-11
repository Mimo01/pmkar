# Phase 28: Foundations - Research

**Researched:** 2026-10-11
**Domain:** Tauri 2 (Rust + rusqlite) local persistence, Zustand store hydration, i18next copy-step labels, shared list utilities
**Confidence:** HIGH (codebase-verified); MEDIUM on one new crate (see A1)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Groups are scoped to the source Jira instance. If the user reconfigures the source connection to a different base URL, groups for the old instance are hidden but kept on disk. Switching back restores them. Groups are never wiped on a connection change.
- **D-02:** The scope key is the normalised source base URL: lower-cased, trailing slash stripped, Claude may apply other trivial normalisation. A username or PAT change on the same URL keeps the groups.
- **D-03:** The whole group is scoped: definition (name, color, order) and membership. Scope column lives on the group row (and on `issue_snapshot`), not only on memberships.
- **D-04:** Triage (`triage_state`) has the same latent no-scope flaw. Record in research doc, do not fix this milestone.
- **D-05:** Eight hues, no red, palette order: blue, teal, green, amber, orange, purple, pink, slate.
- **D-06:** Store the token name in the DB, not hex. Each token has light and dark variants. A test verifies WCAG AA contrast against card/background surfaces in both themes.
- **D-07:** Colored dot next to neutral text on chips and tabs. No tinted backgrounds. Dot needs >= 3:1 non-text contrast.
- **D-08:** Default color for new group is least-used color within current scope; ties go to palette order.
- **D-09:** One shared helper `copyStepLabel` replaces duplicated `stepLabel` in `CopyResultModal.tsx` and `CopyResultPage.tsx`. Must match ids Rust emits: `fetch_source`, `create_issue`, `convert_description`, `upload_image*`, `add_remotelink`, `attach:{filename}`, `comment:{n}`, `worklog:fetch` (special case), `worklog:{n}`, `subtask:{key}`, `update_triage`. Keep tone "X copied" / "X — {detail}".
- **D-10:** Unknown step id at runtime shows a translated generic label including the raw id ("Step: foo_bar — completed/failed"). Never blank.
- **D-11:** Test that fails if Rust emits a step id with no translation key. Id list derived from or kept in sync with Rust source. Claude decides mechanism.
- **D-12:** Sweep both copy result screens for other hardcoded English (e.g. `Created: {targetKey}` at `CopyResultModal.tsx:125`) and translate. Stay inside those two screens.
- **D-13:** Rust/Jira `detail` error text stays as-is. Hardcoded English fallbacks (`'failed'`, `'attachment failed'`) become translated keys.
- **D-14:** Max name length 40 chars, counted after trim and NFC normalisation.
- **D-15:** No hard cap on number of groups.
- **D-16:** Rust is authoritative: create/rename validate in Rust and return typed error codes (`empty`, `too_long`, `duplicate`, `reserved`). UI mirrors rules in TS. Ship shared test vectors so Rust and TS agree.
- **D-17:** Duplicate check: trim, NFC, case-fold, strip diacritics ("Úlohy" == "ulohy" == "ULOHY"). Unique per source scope. SQLite `LOWER()` is ASCII-only, compare in Rust.
- **D-18:** Reserved names are the core tab labels in both EN and SK regardless of UI language, same normalisation as D-17. Read labels from actual locale strings; do not hand-copy.
- **D-19:** Separate `groups.db`; `INTEGER PRIMARY KEY AUTOINCREMENT` group id; idempotent `CREATE TABLE IF NOT EXISTS`; `PRAGMA foreign_keys = ON` per connection.
- **D-20:** Dedicated `issue_snapshot` table with `ticket_json`, GC'd when no group references the issue. Not `snapshot.db`.
- **D-21:** Bulk membership commands atomic (one transaction). Never hold the triage lock while acquiring the groups lock.
- **D-22:** Zustand: never `?? []` in a selector; use reverse index with `null` fallback.
- **D-23:** `ticketListUtils` extraction keeps New / Not mine / Linked filter+sort exactly as before; add regression tests before refactoring.

### Claude's Discretion
- How the step-id <-> translation-key sync test is wired (D-11).
- Exact light/dark hex per palette token, as long as AA is met.
- How diacritic stripping is done in Rust. Prefer an existing/transitive crate such as `unicode-normalization` if already in `Cargo.lock`; if not, tiny justified addition, flag in research.
- Exact URL normalisation beyond lower-casing and stripping trailing slash.
- Behaviour when no source connection is configured (groups empty or hidden).

### Deferred Ideas (OUT OF SCOPE)
- Translating common Jira/HTTP error categories (401/403/404/timeout) in copy step details.
- Fixing the source-scope gap in `triage_state`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-06 | Groups, names, colors, order, memberships persist across restarts in local storage | `groups.db` module following `triage_db.rs`/`snapshot_db.rs` pattern, registered in `main.rs` setup, Tauri commands, `useGroupStore` hydrated in `App.tsx`; Rust reopen-from-file test proves durability |
| CONI-01 | All copy-step labels translated EN+SK via one shared helper, test that every emitted step has a key | `copyStepLabel.ts` + new keys, bug fixes (`add_remotelink`, `worklog:fetch`, `fetch_source`, `update_triage`), source-scanning Vitest sync test |
</phase_requirements>

## Summary

Phase 28 is almost entirely additive plumbing on patterns that already exist in the repo. Every db module (`triage_db.rs`, `snapshot_db.rs`, `field_mapping_db.rs`) follows the same shape: a struct wrapping a `rusqlite::Connection`, `open(path)` / `open_in_memory()`, idempotent `CREATE TABLE IF NOT EXISTS`, registered in `main.rs` as `Arc<Mutex<_>>` Tauri state. `groups.db` should be a fourth copy of this pattern, with one deliberate difference: `PRAGMA foreign_keys = ON` (no existing module sets it, so it must be explicit) [VERIFIED: grep of src-tauri/src shows only `journal_mode=WAL` in field_mapping_db.rs].

The CONI-01 root cause is concrete and confirmed in code. `stepLabel` is duplicated verbatim in both result screens and has four defects: (1) matches `add_remote_link` while Rust emits `add_remotelink` [VERIFIED: copy_pipeline.rs:60]; (2) `worklog:fetch` falls into the `worklog:` branch and renders "Work log entry fetch copied"; (3) `fetch_source` and `update_triage` have no branch and render the raw id; (4) hardcoded English fallbacks. Also notable: **Rust does not currently emit `convert_description` or `upload_image*` anywhere** [VERIFIED: grep of src-tauri/src returns no matches]. The existing keys for them are legacy; keep them (D-09 lists them, and the existing `CopyResultPage.test.tsx` uses `convert_description`) but the sync test must run Rust -> keys direction only, so those two do not break it.

The two research flags resolve cleanly: scope column = `scope TEXT NOT NULL` holding normalised source base URL (derived in Rust from the `connection_meta` row with `connection_type = 'server'`); `issue_snapshot` keyed `(scope, issue_key)` with `ticket_json`; `INTEGER PRIMARY KEY AUTOINCREMENT` id. Slovak plural set verified on the installed Node/ICU: `one, few, many, other`; however Phase 28 introduces no count strings, so this is a note for later phases.

**Primary recommendation:** Build `groups_db.rs` as a copy of the `snapshot_db.rs` pattern with `foreign_keys=ON`, a Rust-derived scope, and Rust-side validation; write `ticketListUtils` regression tests BEFORE extracting; implement `copyStepLabel` as a table-driven helper with a source-scanning Vitest that extracts step ids from `copy_pipeline.rs`/`commands.rs`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group persistence (groups, members, snapshots) | Database / Storage (`groups.db`) | API / Backend (Tauri commands) | Durable, restart-safe; single writer |
| Name validation + duplicate/reserved detection | API / Backend (Rust, authoritative) | Browser / Client (TS mirror for instant UX) | D-16 |
| Scope derivation (source URL normalisation) | API / Backend (Rust) | — | Backend already owns `connection_meta`; avoids trusting client-supplied scope |
| Group state in UI | Browser / Client (`useGroupStore`) | — | Hydrated at startup from commands |
| Color palette tokens | Browser / Client (CSS vars in `index.css`) | Database (stores token name only) | D-06 |
| Copy-step labels | Browser / Client (`copyStepLabel` + i18n) | API (emits ids only) | Rust emits stable ids; presentation is client-side |
| Step-id sync test | Test tooling (Vitest reading Rust source) | — | D-11 |
| List filter/sort | Browser / Client (`ticketListUtils.ts` pure fns) | — | Pure functions, no I/O |

## Standard Stack

No new frontend packages. One optional Rust crate (see A1).

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | 0.39 (bundled) | groups.db | Same as other dbs [VERIFIED: src-tauri/Cargo.toml] |
| url | 2 (locked 2.5.8) | Base URL parsing/normalisation | Already a dependency [VERIFIED: Cargo.lock] |
| chrono | 0.4 | timestamps | Already used |
| tempfile | 3 (dev) | file-backed restart test | Already a dev-dependency |
| zustand | ^5.0.12 | `useGroupStore` | Existing stores |
| i18next | 25.10.9 installed | translations | [VERIFIED: node_modules/i18next/package.json] |
| vitest | existing (`vitest run`) | frontend tests | [VERIFIED: package.json] |

### New Rust dependency (only one)
| Library | Version | Purpose | Justification |
|---------|---------|---------|---------------|
| unicode-normalization | 0.1.25 | NFC + NFD for diacritic stripping (D-14, D-17) | NOT in Cargo.lock (grep found none). `icu_normalizer` is transitively present via `idna`, but depending on it directly means ICU4X API surface; `unicode-normalization` is the small, conventional choice |

CONTEXT says to flag this. `cargo search` confirms it exists at 0.1.25 [VERIFIED: cargo search]. Slopcheck was not run; per protocol it is tagged [ASSUMED] until the planner gates install behind a human-verify checkpoint (it is a very long-established crate maintained under the unicode-rs org, so risk is low).

Diacritic stripping recipe: `s.nfd().filter(|c| !is_combining_mark(c)).collect::<String>()` where `is_combining_mark` is `unicode_normalization::char::is_combining_mark`, then `.nfc()`, then `to_lowercase()`. Note `to_lowercase()` on the whole string is sufficient case-fold for this use; `ß`/`ł` special cases are not handled by NFD (e.g. `ł` has no decomposition) - acceptable, document and add vectors.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `unicode-normalization` | Hand-written Latin diacritic table | Fragile; violates Don't Hand-Roll |
| `unicode-normalization` | Direct `icu_normalizer` dep | No new download but heavier API |
| Rust-derived scope | Frontend passes scope | Client could send stale/incorrect scope; Rust already holds `connection_meta` |

**Installation:**
```bash
cd src-tauri && cargo add unicode-normalization@0.1
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| unicode-normalization | crates.io | many years | very high (transitive of most Rust text stacks) | github.com/unicode-rs/unicode-normalization | not run | [ASSUMED] - planner adds checkpoint:human-verify before install |

**Packages removed:** none. **Packages flagged suspicious:** none (slopcheck unavailable; all marked ASSUMED).

## Architecture Patterns

### System Architecture Diagram

```
App startup (main.rs setup)
   |-- GroupsDb::open(app_dir/groups.db)  -> PRAGMA foreign_keys=ON, CREATE IF NOT EXISTS
   |-- app.manage(Arc<Mutex<GroupsDb>>)
   v
React App.tsx hydrate effect (after connection metas loaded)
   |-- invoke('list_groups')  ---------------------------+
   v                                                     |
Tauri command (groups.rs / commands.rs)                  |
   1. lock triage_db -> read server base_url -> DROP lock|
   2. scope = normalize_scope(base_url)  (None => empty) |
   3. lock groups_db -> validate -> transaction -> write |
   v                                                     |
groups.db  (groups, group_member, issue_snapshot)  <-----+
   |
   v
useGroupStore { groups[], membersByGroup, groupIdsByIssue (reverse index) }
```

Copy result screens:
```
Rust CopyStepResult{step,success,detail} -> CopyResultModal/Page -> copyStepLabel(step, t) -> en/sk keys
Vitest: scan copy_pipeline.rs + commands.rs for step ids -> assert each resolves to non-unknown label in EN and SK
```

### Recommended Project Structure
```
src-tauri/src/
├── groups_db.rs        # GroupsDb, schema, validation, scope normalisation (+ unit tests)
├── commands.rs         # (or new groups_commands.rs) thin Tauri commands
├── lib.rs              # pub mod groups_db;
└── main.rs             # open + manage + register commands
src/features/groups/
├── groupStore.ts       # useGroupStore
├── colors.ts           # GROUP_COLORS tokens, default-color picker
├── validation.ts       # TS mirror of Rust rules
├── types.ts
└── __tests__/          # store, colors contrast, validation vectors
src/features/tickets/
├── ticketListUtils.ts  # filterTickets / sortTickets / candidate predicates
├── copyStepLabel.ts    # shared helper
└── __tests__/ticketListUtils.test.ts, copyStepLabel.test.ts, copyStepSync.test.ts
src/test-fixtures/group-name-vectors.json   # shared Rust+TS validation vectors (or src-tauri/tests/fixtures)
```

### Pattern 1: Schema (resolves research flag)
```sql
PRAGMA foreign_keys = ON;   -- per connection, run in open() AND open_in_memory()
CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  scope      TEXT NOT NULL,
  name       TEXT NOT NULL,            -- display form (trimmed, NFC)
  name_key   TEXT NOT NULL,            -- normalised (fold + strip diacritics) for uniqueness
  color      TEXT NOT NULL,            -- token name, e.g. 'blue'
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (scope, name_key)
);
CREATE INDEX IF NOT EXISTS idx_groups_scope_pos ON groups(scope, position);

CREATE TABLE IF NOT EXISTS issue_snapshot (
  scope      TEXT NOT NULL,
  issue_key  TEXT NOT NULL,
  ticket_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, issue_key)
);

CREATE TABLE IF NOT EXISTS group_member (
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL,
  issue_key  TEXT NOT NULL,
  added_at   TEXT NOT NULL,
  PRIMARY KEY (group_id, issue_key),
  FOREIGN KEY (scope, issue_key) REFERENCES issue_snapshot(scope, issue_key)
);
CREATE INDEX IF NOT EXISTS idx_member_issue ON group_member(scope, issue_key);
```
Notes: `AUTOINCREMENT` prevents id reuse after delete (a stale frontend reference can never silently hit a new group). `UNIQUE(scope, name_key)` is a backstop; Rust still checks first to return the typed `duplicate` code. GC: after remove/delete group, `DELETE FROM issue_snapshot WHERE scope=?1 AND NOT EXISTS (SELECT 1 FROM group_member m WHERE m.scope=issue_snapshot.scope AND m.issue_key=issue_snapshot.issue_key)` inside the same transaction. Whether a ticket may belong to several groups is a later-phase question; this PK permits it and costs nothing.

### Pattern 2: Scope derivation
Server connection row (`connection_type == "server"`) `base_url` from `TriageDb::get_all_connection_meta()` (see `commands.rs:47-56`). Normalise with `url::Url::parse`: lowercase scheme+host, drop default port (url crate does), drop query/fragment, strip trailing `/` from path, keep non-root path (Jira Server context path such as `/jira` is significant). If parse fails fall back to `trim().to_lowercase().trim_end_matches('/')`. No server connection => scope `None` => list returns empty, mutating commands return typed error `no_scope`. Unit-test vectors: `HTTPS://Jira.Example.com/` == `https://jira.example.com`; `https://j.com:443/jira/` == `https://j.com/jira`; `https://j.com/a` != `https://j.com/b`.

Frontend `useGroupStore` must refetch when `serverConnection.baseUrl` changes (D-01 hide-not-wipe is satisfied automatically because list is filtered by scope).

### Pattern 3: Lock ordering (D-21)
Read scope under the triage lock in a block, drop it, then take the groups lock. Never nest. Copy the style at `commands.rs:1850-1855` (scoped block).

### Pattern 4: Zustand (D-22)
```ts
// Source: project memory feedback_zustand_selector_stable_ref
const groupIdsByIssue = useGroupStore((s) => s.groupIdsByIssue[key] ?? null); // null fallback; no new [] per call
```
Store keeps `groupIdsByIssue: Record<string, number[]>` rebuilt on mutation (not in selector). Use `schemaCacheStore.ts` as hydration precedent. Hydrate in the existing `App.tsx` effect after `setServerConnection`, failing silently (`catch(() => {})`) like current code.

### Pattern 5: `copyStepLabel` (table-driven, order matters)
Match order: exact ids first (`fetch_source`, `create_issue`, `convert_description`, `add_remotelink`, `update_triage`, `worklog:fetch`), then prefixes (`upload_image`, `attach:`, `comment:`, `worklog:`, `subtask:`), then unknown. `worklog:fetch` MUST precede `worklog:`. Slice with `indexOf(':')` (filenames may contain colons; keys do not). Signature `copyStepLabel(step: CopyStepResult, t: TFunction): string`. Key map is exactly the UI-SPEC table (28-UI-SPEC.md). Use translated `copy.step.fallback.*` keys for D-13. New key for D-12: `copy.result.created` ("Created: {{key}}" / "Vytvorené: {{key}}"). Also sweep both files for further literal English (CopyResultPage has none visible besides stepLabel; verify with grep for JSX text during execution).

### Pattern 6: Step-id sync test (D-11, Claude's discretion → recommendation)
Vitest test that `fs.readFileSync`s `src-tauri/src/copy_pipeline.rs` and `src-tauri/src/commands.rs`, extracts ids with regexes, and asserts each yields a non-unknown label in EN and SK:
- literal: `/step:\s*"([a-z_:]+)"\.to_string\(\)/g`
- formatted: `/step:\s*format!\("([a-z_]+):\{/g` -> synthesize `kind:sample`
- Also assert extracted count >= 8 distinct kinds (guards against a vacuous pass if the regex rots) and that known set contains `add_remotelink`, `worklog:fetch`, `fetch_source`, `update_triage`.
- "Resolves to key" check: call `copyStepLabel` with a stub `t` that records the key requested; fail if the unknown key was used, and fail if any requested key is missing from en.json or sk.json. (Better than rendering, avoids i18next returning the key as fallback silently.)
Alternative (Rust-side const list) rejected: it adds production code solely for a test and can drift from emit sites just as grep can.

### Anti-Patterns to Avoid
- `?? []` inside a Zustand selector (infinite re-render; project memory).
- Holding triage and groups locks together (D-21).
- SQLite `LOWER()`/`COLLATE NOCASE` for duplicate detection (ASCII-only; D-17).
- Storing hex in DB (D-06).
- Drag and drop for ordering; any reorder API should be `move_group(id, direction)` or `reorder_groups(ordered_ids)` driven by Move left/right actions.
- Refactoring list code before regression tests exist (D-23).
- Rendering `t()` output in sync test where missing keys silently echo the key.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicode normalisation/diacritics | Char lookup tables | `unicode-normalization` | Full Unicode correctness |
| URL normalisation | Regex | `url::Url` (already a dep) | Port/host/scheme edge cases |
| WCAG contrast | Eyeballing | ~15-line relative-luminance function inside the test | Formula is standardized: L = 0.2126R+0.7152G+0.0722B with sRGB linearization; ratio (L1+0.05)/(L2+0.05) |
| Plural handling | Manual `n === 1` | i18next `count` + `_one/_few/_many/_other` | Not needed this phase |
| Migrations | A framework | idempotent `CREATE IF NOT EXISTS` (repo convention) | Schema is new, no prior versions |

## Runtime State Inventory

Not a rename/migration phase. Brief note: `groups.db` is new; no stored data to migrate. `triage_state` no-scope flaw (D-04) recorded below, not fixed.

**Latent flaw (D-04, record only):** `triage_state` and `snapshot_store` are keyed by `ticket_key` alone, so pointing the source at a second Jira instance with overlapping keys (e.g. `ABC-1`) would mix triage state. Out of scope this milestone. Groups avoid it via `scope`.

## Common Pitfalls

### Pitfall 1: Foreign keys silently off
**What goes wrong:** SQLite defaults `foreign_keys` OFF per connection; `ON DELETE CASCADE` does nothing, memberships orphan.
**How to avoid:** `conn.execute_batch("PRAGMA foreign_keys = ON;")` in both `open` and `open_in_memory`; unit test deleting a group removes members.

### Pitfall 2: `worklog:fetch` swallowed by `worklog:` prefix
Fix by ordering (Pattern 5). Test with `worklog:fetch` success and failure.

### Pitfall 3: Vacuous sync test
Regex stops matching after a refactor -> test passes with zero ids. Assert minimum distinct ids.

### Pitfall 4: Dead step ids
`convert_description` and `upload_image*` are not emitted by Rust today [VERIFIED]. Do not delete the keys or branches (existing tests use `convert_description`; spec lists them), but do not require them in the Rust->keys sync direction.

### Pitfall 5: Rust/TS validation drift
Ship one JSON vector file consumed by a Rust test (`include_str!` + serde_json, both already deps) and a Vitest test. Vectors cover: empty/whitespace, 40 vs 41 chars, NFC vs NFD input of same name (length counted after NFC; use chars/graphemes consistently - use `chars().count()` in Rust and `[...s].length` in TS, NOT `.length` which counts UTF-16 units), "Úlohy"/"ulohy"/"ULOHY", reserved EN and SK labels.

### Pitfall 6: Reserved names hand-copied
D-18 requires reading actual locale strings. Rust cannot import the JSON locales trivially from the frontend... but can: `include_str!("../../src/i18n/locales/en.json")` and `sk.json`, parse with serde_json, pull the tab label keys. Find the exact tab label keys (grep `tabs`/`tickets.tab` in en.json during planning; the 3 tabs are New / Not mine / Linked). Risk: Tauri bundling path - `include_str!` is compile-time so it is safe. TS side reads from the imported JSON the same way. Add a test asserting the reserved set is non-empty and contains both languages.

### Pitfall 7: Existing sort parity differences
The three pages use near-identical code; `created` branch in `TicketListPage` computes `ta/tb` then diff - semantically identical to the other two. `JiraTicket` type annotations differ trivially. Extract one `sortTickets(tickets, sortField, sortDirection)` and `filterTickets(tickets, searchText, assigneeFilter)`, and candidate predicates:
- New: state not in {ignored, copied, handled} and not done
- Not mine: state in {ignored, handled} and not done
- Linked: state == copied and not done
Note `Array.prototype.sort` is stable; ties keep input order, preserve by sorting a copy (`[...filtered]`). `localeCompare` without locale args must remain (do not add locale).

### Pitfall 8: i18n key parity test
`src/i18n/__tests__/translations.test.ts` requires identical key sets en vs sk and no empty values, and sk differing from en for >80% keys. Every new key must be added to both. Also the `{{id}}` unknown label must keep raw id (interpolation `escapeValue:false` already set).

### Pitfall 9: Clippy pedantic
Backticks in docs, `i64::from(bool)`, `#[must_use]` allowed globally. Pre-commit runs fmt, biome, tsc, clippy, vitest, cargo test [VERIFIED: .githooks/pre-commit].

## Code Examples

### Open (mirrors snapshot_db.rs)
```rust
pub fn open(path: &std::path::Path) -> AppResult<Self> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch(CREATE_SCHEMA)?;
    Ok(Self { conn })
}
```

### Restart-durability test (GRP-06, Success Criterion 1)
```rust
#[test]
fn groups_survive_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("groups.db");
    let id = { let db = GroupsDb::open(&path).unwrap();
               db.create_group("s", "Úlohy", "blue").unwrap() };   // dropped = "app closed"
    let db = GroupsDb::open(&path).unwrap();
    let g = db.list_groups("s").unwrap();
    assert_eq!(g[0].id, id); assert_eq!(g[0].name, "Úlohy"); assert_eq!(g[0].color, "blue");
}
```
Add equivalents for order and membership, and for scope hiding (`list_groups("other")` empty; original scope restored).

### Typed validation error
```rust
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GroupNameError { Empty, TooLong, Duplicate, Reserved }
```
Commands return `Result<_, GroupCommandError>` serialising `{ code: "duplicate" }` (AppError serialises to a plain string, so a dedicated serialisable error struct is needed for typed codes; do not overload `AppError::Internal`).

### Contrast test (Vitest)
```ts
const lin = (c:number)=>{const s=c/255;return s<=0.03928?s/12.92:((s+0.055)/1.055)**2.4};
const lum=(hex:string)=>{const n=parseInt(hex.slice(1),16);return .2126*lin(n>>16&255)+.7152*lin(n>>8&255)+.0722*lin(n&255)};
const ratio=(a:string,b:string)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return(x+.05)/(y+.05)};
// for each token, for each [surface] in light:[#ffffff,#f7f7f8], dark:[#1e1e20,#161617] => ratio >= 3
```
Define the palette in `colors.ts` as the single source of hex (light+dark) and have `index.css` CSS vars match; add a test that parses `index.css` and asserts each `--color-group-*` value equals the `colors.ts` hex (prevents drift). Dark overrides go under `body.dark` (NOT `.dark`) [VERIFIED: index.css:53]; light values in root `@theme` (line 3).

Likely failures to expect from UI-SPEC starting values at 3:1 on `#ffffff`/`#f7f7f8`: amber `#d97706` (~3.2 on white, borderline on `#f7f7f8`), orange `#ea580c`, teal `#0d9488`, pink and green `#16a34a` are close. Planner should expect the executor to darken some light values one Tailwind step (e.g. amber -> `#b45309`) based on the test. [ASSUMED: contrast ratios estimated, not computed - the test is the arbiter.]

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| i18next v21 `_plural` suffix | `_one/_few/_many/_other` via `Intl.PluralRules` (v21.3+) | Already used in repo |

**Slovak plural verification (research flag):** `new Intl.PluralRules('sk').resolvedOptions().pluralCategories` => `['one','few','many','other']` on Node 25.9 [VERIFIED: ran locally]; 1->one, 2-4->few, 0/5/11->other, 1.5->many. i18next 25.10.9 consumes this API [CITED: i18next plurals docs, training knowledge of v21+ behaviour - treat as ASSUMED for the exact internals]. Existing repo keys use `_one/_few/_other` (no `_many`), fine for integer counts. Phase 28 needs no count strings (steps use `{{n}}` ordinals), so no action; later phases adding "N tickets" for groups should add `_many` only if fractional counts are possible (they are not), keeping the en/sk parity test satisfied (en mirrors `_few`, see `audit.fields.group.count.total_few` pattern).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `unicode-normalization` 0.1.25 is legitimate and acceptable as a new dependency | Standard Stack | Low; planner gates install behind checkpoint |
| A2 | Some UI-SPEC starting hex values fail 3:1 on a surface | Code Examples | Low; contrast test decides |
| A3 | A ticket may belong to multiple groups (PK `(group_id, issue_key)`) | Schema | Medium; if single-group, add UNIQUE(scope, issue_key) later - confirm in Phase 29 discuss |
| A4 | i18next 25 internals use Intl.PluralRules for sk | State of the Art | Low; no plural keys this phase |
| A5 | Reserved tab label keys discoverable in en.json (key names not yet looked up) | Pitfall 6 | Low |

## Open Questions (RESOLVED)

1. **Command surface for Phase 28 (no UI).** RESOLVED: implement the full backend CRUD now (`list_groups`, `create_group`, `rename_group`, `set_group_color`, `move_group`, `delete_group`, `add_to_group` / `remove_from_group` bulk, `get_group_members`) plus store actions, verified by Rust tests and store tests with mocked `invoke`. Adopted in 28-05 (commands) and 28-06 (store); Phases 29-31 only add UI.
2. **No source connection configured.** RESOLVED: `list_groups` returns an empty list; all write commands return the `no_scope` error. Adopted in 28-05.
3. **Mock-server/fixtures.** RESOLVED: no fixture changes in this phase (groups never touch Jira).
4. **Multiple groups per ticket (A3).** RESOLVED: a ticket may belong to multiple groups; membership PK is `(group_id, issue_key)` with no UNIQUE(scope, issue_key). Adopted in 28-04 schema; revisit only if Phase 29 discuss decides otherwise.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| cargo | Rust build/tests | yes | 1.95.0 | — |
| node | Vitest | yes | 25.9.0 | — |
| crates.io access | add `unicode-normalization` | yes (cargo search worked) | — | `icu_normalizer` (already locked) |
| `timeout` command | n/a (macOS lacks it) | no | — | don't rely on it in scripts |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend | Vitest (jsdom, globals, `src/**/*.test.{ts,tsx}`, setup `src/test-setup.ts`), coverage thresholds lines 80 / functions 75 / branches 65 [VERIFIED: vitest.config.ts] |
| Rust | `cargo test` (unit tests in-module with `open_in_memory`; `tempfile` for file-backed) |
| Quick run | `npx vitest run src/features/groups src/features/tickets src/i18n` ; `cd src-tauri && cargo test groups_db` |
| Full suite | `npm run test` ; `cd src-tauri && cargo test` ; plus `npm run lint`, `npx tsc --noEmit`, `cargo clippy` (pre-commit hook runs all) |

### Phase Requirements -> Test Map
| Req / Criterion | Behavior | Test Type | Command | Exists? |
|-----|----------|-----------|---------|---------|
| GRP-06 / SC1 | Groups, names, colors, order, members survive close+reopen of file db | Rust unit (tempfile) | `cargo test groups_db::tests::survives_reopen` | Wave 0 |
| GRP-06 | Scope hiding/restoring, FK cascade, snapshot GC, atomic bulk membership (rollback on failure) | Rust unit | `cargo test groups_db` | Wave 0 |
| GRP-06 | Store hydrates from commands, reverse index returns stable `null` | Vitest (mock invoke) | `npx vitest run src/features/groups` | Wave 0 |
| D-14..D-18 | Validation vectors identical in Rust and TS | Rust + Vitest shared JSON | both | Wave 0 |
| D-02 | URL normalisation vectors | Rust unit | `cargo test normalize_scope` | Wave 0 |
| D-06/07 | Palette AA/3:1 contrast, CSS == colors.ts | Vitest | `npx vitest run src/features/groups/__tests__/colors.test.ts` | Wave 0 |
| CONI-01 / SC2 | Each id maps to specific EN and SK label (incl. `add_remotelink`, `fetch_source`, `update_triage`, `worklog:fetch`) | Vitest | `npx vitest run src/features/tickets/__tests__/copyStepLabel.test.ts` | Wave 0 |
| CONI-01 / SC3 | Rust-emitted ids all have keys (source scan) | Vitest | `npx vitest run src/features/tickets/__tests__/copyStepSync.test.ts` | Wave 0 |
| CONI-01 | Result screens render translated labels; `Created:` translated | Vitest RTL (extend `CopyResultModal.test.tsx`, `CopyResultPage.test.tsx`) | `npx vitest run src/features/tickets` | exists, extend |
| CONI-01 | en/sk key parity | Vitest | `npx vitest run src/i18n` | exists |
| SC4 / D-23 | New / Not mine / Linked filter+sort unchanged | Vitest regression on `ticketListUtils` (written FIRST against pre-refactor behaviour, ideally snapshot-asserted via existing page tests too) | `npx vitest run src/features/tickets` | Wave 0; page tests `TicketListPage*.test.tsx`, `IgnoredTicketsPage.test.tsx`, `LinkedTicketsPage.test.tsx` already exist and must stay green unchanged |

### Sampling Rate
- Per task commit: quick commands above for touched area
- Per wave merge: `npm run test` + `cargo test`
- Phase gate: full pre-commit suite green

### Wave 0 Gaps
- [ ] `src-tauri/src/groups_db.rs` tests module
- [ ] Shared name-validation vector JSON
- [ ] `src/features/groups/__tests__/*`, `ticketListUtils.test.ts`, `copyStepLabel.test.ts`, `copyStepSync.test.ts`
- Framework install: none needed

**Ordering constraint for SC4:** commit characterization tests for the three list behaviors (all six sort fields x asc/desc, search, assignee filter, done exclusion, stable ties) BEFORE the extraction commit.

## Security Domain

### Applicable ASVS Categories
| Category | Applies | Standard Control |
|----------|---------|------------------|
| V2/V3 Auth/Session | no | — |
| V4 Access Control | no (local single-user) | — |
| V5 Input Validation | yes | Rust-side validation of names, color token (whitelist of 8), issue keys; reject unknown color tokens |
| V6 Cryptography | no | — |
| V8 Data Protection | yes (minor) | `ticket_json` snapshot holds Jira content locally; never store credentials; do not log ticket_json |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| SQL injection via names/keys | Tampering | rusqlite `params![]` only, never `format!` into SQL |
| Invalid color token / oversize names bypassing UI | Tampering | Rust whitelist + length check (Rust authoritative) |
| Error leakage | Info disclosure | Reuse sanitised error conventions (`AppError` serialises message only) |
| Cross-instance data bleed | Info disclosure | scope column on every query (always `WHERE scope = ?`) |

## Sources

### Primary (HIGH - codebase verified this session)
- `src-tauri/src/snapshot_db.rs`, `triage_db.rs`, `main.rs` (setup/manage), `lib.rs`, `error.rs`, `commands.rs` (47-70, 1660-1860), `copy_pipeline.rs` (step ids)
- `src/features/tickets/CopyResultModal.tsx`, `CopyResultPage.tsx`, `TicketListPage.tsx`, `IgnoredTicketsPage.tsx`, `LinkedTicketsPage.tsx`, `utils.ts`
- `src/i18n/locales/{en,sk}.json`, `src/i18n/__tests__/translations.test.ts`, `src/index.css`, `src/App.tsx`, `vitest.config.ts`, `package.json`, `.githooks/pre-commit`, `Cargo.toml`, `Cargo.lock`
- Local runtime check of `Intl.PluralRules('sk')` (Node 25.9.0)
- `cargo search unicode-normalization` (0.1.25)

### Secondary / Tertiary
- Prior milestone research (`.planning/research/SUMMARY.md`, referenced by CONTEXT) - not re-read in full; decisions taken from CONTEXT D-19..D-23.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (existing deps), MEDIUM for the single new crate
- Architecture: HIGH (mirrors three existing db modules)
- Pitfalls: HIGH (found in code), contrast values MEDIUM (estimated)

**Research date:** 2026-10-11
**Valid until:** 2026-11-10
