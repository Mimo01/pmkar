---
status: complete
phase: 27-add-static-value-mapping-to-configurable-field-mapping
source: [27-01-SUMMARY.md, 27-02-SUMMARY.md, 27-03-SUMMARY.md, 27-04-SUMMARY.md]
started: 2026-05-20T00:00:00Z
updated: 2026-05-20T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Add Static Value Row Button
expected: Open Settings → Copying → Field Mapping. An "Add static value" ghost button is visible below the "Add field mapping" button. Clicking it adds a new row with a "Static value" label (styled like a full-width outline box, matching the other row cells) in the first column, and a target field combobox in the second column.
result: pass

### 2. Text Field Static Value — Save
expected: Click "Add static value". Select a text/string target field (e.g. Summary or a plain text field). A plain text input appears in the value column. Type any value and click away — the row shows a "Saved" flash for ~1.5 seconds, then returns to normal.
result: pass

### 3. Option/Select Field — Combobox Widget
expected: Click "Add static value". Select a target field that is an option/select type (e.g. Issue Type, Priority). Instead of a text input, a combobox (dropdown) appears in the value column, populated with the field's allowed values. Selecting an option shows the option's label in the combobox.
result: pass

### 4. Copy Modal Preview Shows Label, Not ID
expected: After saving a static option mapping (e.g. Priority → "High"), open the Copy dialog for a ticket. In the field preview, the static field shows the human-readable option label ("High"), not a raw JSON string or ID like "{\"id\":\"10002\"}".
result: pass

### 5. Array Field — Comma-Separated Text Input
expected: Click "Add static value". Select a target field that is a multi-value/array type (e.g. Labels or Fix Version). A plain text input appears with a hint about comma-separated values. Entering "val1, val2" and saving stores it correctly.
result: skipped
reason: no array-type fields available in mock server

### 6. Delete a Static Mapping Row
expected: With at least one saved static mapping row visible, click its delete button. The row disappears from the list immediately.
result: pass

### 7. Static Value Applied on Copy
expected: With a static value mapping saved (e.g. mapping a text field to a fixed string), copy a ticket. The copied ticket's target field reflects the configured static value, not the source ticket's value for that field.
result: pass

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[none yet]
