---
status: testing
phase: 33-polish-verification
source: [29-UAT.md, 29-HUMAN-UAT.md, 30-UAT.md, 30-HUMAN-UAT.md, 32-UAT.md, 32-HUMAN-UAT.md, 33-01-SUMMARY.md, 33-02-SUMMARY.md, 33-03-SUMMARY.md, 33-04-SUMMARY.md, 33-05-SUMMARY.md, 33-06-SUMMARY.md, 33-07-SUMMARY.md, 33-08-SUMMARY.md, 33-09-SUMMARY.md]
started: 2026-10-12T00:00:00Z
updated: 2026-10-12T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Populated group view with triage badges
expected: |
  (from 29-UAT #5) A group with members shows a flat list of issue cards (no sub-sections), each with a pill: New / Dismissed / Already Linked / Done. Dismissed cards offer Restore.
awaiting: user response

## Setup

Consolidated v0.5.0 Custom Groups milestone UAT (phases 29-33). Reviewed once, at milestone end. Tests are ordered by feature area, not by phase. Screen-reader checks are out of scope (see "Dropped").

1. Start the app: `npm run tauri:dev` (mock-server feature; v2 mock at http://localhost:8080, any Bearer token is accepted, use a dummy one such as `x`).
2. Create 2-3 groups by hand with the + control (no seeding tooling). Add a handful of issues to them using the in-app add-to-group UI (select mode, issue detail groups row, or picker). Keep at least one group with 6+ issues so 5+ count forms can be seen.
3. Toggle dark theme and language from the app settings (theme: light / dark; language: English / Slovensky). Tests in D and F say which to use.
4. Mock scenario commands (run in a terminal; the app polls/fetches, so trigger a fetch after each change):

```
H='Authorization: Bearer x'; C='Content-Type: application/json'
# Drop PROJ-1 from search (GET issue still works) -> missing hint
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"drop","keys":["PROJ-1"]}'
# One user's batch returns 500 -> incomplete fetch, no hints
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"partial_fail","assignee":"csmith"}'
# >1000 matches -> truncated, no hints
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"truncated"}'
# Reset to default
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"default"}'
# Show current scenario
curl localhost:8080/__mock/scenario -H "$H"
# Mutate a grouped issue (snapshot refresh); unknown key -> 404
curl -X POST localhost:8080/__mock/mutate -H "$H" -H "$C" -d '{"key":"PROJ-1","summary":"Changed by mock","status":"In Review"}'
```

   Env alternative at startup: `PMKAR_MOCK_SCENARIO=default|drop|partial_fail|truncated npm run tauri:dev`, with `PMKAR_MOCK_DROP_KEYS=PROJ-1` (default) and `PMKAR_MOCK_FAIL_ASSIGNEE=csmith` (default). An unknown value logs a warning and falls back to default.
5. For missing-state tests (C), PROJ-1 must be a member of at least one group before you set the `drop` scenario. Put at least two issues in the group so the "present members stay" part can be checked.

## Tests

### 1. Populated group view with triage badges
expected: (from 29-UAT #5, merged with 29-HUMAN-UAT #2) A group with members shows a flat list of issue cards (no sub-sections), each with a pill: New / Dismissed / Already Linked / Done. Dismissed cards offer Restore. An empty group shows "No issues in this group yet" with a line explaining how issues get added. Members are added via the in-app UI (no devtools seeding needed now).
result: [pending]

### 2. Live triage sync between group view and core tabs
expected: (from 29-UAT #6, merged with 29-HUMAN-UAT #2) Dismiss a card in the group view, then switch to New: it is gone from New and appears under Dismissed. Restore it (from the group view or the Dismissed page): the pill flips back to New and it reappears on the New tab immediately, no reload.
result: [pending]

### 3. Filter bar in group view
expected: (from 29-UAT #7) The group view has the same filter/search bar as the core lists. Typing a search or applying a filter narrows the group's cards the same way it does on the New tab.
result: [pending]

### 4. Create group with a color (re-check of reported issue)
expected: (from 30-UAT #1) Clicking + in the tab strip opens a popover with a "Create group" button and a row of 8 color swatches, one preselected. ALL 8 swatches render a visible color, in BOTH light and dark theme (originally reported: "some colors are not rendering, some are"; fixed in 30-08, user re-confirmed light theme 2026-10-12). Picking a different swatch (click or arrow keys) and creating the group adds a new tab showing that color on its dot. Repeat once in the other theme.
result: [pending]

### 5. Missing member shown dimmed in group view
expected: (from 32-UAT #1, merged, from 32-HUMAN-UAT #1) Before: put PROJ-1 in a group, then run the `drop` scenario curl (Setup step 4) and trigger a fetch. After a complete fetch that no longer returns PROJ-1, the group view shows it under a "No longer in results (N)" subheading as a dimmed card from snapshot, with the hint line ("No longer in results") and a labelled Remove button. Present members render normally. After: leave the `drop` scenario active for tests 6-8.
result: [pending]

### 6. Per-card Remove with confirm
expected: (from 32-UAT #2) With `drop` active (PROJ-1 missing): clicking Remove on the missing card opens a confirm popover with Cancel focused. Cancel closes it with no change. Remove removes only that issue from the group (success toast); the missing count drops by one, and the popover does not re-open on its own later. After: re-add PROJ-1 to the group if needed (switch back with the `default` scenario, re-add, then `drop` again) so tests 7 and 8 have a missing member.
result: [pending]

### 7. Remove all missing from the group view header
expected: (from 32-UAT #3, merged, from 32-HUMAN-UAT #3) With 1+ missing member (use `PMKAR_MOCK_DROP_KEYS` or the `keys` array in the `drop` curl to drop two keys, e.g. `"keys":["PROJ-1","PROJ-2"]`). The missing block shows "Remove all missing (N)". Clicking it opens a confirm popover; confirming removes all missing members in one action, the missing block disappears, present members stay. Focus handling after removal is acceptable.
result: [pending]

### 8. Remove all missing from the tab menu
expected: (from 32-UAT #4, merged, from 32-HUMAN-UAT #3) Re-create the missing state (as in test 7). The group tab "…" menu shows "Remove all missing (N)" above Delete when the group has missing members (absent otherwise). Choosing it opens a confirm popover anchored to the tab; confirming removes them, and focus returns to the group tab trigger. After: run the `default` scenario curl to switch back to default.
result: [pending]

### 9. No hints after the JQL preset changes (not yet fetched)
expected: (from 32-UAT #5a, merged, from 32-HUMAN-UAT #2) Before: re-create a missing state with the `drop` scenario and confirm hints show. Then change the JQL preset/query WITHOUT fetching: no missing hints or Remove buttons appear in any group. Hints return after the next complete fetch for the current query. After: switch back to default.
result: [pending]

### 10. No hints on a partial fetch
expected: (from 32-UAT #5b, merged, from 32-HUMAN-UAT #2) Before: run the `partial_fail` scenario curl (assignee csmith) and trigger a fetch. The fetch is incomplete (one batch fails): no missing hints appear in any group. Run the `default` scenario curl and fetch again: behavior returns to normal (hints only if members are actually missing).
result: [pending]

### 11. No hints on a truncated fetch
expected: (from 32-UAT #5b, merged, from 32-HUMAN-UAT #2) Before: run the `truncated` scenario curl and trigger a fetch (>1000 matches). The fetch is truncated: no missing hints appear. After: run the `default` scenario curl.
result: [pending]

### 12. Snapshot refresh after fetch
expected: (from 32-UAT #6) Before: with a grouped issue PROJ-1 visible in a group, run the mutate curl (`summary: "Changed by mock"`, `status: "In Review"`) and trigger a fetch. The group view shows the updated summary and status. Group membership is unchanged (nothing added or removed by the fetch). A mutate for an unknown key returns 404.
result: [pending]

### 13. Server switch clears the old list
expected: (from 32-UAT #7, merged, from 32-HUMAN-UAT #4) Switching to a different server clears the ticket list (no tickets from the old server remain), and groups show no missing hints derived from the old server's results. Do this once with the `drop` scenario active so a hint existed before the switch.
result: [pending]

### 14. Remove disabled while a fetch is loading
expected: (from 32-UAT #8, merged, from 32-HUMAN-UAT #4) With a missing member visible, click Remove on the card (or Remove all missing) while a poll fetch is loading: nothing is removed mid-fetch; after the fetch completes the actions work again. JUDGE: the in-flight click is currently a silent no-op (WR-08). Is that acceptable, or should it show feedback? Record your verdict in the result.
result: [pending]

### 15. Slovak plurals: tab, delete dialog, chip
expected: (from 32-UAT #9 and D-05) Set language to Slovensky. For groups holding 1, 2-4 and 5+ issues check each count-bearing string uses the right form: tab aria/count ("1 úloha", "2-4 úlohy", "5+ úloh"); delete-group dialog body ("V tejto skupine je 5 úloh. Samotné úlohy sa nezmenia." for 5+); chip +N overflow ("ďalších skupín" for 5+, "ďalšie skupiny" for 2-4). Group nouns: skupina / skupiny / skupín. Quotes around names are „…“ (low-high), never ‘…’.
result: [pending]

### 16. Slovak plurals: selection bar, remove confirm, toasts
expected: (from D-05) In Slovak with 1, 2-4 and 5+ selected: selection bar count (vybraná / vybrané / vybraných); bar remove confirm ("Odstrániť 5 úloh…"); toast after add (Pridaných 5 úloh…) and after remove (Odstránených 5 úloh…); the add-with-skipped toast uses the same forms. Names use „…“ quotes.
result: [pending]

### 17. Slovak missing-state copy
expected: (from 32-UAT #9) In Slovak: the missing-block heading, hint line, Remove, "Remove all missing" (header and tab menu) and both confirm popovers are translated, with correct plural forms for 1, 2-4 and 5+ missing items (use `keys` with 1, 3 and 5+ entries in the `drop` curl).
result: [pending]

### 18. Slovak wording spot-check (33-01 audit)
expected: (D-14, from 33-01 "SK audit changes") Spot-check each changed string reads naturally: tab.aria_many "{{name}}, {{count}} úloh"; delete.body_many "V tejto skupine je {{count}} úloh…"; chip.moreAria_many "{{count}} ďalších skupín…"; bar.count_many "{{count}} vybraných"; bar.removeConfirm_many "Odstrániť {{count}} úloh…"; toast.added_many / addedWithSkipped_many "Pridaných {{count}} úloh…"; toast.removed_many "Odstránených {{count}} úloh…"; picker.announceRemoved "Odstránené zo skupiny „{{name}}“"; picker.announceAdded "Pridané do skupiny „{{name}}“" (this announceAdded wording change was made for consistency and was not requested by the plan; confirm you accept it). EN counterparts use “…” quotes.
result: [pending]

### 19. Keyboard: tab strip arrow navigation
expected: (33-09, decision approved 2026-10-12) Left/Right/Home/End move focus across core tabs and group tabs (no wrap, no activation: focus moves, Enter/Space activates). This is a focus accelerator ONLY: every tab stays in the Tab order (pressing Tab still steps through each tab), and the Phase 29 lock (no roving tabindex) is preserved. CONFIRM this behavior is acceptable.
result: [pending]

### 20. Keyboard: tab menu, rename, color, delete with focus return
expected: (33-09 matrix) Keyboard only: focus a group tab, open the `…` menu (Enter on the button, or Shift+F10 on the tab). Rename…, Change color… and Delete group… are reachable by arrows and Enter. Each popover/dialog traps focus appropriately; Esc closes it and focus returns to the tab or `…` trigger; after Delete the app switches to New (if active) or focuses a neighbouring tab. Move left/right keep focus on the moved tab.
result: [pending]

### 21. Keyboard: create popover and picker
expected: (33-09 matrix) Keyboard only: reach + and open the create popover; type a name, arrow between 8 swatches, Enter creates; Esc cancels and focus returns to +. Open the group picker in both detail mode and bar mode: search field is reachable, checkboxes toggle with Space, Esc closes and focus returns to the trigger.
result: [pending]

### 22. Keyboard: select mode, Shift+Space range select (real app)
expected: (33-09, jsdom only so far) In the real app (WKWebView), enter select mode with the keyboard. Space on a card checkbox toggles it; Shift+Space (and Shift+Enter) on a later card selects the whole range from the last toggled card, as Shift+click does. This was verified only in jsdom, so this is the real check. Esc inside the filter text input does NOT exit select mode.
result: [pending]

### 23. Keyboard: selection bar and Esc everywhere
expected: (33-09 matrix) Tab reaches every selection bar control (Add to group, Remove, Clear) in a logical order; the add-to-group picker works as in test 21. Esc from Add to group exits cleanly and focus returns sensibly. NOTE: Esc from the focused Clear button needs TWO presses (the first dismisses its tooltip, the second exits select mode). CONFIRM this is acceptable. Esc closes every popover/menu/dialog it should, one layer at a time.
result: [pending]

### 24. Theme pass: light
expected: (33-02, 33-04..33-07) In light theme walk through: tab strip (active/inactive/hover, group dots), focus rings on tabs, buttons and swatches (clearly visible), chips, dimmed missing cards with hint line and Remove (hint legible; dimmed card still readable), the red Delete group item and inline errors (legible red), picker checkboxes (checked/unchecked clearly distinct). Nothing is conveyed by color alone.
result: [pending]

### 25. Theme pass: dark
expected: (33-02, 33-04..33-07) Repeat test 24 in dark theme: tabs, focus rings, chips, dimmed missing cards with hint and Remove, destructive Delete item and inline errors (lighter red text), picker checkboxes. All 8 group colors distinguishable on the dark background.
result: [pending]

### 26. Global focus ring on a non-group screen (dark)
expected: (33-02 side effect) The dark-theme global `--color-ring` changed from #c02232 to #e5484d for contrast, which affects ALL shadcn Button/Input focus rings app-wide. In dark theme, Tab through a non-group screen (e.g. Settings fields and buttons, filter inputs). Focus rings are clearly visible and the slightly brighter red looks acceptable. CONFIRM the change.
result: [pending]

### 27. Popovers unchanged after aria-label additions
expected: (33-08) Seven popovers/dialogs gained accessible names (rename, change color, create, picker in checkbox and list modes, chip-remove confirm, selection-bar remove confirm, missing Remove confirm). Open each and confirm look, position and behavior are unchanged (aria-labels are not visible). No tooltips or stray text appear.
result: [pending]

## Dropped

Per D-07 (VoiceOver deferred, not part of this milestone UAT):
- 30-UAT #5 (VoiceOver move announcement), originally skipped
- 30-HUMAN-UAT #1 (VoiceOver Move left/right), originally skipped

## Notes

- 33-08: the axe `region` rule is disabled file-wide in the jsdom axe tests (documented false positive on isolated component mounts); app landmarks are out of GQA-02 scope. No action needed in this UAT.
- 31-UAT / 31-HUMAN-UAT: all passed, nothing carried over.

## Summary

total: 27
passed: 0
issues: 0
pending: 27
skipped: 0
blocked: 0

## Gaps

