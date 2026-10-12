# Phase 33: Polish & Verification - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 22 (9 new tests/helpers, 8 modified source, 2 locale, 3 Rust/UAT)
**Analogs found:** 20 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/test-utils/contrast.ts` (new, extracted helpers) | utility | transform | inline helpers in `src/features/groups/__tests__/colors.test.ts` L15-54 | exact (extract) |
| `src/features/groups/__tests__/contrast.test.ts` (new) | test | transform | `src/features/groups/__tests__/colors.test.ts` (`describe('contrast')` L88-103) | exact |
| `src/features/groups/__tests__/colors.test.ts` (modify: import shared helpers) | test | transform | itself | exact |
| `src/i18n/__tests__/groupLocale.test.ts` (new) | test | transform | `src/i18n/__tests__/translations.test.ts` + `src/features/groups/__tests__/groupI18n.test.ts` | exact |
| `src/features/groups/__tests__/groupI18n.test.ts` (modify/extend, update quotes) | test | request-response | itself | exact |
| `src/i18n/__tests__/noLiteralStrings.test.ts` (new, TS AST scan) | test | file-I/O + transform | `colors.test.ts` L1-13 (`readFileSync(resolve(process.cwd(), ...))`) | partial (no AST test exists) |
| `src/features/groups/__tests__/a11y.axe.test.tsx` (new) | test | request-response | `GroupTabStripOverlays.test.tsx`, `GroupPicker.test.tsx`, `GroupTabStrip.test.tsx` | role-match |
| `src/features/groups/__tests__/a11y.keyboard.test.tsx` (new) | test | event-driven | `GroupTabStripOverlays.test.tsx` L171-331, `DetailGroupsRow.test.tsx` L148-191 | exact |
| `src/features/groups/__tests__/groupScale.test.tsx` (new) | test | transform | `GroupTabStrip.test.tsx` L1-80 (`setOverflowMetrics`, scroll mocks) | exact |
| `src/test-setup.ts` (modify: axe matcher) | config | n/a | itself L1-24 | exact |
| `src/features/groups/GroupTabStrip.tsx` (modify: arrows) | component | event-driven | itself L274-277, L348-387 | exact |
| `src/features/groups/GroupTab.tsx` (modify: inactive text token) | component | request-response | itself L97 | exact |
| `src/features/groups/GroupPicker.tsx` (modify: verify scroll-into-view) | component | event-driven | itself L160, L293-297 | exact |
| `src/features/tickets/TicketCard.tsx` (modify: dimming) | component | request-response | itself L50-53, L81, L110 | exact |
| `src/features/groups/GroupViewPage.tsx` (modify: muted text, destructive text) | component | request-response | itself L116, L168, L209, L226, L239 | exact |
| `src/index.css` (modify: new destructive-text/ring tokens) | config | n/a | itself `:root` L5-38, `body.dark` L67-96 | exact |
| `src/i18n/locales/en.json`, `sk.json` (modify) | config | n/a | `groups.*` keys L496-562 | exact |
| `package.json` (devDependency vitest-axe) | config | n/a | n/a | no analog |
| `src-tauri/src/fixtures.rs` (modify: scenario field) | model | CRUD | `FixtureState` L149-162, `build_fixtures` L3115-3125 | role-match |
| `src-tauri/src/mock_server.rs` (modify: scenario-aware search) | controller | request-response | `v2::search_issues` / `make_search_response_paged` L60-95 | role-match |
| `src-tauri/tests/mock_server_scenarios.rs` (new) | test | request-response | `src-tauri/tests/pagination.rs`, `tests/common/mod.rs` | role-match |
| `.planning/phases/33-polish-verification/33-UAT.md` (new) | doc | n/a | `.planning/phases/32-durability/32-UAT.md` | exact |

## Pattern Assignments

### `src/test-utils/contrast.ts` + `src/features/groups/__tests__/contrast.test.ts` (utility/test, transform)

**Analog:** `src/features/groups/__tests__/colors.test.ts`

Move these helpers verbatim into `src/test-utils/contrast.ts` and export them (lines 15-54), then import into both `colors.test.ts` and `contrast.test.ts`.

**CSS block extraction + readVar + contrast** (lines 13-54):
```typescript
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function extractBlock(source: string, opener: RegExp): string {
  const m = opener.exec(source);
  if (!m) throw new Error(`block not found: ${opener}`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}
const themeBlock = extractBlock(css, /@theme\s*\{/);
const rootBlock = extractBlock(css, /:root\s*\{/);
const darkBlock = extractBlock(css, /body\.dark\s*\{/);

function readVar(block: string, name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(block);
  if (!m) throw new Error(`var not found: ${name}`);
  return m[1].toLowerCase();
}
function luminance(hex: string): number { /* L43-48 */ }
function contrast(a: string, b: string): number { /* L50-54 */ }
```

**Theme read convention** (lines 88-93): light `--color-brand-*` tokens live in the `@theme` block (`themeBlock`), dark ones in `body.dark` (`darkBlock`). Group colors live in `:root` (`rootBlock`) because Tailwind v4 tree-shakes `@theme` vars not named literally (see test L164-171). Any NEW token (for example `--color-destructive-text`) referenced via a built-at-runtime name must go in `:root`; one named literally in a class may go in `@theme`. Note `--color-destructive` is at `index.css` L37 (light) and L95 (dark), both `#dc2626`. `readVar` only matches 6-digit hex.

**Per-theme test loop pattern** (L94-102): use `it(\`${name} ...\`)` inside a `for` loop and assert `toBeGreaterThanOrEqual(n)` for each of the four combos (light surface/bg, dark surface/bg).

**New helper needed (no analog):** `mix(fg, bg, opacity)` alpha composite, to assert dimmed content (opacity-70 over card surface) >= 3:1. Document the decision (dimmed = decorative, 3:1 floor, hint/Remove undimmed at 4.5:1) in a comment, per D-04.

**Measured failures that must be written failing-first (from RESEARCH):** dark ring `#c02232` on `#1e1e20` 2.79:1; dark destructive `#dc2626` on `#1e1e20` 3.45:1; `brand-muted` fails 4.5:1 on light; GroupTab inactive uses `text-brand-muted`.

---

### `src/i18n/__tests__/groupLocale.test.ts` (test, transform)

**Analog:** `src/i18n/__tests__/translations.test.ts` (whole file, 36 lines)

**Imports + key-set pattern** (L1-11):
```typescript
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

describe('Translation completeness', () => {
  const enKeys = Object.keys(en).sort();
  const skKeys = Object.keys(sk).sort();
  it('en.json and sk.json have identical key sets', () => {
    expect(enKeys).toEqual(skKeys);
  });
```
Locale files are flat (`"groups.tab.aria_one": ...`), so filter with `Object.keys(sk).filter(k => k.startsWith('groups.'))`. Use per-key messages like `expect(v, \`sk.json key "${k}"\`)` (L19).

**Guards to add** (code sketch in 33-RESEARCH "Code Examples"):
- SK `_many === _other` for every `groups.*` key ending `_other`.
- No `[‘’]` adjacent to `{{name|key|query}}` in either locale; EN uses `“{{x}}”`, SK uses `„{{x}}“`.
- Every count-bearing key has `_one/_few/_many/_other` in both locales (EN key set already carries `_few/_many` copies; do NOT delete them or parity breaks. See en.json L496-500 and L558-562).
- Glossary term spot assertions (skupin, úloh).
- Known fixes: `groups.picker.announceRemoved` SK L553 `Odstránené zo ‘{{name}}’` becomes `Odstránené zo skupiny „{{name}}“`; EN L553 uses `‘{{name}}’`. SK `_many` currently equals the `_few` form at `groups.tab.aria_many` (L499), `groups.chip.moreAria_many` (L561), etc. SK `delete.title` L531 and `move.announce` L540 already use the correct pair (copy that style).

**Existing-test breakage warning:** `groupI18n.test.ts` and component tests assert exact strings, many with `‘…’`. Run `grep -rn "‘\|’" src --include=*.test.*` and update in the same plan as the locale change.

---

### `src/features/groups/__tests__/groupI18n.test.ts` (extend)

**Analog:** itself.

**Plural-test pattern** (L1-24):
```typescript
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n/index';
describe('groups.tab.aria plurals', () => {
  afterEach(async () => { await i18n.changeLanguage('en'); });
  it('sk', async () => {
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 1 })).toBe('Sprint, 1 úloha');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 3 })).toBe('Sprint, 3 úlohy');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 5 })).toBe('Sprint, 5 úloh');
  });
});
```
Also reuse `Intl.PluralRules('sk')` test (L52-57) for zero-case rationale, and the `for (const lng of ['en','sk'])` + `i18n.exists(...)` loop (L72-79) for key existence in both locales.

---

### `src/i18n/__tests__/noLiteralStrings.test.ts` (test, file-I/O + transform)

**Analog (partial):** `colors.test.ts` L1-13 for reading source from `process.cwd()`:
```typescript
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
```
No AST-based test exists. Use the installed `typescript` (^6.0.2) per RESEARCH Pattern 3: `ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)`; flag `JsxText` containing a letter and `JsxAttribute` named `aria-label|title|placeholder|alt` with a string-literal initializer; skip `*.test.tsx`. File list: glob `src/features/groups/*.tsx` (not `__tests__`) plus a hard-coded list of tickets files touched in v0.5.0 (`TicketCard.tsx`, `TicketFilterBar.tsx`, `TicketListPage.tsx`, `TicketDetailPanel.tsx`; confirm with `git log --name-only`). Use `readdirSync` or `import.meta.glob`; the existing tests use `node:fs`.

**Compliant attribute pattern to enforce** (GroupTab.tsx L81-83):
```tsx
aria-label={t('groups.tab.aria', { name: group.name, count: group.memberCount })}
```
**Known allowlisted literals** seen in code: `GroupTab.tsx` `aria-hidden="true"` is not user-facing; `GroupViewPage.tsx` L152 etc. render `{t(badge)}`.

Key-existence companion: regex collect `t\(\s*['"](groups\.[\w.]+)['"]` and `groups.color.${token}` template keys (handle plural suffix by also accepting `key_one/_other`), assert present and non-empty in both JSONs. Dynamic keys: `badge` from `groupBadgeKey` (`groupBadge.ts`) needs special handling.

---

### `src/features/groups/__tests__/a11y.axe.test.tsx` (test, request-response)

**Analog:** `GroupTabStrip.test.tsx` L1-71 (setup/mocks/seed) and `GroupPicker.test.tsx` L1-30.

**Test scaffold to copy** (GroupTabStrip.test.tsx L1-71):
```tsx
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastErrorMock(...a) } }));
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));

import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { GroupTabStrip } from '../GroupTabStrip';
import { useGroupStore } from '../groupStore';

const initial = useGroupStore.getState();
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  Element.prototype.scrollBy = scrollByMock;
});
function seed(groups: unknown[]) {
  useGroupStore.setState({ ...initial, groups: groups as never, memberKeysByGroup: {},
    groupIdsByIssue: {}, hydrated: true, hydrateError: false });
}
beforeEach(() => { invokeMock.mockReset(); invokeMock.mockImplementation(async () => null); seed([]); });
```
Render with `renderWithI18n` (src/test-utils/renderWithI18n.tsx, wraps `I18nextProvider`). Group fixture shape: `{ id, name, color, position, createdAt: 't', memberCount }`. `GroupPicker.test.tsx` L19-30 has `mkGroup`/`mkTicket` helpers for picker states.

**New axe wiring (no analog; per RESEARCH Pattern 1):** `import { axe } from 'vitest-axe'; import * as matchers from 'vitest-axe/matchers'; expect.extend(matchers);` then `await axe(document.body, { rules: { 'color-contrast': { enabled: false } } })`. Use `document.body` (not `container`) for Radix portal states. Put `expect.extend` in `src/test-setup.ts` (follow the guarded-polyfill style at L11-24) or per file. Install gated by human-verify; fallback is direct `axe-core`.

---

### `src/features/groups/__tests__/a11y.keyboard.test.tsx` (test, event-driven)

**Analog:** `GroupTabStripOverlays.test.tsx` (focus-return flows) and `DetailGroupsRow.test.tsx` (chip/picker focus).

**Focus-return assertions** (GroupTabStripOverlays.test.tsx L171, L193, L226, L262-264, L292, L321):
```tsx
await waitFor(() =>
  expect(screen.getByRole('button', { name: 'Group actions for QA' })).toHaveFocus(),
);
...
await user.keyboard('{Escape}');
await waitFor(() => expect(tabButton('Sprint 12')).toHaveFocus());
await waitFor(() => expect(document.querySelector('[data-tab-id="new"]')).toHaveFocus());
await waitFor(() => expect(screen.getByRole('button', { name: 'New group' })).toHaveFocus());
```
Reuse `tabButton(name)` helper from that file (copy, do not import). Chip confirm focus (DetailGroupsRow.test.tsx L174-191): Cancel focused (`cancel`), Esc returns to `x`, after Remove focus is the `Groups` button. Existing Esc coverage to extend rather than duplicate: ChangeColorPopover L140, ConfirmRemovePopover L78-83, DeleteGroupDialog L116, CreateGroupPopover L216/L231. Gaps to add: Select toggle/bar Esc exit, picker Esc, shift+Space range select, tab strip Home/End/Arrow.

---

### `src/features/groups/__tests__/groupScale.test.tsx` (test, transform)

**Analog:** `GroupTabStrip.test.tsx` L30-70

**Geometry stub helper** (L59-70, copy verbatim):
```tsx
function setOverflowMetrics(scrollWidth: number, clientWidth: number, scrollLeft: number) {
  const scroller = screen.getByTestId('group-tab-scroller');
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(scroller, 'scrollLeft', { configurable: true, writable: true, value: scrollLeft });
  return scroller;
}
```
Spy `scrollIntoViewMock` / `scrollByMock` (L30-31, L41-42) and assert calls, not pixels (jsdom has no layout). Truncation asserted by class (`max-w-[160px]`, GroupTab.tsx L99). Picker scale: `GroupPicker.test.tsx` helpers `mkGroup`; arrow-key scrolling assert on `scrollIntoView` with `{ block: 'nearest' }`.

---

### `src/features/groups/GroupTabStrip.tsx` (modify, event-driven)

**Analog:** itself.

**Scroll step to change (80% of viewport)** (L274-277):
```tsx
function scrollByDir(dir: -1 | 1) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  scrollerRef.current?.scrollBy?.({ left: dir * 200, behavior: reduced ? 'auto' : 'smooth' });
}
```
Replace `200` with `Math.round(scrollerRef.current.clientWidth * 0.8)`.

**Conditional arrows (hide-at-ends already implemented)** (L348-367): `{overflow.canScrollLeft && (<> fade div + Tooltip > button ... </>)}` with `aria-label={t('groups.scrollLeft')}`, `ChevronLeft aria-hidden`. Right side L368-387 mirrors. Fades already `pointer-events-none`. Remaining work: focus handoff to the active tab (`tabRefs.current.get(parseGroupTabId(activeTab))?.focus()`) when the focused arrow's `canScroll*` goes false (do it in `updateOverflow` L87-100 before `setOverflow`, check `document.activeElement`); confirm `ARROW_CLASS` is >= 24px (RESEARCH says `w-7 h-7`, fine); arrows are siblings of the scroller (overlay via `absolute`), so core tabs do not shift.

**Active tab scroll into view already exists** (L125-130, L151-160): `tabRefs.current.get(id)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })`. Tests only.

**Live region** (L289-297): `role="status" aria-live="polite" aria-atomic="true" data-testid="group-move-status"`.

---

### `src/features/groups/GroupTab.tsx` (modify)

**Analog:** itself L92-98. Change inactive class from `text-brand-muted` to `text-brand-text-secondary`:
```tsx
active
  ? 'text-brand-text font-semibold'
  : 'text-brand-muted font-normal hover:text-brand-text'
```
Roving tabindex (`tabIndex={active ? 0 : -1}`) at the `moreButton` L63-64 and keyboard `handleKeyDown` (earlier in file, lines 1-60 not read; read before editing). Focus ring class used throughout: `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`. Dark ring fails 3:1, so change the ring color token under `body.dark` (scoped CSS variable, since Tailwind `dark:` is NOT confirmed wired to `body.dark`: `index.css` has no `@custom-variant`; use a CSS variable defined in both `@theme`/`:root` and `body.dark`).

---

### `src/features/groups/GroupPicker.tsx` (modify, verify only)

**Analog:** itself L160 (already implemented):
```tsx
document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' });
```
Arrow handling at L293-297 (`case 'ArrowDown'` / `'ArrowUp'`); list container L354 `className="mt-1 max-h-60 overflow-y-auto"`. Phase task is a test confirming `scrollIntoView` is called on arrow navigation (and honoring reduced motion if desired), not a rewrite.

---

### `src/features/tickets/TicketCard.tsx` and `src/features/groups/GroupViewPage.tsx` (modify)

**Analog:** TicketCard.tsx L50-53, L81, L110:
```tsx
// Opacity on a parent cannot be undone by a child, so dim individual elements only.
const dimClass = dimmed
  ? 'opacity-60 transition-opacity duration-150 motion-reduce:transition-none'
  : '';
...
<span className={cn('text-xs font-mono text-brand-muted', dimClass)}>{ticket.key}</span>
<div className={cn('flex items-center gap-2 text-xs text-brand-muted', dimClass)}>
```
Change `opacity-60` to `opacity-70` and, when `dimmed`, swap `text-brand-muted` for `text-brand-text-secondary` (use `cn(dimmed ? 'text-brand-text-secondary' : 'text-brand-muted')`). Dimming is per element already, so the hint/Remove in `footerSlot` (GroupViewPage.tsx L113-146) are already outside the dim. Hint already `text-xs text-brand-text-secondary` (L116). Replace `text-brand-muted` at GroupViewPage.tsx L168, L209, L226, L239 with `text-brand-text-secondary`. The inline error row (L218) uses `text-destructive`: use the new dark-safe destructive text token. The Remove `Button variant="outline"` (L121-135) and "Remove all" (L277): apply a scoped destructive-text class.

---

### `src/index.css` (modify)

**Analog:** itself. Token layout: light under `@theme` (L5-38: `--color-brand`, `--color-destructive: #dc2626` at L37), dark under `body.dark` (L67-96, `--color-destructive: #dc2626` L95, group palette L101+). Add the scoped tokens in both blocks as 6-digit hex (so `readVar` can read them): for example `--color-destructive-text` (light `#dc2626` or darker if <4.5:1 on `#ffffff`/`#f7f7f8`; dark `#f87171`, measured 6.02:1) and a dark focus-ring token (e.g. `--color-brand-light` `#d4354a` per UI-SPEC; verify >= 3:1 on `#1e1e20` first).

---

### Locale files `src/i18n/locales/en.json` / `sk.json` (modify)

**Analog:** itself, `groups.*` block L496-562. Style reference to copy: SK `groups.delete.title` (L531) `"Odstrániť „{{name}}“?"` and EN `"Delete “{{name}}”?"`. Plural block pattern (SK L496-500):
```json
"groups.tab.aria": "{{name}}, {{count}} úloh",
"groups.tab.aria_one": "{{name}}, {{count}} úloha",
"groups.tab.aria_few": "{{name}}, {{count}} úlohy",
"groups.tab.aria_many": "{{name}}, {{count}} úlohy",   // must become "... úloh" (== _other)
"groups.tab.aria_other": "{{name}}, {{count}} úloh",
```
Flat keys, identical key sets in EN and SK; EN keeps `_few/_many` copies (en.json L496-500).

---

### `src-tauri/src/fixtures.rs` + `src-tauri/src/mock_server.rs` (scenarios; role-match only)

**Important correction vs CONTEXT:** there is no existing scenario selector. "PERS-02/PERS-04" are only comments on fixture data (fixtures.rs L191, L1673, L1816). A new mechanism is required.

**State to extend** (fixtures.rs L149-162, constructed L3115-3125):
```rust
#[derive(Debug, Clone)]
pub struct FixtureState {
    pub server_v2_issues: HashMap<String, JiraIssue>,
    pub cloud_v3_issues: HashMap<String, JiraIssue>,
    pub next_issue_id: u32,
    ...
}
pub type SharedFixtures = Arc<Mutex<FixtureState>>;
...
Arc::new(Mutex::new(FixtureState { server_v2_issues: v2, ..., v3_project_components }))
```
Add `scenario: Scenario` (enum: `Default`, `Drop`, `PartialFail`, `Truncated`, `Mutate`) initialised from env `PMKAR_MOCK_SCENARIO` inside `build_fixtures`, optionally a `POST /__mock/scenario` route, both under the `mock-server` feature (Cargo.toml L52).

**Search handler pattern to extend** (mock_server.rs L60-95 `make_search_response` / `make_search_response_paged`, route at L909 `.route("/rest/api/2/search", get(v2::search_issues))`, `SearchQuery { jql, start_at, max_results }` L43-50). v2 already pages via `startAt`/`maxResults`; v3 (`/rest/api/3/search/jql`, L936) returns the first 50 only.

**What the app counts as incomplete (read, resolves Open Question 1):** `src-tauri/src/jira_client.rs` L36-103, `search_tickets`:
- Partial: any non-success status or parse failure on any page returns `Err(AppError::Http(...))`, so a `PartialFail` scenario = page 2 (`startAt > 0`) returns HTTP 500.
- Truncated: only when `all_issues.len() >= MAX_PAGINATION_ITEMS` (1000) while `total` is still larger (L90-96). A `Truncated` scenario must report `total` > 1000 and serve >= 1000 filler issues across pages (or the planner must confirm a lower cap). The frontend consumes this via `ticketStore` fields `truncated` and `lastCompleteFetchSignature` (ticketStore.ts L24-29, L144-165) and `useHintsEligible`; "one batch fails" likely refers to multi-batch fetching in `commands.rs` (not read; planner should read before finalising).

**Rust test analog:** `src-tauri/tests/pagination.rs` and `src-tauri/tests/common/mod.rs` (helpers that call `build_v2_router`) plus `tests/mock_server.rs`. mock_server.rs / fixtures.rs have no `#[cfg(test)]` modules, so put scenario tests in a new `src-tauri/tests/mock_server_scenarios.rs`.

---

### `33-UAT.md` (doc)

**Analog:** `.planning/phases/32-durability/32-UAT.md` (and 29/30/31 `*-UAT.md`, `*-HUMAN-UAT.md`); organise by feature area, include skipped items and mock-scenario instructions (env var name), drop VoiceOver items (D-07).

## Shared Patterns

### i18n in components
**Source:** `GroupTab.tsx` L81-83, `GroupTabStrip.tsx` L166, L209
**Apply to:** every modified component and the noLiteralStrings scan
```tsx
const { t } = useTranslation();
aria-label={t('groups.tab.aria', { name: group.name, count: group.memberCount })}
toast.error(t('groups.error.notFound'));
```

### Test harness (React + Zustand + Tauri mock)
**Source:** `GroupTabStrip.test.tsx` L1-57
**Apply to:** all new `.test.tsx` files. `vi.mock('sonner', ...)`, `vi.mock('@tauri-apps/api/core', ...)`, `renderWithI18n`, `useGroupStore.setState({ ...initial, groups, hydrated: true, ... })` seeding, `ResizeObserver`/`matchMedia` stubs. jsdom polyfills already in `src/test-setup.ts` L11-24 (pointer capture, `scrollIntoView`).

### Focus-return assertions
**Source:** `GroupTabStripOverlays.test.tsx` L171-331
**Apply to:** keyboard tests. Always `await waitFor(() => expect(el).toHaveFocus())` after Radix close.

### Token reads for contrast
**Source:** `colors.test.ts` L13-54 (extract to `src/test-utils/contrast.ts`)
**Apply to:** contrast.test.ts, colors.test.ts

### Store conventions (carry-forward)
No `?? []` in Zustand selectors (use `null` fallback), no drag and drop, explicit labelled buttons never hover-revealed (project memory).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/i18n/__tests__/noLiteralStrings.test.ts` | test | file-I/O + AST | No AST or source-scanning test exists; use TS compiler API per RESEARCH Pattern 3 |
| `a11y.axe.test.tsx` axe calls | test | request-response | No axe tooling in repo; `vitest-axe` install is gated (human-verify) or use direct `axe-core` |
| Scenario switch in `fixtures.rs` | model | CRUD | No scenario selector exists (CONTEXT assumption was wrong); new enum + env var |
| `package.json` devDependency | config | n/a | one-off install |

## Metadata

**Analog search scope:** `src/features/groups/**`, `src/features/tickets/`, `src/i18n/**`, `src/test-utils`, `src/index.css`, `src-tauri/src/{fixtures,mock_server,jira_client}.rs`, `src-tauri/tests`
**Files scanned:** ~35 (several read partially; GroupTab.tsx L1-59 and GroupPicker.tsx full body not read)
**Pattern extraction date:** 2026-10-12
