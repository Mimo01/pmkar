# Quick 261013-foy Summary

Group tab tooltip now shows "Name, N issues" (pluralised, EN/SK) plus a second line "Right-click for options" using the shared Radix tooltip with default typography.

- Added `groups.tab.menuHint` to en.json and sk.json.
- GroupTab.tsx: shared `summary` const used for aria-label and tooltip line 1.
- Tests: i18n menuHint tests (RED then GREEN); tooltip test strengthened.

## Deviations
- Task 2 used the plan's fallback (getAllByText) because findByRole('tooltip') did not find the aria-hidden content.
- Both tasks committed in one commit (c35632b); a node_modules symlink to the main repo was used for running tests (untracked, not committed).

## Verification
vitest groups/i18n/ui: 658 passed; tsc clean; biome no errors (pre-existing warnings only). WR-01 test untouched and passing.
