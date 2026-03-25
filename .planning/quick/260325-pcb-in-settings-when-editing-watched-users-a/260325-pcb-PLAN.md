---
phase: quick-260325-pcb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/connections/SettingsPage.tsx
autonomous: true
requirements: [BUG-focus-loss]
must_haves:
  truths:
    - "Typing in the watched users filter input does not lose focus"
    - "SectionCard has a stable component identity across SettingsPage re-renders"
  artifacts:
    - path: "src/features/connections/SettingsPage.tsx"
      provides: "SectionCard extracted to module scope"
      contains: "function SectionCard"
  key_links: []
---

<objective>
Fix input focus loss when filtering watched users in Settings.

Purpose: SectionCard is defined as an inline function inside SettingsPage, causing React to unmount/remount it on every re-render (each keystroke). Moving it to module scope gives it a stable identity.
Output: SettingsPage.tsx with SectionCard extracted outside the component body.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/connections/SettingsPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract SectionCard to module scope</name>
  <files>src/features/connections/SettingsPage.tsx</files>
  <action>
Move the `SectionCard` function component (currently at ~line 417 inside `SettingsPage`) to module scope — place it just before the `export function SettingsPage` declaration (around line 197). It takes `{ title, children }` props and uses no closure variables from SettingsPage, so it can be extracted as-is with no prop changes.

Steps:
1. Cut the SectionCard function (lines 417-426) from inside SettingsPage
2. Paste it before `export function SettingsPage` at module scope (after ProjectSelector, before SettingsPage)
3. Remove the `// Content card wrapper` comment from inside SettingsPage if it remains orphaned
4. Verify no other references break — SectionCard is used inside renderContent() which is inside SettingsPage, so JSX references resolve from module scope just fine

Do NOT extract NavItem — it uses `activeSection` and `setActiveSection` from SettingsPage closure and would require prop threading. Only extract SectionCard.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -20 && npx vitest run src/features/connections/__tests__/SettingsPage.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>SectionCard is defined at module scope (not inside SettingsPage). TypeScript compiles without errors. Existing SettingsPage tests pass.</done>
</task>

</tasks>

<verification>
- `grep -n "function SectionCard" src/features/connections/SettingsPage.tsx` shows it BEFORE `export function SettingsPage`
- TypeScript compiles clean
- Existing tests pass
</verification>

<success_criteria>
Typing in the watched users filter input in Settings no longer loses focus on each keystroke because SectionCard has a stable component identity.
</success_criteria>

<output>
After completion, create `.planning/quick/260325-pcb-in-settings-when-editing-watched-users-a/260325-pcb-SUMMARY.md`
</output>
