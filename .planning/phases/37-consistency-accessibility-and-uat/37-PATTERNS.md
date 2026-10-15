# Phase 37: Consistency, Accessibility and UAT - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 11 (6 new, 5 modified)
**Analogs found:** 10 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/LiveAnnouncer.tsx` (new) | component + store | event-driven | `src/components/ui/sonner.tsx` (mount shape); Zustand store per `ticketStore.ts` | partial (no live-region component exists) |
| `src/components/__tests__/LiveAnnouncer.test.tsx` (new) | test | event-driven | `src/features/tickets/__tests__/RememberedLinkHint.test.tsx` (RTL component test) | role-match |
| `src/features/tickets/triageActions.ts` (modify) | service | request-response | itself (single writer) | exact |
| `src/features/tickets/__tests__/triageActions.test.ts` (extend) | test | request-response | itself, L1-L120 | exact |
| `src/App.tsx` (modify, 5 sites) | config/shell | n/a | existing `<Toaster />` at L211, 235, 248, 274, 319 | exact |
| `src/features/tickets/__tests__/triageConsistency.test.tsx` (new) | test | transform | `groupBadge.test.ts` + `triageActions.test.ts` + `ticketListParity.test.tsx` | role-match |
| `src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx` (new) | test | request-response | `src/features/groups/__tests__/a11y.keyboard.test.tsx`, `groupDetailTriage.test.tsx` | exact |
| `src/i18n/__tests__/a11yLocale.test.ts` (new) | test | transform | `src/i18n/__tests__/detailLocale.test.ts` | exact |
| `src/i18n/locales/en.json`, `sk.json` (modify) | config | n/a | `triage.*` / `detail.*` keys (L116, L184-188) | exact |
| `useTriageDetailActions.ts` / detail page / panel (modify only if audit finds gaps) | hook | event-driven | itself | exact |
| `.planning/phases/37-.../37-HUMAN-UAT.md` (new), `36-HUMAN-UAT.md` (edit) | doc | n/a | `36-HUMAN-UAT.md` | exact |

## Pattern Assignments

### `src/components/LiveAnnouncer.tsx` (component + Zustand store, event-driven)

**Analog:** `src/components/ui/sonner.tsx` (component placed beside it in App.tsx). No existing app-level live region; use the RESEARCH pattern (`useAnnouncerStore` `{message, nonce}`, `announce()`, `role="status" aria-live="polite" aria-atomic="true" className="sr-only"`, clear-then-set in an effect keyed on `[message, nonce]`).

Existing inline `aria-live` conventions: `TicketListPage.tsx:497,503`, `CopyPreviewPage.tsx:809` (`<p ... aria-live="polite" aria-atomic="true">`).

**Pitfall (project memory):** selectors must return `''`/number, never `?? []`.
Prefer `setTimeout(..., 0)` over rAF for the set step (jsdom-safe).
Import style: relative imports, named exports (see `sonner.tsx` L3-L24: `const Toaster = ...; export { Toaster }`).

---

### `src/features/tickets/triageActions.ts` (service, request-response)

**Analog:** itself. Imports (L1-7) already include `i18n from '../../i18n/index'`, `toast`. Add `import { announce } from '../../components/LiveAnnouncer';`.

**Hook points (existing code to extend):**

`applyState` failure (L33-43), add announce beside toast (do it once here; covers deny/restore/handled failures), and announce success after `await invoke` ok:
```typescript
  try {
    await invoke('set_triage_state', { ticketKey: issueKey, state });
    return { ok: true, prev };
  } catch {
    ...
    toast.error(i18n.t(failKey));
    return { ok: false, prev };
  }
```
`applyState` has no outcome-specific key, so announce success in the callers (`denyTicket` L64-79 after `ok`, regardless of `prev?.copiedKey`; `restoreTicket` L82-85; `markHandled` L88-91) with `if (ok) announce(i18n.t('a11y.*', { key: issueKey }))`.

`undoDeny` (L47-58): success branch after `writeEntry(issueKey, {state:'copied', copiedKey:key})` -> `announce(a11y.undone {key: issueKey, cloudKey: key})`; failure at L57 `toast.error(...)` -> also announce same text.

`linkTicket` (L99-128): after `writeEntry` at L108 (the `'relinked'` branch) -> announce `a11y.linked`; the two `toast.error(i18n.t('triage.linkFailed'))` at L104 and L122 -> also announce. `needs-copy` not announced.

Recommended helper so toast and announce cannot diverge:
```typescript
function notifyError(text: string): void { toast.error(text); announce(text); }
```
Announce strictly after the store write. Use `i18n.t('nav.notMine')` interpolation for the outcome label to avoid "Ignored" vs "Dismissed" drift (leave `triage.denied` unchanged; existing test asserts `'Moved T-1 to Ignored.'`).

---

### `src/App.tsx` (shell, 5 sites)

**Analog:** existing Toaster mounts. Each branch is an early `return` (L204, 217, 241, 254, 281), so one branch renders at a time. Pattern at L209-212:
```tsx
        <UpdateModal open={showUpdateModal} />
        <AboutModal open={showAbout} onOpenChange={setShowAbout} />
        <Toaster />
      </ErrorBoundary>
```
Add `<LiveAnnouncer />` immediately after each `<Toaster />` (L211, 235, 248, 274, 319; import near L7). Guard: a test asserting count of `<Toaster />` equals count of `<LiveAnnouncer />` in App.tsx source.

---

### `src/features/tickets/__tests__/triageActions.test.ts` (extend)

**Analog:** itself. Mock harness (L3-L43): `invokeMock`, `vi.mock('sonner', ...)` with `toast` as function + `.error/.dismiss`, `flush = () => new Promise(r => setTimeout(r,0))`, `seed(state, copiedKey)` via `hydrateTriageMap`. Add `vi.mock('../../../components/LiveAnnouncer', ...)` (spy on `announce`) or read `useAnnouncerStore.getState().message`. Assertion style (L105-117) `expect(toastFn).toHaveBeenCalledWith('Moved T-1 to Ignored.', expect.objectContaining({...}))`. Reset the announcer store in `beforeEach`.

---

### `src/features/tickets/__tests__/triageConsistency.test.tsx` (RQA-01 invariant)

**Analog:** `groupBadge.test.ts` (ticket/triage builders) + `triageActions.test.ts` (mock harness, drive real exports).

Fixture builder (groupBadge.test.ts L5-18):
```typescript
function makeTicket(done: boolean): JiraTicket {
  return { id: 'A-1', key: 'A-1', fields: { summary: 's',
      status: { name: 'Open', statusCategory: { key: done ? 'done' : 'indeterminate' } } } } as unknown as JiraTicket;
}
function triage(state) { return state ? { 'A-1': { state, copiedKey: null } } : {}; }
```
Real derivation to call (do not re-implement): `isNewCandidate/isNotMineCandidate/isLinkedCandidate` (`ticketListUtils.ts` L13-40) and `groupBadgeKey` (`groupBadge.ts` L7-15; order notMine, linked, new, else `groups.badge.done`). Done tickets match zero tabs; non-done exactly one. Do not assert `newCount === newList.length` with done 'new' fixtures (see RESEARCH Pitfall 2).

Driving: `denyTicket`, undo via captured `toastFn.mock.calls[..][1].action.onClick()`, `linkTicket` (`relink_ticket` mock returns key), `restoreTicket`, `markHandled`, plus a rejecting `set_triage_state` case; `await flush()` then `assertInvariant`. Hydrate round trip: snapshot `useTicketStore.getState().triageMap`, reset, `hydrateTriageMap(snapshot)`, re-assert.

---

### `src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx`

**Analog:** `src/features/groups/__tests__/a11y.keyboard.test.tsx` L20-65 (imports/mocks): `renderWithI18n` from `../../../test-utils/renderWithI18n`, `userEvent`, `vi.mock('sonner', ...)`, `invokeMock` pattern, store reset helpers, `mkTicket`. Also see `groupDetailTriage.test.tsx` and `TicketDetailPage.test.tsx` / `useTriageDetailActions.test.tsx` for detail rendering and focus assertions. Optionally `vitest-axe` as in `a11y.axe.test.tsx` L1-5 (`import { axe } from 'vitest-axe'`, run on `document.body`).

Focus behavior under test (`useTriageDetailActions.ts` L55-68, 80-111): deny -> `primaryRef`, link -> `badgeRef ?? denyRef`, restore -> `dismissRef ?? fallbackRef`. Audit item (RESEARCH Pitfall 8): `linking` disables Link button during flight; `handleLink` already guards with `linkingRef` (L93), so `aria-disabled` swap is cheap if focus is lost.

---

### `src/i18n/__tests__/a11yLocale.test.ts`

**Analog:** `src/i18n/__tests__/detailLocale.test.ts` (L1-45). Copy verbatim, replacing `NEW_KEYS` with the `a11y.*` keys:
```typescript
import en from '../locales/en.json'; import sk from '../locales/sk.json';
const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
// tests: exist & non-empty; SK never /úloh/i; SK contains /tiket/i; placeholders match EN/SK
```
Locale files are flat dotted keys (`"triage.denied": "Moved {{key}} to Ignored."`, en.json L184; SK L184 "Tiket {{key}} presunutý do Ignorované."). Add `a11y.denied|undone|linked|restored|handled` to both; each includes `{{key}}`; `linked`/`undone` also `{{cloudKey}}`. Slovak must use "tiket". Also check `translations.test.ts` and `noLiteralStrings.test.ts` stay green.

---

### `37-HUMAN-UAT.md`

**Analog:** `.planning/phases/36-detail-and-group-ui/36-HUMAN-UAT.md` frontmatter and structure:
```
---
status: partial
phase: 37-consistency-accessibility-and-uat
source: [...]
started: / updated:
---
## Current Test
[awaiting human testing]
## Tests
### N. <title>
expected: ...
result: [pending]
## Summary  (total/passed/issues/pending/skipped/blocked)
## Gaps
```
Fold in Phase 36 tests 1 (focus after Deny/Link/Restore) and 2 (tooltips and remembered-link hint EN/SK). Then edit `36-HUMAN-UAT.md` header to `status: superseded` with pointer to Phase 37.

## Shared Patterns

### Single triage writer
**Source:** `src/features/tickets/triageActions.ts` L9-15 (`writeEntry` via `hydrateTriageMap`). Apply to: all announce calls (placed after writes) and all test drivers (invoke real exports only).

### Test mock harness
**Source:** `triageActions.test.ts` L1-43. Apply to: consistency, keyboard and announce tests (`@tauri-apps/api/core` and `sonner` mocked; real stores and utils).

### i18n
**Source:** `i18n from '../../i18n/index'`, `i18n.t(key, {..})`, flat keys in `en.json`/`sk.json`; SK uses "tiket". Apply to: all announcement strings.

### Zustand selector safety
Never `?? []` in a selector; use `''` or `null`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/LiveAnnouncer.tsx` | component | event-driven | No app-level live region or non-feature store under `src/components` (only `ui/`); use RESEARCH pattern |

## Metadata

**Analog search scope:** `src/features/tickets`, `src/features/groups`, `src/components`, `src/i18n`, `src/App.tsx`
**Files scanned:** ~15 read or grepped
**Pattern extraction date:** 2026-10-15
