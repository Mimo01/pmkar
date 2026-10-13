---
phase: quick-261013-foy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/groups/GroupTab.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/features/groups/__tests__/GroupTabStrip.test.tsx
  - src/features/groups/__tests__/groupI18n.test.ts
autonomous: true
requirements: [QUICK-261013-foy]

must_haves:
  truths:
    - "Hovering or keyboard-focusing a group tab in the nav strip shows a tooltip with the group name and its issue count (e.g. 'Sprint 12, 3 issues'), pluralised correctly in EN and SK"
    - "The same tooltip shows a second line saying right-click opens the group options"
    - "The tooltip uses the same shared Radix Tooltip component and default TooltipContent typography as every other tooltip in the app (no custom muted/kbd styling)"
    - "Clicking a scroll arrow with the mouse still does not open a tooltip on a tab or the opposite arrow (WR-01 does not regress)"
  artifacts:
    - path: "src/features/groups/GroupTab.tsx"
      provides: "Two-line group tab tooltip (name+count, right-click hint)"
      contains: "groups.tab.menuHint"
    - path: "src/i18n/locales/en.json"
      provides: "groups.tab.menuHint EN string"
      contains: "groups.tab.menuHint"
    - path: "src/i18n/locales/sk.json"
      provides: "groups.tab.menuHint SK string"
      contains: "groups.tab.menuHint"
  key_links:
    - from: "src/features/groups/GroupTab.tsx"
      to: "groups.tab.aria plural keys"
      via: "t('groups.tab.aria', { name, count: group.memberCount }) reused as tooltip line 1"
      pattern: "groups\\.tab\\.aria"
---

<objective>
Make the group tab tooltip in the navigation strip informative instead of repeating the group name. It should show the name with the issue count, plus a hint that right-click opens the group menu. Keep it consistent with the rest of the app's tooltips.

Purpose: Right now the tooltip only repeats the visible label. Right-click is the only way to reach the group actions (rename, color, move, delete, remove missing), so nothing in the UI tells users those actions exist. Per user preference, actions stay right-click only, with no hover-revealed icons and no extra buttons.
Output: An updated GroupTab tooltip, a new i18n key in EN and SK, and updated tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/features/groups/GroupTab.tsx
@src/components/ui/tooltip.tsx

<findings>
Investigation results, so the executor does not need to re-explore:

- The core nav tabs (AppShell.tsx NAV_TABS) have NO tooltip. Every tooltip in the app (AppShell icon buttons, TicketDetail*, GroupTabStrip scroll arrows, GroupChip, CreateGroupPopover) is the shared `@/components/ui/tooltip` (Radix) with `<TooltipContent aria-hidden="true">` and plain default typography (`text-sm`, popover colors). There are no multi-line tooltips, no `<kbd>` styling and no existing "right-click" phrasing anywhere in the locales. Consistency therefore means: same component, same `aria-hidden="true"` content, default typography, and short sentence-case plain text. Do not add custom colors, kbd chips or font-size changes.
- `src/features/groups/__tests__/groupTokenUsage.test.ts` fails on any `text-brand-muted` in group files (except disabled rows). Do not use muted tokens for the hint line.
- The count already has a pluralised i18n key that the tab's aria-label uses: `groups.tab.aria` → EN "{{name}}, {{count}} issues" (_one "issue"), SK "{{name}}, {{count}} úloh" (_one "úloha", _few "úlohy"), with all of _one/_few/_many/_other present in both files. Reusing it for tooltip line 1 means the tooltip shows exactly what screen readers announce, which keeps the two consistent.
- `group.memberCount` is already on the `Group` prop (types.ts), and the CountPill displays it, so the count costs nothing extra.
- Keyboard users can also open the menu with the ContextMenu key or Shift+F10 (handled in GroupTab handleKeyDown). The hint covers the mouse path. Radix exposes the tooltip text via aria-describedby, so screen-reader users hear the hint as the description.
- i18n tests: `src/i18n/__tests__/translations.test.ts` requires identical key sets in en/sk, no empty values, and SK values that differ from EN. `src/i18n/__tests__/groupLocale.test.ts` enforces the quote style on `groups.*` keys (not relevant for a string with no interpolation, but keep plain text).
- WR-01 (commit 7f5f380) is the pointer-vs-keyboard arrow focus handoff in GroupTabStrip.tsx, guarded by the test "does not hand off focus or open a tooltip when the right arrow was clicked with a pointer". This plan does NOT touch GroupTabStrip.tsx. That test must keep passing.
- The existing test "truncates long names and shows full name in a tooltip on focus" (GroupTabStrip.test.tsx ~line 160) uses `getAllByText('Sprint 12').length > 1`. Two label spans (invisible sizer + visible) already match, so the test passes without any tooltip. Strengthen it in this plan.
</findings>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add the menu-hint i18n key and render the two-line tooltip in GroupTab</name>
  <files>src/i18n/locales/en.json, src/i18n/locales/sk.json, src/features/groups/GroupTab.tsx, src/features/groups/__tests__/groupI18n.test.ts</files>
  <behavior>
    - groupI18n.test.ts: in EN, i18n.t('groups.tab.menuHint') === 'Right-click for options'
    - groupI18n.test.ts: in SK, i18n.t('groups.tab.menuHint') === 'Pravým kliknutím zobrazíte možnosti'
  </behavior>
  <action>
    1. In en.json, add `"groups.tab.menuHint": "Right-click for options"` directly after the `groups.tab.aria_other` line. In sk.json, add `"groups.tab.menuHint": "Pravým kliknutím zobrazíte možnosti"` in the same position. Use sentence case with no trailing period, matching the other short tooltip strings such as "Scroll tabs left" and "Create group".
    2. Add the EN and SK assertions above to groupI18n.test.ts. Put them in a new `describe('groups.tab.menuHint', ...)` that uses the same afterEach `changeLanguage('en')` pattern as the existing `groups.tab.aria plurals` block. Write the tests first and run them to confirm they fail (RED), then add the keys.
    3. In GroupTab.tsx, replace the content of `<TooltipContent aria-hidden="true">{group.name}</TooltipContent>` with two block-level lines inside the same TooltipContent. Keep the `aria-hidden="true"` attribute, keep the shared component and add no className overrides to TooltipContent.
       - Line 1 is a `<span className="block">` containing `t('groups.tab.aria', { name: group.name, count: group.memberCount })`. Compute this once in a local const such as `summary` and reuse it for the button's existing aria-label, so the two cannot drift apart.
       - Line 2 is a `<span className="block">` containing `t('groups.tab.menuHint')`.
       - Do not add muted/secondary color classes, kbd styling or font-size changes. The tooltip should look like every other app tooltip, just with two lines. Do not touch ContextMenu wiring, handleKeyDown or any focus logic. Do not modify GroupTabStrip.tsx, so the WR-01 fix (7f5f380) stays as it is.
    4. Leave GroupChip.tsx (the card chips) unchanged. This request covers the navigation tabs only, and chips have no right-click menu.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && npx vitest run src/features/groups/__tests__/groupI18n.test.ts src/i18n/__tests__ src/features/groups/__tests__/groupTokenUsage.test.ts</automated>
  </verify>
  <done>The menuHint key exists in both locales and the i18n tests pass. GroupTab's TooltipContent renders the name+count line and the hint line, and aria-label uses the same `summary` const.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Strengthen the GroupTabStrip tooltip test and run the full gate</name>
  <files>src/features/groups/__tests__/GroupTabStrip.test.tsx</files>
  <behavior>
    - Focusing or hovering the "Sprint 12, 3 issues" tab opens a tooltip whose text contains "Sprint 12, 3 issues" and "Right-click for options"
    - The existing truncation assertions (truncate class, max-w-[160px] parent) still hold
    - The WR-01 pointer-click test still asserts queryByRole('tooltip') is null, without changes
  </behavior>
  <action>
    Update the test "truncates long names and shows full name in a tooltip on focus" (about line 160). Rename it to "truncates long names and shows name, count and right-click hint in a tooltip". Keep the truncate and max-w assertions. Replace the weak `getAllByText('Sprint 12').length > 1` waitFor with an assertion on the Radix tooltip: `await screen.findByRole('tooltip')`, then expect its textContent to contain 'Sprint 12, 3 issues' and 'Right-click for options'. Radix renders a visually-hidden role="tooltip" copy of the content, which is what the existing WR-01 test queries with `queryByRole('tooltip')`. If `findByRole('tooltip')` cannot find it because of the aria-hidden content, fall back to `waitFor(() => expect(screen.getAllByText('Right-click for options').length).toBeGreaterThan(0))` plus a similar check for the 'Sprint 12, 3 issues' text. Do not edit the WR-01 tests. Then run the whole groups test folder and the full lint/typecheck gate.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && npx vitest run src/features/groups src/i18n src/components/ui && npx tsc --noEmit && npx biome check src/features/groups src/i18n</automated>
  </verify>
  <done>The updated tooltip test passes. All groups, i18n and AppShell tests pass, including the WR-01 pointer test, a11y.axe and groupTokenUsage. tsc and biome report no errors.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user-entered group name → tooltip DOM | Group names are user-supplied text rendered in the tooltip |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-foy-01 | Tampering | GroupTab tooltip rendering of group.name | mitigate | Render through React text nodes and i18next interpolation (escapeValue handled by the existing i18n config, same as aria-label today). No dangerouslySetInnerHTML. |
| T-foy-02 | Information disclosure | Tooltip content | accept | Shows only the local group name and count already visible on the tab. |
</threat_model>

<verification>
- Hovering a group tab in the running app shows "Name, N issues" with "Right-click for options" on the line below, in the standard tooltip style. In SK it shows "Name, N úlohy/úloh" with "Pravým kliknutím zobrazíte možnosti".
- Pointer-clicking the scroll arrows still opens no stray tooltip (WR-01).
</verification>

<success_criteria>
- The group tab tooltip includes the name, the pluralised count and a right-click hint, in EN and SK.
- It uses the same component and typography as every other app tooltip, and the tooltip and aria-label share one source string.
- All vitest suites under src/features/groups, src/i18n and src/components/ui pass, and tsc and biome are clean.
</success_criteria>

<output>
Create `.planning/quick/261013-foy-richer-nav-group-tooltips-count-right-cl/261013-foy-SUMMARY.md` when done
</output>
