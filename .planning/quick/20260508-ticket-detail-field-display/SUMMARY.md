---
slug: ticket-detail-field-display
status: complete
---

# Summary: Enhance ticket detail field display

## What was done

Five iterative improvements to field rendering on the ticket detail Overview tab:

1. **Better custom field labels** — `customfield_10608` fallback label changed from `"customfield 10608"` to `"Custom field 10608"` (`prettifyKey` in `AllFieldsSection.tsx`)

2. **Value rendering for `{value}` shaped objects** — Jira option/select custom fields that store display text in `value` (not `name`) now render as plain text instead of raw JSON

3. **HTML string stripping** — fields containing HTML markup (Wiki Renderer, Script Runner) strip `<style>`/`<script>` blocks and tags to show plain text; falls back to original truncated string if stripping yields nothing

4. **votes / watches system fields** — render as formatted counts: `"0 votes"`, `"1 vote"`, `"3 watchers"` etc. (always visible, never suppressed)

5. **All fields always visible** — removed suppression of LexoRank strings and Java toString leaks; both render as truncated plain text so no field is ever hidden

## Commits
- `a118124` feat: improve ticket detail field display for unknown custom fields
- `1854a04` fix: strip HTML from custom field values and suppress LexoRank noise
- `aa2e2a7` fix: handle votes and watches system fields in any-type renderer
- `702cd17` fix: suppress Java toString leaks (reverted in next commit)
- `028283b` fix: show all fields — remove suppression, improve votes/watches/HTML rendering

## Files changed
- `src/features/tickets/AllFieldsSection.tsx`
- `src/features/field-renderers/sourceValueDisplay.tsx`
- `src/features/tickets/__tests__/AllFieldsSection.test.tsx`
- `src/features/field-renderers/__tests__/sourceValueDisplay.test.tsx`
