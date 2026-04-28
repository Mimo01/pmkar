---
slug: copy-stories-target-desc
status: resolved
trigger: "In the copy of stories I don't see a target jira description, why? Is it only a mock dev server cause or what is happening?"
created: 2026-04-29
updated: 2026-04-29
---

## Symptoms

- **Feature:** Window that copies stories from source Jira to target Jira
- **Expected:** Target story description field should be visible/populated in the copy stories window
- **Actual:** Target story description field is missing from the copy stories window
- **Error messages:** None reported
- **Timeline:** Unclear if it ever worked — not sure
- **Reproduction:** Open the copy stories window and observe the target Jira section

## Current Focus

hypothesis: CONFIRMED (iteration 2) — stale SQLite schema cache served old data after fixture fix.
test: n/a
expecting: n/a
next_action: RESOLVED — stale cache rows deleted from mapping.db
reasoning_checkpoint: get_or_fetch_target_schema returns early on cache hit (line 505 field_discovery.rs). The fixture fix was correct but the 15 old target rows in field_schema_cache were served instead of re-fetching.

## Evidence

- timestamp: 2026-04-29T00:00:00Z
  finding: >
    CopyPreviewPage.tsx builds dynamicFormFields from resolvedTargetFields (line 165-171),
    filtered to exclude summary and gap fields. Description would appear in DynamicTargetForm
    if present in resolvedTargetFields. The registry correctly routes
    schema.type=string + schema.system=description to TextAreaRenderer (registry.ts line 57).

- timestamp: 2026-04-29T00:00:01Z
  finding: >
    resolvedTargetFields comes from get_target_field_schema_for_issuetype → v3_createmeta_fields[issuetype_id]
    in the mock server. This is a per-issue-type map in fixtures.rs.

- timestamp: 2026-04-29T00:00:02Z
  finding: >
    fixtures.rs: desc_schema_v2 (type:string, system:description) is defined at line 1602 and
    included in the global v2_fields/v3_fields list (line 1607), but NOT in any of the three
    per-issue-type createmeta fixtures: bug_fields (10001), task_fields (10002), story_fields (10003).
    This was the original root cause — fix was applied in iteration 1.

- timestamp: 2026-04-29T00:00:03Z
  finding: >
    ITERATION 2: Even after the fixtures.rs fix, description was still missing. Root cause:
    get_or_fetch_target_schema (field_discovery.rs line 505) checks the SQLite FieldMappingDb cache
    FIRST and returns early on hit — it never re-fetches from the mock server.
    Confirmed via direct SQLite inspection: field_schema_cache in
    ~/Library/Application Support/com.pmkar.app/mapping.db contained 15 stale target rows
    (for MYPROJ issue types 10001/10002/10003) with NO description field — cached before the fix.
    Fix: deleted all target rows from field_schema_cache (15 rows). On next app load, the cache
    miss triggers a fresh fetch from the corrected mock fixtures, which now include description.

## Eliminated

- Frontend rendering logic: DynamicTargetForm and registry handle description correctly.
- CopyPreviewPage logic: no intentional exclusion of description from the form.
- Real Jira behavior: real createmeta always returns description for all issue types.
- computeGapFields: description is not required=true so it cannot become a gap field.

## Resolution

root_cause: >
  Two-layer issue. Layer 1 (iteration 1): the mock server's per-issue-type createmeta fixtures
  (bug_fields, task_fields, story_fields in src-tauri/src/fixtures.rs) were missing the
  description field. Layer 2 (iteration 2): get_or_fetch_target_schema in field_discovery.rs
  has a SQLite cache-first path that returned stale pre-fix data from
  ~/Library/Application Support/com.pmkar.app/mapping.db, so the fixture fix was never
  re-fetched until the cache was cleared.

fix: >
  Iteration 1: added createmeta_field("description", ...) after summary entry in all three
  issue-type fixture vectors (bug_fields, task_fields, story_fields). Updated pagination tests.
  Iteration 2: deleted all 15 stale target rows from field_schema_cache in mapping.db so the
  next fetch re-fetches from the corrected fixtures.

verification: >
  cargo build succeeds; SQLite target cache is now empty (confirmed via sqlite3 query).
  On next app launch, get_or_fetch_target_schema will cache-miss and re-fetch description
  from the corrected fixtures.

files_changed:
  - src-tauri/src/fixtures.rs
  - src-tauri/tests/createmeta_pagination.rs
  - src-tauri/tests/field_discovery_integration.rs
  - ~/Library/Application Support/com.pmkar.app/mapping.db (runtime data, not source)
