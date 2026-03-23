---
phase: 07-internationalization
plan: 03
subsystem: testing
tags: [vitest, i18next, react-testing-library, zustand, i18n]

requires:
  - phase: 07-02
    provides: en.json and sk.json translation packs, languageStore, LanguageSection in SettingsPage

provides:
  - 23 automated tests covering language store hydration, translation completeness, and SettingsPage language dropdown
  - languageStore.test.ts: unit tests for default state, setLanguage, hydrateLanguage with OS locale detection
  - translations.test.ts: key parity, no empty values, min 80 keys, Slovak genuinely differs from English
  - SettingsPage.test.tsx: language section rendering and dropdown interaction

affects:
  - future i18n changes (tests enforce key parity and no empty values)

tech-stack:
  added: []
  patterns:
    - "vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() })) hoisted at module level — use vi.mocked(invoke) after import to avoid hoisting errors"
    - "Zustand store reset in beforeEach with setState to prevent test pollution"
    - "renderWithI18n wrapper used for all React component tests that use translations"

key-files:
  created:
    - src/i18n/__tests__/languageStore.test.ts
    - src/i18n/__tests__/translations.test.ts
    - src/features/connections/__tests__/SettingsPage.test.tsx
  modified: []

key-decisions:
  - "Used vi.mocked(invoke) after import rather than capturing mockInvoke in factory to avoid hoisting ReferenceError"
  - "SettingsPage test sets both serverConnection and cloudConnection to non-null to bypass 'no connections' early return and reach LanguageSection"

patterns-established:
  - "Tauri invoke mock: vi.mock factory with vi.fn(), then vi.mocked() after import"
  - "Store reset pattern: useLanguageStore.setState({ language: 'en' }) + i18n.changeLanguage('en') in beforeEach"

requirements-completed:
  - I18N-01
  - I18N-02
  - I18N-03

duration: 10min
completed: 2026-03-23
---

# Phase 7 Plan 03: i18n Test Suite Summary

**23-test i18n suite covering language store hydration, en/sk key parity validation, and SettingsPage language dropdown interaction — all 110 project tests green**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-23T10:14:00Z
- **Completed:** 2026-03-23T10:24:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

- Language store unit tests: initial state, setLanguage (store update + invoke call + i18n.changeLanguage), hydrateLanguage with stored value, OS locale detection (sk-SK → sk, en-US → en), stored value takes precedence over OS locale
- Translation completeness tests: en.json and sk.json have identical 162-key sets, no empty values, at least 80 keys, >80% of Slovak values differ from English
- SettingsPage dropdown tests: renders Language section heading, dropdown with English/Slovak options, default English selected, changing to Slovak updates store and calls invoke, Nastavenia appears after switching

## Task Commits

1. **Task 1: i18n test suite** - `353db85` (feat)
2. **Task 2: Visual verification** - `155adfe` (fix — restyled language switcher per user feedback)

**Plan metadata:** `87572d7` (docs: complete plan)

## Files Created/Modified

- `src/i18n/__tests__/languageStore.test.ts` - 11 tests for language store hydration, default logic, setLanguage side effects
- `src/i18n/__tests__/translations.test.ts` - 5 tests for translation completeness (key parity, no empty values, key count, Slovak authenticity)
- `src/features/connections/__tests__/SettingsPage.test.tsx` - 7 tests for LanguageSection rendering and dropdown interaction

## Decisions Made

- Used `vi.mocked(invoke)` after import (not variable capture in factory) to avoid Vitest hoisting ReferenceError
- SettingsPage test requires both connections to be non-null so the component renders past its "no connections" early return and reaches the Language section

## Deviations from Plan

### Auto-fixed Issues

**1. [User feedback] Restyled LanguageSection from dropdown to toggle buttons**
- **Found during:** Task 2 (Visual verification checkpoint)
- **Issue:** Plain `<select>` dropdown looked inconsistent with ThemeSection's button-group pattern
- **Fix:** Replaced with toggle buttons using flag emojis (🇬🇧/🇸🇰), matching ThemeSection styling. Updated tests from combobox/option queries to button queries.
- **Files modified:** src/features/connections/SettingsPage.tsx, src/features/connections/__tests__/SettingsPage.test.tsx
- **Verification:** All 109 tests pass, user approved visual result
- **Committed in:** `155adfe`

---

**Total deviations:** 1 (user-requested UI improvement)
**Impact on plan:** Improved visual consistency. No scope creep.

## Issues Encountered

- Vitest `vi.mock` hoisting caused ReferenceError on first run of languageStore.test.ts when factory referenced a const declared above it. Fixed by using `vi.fn()` directly in the factory and `vi.mocked(invoke)` for typed access.

## Known Stubs

None — test files only, no UI stubs.

## Next Phase Readiness

- All i18n automated tests pass (109/109 suite green)
- Visual verification approved by user
- Phase 7 complete — all I18N requirements (I18N-01, I18N-02, I18N-03) satisfied

---
*Phase: 07-internationalization*
*Completed: 2026-03-23*
