# Quick 261021-lxa: Remove row-level Restore buttons Summary

Removed the redundant row-level Restore/Obnoviť text button from ticket rows on the Not mine (Ignored), Watched and Group view pages. Restore now lives only in ticket detail.

## Changes
- `IgnoredTicketsPage.tsx`, `WatchedTicketsPage.tsx`, `GroupViewPage.tsx`: row button removed. Unused `restoreTicket` and `FOCUS_RING` imports removed. Handled badge, remembered-link hint and the linked copiedKey badge are kept.
- In `GroupViewPage.tsx`, the single-child fragment in the nav.watched branch was simplified to the bare hint element.
- Tests updated to assert the row button is absent. Click-Restore row tests were removed (Ignored page, Watched page, Group view). In `a11y.triage.keyboard.test.tsx` the "Not mine row Restore buttons" describe was removed along with its now-unused imports.
- The `ignored.restore` and `watched.restore` locale keys were kept because detail components still use them.

## Commit
- ab168f3: code and tests in a single commit. The pre-commit hook runs the full vitest suite, so the code change could not be committed apart from its test updates.

## Deviations
- Task 1 and Task 2 were combined into one commit (see above).
- A Prettier run formatted a whole file by mistake (the project uses Biome). I reverted that and reapplied the edit, so the final diff contains only the intended change.

## Verification
`tsc --noEmit` is clean. Biome is clean on the edited files. The full pre-commit suite passed: cargo fmt, Biome, frontend tests and Rust tests.

## Self-Check: PASSED
