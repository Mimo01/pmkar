---
phase: quick
plan: 260325-sk0
subsystem: ui
tags: [changelog, git-cliff, version-history, react, dialog, i18n, vite-raw-import]

requires:
  - phase: quick-260325-sa2
    provides: AboutModal and AboutSection components as entry point for version history

provides:
  - CHANGELOG.md generated from git history via git-cliff with conventional commit grouping
  - VersionHistoryModal component parsing CHANGELOG.md raw text into version sections
  - Version History button in AboutSection wired to VersionHistoryModal
  - i18n keys for version history in en.json and sk.json with proper Slovak diacritics

affects:
  - about-modal
  - release-workflow

tech-stack:
  added: [git-cliff npm script, Vite ?raw import for CHANGELOG.md]
  patterns:
    - Import static markdown assets as raw text via Vite `?raw` suffix
    - Parse markdown changelog into structured version/category/item data in component
    - Reuse shadcn Dialog + ScrollArea pattern matching AboutModal for nested modal

key-files:
  created:
    - CHANGELOG.md
    - src/features/update/VersionHistoryModal.tsx
  modified:
    - package.json
    - src/features/update/AboutSection.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json

key-decisions:
  - "CHANGELOG.md imported via Vite ?raw suffix — no runtime file fetch needed, bundled at build time"
  - "Markdown parsed in component with regex split on ## [version] headings — lightweight, no markdown parser dependency"
  - "Unreleased section (content before first ## [version] heading) displayed with Unreleased badge"

patterns-established:
  - "Vite raw import pattern: import content from '../../../file.md?raw' for static text assets"

requirements-completed: [QUICK]

duration: 8min
completed: 2026-03-25
---

# Quick Task 260325-sk0: Version History Modal Summary

**CHANGELOG.md generated from git history via git-cliff, with VersionHistoryModal parsing and displaying versioned changelog entries grouped by category, accessible via a Version History button in the About modal.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-25T19:35:00Z
- **Completed:** 2026-03-25T19:43:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Generated CHANGELOG.md from full git history using git-cliff with cliff.toml conventional commit parsing
- Created VersionHistoryModal importing CHANGELOG.md as raw text via Vite `?raw` and parsing it client-side into version sections
- Wired a "Version History" button (History icon + text) into AboutSection that opens the modal
- Added Slovak and English i18n keys with proper diacritics (História verzií, nie je dostupná)

## Task Commits

1. **Task 1: Generate CHANGELOG.md and add npm script** - `ca9021e` (chore)
2. **Task 2: Create VersionHistoryModal and wire into AboutSection** - `1c5994f` (feat)

## Files Created/Modified

- `CHANGELOG.md` - Full project changelog generated from git history via git-cliff
- `src/features/update/VersionHistoryModal.tsx` - New modal component, parses CHANGELOG.md ?raw into version sections with category grouping
- `package.json` - Added `changelog` npm script for regenerating before releases
- `src/features/update/AboutSection.tsx` - Added History button, showHistory state, and VersionHistoryModal render
- `src/i18n/locales/en.json` - Added about.versionHistory, about.versionHistory.title, about.versionHistory.noEntries
- `src/i18n/locales/sk.json` - Added Slovak translations with proper diacritics

## Decisions Made

- Vite `?raw` import used for CHANGELOG.md — no runtime file read required, content bundled at build time, works in Tauri webview
- Markdown parsed with simple regex (split on `## [version]` headings, then `### Category` and `- item` lines) — avoids adding a markdown parsing library
- Unreleased changes (content before first versioned heading) shown with a distinct "Unreleased" badge so pre-release work is visible

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Users can now see full version history from the About modal
- The `npm run changelog` script should be run before each release to regenerate CHANGELOG.md from new git tags
- git-cliff is invoked via npx; for CI use, git-cliff binary can be cached or installed globally

---
*Phase: quick*
*Completed: 2026-03-25*
