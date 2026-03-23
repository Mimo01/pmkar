---
phase: 07-internationalization
plan: "02"
subsystem: frontend-i18n
tags: [i18n, translation, react-i18next, string-extraction, settings]
dependency_graph:
  requires: ["07-01"]
  provides: ["complete-translation-packs", "LanguageSection-UI", "locale-aware-formatting"]
  affects: ["all-component-files", "settings-page"]
tech_stack:
  added: []
  patterns:
    - "useTranslation() hook in every component with visible text"
    - "Flat dot-separated translation keys grouped by feature namespace"
    - "formatRelativeTime from lib/format replacing local relativeTime functions"
    - "NAV_TABS and THEME_OPTIONS moved inside component functions to enable t()"
key_files:
  created: []
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/components/ui/AppShell.tsx
    - src/components/ui/StatusBadge.tsx
    - src/features/connections/SettingsPage.tsx
    - src/features/connections/ConnectionCard.tsx
    - src/features/connections/ConnectionForm.tsx
    - src/features/connections/SecretInput.tsx
    - src/features/connections/SetupWizard.tsx
    - src/features/connections/StepProgress.tsx
    - src/features/connections/SummaryStep.tsx
    - src/features/connections/TestResult.tsx
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/TicketTable.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/AuditLogPage.tsx
    - src/features/tickets/CopyPreviewModal.tsx
    - src/features/tickets/CopyResultModal.tsx
    - src/features/tickets/TriageIndicator.tsx
    - src/features/tickets/tabs/OverviewTab.tsx
    - src/features/tickets/tabs/CommentsTab.tsx
    - src/features/tickets/tabs/WorkLogTab.tsx
    - src/features/tickets/tabs/AttachmentsTab.tsx
    - src/features/tickets/tabs/HistoryTab.tsx
    - src/features/dev/DevStatusPanel.tsx
decisions:
  - "audit.close key added for aria-label semantics; tests expected 'Close audit log' which required a dedicated key separate from 'Back' heading text"
  - "OverviewTab field labels (Assignee, Reporter, Status, etc.) left as Jira field names per D-05 — they reflect Jira schema, not UI chrome"
  - "WizardStep.tsx left without useTranslation — component renders only props; all translated strings supplied by SetupWizard caller"
metrics:
  duration: "16 min"
  completed: "2026-03-23"
  tasks: 2
  files: 26
---

# Phase 07 Plan 02: String Extraction and Translation Packs Summary

Complete English and Slovak translation packs (160 keys each) with all 25 production component files updated to use `useTranslation()` for UI strings, LanguageSection dropdown added to SettingsPage, and locale-aware formatting utilities wired throughout.

## What Was Built

**Task 1: Translation packs (en.json + sk.json)**

Built complete translation files with 160 matched keys covering all UI namespaces:
- `nav.*` — navigation labels and API call counter
- `settings.*` — settings page, connections, what-to-fetch, watched users, appearance, language, presets
- `tickets.*` — fetch button, status, columns, empty states, error messages
- `detail.*` — panel tabs, actions, close button
- `copy.*` — preview modal, result modal, all step labels
- `ignored.*` — ignored tickets page
- `audit.*` — audit log page
- `error.*` — user-facing error messages
- `wizard.*` — setup wizard steps
- `connection.*` — form fields, test results, URL validation errors, secret input

Slovak translations use proper Unicode diacritics (not ASCII approximations).

**Task 2: Component string extraction**

All 25 component files updated:
- `useTranslation()` hook added with `t()` replacing every hardcoded UI string
- `NAV_TABS` constant moved from module-level to inside `AppShell` component function to enable reactive `t()` calls
- `THEME_OPTIONS` and `PRESET_OPTIONS` arrays moved inside their component functions to enable `t()`
- `LanguageSection` function component created in SettingsPage, placed below `ThemeSection` per D-01 and UI-SPEC
- Native `<select>` with `py-2.5` class (inherited project-wide deviation) for language dropdown
- `relativeTime` local functions removed from `TicketListPage`, `TicketTable`, `IgnoredTicketsPage`; replaced with `formatRelativeTime` from `lib/format`
- `formatTimestamp` local function removed from `AuditLogPage`; replaced with `formatTimestamp` from `lib/format`
- `formatDate` local function removed from `WorkLogTab` and `HistoryTab`; replaced with `formatDate` from `lib/format`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added audit.close key for test compatibility**
- **Found during:** Task 2 verification (vitest run)
- **Issue:** AuditLogPage test expected `aria-label="Close audit log"` but plan specified `t('audit.back')` for the close button, which returns `"Back"` — breaking the existing test
- **Fix:** Added `audit.close: "Close audit log"` (EN) and Slovak equivalent to both JSON files; used `t('audit.close')` for the aria-label
- **Files modified:** `src/i18n/locales/en.json`, `src/i18n/locales/sk.json`, `src/features/tickets/AuditLogPage.tsx`
- **Commit:** 9677302

## Known Stubs

None — all translation keys are fully wired to actual translated values in both en.json and sk.json.

## Self-Check: PASSED

Files verified:
- FOUND: src/i18n/locales/en.json (160 keys)
- FOUND: src/i18n/locales/sk.json (160 keys, matching)
- FOUND: src/features/connections/SettingsPage.tsx (contains LanguageSection, useLanguageStore, py-2.5)
- FOUND: Commits 279073f (Task 1) and 9677302 (Task 2)
- All 87 vitest tests pass
