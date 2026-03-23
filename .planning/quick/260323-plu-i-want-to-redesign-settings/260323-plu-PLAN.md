---
phase: quick-260323-plu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/connections/SettingsPage.tsx
  - src/features/connections/__tests__/SettingsPage.test.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: false
requirements: [SETTINGS-REDESIGN]

must_haves:
  truths:
    - "Settings page shows a sidebar on the left with three groups: Connections, Fetching, Appearance"
    - "Clicking a sidebar item shows only that section in the content panel"
    - "Each section renders its content in spacious cards with generous padding"
    - "All existing settings functionality works identically (edit connections, change preset, manage watched users, toggle theme, switch language)"
    - "Active sidebar item has a visual indicator"
  artifacts:
    - path: "src/features/connections/SettingsPage.tsx"
      provides: "Sidebar navigation layout with section-based content switching"
      contains: "activeSection"
    - path: "src/i18n/locales/en.json"
      provides: "New sidebar group label i18n keys"
      contains: "settings.group.connections"
  key_links:
    - from: "src/features/connections/SettingsPage.tsx"
      to: "sidebar state"
      via: "useState activeSection controlling which section renders"
      pattern: "activeSection"
    - from: "src/features/connections/SettingsPage.tsx"
      to: "existing stores"
      via: "same useConnectionStore, useTicketStore, useThemeStore, useLanguageStore imports"
      pattern: "useConnectionStore|useTicketStore|useThemeStore|useLanguageStore"
---

<objective>
Redesign the Settings page from a single vertical scroll to a sidebar navigation layout with three section groups and spacious card-based content panels.

Purpose: Give the settings page a modern desktop-app feel with clear section organization and breathable visual density.
Output: Refactored SettingsPage.tsx with sidebar navigation, updated i18n keys, updated tests.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/connections/SettingsPage.tsx
@src/features/connections/ConnectionCard.tsx
@src/features/connections/ConnectionForm.tsx
@src/features/connections/__tests__/SettingsPage.test.tsx
@src/components/ui/AppShell.tsx
@src/i18n/locales/en.json
@src/i18n/locales/sk.json

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/features/connections/SettingsPage.tsx:
```typescript
interface SettingsPageProps {
  onClose: () => void;
  onEdit?: (connectionType: ConnectionType) => void;
}
```

From src/features/connections/ConnectionCard.tsx:
```typescript
interface ConnectionCardProps {
  label: string;
  connection: ConnectionMeta | null;
  onEdit: () => void;
}
```

From src/features/connections/types.ts:
```typescript
type ConnectionType = 'server' | 'cloud';
```

From src/features/theme/themeStore.ts:
```typescript
type ThemeMode = 'light' | 'dark' | 'system';
```

From src/i18n/languageStore.ts:
```typescript
type Language = 'en' | 'sk';
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor SettingsPage to sidebar navigation layout with section grouping</name>
  <files>src/features/connections/SettingsPage.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <action>
Refactor SettingsPage.tsx to use a two-column sidebar + content panel layout. Keep the SettingsPageProps interface unchanged so App.tsx needs no changes.

**Layout structure:**
- Outer container: `flex` row, full height available (remove the current `max-w-[540px] mx-auto` wrapper)
- Left sidebar: ~220px fixed width, `bg-brand-surface`, `border-r border-brand-border`, full height, `py-6 px-4`
- Right content panel: `flex-1`, scrollable, `px-8 py-8`, max-width ~640px for readability

**Sidebar structure:**
- Back button + "Settings" heading at top of sidebar (move from content area)
- Three groups, each with a group label (uppercase, muted, tracking-wider, `text-[11px]`) and nav items beneath:
  1. **Connections** group label, items: "Source" (server connection), "Destination" (cloud connection)
  2. **Fetching** group label, items: "JQL Presets" (what to fetch), "Watched Users"
  3. **Appearance** group label, items: "Theme", "Language"
- Each nav item: `text-sm`, clickable, `rounded-lg px-3 py-2`, left-aligned text
- Active item: `bg-brand/10 text-brand-text font-medium` with a 3px left border accent in brand color
- Inactive: `text-brand-text-secondary hover:bg-brand-surface-hover`
- Groups separated by `my-4` spacing, group labels have `mb-2 px-3`

**State management:**
- Add `useState<string>('source')` for `activeSection` with values: `'source'`, `'destination'`, `'jql-presets'`, `'watched-users'`, `'theme'`, `'language'`
- Content panel renders ONLY the active section (not all sections stacked)

**Content panel sections — each in a spacious card:**
Each section wraps its content in a card: `rounded-xl border border-brand-border bg-brand-surface p-6` with a section title `text-base font-semibold text-brand-text mb-4` at the top.

- **Source section** (`activeSection === 'source'`): The existing server ConnectionCard or inline ConnectionForm edit UI, wrapped in a spacious card. Card title: "Source Connection" (i18n: `settings.section.source`).
- **Destination section** (`activeSection === 'destination'`): Same pattern for cloud connection. Card title: "Destination Connection" (i18n: `settings.section.destination`).
- **JQL Presets section** (`activeSection === 'jql-presets'`): The existing preset radio buttons + custom JQL textarea. Card title: "JQL Presets" (i18n: `settings.section.jqlPresets`). Add `p-6` padding around the preset list.
- **Watched Users section** (`activeSection === 'watched-users'`): The existing user search + user list. Card title: "Watched Users" (i18n: `settings.section.watchedUsers`).
- **Theme section** (`activeSection === 'theme'`): The existing ThemeSection toggle buttons. Card title: "Theme" (i18n: `settings.section.theme`).
- **Language section** (`activeSection === 'language'`): The existing LanguageSection toggle buttons. Card title: "Language" (i18n: `settings.section.language`).

**"No connections" state:** When `hasNoConnections` is true, still show the sidebar but the content panel shows the existing empty state message.

**Preserve ALL existing logic:** All handlers (handlePresetChange, handleJqlCustomChange, handleResetJql, handleAddUser, handleRemoveUser, handleKeyDown, persistFetchConfig, handleEdit, handleEditTestSuccess), all store subscriptions, all Tauri invoke calls — must remain identical. This is a pure layout refactor.

**i18n keys to add to both en.json and sk.json:**
- `settings.group.connections`: "Connections" / "Pripojenia"
- `settings.group.fetching`: "Fetching" / "Nacitavanie"
- `settings.group.appearance`: "Appearance" / "Vzhľad"
- `settings.nav.source`: "Source" / "Zdroj"
- `settings.nav.destination`: "Destination" / "Cieľ"
- `settings.nav.jqlPresets`: "JQL Presets" / "JQL predvoľby"
- `settings.nav.watchedUsers`: "Watched Users" / "Sledovani pouzivatelia"
- `settings.nav.theme`: "Theme" / "Tema"
- `settings.nav.language`: "Language" / "Jazyk"
- `settings.section.source`: "Source Connection" / "Zdrojove pripojenie"
- `settings.section.destination`: "Destination Connection" / "Cieľove pripojenie"
- `settings.section.jqlPresets`: "JQL Presets" / "JQL predvoľby"
- `settings.section.watchedUsers`: "Watched Users" / "Sledovani pouzivatelia"
- `settings.section.theme`: "Theme" / "Tema"
- `settings.section.language`: "Language" / "Jazyk"

Use proper Slovak diacritics (check existing sk.json for patterns).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>SettingsPage renders with sidebar nav on left and section content on right. TypeScript compiles cleanly. All existing logic preserved. i18n keys added to both locales.</done>
</task>

<task type="auto">
  <name>Task 2: Update SettingsPage tests for sidebar layout</name>
  <files>src/features/connections/__tests__/SettingsPage.test.tsx</files>
  <action>
Update the existing test file to work with the new sidebar layout. The existing tests check for language section rendering and interaction — these must still pass since the language section content is identical, just accessed via sidebar navigation.

**Changes needed:**
1. Before testing language section content, simulate clicking the "Language" sidebar nav item to make the language section visible. The nav item can be found by its text content matching the `settings.nav.language` i18n key ("Language").
2. Update the "renders Language section heading" test — the heading is now the card title inside the content panel, not an h2 in a scrollable list. The test should click the Language nav item first, then look for the section title.
3. All other language tests (toggle buttons, store updates, invoke calls) need the Language nav click first.

**Add new tests for sidebar navigation:**
- "renders sidebar with three group headings" — verify "Connections", "Fetching", "Appearance" group labels exist
- "renders sidebar nav items" — verify all 6 nav items are present (Source, Destination, JQL Presets, Watched Users, Theme, Language)
- "Source section is active by default" — the Source nav item has the active styling class
- "clicking a nav item switches the content panel" — click "Theme" nav item, verify theme toggle buttons appear; click "Language", verify language buttons appear
- "sidebar back button calls onClose" — the back button in sidebar triggers the onClose prop

Keep the same mock setup, same imports, same `renderWithI18n` helper.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx vitest run src/features/connections/__tests__/SettingsPage.test.tsx 2>&1 | tail -30</automated>
  </verify>
  <done>All existing language tests pass with sidebar navigation clicks prepended. New sidebar navigation tests pass. No test regressions.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Visual verification of settings redesign</name>
  <files>src/features/connections/SettingsPage.tsx</files>
  <action>
Human verifies the redesigned settings page visually and functionally.

What was built: Redesigned settings page with sidebar navigation, three-group organization (Connections, Fetching, Appearance), and spacious card layout. Each sidebar item shows its section content in the right panel.

How to verify:
1. Run the app with `cargo tauri dev`
2. Click the gear icon to open Settings
3. Verify the left sidebar shows three groups with items: Connections (Source, Destination), Fetching (JQL Presets, Watched Users), Appearance (Theme, Language)
4. Click each sidebar item and verify the correct section appears in the content panel
5. Verify the active item has a visual indicator (brand-colored left border)
6. Verify cards have generous padding and modern feel
7. Test that editing a connection still works inline
8. Test that changing theme/language still works
9. Test that the back button returns to the main view

Resume: Type "approved" or describe visual/functional issues to fix.
  </action>
  <verify>Human visual confirmation</verify>
  <done>User approves the settings page redesign visually and functionally.</done>
</task>

</tasks>

<verification>
- TypeScript compiles with no errors: `npx tsc --noEmit`
- All SettingsPage tests pass: `npx vitest run src/features/connections/__tests__/SettingsPage.test.tsx`
- Full test suite passes: `npm test`
- Settings page renders with sidebar layout visually confirmed
</verification>

<success_criteria>
- Settings page displays sidebar on left with 3 groups (Connections, Fetching, Appearance) and 6 nav items
- Clicking a nav item shows only that section's content in the right panel
- Active nav item has visual indicator
- All existing functionality (connection editing, JQL presets, watched users, theme, language) works identically
- Content renders in spacious cards with generous padding
- Tests pass including new sidebar navigation coverage
</success_criteria>

<output>
After completion, create `.planning/quick/260323-plu-i-want-to-redesign-settings/260323-plu-SUMMARY.md`
</output>
