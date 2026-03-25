---
phase: quick
plan: 260325-wet
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
  - src/features/tickets/__tests__/CopyResultPage.test.tsx
  - src/features/tickets/__tests__/TicketFilterBar.test.tsx
  - src/features/update/__tests__/UpdateModal.test.tsx
  - src/features/update/__tests__/VersionHistoryModal.test.tsx
  - src/features/update/__tests__/AboutSection.test.tsx
  - src/features/connections/__tests__/SettingsPage.test.tsx
  - src/features/connections/SetupWizard.test.tsx
  - src/features/connections/__tests__/connectionStore.test.ts
  - src/features/theme/__tests__/themeStore.test.ts
  - src/__tests__/App.test.tsx
autonomous: true
requirements: [coverage-fix]

must_haves:
  truths:
    - "npm run test:coverage passes all threshold checks (lines>=80, functions>=75, branches>=65, statements>=79)"
    - "All existing tests continue to pass (no regressions)"
    - "CI pipeline succeeds with coverage thresholds met"
  artifacts:
    - path: "src/features/tickets/__tests__/CopyPreviewPage.test.tsx"
      provides: "Tests for CopyPreviewPage (currently 0% coverage)"
    - path: "src/features/tickets/__tests__/CopyResultPage.test.tsx"
      provides: "Tests for CopyResultPage (currently 0% coverage)"
  key_links:
    - from: "vitest.config.ts"
      to: "coverage thresholds"
      via: "thresholds config"
      pattern: "lines: 80"
---

<objective>
Add tests to bring frontend coverage above CI thresholds. Currently failing at lines 69.43% (need 80%), functions 65.52% (need 75%), branches 55.99% (need 65%), statements 68.31% (need 79%).

Purpose: Unblock the CI pipeline which fails on coverage thresholds.
Output: New and expanded test files that push all four coverage metrics above their thresholds.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@vitest.config.ts (coverage thresholds: lines 80, functions 75, branches 65, statements 79)
@src/test-setup.ts (jsdom env, i18n loaded, crypto polyfill)
@src/test-utils/renderWithI18n.tsx (render helper wrapping I18nextProvider)
@.github/workflows/ci.yml (pipeline runs npm run test:coverage)

Coverage deficit analysis (current -> threshold):
- Lines: 69.43% -> 80% (need +10.6%)
- Functions: 65.52% -> 75% (need +9.5%)
- Branches: 55.99% -> 65% (need +9%)
- Statements: 68.31% -> 79% (need +10.7%)

Highest-impact uncovered files:
1. CopyPreviewPage.tsx — 0% (328 lines, NO test file)
2. CopyResultPage.tsx — 0% (133 lines, NO test file)
3. TicketFilterBar.tsx — 29.57% (241 lines, needs async autocomplete + keyboard nav tests)
4. UpdateModal.tsx — 33.33% (165 lines, needs downloading/installing/error states)
5. SettingsPage.tsx — 52.05% (916 lines, large — needs section navigation, JQL, watched users, projects)
6. SetupWizard.tsx — 57.14% (needs multi-step flow coverage)
7. App.tsx — 65.67% (needs route branch tests)
8. AboutSection.tsx — 64.1% (needs version display, changelog tests)
9. VersionHistoryModal.tsx — 75% (needs edge case branches)
10. connectionStore.ts — 60% (needs action coverage)
11. themeStore.ts — 73.91% (needs system theme + persistence)

<interfaces>
Key types from src/features/tickets/types.ts:
- JiraTicketDetail: full ticket with fields.summary, fields.status, fields.priority, fields.assignee, fields.labels, fields.comment.comments, fields.attachment, fields.subtasks, fields.issuelinks, renderedFields
- CopyPhase: 'idle' | 'loading_preview' | 'previewing' | 'copying' | 'result'
- CopyStepResult: { step: string, success: boolean, detail: string | null }
- CopyTicketResult: { targetKey: string | null, targetUrl: string | null, steps: CopyStepResult[] }
- CloudMeta: { availableStatuses: {id,name}[], availablePriorities: {id,name}[], currentAccountId, cloudBaseUrl }
- TriageEntry: { state: TriageState, copiedKey: string | null }

Key stores:
- useCopyStore (from src/features/tickets/copyStore.ts): phase, sourceTicket, cloudMeta, targetSummary, etc.
- useConnectionStore: serverConnection, cloudConnection, targetProjectName, sourceProjectKey, targetProjectKey
- useUpdateStore: status ('idle'|'available'|'downloading'|'installing'|'error'), updateInfo, progress, errorMessage
- useTicketStore: tickets, triageMap, fetchStatus, etc.
- useThemeStore: mode ('light'|'dark'|'system'), setMode
- useLanguageStore: language, setLanguage

Test patterns established in this codebase:
- vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() })) at top level
- Use renderWithI18n() for components using useTranslation
- Use zustand setState() to set up store state before render
- Use @testing-library/react screen queries and fireEvent/userEvent
- vi.mocked(invoke) for typed mock assertions
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create tests for 0%-coverage pages (CopyPreviewPage, CopyResultPage)</name>
  <files>
    src/features/tickets/__tests__/CopyPreviewPage.test.tsx
    src/features/tickets/__tests__/CopyResultPage.test.tsx
  </files>
  <action>
Create comprehensive tests for the two files with 0% coverage — these represent the biggest single improvement opportunity (~461 lines going from 0% to high coverage).

**CopyPreviewPage.test.tsx** — Mock `@tauri-apps/api/core`. Set up useCopyStore and useConnectionStore state before each test. Test these scenarios:
1. Renders loading state when phase='loading_preview' (shows Loader2 spinner with "Loading preview" aria-label)
2. Renders preview with source and target panels when phase='previewing' and sourceTicket + cloudMeta are set
3. Source panel shows ticket summary, status badge, priority icon, assignee with avatar, labels list
4. Source panel shows attachments count when attachments exist
5. Source panel shows comments count when comments exist
6. Source panel shows sub-tasks when subtasks exist
7. Source panel shows linked issues (both inward and outward)
8. Source panel shows description via DescriptionRenderer
9. Target panel has editable summary input that calls setTargetSummary on change
10. Target panel has status dropdown populated from cloudMeta.availableStatuses
11. Target panel has priority dropdown populated from cloudMeta.availablePriorities
12. Target panel has label checkboxes that call toggleLabel
13. Target panel has editable description textarea
14. Discard button calls reset()
15. Confirm button calls confirmCopy() with correct URLs
16. Confirm button disabled when phase='copying' or phase='loading_preview'
17. Shows progress bar with step text when phase='copying'
18. Content area has opacity-50 when copying
19. Test getProgressPercent helper: '' -> 0, 'creating' -> 20, 'description' -> 40, 'attachment' -> 60, 'comment' -> 80, 'done' -> 100, 'unknown' -> 20

Build a `makeTicketDetail()` factory that creates a full JiraTicketDetail with all required fields. Build a `makeCloudMeta()` factory for CloudMeta. Set up store state before each render.

**CopyResultPage.test.tsx** — Mock `@tauri-apps/api/core`. Set up useCopyStore and useConnectionStore state. Test:
1. Shows "Copy complete" heading when all steps succeeded (allPassed=true)
2. Shows "Copy completed with errors" heading when some steps failed
3. Shows targetKey when present
4. Shows green check icons for successful steps and red X for failed steps
5. stepLabel() renders correct text for each step type: create_issue, convert_description, upload_image*, add_remote_link, attach:*, comment:*, worklog:*, subtask:*
6. Shows error detail text for failed steps
7. "Open in Jira" button calls invoke('open_external_url') with targetUrl — only shown when issueCreated and targetUrl exist
8. "Close" button calls invoke('get_triage_state') then reset()
9. "Open in Jira" button hidden when create_issue step failed

Use renderWithI18n() for all renders. Follow existing test patterns (vi.mock at top, mockInvoke, store setState in beforeEach).
  </action>
  <verify>
    <automated>npx vitest run src/features/tickets/__tests__/CopyPreviewPage.test.tsx src/features/tickets/__tests__/CopyResultPage.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>CopyPreviewPage.tsx coverage above 80% lines and CopyResultPage.tsx coverage above 80% lines. Both test files pass with no failures.</done>
</task>

<task type="auto">
  <name>Task 2: Expand tests for low-coverage files (TicketFilterBar, UpdateModal, SettingsPage, SetupWizard, App)</name>
  <files>
    src/features/tickets/__tests__/TicketFilterBar.test.tsx
    src/features/update/__tests__/UpdateModal.test.tsx
    src/features/connections/__tests__/SettingsPage.test.tsx
    src/features/connections/SetupWizard.test.tsx
    src/__tests__/App.test.tsx
    src/features/update/__tests__/AboutSection.test.tsx
    src/features/update/__tests__/VersionHistoryModal.test.tsx
    src/features/connections/__tests__/connectionStore.test.ts
    src/features/theme/__tests__/themeStore.test.ts
  </files>
  <action>
Expand existing test files to cover uncovered branches and functions. Read each existing test file first to understand what is already covered, then add tests for the UNCOVERED lines shown in the coverage report.

**TicketFilterBar.test.tsx** (currently 29.57% — needs async autocomplete coverage):
- Add tests for: typing in assignee input triggers debounced invoke('search_jira_users'), suggestion dropdown appears with user list, keyboard navigation (ArrowDown/ArrowUp/Enter/Escape), selecting a user from suggestions, click-outside closes dropdown, empty query clears suggestions. Mock invoke to return JiraUser[]. Use vi.useFakeTimers() for debounce testing with vi.advanceTimersByTime(250). Need to set useConnectionStore serverConnection for baseUrl.

**UpdateModal.test.tsx** (currently 33.33% — needs state coverage):
- Add tests for: installing state shows progress bar and "Installing..." text, error state shows error message and "Try Again" button, "Try Again" calls handleUpdate again, escape key prevented during downloading state, "Update Now" triggers downloadAndInstall with progress handler, dialog onOpenChange only dismisses when not actively downloading/installing. Mock relaunch from @tauri-apps/plugin-process.

**SettingsPage.test.tsx** (currently 52.05% — large file, many uncovered sections):
Read the existing test file fully first. Add tests for uncovered sections:
- JQL Presets section: clicking JQL preset buttons calls invoke('save_fetch_config'), custom JQL textarea appears when 'custom' preset selected
- Watched Users section: adding/removing watched users, save calls invoke
- Theme section: clicking theme mode buttons updates themeStore
- Language section: language selector changes language
- Project selectors: render loading/error/success states, selecting a project calls store action
- About section renders within settings
- Back/close button calls onClose

**SetupWizard.test.tsx** (currently 57.14%):
Read existing test file first. Add tests for uncovered wizard steps and transitions — particularly the credential storage step (step 3+), error handling in store_credential invoke, and the final summary/completion step.

**App.test.tsx** (currently 65.67%):
Read existing test file. Add tests for uncovered route branches: settings view branch, ticket detail page branch (selectedTicketKey set), copy preview phase branch, copy result phase branch.

**AboutSection.test.tsx** (currently 64.1%):
Add tests for: version display, about modal open/close, version history modal trigger, error state handling.

**VersionHistoryModal.test.tsx** (if exists, check coverage):
Add tests for uncovered branches — loading state, error state, empty changelog.

**connectionStore.test.ts** (currently 60%):
Add tests for uncovered store actions — particularly setServerConnection, setCloudConnection, and project key persistence actions.

**themeStore.test.ts** (currently 73.91%):
Add tests for system theme detection, theme persistence, and the setMode action with all three modes.

IMPORTANT: Read each existing test file before modifying to avoid duplicating tests. Only add NEW test cases for uncovered code paths. Run `npx vitest run --coverage` after all changes to verify improvement.
  </action>
  <verify>
    <automated>npx vitest run --coverage 2>&1 | tail -20</automated>
  </verify>
  <done>All four coverage thresholds pass: lines >= 80%, functions >= 75%, branches >= 65%, statements >= 79%. All tests pass. `npm run test:coverage` exits with code 0.</done>
</task>

<task type="auto">
  <name>Task 3: Verify full pipeline and fix any remaining coverage gaps</name>
  <files>
    (any test files that need final adjustments based on coverage report)
  </files>
  <action>
Run the full test suite with coverage and check if all thresholds are met. If any threshold is still below target:

1. Run `npx vitest run --coverage` and examine the output table
2. Identify remaining files with lowest coverage that are dragging down the overall numbers
3. Add targeted tests for the specific uncovered lines/branches shown in the report
4. Re-run coverage to confirm thresholds pass

Pay special attention to BRANCH coverage (hardest to hit at 65% threshold from current 55.99%) — this requires testing conditional rendering paths, ternary operators, optional chaining fallbacks, and if/else branches.

If coverage is close but not quite meeting thresholds, consider:
- Adding branch-specific tests for components with many conditional renders (e.g., ternary expressions, && short-circuits)
- Testing error/fallback states that aren't covered
- Testing both truthy and falsy paths of each conditional

Run `npm run lint` and `npx tsc --noEmit` to confirm no lint or type errors were introduced.

Final validation: run `npm run test:coverage` exactly as CI does and confirm exit code 0.
  </action>
  <verify>
    <automated>npm run test:coverage 2>&1 | tail -25</automated>
  </verify>
  <done>npm run test:coverage exits with code 0. All four thresholds met. No lint or type errors. Pipeline will pass.</done>
</task>

</tasks>

<verification>
Run the same commands CI uses:
1. `npm run lint` — no errors
2. `npx tsc --noEmit` — no type errors
3. `npm run test:coverage` — all thresholds pass (lines>=80, functions>=75, branches>=65, statements>=79)
</verification>

<success_criteria>
- `npm run test:coverage` exits with code 0 (all coverage thresholds met)
- All existing tests continue to pass (no regressions)
- No lint errors (`npm run lint` clean)
- No type errors (`npx tsc --noEmit` clean)
- CopyPreviewPage.tsx and CopyResultPage.tsx have test files with meaningful coverage
</success_criteria>

<output>
After completion, create `.planning/quick/260325-wet-add-tests-to-improve-pipeline-coverage/260325-wet-SUMMARY.md`
</output>
