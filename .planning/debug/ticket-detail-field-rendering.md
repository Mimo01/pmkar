---
slug: ticket-detail-field-rendering
status: resolved
trigger: "On ticket detail page some fields are not rendered properly"
created: 2026-05-08
updated: 2026-05-08
---

## Symptoms

- **actual_behavior**: Several fields on the ticket detail page display raw unprocessed content instead of rendered output. Known examples:
  - "Linked Projects" — shows raw HTML/CSS: `<style type='text/css'> #scriptField, #scriptField{ border-collapse: collapse; } #scriptField{ padding: 7px 10px; } </style> <ta…`
  - "Linked Risks" — shows raw HTML/CSS: `<style type='text/css'> #scriptField, #scriptField *{ border-bottom: 1px solid #c1c7d0; } #scriptField{ border-collapse: collapse; } #scriptField{ …`
  - "Development" — shows Java toString output: `{summaryBean=com.atlassian.jira.plugin.devstatus.rest.SummaryBean@5e7b9eaa[summary={pullrequest=...`
- **expected_behavior**: Fields should be rendered in a human-readable way. User constraint: NO HIDING — all fields must be shown, we need to decide the best rendering approach per field type.
- **error_messages**: None reported — these are rendering/display issues, not crashes.
- **timeline**: Unknown — uncertain if these fields ever rendered correctly.
- **reproduction**: Open any ticket detail page that has Linked Projects, Linked Risks, or Development fields populated.

## Current Focus

hypothesis: "Two separate rendering failures: (1) HTML-only fields fall back to raw HTML when stripHtml returns empty; (2) Java toString strings show unreadable class representation after suppression was removed in commit 028283b"
test: "Verified via tests 26 and 27 in sourceValueDisplay.test.tsx"
expecting: "Placeholder text shown for both field types"
next_action: "done"
reasoning_checkpoint: "Both cases are now handled by renderStringValue() helper with isJavaToString() detection"

## Evidence

- timestamp: 2026-05-08T20:08
  file: src/features/field-renderers/sourceValueDisplay.tsx
  note: |
    Commit 028283b removed Java toString suppression (isJavaToString check) and
    changed HTML-only fallback from `return null` to `|| value` (raw HTML string).
    Both changes correct in intent (no hiding) but wrong in implementation.
    `stripHtml(value) || value` returns raw HTML when stripHtml yields empty string.
    Java toString strings are rendered as unreadable truncated text.

- timestamp: 2026-05-08T20:08
  file: src/features/field-renderers/sourceValueDisplay.tsx (string branch, line 160)
  note: |
    `const display = stripHtml(value) || value;` — when stripHtml returns '' for
    HTML-only ScriptRunner fields (Linked Projects/Risks), the raw HTML with <style>
    blocks becomes the display value, truncated at 240 chars of CSS noise.

- timestamp: 2026-05-08T20:08
  file: src/features/field-renderers/sourceValueDisplay.tsx (any default string, line 369)
  note: |
    Same issue in the `any` fallback branch. Both the string case and any-type
    string case had the same `|| value` raw fallback pattern.

## Eliminated Hypotheses

- "Fields are being filtered out before rendering" — eliminated; they render, just wrong content
- "The backend sends unexpected data types" — eliminated; the data format is correct, it's a renderer decision issue

## Resolution

root_cause: "Two renderer decisions in commit 028283b caused the regressions: (1) when stripHtml() returns empty for HTML-only fields (ScriptRunner widgets like Linked Projects/Risks), the code fell back to raw HTML via `|| value`; (2) the Java toString detection (isJavaToString) was removed, causing Development field's SummaryBean@hexhash[...] to render as unreadable truncated text."
fix: "Added renderStringValue() shared helper that: detects Java toString via /[A-Za-z][A-Za-z0-9$._]*@[0-9a-f]{4,}\\[/ and shows '[Complex object — view in Jira]' placeholder; strips HTML and shows '[HTML content — view in Jira]' placeholder when stripHtml returns empty; otherwise renders stripped+truncated text. Both `string` type branch and `any` default string case now use this helper. Added HtmlContentPlaceholder and JavaObjectPlaceholder components."
verification: "All 59 sourceValueDisplay tests pass. Tests 26a/b verify Java toString placeholder. Tests 27a/b verify HTML-only placeholder. Test 23c updated to expect placeholder not raw HTML."
files_changed: "src/features/field-renderers/sourceValueDisplay.tsx, src/features/field-renderers/__tests__/sourceValueDisplay.test.tsx"
