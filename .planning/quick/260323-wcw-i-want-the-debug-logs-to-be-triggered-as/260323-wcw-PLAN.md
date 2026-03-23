---
phase: quick-260323-wcw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/ui/AppShell.tsx
  - src/App.tsx
autonomous: true
requirements: [QUICK-DEBUG-ICON]
must_haves:
  truths:
    - "Debug log icon visible in header next to settings gear"
    - "Clicking the debug icon opens the audit log page"
    - "Footer audit button is removed"
    - "Audit count badge visible on the icon"
  artifacts:
    - path: "src/components/ui/AppShell.tsx"
      provides: "Header with debug icon next to gear"
    - path: "src/App.tsx"
      provides: "Wiring for debug icon click"
  key_links:
    - from: "AppShell header debug icon"
      to: "App.tsx showAuditLog state"
      via: "onAuditClick callback"
---

<objective>
Move the debug/audit log trigger from the footer button to an icon in the header, placed next to the settings gear icon.

Purpose: Better discoverability and cleaner layout — debug logs accessible from the header toolbar instead of a footer bar.
Output: Updated AppShell with header-level debug icon, footer audit button removed.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/ui/AppShell.tsx
@src/App.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move audit log trigger from footer to header icon</name>
  <files>src/components/ui/AppShell.tsx, src/App.tsx</files>
  <action>
In AppShell.tsx:

1. Add a terminal/console-style SVG icon component (e.g., `TerminalIcon` or `BugIcon`) — a simple 15x15 icon matching the GearIcon style (stroke-based, Lucide-style). Use a terminal prompt icon: a rectangle with a `>_` inside, or a simple bug icon with antennae.

2. In the header, replace the single gear icon `div` with a flex row containing TWO icon buttons side by side:
   - The audit/debug icon button (left) — only rendered when `onAuditClick` is provided. Shows the `auditCount` as a small badge (absolute positioned, top-right of the button) when count > 0. Badge: `text-[9px] bg-brand text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center`. aria-label uses `t('audit.open')`.
   - The gear icon button (right) — existing behavior, only rendered when `onGearClick` is provided. Keep the existing aria-label and styling.
   - Wrapper div: `flex items-center gap-1`

3. Remove the entire footer `{onAuditClick && (...)}` block (the bottom bar with "API calls: N" text). The footer is no longer needed.

In App.tsx:

4. No changes needed — `onAuditClick` is already passed to AppShell from App.tsx line 123. The prop wiring stays the same.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Debug/audit icon appears in header next to gear icon with badge showing count. Footer audit button is gone. TypeScript compiles clean.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- Visual: header shows two icons (debug + gear) side by side
- Clicking debug icon opens audit log page
- Badge shows audit count when > 0
- Footer no longer shows API calls bar
</verification>

<success_criteria>
- Audit log trigger relocated from footer to header icon
- Icon placed next to settings gear with consistent styling
- Audit count badge visible on the icon
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260323-wcw-i-want-the-debug-logs-to-be-triggered-as/260323-wcw-SUMMARY.md`
</output>
