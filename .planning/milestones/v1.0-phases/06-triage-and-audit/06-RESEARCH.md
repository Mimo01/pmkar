# Phase 6: Triage and Audit - Research

**Researched:** 2026-03-23
**Domain:** Tauri IPC + React/Zustand frontend — UI feature addition to existing codebase
**Confidence:** HIGH

## Summary

Phase 6 is a UI feature phase with minimal backend work. The backend already has 95% of what it needs: `set_triage_state` and `get_triage_state` commands are registered, `TriageDb` supports the 'ignored' state, `get_audit_logs` is registered and returns all entries in DESC order. The frontend work is the bulk of this phase: two new pages (`IgnoredTicketsPage`, `AuditLogPage`), an extended `AppShell` with tab navigation and a footer status bar, and wiring the ignore/restore actions through to the Zustand store.

The critical architectural finding: **ticket field data (summary, status, priority, assignee) is not persisted to SQLite**. The `triage_state` table only stores `ticket_key + state`. The `IgnoredTicketsPage` must source ticket display data from the Zustand `ticketStore.tickets` array (which holds all JQL-matched tickets from the last fetch, including future-ignored ones). This works because `fetch_tickets` returns all assigned tickets without filtering by triage state — ignored tickets remain in the fetch result and are available in memory.

One new backend command is needed: `get_audit_count` — to populate the footer status bar without re-fetching the full log. The `AuditDb` already has a `count()` method; it just needs a Tauri command wrapper. Alternatively, the frontend can count `audit_logs.length` after loading the full log, but a count command avoids loading all entries for footer display.

**Primary recommendation:** Implement in this order — (1) backend count command, (2) AppShell navigation + footer bar, (3) IgnoredTicketsPage, (4) AuditLogPage. Each unit is independently testable and shippable.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ignore action UX**
- D-01: "Not for me" button in the ticket detail side panel header, alongside the existing "Copy to Jira" button
- D-02: No confirmation dialog — instant action. User can always recover from the ignored list
- D-03: Ticket disappears from candidate list immediately after ignoring

**Ignored list access**
- D-04: Dedicated separate page for ignored tickets, accessible from AppShell navigation (new "Ignored" tab alongside "Tickets")
- D-05: Same table layout as the candidate ticket list for consistency

**Audit log viewer**
- D-06: Table with expandable rows — compact view shows timestamp, method, URL, status code; click to expand and see headers + response body
- D-07: Response body displayed as formatted JSON (pretty-printed) when content is JSON
- D-08: Entries ordered newest first (matches AuditDb.get_all() existing DESC order)

**Audit log navigation**
- D-09: Footer/status bar link showing "N API calls" count — unobtrusive, developer-tools feel
- D-10: Clicking the footer link opens a full page view (replaces main content area, like Settings page) with a close button to return to previous view

### Claude's Discretion
- After ignoring a ticket: whether to close the detail panel or auto-advance to next ticket
- Un-ignore mechanism on the ignored list page (row action button vs detail panel button)
- Whether to include method/status filters on the audit log (depends on expected log volume given 5-20 tickets per session)
- Loading states and empty states for both ignored list and audit log
- Footer/status bar styling and positioning

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRIA-01 | User can mark a ticket as "not for me" to move it to the ignored list | `set_triage_state` command exists and accepts 'ignored'; `TicketDetailPanel` already has `handleIgnore` calling it; ticketStore needs to remove ticket from candidate display |
| TRIA-02 | User can view the ignored tickets list | New `IgnoredTicketsPage` reads from `ticketStore.tickets` filtered by `triageMap[key].state === 'ignored'`; `TicketTable` is reusable with an extra "Restore" column |
| TRIA-03 | User can un-ignore a ticket to bring it back to the candidate list | `set_triage_state` to 'seen' already works; UI-SPEC specifies "Restore" button on ignored list page; ticketStore update via `hydrateTriageMap` |
| AUDIT-02 | User can view the audit log within the app | `get_audit_logs` command registered and returns `Vec<AuditEntry>`; new `AuditLogPage` with expandable rows; footer status bar needs audit count |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x (existing) | UI rendering | Project standard |
| TypeScript | 5.x (existing) | Type safety | Project standard |
| Tailwind CSS 4 | 4.x (existing) | Styling | Project standard — custom brand tokens |
| Zustand | 4.x (existing) | State management | Established connectionStore/ticketStore/copyStore pattern |
| @tauri-apps/api | 2.x (existing) | Tauri IPC | `invoke()` for all backend calls |
| Vitest + @testing-library/react | existing | Frontend tests | Established test pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rusqlite (existing) | 0.31.x | SQLite queries | `AuditDb.count()` already uses it |
| chrono (existing) | 0.4.x | Timestamps | Already imported in audit.rs |

**No new dependencies are needed for this phase.**

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Filtering tickets in frontend | Separate `get_ignored_tickets` backend command | Backend command would return only keys+state, not ticket fields — frontend still needs field data from `ticketStore.tickets`. Frontend filtering is simpler. |
| `get_audit_count` command | Re-use `get_audit_logs` length | Loading all audit entries on app startup just to count them is wasteful. `AuditDb.count()` already exists. Add a cheap count command. |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── features/tickets/
│   ├── IgnoredTicketsPage.tsx    # NEW — ignored ticket list page
│   ├── AuditLogPage.tsx          # NEW — API audit log page
│   └── ticketStore.ts            # MODIFY — add ignoredTickets selector / store action
├── components/ui/
│   └── AppShell.tsx              # MODIFY — add nav tabs + footer status bar
src-tauri/src/
└── commands.rs                   # MODIFY — add get_audit_count command
    main.rs                       # MODIFY — register get_audit_count
```

### Pattern 1: Tauri IPC Command Registration

**What:** New commands are added to `commands.rs`, then registered in `main.rs` `invoke_handler`.

**When to use:** Any new backend capability the frontend needs.

**Example (add audit count command):**
```rust
// In src-tauri/src/commands.rs
#[tauri::command]
pub fn get_audit_count(
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<i64, AppError> {
    let db = db.lock().map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.count().map_err(Into::into)
}

// In src-tauri/src/main.rs — add to invoke_handler![...]:
commands::get_audit_count,
```

### Pattern 2: Zustand Store Action for Triage State Update

**What:** The ticketStore's `hydrateTriageMap` is used to apply triage state changes immediately (optimistic update), with backend persistence fire-and-forget.

**When to use:** All triage mutations (ignore, restore).

**Existing pattern (already in TicketDetailPanel):**
```typescript
// Optimistic update
invoke('set_triage_state', { ticketKey: issueKey, state: 'ignored' }).catch(() => {});
useTicketStore.getState().hydrateTriageMap({
  ...useTicketStore.getState().triageMap,
  [issueKey]: { state: 'ignored', copiedKey: null },
});
```

**The same pattern is used for restore (set state to 'seen'):**
```typescript
invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
useTicketStore.getState().hydrateTriageMap({
  ...useTicketStore.getState().triageMap,
  [issueKey]: { state: 'seen', copiedKey: null },
});
```

### Pattern 3: Page Navigation State in App.tsx

**What:** App.tsx uses a multi-branch conditional render pattern to switch between views. Currently: wizard → settings → main app.

**When to use:** Adding top-level page navigation.

**Existing pattern:**
```typescript
// App.tsx current: three branches
if (!hasSetup || editStep !== null) return <SetupWizard ... />;
if (showSettings) return <AppShell><SettingsPage .../></AppShell>;
return <AppShell onGearClick={...}><TicketListPage /></AppShell>;
```

**Phase 6 adds a `currentTab` state** (`'tickets' | 'ignored'`) and a `showAuditLog` state. The tab navigation sits inside AppShell, routing between `TicketListPage` and `IgnoredTicketsPage`. The `AuditLogPage` follows the Settings pattern (replaces main content area, has close button).

### Pattern 4: Page Component Shell

**What:** Full-page components follow a consistent layout: scrollable content area with `overflow-y-auto flex-1`, sticky header/toolbar.

**When to use:** `IgnoredTicketsPage`, `AuditLogPage`.

**Example from SettingsPage pattern:**
```typescript
export function IgnoredTicketsPage() {
  // Data from ticketStore
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const ignoredTickets = tickets.filter((t) => triageMap[t.key]?.state === 'ignored');

  // Render: header area + TicketTable (reused) with extra Restore column
}
```

### Pattern 5: Audit Log Expandable Rows

**What:** Single-expand accordion pattern — one row expanded at a time. Controlled by local state `expandedId: number | null`.

**When to use:** AuditLogPage table rows.

**Example:**
```typescript
const [expandedId, setExpandedId] = useState<number | null>(null);

function handleRowClick(id: number) {
  setExpandedId((prev) => (prev === id ? null : id));
}
```

For JSON formatting:
```typescript
function formatBody(body: string | null): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body; // Not JSON — display as-is
  }
}
```

### Pattern 6: AppShell Navigation Extension

**What:** AppShell currently accepts `onGearClick` prop. Phase 6 adds tab navigation and a footer bar. The cleanest approach is to add `activeTab`, `onTabChange`, and `auditCount` props, letting App.tsx own the navigation state.

**When to use:** AppShell structural change.

**Updated AppShell interface:**
```typescript
interface AppShellProps {
  children: ReactNode;
  onGearClick?: () => void;
  // New for Phase 6:
  activeTab?: 'tickets' | 'ignored';
  onTabChange?: (tab: 'tickets' | 'ignored') => void;
  auditCount?: number;
  onAuditClick?: () => void;
}
```

The footer bar and nav tabs are rendered INSIDE AppShell's layout structure:
- Nav tabs: between the header and `children`
- Footer bar: below `children`, pinned to bottom

### Anti-Patterns to Avoid

- **Storing ticket field data in SQLite to back the ignored list:** The frontend already has this data in memory. Adding a SQLite ticket cache is schema complexity this phase does not need.
- **Re-fetching the full audit log to populate the footer count:** Use `get_audit_count` (cheap COUNT(*) query) for the footer.
- **Duplicating the TicketTable for the ignored list:** The existing `TicketTable` is parameterized; it should be extended or wrapped, not copied.
- **Making AuditLogPage a modal/overlay:** CONTEXT.md D-10 explicitly says full-page replacement, same as SettingsPage. Do not use a modal.
- **Auto-refreshing the audit log:** The audit log is a static snapshot loaded once when AuditLogPage opens (5-20 tickets per session means manageable volume). No polling needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON pretty-print | Custom recursive renderer | `JSON.stringify(JSON.parse(body), null, 2)` in a `<pre>` | Browser-native, correct, handles all edge cases |
| Sortable table | Custom sort logic | Extend existing `TicketTable` sort pattern | Already implemented with `useMemo` + `compareTickets` |
| Timestamp formatting | Custom date logic | `new Intl.DateTimeFormat` or direct ISO string display | AuditEntry timestamps are already ISO 8601 |
| State persistence | Custom localStorage | SQLite via existing `set_triage_state` | Already the project pattern |

**Key insight:** This phase is mostly wiring. The hard backend work (SQLite schema, audit middleware, triage DB) was done in Phase 1-3. The frontend work is new page components following established patterns.

## Common Pitfalls

### Pitfall 1: Ignored Tickets Missing Field Data
**What goes wrong:** `IgnoredTicketsPage` filters `ticketStore.tickets` by ignored state but finds no matching tickets.
**Why it happens:** User ignored a ticket in a previous session, then restarted the app. On restart, `tickets` is empty until a fetch is performed. The `triageMap` has the key with `state: 'ignored'` but `tickets` has no entry for that key.
**How to avoid:** The `IgnoredTicketsPage` shows only tickets that exist in BOTH `tickets` array AND `triageMap` with `state === 'ignored'`. On first load after restart (before fetch), this will be an empty list — which is the correct UX. The empty state copy says "Tickets you mark as 'not mine' will appear here" — this is accurate if no tickets have been fetched yet. After a fetch, ignored tickets re-appear in the `tickets` array (fetch does not filter by triage state) and the ignored list populates.
**Warning signs:** Ignored list always empty even after fetch. Check that `fetch_tickets` JQL includes previously-ignored tickets (it does — it uses JQL like `assignee = currentUser` with no triage state filter).

### Pitfall 2: Candidate List Shows Ignored Tickets
**What goes wrong:** `TicketListPage` passes ALL tickets to `TicketTable`, including ignored ones. The ignored tickets appear with a "Not mine" pill but should not appear in the candidate list (D-03: "ticket disappears from candidate list").
**Why it happens:** `TicketTable` renders everything in the `tickets` prop.
**How to avoid:** `TicketListPage` must filter out `state === 'ignored'` tickets before passing to `TicketTable`. This is a frontend-only filter — the fetched data still includes ignored tickets (so they can be shown in `IgnoredTicketsPage`), but the candidate list view filters them out.
**Warning signs:** After ignoring a ticket it stays visible in the candidate list (with "Not mine" pill) instead of disappearing.

### Pitfall 3: Footer Audit Count Stale
**What goes wrong:** Footer shows "0 API calls" even after tickets are fetched.
**Why it happens:** `auditCount` state in App.tsx is initialized once on mount but not updated after each IPC call.
**How to avoid:** On mount, invoke `get_audit_count` to initialize. After each significant IPC call (fetch_tickets, fetch_ticket_detail, copy_ticket), re-invoke `get_audit_count` to refresh. Alternatively, increment a local counter alongside each IPC call. The simplest approach: refresh count after the footer is clicked (before showing AuditLogPage) and after closing AuditLogPage (so the count reflects what was seen). For real-time updates, a lightweight approach is to increment state alongside each `invoke` call.
**Warning signs:** Footer always shows "0 API calls" or stale count.

### Pitfall 4: `TicketTable` Collapse With Extra Column
**What goes wrong:** `IgnoredTicketsPage` reuses `TicketTable` but needs an extra "Restore" column. The current `TicketTable` API does not support injecting extra columns.
**Why it happens:** `TicketTable` has a fixed column definition (`COLUMNS` constant) and fixed rendering.
**How to avoid:** Two clean options: (a) create a thin `IgnoredTicketsTable` wrapper that renders its own table using the same CSS classes as `TicketTable` (safe, no modification to existing component), or (b) add an optional `actions` render-prop to `TicketTable`. Given the column structure is fixed and the ignored table is functionally different (no onSelectTicket, has onRestore), option (a) is lower risk. The UI-SPEC specifies the "Restore" button as a rightmost column of width `w-24` — this aligns with the existing column width pattern in `TicketTable`.
**Warning signs:** Layout breaks when `IgnoredTicketsPage` tries to use `TicketTable` with an extra action slot.

### Pitfall 5: AppShell Height Calculation Breaks
**What goes wrong:** Adding a footer bar changes the vertical height available to children. The existing `TicketListPage` uses `h-[calc(100vh-49px)]` where 49px is the AppShell header height. Adding a footer (28px) breaks this calculation.
**Why it happens:** Hardcoded pixel offsets for height calculations.
**How to avoid:** Update `TicketListPage` height calculation to account for footer: `h-[calc(100vh-49px-28px)]` = `h-[calc(100vh-77px)]`. Similarly for any other page that uses `100vh` minus a header offset. The footer height is 28px (`py-2` = 8px top + 8px bottom = 16px + `text-xs` single line ≈ 12px = 28px total per UI-SPEC).
**Warning signs:** Content overflow, scroll missing, or footer overlapping content.

### Pitfall 6: Audit Log Response Body is `null` for Most Entries
**What goes wrong:** Audit log viewer shows mostly empty expanded panels.
**Why it happens:** Looking at `audit.rs` — the `AuditMiddleware` sets `response_body: None` for ALL responses (comment in code: "Response body read separately if needed"). The `response_body` field in `AuditEntry` is always `null` for entries created by the middleware.
**How to avoid:** The audit log viewer should gracefully handle `null` response body — show "No response body recorded" in the expanded panel rather than an empty `<pre>`. The `headers` field IS populated for all entries. The expanded panel should show headers + body, with a clear message when body is absent. This is a UX design decision the planner needs to address — the UI-SPEC says "headers + response body" but body will be null. Recommend: show headers section (always populated) + body section (with null fallback message).
**Warning signs:** Expanded audit rows show blank panels.

## Code Examples

Verified patterns from source code:

### Frontend: Filtering ignored tickets from store
```typescript
// Source: ticketStore.ts pattern + types.ts TriageState
const ignoredTickets = tickets.filter(
  (t) => triageMap[t.key]?.state === 'ignored'
);

// Candidate list filtering (add to TicketListPage):
const candidateTickets = tickets.filter(
  (t) => triageMap[t.key]?.state !== 'ignored'
);
```

### Frontend: Restore action (mirror of existing handleIgnore in TicketDetailPanel)
```typescript
// Source: TicketDetailPanel.tsx handleUnignore (already exists, same pattern)
const handleRestore = (issueKey: string) => {
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: { state: 'seen', copiedKey: null },
  });
};
```

### Frontend: Audit log invoke
```typescript
// Source: commands.rs get_audit_logs, audit.rs AuditEntry
import type { AuditEntry } from './types'; // new type to add

const entries = await invoke<AuditEntry[]>('get_audit_logs');
```

### Rust: New audit count command
```rust
// Source: audit.rs AuditDb.count() already exists
#[tauri::command]
pub fn get_audit_count(
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<i64, AppError> {
    let db = db.lock().map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.count().map_err(Into::into)
}
```

### Frontend: AppShell nav tab style (from UI-SPEC)
```typescript
// Active tab: text-brand-text font-semibold border-b-2 border-brand
// Inactive tab: text-brand-muted hover:text-brand-text border-b-2 border-transparent
className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 ${
  activeTab === tab.id
    ? 'text-brand-text font-semibold border-brand'
    : 'text-brand-muted hover:text-brand-text border-transparent'
}`}
```

### Frontend: AuditLogPage JSON formatting
```typescript
// Source: UI-SPEC D-07
function formatResponseBody(body: string | null): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
// Render: <pre className="whitespace-pre-wrap break-all font-mono text-xs text-brand-text">{formatResponseBody(entry.responseBody)}</pre>
```

### Frontend: Status code color class
```typescript
// Source: UI-SPEC AuditLogPage spec
function statusColor(code: number | null): string {
  if (!code) return 'text-brand-muted';
  if (code >= 200 && code < 300) return 'text-green-400';
  if (code >= 300 && code < 400) return 'text-yellow-400';
  return 'text-red-400'; // 4xx/5xx
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| App.tsx renders only `TicketListPage` | App.tsx gains tab navigation state (`currentTab`) | Phase 6 | All page-level navigation lives in App.tsx |
| AppShell is a simple header+content wrapper | AppShell gains nav tabs + footer status bar | Phase 6 | AppShell interface expands; all pages need height recalculation |
| Candidate list shows all fetched tickets | Candidate list filters out `state === 'ignored'` | Phase 6 | `TicketListPage` must apply filter before passing to `TicketTable` |

## Open Questions

1. **Audit response body always null**
   - What we know: `AuditMiddleware` sets `response_body: None` for all entries (confirmed in audit.rs line 143: `response_body: None, // Response body read separately if needed`)
   - What's unclear: Was this intentional design? Should Phase 6 start capturing response bodies in the middleware?
   - Recommendation: Do NOT change the middleware in this phase (risk of breaking AUDIT-03 redaction). The expanded panel should show a clear message when body is absent: "Response body not recorded". The `headers` field IS populated and is useful. Planner should note this in the AuditLogPage task.

2. **Audit count refresh strategy**
   - What we know: Footer must show "N API calls"; count increases as user performs actions
   - What's unclear: The right trigger for refreshing count (after every invoke? on interval? on demand?)
   - Recommendation: Initialize count on app mount via `get_audit_count`. Refresh count after AuditLogPage closes (so user sees the count they just reviewed). For in-session increments, the simplest approach is to increment a local counter in App.tsx whenever an IPC call that hits the audit middleware completes. This avoids polling.

3. **IgnoredTicketsPage opening TicketDetailPanel**
   - What we know: UI-SPEC says "Navigation is top-level — switching tabs does NOT close an open detail panel (detail panel is per-page state)"
   - What's unclear: Does clicking a row on the IgnoredTicketsPage open a detail panel? The CONTEXT.md specifies only an "Un-ignore" row action button. The UI-SPEC does not mention a detail panel on the ignored list page.
   - Recommendation: No detail panel on IgnoredTicketsPage in this phase. The only row interaction is the "Restore" button. Clicking elsewhere on the row has no effect.

## Environment Availability

Step 2.6: SKIPPED — Phase 6 adds UI features using the existing project stack (Tauri/Rust + React/TypeScript). No new external dependencies, runtimes, or services are required. All tooling (cargo, npm, vitest) was verified as available in prior phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRIA-01 | Clicking "Not Mine" button invokes `set_triage_state` with 'ignored' and updates store | unit | `npx vitest run src/features/tickets/TicketDetailPanel.test.tsx` | Partial — file exists, test needs addition |
| TRIA-01 | Ignored ticket disappears from candidate list | unit | `npx vitest run src/features/tickets/TicketListPage.test.tsx` | Partial — file exists, test needs addition |
| TRIA-02 | IgnoredTicketsPage renders ignored tickets with Restore button | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ Wave 0 |
| TRIA-02 | IgnoredTicketsPage shows empty state when no ignored tickets | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ Wave 0 |
| TRIA-03 | Clicking "Restore" invokes `set_triage_state` with 'seen' and updates store | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ Wave 0 |
| TRIA-03 | Restored ticket disappears from ignored list | unit | `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx` | ❌ Wave 0 |
| AUDIT-02 | AuditLogPage renders entries with timestamp/method/URL/status columns | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ Wave 0 |
| AUDIT-02 | Clicking a row expands inline detail with headers | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ Wave 0 |
| AUDIT-02 | Clicking expanded row again collapses it | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ Wave 0 |
| AUDIT-02 | AuditLogPage shows empty state when no entries | unit | `npx vitest run src/features/tickets/AuditLogPage.test.tsx` | ❌ Wave 0 |
| AUDIT-02 | Footer status bar shows API call count | unit | `npx vitest run src/App.test.tsx` | Partial — file exists, test needs addition |
| General | Ignored state persists across app restart | manual-only | N/A — requires real Tauri app lifecycle | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx src/features/tickets/AuditLogPage.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/tickets/IgnoredTicketsPage.test.tsx` — covers TRIA-02, TRIA-03
- [ ] `src/features/tickets/AuditLogPage.test.tsx` — covers AUDIT-02

*(Existing test files `TicketDetailPanel.test.tsx`, `TicketListPage.test.tsx`, and `App.test.tsx` need new test cases added for TRIA-01 behavior and footer count. These are modifications, not new files.)*

## Sources

### Primary (HIGH confidence)
- Direct source file reads: `src-tauri/src/triage_db.rs`, `src-tauri/src/audit.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/main.rs`
- Direct source file reads: `src/features/tickets/TicketDetailPanel.tsx`, `src/features/tickets/TicketTable.tsx`, `src/features/tickets/ticketStore.ts`, `src/features/tickets/TicketListPage.tsx`, `src/features/tickets/TriageIndicator.tsx`, `src/features/tickets/types.ts`
- Direct source file reads: `src/components/ui/AppShell.tsx`, `src/App.tsx`
- Phase context: `.planning/phases/06-triage-and-audit/06-CONTEXT.md`, `06-UI-SPEC.md`
- Project context: `.planning/REQUIREMENTS.md`, `.planning/STATE.md`

### Secondary (MEDIUM confidence)
- Inferred: `IgnoredTicketsPage` data strategy (frontend-only filter) derived from reading `fetch_tickets` command which confirms ticket field data is not stored in SQLite.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are pre-existing in the project, versions confirmed by source files
- Architecture: HIGH — derived from direct source code reading, not assumptions
- Pitfalls: HIGH — derived from actual code behavior (null response body confirmed in audit.rs, height calc confirmed in TicketListPage.tsx)
- Ignored tickets data strategy: HIGH — confirmed by reading triage_db.rs schema (no ticket fields) and fetch_tickets command

**Research date:** 2026-03-23
**Valid until:** N/A — based on source code snapshot, valid as long as codebase does not change
