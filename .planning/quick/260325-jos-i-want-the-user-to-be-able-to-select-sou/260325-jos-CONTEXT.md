# Quick Task 260325-jos: Select source and target Jira projects - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Task Boundary

Add the ability for users to select source (Server) and target (Cloud) Jira projects. Currently the target project is hardcoded as "MYPROJ" in commands.rs (lines 1017, 1672). There is no project selection UI anywhere.

</domain>

<decisions>
## Implementation Decisions

### Where project selection lives
- Default project set in **Settings page** (persisted in DB), with **per-ticket override** on the Copy Preview page
- Settings shows both source and target project dropdowns
- Copy Preview page shows the target project pre-filled from settings, editable before copying

### Source vs Target
- **Both** source and target Jiras get project selection
- Source project selector in Settings for Server Jira
- Target project selector in Settings for Cloud Jira

### How projects are loaded
- **Fetch from Jira API** — call the projects endpoint for each connection
- Display as dropdown with project name + key (e.g. "My Project (MYPROJ)")
- No manual text input fallback

</decisions>

<specifics>
## Specific Ideas

- Replace hardcoded "MYPROJ" in commands.rs with the user-selected project key
- Add `project_key` field to `connection_meta` DB table (or a new table)
- Add Tauri command to fetch available projects from Jira API
- Source Jira Server API: `/rest/api/2/project`
- Target Jira Cloud API: `/rest/api/3/project`
- Copy Preview page needs a target project dropdown that defaults to the saved setting

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
