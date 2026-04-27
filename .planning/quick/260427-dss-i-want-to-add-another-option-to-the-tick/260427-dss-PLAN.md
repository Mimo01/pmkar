---
phase: quick-260427-dss
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/triage_db.rs
  - src-tauri/src/commands.rs
  - src/features/tickets/types.ts
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
requirements:
  - QUICK-260427-DSS
must_haves:
  truths:
    - "User sees a third action button on the ticket detail header next to 'Dismiss' and 'Copy', labeled 'Mark as Handled' (EN) / 'Označiť ako vybavené' (SK)"
    - "Clicking 'Mark as Handled' persists triage state 'handled' in SQLite and removes the ticket from the New tab without a refetch"
    - "Handled tickets appear in the Dismissed tab list with a small 'Handled' badge so user has a recovery path"
    - "Clicking 'Restore' on a handled ticket resets state to 'seen' and the ticket reappears in the New tab"
    - "Handled state survives app restart (SQLite-backed) and is exposed via the existing get_triage_state Tauri command"
  artifacts:
    - path: "src-tauri/src/triage_db.rs"
      provides: "Updated CHECK constraint accepting 'handled' as a fifth state via additive ALTER pattern"
      contains: "'handled'"
    - path: "src/features/tickets/types.ts"
      provides: "TriageState union extended with 'handled'"
      contains: "'handled'"
    - path: "src/features/tickets/TicketDetailPanel.tsx"
      provides: "Mark-as-Handled button + handler invoking set_triage_state with 'handled'"
      contains: "handleMarkHandled"
  key_links:
    - from: "TicketDetailPanel.tsx / TicketDetailPage.tsx"
      to: "set_triage_state Tauri command"
      via: "invoke('set_triage_state', { ticketKey, state: 'handled' })"
      pattern: "state: 'handled'"
    - from: "set_triage_state command (commands.rs)"
      to: "TriageDb.set_triage"
      via: "validation allowlist now includes 'handled'"
      pattern: "\"new\" \\| \"seen\" \\| \"ignored\" \\| \"copied\" \\| \"handled\""
    - from: "TicketListPage.tsx candidateTickets filter"
      to: "hides handled tickets from New tab"
      via: "s !== 'handled' added to existing exclusion list"
      pattern: "s !== 'handled'"
    - from: "IgnoredTicketsPage.tsx ignoredTickets filter"
      to: "includes handled tickets in Dismissed tab"
      via: "filter now matches state === 'ignored' || state === 'handled'"
      pattern: "state === 'handled'"
---

<objective>
Add a third triage action — "Mark as Handled" — alongside the existing "Copy" and
"Dismiss" actions on the ticket detail view. Used when the user has already
manually copied the ticket to their company Jira outside pmkar and wants pmkar
to stop surfacing it. Handled tickets disappear from the New tab and remain
visible in the Dismissed tab with a small badge so the user has a recovery
path via the existing Restore action.

Purpose: Lets the user opt a ticket out of pmkar's workflow without lying to
pmkar about the ticket's relevance ("Dismiss" semantically means "not mine";
"Handled" means "already done elsewhere"). Distinct semantics → distinct state.

Output:
- New SQLite triage state value `'handled'` (additive — no data migration)
- New Tauri command allowlist entry
- New TypeScript union member, new detail-page action button (EN + SK)
- Filter updates so handled tickets hide from New and surface in Dismissed
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

<!-- Source of truth for the existing triage pattern that this plan mirrors -->
@src-tauri/src/triage_db.rs
@src-tauri/src/commands.rs
@src/features/tickets/types.ts
@src/features/tickets/TicketDetailPanel.tsx
@src/features/tickets/TicketDetailPage.tsx
@src/features/tickets/TicketListPage.tsx
@src/features/tickets/IgnoredTicketsPage.tsx
@src/i18n/locales/en.json
@src/i18n/locales/sk.json

<interfaces>
<!--
  Existing triage surface that the new 'handled' state plugs into.
  Executor: do NOT explore the codebase to rediscover these — use them directly.
  Mirror the existing 'ignored' implementation; 'handled' is a sibling, not a redesign.
-->

Triage state enum (DB CHECK constraint — `src-tauri/src/triage_db.rs:43`):
```sql
CREATE TABLE IF NOT EXISTS triage_state (
    ticket_key   TEXT PRIMARY KEY,
    state        TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied')),
    first_seen   TEXT NOT NULL,
    last_updated TEXT NOT NULL
);
```
This table is already in production. Schema additions in this codebase use the
`ALTER` pattern with `let _ = conn.execute_batch(...)` so re-runs on existing
databases are idempotent (see `ALTER_TRIAGE_ADD_COPIED_KEY` for the template).
However, **SQLite CHECK constraints cannot be modified by ALTER TABLE**. The
correct migration is to drop the old CHECK by recreating the table or — much
simpler and consistent with the small-table pattern in this repo — drop the
CHECK constraint entirely and rely on Tauri-command-side validation as the
single source of truth. This is the chosen approach (see Task 1 for rationale).

TypeScript union (`src/features/tickets/types.ts:2`):
```typescript
export type TriageState = 'new' | 'seen' | 'ignored' | 'copied';
export interface TriageEntry {
  state: TriageState;
  copiedKey: string | null;
}
```

Tauri command surface (`src-tauri/src/commands.rs:957`):
```rust
#[tauri::command]
pub fn set_triage_state(
    ticket_key: String,
    state: String,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<(), AppError> {
    match state.as_str() {
        "new" | "seen" | "ignored" | "copied" => {}
        _ => { return Err(AppError::Internal(format!("Invalid triage state: '{state}'..."))); }
    }
    // ...
}
```

Frontend invocation pattern (TicketDetailPanel.tsx:52, TicketDetailPage.tsx:52):
```typescript
const handleIgnore = () => {
  invoke('set_triage_state', { ticketKey: issueKey, state: 'ignored' }).catch(() => {});
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: { state: 'ignored', copiedKey: null },
  });
};
```

New-tab exclusion filter (TicketListPage.tsx:203):
```typescript
const candidateTickets = tickets.filter((t) => {
  const s = triageMap[t.key]?.state;
  return s !== 'ignored' && s !== 'copied' && !isDoneTicket(t);
});
```

Dismissed-tab inclusion filter (IgnoredTicketsPage.tsx:28):
```typescript
const ignoredTickets = useMemo(
  () => tickets.filter((t) => triageMap[t.key]?.state === 'ignored' && !isDoneTicket(t)),
  [tickets, triageMap],
);
```

Existing i18n keys to mirror (`src/i18n/locales/en.json`):
- `detail.ignore`: "Dismiss"  → new `detail.markHandled`: "Mark as Handled"
- `detail.ignore.tooltip` → new `detail.markHandled.tooltip`
- `detail.ignored`: "Ignored" (button label when already in that state)
- `ignored.restore`: "Restore"  → reused as-is for handled tickets
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend triage state to 'handled' across DB, Tauri command, and TypeScript types</name>
  <files>
    src-tauri/src/triage_db.rs,
    src-tauri/src/commands.rs,
    src/features/tickets/types.ts
  </files>
  <action>
**Backend (src-tauri/src/triage_db.rs):**

The current `CREATE TABLE` statement embeds a `CHECK(state IN ('new','seen','ignored','copied'))`
constraint. SQLite cannot ALTER an existing CHECK constraint without rebuilding
the table, and this constraint duplicates validation already done in the Tauri
command layer. Approach: keep the CHECK loose by widening it to include
'handled' for fresh databases, and accept that older databases retain the old
4-value CHECK — those will reject 'handled' at the SQL layer until a future
table-rebuild migration. Since this is a single-user desktop app and the DB
file lives in the user's app-data directory, do a one-shot in-place rebuild
on open:

1. Update the `CREATE_TRIAGE_STATE_SQL` const to include `'handled'`:
   ```rust
   const CREATE_TRIAGE_STATE_SQL: &str = "CREATE TABLE IF NOT EXISTS triage_state (
       ticket_key   TEXT PRIMARY KEY,
       state        TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied','handled')),
       first_seen   TEXT NOT NULL,
       last_updated TEXT NOT NULL
   );";
   ```

2. Add a migration helper `migrate_triage_check_constraint` that runs after the
   `CREATE TABLE IF NOT EXISTS` and detects whether the existing table's CHECK
   includes `'handled'`. If not, rebuild the table:

   ```rust
   const MIGRATE_TRIAGE_CHECK_HANDLED: &str = "
       BEGIN TRANSACTION;
       CREATE TABLE IF NOT EXISTS triage_state_new (
           ticket_key   TEXT PRIMARY KEY,
           state        TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied','handled')),
           first_seen   TEXT NOT NULL,
           last_updated TEXT NOT NULL,
           copied_key   TEXT
       );
       INSERT INTO triage_state_new (ticket_key, state, first_seen, last_updated, copied_key)
           SELECT ticket_key, state, first_seen, last_updated, copied_key FROM triage_state;
       DROP TABLE triage_state;
       ALTER TABLE triage_state_new RENAME TO triage_state;
       COMMIT;
   ";
   ```

   Gate this migration behind a check: query
   `SELECT sql FROM sqlite_master WHERE type='table' AND name='triage_state'`,
   and only run the rebuild if the resulting SQL string does NOT contain
   `'handled'`. Run inside both `open()` and `open_in_memory()` after the
   existing `ALTER_TRIAGE_ADD_COPIED_KEY` step. Wrap the migration in
   `let _ = conn.execute_batch(...)` so a partial-state DB doesn't crash app
   start (matches the existing `let _ = conn.execute_batch(ALTER_…)` pattern
   in this file).

3. Add a Rust unit test in the existing `mod tests` block:
   ```rust
   #[test]
   fn test_set_handled_state_accepted() {
       let db = new_db();
       db.set_triage("PROJ-1", "handled").expect("handled state should be accepted");
       let all = db.get_all_triage().expect("get_all_triage failed");
       assert_eq!(all["PROJ-1"].0, "handled");
   }
   ```

**Tauri command (src-tauri/src/commands.rs:957):**

Extend the validation allowlist in `set_triage_state` to include `"handled"`:
```rust
match state.as_str() {
    "new" | "seen" | "ignored" | "copied" | "handled" => {}
    _ => {
        return Err(AppError::Internal(format!(
            "Invalid triage state: '{state}'. Must be one of: new, seen, ignored, copied, handled"
        )));
    }
}
```

**TypeScript types (src/features/tickets/types.ts:2):**

Extend the union:
```typescript
export type TriageState = 'new' | 'seen' | 'ignored' | 'copied' | 'handled';
```
No other changes to `TriageEntry` — it already references `TriageState`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar &amp;&amp; cargo test --manifest-path src-tauri/Cargo.toml triage_db::tests::test_set_handled_state_accepted &amp;&amp; cargo test --manifest-path src-tauri/Cargo.toml triage_db::tests::test_invalid_triage_state_rejected &amp;&amp; npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
- `triage_state` table CHECK constraint includes `'handled'` on fresh DBs and after migration on existing DBs
- `set_triage_state` Tauri command accepts `"handled"` and rejects unknown values
- `TriageState` TypeScript union includes `'handled'`
- All existing triage_db tests still pass
- New `test_set_handled_state_accepted` passes
- `tsc --noEmit` reports no type errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Add 'Mark as Handled' button to detail views and update tab filters</name>
  <files>
    src/features/tickets/TicketDetailPanel.tsx,
    src/features/tickets/TicketDetailPage.tsx,
    src/features/tickets/TicketListPage.tsx,
    src/features/tickets/IgnoredTicketsPage.tsx,
    src/i18n/locales/en.json,
    src/i18n/locales/sk.json
  </files>
  <action>
**i18n keys (src/i18n/locales/en.json + sk.json):**

Add the following keys to BOTH locale files. Place them near the existing
`detail.ignore` / `detail.ignored` keys to keep the file organised.

`en.json`:
```json
"detail.markHandled": "Mark as Handled",
"detail.markHandled.tooltip": "Use when you've already copied this ticket manually — pmkar will stop surfacing it. You can restore it from the Dismissed tab.",
"detail.handled": "Handled",
"detail.handled.tooltip": "You marked this ticket as already handled — click to restore it to your inbox",
"tickets.card.handledBadge": "Handled"
```

`sk.json`:
```json
"detail.markHandled": "Označiť ako vybavené",
"detail.markHandled.tooltip": "Použite, keď ste tiket už skopírovali ručne — pmkar ho prestane zobrazovať. Môžete ho obnoviť v karte Zamietnuté.",
"detail.handled": "Vybavené",
"detail.handled.tooltip": "Tento tiket ste označili ako vybavený — kliknite pre obnovenie do schránky",
"tickets.card.handledBadge": "Vybavené"
```

**TicketDetailPanel.tsx and TicketDetailPage.tsx (mirror changes in both files):**

Both files have nearly identical structure. Apply the same edits to each.

1. Add a derived flag near the existing `isIgnored` computation:
   ```typescript
   const isHandled = triageEntry?.state === 'handled';
   ```

2. Add new handlers that mirror `handleIgnore` / `handleUnignore`. In
   `TicketDetailPage.tsx` they are wrapped in `useCallback`; in
   `TicketDetailPanel.tsx` they are plain functions. Match the surrounding
   style:

   ```typescript
   // TicketDetailPage.tsx — useCallback wrapped
   const handleMarkHandled = useCallback(() => {
     invoke('set_triage_state', { ticketKey: issueKey, state: 'handled' }).catch(() => {});
     useTicketStore.getState().hydrateTriageMap({
       ...useTicketStore.getState().triageMap,
       [issueKey]: { state: 'handled', copiedKey: null },
     });
   }, [issueKey]);

   const handleUnhandle = useCallback(() => {
     invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
     useTicketStore.getState().hydrateTriageMap({
       ...useTicketStore.getState().triageMap,
       [issueKey]: { state: 'seen', copiedKey: null },
     });
   }, [issueKey]);
   ```

   In `TicketDetailPanel.tsx` use plain `const handleMarkHandled = () => { ... }`
   to match the existing `handleIgnore` style there.

3. Add a third action button in the action row (after the Dismiss button,
   before the Copy button). Both files use the same conditional structure
   `isCopied ? null : isIgnored ? <UnignoreButton/> : <IgnoreButton/>` followed
   by a separate Copy button gated on `isCopied || isIgnored ? null : <Copy/>`.

   Update both gates to also handle `isHandled`:

   - The Dismiss button should NOT render when `isHandled` (don't dismiss
     something already handled). The simplest restructure is to render the
     three secondary states as a small chain:
     ```tsx
     {isCopied ? null : isHandled ? (
       <Tooltip>
         <TooltipTrigger asChild>
           <button
             type="button"
             onClick={handleUnhandle}
             className="px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors"
           >
             {t('detail.handled')}
           </button>
         </TooltipTrigger>
         <TooltipContent aria-hidden="true">{t('detail.handled.tooltip')}</TooltipContent>
       </Tooltip>
     ) : isIgnored ? (
       /* existing Unignore button — unchanged */
     ) : (
       /* existing Ignore button — unchanged, BUT add a sibling Mark-as-Handled button immediately after it */
       <>
         {/* existing Ignore (Dismiss) Tooltip+button block — kept verbatim */}
         <Tooltip>
           <TooltipTrigger asChild>
             <button
               type="button"
               onClick={handleMarkHandled}
               className="px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors"
             >
               {t('detail.markHandled')}
             </button>
           </TooltipTrigger>
           <TooltipContent aria-hidden="true">{t('detail.markHandled.tooltip')}</TooltipContent>
         </Tooltip>
       </>
     )}
     ```

   - The Copy button gate becomes:
     ```tsx
     {isCopied || isIgnored || isHandled ? null : (
       /* existing Copy button — unchanged */
     )}
     ```

   Preserve the existing button styling exactly — the new button matches the
   Dismiss button's classes verbatim (variant: secondary outline, same
   padding, same hover treatment) so the visual hierarchy stays:
   primary Copy / secondary Dismiss / secondary Mark Handled.

**TicketListPage.tsx (line 203 — candidateTickets filter):**

Extend the exclusion to hide handled tickets from the New tab:
```typescript
const candidateTickets = tickets.filter((t) => {
  const s = triageMap[t.key]?.state;
  return s !== 'ignored' && s !== 'copied' && s !== 'handled' && !isDoneTicket(t);
});
```

**IgnoredTicketsPage.tsx (line 28 — ignoredTickets filter):**

Include handled tickets in the Dismissed tab as a recovery surface. Update
the filter:
```typescript
const ignoredTickets = useMemo(
  () => tickets.filter((t) => {
    const s = triageMap[t.key]?.state;
    return (s === 'ignored' || s === 'handled') && !isDoneTicket(t);
  }),
  [tickets, triageMap],
);
```

In the same file, the rendered `<TicketCard>` passes `actionSlot` with a
Restore button. Add a small "Handled" pill next to the Restore button so the
user can distinguish handled-vs-dismissed entries. Modify the `actionSlot`
prop:
```tsx
actionSlot={
  <div className="flex items-center gap-2">
    {triageMap[ticket.key]?.state === 'handled' && (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-semibold">
        {t('tickets.card.handledBadge')}
      </span>
    )}
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleRestore(ticket.key);
      }}
      className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150"
    >
      {t('ignored.restore')}
    </button>
  </div>
}
```

`handleRestore` already invokes `set_triage_state` with `'seen'` — that
correctly restores both ignored and handled tickets. No change needed there.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar &amp;&amp; npx tsc --noEmit -p tsconfig.json &amp;&amp; npx vitest run --reporter=dot src/features/tickets/IgnoredTicketsPage.test.tsx src/features/tickets/__tests__/TicketDetailPage.test.tsx src/features/tickets/__tests__/LinkedTicketsPage.test.tsx</automated>
  </verify>
  <done>
- TicketDetailPanel and TicketDetailPage both render a "Mark as Handled" button alongside the existing Dismiss + Copy buttons when the ticket is in `'new'` or `'seen'` state
- Clicking it persists `state: 'handled'` via `set_triage_state` and updates the in-memory triageMap
- New tab (`TicketListPage`) hides tickets with `state === 'handled'`
- Dismissed tab (`IgnoredTicketsPage`) shows handled tickets with a small "Handled" badge next to the Restore button
- Restore action on a handled ticket sets state back to `'seen'` and the ticket reappears in the New tab
- All five new i18n keys exist in both `en.json` and `sk.json`
- `tsc --noEmit` passes; existing tests for IgnoredTicketsPage / TicketDetailPage / LinkedTicketsPage still pass
  </done>
</task>

</tasks>

<verification>
**Manual smoke test (after both tasks):**
1. `npm run tauri dev` and wait for app to load with mock connections
2. Click any ticket in the New tab → detail panel opens
3. Verify three buttons in the action row: `Open in Jira`, `Dismiss`, `Mark as Handled`, `Copy to {project}` (in that order)
4. Click `Mark as Handled` → ticket disappears from the New tab list
5. Switch to the Dismissed tab → the ticket appears with a "Handled" pill next to a "Restore" link
6. Click `Restore` → ticket disappears from Dismissed tab and reappears in New tab
7. Quit and relaunch app → handled state survives across restart (re-mark a ticket as Handled, quit, relaunch, confirm it is in the Dismissed tab still flagged "Handled")
8. Switch language to Slovak → button label reads "Označiť ako vybavené" and badge reads "Vybavené"

**Automated verification covered by task-level `<verify>` blocks above.**
</verification>

<success_criteria>
- New `'handled'` triage state is persisted, validated, and round-tripped through SQLite + Tauri + TypeScript
- A "Mark as Handled" button is visible and functional on both `TicketDetailPanel` and `TicketDetailPage`
- Handled tickets are hidden from the New tab and shown (with a "Handled" badge) in the Dismissed tab
- Handled tickets are restorable via the existing Restore action
- All new strings are translated in both `en.json` and `sk.json`
- All existing tests pass; `tsc --noEmit` passes; `cargo test` passes for `triage_db` module including the new `test_set_handled_state_accepted` test
</success_criteria>

<output>
After completion, create `.planning/quick/260427-dss-i-want-to-add-another-option-to-the-tick/260427-dss-SUMMARY.md`
documenting: files changed, the migration approach taken for the SQLite CHECK
constraint, and any UX deviations from the plan (e.g., button order, badge
styling).
</output>
