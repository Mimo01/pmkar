# Phase 33: Polish & Verification - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes all v0.5.0 group UI fully bilingual (EN/SK, with correct Slovak plurals) and verifiably WCAG AA in both themes (GQA-01, GQA-02). It proves both with automated guards, and it ends with one consolidated manual UAT covering the whole Custom Groups milestone (phases 29–33).

It is an **audit, harden and fix** phase. It adds no new capabilities. Nearly all the building blocks already exist:
- key-parity tests;
- per-phase plural tests;
- palette contrast tests;
- roving tabindex;
- tab-strip fades and arrows.

The work is to verify them, close the gaps, and lock them in with tests.

**UI in scope:** everything added or touched in v0.5.0:
- group tab strip, tabs, the `…` menu, and the rename, color and delete overlays;
- create popover, group view, empty and missing states;
- picker, chips, and the detail groups row;
- Select toggle, selection bar and confirm popovers;
- the shared `TicketFilterBar` and ticket cards, where v0.5.0 modified them.

</domain>

<decisions>
## Implementation Decisions

### Verification method
- **D-01:** **WCAG AA is verified by automated tests plus targeted tests.**
  - Add `vitest-axe` (or an equivalent axe-core runner for vitest/jsdom) as a dev dependency.
  - Run axe on the main group components in their key states: tab strip with groups, open `…` menu, rename, color and delete overlays, picker (detail mode and bar mode), select mode with the selection bar, group view (empty / populated / missing block), and detail groups row.
  - Add explicit keyboard tests for:
    - arrow navigation in the tab strip;
    - Esc closing every menu, popover and dialog;
    - focus returning to the trigger after every dialog or popover closes, per the Phase 30 D-05/D-08/D-14 rules;
    - Enter/Space on chips;
    - shift-range selection with the keyboard where applicable.
- **D-02:** **No untranslated strings, enforced by a static scan test.**
  - The test fails if a JSX text node or an `aria-label` / `title` / `placeholder` / `alt` attribute contains a literal user-facing string instead of a `t()` call.
  - It covers `src/features/groups/**` and the group-related parts of `src/features/tickets/**` touched in v0.5.0.
  - It has a small allowlist for non-linguistic literals, e.g. `+`, `…`, `×`, and key formats.
  - Add a companion test: every `t('groups.*')` key, or other key referenced from group UI, exists in **both** `en.json` and `sk.json`.
- **D-03:** **Scope is group UI only.** That includes the shared pieces changed in v0.5.0 (`TicketFilterBar` Select toggle, ticket card restructure, chips).
  - a11y or i18n gaps found in older, unrelated screens are **logged as deferred, not fixed**.
- **D-04:** **Token-level contrast tests go beyond the palette.** In **both light and dark themes**, compute and assert:
  - dimmed missing-card content (opacity over the card background), with a stated threshold;
  - missing hint text: ≥ 4.5:1;
  - the missing "Remove" button and "Remove all missing" at full contrast: ≥ 4.5:1 text;
  - chip neutral text: ≥ 4.5:1;
  - chip and tab color dots: ≥ 3:1 non-text. This already exists in the `colors.ts` tests; keep it.
  - If a value fails, fix the token or the opacity. Exact values are Claude's discretion (Phase 32 left dimming open).
  - Note: dimmed *content* is decorative de-emphasis. The planner decides whether it needs to meet 4.5:1 or whether the undimmed hint line and Remove button carry the meaning. Document the choice in the test.

### Milestone UAT sweep
- **D-05:** **One consolidated `33-UAT` covers the whole milestone.** It contains:
  - every **skipped** item from 29, 30 and 31 (HUMAN-)UAT;
  - all **9 skipped Phase 32 UAT items**;
  - Phase 33's own checks:
    - a full SK pass with 1 / 2–4 / 5+ counts;
    - a keyboard-only pass through tabs, menu, picker, select mode and bar, and dialogs;
    - a light and dark theme pass.
  - This follows the user's preference to review at the end of the milestone, not per phase.
- **D-06:** **Missing-issue states become testable through mock-server scenarios** in `src-tauri/src/fixtures.rs` / `mock_server.rs`, following the existing PERS-02/PERS-04 scenario pattern. Provide switchable scenarios for:
  1. a grouped issue dropping out of results (complete fetch → missing hint);
  2. a partial fetch where one batch fails, so no hints appear;
  3. a truncated fetch, so no hints appear.
  - Changing a grouped issue's summary or status should also be possible, to test the snapshot refresh (Phase 32 UAT #6).
- **D-07:** **No VoiceOver checks** in this UAT. Screen-reader semantics are covered by axe and the role/name assertions in tests. Manual VoiceOver is deferred.
- **D-08:** **No group-seeding tooling** is added: no script, no dev button, no mock helper for creating 25 groups. The user explicitly skipped it.

### 25-group scale
- **D-09:** **Overflow affordance is edge fades plus scroll arrows.** These **already exist** in `GroupTabStrip.tsx` from Phase 29: `ChevronLeft`/`ChevronRight`, gradient fades, `scrollByDir` at 200px, shown only when overflowing. The task is to **verify and harden** them at about 25 groups, not rebuild them. Consider:
  - scrolling about one viewport width instead of a fixed 200px;
  - arrow buttons that are labelled, keyboard reachable and announced;
  - core tabs never shift;
  - the active tab scrolls into view on switch and on Move.
  - Keep or adjust "hide at ends" vs "disabled at ends" at Claude's discretion, consistent with a11y.
- **D-10:** **Tab name max width stays fixed at 160px.** Long names truncate with a full-name tooltip. No adaptive shrinking.
- **D-11:** **Scale is verified by automated tests only.** Component tests render **25 groups with mixed name lengths**, including 40-character and diacritic names, and assert:
  - core tabs stay put;
  - overflow arrows enable and disable correctly;
  - the active tab scrolls into view;
  - picker search filters and the list scrolls;
  - arrow-key focus in the picker scrolls the focused row into view;
  - card chips stay capped at 2 + "+N".
  - There is no manual 25-group UAT step.
- **D-12:** **The picker stays as is:** `max-h-60`, scrolling, autofocused search, tab-order rows per Phase 31 D-02. The only addition is making sure keyboard navigation scrolls the focused row into view.

### Slovak copy & i18n polish
- **D-13:** **Quote style.** Slovak uses „…“ and English uses “…” around interpolated names and keys in **all** `groups.*` copy. Today the copy mixes ‘…’ and „…“/“…”.
  - Normalise every key.
  - Add a test that fails if `‘` or `’` wraps an interpolation (`{{name}}`, `{{key}}`, `{{query}}`) in either locale.
- **D-14:** **Claude audits the SK wording, and the user spot-checks it during UAT.** The audit covers:
  - grammatical case after prepositions (z/zo/do/na);
  - gender and number agreement with "skupina" and "úloha";
  - consistent verbs;
  - the glossary below.
  - Known issue: `groups.picker.announceRemoved` "Odstránené zo ‘X’" lacks "skupiny". Align it with the other strings: "Odstránené zo skupiny „X“".
- **D-15:** **Locked SK terminology glossary** for group UI. The audit enforces it.
  | EN | SK |
  |----|----|
  | issue | úloha |
  | group | skupina |
  | tab | karta |
  | select / selection | vybrať / výber |
  | remove (from a group) | odstrániť zo skupiny |
  | delete (a group) | odstrániť skupinu (destructive, from the menu) |
  | missing / no longer in results | „Už nie je / nie sú vo výsledkoch“; button: „Odstrániť všetky chýbajúce“ |
  | create | vytvoriť |
  | rename | premenovať |
  | color | farba |
- **D-16:** **The Slovak `_many` plural (decimal numbers in i18next) mirrors `_other`**, using genitive plural forms such as "úloh" / "skupín" / "vybraných" in every `groups.*` plural key.
  - Today the keys are inconsistent: `tab.aria_many`, `delete.body_many`, `chip.moreAria_many`, `bar.count_many`, `bar.removeConfirm_many` and `toast.*_many` use the `_few` form. `missing.removeAllConfirm_many` already matches `_other`.
  - Add a test that `_many === _other` for all `groups.*` keys in `sk.json`.
- **D-17:** Every count-bearing string keeps or gains the full `_one/_few/_many/_other` set in SK. Zero-count cases use dedicated keys (SK has no `zero` category; see the existing test in `groupI18n.test.ts`).

### Carried forward (locked, not re-discussed)
- Phase 28 D-05..D-08: 8-hue palette with no red; the token name is stored; dot plus neutral text; the dot has ≥ 3:1 non-text contrast.
- Phase 29 D-05/D-07/D-08: tab anatomy is dot · name · count; the activated tab scrolls into view; the name cap is about 24 characters / 160px.
- Phase 30 D-01..D-15: menu triggers and order, focus-return rules, delete alertdialog with Cancel focused by default, and the move live-region announcement.
- Phase 31 D-01..D-19: picker, chips, select mode and selection bar behaviour, confirm popovers.
- Phase 32 D-01..D-16: missing-state behaviour, gating, and the copy "No longer in results".
- No drag and drop. Explicit labelled controls, never hover-revealed. No `?? []` in Zustand selectors.

### Claude's Discretion
- The choice of axe runner (`vitest-axe` vs `jest-axe` vs a direct `axe-core` call) and how to quiet jsdom-irrelevant rules such as `color-contrast`, which jsdom cannot compute. Contrast is covered by the D-04 token tests instead.
- How the static scan is implemented: an AST walk with the TypeScript compiler API or babel, vs a regex heuristic. Prefer AST for accuracy.
- Exact dimming and token values when D-04 tests fail.
- Arrow-button behaviour at the scroll ends (hidden vs aria-disabled) and the scroll step size.
- Mock-scenario switch mechanism: an env var, a config flag, or the existing scenario selector pattern in `fixtures.rs`.
- How the consolidated UAT is ordered and grouped (by feature area, not by phase, for a smooth walkthrough).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — GQA-01, GQA-02 (and every GRP/GVIEW/GMEM/GDUR item, for the UAT sweep)
- `.planning/ROADMAP.md` §"Phase 33: Polish & Verification" — the 4 success criteria

### Prior phase decisions & UI contracts
- `.planning/phases/29-tab-strip-group-view/29-UI-SPEC.md` — tab strip, group view, and empty-state visual contract
- `.planning/phases/30-group-management-reorder/30-UI-SPEC.md` — menu, rename/color/delete overlays, focus rules
- `.planning/phases/31-membership-entry-points/31-UI-SPEC.md` — picker, chips, select mode, selection bar
- `.planning/phases/30-group-management-reorder/30-CONTEXT.md` — D-05/D-08/D-14 focus-return rules, D-15 announcement
- `.planning/phases/31-membership-entry-points/31-CONTEXT.md` — picker, chip and selection semantics
- `.planning/phases/32-durability/32-CONTEXT.md` — missing-state, gating and dimming decisions

### UAT backlog to consolidate
- `.planning/phases/29-tab-strip-group-view/29-UAT.md`, `29-HUMAN-UAT.md` — skipped items
- `.planning/phases/30-group-management-reorder/30-UAT.md`, `30-HUMAN-UAT.md` — skipped items (the VoiceOver ones are dropped per D-07)
- `.planning/phases/31-membership-entry-points/31-UAT.md`, `31-HUMAN-UAT.md` — skipped items
- `.planning/phases/32-durability/32-UAT.md` — all 9 tests skipped; they need the D-06 mock scenarios

### i18n
- `src/i18n/locales/en.json`, `src/i18n/locales/sk.json` — all `groups.*` keys
- `src/i18n/__tests__/translations.test.ts` — existing key-parity and non-empty tests
- `src/features/groups/__tests__/groupI18n.test.ts` — existing plural tests per phase

### Mock server
- `src-tauri/src/fixtures.rs`, `src-tauri/src/mock_server.rs` — scenario pattern (PERS-02/PERS-04) to extend for missing, partial and truncated fetches

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/groups/colors.ts` and its tests: palette tokens with contrast and parity tests already exist. Extend this approach for the D-04 token tests.
- `src/features/groups/GroupTabStrip.tsx`:
  - the overflow state (`canScrollLeft/Right`);
  - `scrollByDir` (200px, respects reduced motion);
  - gradient fades;
  - Chevron buttons with the `groups.scrollLeft/Right` labels;
  - a `role="status"` live region.
- `src/features/groups/GroupTab.tsx`: roving tabindex (`tabIndex={active ? 0 : -1}`), the width-stable bold trick, and `max-w-[160px]` truncation.
- `src/features/groups/GroupPicker.tsx`: list `max-h-60 overflow-y-auto`, used in both detail mode and bar mode.
- `src/features/groups/__tests__/*`: a broad component test suite. New axe and keyboard tests slot in alongside it.

### Established Patterns
- i18next with Slovak `_one/_few/_many/_other` plurals. Zero counts use separate keys.
- Testing uses `@testing-library/react` + `user-event` + vitest. No axe tooling exists yet.
- Errors use sonner toasts. Confirmations use a popover anchored to the trigger. Delete uses a Radix `alertdialog`.

### Integration Points
- The static i18n scan and axe tests live under `src/features/groups/__tests__/` (or `src/i18n/__tests__/` for cross-cutting scans).
- Mock scenarios plug into the existing fixtures scenario switch used by PERS-02/PERS-04.

</code_context>

<specifics>
## Specific Ideas

Copy inconsistencies already found during the discussion. They must be fixed:
- Mixed quotes: SK `‘{{name}}’` in most keys vs `„{{name}}“` in `groups.delete.title` / `groups.move.announce`. EN mixes ‘…’ and “…”.
- `_many` forms are inconsistent across keys (D-16).
- `groups.picker.announceRemoved` (SK) is missing "skupiny".

</specifics>

<deferred>
## Deferred Ideas

- **Manual VoiceOver verification** of group UI (the move announcement, selection live region, picker checkbox states, and the delete alertdialog). The user skipped it for this milestone.
- **Group-seeding dev tooling** for creating many groups quickly. The user skipped it.
- a11y and i18n gaps found in **non-group screens** during the audit are logged here by the executor and not fixed in this phase.
- Undo after delete or bulk actions remains GRP-F1, which was already deferred.

</deferred>

---

*Phase: 33-polish-verification*
*Context gathered: 2026-10-12*
