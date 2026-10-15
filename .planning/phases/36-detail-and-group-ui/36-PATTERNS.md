# Phase 36: Detail and Group UI - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 10 (2 new source, 1 new test, 1 new i18n test, 6 modified)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/tickets/useTriageDetailActions.ts` (new) | hook | event-driven (click -> action -> store -> focus effect) | handlers in `TicketDetailPage.tsx` L49-69 + focus effect in `TicketDetailPanel.tsx` L123-128; `pendingFocusRef` in `groups/GroupViewPage.tsx` L141-144 | role-match |
| `src/features/tickets/RememberedLinkHint.tsx` (new) | component | request-response (store read -> render) | linked-key chip `groups/GroupViewPage.tsx` L174-178; muted span L116 | role-match |
| `src/features/tickets/TicketDetailPage.tsx` (mod) | component | request-response | itself (L221-310 button row) | exact |
| `src/features/tickets/TicketDetailPanel.tsx` (mod) | component | request-response | itself (L216-350 status row) | exact |
| `src/features/tickets/IgnoredTicketsPage.tsx` (mod) | component | request-response | itself, `actionSlot` L110-128 | exact |
| `src/features/groups/GroupViewPage.tsx` (mod) | component | request-response | itself, `actionSlot` L150-180 | exact |
| `src/i18n/locales/en.json`, `sk.json` (mod) | config | transform | existing `detail.ignore*` keys, L105-113 | exact |
| `src/features/tickets/TicketDetailPanel.test.tsx` (mod) | test | request-response | itself, L162-219 | exact |
| `src/features/tickets/__tests__/TicketDetailPage.test.tsx` (mod) | test | request-response | `TicketDetailPanel.test.tsx` L162-219 | role-match |
| `src/features/tickets/__tests__/RememberedLinkHint.test.tsx` (new) | test | request-response | `TicketDetailPanel.test.tsx` (store seeding via `setState`) | role-match |
| `src/i18n/__tests__/detailLocale.test.ts` (new) | test | transform | `src/i18n/__tests__/groupLocale.test.ts` L66-85 | exact |

## Pattern Assignments

### `src/features/tickets/useTriageDetailActions.ts` (hook, event-driven)

**Analog:** `TicketDetailPage.tsx` handlers + `triageActions.ts` contract.

**Imports / handler pattern** (`TicketDetailPage.tsx` L49-69; keep `useCallback`, call only `triageActions`):
```tsx
const handleIgnore = useCallback(() => {
  void denyTicket(issueKey);
}, [issueKey]);
const handleUnignore = useCallback(() => {
  void restoreTicket(issueKey);
}, [issueKey]);
```
Phase 36 change: handlers become `async`, set `pendingFocus.current` first, and clear it on `false` (`denyTicket` returns `Promise<boolean>`). For link, use the `LinkResult` return:
```ts
// triageActions.ts L93, L99
export type LinkResult = 'relinked' | 'needs-copy' | 'failed';
export async function linkTicket(issueKey: string, detail?: JiraTicketDetail): Promise<LinkResult>
```
`linkTicket` itself writes `{state:'copied', copiedKey}` and calls `useCopyStore.startPreview` on `needs-copy`. Never call `invoke('set_triage_state')` inline.

**Store selector (stable ref)** (`TicketDetailPage.tsx` L41-44):
```tsx
const triageEntry = useTicketStore((s) => s.triageMap[issueKey]);
const isCopied = triageEntry?.state === 'copied';
const isIgnored = triageEntry?.state === 'ignored';
```
Never `?? []` in a selector.

**Focus pattern** (existing precedent, `TicketDetailPanel.tsx` L123-128; do not steal this on mount):
```tsx
useEffect(() => {
  if (detail && closeButtonRef.current) closeButtonRef.current.focus();
}, [detail]);
```
Pending-focus-ref precedent: `GroupViewPage.tsx` L141-144 (`pendingFocusRef.current = {...}; const ok = await ...; if (!ok) pendingFocusRef.current = null;`). Combine with the RESEARCH.md Pattern 2 sketch (prevState ref + pendingFocus ref, effect keyed on `triageEntry?.state`). No timeouts, no `autoFocus`.

**Double-submit guard:** local `linking` state, set before `await linkTicket`, reset in `finally`; disable the Restore-link button. For `needs-copy` the existing Page uses `disabled={copyPhase === 'loading_preview'}` (L229).

---

### `src/features/tickets/RememberedLinkHint.tsx` (component)

**Analog:** `GroupViewPage.tsx` L116 and L174-178.

Muted span precedent:
```tsx
<span className="text-xs text-brand-text-secondary">{t('groups.missing.hint')}</span>
```
Chip precedent: `<Badge variant="outline" className="text-xs font-mono">{entry.copiedKey}</Badge>`.

Gate exactly (Pitfall 4: `seen`/`handled` keep stale `copiedKey`): `entry?.state === 'ignored' && entry.copiedKey`. Use literal key `t('detail.previouslyLinked', { key: entry.copiedKey })` (noLiteralStrings guard). Detail variant `<p className="text-xs text-brand-muted mt-1">`; row variant `<span className="text-xs text-brand-text-secondary whitespace-nowrap">`. Plain interpolation, no `Trans`/`dangerouslySetInnerHTML`. Full sketch: RESEARCH.md "Hint component".

---

### `src/features/tickets/TicketDetailPage.tsx` (modify; shadcn `Button`)

**Analog:** itself. Edit points:

- Linked branch L239-254: add Deny after the Cloud-key button, same neutral style as Ignore (L283):
```tsx
<Button variant="outline" size="sm" onClick={handleOpenInCloudJira}>...</Button>
// add: <Tooltip><TooltipTrigger asChild><Button variant="secondary" size="lg" onClick={handleDeny}>{t('detail.deny')}</Button></TooltipTrigger><TooltipContent aria-hidden="true">...
```
- Denied branch L268-278 (the `detail.ignored` toggle) is replaced by primary `Button variant="default" size="lg"` (Restore link to KEY when `copiedKey`, else `detail.copy` wording per L234-236) plus `Button variant="secondary" size="lg"` `t('ignored.restore')`. Tooltip wrapper pattern is the same as L269-277:
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="secondary" size="lg" onClick={handleUnignore}>
      {t('detail.ignored')}
    </Button>
  </TooltipTrigger>
  <TooltipContent aria-hidden="true">{t('detail.ignored.tooltip')}</TooltipContent>
</Tooltip>
```
- Hint goes under the button row (after L310, before `copyError` L312).
- Refs: Button supports ref forwarding (verify); status badge span L242 gets `tabIndex={-1}` plus ref; fallback for "seen" target is Dismiss button, then back button (L189).
- Keep `Open in Jira` last for non-linked (L303-306).
- Group view reaches this via `selectTicket(key)`; no group-specific change (RLNK-04).

---

### `src/features/tickets/TicketDetailPanel.tsx` (modify; raw `<button>` Tailwind)

**Analog:** itself. Use the Panel's own class strings, not Button variants.

Neutral outlined class (L262, L277, L293, L307):
```tsx
className="px-3 py-1 rounded text-sm font-semibold text-brand-muted border border-brand-border hover:text-brand-text hover:border-brand-text transition-colors"
```
Primary class (L323): `px-3 py-1 rounded text-sm font-semibold text-white bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`.

Edit points: Linked fragment L218-245 (add Deny after the Cloud-key button L237-244; status badge L221 gets ref + `tabIndex={-1}`); `isIgnored` branch L271-285 replaced with Restore button (`ignored.restore`); the primary-copy block L318-348 currently excludes `isIgnored` (`isCopied || isIgnored || isHandled ? null`) and must now render for `isIgnored` using the Restore-link label/handler. Hint after the row (near L351 `copyError`). Existing `closeButtonRef` (L33) is the fallback focus target. Handlers L54-68 move into the shared hook.

---

### `src/features/tickets/IgnoredTicketsPage.tsx` (modify)

**Analog:** itself, `actionSlot` L110-128. Insert before the Restore button (L117):
```tsx
<div className="flex items-center gap-2">
  {triageMap[ticket.key]?.state === 'handled' && (<span ...>{t('tickets.card.handledBadge')}</span>)}
  {/* add */ }<RememberedLinkHint variant="row" entry={triageMap[ticket.key]} />
  <button type="button" onClick={(e) => { e.stopPropagation(); restoreTicket(ticket.key); }} ...>
```
Keep `e.stopPropagation()`. No new row buttons (D-06).

---

### `src/features/groups/GroupViewPage.tsx` (modify)

**Analog:** itself, L155-173. Insert inside the `badge === 'nav.notMine'` fragment before the Restore button (L162); `entry` is already in scope (L101):
```tsx
{badge === 'nav.notMine' && (
  <>
    {entry?.state === 'handled' && (...)}
    {/* add: <RememberedLinkHint variant="row" entry={entry} /> */}
    <button ... onClick={(e) => { e.stopPropagation(); restoreTicket(ticket.key); }}>
```
This directory is scanned by `noLiteralStrings.test.ts`: only literal `t('...')` keys; the hint component lives in `tickets/` so its own call is not scanned, but use the same rule. Re-run `groups/__tests__/a11y.axe.test.tsx`.

---

### `src/i18n/locales/en.json` and `sk.json` (modify)

**Analog:** existing flat dotted keys (en.json L105-113, sk.json L105-113), e.g.:
```json
"detail.ignore": "Dismiss",
"detail.ignore.tooltip": "Move this ticket to the Dismissed tab — you can restore it anytime",
"detail.ignored": "Ignored",
```
SK: `"detail.ignore": "Zamietnuť"`, uses "tiket". Add flat (never nested) in both files in the same commit: `detail.deny`, `detail.deny.tooltip` ({{tab}}, {{key}}), `detail.restoreLink` ({{key}}), `detail.restoreLink.tooltip` ({{key}}), `detail.previouslyLinked` ({{key}}); values in RESEARCH.md "Locale entries". Existing `detail.ignored*` may become unused; check for other references before deleting (translations.test requires identical key sets). Tooltip `{{tab}}` is `t('nav.notMine')`.

---

### `src/features/tickets/TicketDetailPanel.test.tsx` (modify)

**Analog:** itself L162-219. Seeding pattern:
```tsx
const seed = (state: 'seen' | 'ignored' | 'handled') => {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'fetch_ticket_detail') return Promise.resolve(mockDetail as never);
    return Promise.resolve(undefined as never);
  });
  useTicketStore.setState({ triageMap: { 'PROJ-1': { state, copiedKey: 'CLD-9' } } });
};
```
Must change L211 `{ name: /^ignored$/i }` to `{ name: /^restore$/i }` (anchored so it does not match "Restore link to CLD-9"). Extend with: Deny on `copied` seed calls `set_triage_state` ignored and no `relink_ticket`; denied+CLD-9 shows "Restore link to CLD-9" and hint text; `document.activeElement` assertions (Link after Deny, rollback returns to Deny by making `set_triage_state` reject); `relink_ticket` returning null starts preview; reject shows failure toast. Mock `invoke` via `vi.mock('@tauri-apps/api/core')` (L6-8). Also grep `__tests__/TicketDetailPage.test.tsx` and `LinkedTicketsPage.test.tsx` for `Ignored`/`detail.ignored` queries (A1).

### `src/features/tickets/__tests__/RememberedLinkHint.test.tsx` (new)
Same render/store-seed approach; assert hint renders only for `ignored` + `copiedKey`, not for `seen`/`handled`/null key.

### `src/i18n/__tests__/detailLocale.test.ts` (new)

**Analog:** `groupLocale.test.ts` L66-85:
```ts
const forbidden = /úloh|záložk|zmaza|vymaza|založ|\bissue\b/i;
for (const k of groupKeys(skMap)) {
  expect(forbidden.test(skMap[k]), `sk.json key "${k}" uses a forbidden term`).toBe(false);
}
```
Copy the file's en/sk map loading (top of that file; read it when implementing), restrict to the 5 new `detail.*` keys, assert no `/úloh/i` in SK and `{{key}}`/`{{tab}}` placeholder sets equal EN.

## Shared Patterns

### Triage mutation
**Source:** `src/features/tickets/triageActions.ts` (`denyTicket` L64, `restoreTicket` L82, `markHandled` L88, `linkTicket` L99).
**Apply to:** both detail components via the shared hook; rows keep `restoreTicket`. No inline `invoke('set_triage_state')`.

### Tooltips are supplementary
**Source:** `TicketDetailPage.tsx` L269-277: `<TooltipContent aria-hidden="true">`. Essential info (remembered key hint) must be visible text.

### i18n guard rules
**Source:** `src/i18n/__tests__/translations.test.ts` (identical key sets, non-empty, SK mostly differs), `groupLocale.test.ts` (forbidden terms apply to `groups.*` only), `noLiteralStrings.test.ts` (scans `src/features/groups` plus TicketCard, TicketFilterBar, TicketListPage, AppShell; literal t() keys only).

### Selector stability
**Source:** `useTicketStore((s) => s.triageMap[issueKey])`. Never return `?? []` from a selector.

### UX constraints (memory)
Explicit labelled buttons only, no hover-revealed icons, no DnD.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (focus-after-action effect) | hook logic | event-driven | No existing post-triage focus management; use RESEARCH.md Pattern 2 sketch, with `GroupViewPage.tsx` `pendingFocusRef` as the nearest style precedent |

## Metadata

**Analog search scope:** `src/features/tickets`, `src/features/groups`, `src/i18n`
**Files scanned:** about 12 read in full or in range
**Pattern extraction date:** 2026-10-15
