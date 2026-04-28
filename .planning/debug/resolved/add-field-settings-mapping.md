---
status: resolved
trigger: "The add field in settings mapping doesnt work"
created: 2026-04-28
updated: 2026-04-28
---

## Symptoms

- expected: Clicking "Pridať mapovanie poľa" button should add a new field mapping row in the settings mapping UI
- actual: Button does nothing — no visible change, no action
- errors: No visible errors in UI or terminal
- timeline: Never worked — this feature has never functioned
- reproduction: Navigate to settings mapping screen, click "Pridať mapovanie poľa" button

## Current Focus

- hypothesis: "Two compounding bugs: (1) window.prompt() is silently blocked in Tauri WebView, (2) FieldMappingSection returns early when firstIssueTypeId is null (preWarm not called on settings open), hiding the button entirely."
- test: "Confirmed: no dialog plugin installed, no prewarm call in FieldMappingSection mount"
- expecting: "Fix: replace window.prompt with inline source-field combobox on new blank row; call preWarm in FieldMappingSection useEffect if prewarmedIssueTypes is empty"
- next_action: "apply fix"

## Evidence

- timestamp: 2026-04-28T00:00:00Z
  file: src/features/field-mapping/FieldMappingSection.tsx
  observation: "handleAddRow() calls window.prompt() at line 271. Tauri 2 WKWebView/WebView2 blocks native dialog APIs by default unless the tauri-plugin-dialog is installed and permitted."

- timestamp: 2026-04-28T00:00:00Z
  file: src-tauri/capabilities/main.json
  observation: "Capabilities list: core:default, updater, process, notification. No dialog permission. tauri-plugin-dialog is not referenced in Cargo.toml."

- timestamp: 2026-04-28T00:00:00Z
  file: src/features/field-mapping/FieldMappingSection.tsx
  observation: "Lines 301-307: if (!firstIssueTypeId) returns early with 'no issue types' message, preventing button render. firstIssueTypeId comes from prewarmedIssueTypes which is empty unless connectionStore.prewarmIssueTypes() or copyStore ran first. FieldMappingSection never calls preWarm on mount."

- timestamp: 2026-04-28T00:00:00Z
  file: src/stores/schemaCacheStore.ts
  observation: "preWarm() calls pre_warm_target_issue_types Tauri command and populates prewarmedIssueTypes[projectKey]. Only invoked from connectionStore.prewarmIssueTypes() (probe flow) and copyStore.startPreview()."

## Eliminated

- event handler wiring: Button renders with onClick={handleAddRow} — wiring is correct when button is visible
- state mutation: updateRow and set_field_mapping invoke are properly implemented

## Resolution

- root_cause: "Two bugs compound: (1) window.prompt() is silently blocked in Tauri WebView (no dialog plugin), so handleAddRow always receives null and returns immediately. (2) FieldMappingSection early-returns a 'no issue types' placeholder when firstIssueTypeId is null, which happens whenever preWarm has not been called (e.g. fresh app open direct to settings), hiding the button completely."
- fix: "1) Replaced window.prompt() in handleAddRow with pendingAdd state + inline VirtualizedCombobox for source-field selection. 2) Mount useEffect now calls preWarm(targetProjectKey) via getState() when prewarmedIssueTypes is empty. 3) Removed !firstIssueTypeId early return; driftedSourceFieldIds guards on firstIssueTypeId to avoid false drift flags."
- verification: "tsc --noEmit passes (no new errors in FieldMappingSection.tsx)"
- files_changed: "src/features/field-mapping/FieldMappingSection.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json"
