---
status: complete
quick_id: 260428-4ab
slug: improve-field-mapping-settings-ux
date: 2026-04-28
commit: 6af7360
---

# Quick Task 260428-4ab: Improve field mapping settings UX

## What was done

Five files updated to make the field mapping settings UI clearer and more informative.

### Source field display
`MappingRow.tsx` — source column now shows the field **name** as primary text (e.g. "Department") with the raw ID (`customfield_10005`) as smaller muted text below. If no name resolves (edge case), falls back to showing only the ID.

`SuggestionsPanel.tsx` — suggestion rows already had `sourceName` in the type but were displaying `sourceFieldId`. Fixed to show the name as primary with ID as secondary.

### Transformer descriptions
`transformerOptions.ts` — added `description` field to `TransformerOption` interface and all six transformer constants:
- Identity → "Copy the value as-is"
- Wiki → ADF → "Convert Wiki markup to Atlassian Document Format"
- User → "Match users by display name or email"
- Version → "Match fix versions by name"
- Component → "Match components by name"
- Priority → "Map priority levels (e.g. High → High)"

`MappingRow.tsx` — transformer combobox now uses `renderItem` to show the description below the label in the dropdown.

### Transformer column tooltip
`FieldMappingSection.tsx` — "Transformer" column header now has a `HelpCircle` icon with a tooltip: "How the value is converted when copying to the target Jira". Added `colTransformerHelp` key to both `en.json` and `sk.json`.

## Files changed
- `src/features/field-mapping/transformerOptions.ts`
- `src/features/field-mapping/MappingRow.tsx`
- `src/features/field-mapping/FieldMappingSection.tsx`
- `src/features/field-mapping/SuggestionsPanel.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/sk.json`
