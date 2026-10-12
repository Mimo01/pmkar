# Phase 29: Tab Strip & Group View - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 25 (13 new source, 8 modified, 4+ new test files counted below)
**Analogs found:** 24 / 25 (popover.tsx has a sibling analog, not an exact one)

Scope note: includes the Phase 28 review warnings WR-01..WR-04 (user decision after research) and the pill-label decision (reuse `nav.*` values "Dismissed" / "Already Linked"; only `groups.badge.done` is a new pill key).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/ui/popover.tsx` (new) | component (ui primitive) | request-response | `src/components/ui/tooltip.tsx` | role-match |
| `src/components/ui/AppShell.tsx` (mod) | component (shell/nav) | event-driven | itself (lines 75-96) | exact |
| `src/App.tsx` (mod) | provider/orchestrator | event-driven | itself (lines 104, 242-262) | exact |
| `src/features/groups/groupTabs.ts` (new) | utility | transform | `src/features/groups/colors.ts` (pure helpers) | role-match |
| `src/features/groups/GroupTabStrip.tsx` (new) | component | event-driven | `AppShell.tsx` nav + header tooltip buttons | role-match |
| `src/features/groups/GroupTab.tsx` (new, or inline) | component | event-driven | `AppShell.tsx` nav button (lines 81-93) | exact |
| `src/features/groups/CreateGroupPopover.tsx` (new) | component (form) | request-response | `validation.ts` + `groupStore.createGroup`; no form popover exists | partial |
| `src/features/groups/GroupViewPage.tsx` (new) | component (page) | CRUD read + filter | `IgnoredTicketsPage.tsx` / `LinkedTicketsPage.tsx` | exact |
| `src/features/groups/useGroupMembers.ts` (new) | hook | request-response + derived | `selectGroupIdsForIssue` in `groupStore.ts` (null-fallback selector) | partial |
| `src/features/groups/groupBadge.ts` (new) | utility | transform | `ticketListUtils.ts` predicates | exact |
| `src/features/tickets/restoreTicket` extraction (mod `IgnoredTicketsPage.tsx` + `ticketStore.ts` or `ticketListUtils.ts`) | service | CRUD write | `handleRestore` in `IgnoredTicketsPage.tsx` lines 16-22 | exact |
| `src/features/groups/groupStore.ts` (mod, WR-01, WR-02) | store | CRUD / request-response | itself | exact |
| `src/features/groups/validation.ts` (mod, WR-03, WR-04) | utility | transform | itself | exact |
| `src-tauri/src/groups_db.rs` (mod, WR-03, WR-04) | model/service | transform | itself (lines 124-187) | exact |
| `src/test-fixtures/group-vectors.json` (mod) | test fixture | transform | itself | exact |
| `src/i18n/locales/en.json`, `sk.json` (mod) | config | n/a | existing flat dotted keys, `audit.fields.group.count.total_*` for plurals | exact |
| `package.json` (mod) | config | n/a | add `@radix-ui/react-popover` | n/a |
| `src/features/groups/__tests__/GroupViewPage.test.tsx` (new) | test | request-response | `src/features/tickets/IgnoredTicketsPage.test.tsx` | exact |
| `src/features/groups/__tests__/CreateGroupPopover.test.tsx` (new) | test | request-response | `groupStore.test.ts` (invoke mock) + `renderWithI18n` | role-match |
| `src/features/groups/__tests__/GroupTabStrip.test.tsx` (new) | test | event-driven | `src/components/ui/__tests__/` (check) + `renderWithI18n` | role-match |
| `src/features/groups/__tests__/groupBadge.test.ts`, `groupTabs.test.ts` (new) | test | transform | `src/features/tickets/__tests__/ticketListUtils.test.ts` | exact |
| `src/features/groups/__tests__/groupStore.test.ts` (mod) | test | request-response | itself | exact |
| `src/features/groups/__tests__/validation.test.ts` (mod) | test | transform | itself (vector-driven) | exact |

## Pattern Assignments

### `src/components/ui/popover.tsx` (component, request-response)

**Analog:** `src/components/ui/tooltip.tsx` (lines 1-28). Copy structure exactly: namespace import, `cn` from `@/lib/utils`, forwardRef content, displayName, named export list.

```typescript
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn('z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out ...', className)}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
```
Adapt: `PopoverPrimitive.Root/Trigger/Anchor`, wrap Content in `PopoverPrimitive.Portal`, default `align='end'`, `sideOffset=4`, classes `z-50 w-70 rounded-md border border-brand-border bg-popover p-4 text-popover-foreground shadow-md outline-none` plus the same animate-in/out classes. Run `npm install @radix-ui/react-popover` first.

---

### `src/components/ui/AppShell.tsx` (component, event-driven) - modify

**Analog:** itself. Current nav (lines 75-96) and prop types (lines 6-12, 23-27).

Props to widen (lines 9-10): `activeTab?: string; onTabChange?: (tab: string) => void;` (use `TabId` from `groupTabs.ts`). Keep `NAV_TABS` typed with `CoreTab`.

Core tab button classes to copy verbatim for group tabs (lines 81-93):
```tsx
<button
  key={tab.id}
  type="button"
  onClick={() => onTabChange(tab.id)}
  className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
    activeTab === tab.id
      ? 'text-brand-text font-semibold border-brand'
      : 'text-brand-muted font-normal hover:text-brand-text border-transparent'
  }`}
  aria-current={activeTab === tab.id ? 'page' : undefined}
>
```
Integration: inside the existing `<nav className="flex px-4 bg-brand-surface border-b border-brand-border" aria-label="Main navigation">`, after the `NAV_TABS.map(...)`, render `<GroupTabStrip activeTab={activeTab} onTabChange={onTabChange} />` (it renders divider + scroll section + `＋`). The nav only renders when `onTabChange` is passed, so the many other `<AppShell>` usages in App.tsx (lines 169, 182, 206, 219) are unaffected. Tooltip provider: header uses `<TooltipProvider delayDuration={300}>` (line 38) only around header icons; wrap the nav content in its own `TooltipProvider delayDuration={300}`.

Icon button class to copy for `＋` and arrows (lines 46, 61):
`flex items-center justify-center w-7 h-7 text-brand-muted hover:text-brand-text rounded transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` with `<Icon className="w-[15px] h-[15px]" aria-hidden="true" />` inside `<Tooltip><TooltipTrigger asChild>...</TooltipTrigger><TooltipContent aria-hidden="true">{label}</TooltipContent></Tooltip>` (lines 40-52).

---

### `src/App.tsx` (orchestrator) - modify

**Analog:** itself.

State (line 104): `const [currentTab, setCurrentTab] = useState<'new' | 'not-mine' | 'linked'>('new');` becomes `useState<TabId>('new')`.

Name collision warning: line 45 already has `const [hydrated, setHydrated] = useState(false);` and line 154 has `if (!hydrated) {` early return. Group selectors/effect must sit above that early return (rules of hooks) and be named `groupsHydrated`:
```tsx
const groupsHydrated = useGroupStore((s) => s.hydrated);
const groups = useGroupStore((s) => s.groups);
```
Existing group hydrate effect for reference (lines 81-87):
```tsx
if (!hydrated) return;
useGroupStore.getState().hydrate()...
}, [hydrated]);
```
(IN-07 says `.catch(() => {})` there is dead code; may drop while touching.)

Render switch (lines 259-262) to extend:
```tsx
{currentTab === 'new' && <TicketListPage />}
{currentTab === 'not-mine' && <IgnoredTicketsPage />}
{currentTab === 'linked' && <LinkedTicketsPage />}
{activeGroupExists && activeGroupId !== null && <GroupViewPage key={activeGroupId} groupId={activeGroupId} />}
```
`onTabChange={setCurrentTab}` (line 250) needs a `(tab: string) => void` compatible type; type `onTabChange` as `(tab: TabId) => void` end to end.

Fallback: effect gated on `groupsHydrated`; also derive `activeGroupExists` in render (see RESEARCH Pitfall 3 and the code example). Do not fall back while `hydrateError` is set after the WR-02 fix (keep last good groups, so no bounce).

---

### `src/features/groups/groupTabs.ts` (utility, transform)

**Analog:** `src/features/groups/colors.ts` (pure exported helpers, e.g. lines 40-46):
```typescript
export function isGroupColorToken(value: unknown): value is GroupColorToken {
  return typeof value === 'string' && (GROUP_COLOR_TOKENS as readonly string[]).includes(value);
}
export function groupColorVar(token: GroupColorToken): string {
  return `var(--color-group-${token})`;
}
```
Content: `CoreTab`, `TabId`, `groupTabId`, `parseGroupTabId` (see RESEARCH "Tab id helpers"), plus pure `computeOverflow({scrollLeft, clientWidth, scrollWidth})` if not in the strip file. Test with a plain `.test.ts` like `ticketListUtils.test.ts`.

---

### `src/features/groups/GroupTabStrip.tsx` and `GroupTab.tsx` (component, event-driven)

**Analog:** `AppShell.tsx` nav button (above) for tab styling and `aria-current`; header icon buttons for `＋`/arrows with tooltip.

Store reading pattern (stable selector; select `groups`, derive in `useMemo`):
```tsx
const groups = useGroupStore((s) => s.groups);
```
Color dot: `style={{ backgroundColor: groupColorVar(group.color) }}` from `colors.ts` line 44, `aria-hidden`, `w-2 h-2 rounded-full`.

Accessible name via plural (flat keys, copy shape of `audit.fields.group.count.total*` in `en.json` lines 305-308, which defines the bare key plus `_one`, `_few`, `_other`; sk.json lines 306-307 show `_one`/`_few`; add `_many` too):
```json
"audit.fields.group.count.total": "{{count}} fields",
"audit.fields.group.count.total_one": "{{count}} field",
"audit.fields.group.count.total_few": "{{count}} fields",
"audit.fields.group.count.total_other": "{{count}} fields",
```
Use `t('groups.tab.aria', { name, count })`. Define the bare key plus `_one/_few/_many/_other` in BOTH locales (parity test compares raw key names).

Tooltip around name: `Tooltip/TooltipTrigger asChild/TooltipContent aria-hidden="true"` as in AppShell lines 40-52. Scroll/wheel/ResizeObserver/scrollIntoView guidance: RESEARCH Pattern 5 (guard `typeof ResizeObserver`, `scrollIntoView?.()`, `window.matchMedia?.`; non-passive native wheel listener).

No existing horizontal scroll component to copy; `scroll-area.tsx` exists but RESEARCH says use native `overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.

---

### `src/features/groups/CreateGroupPopover.tsx` (component, request-response)

**Analogs:** `validation.ts` (live validation API), `groupStore.ts` `createGroup` (submit), `AppShell.tsx` icon button (trigger), `tooltip.tsx`-style popover.

Validation call (use existing signature, `validation.ts` lines 39-51, returns `{ok:true, display, key} | {ok:false, code}`):
```tsx
const v = useMemo(() => validateGroupName(name, groups.map((g) => g.name)), [name, groups]);
```
Submit (store API, `groupStore.ts` line 113, awaits `hydrate()` before returning, line 65):
```tsx
const r = await useGroupStore.getState().createGroup(v.display);
if (r.ok) { setOpen(false); onCreated(r.value.id); } else { setSubmitError(r.code); }
```
Error code type: `GroupErrorCode` from `./types`; map `duplicate | reserved | too_long | no_scope` to `groups.error.*` keys and everything else (including `internal`) to `groups.error.internal`. Show message only for `duplicate|reserved|too_long` from live validation (`empty` silent). Error line: `role="alert"`, `AlertCircle` 12px, `text-destructive`, `aria-describedby`/`aria-invalid` on the input. Wrap input and buttons in `<form onSubmit>`, Cancel `type="button"`. Button component exists: `src/components/ui/button.tsx`.

Focus handling after success: see RESEARCH Pattern 6 (`onCloseAutoFocus` preventDefault on success, then focus new tab).

---

### `src/features/groups/GroupViewPage.tsx` (page, read + filter)

**Analog:** `src/features/tickets/IgnoredTicketsPage.tsx` (primary) and `LinkedTicketsPage.tsx`.

Imports and state pattern (IgnoredTicketsPage lines 1-14, 24-45):
```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketCard } from '../tickets/TicketCard';
import { TicketFilterBar } from '../tickets/TicketFilterBar';
import { filterTickets, type SortDirection, sortTickets, type TicketSortField } from '../tickets/ticketListUtils';
import { useTicketStore } from '../tickets/ticketStore';

const [searchText, setSearchText] = useState('');
const [assigneeFilter, setAssigneeFilter] = useState('');
const [sortField, setSortField] = useState<TicketSortField>('updated');
const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
const triageMap = useTicketStore((s) => s.triageMap);

const sorted = useMemo(
  () => sortTickets(filterTickets(members, searchText, assigneeFilter), sortField, sortDirection),
  [members, searchText, assigneeFilter, sortField, sortDirection],
);
```
Layout (lines 51-72, 90-121): `<div className="flex-1 flex flex-col overflow-hidden">`, `<TicketFilterBar ... resultCount={sorted.length} />` with `onToggleSort={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}`, empty block, then `<div className="flex-1 overflow-y-auto">` mapping `TicketCard`. Do NOT copy the dismissed info card (lines 74-88).

Empty state block to copy (lines 67-72), swapping keys to `groups.empty.heading` / `groups.empty.body`:
```tsx
<div className="flex flex-col items-center justify-center flex-1 py-16">
  <p className="text-sm font-semibold text-brand-text mb-1">{t('ignored.empty.heading')}</p>
  <p className="text-xs text-brand-muted text-center max-w-sm">{t('ignored.empty.body')}</p>
</div>
```
Empty condition must be `keys !== null && keys.length === 0` (after hydration), not `members.length === 0`; use `SkeletonCards` (exported from `TicketCard.tsx` line 97) while keys exist but snapshots are not yet loaded. Filtered-to-zero: `TicketFilterBar` already receives `resultCount`; the existing pages show nothing extra, match that.

Action slot per badge (compose pill first, then Handled badge + Restore or copied key). Restore button markup (Ignored lines 99-117):
```tsx
actionSlot={
  <div className="flex items-center gap-2">
    {triageMap[ticket.key]?.state === 'handled' && (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-semibold">
        {t('tickets.card.handledBadge')}
      </span>
    )}
    <button type="button" onClick={(e) => { e.stopPropagation(); handleRestore(ticket.key); }}
      className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150">
      {t('ignored.restore')}
    </button>
  </div>
}
```
Linked copied-key badge (LinkedTicketsPage lines 70-76):
```tsx
triageMap[ticket.key]?.copiedKey ? (
  <Badge variant="outline" className="text-xs font-mono">{triageMap[ticket.key].copiedKey}</Badge>
) : undefined
```
(`import { Badge } from '@/components/ui/badge'`.) Open detail: `useTicketStore.getState().selectTicket(key)` (Ignored line 47-49).

Pill: neutral per UI-SPEC: `text-xs px-1.5 py-0.5 rounded border border-brand-border-subtle bg-brand-surface-hover text-brand-text-secondary` (12px, weight 400; do not use `text-[10px]`).

Finding (resolves RESEARCH A4/Open Question 2): `TicketCard` destructures only `{ ticket, onClick, actionSlot }` (line 23) and ignores `triageEntry`; `TriageIndicator.tsx` is imported by NO production file (only its own test). So no red dot is rendered on any card today, and nothing needs to be reproduced for New-state cards. Passing `triageEntry={triageMap[ticket.key]}` for parity with the other pages is harmless.

Also note: sort/filter use unguarded `fields.priority.id`, `fields.status.name`; `TicketCard` dereferences `ticket.fields.status.name` and `priority.name` (lines 80-82). Snapshot shape-guard in `useGroupMembers` is required.

---

### `src/features/groups/useGroupMembers.ts` (hook)

**Analog:** `selectGroupIdsForIssue` in `groupStore.ts` lines 137-140 (null fallback selector, rule from phase 28 D-22):
```typescript
export const selectGroupIdsForIssue =
  (issueKey: string) =>
  (s: GroupState): number[] | null =>
    s.groupIdsByIssue[issueKey] ?? null;
```
Use `useGroupStore((s) => s.memberKeysByGroup[groupId] ?? null)`. Snapshot loading calls `useGroupStore.getState().getGroupMembers(groupId)` (lines 126-133; returns `GroupResult<GroupMember[]>` with `ticketJson` string). Full sketch: RESEARCH Pattern 2 (with shape guard and cancel flag).

---

### `src/features/groups/groupBadge.ts` (utility, transform)

**Analog:** `src/features/tickets/ticketListUtils.ts` lines 13-42 (predicates take `(ticket: JiraTicket, triageMap: Record<string, TriageEntry>)`). Import them; fall through to Done:
```typescript
import { isLinkedCandidate, isNewCandidate, isNotMineCandidate } from '../tickets/ticketListUtils';
import type { JiraTicket, TriageEntry } from '../tickets/types';
// returns 'nav.new' | 'nav.notMine' | 'nav.linked' | 'groups.badge.done'
```
Locale values: `nav.new` "New", `nav.notMine` "Dismissed", `nav.linked` "Already Linked" (en.json lines 4-6); this matches the user decision to reuse them. Only `groups.badge.done` is new. Test analog: `__tests__/ticketListUtils.test.ts` (matrix over states x done).

---

### Restore extraction (modify `IgnoredTicketsPage.tsx`, add shared export)

**Analog / source:** `IgnoredTicketsPage.tsx` lines 16-22 (module-private today):
```typescript
function handleRestore(issueKey: string) {
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: { state: 'seen', copiedKey: null },
  });
}
```
Move to an exported `restoreTicket(issueKey)` (e.g. `src/features/tickets/triageActions.ts`; avoid putting `invoke` in `ticketListUtils.ts`, which is pure) and import in both pages. Keep semantics unchanged; `IgnoredTicketsPage.test.tsx` mocks `@tauri-apps/api/core` `invoke` and must still pass.

---

### `src/features/groups/groupStore.ts` - WR-01 and WR-02 fixes (store)

**Analog:** itself, lines 84-111 (`hydrate`), 55-67 (`mutate`), 37-52 (`GroupState`).

WR-01: add a module-level or closure `let hydrateSeq = 0;` inside the `create((set, get) => { ... })` factory (next to `mutate`, line 55). In `hydrate`: `const seq = ++hydrateSeq;`, and after the `await Promise.all` (line 89) and in the `catch` return early `if (seq !== hydrateSeq) return;`. Fix from 28-REVIEW:
```ts
let hydrateSeq = 0;
hydrate: async () => {
  const seq = ++hydrateSeq;
  try {
    const [rawGroups, rawMemberships] = await Promise.all([...]);
    if (seq !== hydrateSeq) return;
    ...
    set({ groups, memberKeysByGroup, groupIdsByIssue, hydrated: true });
  } catch {
    if (seq !== hydrateSeq) return;
    ...
  }
}
```
WR-02: add `hydrateError: boolean` to `GroupState` (initial `false`), set `false` on success, and replace the catch body (line 109) with `set({ hydrated: true, hydrateError: true })` keeping previous groups/indexes. Existing mutation flow (`mutate` lines 59-66) stays; optionally surface `hydrateError`.

Existing test that MUST be updated (groupStore.test.ts lines 60-67, "hydrate swallows rejection" expects `groups` toEqual `[]`): with prior state non-empty, it should now assert groups are retained and `hydrateError === true`. Add tests: out-of-order hydrates (resolve first call after second; assert second wins), and torn-state guard. Test mock helpers to reuse: `mockLists(groups, memberships)` (lines 21-27) and the `beforeEach` reset (lines 29-40), plus `invokeMock` pattern at top of file.

WR-02 also unblocks the App.tsx fallback: do not bounce to New while `hydrateError`.

---

### `src/features/groups/validation.ts` - WR-03 and WR-04 fixes (utility)

**Analog:** itself, lines 11-17 and 39-51.

Current:
```typescript
export function normalizeGroupName(raw: string): string {
  return raw.trim().normalize('NFC');
}
export function groupNameKey(display: string): string {
  return display.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC').toLowerCase();
}
```
WR-03 fix (from 28-REVIEW): trim the same set as Rust:
```ts
return raw.replace(/^[\s\u0085\uFEFF]+|[\s\u0085\uFEFF]+$/gu, '').normalize('NFC');
```
WR-04 fix: in `groupNameKey` strip format chars (`\p{Cf}`, at least U+200B..U+200F, U+2060..U+2064, U+00AD, U+FEFF) in addition to marks; in `validateGroupName` (after computing `key`, line 46) return `{ ok: false, code: 'empty' }` when `key.length === 0`. Note `\p{Cf}` already covers U+FEFF, U+200B-200F, U+2060-2064, U+00AD, so the Rust list must match whichever set is chosen; the TS and Rust sets must be identical and covered by vectors. Be careful: stripping `\p{Cf}` from the key also affects ZWJ inside emoji sequences; acceptable for the key only (display is untouched).

Test pattern: vector-driven (`validation.test.ts` lines 6-17) iterates `vectors.names`, so adding rows to the JSON auto-tests both sides.

---

### `src-tauri/src/groups_db.rs` - WR-03 and WR-04 fixes (Rust)

**Analog:** itself, lines 124-127 and 129-134, 168-187.

Current:
```rust
pub fn normalize_group_name(raw: &str) -> String {
    raw.trim().nfc().collect()
}
pub fn group_name_key(display: &str) -> String {
    let stripped: String = display.nfd().filter(|c| !is_combining_mark(*c)).collect();
    stripped.nfc().collect::<String>().to_lowercase()
}
```
Fixes (from 28-REVIEW):
```rust
pub fn normalize_group_name(raw: &str) -> String {
    raw.trim_matches(|c: char| c.is_whitespace() || c == '\u{FEFF}').nfc().collect()
}
// in group_name_key, also filter format chars:
.filter(|c| !is_combining_mark(*c) && !matches!(*c, '\u{200B}'..='\u{200F}' | '\u{2060}'..='\u{2064}' | '\u{00AD}' | '\u{FEFF}'))
```
In `validate_group_name` (lines 168-187), after `let key = group_name_key(&display);` add `if key.is_empty() { return Err(GroupErrorCode::Empty); }`. Keep precedence: empty, too long, reserved, duplicate. Note: Rust `is_whitespace` is White_Space (includes U+0085), JS `\s` does not include U+0085 (hence the explicit `\u0085` in the TS regex); verify the trim sets are equal with vectors.

Shared vector test (groups_db.rs line 688 `shared_vectors_match`) already loops `vec["names"]` and compares display/key/error, so new JSON rows test Rust automatically: `cargo test shared_vectors_match`.

---

### `src/test-fixtures/group-vectors.json` (fixture)

Row shape to copy (see `names` entries):
```json
{ "input": "  Úlohy  ", "existing": [], "display": "Úlohy", "key": "ulohy", "error": null }
{ "input": "   ", "existing": [], "display": null, "key": null, "error": "empty" }
```
Add rows: `"\uFEFF"` -> empty; `"\uFEFFTeam"` with existing `["Team"]` -> duplicate; `"Team\u0085"` with existing `["Team"]` -> duplicate; `"\u200B"` -> empty; `"Team\u200B"` with existing `["Team"]` -> duplicate; a valid name containing ZWJ emoji still ok (document expected key). Note `validation.test.ts` line 32-35 asserts `RESERVED_NAME_KEYS.size` is 6; do not add reserved names.

---

### `src/i18n/locales/en.json` and `sk.json` (config)

**Analog:** existing flat dotted keys (e.g. `"ignored.empty.heading"`, `"ignored.empty.body"`, `"ignored.restore"` at en.json lines 176, 271-272). `src/i18n/__tests__/translations.test.ts` requires identical key sets and >=80% differing SK values.

New keys under `groups.*` (copy text from UI-SPEC Copywriting Contract): `groups.new` (title/tooltip/aria), `groups.create`, `groups.cancel`, `groups.name.label`/placeholder, `groups.scrollLeft`, `groups.scrollRight`, `groups.tab.aria` + `_one/_few/_many/_other`, `groups.error.duplicate|reserved|tooLong|noScope|internal`, `groups.empty.heading`, `groups.empty.body`, `groups.badge.done`. Per user decision: do NOT add new pill keys for New / Not mine / Linked; reuse `nav.new`, `nav.notMine`, `nav.linked`. Reminder (UI-SPEC copy table says "Not mine"/"Linked" but locale values are "Dismissed"/"Already Linked"; user confirmed reuse of nav values).

---

### Tests: `GroupViewPage.test.tsx` (new)

**Analog:** `src/features/tickets/IgnoredTicketsPage.test.tsx` (lines 1-80).
```tsx
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);
// fixtures: full JiraTicket objects (id, key, fields{summary,status,priority,assignee,created,updated})
function setupStore(tickets = [...], triageMap = {...}) { useTicketStore.setState({ tickets, triageMap }); }
beforeEach(() => { mockInvoke.mockReset(); mockInvoke.mockResolvedValue(undefined); setupStore(); });
```
For group tests also seed `useGroupStore.setState({ groups, memberKeysByGroup, hydrated: true })` and make `mockInvoke` handle `get_group_members` returning `[{ issueKey, ticketJson, addedAt }]` (see `mockLists` in `groupStore.test.ts` lines 21-27 for the `mockImplementation(async (cmd) => ...)` style). Use `renderWithI18n` from `src/test-utils/renderWithI18n.tsx` when asserting text via i18n (the Ignored test uses plain `render` because `src/test-setup.ts` already imports `./i18n/index`). Include: missing-group-entry render (selector loop guard), snapshot-only member, Done pill, Restore flips pill, remount resets filters.

### Tests: `CreateGroupPopover.test.tsx`, `GroupTabStrip.test.tsx`

**Analogs:** `groupStore.test.ts` header (lines 1-40: `invokeMock` + `vi.mock` + reset of `useGroupStore.setState({...initial, ...})`) and `renderWithI18n`. jsdom has no `ResizeObserver`, `scrollIntoView`, `matchMedia` (and `src/test-setup.ts` stubs none; it only polyfills `crypto`); stub in the specific test files. Use `userEvent` for Radix popover interactions.

## Shared Patterns

### Zustand selector stable reference
**Source:** `src/features/groups/groupStore.ts` lines 137-140. **Apply to:** `useGroupMembers`, `GroupTabStrip`, `GroupViewPage`, App.tsx. Return `null`, never `?? []`, never `.map(...)` inside a selector.

### i18n via `useTranslation`
**Source:** `IgnoredTicketsPage.tsx` lines 3, 25 (`const { t } = useTranslation();`). **Apply to:** all new components. Keys are flat dotted strings.

### Group color dot
**Source:** `src/features/groups/colors.ts` lines 44-46 (`groupColorVar`). **Apply to:** `GroupTab`. Never tint backgrounds or text.

### Typed group results
**Source:** `src/features/groups/types.ts` (`GroupResult<T>`, `GroupErrorCode`) and `toGroupErrorCode` in `groupStore.ts` lines 27-35. **Apply to:** `CreateGroupPopover` error mapping.

### Triage write path
**Source:** `handleRestore` (extract to shared `restoreTicket`). **Apply to:** Ignored page and group view so core tabs and group view update identically via `useTicketStore.triageMap`.

### Tooltip + aria-label icon buttons
**Source:** `AppShell.tsx` lines 38-69. **Apply to:** `＋`, scroll arrows, truncated tab names.

### Brand tokens
Use `text-brand-text`, `text-brand-muted`, `text-brand-text-secondary`, `bg-brand-surface`, `bg-brand-surface-hover`, `border-brand-border`, `border-brand-border-subtle`, `border-brand`, `text-destructive`; focus ring `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`.

### Constraints from memory
No drag and drop; no hover-revealed icons; explicit labelled buttons.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Horizontal scroll strip with fades/arrows (inside `GroupTabStrip.tsx`) | component | event-driven | No existing scroll-overflow tab control; use RESEARCH Pattern 5. |
| Form popover in `CreateGroupPopover.tsx` | component | request-response | No Popover or inline-form popover in `src/components/ui` (Dialog exists in `dialog.tsx` but D-01 forbids a modal); use RESEARCH Pattern 6. |
| Member-resolution hook (live join + async snapshot fallback) | hook | request-response | No existing hook doing live+snapshot merge; use RESEARCH Pattern 2. |

## Metadata

**Analog search scope:** `src/components/ui`, `src/features/groups`, `src/features/tickets`, `src/App.tsx`, `src/i18n/locales`, `src/test-utils`, `src/test-fixtures`, `src-tauri/src/groups_db.rs`, `.planning/phases/28-foundations/28-REVIEW.md`
**Files scanned:** ~25
**Pattern extraction date:** 2026-10-12
