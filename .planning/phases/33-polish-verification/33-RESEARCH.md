# Phase 33: Polish & Verification - Research

**Researched:** 2026-10-12
**Domain:** i18n audit (i18next EN/SK plurals), WCAG AA verification in vitest/jsdom (axe + token contrast), keyboard/focus tests, mock-server scenarios, consolidated UAT
**Confidence:** HIGH on codebase findings (measured in this session), MEDIUM on vitest-axe API details

## Summary

This is an audit, harden and lock-in phase. Most mechanisms already exist: key-parity test (`src/i18n/__tests__/translations.test.ts`), per-phase plural tests (`groupI18n.test.ts`), palette contrast tests (`colors.test.ts` with its own `luminance`/`contrast` helpers and CSS block extraction), roving tabindex, tab-strip arrows/fades, and a picker that already calls `scrollIntoView({block:'nearest'})` on the active option (GroupPicker.tsx:160). [VERIFIED: codebase grep]

Contrast was computed in this session from the real tokens in `src/index.css` and it surfaces **real failures the UI-SPEC only partly anticipated**. These must become failing-first token tests, then fixes:
- Dark focus ring `#c02232` on `#1e1e20` is **2.79:1** (<3:1). Dark destructive `#dc2626` on `#1e1e20` is **3.45:1** (<4.5:1 for text).
- `text-brand-muted` (`#8c8c92` light = 3.34:1 on white; dark `#7f7f7f` on `#1e1e20` = 4.16:1) is used for small text in group UI: inactive tab label (GroupTab.tsx:97; on bg: 3.12:1 light, 4.52:1 dark), GroupViewPage lines 168, 209, 226, 239 (xs/sm helper text), and the ticket key / meta line on every card (TicketCard.tsx:81, 110). All fail 4.5:1 in light theme. UI-SPEC says tab text must be >= 4.5:1, so GroupTab inactive must move to `text-brand-text-secondary` (7.0:1 light / 5.58:1 dark on surface; 6.54 / 6.07 on bg).
- The missing-state hint already uses `text-brand-text-secondary` (GroupViewPage.tsx:116) and dimming is **already per-element** (`dimClass` in TicketCard, currently `opacity-60`), not a wrapper. UI-SPEC "move hint outside the dimmed wrapper" is therefore mostly already true; the work is changing `opacity-60` to `opacity-70`, and fixing the dimmed ticket key which uses muted text (muted already 3.34:1 before dimming, so it composites well below the 3:1 floor). In the dimmed state the key/meta must switch to `text-brand-text-secondary`. Composited primary text at 60%: 4.33 light / 5.57 dark; at 70%: 6.03 / 7.09. [VERIFIED: computed with WCAG luminance formula]

Two CONTEXT assumptions are inaccurate and the planner must account for them: (1) there is **no scenario selector** in `fixtures.rs`/`mock_server.rs`; "PERS-02/PERS-04" are just fixture data. D-06 requires inventing a scenario mechanism. (2) `typescript` (6.x) is already a devDependency, so an AST-based scan needs no new package.

**Primary recommendation:** Order work as (1) token/contrast tests + fixes, (2) locale normalisation + locale guard tests, (3) static literal-string AST scan, (4) axe + keyboard tests with component fixes, (5) tab-strip arrow hardening + 25-group tests, (6) mock scenario + consolidated UAT file.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: WCAG AA verified by automated tests plus targeted tests. Add `vitest-axe` (or equivalent axe-core runner) as dev dependency. Run axe on: tab strip with groups, open `…` menu, rename/color/delete overlays, picker (detail and bar mode), select mode with selection bar, group view (empty / populated / missing block), detail groups row. Explicit keyboard tests: arrow navigation in tab strip; Esc closing every menu/popover/dialog; focus returning to trigger after every dialog/popover closes (Phase 30 D-05/D-08/D-14); Enter/Space on chips; shift-range selection with keyboard where applicable.
- D-02: Static scan test fails if a JSX text node or `aria-label`/`title`/`placeholder`/`alt` attribute contains a literal user-facing string instead of `t()`. Covers `src/features/groups/**` and group-related parts of `src/features/tickets/**` touched in v0.5.0. Small allowlist (`+`, `…`, `×`, key formats). Companion test: every `t('groups.*')` key (or other key referenced from group UI) exists in both `en.json` and `sk.json`.
- D-03: Scope is group UI only (incl. shared pieces changed in v0.5.0: TicketFilterBar Select toggle, ticket card restructure, chips). Gaps in older unrelated screens are logged as deferred, not fixed.
- D-04: Token-level contrast tests in both light and dark themes: dimmed missing-card content (stated threshold); missing hint >= 4.5:1; missing "Remove" and "Remove all missing" at full contrast >= 4.5:1; chip neutral text >= 4.5:1; chip/tab color dots >= 3:1 (existing, keep). Fix token or opacity on failure; exact values Claude's discretion. Planner decides whether dimmed content needs 4.5:1 or whether the undimmed hint and Remove button carry meaning; document the choice in the test.
- D-05: One consolidated `33-UAT` covering the whole milestone: every skipped item from 29, 30, 31 (HUMAN-)UAT; all 9 skipped Phase 32 UAT items; Phase 33 checks (full SK pass with 1 / 2-4 / 5+ counts; keyboard-only pass through tabs, menu, picker, select mode and bar, dialogs; light and dark theme pass).
- D-06: Missing-issue states testable via mock-server scenarios in `src-tauri/src/fixtures.rs` / `mock_server.rs`: (1) grouped issue dropping out of results (complete fetch -> missing hint); (2) partial fetch where one batch fails, no hints; (3) truncated fetch, no hints. Also allow changing a grouped issue's summary/status to test snapshot refresh (Phase 32 UAT #6).
- D-07: No VoiceOver checks in this UAT.
- D-08: No group-seeding tooling (no script, dev button, or mock helper for 25 groups).
- D-09: Overflow affordance = edge fades plus scroll arrows, already in `GroupTabStrip.tsx`. Verify and harden at ~25 groups: consider scrolling ~one viewport width instead of fixed 200px; labelled, keyboard reachable, announced arrow buttons; core tabs never shift; active tab scrolls into view on switch and on Move. Hide vs disable at ends at Claude's discretion.
- D-10: Tab name max width stays fixed 160px; long names truncate with full-name tooltip. No adaptive shrinking.
- D-11: Scale verified by automated tests only (25 groups, mixed lengths incl. 40-char and diacritic names): core tabs stay put; arrows enable/disable correctly; active tab scrolls into view; picker search filters and list scrolls; arrow-key focus in picker scrolls focused row into view; card chips capped at 2 + "+N". No manual 25-group UAT step.
- D-12: Picker stays as is (`max-h-60`, scrolling, autofocused search, tab-order rows per Phase 31 D-02). Only addition: keyboard nav scrolls focused row into view.
- D-13: Quote style: Slovak „…“, English “…” around interpolated names/keys in ALL `groups.*` copy. Test fails if `‘` or `’` wraps an interpolation (`{{name}}`, `{{key}}`, `{{query}}`) in either locale.
- D-14: Claude audits SK wording (case after z/zo/do/na, gender/number agreement with "skupina"/"úloha", consistent verbs, glossary); user spot-checks in UAT. Known: `groups.picker.announceRemoved` -> "Odstránené zo skupiny „X“".
- D-15: Locked SK glossary: issue=úloha, group=skupina, tab=karta, select/selection=vybrať/výber, remove (from group)=odstrániť zo skupiny, delete (group)=odstrániť skupinu, missing=„Už nie je / nie sú vo výsledkoch“ with button „Odstrániť všetky chýbajúce“, create=vytvoriť, rename=premenovať, color=farba.
- D-16: SK `_many` mirrors `_other` (genitive plural) in every `groups.*` plural key. Currently inconsistent: `tab.aria_many`, `delete.body_many`, `chip.moreAria_many`, `bar.count_many`, `bar.removeConfirm_many`, `toast.*_many` use `_few` form; `missing.removeAllConfirm_many` already matches. Add test that `_many === _other` for all `groups.*` keys in sk.json.
- D-17: Every count-bearing string keeps/gains full `_one/_few/_many/_other` in SK. Zero counts use dedicated keys.
- Carried forward: Phase 28 D-05..D-08, Phase 29 D-05/D-07/D-08, Phase 30 D-01..D-15, Phase 31 D-01..D-19, Phase 32 D-01..D-16. No drag and drop. Explicit labelled controls, never hover-revealed. No `?? []` in Zustand selectors.

### Claude's Discretion
- Axe runner choice and how to quiet jsdom-irrelevant rules such as `color-contrast`.
- Static scan implementation (AST preferred over regex).
- Exact dimming and token values when D-04 tests fail.
- Arrow-button behaviour at scroll ends and scroll step size.
- Mock-scenario switch mechanism (env var, config flag, or existing selector pattern).
- UAT ordering/grouping (by feature area, not by phase).

### Deferred Ideas (OUT OF SCOPE)
- Manual VoiceOver verification of group UI.
- Group-seeding dev tooling.
- a11y/i18n gaps in non-group screens (log, do not fix).
- Undo after delete/bulk actions (GRP-F1).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GQA-01 | All new UI strings exist in EN and SK, incl. correct Slovak plural forms | Locale normalisation findings (quotes, `_many`), key-parity and `_many===_other` guards, AST literal scan, `Intl.PluralRules('sk')` category facts |
| GQA-02 | WCAG AA: keyboard reachable tabs/menus/picker/selection, focus returns after dialogs, color never sole signal, palette contrast in both themes | Measured contrast table and required token fixes, vitest-axe setup, keyboard/focus test matrix, arrow hardening, 25-group tests |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Locale strings and plurals | Browser/Client (i18next JSON) | — | Pure frontend resources |
| Contrast tokens | Browser/Client (`src/index.css`) | — | CSS variables read by tests |
| Keyboard/focus behaviour | Browser/Client (React + Radix) | — | Radix owns focus return; components own roving/scroll |
| Static scan / axe tests | Test tooling (vitest) | — | Dev-only |
| Missing/partial/truncated scenarios | Mock server (Rust, `mock-server` feature) | Browser (fetch completeness logic already in `useHintsEligible`/`fetchSignature`) | Scenarios only change mock Jira responses; app logic is verify-only |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.1.1 (installed) | runner | already in use |
| @testing-library/react + user-event | 16.3.2 / 14.6.1 (installed) | component/keyboard tests | already in use |
| vitest-axe | 0.1.0 (npm, last published 2025-01-22) | axe-core matcher for vitest | the vitest port of jest-axe; peer `vitest >=0.16.0`; pulls axe-core ^4.4.2 (axe-core latest 4.14.0) |
| typescript | ^6.0.2 (installed) | compiler API for AST scan | no new dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest-axe | direct `axe-core` call (`axe.run(container, {rules:{'color-contrast':{enabled:false}}})`) | Zero extra package; ~15 lines of helper. Use this as fallback if vitest-axe types conflict with vitest 4 |
| TS compiler AST | regex | Regex misses JSX attribute/expression nuances; AST is already available |

**Installation:**
```bash
npm install -D vitest-axe
```

**Version verification:** `npm view vitest-axe version` -> 0.1.0, modified 2025-01-22, about 1.7M downloads last week, created 2022-07, repo github.com/chaance/vitest-axe, no `postinstall` script. [VERIFIED: npm registry, api.npmjs.org]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| vitest-axe | npm | ~4 yrs | ~1.7M/wk | github.com/chaance/vitest-axe | not run (pip unavailable in env) | Approved by registry evidence, but tag [ASSUMED] per protocol: planner should gate install behind a `checkpoint:human-verify` (or fall back to direct `axe-core`) |

**Packages removed due to slopcheck [SLOP]:** none (slopcheck could not run)
**Packages flagged [SUS]:** none

## Architecture Patterns

### Data flow of the verification system
```
src/index.css (:root + body.dark tokens) --regex extract--> contrast token tests (both themes)
src/i18n/locales/{en,sk}.json --import--> parity / quote / _many===_other / plural-completeness tests
src/features/groups/**/*.tsx (+ touched tickets files) --ts.createSourceFile--> literal-string scan
                                                         --regex t('..') collect--> key existence in both locales
Components (render with real i18n, groupStore seeded) --> axe(container) (color-contrast off) + role/name asserts
user-event keyboard flows --> focus assertions (document.activeElement === trigger)
Rust mock server: scenario state --> /search responses --> app fetch --> missing hints (manual UAT only)
```

### Recommended structure
```
src/features/groups/__tests__/
├── a11y.axe.test.tsx          # axe in key states
├── a11y.keyboard.test.tsx     # Esc / focus return / chips / range select
├── contrast.test.ts           # D-04 token tests, shared helpers
├── groupScale.test.tsx        # 25 groups
src/i18n/__tests__/
├── groupLocale.test.ts        # quotes, _many===_other, glossary, plural completeness, key existence
└── noLiteralStrings.test.ts   # AST scan
src/test-utils/contrast.ts     # extract luminance/contrast/extractBlock from colors.test.ts (currently duplicated inline)
```

### Pattern 1: axe in jsdom with color-contrast disabled
```ts
// Source: vitest-axe README (github.com/chaance/vitest-axe) [CITED]
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
expect.extend(matchers);               // or import 'vitest-axe/extend-expect' in test-setup
const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
expect(results).toHaveNoViolations();
```
Note [ASSUMED]: `configureAxe({rules:{...}})` also exists; TS needs `Assertion` augmentation only if not using `extend-expect`. Radix portals render outside `container`: pass `document.body` for popover/menu/dialog states. Run axe on the open state, with real i18n.

### Pattern 2: Token contrast test (both themes)
Reuse `extractBlock(css, /:root\s*\{/)` and `/body\.dark\s*\{/` from `colors.test.ts`; `readVar` only matches 6-digit hex, so read `--color-brand-*` and add any new tokens as hex. Composite dimming: `mix(fg, bg, opacity)`; assert 3:1 floor on composited key/summary (decision documented in the test), 4.5:1 for hint/Remove at full opacity. Note `:root` has its tokens possibly in `@theme`; the existing test reads three blocks (theme, root, dark), so check where `--color-brand-*` live before reading them.

### Pattern 3: AST literal scan
Use `ts.createSourceFile(name, text, ScriptTarget.Latest, true, ScriptKind.TSX)`, walk for `JsxText` (trimmed, contains a letter) and `JsxAttribute` named `aria-label|title|placeholder|alt` whose initializer is a `StringLiteral` or `{'literal'}`/template without `t(`. Skip `*.test.tsx`. Allowlist non-letter strings (`+ … × / · digits`). Also scan string-literal ternaries inside those attributes.

### Anti-Patterns to Avoid
- Running axe on `container` only for Radix portals (silent false pass).
- Asserting `color-contrast` via axe in jsdom (jsdom cannot compute it; produces incomplete/false results).
- Fixing muted token globally (shared with older screens; D-03). Use `text-brand-text-secondary` in group UI instead.
- `?? []` in Zustand selectors; hover-revealed controls; any DnD.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ARIA rule checking | custom role/name checkers | axe-core via vitest-axe | Covers names, roles, label association, nested-interactive |
| Slovak plural category | custom plural function | i18next + `Intl.PluralRules('sk')` (one/few/many/other; integers never hit `many`, only decimals) | Existing pattern |
| Source parsing | regex over TSX | TypeScript compiler API (already installed) | JSX attribute/expression accuracy |
| Focus return | manual focus calls where Radix already restores | Radix `onCloseAutoFocus` (only where unmounted trigger needs fallback) | Already per Phase 30 |

## Runtime State Inventory

Not a rename phase, but the locale change touches keys' values only (no key renames), so no stored data is affected. Stored data: none (groups persisted by id, color token, not strings). Build artifacts: none. One caution: renaming no keys means key-parity tests and any hard-coded string assertions in existing tests are the only dependents; **existing tests assert exact strings with ‘…’ quotes** (e.g. `groupI18n.test.ts`, component tests) and will break when quotes are normalised. Grep tests for `‘`/`’` and update them in the same plan as the locale change.

## Common Pitfalls

### Pitfall 1: Existing tests hard-code old copy
**What goes wrong:** Quote/plural normalisation fails dozens of tests. **How to avoid:** `grep -rn "‘\|’" src --include=*.test.*` before editing; update in the same task. SK currently has 34 lines containing `‘`; EN also uses ‘…’ (e.g. picker.create, noMatch, announceAdded/Removed, chip.goTo). [VERIFIED: grep]

### Pitfall 2: EN carries _few/_many keys
EN json already has `_one/_few/_many/_other` for `groups.tab.aria` (all identical English); the existing parity test requires identical key sets, so any added SK plural key needs an EN twin. The planner's "EN needs only _one/_other" statement in the UI-SPEC is not how the files are structured; keep key-set parity and do not delete EN `_few/_many`. [VERIFIED: en.json:496-500]

### Pitfall 3: Dimmed text uses muted base
`TicketCard` dims individual elements and the key/meta lines are `text-brand-muted`; compositing muted at 60-70% fails 3:1. Switch to `text-brand-text-secondary` when `dimmed`, then opacity-70. Opacity applies per element since a parent opacity cannot be undone (comment in TicketCard.tsx:49).

### Pitfall 4: Dark focus ring and dark destructive
`focus-visible:ring-brand` (`#c02232`) is 2.79:1 on dark surface; `#dc2626` is 3.45:1 on dark surface; `#f87171` gives 6.02:1. Scope dark overrides to group controls (e.g. `dark:text-red-400`/token) rather than global tokens; check whether the `body.dark` class (not `dark:` media variant) is the theme switch, since Tailwind `dark:` may not be configured for `body.dark`. Add a token (`--color-destructive-text`) in `:root` and `body.dark` and assert it. [Tailwind variant config not verified: A2]

### Pitfall 5: Arrow-hiding focus loss
Hiding an arrow that holds focus drops focus to body. Hand focus to the active tab before hiding (UI-SPEC). Also current arrows are `w-7 h-7` (28px) which already exceeds 24px; keep. Currently scroll step is 200px and arrows render conditionally (`overflow.canScrollLeft &&`), so hide-at-ends already exists; remaining work: 80% step and focus handoff. [VERIFIED: GroupTabStrip.tsx:274-377]

### Pitfall 6: jsdom layout
jsdom has no layout (`scrollWidth`, `clientWidth` = 0), so overflow arrows and scroll-into-view need stubbed geometry (`Object.defineProperty(el,'scrollWidth',...)`) and `scrollIntoView` spies (test-setup already polyfills `scrollIntoView` as a no-op; use `vi.spyOn(Element.prototype,'scrollIntoView')`). The 25-group tests assert call behaviour, not pixels. Truncation at 160px is a class assertion (`max-w-[160px]`), not measured.

### Pitfall 7: Mock scenario mechanism does not exist
`FixtureState` is a `Mutex` held in axum state; v2 search supports paging (`startAt`/`maxResults`/`total`), v3 `make_search_response` returns the first 50 only and ignores paging. A scenario needs new state. Recommended: add `scenario: Scenario` (enum) to `FixtureState` initialised from env var `PMKAR_MOCK_SCENARIO` (read in `build_fixtures`), plus optionally a mock-only `POST /__mock/scenario` route for switching without restart. Scenarios: `drop` (omit chosen issue(s) from search, still serve GET issue), `partial_fail` (second page request returns 500), `truncated` (report `total` larger than returned pages / cap pages), `mutate` (alter summary/status of a grouped issue). Must check how the app detects partial/truncated completeness (`fetchSignature`, `lastCompleteFetchSignature` in ticketStore) before choosing the response shape; research did not read the fetch module in detail. [A3] Add `#[cfg(test)]`/Rust unit tests for scenario responses (cargo test).

### Pitfall 8: Slovak grammar
Plural example: `Intl.PluralRules('sk')`: 1 -> one, 2-4 -> few, 0/5+ -> other, decimals -> many. Genitive plurals: úloh, skupín, vybraných. After "do/z/zo/na" use genitive/locative correctly: „do skupiny“, „zo skupiny“, „v skupine“. Flag for user spot-check in UAT (D-14).

## Code Examples

### `_many === _other` and quote guard
```ts
// derived from existing translations.test.ts structure
const groupKeys = Object.keys(sk).filter(k => k.startsWith('groups.'));
for (const k of groupKeys.filter(k => k.endsWith('_other')))
  expect(sk[k.replace(/_other$/, '_many')], k).toBe(sk[k]);
for (const [k, v] of Object.entries(sk).filter(([k]) => k.startsWith('groups.')))
  expect(v, k).not.toMatch(/[‘’]\{\{\s*(name|key|query)\s*\}\}[‘’]|[‘’]\{\{/);
// EN: expect interpolations wrapped in “ ” ; SK: „ “
```

### Focus-return test
```ts
await user.click(menuTrigger); await user.click(await screen.findByRole('menuitem', {name: /rename/i}));
await user.keyboard('{Escape}');
await waitFor(() => expect(menuTrigger).toHaveFocus());
```

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| jest-axe | vitest-axe (same API) | works with vitest globals |
| Fixed 200px scroll | 80% viewport step | per UI-SPEC |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | vitest-axe 0.1.0 works with vitest 4.1 and TS 6 types (`extend-expect`/`matchers` entry points per README) | Standard Stack | Fall back to direct axe-core helper |
| A2 | Tailwind `dark:` variant may not be wired to `body.dark`; scoped dark token must be a CSS variable | Pitfall 4 | Dark fix does not apply |
| A3 | Partial/truncated fetch response shapes for the mock were not derived from fetch code | Pitfall 7 | Scenario does not trigger the "not complete" path; planner must read `ticketStore`/fetch module first |
| A4 | vitest-axe package legitimacy (slopcheck unavailable) | Package Audit | Gate install with human-verify |
| A5 | SK grammar suggestions in Pitfall 8 | Pitfall 8 | Spot-check in UAT covers |

## Open Questions

1. **Which fetch paths define "partial" and "truncated"?** Known: `useHintsEligible` requires `lastCompleteFetchSignature` equal to current signature. Not read: where it is set. Recommendation: first task of the mock plan reads the ticket fetch code and writes the scenario to match; add a Rust-side or TS-side test of the contract.
2. **Is there an inert `body.dark` Tailwind `dark:` variant?** Check `src/index.css` `@custom-variant`. Recommendation: use CSS variables.
3. **Which files in `src/features/tickets/**` count as "touched in v0.5.0"?** Recommendation: derive with `git log --name-only` since v0.4.8 tag/phase 28 commits and hard-code the list in the scan test, plus all of `src/features/groups/**`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node/npm | tests | yes | repo toolchain | — |
| typescript | AST scan | yes | ^6.0.2 | — |
| vitest-axe | axe tests | not installed | 0.1.0 on npm | direct axe-core |
| pip/slopcheck | package gate | no (pip missing) | — | mark [ASSUMED], human-verify |
| cargo / Rust | mock scenarios | assumed (src-tauri exists, `target/` present) | — | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1, jsdom ^29, RTL 16 + user-event 14 |
| Config file | `/Users/mimo/Documents/Projects/pmkar/vitest.config.ts` (setup `src/test-setup.ts`, include `src/**/*.test.{ts,tsx}`, globals true) |
| Quick run command | `npx vitest run src/features/groups src/i18n` |
| Full suite command | `npm test` (plus `npm run lint`, `cargo test` in src-tauri for scenarios) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GQA-01 | key parity incl. groups.* | unit | `npx vitest run src/i18n/__tests__/translations.test.ts` | exists |
| GQA-01 | no `‘ ’` around interpolations; EN “ ” / SK „ “ | unit | `npx vitest run src/i18n/__tests__/groupLocale.test.ts` | Wave 0 |
| GQA-01 | SK `_many === _other`; full plural set per count key; glossary terms | unit | same | Wave 0 |
| GQA-01 | 1/2-4/5+ render correctly for every count key | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts` | exists, extend |
| GQA-01 | no literal user-facing strings; every referenced key exists in both locales | static scan | `npx vitest run src/i18n/__tests__/noLiteralStrings.test.ts` | Wave 0 |
| GQA-02 | axe clean in key states | component | `npx vitest run src/features/groups/__tests__/a11y.axe.test.tsx` | Wave 0 |
| GQA-02 | Esc + focus return, chips Enter/Space, range select, arrow nav | component | `npx vitest run src/features/groups/__tests__/a11y.keyboard.test.tsx` | Wave 0 |
| GQA-02 | token contrast both themes, dim floor, focus ring, destructive | unit | `npx vitest run src/features/groups/__tests__/contrast.test.ts` | Wave 0 (extend colors.test.ts helpers) |
| GQA-02 | 25 groups: core tabs, arrows, active in view, picker scroll, chips +N | component | `npx vitest run src/features/groups/__tests__/groupScale.test.tsx` | Wave 0 |
| GQA-02 | color not sole signal (name/count/text accompany dot) | component | covered in axe/role-name assertions | Wave 0 |
| UAT | mock scenarios | Rust unit | `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server` | Wave 0 |

### Sampling Rate
- Per task commit: `npx vitest run src/features/groups src/i18n`
- Per wave merge: `npm test && npm run lint`
- Phase gate: full suite green before `/gsd:verify-work`; consolidated 33-UAT executed by the user at milestone end.

### Wave 0 Gaps
- [ ] `src/test-utils/contrast.ts` (extract shared helpers), `contrast.test.ts`
- [ ] `src/i18n/__tests__/groupLocale.test.ts`, `noLiteralStrings.test.ts`
- [ ] `a11y.axe.test.tsx`, `a11y.keyboard.test.tsx`, `groupScale.test.tsx`
- [ ] `npm install -D vitest-axe` (after human-verify) and axe setup (extend-expect in test-setup or per file)

## Security Domain

Security enforcement applies, but this phase adds only test tooling, locale strings and CSS; no new data paths.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3/V4 | no | unchanged |
| V5 Input Validation | unchanged | existing group name validation; interpolation uses i18next escaping (verify `escapeValue` setting unchanged when adding quotes) |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Supply chain (new devDependency) | Tampering | registry/age/downloads check done; human-verify gate; no postinstall script |
| Mock-only endpoint exposed in release | Elevation | keep scenario route and env var strictly behind `cfg(feature = "mock-server")` |

## Sources

### Primary (HIGH)
- Codebase reads and measured contrast (this session): `src/index.css`, `GroupTabStrip.tsx`, `GroupTab.tsx`, `GroupPicker.tsx`, `TicketCard.tsx`, `GroupViewPage.tsx`, `useHintsEligible.ts`, `missingMembers.ts`, `mock_server.rs`, `fixtures.rs`, locale files, vitest config
- npm registry (`npm view vitest-axe`, api.npmjs.org downloads)

### Secondary (MEDIUM)
- https://github.com/chaance/vitest-axe README (matchers/extend-expect usage)

### Tertiary (LOW)
- Slovak grammar suggestions (training knowledge)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM (vitest-axe + vitest 4 compatibility unverified by install)
- Architecture: HIGH
- Pitfalls: HIGH for contrast/locale findings (measured), MEDIUM for mock scenario shape

**Research date:** 2026-10-12
**Valid until:** 2026-11-12
