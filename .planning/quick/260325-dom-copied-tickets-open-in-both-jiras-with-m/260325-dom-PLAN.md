---
phase: quick
plan: 260325-dom
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/TicketDetailPage.tsx
  - src/features/tickets/TicketDetailPanel.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
must_haves:
  truths:
    - "Copied tickets show two distinct buttons: one for source Jira, one for target/cloud Jira"
    - "Both buttons are visually prominent (outlined style, not muted text links)"
    - "Non-copied tickets show a single prominent Open in Jira button"
    - "Buttons work in both TicketDetailPage (full page) and TicketDetailPanel (sidebar)"
  artifacts:
    - path: "src/features/tickets/TicketDetailPage.tsx"
      provides: "Dual Jira buttons for copied tickets, prominent styling"
    - path: "src/features/tickets/TicketDetailPanel.tsx"
      provides: "Dual Jira buttons for copied tickets, prominent styling"
    - path: "src/i18n/locales/en.json"
      provides: "Translation keys for source/target distinction"
    - path: "src/i18n/locales/sk.json"
      provides: "Slovak translation keys for source/target distinction"
  key_links:
    - from: "TicketDetailPage.tsx"
      to: "open_external_url Tauri command"
      via: "invoke with cloudBaseUrl + copiedKey"
    - from: "TicketDetailPanel.tsx"
      to: "open_external_url Tauri command"
      via: "invoke with cloudBaseUrl + copiedKey"
---

<objective>
For copied tickets, show buttons to open in BOTH source Jira and target/cloud Jira. Make all Open in Jira buttons more visible and prominent (outlined button style instead of muted text links). Apply to both TicketDetailPage and TicketDetailPanel views.

Purpose: Users need quick access to both the original and copied ticket in their respective Jira instances.
Output: Updated detail views with prominent, clearly labeled Jira buttons.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/TicketDetailPage.tsx
@src/features/tickets/TicketDetailPanel.tsx
@src/i18n/locales/en.json
@src/i18n/locales/sk.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add translation keys for source/target Jira distinction</name>
  <files>src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <action>
Add new translation keys to both locale files. Keep existing `detail.openInJira` for non-copied tickets (single button case). Add:

- `detail.openInSourceJira`: "Open in Source Jira" / "Otvorit v zdrojovej Jira"
- `detail.openInCompanyJira`: "Open in Company Jira" / "Otvorit v Jira spolocnosti"

Place them adjacent to the existing `detail.openInJira` key (around line 82).
  </action>
  <verify>
    <automated>grep -n "openInSourceJira\|openInCompanyJira" src/i18n/locales/en.json src/i18n/locales/sk.json</automated>
  </verify>
  <done>Both locale files contain the two new translation keys with correct translations.</done>
</task>

<task type="auto">
  <name>Task 2: Update TicketDetailPage and TicketDetailPanel with prominent dual buttons</name>
  <files>src/features/tickets/TicketDetailPage.tsx, src/features/tickets/TicketDetailPanel.tsx</files>
  <action>
In BOTH files, make the following changes:

**1. Add handleOpenInCloudJira handler** (next to existing handleOpenInJira, ~line 75 in Page, ~line 59 in Panel):
```ts
const handleOpenInCloudJira = () => {
  if (triageEntry?.copiedKey && cloudBaseUrl) {
    invoke('open_external_url', { url: `${cloudBaseUrl}/browse/${triageEntry.copiedKey}` });
  }
};
```

**2. Replace the existing Open in Jira button** with conditional rendering:

Common prominent button style (replaces the current muted text-link style):
```
className="px-3 py-1.5 rounded-md text-sm font-medium border border-brand-border bg-brand-surface hover:bg-brand-surface-hover hover:border-brand-text/30 text-brand-text transition-colors duration-150 flex items-center gap-1.5"
```

When `isCopied && triageEntry?.copiedKey`:
- Render TWO buttons side by side:
  - Button 1: `onClick={handleOpenInJira}`, label = `t('detail.openInSourceJira')`, ExternalLink icon
  - Button 2: `onClick={handleOpenInCloudJira}`, label = `t('detail.openInCompanyJira')`, ExternalLink icon

When NOT copied:
- Render ONE button: `onClick={handleOpenInJira}`, label = `t('detail.openInJira')`, ExternalLink icon (same prominent style)

**3. In TicketDetailPage.tsx** (lines 257-264): Replace the current plain text button in the action buttons div.

**4. In TicketDetailPanel.tsx** (lines 187-194): Replace the current bordered-but-muted button in the ml-auto flex div.

Both files already have `cloudBaseUrl` from `useConnectionStore`. Both already have `isCopied` and `triageEntry` available.

IMPORTANT: Keep the button placement in the same location within each file's layout. Do NOT move buttons to different sections.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -20 && grep -c "handleOpenInCloudJira" src/features/tickets/TicketDetailPage.tsx src/features/tickets/TicketDetailPanel.tsx && grep -c "openInSourceJira\|openInCompanyJira" src/features/tickets/TicketDetailPage.tsx src/features/tickets/TicketDetailPanel.tsx</automated>
  </verify>
  <done>
- Both files compile without TypeScript errors
- Copied tickets show two prominent buttons: "Open in Source Jira" and "Open in Company Jira"
- Non-copied tickets show one prominent button: "Open in Jira"
- All buttons use the outlined prominent style (not muted text links)
- handleOpenInCloudJira opens cloudBaseUrl/browse/copiedKey
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- Both TicketDetailPage and TicketDetailPanel render prominent styled buttons
- Copied tickets show dual buttons with distinct labels
- Non-copied tickets show single "Open in Jira" button
- All translation keys present in en.json and sk.json
</verification>

<success_criteria>
- Copied ticket detail views show two clearly labeled, prominent buttons opening source and target Jira respectively
- Non-copied ticket detail views show one prominent "Open in Jira" button
- Button styling is consistent across TicketDetailPage and TicketDetailPanel
- All text is internationalized (EN + SK)
</success_criteria>

<output>
After completion, create `.planning/quick/260325-dom-copied-tickets-open-in-both-jiras-with-m/260325-dom-SUMMARY.md`
</output>
