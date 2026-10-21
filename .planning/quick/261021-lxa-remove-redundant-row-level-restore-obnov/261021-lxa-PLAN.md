---
phase: quick-261021-lxa
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/WatchedTicketsPage.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/tickets/IgnoredTicketsPage.test.tsx
  - src/features/tickets/__tests__/WatchedTicketsPage.test.tsx
  - src/features/groups/__tests__/GroupViewPage.test.tsx
  - src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx
autonomous: true
requirements: [QUICK-261021-lxa]

must_haves:
  truths:
    - "Not mine (Ignored) page rows show no Restore/Obnoviť button; handled badge and remembered-link hint still render"
    - "Watched page rows show no Restore/Obnoviť button; remembered-link hint still renders"
    - "Group view rows with nav.notMine / nav.watched badges show no Restore button; badge, handled badge, hint and nav.linked copiedKey badge still render"
    - "Ticket detail (TicketDetailPanel / TicketDetailPage) Restore buttons are unchanged and remain the single entry point"
    - "Affected vitest files and tsc --noEmit pass"
  artifacts:
    - path: "src/features/tickets/IgnoredTicketsPage.tsx"
      provides: "Ignored rows without row-level restore"
    - path: "src/features/tickets/WatchedTicketsPage.tsx"
      provides: "Watched rows without row-level restore"
    - path: "src/features/groups/GroupViewPage.tsx"
      provides: "Group rows without row-level restore"
  key_links:
    - from: "src/features/tickets/TicketDetailPanel.tsx"
      to: "restoreTicket"
      via: "labelled Restore button in detail (untouched)"
      pattern: "restore"
---

<objective>
Remove the redundant row-level Restore ("Obnoviť") text buttons from ticket rows on the Ignored, Watched and Group view pages. Restore stays available only via the labelled button in ticket detail (per user feedback: one explicit entry point per action, in detail).

Output: three page components with the row button removed, unused imports cleaned, tests updated to assert absence of the row button.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/features/tickets/IgnoredTicketsPage.tsx
@src/features/tickets/WatchedTicketsPage.tsx
@src/features/groups/GroupViewPage.tsx

Facts gathered during planning (no exploration needed):
- IgnoredTicketsPage.tsx: row button at ~L120-129 inside actionSlot (after RememberedLinkHint). `restoreTicket` (L19, from './triageActions') and `FOCUS_RING` (L4, from '@/lib/focusRing') are used ONLY by this button.
- WatchedTicketsPage.tsx: row button at ~L115-124. `restoreTicket` (L19) and `FOCUS_RING` (L4) used ONLY by this button.
- GroupViewPage.tsx: two buttons at ~L165-174 (nav.notMine branch, label ignored.restore) and ~L180-189 (nav.watched branch, label watched.restore). `restoreTicket` (L18) and `FOCUS_RING` (L6) used ONLY by these buttons.
- i18n keys `ignored.restore` / `watched.restore` remain used by detail components and a11y keyboard tests — KEEP them in locale files.
- `restoreTicket` itself (triageActions.ts) stays; still used by detail + triageConsistency tests.

Tests referencing the row button (English label 'Restore'):
- src/features/tickets/IgnoredTicketsPage.test.tsx: L84 'each row has a Restore button', L90 'clicking Restore invokes set_triage_state with seen', L101 'clicking Restore updates triageMap via hydrateTriageMap', L123 'shows the remembered-link hint before Restore...', L144 'Restore still restores in select mode...'.
- src/features/tickets/__tests__/WatchedTicketsPage.test.tsx: L68 'shows hint and only a Restore button per row', L80 'Restore sets seen without relinking'.
- src/features/groups/__tests__/GroupViewPage.test.tsx: L103 (getAllByRole Restore toHaveLength(2) inside a badge test), L106, L130, L142, L157, L183, L453.
- src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx: L397 'group view: Restore is Tab reachable...' and L408 'Not mine page: Restore is Tab reachable...' (both target the row button on GroupViewPage / IgnoredTicketsPage).
- NOT to change: groupDetailTriage.test.tsx (detail Restore), triageConsistency.test.tsx (restoreTicket fn), other a11y keyboard tests that target detail.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove row-level Restore buttons from the three pages</name>
  <files>src/features/tickets/IgnoredTicketsPage.tsx, src/features/tickets/WatchedTicketsPage.tsx, src/features/groups/GroupViewPage.tsx</files>
  <action>
In each file delete the `<button type="button" ...>{t('ignored.restore' | 'watched.restore')}</button>` element inside the actionSlot. Keep everything else in the actionSlot: the handled badge (`tickets.card.handledBadge`), `<RememberedLinkHint variant="row" .../>`, the GroupViewPage `t(badge)` span and the nav.linked copiedKey Badge. In GroupViewPage, the nav.notMine fragment keeps handled badge + hint; the nav.watched fragment keeps just the hint (simplify a single-child fragment to the bare element). Keep the wrapping `div.flex.items-center.gap-2` containers.
Then remove the now-unused imports: `restoreTicket` and `FOCUS_RING` in all three files (verify with grep first that each identifier has no other usage in the file; only remove if zero remaining references). Do NOT touch TicketDetailPanel.tsx, TicketDetailPage.tsx, triageActions.ts, or locale JSON files (ignored.restore / watched.restore stay used by detail). Do not add any hover-revealed icon replacement.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && ! grep -nE "restoreTicket|ignored\.restore|watched\.restore|FOCUS_RING" src/features/tickets/IgnoredTicketsPage.tsx src/features/tickets/WatchedTicketsPage.tsx src/features/groups/GroupViewPage.tsx && grep -c "RememberedLinkHint variant=\"row\"" src/features/groups/GroupViewPage.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>No row Restore button or its imports remain in the three pages; RememberedLinkHint and handled badge still rendered; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Update tests to reflect removal of row Restore</name>
  <files>src/features/tickets/IgnoredTicketsPage.test.tsx, src/features/tickets/__tests__/WatchedTicketsPage.test.tsx, src/features/groups/__tests__/GroupViewPage.test.tsx, src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx</files>
  <action>
IgnoredTicketsPage.test.tsx: replace 'each row has a Restore button' with a test asserting `queryByRole('button', { name: 'Restore' })` is null for the rendered rows. Delete the tests whose sole purpose is clicking the row Restore (L90, L101, L144). Rework L123 to assert the remembered-link hint is present (drop the before-Restore ordering and Restore count assertions).
WatchedTicketsPage.test.tsx: rework L68 to assert hint shown and NO Restore button in the row; delete L80 'Restore sets seen without relinking' (behavior covered by triageConsistency + detail tests).
GroupViewPage.test.tsx: at L103 change to `expect(screen.queryAllByRole('button', { name: 'Restore' })).toHaveLength(0)`. Rework L106 / L130 / L157 to keep badge + hint assertions and assert no Restore button in the card. Delete click-Restore tests L142, L183, L453.
a11y.triage.keyboard.test.tsx: delete the two row-button tests at L397 ('group view: Restore is Tab reachable...') and L408 ('Not mine page: Restore is Tab reachable...'); if their enclosing describe becomes empty, remove the describe and its beforeEach, and then remove any imports/helpers (e.g. GroupViewPage, IgnoredTicketsPage, useGroupStore) that become unused. Keep the `restore` / `restoreWatched` helpers if still referenced by detail tests.
Remove any imports in edited test files that become unused (tsc/eslint must stay clean). Leave SK-translation guard tests and noLiteralStrings test untouched — no new literal strings are introduced.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && npx vitest run src/features/tickets/IgnoredTicketsPage.test.tsx src/features/tickets/__tests__/WatchedTicketsPage.test.tsx src/features/groups/__tests__/GroupViewPage.test.tsx src/features/tickets/__tests__/a11y.triage.keyboard.test.tsx src/features/groups/__tests__/groupDetailTriage.test.tsx src/features/tickets/__tests__/triageConsistency.test.tsx src/features/groups/__tests__/a11y.axe.test.tsx && npx vitest run -t "literal|translation|i18n" && npx tsc --noEmit</automated>
  </verify>
  <done>All listed test files pass; tests now assert absence of row Restore; detail Restore tests unchanged and green; tsc clean.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | UI-only removal; no new input, IPC or data paths |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lxa-01 | Denial of Service | Restore capability | mitigate | Detail Restore buttons untouched; groupDetailTriage + detail tests run in Task 2 verify to prove the entry point still works |
</threat_model>

<verification>
- grep shows no restoreTicket / ignored.restore / watched.restore in the three page files
- Affected vitest files pass, i18n guard tests pass, `npx tsc --noEmit` clean
</verification>

<success_criteria>
Ticket rows on Not mine, Watched and Group view pages no longer show the Restore/Obnoviť text button; Restore remains available in ticket detail; all affected tests and typecheck pass.
</success_criteria>

<output>
Create `.planning/quick/261021-lxa-remove-redundant-row-level-restore-obnov/261021-lxa-SUMMARY.md` when done
</output>
