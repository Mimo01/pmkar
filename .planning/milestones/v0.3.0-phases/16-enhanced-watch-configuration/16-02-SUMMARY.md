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
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - "Use displayName (not accountId) when adding domain users — consistent with individual user add"
  - "User list placed above domain search for better visual grouping"
  - "Cancel button added to dismiss domain search results"
  - "Privacy warning gated to cloudConn non-null — server-only connections never show amber banner"
  - "Add selected uses aria-disabled (not disabled) — preserves keyboard tab focus"
patterns_established:
  - "Domain search uses displayName as canonical user identifier in watchedUsers"
requirements_completed: [WTCH-01, WTCH-02]
metrics:
  duration: 20
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_modified: 4
---

# Phase 16 Plan 02: Domain Search UI for Watched Users Settings Summary

**Domain search UI with bulk add, privacy warning, inline validation, and cancel in Watched Users settings**

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Add failing tests for domain search feature | c5d5d7a | SettingsPage.test.tsx |
| 1 (GREEN) | Implement domain search UI in SettingsPage | 4ba23de | SettingsPage.tsx |
| 2 | UX fixes from user feedback | 0312443 | SettingsPage.tsx, test, i18n |

## What Was Built

### Domain Search UI
- Domain input with @ icon, company.com placeholder, "Search domain" button (spinner during loading)
- Inline validation error for invalid domain formats
- Results list with user avatars, checkboxes, Select all/Deselect all toggle
- "Already watching" badge for users already in watched list
- "Add selected" bulk action using displayName (consistent with individual add)
- Cancel button to dismiss results without adding
- Amber privacy warning banner when Cloud email visibility is restricted

### Layout Restructure
- User list moved above domain search section for better visual grouping
- Individual search + watched list stay together as primary flow
- Domain search is below as alternative bulk-add method

### Accessibility
- Domain input: `aria-label`, `aria-describedby` for errors
- Results: semantic `<ul>/<li>` elements
- Privacy warning: `role="alert"`
- Checkboxes: `aria-label="Select {displayName}"`

## Verification

- All 536 tests pass (32 SettingsPage tests including 8 domain search tests)
- Biome lint/format clean
- User visual verification completed with feedback incorporated

## Deviations from Plan

**1. accountId vs displayName mismatch**
- Found during: User testing checkpoint
- Issue: Domain add stored accountId (e.g. "5b10ac8d82e05b22cc7d4ef5") while individual add stored displayName
- Fix: Changed all domain search logic to use displayName consistently
- Commit: 0312443

**2. Layout restructure**
- Found during: User testing checkpoint
- Issue: Domain search and user list felt disconnected in separate sections
- Fix: Moved user list above domain search separator

**3. Missing cancel button**
- Found during: User testing checkpoint
- Issue: No way to dismiss domain search results
- Fix: Added handleCancelDomainResults and cancel button

---

**Total deviations:** 3 from user feedback
**Impact on plan:** UX improvements, no scope creep

## Self-Check: PASSED

- All 536 tests pass
- Biome lint/format clean
- User verified and approved fixes
