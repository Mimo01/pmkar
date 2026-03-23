# Phase 7: Internationalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 07-internationalization
**Areas discussed:** Language switcher placement, Translation string coverage, Date and number formatting, Language persistence

---

## Language Switcher Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page only | Add Language section to SettingsPage. Low-profile, set once and forget. | ✓ |
| Header dropdown | Small EN/SK indicator in AppShell header for quick access. | |
| Both places | Header for quick switching, settings for discoverability. | |

**User's choice:** Settings page only
**Notes:** Consistent with existing settings pattern. User previewed the ASCII mockup.

---

## Translation String Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| UI chrome only | Nav labels, buttons, headings, empty states. Jira fields stay English. | |
| UI chrome + app errors | All UI text plus app-generated error messages. Jira API responses as-is. | ✓ |
| Everything possible | UI chrome, app errors, and attempt to localize Jira field labels. | |

**User's choice:** UI chrome + app errors
**Notes:** None

---

## Date and Number Formatting

| Option | Description | Selected |
|--------|-------------|----------|
| Full locale formatting | Dates/numbers adapt via Intl API. Slovak dates, locale separators. | ✓ |
| Dates only | Date formatting adapts, numbers keep universal format. | |
| No formatting changes | Only text labels translated. Dates/numbers always same. | |

**User's choice:** Yes, full locale formatting
**Notes:** None

---

## Language Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri store/config file | Persist via Tauri app config. Survives restarts. | |
| localStorage | Simple browser storage. Less robust. | |
| OS locale detection + override | Default to OS locale on first launch, allow override in settings. | ✓ |

**User's choice:** OS locale detection + override
**Notes:** Combined with "Detect from OS locale" for default language selection.

## Default Language

| Option | Description | Selected |
|--------|-------------|----------|
| English always | Always start in English on first launch. | |
| Detect from OS locale | If OS is Slovak, default to Slovak. Otherwise English. | ✓ |
| You decide | Claude picks best approach. | |

**User's choice:** Detect from OS locale
**Notes:** None

---

## Claude's Discretion

- i18n library choice
- Translation file format and organization
- String key naming convention
- OS locale detection mechanism

## Deferred Ideas

None — discussion stayed within phase scope.
