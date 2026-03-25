---
phase: quick-260325-ksf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/connections/SettingsPage.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
requirements: [QUICK-01]
must_haves:
  truths:
    - "Project selector shows a styled searchable dropdown instead of a native select"
    - "User can select 'All Projects' to clear the project filter"
    - "Selected project displays with key badge and project name"
    - "Dropdown filters projects as user types in search"
  artifacts:
    - path: "src/features/connections/SettingsPage.tsx"
      provides: "Redesigned ProjectSelector component"
  key_links:
    - from: "ProjectSelector"
      to: "connectionStore"
      via: "onSelect callback passes null for All Projects, key string for specific"
---

<objective>
Redesign the ProjectSelector component in SettingsPage from a plain native HTML select to a polished custom searchable dropdown, and add an "All Projects" option that clears the project filter (sets key to null).

Purpose: The native select looks out of place in the otherwise well-designed settings UI. Adding "All Projects" lets users fetch tickets across all projects without being locked to one.
Output: Redesigned ProjectSelector with search, "All Projects" option, and consistent styling.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/connections/SettingsPage.tsx
@src/features/connections/connectionStore.ts
@src/i18n/locales/en.json
@src/i18n/locales/sk.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redesign ProjectSelector with searchable dropdown and "All Projects" option</name>
  <files>src/features/connections/SettingsPage.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <action>
Replace the ProjectSelector component in SettingsPage.tsx. Keep it as a local component in the same file (matching current pattern).

**New ProjectSelector behavior:**
1. Shows a trigger button (not a native select) displaying the currently selected project as "{name} ({key})" or "All Projects" when nothing is selected. Use a ChevronDown icon from lucide-react on the right side.
2. When clicked, opens a dropdown panel below the trigger with:
   - A search input at the top (Search icon from lucide-react, same style as watched users search input)
   - An "All Projects" option at the top (always visible, not filtered by search), with a globe/layers icon (Layers from lucide-react)
   - A scrollable list of projects filtered by the search query (match against both key and name, case-insensitive)
   - Each project item shows: project key in a small badge (bg-brand/8 text-brand rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold) followed by project name
   - Active/selected project has a checkmark icon (Check from lucide-react) on the right
3. Clicking "All Projects" calls onSelect(null) — update the onSelect prop type from `(key: string) => void` to `(key: string | null) => void`
4. Clicking a project calls onSelect(key) and closes the dropdown
5. Clicking outside the dropdown closes it (useEffect with click-outside handler)
6. The dropdown should have max-height of ~240px with overflow-y-auto for scrolling

**Styling (match existing app design language):**
- Trigger button: same input-like styling as other settings inputs (rounded-lg border border-brand-border bg-brand-bg text-brand-text px-3 py-2 text-[13px])
- Dropdown: rounded-xl border border-brand-border bg-brand-surface shadow-lg, positioned absolutely below trigger
- Search input inside dropdown: border-b border-brand-border-subtle, no outer border, px-3 py-2
- Items: px-3 py-2 hover:bg-brand-surface-hover transition-colors, text-[13px]
- "All Projects" item: slightly different styling — text-brand-muted italic when not selected

**Update callers in SettingsPage:** The two places that use ProjectSelector (source section and destination section) need their onSelect callbacks updated:
- Source: `onSelect={(key) => { setSourceProjectKey(key); saveProjectConfig(key, targetProjectKey); }}`
- Target: `onSelect={(key) => { setTargetProjectKey(key); saveProjectConfig(sourceProjectKey, key); }}`

These already work since setSourceProjectKey/setTargetProjectKey accept `string | null` and saveProjectConfig accepts `string | null` parameters.

**Add i18n keys to both en.json and sk.json:**
- `"settings.project.all"`: "All Projects" / "Vsetky projekty"
- `"settings.project.search"`: "Search projects..." / "Hladat projekty..."

Import Check, ChevronDown, Layers, Search from lucide-react (Search is already imported).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
    - ProjectSelector renders as a styled custom dropdown with search filtering
    - "All Projects" option appears at top, sets project key to null when selected
    - Each project shows key badge + name with checkmark for selected
    - Click outside closes dropdown
    - Both en.json and sk.json have new translation keys
    - TypeScript compiles without errors
  </done>
</task>

<task type="checkpoint:human-verify" gate="soft">
  <what-built>Redesigned project selector with searchable dropdown and "All Projects" option in Settings page</what-built>
  <how-to-verify>
    1. Open the app and navigate to Settings
    2. Go to Source or Destination section
    3. Click the project selector — should show a styled dropdown with search
    4. Type to filter projects by name or key
    5. Verify "All Projects" appears at top and can be selected
    6. Verify selecting a project shows it with key badge in the trigger
    7. Verify clicking outside closes the dropdown
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- TypeScript compiles: `npx tsc --noEmit`
- App builds: `npm run build`
</verification>

<success_criteria>
- Native select replaced with custom searchable dropdown
- "All Projects" option available and functional (sets key to null)
- Dropdown matches app design language (brand tokens, consistent spacing)
- Search filters projects by key and name
- Both locale files updated with new keys
</success_criteria>

<output>
After completion, create `.planning/quick/260325-ksf-make-the-project-selector-nicer-also-add/260325-ksf-SUMMARY.md`
</output>
