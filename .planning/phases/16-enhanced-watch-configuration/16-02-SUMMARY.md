---
phase: 16-enhanced-watch-configuration
plan: "02"
subsystem: frontend-settings-ui
tags: [react, typescript, settings, domain-search, i18n, tdd, accessibility]
dependency_graph:
  requires: [16-01]
  provides: [domain-search-ui, bulk-add-watched-users, privacy-warning-banner]
  affects: [watched-users-feature]
tech_stack:
  added: []
  patterns: [tdd-red-green, inline-results-list, bulk-select-checkboxes, cloud-privacy-gating]
key_files:
  created: []
  modified:
    - src/features/connections/SettingsPage.tsx
    - src/features/connections/__tests__/SettingsPage.test.tsx
decisions:
  - Updated local JiraUser interface to support optional name (Server v2) and accountId (Cloud v3) — required for domain search results which use accountId
  - Domain search UI inserted as inline sub-section in watched-users case — no new component file needed (handlers have access to safeWatchedUsers and persistFetchConfigWith)
  - Privacy warning gated to cloudConn non-null — server-only connections never show amber banner per D-04
  - Add selected uses aria-disabled (not disabled) — preserves keyboard tab focus per UI-SPEC accessibility requirements
metrics:
  duration: 18
  completed_date: "2026-03-29"
  tasks_completed: 1
  files_modified: 2
---

# Phase 16 Plan 02: Domain Search UI for Watched Users Settings Summary

Domain search sub-section in SettingsPage Watched Users: domain input with AtSign icon, inline results list with checkboxes and bulk-add, privacy warning banner for Cloud connections, and full TDD coverage.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing tests for domain search feature | c5d5d7a | SettingsPage.test.tsx |
| 1 (GREEN) | Implement domain search UI in SettingsPage | 4ba23de | SettingsPage.tsx |
| 2 | checkpoint:human-verify — visual verification | — | awaiting user |

## What Was Built

### Domain Search State

Six new state variables added to SettingsPage:
- `domainQuery` / `domainResults` — input value and results
- `domainSearchState` — `'idle' | 'loading' | 'results' | 'empty' | 'error'` FSM
- `selectedAccountIds` — Set of selected user IDs for bulk add
- `showPrivacyWarning` — amber banner visibility
- `domainError` — inline error message

### Domain Validation

`isValidDomain(d)` — strips leading `@`, validates against RFC-style domain regex (requires at least one dot, valid label chars).

### Domain Search Handler

`handleDomainSearch()` — async handler that:
- Validates domain format first (shows inline error if invalid)
- Calls `invoke('search_jira_users_by_domain', { domain })`
- On empty results: shows empty state + privacy warning if Cloud connected
- On results: pre-selects all non-watched users; shows privacy warning if all users lack `emailAddress` (Cloud privacy active)
- On error: sets error state with i18n error copy

### Bulk Add Handler

`handleAddDomainResults()` — filters by `selectedAccountIds`, deduplicates against `safeWatchedUsers`, merges into ticketStore, persists via `persistFetchConfigWith`, resets all domain search state.

### UI Sub-section

Inserted in `watched-users` case between individual search and user list:
1. `<Separator className="mt-6 mb-4" />`
2. Sub-heading with `settings.watchedUsers.domainSearch.heading` i18n key
3. Compound input with `AtSign` icon, placeholder "acme.com", "Search domain" button (spinner during loading)
4. Inline error/validation message slot with `id="domain-error"`
5. Results list: header row (count + Select all/Deselect all), user rows with avatars/checkboxes/"Already watching" badges, footer with "Add selected"
6. Empty state text when 0 results and no privacy flag
7. Privacy warning `role="alert"` amber banner with `AlertTriangle` icon

### Type Fix

Local `JiraUser` interface updated from `name: string` to `name?: string` with `accountId?: string` added — aligned with Plan 01's `JiraUser` in `types.ts`. All existing `user.name` references updated to `user.name ?? ''`.

### Accessibility

- Domain input: `aria-label="Search users by email domain"`, `aria-describedby="domain-error"` when error visible
- Results list: `role="list"`, each row `role="listitem"`
- Privacy warning: `role="alert"`
- Search button: `aria-busy="true"` during loading
- Checkboxes: `aria-label="Select {displayName}"`
- Add selected: `aria-disabled="true"` (not `disabled`) when 0 selected

## Verification

- `npm run test -- --run src/features/connections/__tests__/SettingsPage.test.tsx` — 32 tests passed
- `npm run test -- --run` — 536 tests passed, 0 failed
- `npx tsc --noEmit` — clean (no TypeScript errors)
- Task 2: awaiting human visual verification

## Checkpoint Reached

Task 2 is `type="checkpoint:human-verify"`. Human visual verification required before marking plan complete.

## Deviations from Plan

**1. [Rule 1 - Bug] Updated local JiraUser interface for optional name/accountId**
- Found during: Task 1 (GREEN phase)
- Issue: Local `JiraUser` interface in SettingsPage declared `name: string` (non-optional), but Cloud v3 domain search results use `accountId` instead of `name`. Would cause TypeScript issues and incorrect behavior when handling Cloud users.
- Fix: Changed `name: string` to `name?: string` and added `accountId?: string` to match Plan 01's JiraUser type.
- Files modified: `src/features/connections/SettingsPage.tsx`
- Commit: 4ba23de

## Known Stubs

None — all functionality is wired. Mock data is test infrastructure, not production stubs.

## Self-Check: PASSED

- `src/features/connections/SettingsPage.tsx` modified — confirmed (4ba23de)
- `src/features/connections/__tests__/SettingsPage.test.tsx` modified — confirmed (c5d5d7a)
- All 32 SettingsPage tests pass — confirmed
- All 536 total tests pass — confirmed
