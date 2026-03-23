# Phase 7: Internationalization - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the app UI available in English and Slovak, switchable at runtime via the settings page. Includes language switcher UI, complete English and Slovak translation packs, and locale-aware date/number formatting.

</domain>

<decisions>
## Implementation Decisions

### Language Switcher Placement
- **D-01:** Language switcher lives in the Settings page only — a dropdown in a new "Language" section below the connection cards
- **D-02:** No header-level language indicator — keeps the AppShell header clean and consistent with existing layout

### Translation String Coverage
- **D-03:** Translate all UI chrome: nav labels, buttons, headings, empty states, settings text, modal titles, table headers
- **D-04:** Translate app-generated error messages (connection failures, copy errors, validation messages)
- **D-05:** Jira field names, API response values, and Jira-originated content stay untranslated — they come from Jira itself

### Date and Number Formatting
- **D-06:** Full locale-aware formatting using the browser's Intl API — dates, times, and numbers adapt to the selected language
- **D-07:** Slovak dates show Slovak month names and day-month-year order; English dates show English format

### Language Persistence and Defaults
- **D-08:** Default language detected from OS locale on first launch — if OS is Slovak, app starts in Slovak; otherwise English
- **D-09:** User can override language in Settings; override persists via Tauri app config (not localStorage)
- **D-10:** OS locale detection happens once on first launch; after user makes a choice, that choice takes precedence permanently

### Claude's Discretion
- i18n library choice (react-intl, react-i18next, or lightweight custom)
- Translation file format and organization (JSON, nested keys, flat keys)
- String key naming convention
- How to detect OS locale via Tauri APIs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Requirements
- `.planning/REQUIREMENTS.md` §Internationalization — I18N-01, I18N-02, I18N-03

### Existing UI patterns
- `src/components/ui/AppShell.tsx` — Header and nav structure (language switcher NOT placed here)
- `src/features/connections/SettingsPage.tsx` — Settings page layout (language section will be added here)
- `src/features/connections/connectionStore.ts` — Zustand store pattern for persistence reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppShell` component: Header + nav + footer structure — no changes needed for i18n
- `SettingsPage`: Existing settings layout where language dropdown will be added
- Zustand stores (`connectionStore`, `ticketStore`, `copyStore`): Established state management pattern for a potential language store
- Tailwind CSS: All styling via utility classes — no CSS changes for i18n

### Established Patterns
- Zustand for all client state management
- Tauri `invoke` for backend operations (can be used for OS locale detection and config persistence)
- React 19 with functional components throughout
- No existing i18n infrastructure — all strings currently hardcoded in ~15+ component files

### Integration Points
- `src/App.tsx`: Language provider will need to wrap the component tree
- `src/features/connections/SettingsPage.tsx`: Language dropdown section added here
- Every component with visible text: Will need string extraction (~20 files across features/connections, features/tickets, components/ui)
- Tauri backend: May need a Rust command for reading OS locale and persisting language preference

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-internationalization*
*Context gathered: 2026-03-23*
