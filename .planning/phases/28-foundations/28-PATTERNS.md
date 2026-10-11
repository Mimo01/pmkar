# Phase 28: Foundations - Pattern Map

**Mapped:** 2026-10-11
**Files analyzed:** 22 (new + modified)
**Analogs found:** 20 / 22 (2 partial, noted below)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/groups_db.rs` (new) | model/db | CRUD (transactional) | `src-tauri/src/snapshot_db.rs` (+ `triage_db.rs` tests) | exact |
| `src-tauri/src/lib.rs` (mod) | config | n/a | itself (alphabetical `pub mod` list) | exact |
| `src-tauri/src/main.rs` (mod) | config | startup | `main.rs` snapshot/mapping db blocks | exact |
| `src-tauri/src/commands.rs` or `groups_commands.rs` (new cmds) | controller | request-response | `check_ticket_changes`, `get_app_language`, `get_server_pat` | exact |
| `src-tauri/Cargo.toml` (+ `unicode-normalization`) | config | n/a | existing deps block; `tempfile` dev-dep at line 54 | role-match |
| group-name vectors JSON (shared) | test fixture | transform | none (new) | no analog |
| `src/features/groups/groupStore.ts` (new) | store | CRUD + hydrate | `src/stores/schemaCacheStore.ts` | role-match |
| `src/features/groups/colors.ts`, `validation.ts`, `types.ts` (new) | utility | transform | `src/features/tickets/utils.ts` (pure fns) | role-match |
| `src/features/groups/__tests__/*` (new) | test | mock invoke | `src/features/tickets/__tests__/copyStore.test.ts`, `src/stores/schemaCacheStore.test.ts` | exact |
| `src/index.css` (mod: `--color-group-*`) | config | n/a | `index.css` `@theme` + `body.dark` blocks | exact |
| `src/App.tsx` (mod: hydrate) | component | request-response | `App.tsx` lines 50-77 | exact |
| `src/features/tickets/ticketListUtils.ts` (new) | utility | transform | inline code in `TicketListPage.tsx:378-422` | exact (extraction) |
| `src/features/tickets/__tests__/ticketListUtils.test.ts` (new) | test | transform | `isOverrideValueFilled.test.ts`, `computeGapFields.test.ts` | role-match |
| `TicketListPage.tsx`, `IgnoredTicketsPage.tsx`, `LinkedTicketsPage.tsx` (mod) | component | transform | themselves | exact |
| `src/features/tickets/copyStepLabel.ts` (new) | utility | transform | `stepLabel` in `CopyResultModal.tsx:26-66` | exact (extraction) |
| `CopyResultModal.tsx`, `CopyResultPage.tsx` (mod) | component | request-response | themselves | exact |
| `__tests__/copyStepLabel.test.ts`, `copyStepSync.test.ts` (new) | test | transform / file-I/O | `src/i18n/__tests__/translations.test.ts` (key parity) | partial |
| `src/i18n/locales/en.json`, `sk.json` (mod) | config | n/a | existing `copy.step.*` keys (en.json 143-158) | exact |
| Rust name-validation + `normalize_scope` (inside `groups_db.rs`) | utility | transform | none in repo (`ignore_duplicate_column` helper style only) | no analog |

## Pattern Assignments

### `src-tauri/src/groups_db.rs` (model, CRUD)

**Analog:** `src-tauri/src/snapshot_db.rs`

**Imports + schema const** (lines 1-17):
```rust
use crate::error::AppResult;
use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

const CREATE_SNAPSHOT_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS snapshot_store (
        ticket_key           TEXT PRIMARY KEY,
        ...
    );
";
```
Use the same `const CREATE_...: &str` style; the schema is in 28-RESEARCH.md Pattern 1 (groups, issue_snapshot, group_member).

**open / open_in_memory** (lines 46-77). Struct wraps `conn: Connection`; two constructors. DIFFERENCE: groups must also run `PRAGMA foreign_keys = ON;` in BOTH constructors (no existing module does; snapshot_db does not).
```rust
pub struct SnapshotDb { conn: Connection }

impl SnapshotDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        // Migrations ... .ok()
        Ok(Self { conn })
    }
    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        Ok(Self { conn })
    }
```

**Query pattern** (lines 81-114): `rusqlite::params![...]` always (never format into SQL), `.optional()?` for single rows, `prepare` + `query_map(...).collect::<Result<Vec<_>, _>>()?` for lists.
```rust
self.conn.execute(
    "INSERT INTO snapshot_store (...) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(ticket_key) DO UPDATE SET ...",
    rusqlite::params![ticket_key, response_json, hash, now],
)?;
let mut stmt = self.conn.prepare("SELECT ticket_key FROM snapshot_store WHERE has_unseen_changes = 1")?;
let keys = stmt.query_map([], |row| row.get::<_, String>(0))?.collect::<Result<Vec<_>, _>>()?;
```
Timestamps: `Utc::now().to_rfc3339()` (line 83).

**Serde DTOs** (lines 38-44): `#[derive(Debug, Clone, Serialize, Deserialize)] #[serde(rename_all = "camelCase")]`. Same as `ConnectionMeta` in `triage_db.rs:25-34`.

**Transactions (D-21):** no existing analog in snapshot_db; use `let tx = self.conn.unchecked_transaction()?` (the db is behind `&self`) or take `&mut self`; commit at end; bulk add/remove + snapshot GC in one tx.

**Typed errors:** `AppError` (`error.rs:3-20`) serialises to a plain string via `serializer.serialize_str(&self.to_string())`, so it cannot carry `{ code }`. Add a dedicated serialisable error (RESEARCH "Typed validation error"): `#[derive(Debug, Serialize)] struct GroupCommandError { code: ... }` with `#[serde(rename_all = "snake_case")]` enum `Empty|TooLong|Duplicate|Reserved|NoScope`. Add `From<AppError>`.

**Tests** (snapshot_db.rs:365-370; triage_db.rs:487-495):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    fn new_db() -> SnapshotDb { SnapshotDb::open_in_memory().expect("failed to create in-memory SnapshotDb") }
```
File-backed restart test uses `tempfile::tempdir()` (dev-dep already at `Cargo.toml:54`). Clippy pedantic: backticks around identifiers in doc comments, `i64::from(bool)`.

---

### `src-tauri/src/lib.rs` and `src-tauri/src/main.rs` (registration)

**lib.rs:** flat alphabetical list; insert `pub mod groups_db;` between `fixtures` and `jira_client`.
```rust
pub mod fixtures;
pub mod jira_client;
```

**main.rs imports** (lines 3-6): add `groups_db::GroupsDb` to the grouped `use pmkar_lib::{...}`.

**main.rs open+manage** (lines ~118-132, inside `setup`):
```rust
let snapshot_db_path = app_dir.join("snapshots.db");
let snapshot_db =
    SnapshotDb::open(&snapshot_db_path).expect("Failed to open snapshot database");
app.manage(Arc::new(Mutex::new(snapshot_db)));
```
Copy as `groups.db` / `GroupsDb` / "Failed to open groups database". New commands go into `tauri::generate_handler![ commands::..., ]` at main.rs:196.

---

### Tauri commands for groups (controller, request-response)

**Analog:** `commands.rs:2160-2172` (`check_ticket_changes`) and `commands.rs:20-32`.
```rust
#[tauri::command]
pub fn check_ticket_changes(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
    ticket_key: String,
    response_json: String,
) -> Result<Vec<FieldChange>, AppError> {
    let db = snapshot_db
        .lock()
        .map_err(|_| AppError::Internal("Snapshot DB lock poisoned".into()))?;
```
Commands are sync `pub fn` with `tauri::State<'_, Arc<Mutex<_>>>` params. Camel-case JS args map to snake_case Rust params automatically.

**Scope derivation + lock ordering (D-21)** - analog `get_server_pat`, `commands.rs:46-60`:
```rust
let db = triage_db.lock().map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
let metas = db.get_all_connection_meta()?;
let server_meta = metas.iter().find(|m| m.connection_type == "server");
```
Wrap this in a `{ ... }` scoped block that returns the `base_url`, so the triage guard drops BEFORE locking groups (same scoped-block style as `commands.rs:1850-1855`):
```rust
{
    let g = triage_db.lock().map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    g.set_triage_copied(&args.source_key, &target_key)?;
}
```
Then `normalize_scope(&base_url)` (uses `url::Url`, already a dep). No server meta => scope `None` => list returns empty, mutators return `no_scope`.

---

### `src/features/groups/groupStore.ts` (store, CRUD + hydrate)

**Analog:** `src/stores/schemaCacheStore.ts` (note: no `src/stores` usage for features; new store may live in `src/features/groups/` per RESEARCH).

**Imports + create** (lines 1-2, 49):
```ts
import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
...
export const useSchemaCacheStore = create<SchemaCacheState>((set, get) => ({
```
**Async action with silent failure** (lines 100-111, 83-98):
```ts
fetchPriorities: async () => {
  try {
    const meta = await invoke<{ ... }>('fetch_cloud_meta');
    set({ prewarmedPriorities: Array.isArray(...) ? ... : [] });
  } catch {
    set({ prewarmedPriorities: [] });
  }
},
```
Immutable updates via `set({ cache: { ...get().cache, [key]: ... } })`. Guard with `Array.isArray`.

**Reverse index (D-22):** store holds `groupIdsByIssue: Record<string, number[]>` rebuilt inside actions (not in selectors). Consumers: `useGroupStore((s) => s.groupIdsByIssue[key] ?? null)`. Never `?? []` in a selector.

**Test analog:** `src/stores/schemaCacheStore.test.ts:5` and `copyStore.test.ts:1-5`: `vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))`, `beforeEach` reset.

---

### `src/App.tsx` (hydrate effect)

**Analog:** `App.tsx:50-77`. Hydrate after `setServerConnection`, inside the existing `.then(([metas]) => {...})`, fail silently:
```tsx
if (m.connectionType === 'server') {
  useConnectionStore.getState().setServerConnection(meta);
}
...
useConnectionStore.getState().loadProjectConfig().catch(() => {});
```
Add `useGroupStore.getState().hydrate().catch(() => {})` beside `loadProjectConfig`. Also refetch when `serverConnection.baseUrl` changes (D-01); Rust returns only groups for the current scope.

---

### `src/index.css` (palette tokens)

**Analog:** `index.css` lines 1-12 (`@theme { --color-brand: #c02232; ... }`) for light values, and `body.dark { ... }` at line ~53 for dark overrides. NOT `.dark`.
```css
@theme {
  --color-brand: #c02232;
  ...
}
body.dark {
  --color-brand-bg: #161617;
  --color-brand-surface: #1e1e20;
```
Add `--color-group-blue` ... `--color-group-slate` in `@theme` (light) and the dark variants in `body.dark`. Values from 28-UI-SPEC.md; `colors.ts` is single source of hex and a Vitest parses `index.css` to assert equality.

---

### `src/features/tickets/ticketListUtils.ts` (utility, transform)

**Analog (to extract verbatim):** `TicketListPage.tsx:378-422`; identical logic in `IgnoredTicketsPage.tsx:31-80` and `LinkedTicketsPage.tsx:21-66`.

**Candidate predicates (the three differ only here):**
```ts
// New (TicketListPage.tsx:378)
const s = triageMap[t.key]?.state;
return s !== 'ignored' && s !== 'copied' && s !== 'handled' && !isDoneTicket(t);
// Not mine (IgnoredTicketsPage.tsx:35)
return (s === 'ignored' || s === 'handled') && !isDoneTicket(t);
// Linked (LinkedTicketsPage.tsx:22)
tickets.filter((t) => triageMap[t.key]?.state === 'copied' && !isDoneTicket(t))
```
**Filter + sort (copy exactly, keep `[...filtered]` copy, keep locale-less `localeCompare`):**
```ts
if (searchText.length > 0) {
  const lower = searchText.toLowerCase();
  filtered = filtered.filter((ticket) => ticket.key.toLowerCase().includes(lower));
}
if (assigneeFilter.length > 0) {
  const assigneeLower = assigneeFilter.toLowerCase();
  filtered = filtered.filter(
    (ticket) => (ticket.fields.assignee?.displayName ?? '').toLowerCase() === assigneeLower);
}
return [...filtered].sort((a, b) => {
  let diff: number;
  if (sortField === 'key') {
    const parse = (k: string) => { const m = k.match(/^(.*)-(\d+)$/);
      return m ? { proj: m[1], num: parseInt(m[2], 10) } : { proj: k, num: 0 }; };
    const ka = parse(a.key); const kb = parse(b.key);
    diff = ka.proj !== kb.proj ? ka.proj.localeCompare(kb.proj) : ka.num - kb.num;
  } else if (sortField === 'created') {
    const ta = a.fields.created ?? a.fields.updated; const tb = b.fields.created ?? b.fields.updated;
    diff = new Date(ta).getTime() - new Date(tb).getTime();
  } else if (sortField === 'priority') {
    diff = parseInt(a.fields.priority.id, 10) - parseInt(b.fields.priority.id, 10);
  } else if (sortField === 'status') { diff = a.fields.status.name.localeCompare(b.fields.status.name);
  } else if (sortField === 'assignee') {
    diff = (a.fields.assignee?.displayName ?? '').localeCompare(b.fields.assignee?.displayName ?? '');
  } else { diff = new Date(a.fields.updated).getTime() - new Date(b.fields.updated).getTime(); }
  return sortDirection === 'asc' ? diff : -diff;
});
```
Page `useMemo` keeps its deps; pages import `isDoneTicket` from `./utils` (`utils.ts:1-18`, the pure-function module style to follow). Sort field type is the union `'updated'|'key'|'created'|'priority'|'status'|'assignee'` (page state, `TicketListPage.tsx:73`).

**Tests first (D-23):** commit characterization tests before the extraction. Existing page tests must stay green unchanged: `TicketListPage.test.tsx`, `TicketListPage.*.test.tsx`, `IgnoredTicketsPage.test.tsx`, `__tests__/LinkedTicketsPage.test.tsx`.

---

### `src/features/tickets/copyStepLabel.ts` (utility, transform)

**Analog:** `stepLabel` in `CopyResultModal.tsx:26-66` (verbatim duplicate in `CopyResultPage.tsx:18-~60`). Current structure to replace:
```tsx
function stepLabel(step: CopyStepResult): string {
  if (step.step === 'create_issue') {
    return step.success ? t('copy.step.coreFields') : t('copy.step.coreFieldsFailed');
  }
  if (step.step.startsWith('upload_image')) {
    return step.success
      ? `${t('copy.step.imagesUploaded')}${step.detail ? ` (${step.detail})` : ''}`
      : t('copy.step.imagesFailed');
  }
  if (step.step === 'add_remote_link') {   // BUG: Rust emits 'add_remotelink' (copy_pipeline.rs:60)
  ...
  if (step.step.startsWith('attach:')) {
    const filename = step.step.slice('attach:'.length);
    return step.success
      ? t('copy.step.attached', { filename })
      : t('copy.step.attachFailed', { filename, detail: step.detail || 'attachment failed' });
  }
  if (step.step.startsWith('worklog:')) {   // BUG: swallows 'worklog:fetch'
  ...
  return step.step;   // BUG: unknown renders raw id; fetch_source/update_triage hit this
}
```
New signature `copyStepLabel(step: CopyStepResult, t: TFunction): string`. Order: exact ids (including `worklog:fetch`, `fetch_source`, `update_triage`, `add_remotelink`) -> prefixes (`upload_image`, `attach:`, `comment:`, `worklog:`, `subtask:`) -> unknown with `copy.step.unknown`/`unknownFailed` `{{id}}`. Fallback strings `'failed'`, `'attachment failed'`, `'created'`, `'creation failed'` become `copy.step.fallback.*` keys. Key table: 28-UI-SPEC.md.

**Call sites to change** (both screens): delete local `stepLabel`, drop the `CopyStepResult` import if unused, replace `{stepLabel(step)}` (Modal:113, Page:121) with `{copyStepLabel(step, t)}`.

**D-12 hardcoded English:**
- `CopyResultModal.tsx:125`: `<p className="text-xs text-brand-muted">Created: {result.targetKey}</p>` -> `t('copy.result.created', { key: result.targetKey })`.
- `CopyResultPage.tsx:104`: `Created:{' '}` followed by the key element (it is a styled span; keep the span, translate the label, e.g. `t('copy.result.createdLabel')` or use the interpolated key with `Trans`; inspect lines 100-110 when planning).

**i18n keys:** flat dotted keys in both `en.json` and `sk.json` (`"copy.step.coreFields": "Core fields copied"`). `src/i18n/__tests__/translations.test.ts` enforces identical key sets en/sk, no empties, and sk != en for >80% of keys; add every new key to both.

---

### Step-id sync test: `src/features/tickets/__tests__/copyStepSync.test.ts` (test, file-I/O)

**Analog (partial):** `src/i18n/__tests__/translations.test.ts` for loading `en.json`/`sk.json`. No existing test reads Rust source; use `fs.readFileSync` (Node, vitest jsdom env supports it). Step emit sites to scan: `copy_pipeline.rs` lines 60-550 and `commands.rs` 1671-1855. Two shapes:
```rust
step: "add_remotelink".to_string(),     // literal
step: format!("attach:{filename}"),     // formatted
step: format!("comment:{}", idx + 1),   // formatted w/ positional arg
```
Regex per RESEARCH Pattern 6 must handle both `{filename}` and `{}` placeholders and literal `worklog:fetch`. Assert a minimum distinct count so the test cannot pass vacuously. Use a recording stub `t` and check requested keys exist in both locale JSONs.

---

### Reserved names (D-18)

Tab label keys: `nav.new` ("New" / "Nové"), `nav.notMine` ("Dismissed" / "Zamietnuté"), `nav.linked` ("Already Linked" / "Už prelinkované") in `src/i18n/locales/{en,sk}.json` lines 4-6. Rust reads via `include_str!("../../src/i18n/locales/en.json")` + `serde_json` (both deps); TS imports the JSON. Never hand-copy.

---

## Shared Patterns

### Mutex-wrapped db state
**Source:** `main.rs` setup blocks; `commands.rs:20-32`
**Apply to:** groups_db registration and all group commands. `Arc<Mutex<Db>>`, lock error mapped to `AppError::Internal("... lock poisoned".into())`.

### Parameterised SQL only
**Source:** `snapshot_db.rs:84-92`. `rusqlite::params![]`; always `WHERE scope = ?`.

### Idempotent migrations
**Source:** `snapshot_db.rs:54-69`, `triage_db.rs:142-154`. `CREATE TABLE IF NOT EXISTS`; `ALTER ... ADD COLUMN` with error ignored (`.ok()`). Groups is a new db, so only CREATE needed now.

### Frontend failure style
**Source:** `schemaCacheStore.ts:92-97`, `App.tsx:75`. Hydration and background calls fail silently (`catch {}` / `.catch(() => {})`).

### Zustand selector stability
**Source:** project memory `feedback_zustand_selector_stable_ref`. `?? null`, never `?? []`.

### No drag and drop; explicit labelled buttons
**Source:** project memory. Reorder API as `move_group(id, direction)` / `reorder_groups(ordered_ids)`.

### Pre-commit gate
**Source:** `.githooks/pre-commit`: fmt, biome, tsc, clippy pedantic, vitest, cargo test.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Shared name-validation vectors JSON (e.g. `src/test-fixtures/group-name-vectors.json`) | test fixture | transform | No Rust+TS shared fixture exists; `src/test-fixtures` dir does not exist yet. Rust consumes via `include_str!` + `serde_json` |
| Rust name normalisation (NFC, diacritics strip, case-fold) and `normalize_scope` | utility | transform | No Unicode/URL normalisation helpers in repo; use `unicode-normalization` (new, not in Cargo.lock; gate behind human-verify) and `url::Url` |
| Rust transaction usage (`unchecked_transaction`) | model | CRUD | No existing module uses transactions |
| WCAG contrast test (`colors.test.ts`) | test | transform | No analog; formula in RESEARCH Code Examples |

## Metadata

**Analog search scope:** `src-tauri/src`, `src/stores`, `src/features/tickets`, `src/App.tsx`, `src/index.css`, `src/i18n/locales`
**Files scanned:** about 25 (worktree copies under `.claude/worktrees/` ignored)
**Pattern extraction date:** 2026-10-11
