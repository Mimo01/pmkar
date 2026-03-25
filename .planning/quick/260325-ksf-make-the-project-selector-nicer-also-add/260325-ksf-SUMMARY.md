---
phase: quick-260325-ksf
status: done
date: 2026-03-25
---

# Quick Task Summary: Redesign Project Selector

## What was done
Replaced the native HTML `<select>` project selector in Settings with a custom searchable dropdown, and added an "All Projects" option.

## Changes
| File | Change |
|------|--------|
| `src/features/connections/SettingsPage.tsx` | Redesigned `ProjectSelector` — custom dropdown with search, key badges, checkmarks, click-outside-close, "All Projects" option |
| `src/i18n/locales/en.json` | Added `settings.project.all` and `settings.project.search` keys |
| `src/i18n/locales/sk.json` | Added Slovak translations for new keys |

## Key decisions
- Kept ProjectSelector as a local component in SettingsPage.tsx (matching existing pattern)
- "All Projects" calls `onSelect(null)` to clear the project filter
- Used same styling patterns as watched-users search (brand tokens, rounded-xl dropdown, shadow-lg)
- Added ChevronDown rotation animation for open/close state

## Commits
- `4103018` feat(quick-260325-ksf): redesign ProjectSelector with searchable dropdown and All Projects option
