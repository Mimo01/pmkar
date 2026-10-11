# Technology Stack: Custom Groups (v0.5.0)

**Project:** Pmkar
**Researched:** 2026-10-11
**Scope:** Additions only. Zustand, shadcn/ui, Radix tabs, i18next, rusqlite, cmdk, TanStack Virtual, sonner, Tailwind, lucide are already present and are reused.

## Bottom Line

Add exactly **three** npm packages (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) and **zero** Rust crates. Everything else (color palette, multi-select, schema, migrations, i18n) is built from what is already in the repo.

## Recommended Additions

### Frontend: drag-reorder of group tabs
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @dnd-kit/core | ^6.3.1 | DnD context, sensors | Stable. Peer deps `react >=16.8`, so it works with React 19. Built-in KeyboardSensor gives WCAG-AA keyboard reorder (project requirement). Last published 2024-12, so it is stable but quiet. |
| @dnd-kit/sortable | ^10.0.0 | `SortableContext`, `useSortable`, `horizontalListSortingStrategy`, `arrayMove` | Purpose-built for a horizontal sortable strip. Peer dep is `@dnd-kit/core ^6.3.0`. |
| @dnd-kit/utilities | ^3.2.2 | `CSS.Transform.toString` | Needed for the `useSortable` transform style. It is a transitive dep of sortable, so list it explicitly if imported. |

Verified via the npm registry (peer deps and versions). I did not fetch Context7 docs for the dnd-kit API; the API names above come from training knowledge, so confirm them at implementation (MEDIUM confidence).

**Do not use `@dnd-kit/react` (0.5.0) or `@dnd-kit/helpers`.** This is the pre-1.0 rewrite and its API is still moving. A single horizontal tab strip does not justify that risk.

**Do not add `@dnd-kit/modifiers`** for the first pass. Use the `restrictToHorizontalAxis` modifier only if drift is visible. If it is needed, v9.0.0 is compatible with core 6.

Integration notes:
- Make only the group tabs sortable. Core tabs (New / Not mine / Linked) and the divider stay outside `SortableContext`, so core tabs are never reorderable.
- Use `PointerSensor` with `activationConstraint: { distance: 5 }` so a click still selects the tab. Add `KeyboardSensor` with `sortableKeyboardCoordinates`.
- The existing `@radix-ui/react-tabs` handles roving focus and ARIA. Wrap each group `Tabs.Trigger` in a `useSortable` element via `asChild`. Test the combination of the drag listeners and Radix arrow-key navigation early. The conflict is Space/Enter, which both Radix and the KeyboardSensor use. Consider an explicit "Move left / Move right" item in the tab context menu as the accessible fallback.
- Persist the new order on `onDragEnd` only, not on every move.
- Horizontal overflow needs no library. Use the existing `@radix-ui/react-scroll-area` (horizontal) or `overflow-x-auto`, plus `scrollIntoView({inline:'nearest'})` for the active tab.

### Frontend: multi-select in the ticket list
**No new library.** Implement it as a Zustand slice (`selectedKeys: Set<string>` or an array, plus `lastClickedKey` for shift-range).
- Reuse the hand-rolled checkbox pattern. There is no shadcn `checkbox.tsx` in `src/components/ui`. Either add shadcn's Checkbox (this needs `@radix-ui/react-checkbox`, a single small Radix package that matches the existing Radix-per-primitive approach) or use a native `<input type="checkbox">` styled with Tailwind. **Recommend adding `@radix-ui/react-checkbox` ^1.x via shadcn**, because it supports the indeterminate state for a select-all header and has proper ARIA.
- The list is virtualized with TanStack Virtual, so selection state must live in the store keyed by issue key, never in row-local state. Shift-range selection must use the filtered/sorted key array, not the DOM rows.
- Bulk "Add to group" can use the existing **cmdk**-based popover or a Radix Dialog. No `@radix-ui/react-popover` or dropdown is installed. If a popover is wanted for the "Add to group" picker, use the existing cmdk plus Dialog, or add `@radix-ui/react-popover` (shadcn Popover). Prefer reusing Dialog and cmdk to avoid new deps, unless the UX needs anchoring.
- **Selection anti-pattern:** do not use a table or selection library (TanStack Table, react-aria selection). It is overkill for card lists.

### Frontend: color palette
**No new library.** Use a fixed curated palette of about 8-10 named colors stored as a token string (for example `"blue"`, `"amber"`) and not as hex.
- Map each token to Tailwind v4 classes in one constant (`GROUP_COLORS`). Tailwind v4 must see full class strings statically, so write them out and do not interpolate (`bg-${c}-500` will be purged).
- Define each color's light/dark foreground/background pair and check contrast at 4.5:1 for the AA requirement. Color must never be the only identifier: the tab also shows the name, and a dot is decorative (`aria-hidden`).
- No `react-colorful` or arbitrary color picker. It adds a contrast-validation burden and a dependency for little benefit.
- Storing a token means a palette retune later does not need a data migration. Unknown tokens should fall back to gray.

### Backend: SQLite
**No new crate.** `rusqlite` 0.39 (bundled) is sufficient.

Follow the established db-per-concern pattern (triage.db / snapshot.db / audit.db / mapping.db). Recommendation: **a new `groups_db.rs` with its own `groups.db`**, or, if a simpler path is preferred, tables inside `triage.db`, because membership is conceptually local user state like triage. The tradeoff is that triage_db already carries a messy migration history. A separate `groups_db` avoids growing that file. The PROJECT.md decision log also favours per-concern DBs.

Proposed schema (idempotent `CREATE TABLE IF NOT EXISTS` run at open, matching existing migration style in `triage_db.rs`, which uses `execute_batch` plus `ignore_duplicate_column`):

```sql
CREATE TABLE IF NOT EXISTS issue_group (
  id         TEXT PRIMARY KEY,           -- uuid v4 (uuid crate already present)
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,              -- palette token
  position   INTEGER NOT NULL,           -- dense 0..n, rewritten on reorder
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS issue_group_member (
  group_id   TEXT NOT NULL REFERENCES issue_group(id) ON DELETE CASCADE,
  ticket_key TEXT NOT NULL,
  added_at   TEXT NOT NULL,
  -- snapshot for the "no longer in results" fallback card:
  summary    TEXT,
  PRIMARY KEY (group_id, ticket_key)
);
CREATE INDEX IF NOT EXISTS idx_member_ticket ON issue_group_member(ticket_key);
```

Key points:
- `PRAGMA foreign_keys = ON` must be set per connection, because SQLite defaults it to off. Without it `ON DELETE CASCADE` silently does nothing and deleting a group leaks membership rows. Add a test.
- Reorder: one transaction that rewrites `position` for all groups from the ordered id list (the group count is tiny), so there are no fractional-index libraries.
- Do not enforce a unique name by default at the DB level. Decide in the UI. If it is enforced, use `COLLATE NOCASE`.
- "No longer in results": store membership by `ticket_key` only, and never delete members when a fetch omits the key. Keep a tiny cached `summary` (and optionally status) on the member row so the missing-card can render something. Alternatively, `snapshot.db` already stores snapshots, so the frontend can fall back to the snapshot data. Check `snapshot_db.rs` before adding a duplicate column; reusing snapshots is preferred if the snapshot is keyed by ticket key.
- Tauri commands (existing pattern): `list_groups`, `create_group`, `update_group` (rename/color), `delete_group`, `reorder_groups`, `add_issues_to_group(group_id, keys[])`, `remove_issue_from_group`, `list_group_members`. Bulk add must be one transaction with `INSERT OR IGNORE`.
- Register the new DB state in `lib.rs` next to the existing `manage(...)` calls and add commands to the `invoke_handler`.
- Rust ids: reuse the `uuid` crate and `chrono` for timestamps.
- Clippy pedantic is on, so add `# Errors` docs as per existing style (missing_errors_doc is allowed, so it is fine).

Migration versioning: the repo uses ad-hoc idempotent DDL rather than `PRAGMA user_version`. Do not introduce `rusqlite_migration` or a migration framework for two new tables. Match the existing style. If a future change needs a column, add `ignore_duplicate_column(ALTER ...)`.

### Frontend: state
**No new library.** Create `groupStore.ts` (Zustand, hydrate via `invoke`). Reminder from project memory: never return `?? []` inside a selector (infinite re-render). Use a `null` fallback or a module-level `EMPTY` constant. Derive "issues in group X" with memoized selectors outside the store, joining `membership` against `ticketStore` issues. Membership with no matching fetched issue yields the "no longer in results" entries.

### i18n
No new library. Add a `groups.*` namespace to the EN and SK resource files, plus the CONI-01 CopyResultModal step-label keys. Use i18next plural forms for counts ("3 issues selected"). Slovak has 3 plural categories (one/few/many/other) in CLDR, so provide `_one`, `_few`, `_many`, `_other` keys for Slovak or the count strings will read wrong.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Tab reorder | @dnd-kit/core + sortable | @dnd-kit/react 0.5.0 | Pre-1.0, API still changing |
| Tab reorder | @dnd-kit | react-beautiful-dnd | Deprecated/archived, React 19 issues |
| Tab reorder | @dnd-kit | @hello-pangea/dnd | List-oriented, heavier, weaker horizontal-tab and keyboard story for this case |
| Tab reorder | @dnd-kit | Hand-rolled HTML5 DnD | Poor in the Tauri webview (WebKit/WebView2 differences), no keyboard support, fails AA |
| Tab reorder | @dnd-kit | Move left/right buttons only | Acceptable as the a11y fallback, but drag is expected for tab UX. Keep both |
| Color | Token palette | react-colorful / hex input | Contrast risk, extra dep, inconsistent look |
| Selection | Zustand slice | TanStack Table / react-aria | Overkill for virtualized cards |
| Migrations | Existing idempotent DDL | rusqlite_migration | Two tables do not justify a new pattern |
| Ordering | Integer position rewrite | Fractional indexing lib | Group count is under about 20 |
| Storage | groups.db (or triage.db) | localStorage | Must survive webview data resets and match the "local SQLite" convention |

## Explicitly NOT Adding
- `@dnd-kit/react`, `@dnd-kit/helpers`, `react-beautiful-dnd`, `@hello-pangea/dnd`
- Any color-picker package
- Any state library besides Zustand, any table library
- `rusqlite_migration` or ORM (diesel, sea-orm)
- Any new Rust crate

## Installation

```bash
npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2
# Optional, only if a shadcn Checkbox is added for multi-select:
npx shadcn@latest add checkbox   # pulls @radix-ui/react-checkbox
```

No Cargo changes.

## Confidence

| Item | Level | Basis |
|------|-------|-------|
| dnd-kit versions and peer deps | HIGH | npm registry queried 2026-10-11 |
| dnd-kit API and Radix Tabs interplay | MEDIUM | Training knowledge, not re-verified against docs; prototype early |
| rusqlite schema and FK pragma | HIGH | Standard SQLite behavior, matches existing repo patterns read in `triage_db.rs` |
| Slovak plural categories | MEDIUM | CLDR knowledge; i18next supports it, so verify the keys at implementation |
| Reusing snapshot.db for missing-issue data | LOW | Not inspected; check `snapshot_db.rs` |

## Sources
- npm registry (`npm view @dnd-kit/*`), 2026-10-11
- `/Users/mimo/Documents/Projects/pmkar/package.json`, `src-tauri/Cargo.toml`, `src-tauri/src/triage_db.rs` (existing migration style)
- `.planning/PROJECT.md`
