---
phase: quick-260520-m42
verified: 2026-05-20T17:11:00Z
status: human_needed
score: 6/6 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open Settings → Field Mapping. In the Static Values section, add a static row. In the target combobox, confirm 'Issue Type' appears. Select it. In the value widget, confirm a searchable dropdown of target project issue types appears (Bug, Task, Story, etc.). Select 'Bug'. Save. Reload app. Reopen settings. Confirm static row shows target=Issue Type and value=Bug (human-readable, not just ID)."
    expected: "Issue Type appears in StaticMappingRow target combobox. Searchable dropdown renders issue types from prewarmedIssueTypes. Selection persists across reload showing the label, not the raw JSON."
    why_human: "VirtualizedCombobox rendering, persistence round-trip, and label display on reload cannot be verified without running the app."
  - test: "In the same Field Mapping section, open a regular (non-static) MappingRow's target combobox. Confirm 'Issue Type' does NOT appear as a selectable target there."
    expected: "Issue Type is absent from MappingRow target list. Only StaticMappingRow exposes it."
    why_human: "Dropdown contents require runtime rendering to verify the non-leakage of the synthetic field."
  - test: "Go to the ticket list, open Copy Preview, set IssueTypeChooser to 'Story'. With a static issuetype mapping set to 'Bug', click Copy. Confirm the created issue is a Bug (not Story). Then delete the static mapping and repeat — confirm the created issue is a Story (IssueTypeChooser drives when no static mapping)."
    expected: "Static mapping wins (D-01): copy creates Bug even though IssueTypeChooser shows Story. Without static mapping, IssueTypeChooser value is used."
    why_human: "Copy pipeline end-to-end behavior requires app execution and Jira API calls."
  - test: "If feasible: switch target project to one with no prewarmed issue types (or clear schema cache). Confirm the static issuetype value widget shows 'No issue types loaded for the target project' instead of an empty broken dropdown."
    expected: "Empty-state message renders when prewarmedIssueTypes is empty for the active project."
    why_human: "Empty-cache state requires app setup that cannot be reproduced by grep."
  - test: "Switch app language to Slovak. Confirm 'Typ Issue' appears in the StaticMappingRow target combobox and 'Vyberte typ Issue' appears as the value widget placeholder."
    expected: "Slovak i18n renders correctly with proper diacritics."
    why_human: "Language switch behavior requires runtime rendering."
---

# Quick Task 260520-m42: Static Issuetype Mapping — Verification Report

**Task Goal:** Add static value support for 'issuetype' field in the Pmkar field mapping system. Static wins over IssueTypeChooser at copy time. Dropdown from prewarmedIssueTypes. IssueTypeChooser stays visible.
**Verified:** 2026-05-20T17:11:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select 'Issue Type' as the target field in a static-row target combobox in mapping settings | VERIFIED | `FieldMappingSection.tsx:222-234` — `targetFieldsForStatic` memo appends synthetic issuetype FieldSchema (fieldId='issuetype', schema.type='issuetype') to `targetFields` passed to every `<StaticMappingRow>` call site (lines 347, 413). |
| 2 | Selecting an issue type stores `{id, name}` as a JSON string in field_mapping.static_value | VERIFIED | `StaticValueWidget.tsx:92` — `onChange={(it) => onChange(JSON.stringify({ id: it.id, name: it.name }))}`. Test "calls onChange with JSON.stringify({id,name}) when issue type selected" asserts exact string `'{"id":"10002","name":"Story"}'` and passes. |
| 3 | The static value widget for issuetype shows the human-readable issue type name when re-rendered after reload | VERIFIED (automated partial) | `StaticValueWidget.tsx:80-84` — parses stored JSON, extracts `id`, finds matching `IssueTypeRef` in `prewarmedIssueTypes`, passes as `value` to VirtualizedCombobox using `displayLabel={(it) => it.name}`. Full label round-trip on reload requires human verification. |
| 4 | When a static mapping for `issuetype` exists, the copy pipeline uses that value instead of IssueTypeChooser's value | VERIFIED | `commands.rs:2008-2020` — `merge_create_fields` uses `.entry("issuetype".to_string()).or_insert_with(...)`. Rust test `static_issuetype_wins` asserts static id "10001" survives when args id is "99999". Test passes. |
| 5 | When no static mapping for `issuetype` exists, IssueTypeChooser's value drives the issuetype field | VERIFIED | `commands.rs:2019` — `.or_insert_with(|| serde_json::json!({ "id": target_issue_type_id }))`. Rust test `fallback_uses_args_id` asserts "99999" is used when `create_fields` has no issuetype key. Test passes. |
| 6 | Regular (non-static) MappingRow target combobox does NOT show `issuetype` as a target | VERIFIED | `FieldMappingSection.tsx:357` — `<MappingRow ... targetFields={targetFields} />` receives the original unaugmented array. `targetFieldsForStatic` (which includes the synthetic issuetype entry) is passed ONLY to `<StaticMappingRow>` (lines 347, 413). |

**Score:** 6/6 automated truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/field-mapping/StaticValueWidget.tsx` | Issuetype dispatch branch using VirtualizedCombobox<IssueTypeRef> | VERIFIED | Lines 66-100: `if (schema.type === 'issuetype')` branch present, uses `VirtualizedCombobox<IssueTypeRef>`, `useSchemaCacheStore` selector, empty-state guard. |
| `src/features/field-mapping/FieldMappingSection.tsx` | Synthetic issuetype FieldSchema injected into StaticMappingRow target list only | VERIFIED | Lines 218-234: `targetFieldsForStatic` memo with defensive dedup. MappingRow at line 357 still uses `targetFields`. |
| `src-tauri/src/commands.rs` | Override-aware insert for issuetype field in copy_ticket_v2 create_fields | VERIFIED | `merge_create_fields` function at lines 2008-2020 extracted and called from copy_ticket_v2 (line 1768). `.entry().or_insert_with(...)` pattern confirmed. |
| `src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` | Test coverage for issuetype branch | VERIFIED | Three new tests in `describe('StaticValueWidget — issuetype branch (M42)')`: renders combobox, onChange JSON, empty state. All 3 pass. |
| `src/i18n/locales/en.json` | issuetypeFieldName + staticIssuetypePlaceholder + staticIssuetypeEmpty keys | VERIFIED | Lines 448-450: all three keys present with correct EN values. |
| `src/i18n/locales/sk.json` | Slovak translations for the three new keys | VERIFIED | Lines 448-450: all three keys present with correct SK diacritics ("Typ Issue", "Vyberte typ Issue", "Pre cieľový projekt neboli načítané žiadne typy Issue"). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `StaticValueWidget.tsx` | `schemaCacheStore.ts (prewarmedIssueTypes)` | `useSchemaCacheStore` selector | WIRED | Line 28-30: `useSchemaCacheStore((s) => s.prewarmedIssueTypes[targetProjectKey ?? ''] ?? [])` — exact pattern. |
| `FieldMappingSection.tsx` | `StaticMappingRow.tsx` | `targetFields={targetFieldsForStatic}` prop | WIRED | Lines 347 and 413: both StaticMappingRow call sites receive `targetFieldsForStatic`. |
| `commands.rs` | `pipeline.rs (apply_mapping)` | `resolved.fields` contains issuetype JSON object when static mapping present | WIRED | `merge_create_fields` operates on `resolved.fields.clone()` (line 1765-1773). `.entry().or_insert_with()` preserves static value when present. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `StaticValueWidget.tsx` | `issueTypes` | `useSchemaCacheStore((s) => s.prewarmedIssueTypes[targetProjectKey ?? ''])` | Populated by `preWarm()` Tauri command in FieldMappingSection load effect | FLOWING |
| `commands.rs (merge_create_fields)` | `create_fields["issuetype"]` | `resolved.fields` from `apply_mapping` pipeline, which processes static_value column from DB | Real DB read via field_mapping store → apply_mapping | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| StaticValueWidget issuetype tests pass | `npx vitest run src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` | 7/7 tests pass (4 pre-existing + 3 new M42) | PASS |
| FieldMappingSection tests pass | `npx vitest run src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` | 9/9 tests pass | PASS |
| Rust static_issuetype_wins test | `cargo test static_issuetype_wins` | 1 passed in pmkar_lib | PASS |
| Rust fallback_uses_args_id test | `cargo test fallback_uses_args_id` | 1 passed in pmkar_lib | PASS |
| TypeScript compilation | `npx tsc --noEmit` | No output = clean | PASS |
| Cargo clippy (lib/bin only) | `cargo clippy -- -D warnings` | No errors | PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src-tauri/src/commands.rs` | 1383, 1412 | `TODO:` in doc comments | Info | Pre-existing markers in `discover_source_fields` and `get_target_field_schema_for_issuetype` — unrelated to M42 changes. Not introduced by this task (confirmed via git diff). |

No blockers. The pre-existing TODO markers are in audit-logging doc comments for field discovery commands, not in M42-modified code, and were present before this task.

### Human Verification Required

#### 1. Static issuetype picker in mapping settings

**Test:** Open Settings → Field Mapping. Add a static row. In the target combobox, confirm "Issue Type" appears. Select it. Confirm a searchable dropdown of the target project's issue types appears. Select "Bug". Save. Reload the app. Reopen settings. Confirm the static row still shows target="Issue Type" and value="Bug" (not the raw JSON string).
**Expected:** Issue Type is selectable in StaticMappingRow. Dropdown renders real issue types. Value round-trips to human-readable label after reload.
**Why human:** Requires running the app; VirtualizedCombobox rendering, Tauri invoke persistence, and label resolution on next render cannot be verified by static analysis.

#### 2. Regular MappingRow non-leakage

**Test:** In the same Field Mapping section, open a regular (non-static) MappingRow's target combobox. Confirm "Issue Type" does NOT appear as a selectable target.
**Expected:** Issuetype is absent from MappingRow target list.
**Why human:** Dropdown contents require runtime rendering to verify the separation.

#### 3. Copy with static issuetype override (D-01 contract)

**Test:** With a static mapping for issuetype set to "Bug", open Copy Preview, set IssueTypeChooser to "Story", click Copy. Confirm created issue is Bug. Then delete the static mapping and repeat — confirm created issue is Story.
**Expected:** Static wins (Bug created despite chooser showing Story). Fallback works (Story created when no static mapping).
**Why human:** Requires live copy pipeline execution and Jira API verification.

#### 4. Empty-state widget (optional)

**Test:** If feasible, switch to a target project with no prewarmed issue types (or briefly clear the schema cache). Confirm the static issuetype value widget shows "No issue types loaded for the target project".
**Expected:** Empty-state message renders instead of a broken empty dropdown.
**Why human:** Requires specific dev environment state that cannot be reproduced by static analysis.

#### 5. Slovak i18n

**Test:** Switch app language to Slovak. Confirm "Typ Issue" appears in the StaticMappingRow target combobox and "Vyberte typ Issue" as the value placeholder.
**Expected:** Slovak strings render with correct diacritics.
**Why human:** Language switch and rendering require app execution.

### Gaps Summary

No gaps found. All 6 automated must-haves are VERIFIED. The task is blocked on human verification (Task 3 checkpoint per plan) as expected by the plan's `checkpoint:human-verify` gate.

---

_Verified: 2026-05-20T17:11:00Z_
_Verifier: Claude (gsd-verifier)_
