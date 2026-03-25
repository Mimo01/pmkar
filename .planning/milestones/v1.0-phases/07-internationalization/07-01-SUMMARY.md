---
phase: 07-internationalization
plan: 01
subsystem: i18n
tags: [i18next, react-i18next, zustand, sys-locale, rusqlite, intl, sqlite]

# Dependency graph
requires:
  - phase: 06-triage-and-audit
    provides: triage_db.rs singleton table pattern and TriageDb open/open_in_memory methods
provides:
  - i18next initialized with en/sk resources at module import time
  - Zustand languageStore with Tauri SQLite persistence and OS locale detection
  - sys-locale Rust crate for OS locale detection via get_os_locale command
  - app_config SQLite table for language persistence
  - Tauri commands: get_os_locale, get_app_language, set_app_language
  - Locale-aware formatting utilities (formatDate, formatRelativeTime, formatTimestamp)
  - renderWithI18n test helper wrapping components in I18nextProvider
  - App.tsx hydration gated on both connection meta and language resolution
affects: [07-02-string-extraction, any feature that renders dates or timestamps]

# Tech tracking
tech-stack:
  added: [i18next, react-i18next, sys-locale (Rust crate)]
  patterns:
    - i18n initialized as side-effect import before React renders
    - Language persisted via Tauri SQLite (not localStorage) per D-09
    - OS locale detected in Rust via sys-locale, not JS navigator.language
    - Promise.all hydration pattern in App.tsx gates render on all async startup tasks

key-files:
  created:
    - src/i18n/index.ts
    - src/i18n/languageStore.ts
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/lib/format.ts
    - src/test-utils/renderWithI18n.tsx
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/triage_db.rs
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src/App.tsx
    - src/test-setup.ts
    - vite.config.ts
    - package.json

key-decisions:
  - "sys-locale Rust crate used for OS locale detection — keeps locale detection in Rust, consistent with D-08/D-10"
  - "Language persistence via app_config SQLite singleton table (not localStorage) — matches D-09 requirement"
  - "i18n initialized synchronously at module import, App.tsx uses Promise.all to prevent flash of untranslated content"
  - "sk locale fallback: if OS locale starts with 'sk' use Slovak, otherwise English — simple heuristic per D-10"

patterns-established:
  - "Singleton table pattern: CREATE TABLE IF NOT EXISTS ... id INTEGER PRIMARY KEY CHECK(id = 1) with INSERT OR IGNORE"
  - "Zustand store with async Tauri hydration: hydrateLanguage() exported separately, called in App.tsx Promise.all"
  - "Locale-aware formatting: useLanguageStore.getState().language drives Intl API locale selection via LOCALE_MAP"
  - "Test setup: import side-effect for i18n in test-setup.ts ensures i18next initialized before any component test"

requirements-completed: [I18N-01]

# Metrics
duration: 20min
completed: 2026-03-23
---

# Phase 7 Plan 01: i18n Infrastructure Summary

**i18next initialized with en/sk resources, language persisted in SQLite via sys-locale Rust crate, with Zustand store, locale-aware Intl formatting utils, and App.tsx hydration gating**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-23T09:47:00Z
- **Completed:** 2026-03-23T09:51:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Rust backend: sys-locale crate added, app_config singleton table in triage.db, three Tauri commands (get_os_locale, get_app_language, set_app_language) — cargo check passes
- Frontend: i18next initialized with en/sk skeleton resources, Zustand languageStore with Tauri SQLite persistence and OS locale fallback, locale-aware formatDate/formatRelativeTime/formatTimestamp utilities
- Test infrastructure: renderWithI18n helper, i18n side-effect in test-setup.ts, explicit jsdom environment in vite.config.ts — all 87 existing tests pass unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Rust backend — app_config table, OS locale detection, language persistence commands** - `b45b07b` (feat)
2. **Task 2: Frontend i18n infrastructure — i18next init, languageStore, formatting utils, test helpers, App.tsx wiring** - `bcd525d` (feat)

## Files Created/Modified

- `src-tauri/Cargo.toml` - Added sys-locale = "0.3" dependency
- `src-tauri/src/triage_db.rs` - Added app_config table, get_app_language, set_app_language methods
- `src-tauri/src/commands.rs` - Added get_os_locale, get_app_language, set_app_language Tauri commands
- `src-tauri/src/main.rs` - Registered three new commands in invoke_handler
- `src/i18n/index.ts` - i18next init with en/sk resources and initReactI18next
- `src/i18n/languageStore.ts` - Zustand store with setLanguage, hydrateLanguage (Tauri persistence + OS locale fallback)
- `src/i18n/locales/en.json` - English translation skeleton (6 keys)
- `src/i18n/locales/sk.json` - Slovak translation skeleton (6 keys)
- `src/lib/format.ts` - formatDate, formatRelativeTime, formatTimestamp using Intl API with LOCALE_MAP
- `src/test-utils/renderWithI18n.tsx` - Test helper wrapping in I18nextProvider
- `src/test-setup.ts` - Added import './i18n/index' side-effect
- `src/App.tsx` - Added i18n import, hydrateLanguage in Promise.all hydration
- `vite.config.ts` - Added test block with jsdom environment and setupFiles
- `package.json` / `package-lock.json` - i18next and react-i18next added

## Decisions Made

- Used sys-locale Rust crate (not JS navigator.language) for OS locale detection — consistent with D-08/D-10 which specifies Rust-side detection
- Language persisted in SQLite app_config table (not localStorage) — required by D-09
- i18n initialized as side-effect import before React renders — prevents flash of untranslated content (RESEARCH.md Pitfall 1)
- Promise.all in App.tsx hydration ensures language is resolved before setHydrated(true) — both connection meta and language load in parallel

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

- `src/i18n/locales/en.json` and `sk.json` contain only 6 skeleton keys — intentional, Plan 02 will extract all strings and complete translations. The skeletons are sufficient to prove the i18n system works.

## Next Phase Readiness

- i18n infrastructure complete. Plan 02 (string extraction) can now extract all hardcoded strings from components and add them to en.json/sk.json.
- The renderWithI18n helper is ready for use in component tests that need translation context.
- Language switching mechanism works end-to-end even though only 6 keys are translated.

---
*Phase: 07-internationalization*
*Completed: 2026-03-23*
