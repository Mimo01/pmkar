---
phase: quick
plan: 260325-sjh
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/TicketDetailPanel.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
requirements: [QUICK]
must_haves:
  truths:
    - "Linked ticket state shows the copied key prominently as the primary visual element"
    - "Two 'Open in Jira' actions are compact inline links, not large buttons"
    - "Non-copied states (ignore, copy, single open-in-jira) remain completely unchanged"
  artifacts:
    - path: "src/features/tickets/TicketDetailPanel.tsx"
      provides: "Redesigned copied/linked state UI"
  key_links:
    - from: "TicketDetailPanel.tsx copied branch"
      to: "handleOpenInJira, handleOpenInCloudJira"
      via: "compact link clicks"
      pattern: "handleOpenIn"
---

<objective>
Redesign the Jira linked ticket state UI in TicketDetailPanel. Only the `isCopied && triageEntry?.copiedKey` branch is changed. The new design makes the linked status (green badge with copied key) the primary visual element, and demotes the two "Open in Jira" buttons to compact, subtle inline text links.

Purpose: The current layout has two large buttons + a separate green badge, which is cluttered. The redesign creates a clean, compact linked-state display with better visual hierarchy.
Output: Updated TicketDetailPanel.tsx with redesigned copied state.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/TicketDetailPanel.tsx
@src/i18n/locales/en.json
@src/i18n/locales/sk.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redesign copied/linked state in TicketDetailPanel</name>
  <files>src/features/tickets/TicketDetailPanel.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <action>
Replace ONLY the `isCopied && triageEntry?.copiedKey` branch (lines 197-215 and lines 253-257) in the action strip. Do NOT touch the else branches (the non-copied button, ignore button, copy button, or unignore button).

Import `CheckCircle2` from lucide-react (alongside the existing `ExternalLink`).

**New copied state layout (replaces lines 197-215 AND 253-257):**

Replace the entire copied branch content (both the two buttons AND the green badge) with a single cohesive element:

```tsx
{isCopied && triageEntry?.copiedKey ? (
  <>
    {/* Primary: linked status badge with copied key */}
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
      {t('detail.copied')} → {triageEntry.copiedKey}
    </span>

    {/* Secondary: compact text links to open in each Jira */}
    <span className="text-brand-muted text-xs">·</span>
    <button
      type="button"
      onClick={handleOpenInJira}
      className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150 flex items-center gap-1"
    >
      <ExternalLink className="w-3 h-3" aria-hidden="true" />
      {sourceProjectName || t('wizard.source.subtitle')}
    </button>
    <span className="text-brand-muted text-xs">·</span>
    <button
      type="button"
      onClick={handleOpenInCloudJira}
      className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150 flex items-center gap-1"
    >
      <ExternalLink className="w-3 h-3" aria-hidden="true" />
      {triageEntry.copiedKey}
    </button>
  </>
)
```

The second link shows the copied key (e.g. "PROJ-13") as the label since that is the cloud Jira issue -- this is more informative than "Open in Company Jira".

Also remove the separate `{isCopied ? (` green badge span block (lines 253-257) since the badge is now integrated into the first element above. Keep the `: (` copy button branch untouched.

For the non-copied branch at line 253, it should now just be:
```tsx
{isCopied ? null : (
  <button ... copy button unchanged ... />
)}
```
(This is already the pattern -- the green badge span at 253-257 just needs to be removed since it is now part of the top section.)

Wait -- looking more carefully at the structure: lines 253-257 are the `{isCopied ? (green badge) : (copy button)}` ternary. After redesign, the green badge moves into the top section. So this ternary becomes: `{isCopied ? null : (copy button)}`. The copy button content stays exactly the same.

No new translation keys needed. The existing `detail.copied`, `detail.openInSourceJira`, `detail.openInCompanyJira` keys remain. The compact links just use the project names and copied key directly as labels instead of full translated button text.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit --skipLibCheck 2>&1 | head -20</automated>
  </verify>
  <done>
    - The copied/linked state shows: a green badge with checkmark icon + "Copied -> PROJ-13" as the primary element
    - Two compact text-style links (with tiny ExternalLink icons) appear next to the badge, separated by dots
    - The links show source project name and copied key as labels (not full "Open in X" text)
    - Non-copied states (ignore, copy, single open-in-jira) are completely unchanged
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit --skipLibCheck` passes
- Visual: Only the copied/linked state looks different; non-copied states untouched
</verification>

<success_criteria>
- Copied state is visually compact: one green badge + two small links, all on one line
- Non-copied states render identically to before
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260325-sjh-redesign-jira-linked-ticket-state-ui/260325-sjh-SUMMARY.md`
</output>
