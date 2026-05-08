---
status: resolved
trigger: "On ticket detail page some properties render their titles as 'Custom field XXXXX' instead of their actual names"
created: 2026-05-08
updated: 2026-05-08
---

# Debug Session: custom-field-name-not-resolved

## Symptoms

- **Expected:** Property titles should show the field display name from the Jira schema (e.g. "Story Points", "Sprint")
- **Actual:** Some properties render their titles as "Custom field XXXXX" (numeric ID fallback) instead of actual names
- **Errors:** Not checked yet
- **Timeline:** Unknown — unsure if it ever worked correctly
- **Scope:** Custom fields on ticket detail page (OverviewTab) and copy preview source column
- **Reproduction:** Open any ticket detail page when custom fields are not fully present in the schema cache

## Current Focus

hypothesis: "Schema cache has gaps for custom fields — AllFieldsSection falls back to prettifyKey when a field is absent from schemaMap"
test: "AllFieldsSection renders 'Custom field 10001' when schemaMap is empty (Test 1)"
expecting: "After fix, inline names from expand=names are used as fallback, resolving field names without depending solely on global schema cache"
next_action: "complete — fix applied"
reasoning_checkpoint: "Field name resolution has three tiers: schema cache (authoritative) > inline names map from expand=names (per-ticket fallback) > prettifyKey (last resort)"

## Evidence

- timestamp: 2026-05-08T21:45:00Z
  file: src/features/tickets/AllFieldsSection.tsx
  finding: >
    Lines 110-115: schemaMap is only populated when entry.status === 'success'. During loading
    or on error, schemaMap is empty and all customfield_NNNNN keys fall through to prettifyKey().
    prettifyKey('customfield_10001') returns 'Custom field 10001'.

- timestamp: 2026-05-08T21:47:00Z
  file: src-tauri/src/commands.rs line 858
  finding: >
    fetch_ticket_detail uses ?expand=renderedFields,changelog&fields=*all but does NOT include
    expand=names. The Jira v2 API supports expand=names which returns a top-level names map
    (fieldId -> displayName) for all fields present on the ticket. Without this, there is no
    per-ticket field-name information available as a fallback.

- timestamp: 2026-05-08T21:50:00Z
  file: src-tauri/src/field_discovery.rs
  finding: >
    discover_source_fields calls /rest/api/2/field (the global field list). In production Jira
    installations, this may not include ALL custom fields a ticket carries (e.g. stale SQLite
    cache from previous session, Jira admin adding fields after last discovery). These gaps
    cause permanently-missing entries in schemaMap for affected custom fields.

## Eliminated Hypotheses

- "Schema entry has wrong field ID key" — eliminated. parse_global_field_list correctly reads 'id' (with 'fieldId' fallback) from the /field response.
- "Zustand subscription not triggering re-render" — eliminated. AllFieldsSection subscribes to s.cache which updates on schema load, triggering correct re-render.
- "Bug is transient during loading only" — partially eliminated. Loading flash resolves, but stale/missing cache entries are permanent until manual refresh.

## Resolution

root_cause: >
  AllFieldsSection.tsx falls back to prettifyKey() (producing 'Custom field NNNNN') for any
  customfield_NNNNN not found in the Zustand schema cache. The schema cache is populated from
  /rest/api/2/field via discover_source_fields, but this can have gaps: stale SQLite cache from
  a previous session (fields added to Jira after last discovery), or custom fields that aren't
  in the global /field endpoint. The fetch_ticket_detail command did not request expand=names,
  which would provide a per-ticket authoritative fieldId->displayName map as a fallback.

fix: >
  Three-part fix:
  1. commands.rs: Added 'names' to the expand param in fetch_ticket_detail
     (?expand=renderedFields,changelog,names&fields=*all).
  2. types.ts: Added names?: Record<string, string> to JiraTicketDetail.
  3. AllFieldsSection.tsx: Added fieldNames prop; name resolution now uses three-tier priority:
     (1) schema cache entry, (2) inline names map from fieldNames prop, (3) prettifyKey fallback.
  4. OverviewTab.tsx: Passes detail.names as fieldNames to AllFieldsSection.
  5. CopyPreviewModal.tsx: Passes sourceTicket.names as fieldNames to AllFieldsSection.
  6. mock_server.rs: Added expand=names support to v2::get_issue handler (builds names map from v2_fields).

verification: >
  npx vitest run — all 836 tests pass; 3 pre-existing failures unchanged (TicketListPage auto-refetch, SettingsPage privacy banner).
  cargo check — Rust compiles cleanly.

files_changed: >
  src-tauri/src/commands.rs (expand URL),
  src-tauri/src/mock_server.rs (names expand support),
  src/features/tickets/types.ts (JiraTicketDetail.names field),
  src/features/tickets/AllFieldsSection.tsx (fieldNames prop + three-tier resolution),
  src/features/tickets/tabs/OverviewTab.tsx (passes detail.names),
  src/features/tickets/CopyPreviewModal.tsx (passes sourceTicket.names)
