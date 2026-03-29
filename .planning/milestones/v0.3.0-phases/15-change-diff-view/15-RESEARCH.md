# Phase 15: Change Diff View - Research

**Researched:** 2026-03-29
**Domain:** Tauri/React — extending existing snapshot infrastructure with UI indicators and a diff panel
**Confidence:** HIGH

## Summary

Phase 15 is a UI-only phase. The Rust data layer (snapshot engine, field-change detection, `FieldChange` struct) is complete from Phase 12. The poll event plumbing is complete from Phase 13. This phase adds: (1) a per-ticket unseen-changes flag in SQLite, (2) two new Tauri commands to hydrate and clear that flag, (3) a blue dot indicator on `TicketCard`, and (4) a sixth "Changes" tab in `TicketDetailPanel` that renders a field-level diff table.

The work splits cleanly into two plans: **Plan 1** — Rust/SQLite extension (add `has_unseen_changes` column, two new Tauri commands, register them) and **Plan 2** — Frontend (Zustand slice, `TicketCard` dot, `ChangesTab` component, `TicketDetailPanel` tab integration, i18n keys).

There are no external dependencies or new packages to install. All shadcn components (Badge, Tooltip, Skeleton) are already installed.

**Primary recommendation:** Follow the `HistoryTab` pattern exactly for `ChangesTab`; follow the `triageMap` pattern in `ticketStore` for the unseen-changes Zustand slice.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Change indicator in ticket list**
- D-01: Colored dot next to the ticket key in TicketCard — subtle, Linear-style unread indicator
- D-02: Dot positioned immediately after the ticket key text (e.g., "CUST-123 ●")
- D-03: Tooltip on hover showing brief change summary (e.g., "3 changes: status, priority, comments") — uses existing Tooltip component

**Diff panel placement**
- D-04: New "Changes" tab added as 6th tab in TicketDetailPanel, alongside overview/comments/worklog/attachments/history
- D-05: Changes tab shows a badge count when unseen changes exist
- D-06: When opening a ticket that has pending changes, auto-switch to the Changes tab (instead of defaulting to Overview)

**Diff visual format**
- D-07: Table rows with arrow format — each changed field as a row: Field | Old Value | → | New Value
- D-08: Color coding: old value in muted text (gray), new value in normal/slightly accented text — works in both light and dark mode
- D-09: For long-text fields (description), show "Description changed" indicator only — no inline diff of full text content

**Change state lifecycle**
- D-10: Changed indicator clears when user views the Changes tab — like marking an email as read. Viewing other tabs does not clear it
- D-11: Changed state persists in SQLite (SnapshotDb) via a `has_unseen_changes` flag per ticket — survives app restarts
- D-12: When a field changes multiple times between user views, show the original old value (from when the ticket was last "seen") vs current new value — e.g., Open→In Progress→Done shows "Open → Done"

### Claude's Discretion
- Dot color choice (blue, amber, or brand accent) and size
- Exact table layout and spacing in the Changes tab
- How to store the "last seen snapshot" reference in SnapshotDb (separate column vs. separate table)
- i18n keys structure for change-related strings
- Empty state for Changes tab when no changes detected
- How to fetch FieldChange data from Rust to frontend (new Tauri command or reuse existing)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHNG-01 | User can see field-level diff on ticket detail page showing what changed since last fetch | `FieldChange` struct already serializes `field`, `old_value`, `new_value` in camelCase. New Tauri command `get_ticket_changes` reads pending changes. ChangesTab renders them as a 4-column table. |
| CHNG-02 | Changed tickets display a visual indicator (badge/dot) in the ticket list view | `has_unseen_changes` column in `snapshot_store`, hydrated on startup into Zustand `unseenChanges` map. `TicketCard` reads this map and renders a 6px blue dot with Tooltip. Poll-complete event updates the map for newly changed tickets. |
</phase_requirements>

---

## Standard Stack

### Core (all existing — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | existing | SQLite column migration for `has_unseen_changes` | Already used in `SnapshotDb`, `TriageDb` |
| @tauri-apps/api/core | existing | `invoke()` from frontend for new commands | Established pattern in every tab |
| zustand | existing | `unseenChanges` store slice | Already used for `triageMap`, `pollFrequency` |
| react-i18next | existing | i18n keys for new UI strings | Established via `useTranslation()` |
| shadcn Badge | existing | Change count badge on Changes tab | Already imported in `TicketListPage` |
| shadcn Tooltip/TooltipProvider | existing | Dot hover tooltip | Already imported in `TicketDetailPanel` |
| shadcn Skeleton | existing | Loading state in ChangesTab | Already used in HistoryTab pattern |

### No New Packages Required

All runtime dependencies are already installed. No `npm install` or `cargo add` steps needed.

---

## Architecture Patterns

### Recommended Project Structure — New Files

```
src-tauri/src/
└── snapshot_db.rs     # Add has_unseen_changes column + helpers (existing file, extend)

src/features/tickets/
├── tabs/
│   └── ChangesTab.tsx      # NEW — mirrors HistoryTab structure exactly
├── TicketCard.tsx          # MODIFY — add dot + tooltip after key span
├── TicketDetailPanel.tsx   # MODIFY — add 'changes' TabId, 6th tab, auto-switch, mark-read
└── ticketStore.ts          # MODIFY — add unseenChanges slice
```

### Pattern 1: SnapshotDb Column Extension (Rust)

The `snapshot_store` table needs two new columns:
- `has_unseen_changes INTEGER NOT NULL DEFAULT 0` — boolean flag
- `pending_changes_json TEXT` — stores the serialized `Vec<FieldChange>` so changes survive until the user views the tab

Migration pattern used in this codebase: add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements inside the `open()` method's `execute_batch()` call, guarded by `IF NOT EXISTS` to be idempotent on existing databases.

```sql
ALTER TABLE snapshot_store ADD COLUMN IF NOT EXISTS has_unseen_changes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE snapshot_store ADD COLUMN IF NOT EXISTS pending_changes_json TEXT;
```

**D-12 implication:** `pending_changes_json` must accumulate changes on each poll cycle (merge, not replace) so that intermediate state transitions are not lost. When the user marks as seen, clear both columns. The merge strategy: on new changes, re-run `detect_changes` between the "last seen" snapshot and the current one — this naturally produces the cumulative diff (Open→Done, not intermediate steps). The "last seen snapshot" can be a separate `seen_response_json` column (Claude's Discretion — simpler than a separate table for a single flag).

### Pattern 2: New Tauri Commands

Two commands to add in `commands.rs` and register in `main.rs`:

```rust
// Source: existing pattern from check_ticket_changes (commands.rs ~line 1920)
#[tauri::command]
pub fn get_unseen_change_keys(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
) -> Result<Vec<String>, AppError> { ... }

#[tauri::command]
pub fn mark_changes_seen(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
    ticket_key: String,
) -> Result<(), AppError> { ... }

#[tauri::command]
pub fn get_ticket_changes(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
    ticket_key: String,
) -> Result<Vec<FieldChange>, AppError> { ... }
```

Both must be added to the `tauri::generate_handler![...]` list in `main.rs`.

### Pattern 3: Zustand unseenChanges Slice

Extend `ticketStore.ts` — same approach as `triageMap`:

```typescript
// Source: existing ticketStore.ts pattern
interface TicketState {
  // ... existing fields ...
  unseenChanges: Record<string, boolean>; // keyed by ticket key
  hydrateUnseenChanges: (keys: string[]) => void;
  setUnseenChange: (key: string, value: boolean) => void;
}
```

Hydration on startup: in the mount `useEffect` in `TicketListPage`, add `invoke<string[]>('get_unseen_change_keys')` alongside the existing `get_triage_state` / `get_fetch_config` calls.

Update on poll-complete: the existing `listen('poll-complete')` handler in `TicketListPage` already receives `changedKeys`. Add: `store.setUnseenChange(key, true)` for each key in `changedKeys`.

### Pattern 4: ChangesTab Component

Exact structural mirror of `HistoryTab.tsx`:

```typescript
// Source: src/features/tickets/tabs/HistoryTab.tsx
export function ChangesTab({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const [changes, setChanges] = useState<FieldChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchChanges() {
      try {
        const result = await invoke<FieldChange[]>('get_ticket_changes', { ticketKey: issueKey });
        if (!cancelled) setChanges(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load changes');
      }
    }
    fetchChanges();
    return () => { cancelled = true; };
  }, [issueKey]);

  // Loading / error / empty states — mirror HistoryTab exactly
  // ...
}
```

Note: `ChangesTab` only needs `issueKey` (not `baseUrl`) since it reads from local SQLite, not from Jira API.

### Pattern 5: TicketDetailPanel Tab Integration

The `TabId` type must be widened:
```typescript
// Current (line 17):
type TabId = 'overview' | 'comments' | 'worklog' | 'attachments' | 'history';
// New:
type TabId = 'overview' | 'comments' | 'worklog' | 'attachments' | 'history' | 'changes';
```

The `tabs` array (built from `detail`) must include the Changes entry with an inline Badge when `unseenChanges[issueKey]` is true.

The auto-switch to Changes tab (D-06) must happen inside the `useEffect` that fires on `issueKey` change — replace the hardcoded `setActiveTab('overview')` with conditional logic:

```typescript
// Source: TicketDetailPanel.tsx useEffect line ~74
setActiveTab(hasUnseenChanges ? 'changes' : 'overview');
```

The mark-as-read trigger (D-10) must fire when `activeTab` becomes `'changes'`. A `useEffect` watching `[activeTab, issueKey]` is the clean approach — invoke `mark_changes_seen` and call `store.setUnseenChange(issueKey, false)` only when `activeTab === 'changes'` AND `unseenChanges[issueKey] === true`.

### Pattern 6: TicketCard Dot

The dot inserts after the key `<span>` inside the existing `flex items-center gap-2` div (line ~32):

```tsx
// Source: TicketCard.tsx line ~32-34
<div className="flex items-center gap-2">
  <span className="text-xs font-mono text-brand-muted">{ticket.key}</span>
  {hasUnseenChanges && (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
            aria-label={t('tickets.card.unseenChanges', { count: changeCount })}
          />
        </TooltipTrigger>
        <TooltipContent aria-hidden="true">
          {t('tickets.card.changeTooltip', { count: changeCount, fields: fieldList })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
  {actionSlot}
</div>
```

`TicketCard` currently does not receive `hasUnseenChanges` — it must either read from the store directly or receive it as a prop. Prefer reading from `useTicketStore` directly in TicketCard (same pattern as `triageEntry` which is already passed as a prop, but `unseenChanges` is simpler as a direct selector since it's a flat boolean lookup).

### Anti-Patterns to Avoid

- **Re-fetching from Jira API in ChangesTab:** ChangesTab reads from local SQLite only. Never call `fetch_ticket_detail` or `fetch_changelog` inside ChangesTab.
- **Replacing pending_changes on each poll:** D-12 requires showing original vs. current. The correct model is to diff the stored "last seen" snapshot against the latest snapshot each time changes are requested, not to accumulate a JSON array.
- **Clearing changes on non-Changes tab activation:** D-10 is explicit — only the Changes tab activation clears the indicator, not overview/comments/etc.
- **Wrapping the entire TicketCard in TooltipProvider:** TooltipProvider is already in TicketDetailPanel. For TicketCard, a local TooltipProvider scoped to the dot is cleaner since TicketCard doesn't currently use TooltipProvider.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Field diff computation | Custom JS diff algorithm | Existing `detect_changes()` + `check_for_changes()` in `snapshot_db.rs` | Already handles all watched fields, comment count, worklog count, attachment count |
| Badge component | Custom pill span | `<Badge variant="secondary">` (shadcn, already installed) | Consistent with existing `newCount` badge in TicketListPage |
| Tooltip | Custom title attribute or div | `<Tooltip>` / `<TooltipProvider>` (shadcn, already installed) | `delayDuration={300}` matches existing panel usage |
| SQLite schema migration | Drop-and-recreate table | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` | Preserves existing snapshot data; idempotent |
| Loading skeleton | Custom divs | `<Skeleton>` (shadcn) + `animate-pulse bg-brand-surface-hover rounded` | Matches HistoryTab exactly |

**Key insight:** The Rust diff engine is already battle-tested and covers edge cases (volatile field stripping, first-time no-change, hash optimization). The entire value of this phase is wiring it to the UI — not reimplementing it.

---

## Common Pitfalls

### Pitfall 1: `has_unseen_changes` vs. accumulated `FieldChange` list

**What goes wrong:** Storing only `has_unseen_changes = true` without also storing which fields changed means the ChangesTab cannot display the diff without re-fetching from Jira (defeats the purpose of local snapshots).

**Why it happens:** The CONTEXT.md mentions a `has_unseen_changes` flag but D-12 implies the original old values must be preserved.

**How to avoid:** Store the serialized `Vec<FieldChange>` (as JSON text) in a `pending_changes_json` column alongside the flag. `get_ticket_changes` reads from this column. When `mark_changes_seen` is called, clear both columns. When new changes arrive for a ticket that already has pending changes, call `detect_changes` between the stored "last seen" snapshot and the new snapshot (not the previous latest snapshot) to produce the full cumulative diff.

**Warning signs:** If `get_ticket_changes` always returns the latest poll diff instead of the cumulative diff since last seen, D-12 is violated.

### Pitfall 2: Race between `setActiveTab('changes')` and `mark_changes_seen` invocation

**What goes wrong:** If `mark_changes_seen` fires optimistically before the `ChangesTab` has mounted and rendered, the user may see a flash of empty state.

**Why it happens:** React renders asynchronously — `setActiveTab` triggers a re-render, but `ChangesTab`'s `useEffect` (which fetches data) runs after paint.

**How to avoid:** Invoke `mark_changes_seen` inside `ChangesTab`'s own `useEffect` (alongside `get_ticket_changes`), not in `TicketDetailPanel`'s tab-switch handler. This guarantees the data is fetched first, then the flag is cleared.

### Pitfall 3: `TicketCard` receiving `hasUnseenChanges` without tooltip field names

**What goes wrong:** The Tooltip copy is `"N changes: field1, field2"` (per D-03 and UI-SPEC). If `TicketCard` only receives a boolean, it cannot format the tooltip correctly without a separate store read.

**How to avoid:** Either pass `changeCount` and `fieldNames: string[]` as props from `TicketListPage` (which reads from the store), or have `TicketCard` perform a targeted Zustand selector for `unseenChanges[ticket.key]`. The field names for the tooltip require a separate `get_ticket_change_fields` command or reuse `get_ticket_changes` in a tooltip-only fetch. Simplest approach: store the field list in `unseenChanges` as `Record<string, string[]>` instead of `Record<string, boolean>`, populated from `poll-complete` event payload via a lightweight Tauri command.

**Warning signs:** Tooltip renders "undefined changes: " or requires an extra API call on hover.

### Pitfall 4: Forgetting to register new Tauri commands in `main.rs`

**What goes wrong:** Commands defined in `commands.rs` but missing from `tauri::generate_handler![...]` in `main.rs` silently fail at runtime with a "Command not found" error from the frontend.

**Why it happens:** Rust compilation succeeds; the error only surfaces at runtime.

**How to avoid:** Immediately after adding each `#[tauri::command]` fn in `commands.rs`, add it to the list in `main.rs` (lines 187-229). The existing list has 29 entries; new commands go at the end.

### Pitfall 5: SQLite migration silently failing on old schemas

**What goes wrong:** `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` works in SQLite 3.37+. Older SQLite versions bundled with rusqlite may not support `IF NOT EXISTS` on `ALTER TABLE`.

**Why it happens:** The `IF NOT EXISTS` clause for `ALTER TABLE ADD COLUMN` was added in SQLite 3.37.0 (2021-11-27). Most modern systems ship 3.38+, but it is worth verifying.

**How to avoid:** Use a try-execute pattern: attempt the `ALTER TABLE` and ignore the error code `SQLITE_ERROR` if the column already exists (error message contains "duplicate column name"). This is the pattern the existing codebase uses in analogous migrations. Alternatively, query `pragma table_info(snapshot_store)` and conditionally alter.

---

## Code Examples

### Adding columns to snapshot_store (Rust)

```rust
// Source: existing SnapshotDb::open() pattern in snapshot_db.rs
const CREATE_SNAPSHOT_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS snapshot_store (
        ticket_key           TEXT PRIMARY KEY,
        response_json        TEXT NOT NULL,
        content_hash         TEXT NOT NULL,
        last_checked_at      TEXT NOT NULL,
        seen_response_json   TEXT,        -- snapshot at last 'mark seen' time
        has_unseen_changes   INTEGER NOT NULL DEFAULT 0,
        pending_changes_json TEXT          -- serialized Vec<FieldChange>
    );
";
// Migration for existing installs (in open() after execute_batch):
conn.execute("ALTER TABLE snapshot_store ADD COLUMN seen_response_json TEXT", []).ok();
conn.execute("ALTER TABLE snapshot_store ADD COLUMN has_unseen_changes INTEGER NOT NULL DEFAULT 0", []).ok();
conn.execute("ALTER TABLE snapshot_store ADD COLUMN pending_changes_json TEXT", []).ok();
```

### HistoryTab-derived ChangesTab skeleton

```typescript
// Source: src/features/tickets/tabs/HistoryTab.tsx — direct structural copy
export function ChangesTab({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const [changes, setChanges] = useState<FieldChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAndClear() {
      try {
        const result = await invoke<FieldChange[]>('get_ticket_changes', { ticketKey: issueKey });
        if (!cancelled) {
          setChanges(result);
          // Mark seen AFTER data is fetched (D-10, Pitfall 2)
          await invoke('mark_changes_seen', { ticketKey: issueKey });
          useTicketStore.getState().setUnseenChange(issueKey, false);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load changes');
      }
    }
    fetchAndClear();
    return () => { cancelled = true; };
  }, [issueKey]);
  // ...
}
```

### FieldChange TypeScript type (new)

```typescript
// Mirrors Rust FieldChange struct (serde rename_all = "camelCase")
export interface FieldChange {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}
```

### Tab auto-switch logic in TicketDetailPanel

```typescript
// Source: TicketDetailPanel.tsx useEffect ~line 74 — modify setActiveTab call
const hasUnseenChanges = useTicketStore((s) => !!s.unseenChanges[issueKey]);

useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setDetail(null);
  setActiveTab(hasUnseenChanges ? 'changes' : 'overview'); // D-06
  // ...fetchDetail()
}, [issueKey, baseUrl]); // hasUnseenChanges intentionally NOT in deps — D-06 fires only on ticket open
```

### i18n keys to add (en.json)

```json
"detail.tab.changes":              "Changes",
"detail.tab.changes.ariaLabel":    "Changes, {{count}} unseen",
"detail.tab.changes.empty":        "No changes detected since last fetch",
"detail.changes.error":            "Could not load changes. Check your connection and try again.",
"detail.changes.descriptionChanged": "Description changed",
"detail.changes.noPreview":        "—",
"tickets.card.unseenChanges":      "{{count}} unseen changes",
"tickets.card.changeTooltip":      "{{count}} changes: {{fields}}"
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 15 is purely code/config changes. No external tools, services, CLIs, runtimes, or databases beyond the existing project stack are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (jsdom environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/features/tickets/tabs/ChangesTab.test.tsx --reporter=verbose` |
| Full suite command | `npx vitest run` |

Coverage thresholds enforced: lines 80%, functions 75%, branches 65%, statements 79%.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHNG-01 | ChangesTab renders field diff table with old/new values | unit | `npx vitest run src/features/tickets/tabs/ChangesTab.test.tsx -t "renders diff table"` | Wave 0 |
| CHNG-01 | ChangesTab shows loading skeleton while fetching | unit | `npx vitest run src/features/tickets/tabs/ChangesTab.test.tsx -t "shows loading"` | Wave 0 |
| CHNG-01 | ChangesTab shows empty state when no changes | unit | `npx vitest run src/features/tickets/tabs/ChangesTab.test.tsx -t "empty state"` | Wave 0 |
| CHNG-01 | ChangesTab calls mark_changes_seen after fetch | unit | `npx vitest run src/features/tickets/tabs/ChangesTab.test.tsx -t "calls mark_changes_seen"` | Wave 0 |
| CHNG-01 | TicketDetailPanel includes Changes as 6th tab | unit | `npx vitest run src/features/tickets/TicketDetailPanel.test.tsx -t "Changes tab"` | Modify existing |
| CHNG-01 | TicketDetailPanel auto-switches to Changes tab when hasUnseenChanges | unit | `npx vitest run src/features/tickets/TicketDetailPanel.test.tsx -t "auto-switch"` | Modify existing |
| CHNG-02 | TicketCard renders dot when hasUnseenChanges is true | unit | `npx vitest run src/features/tickets/TicketListPage.test.tsx -t "unseen dot"` | Modify existing |
| CHNG-02 | unseenChanges in ticketStore hydrates from get_unseen_change_keys | unit | `npx vitest run src/features/tickets/__tests__/ticketStore.test.ts -t "unseenChanges"` | Modify existing |
| CHNG-02 | poll-complete event sets unseenChanges for changedKeys | unit | `npx vitest run src/features/tickets/TicketListPage.test.tsx -t "poll-complete unseenChanges"` | Modify existing |

### Sampling Rate

- **Per task commit:** `npx vitest run src/features/tickets/tabs/ChangesTab.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/features/tickets/tabs/ChangesTab.test.tsx` — covers CHNG-01 (all 4 cases above)

*(All other test files exist and require modification, not creation)*

---

## Open Questions

1. **Field name display in Tooltip (Pitfall 3)**
   - What we know: The tooltip requires `"N changes: field1, field2"` — needs the field names, not just a count
   - What's unclear: Whether to store field names in `unseenChanges: Record<string, string[]>` or do a lightweight lookup at render time
   - Recommendation: Store as `Record<string, string[]>` in Zustand — field names are already available at poll time from `PollCompletePayload.changed_keys`. The Rust `process_tickets` side already has `Vec<FieldChange>` in scope; emit field names alongside changed_keys (or add a new `changed_fields: HashMap<String, Vec<String>>` to `PollCompletePayload`). Alternatively, the simpler approach is to make `get_unseen_change_keys` return `Vec<{key: string, fields: string[]}>` directly.

2. **`seen_response_json` storage for D-12 cumulative diff**
   - What we know: D-12 requires showing the original old value (at last-seen time) vs. current new value
   - What's unclear: Whether to (a) store `seen_response_json` in the DB and diff against it on demand, or (b) compute and store `pending_changes_json` immediately when changes are detected
   - Recommendation: Option (b) — compute and persist `pending_changes_json` at poll time, using `detect_changes(seen_json, new_json)` where `seen_json` is the snapshot at last mark-seen time. This is simpler at query time (just deserialize) and keeps `get_ticket_changes` fast. Store `seen_response_json` as a separate column set when `mark_changes_seen` is called, and used as the baseline for the next diff cycle.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src-tauri/src/snapshot_db.rs` — `FieldChange` struct, `check_for_changes()`, `detect_changes()`, `SnapshotDb`
- Direct code inspection: `src-tauri/src/commands.rs` lines 1913-1929 — existing `check_ticket_changes` command pattern
- Direct code inspection: `src-tauri/src/poll_engine.rs` lines 34-55 — `PollCompletePayload` with `changed_keys: Vec<String>` (camelCase: `changedKeys`)
- Direct code inspection: `src/features/tickets/TicketDetailPanel.tsx` — tab system, `TabId` union type, `activeTab` state, Tooltip usage pattern
- Direct code inspection: `src/features/tickets/tabs/HistoryTab.tsx` — exact pattern to clone for ChangesTab
- Direct code inspection: `src/features/tickets/TicketCard.tsx` — insertion point for dot (line 32-35)
- Direct code inspection: `src/features/tickets/ticketStore.ts` — `triageMap` pattern for new `unseenChanges` slice
- Direct code inspection: `src/features/tickets/TicketListPage.tsx` — poll-complete listener (lines 151-167), hydration pattern (lines 119-136)
- Direct code inspection: `src-tauri/src/main.rs` lines 187-229 — command registry
- Direct code inspection: `src/i18n/locales/en.json` — existing `detail.tab.*` and `tickets.card.*` key namespaces
- Direct code inspection: `.planning/phases/15-change-diff-view/15-UI-SPEC.md` — design contract

### Secondary (MEDIUM confidence)
- `.planning/phases/15-change-diff-view/15-CONTEXT.md` — locked decisions D-01 through D-12
- `.planning/REQUIREMENTS.md` — CHNG-01, CHNG-02 requirements

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all identified from direct codebase inspection; no new packages
- Architecture: HIGH — all patterns sourced from existing files in this codebase
- Pitfalls: HIGH — derived from code reading and the D-12 requirement semantics
- Validation: HIGH — Vitest config read directly; existing test patterns confirmed

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable internal codebase — no external dependency drift risk)
