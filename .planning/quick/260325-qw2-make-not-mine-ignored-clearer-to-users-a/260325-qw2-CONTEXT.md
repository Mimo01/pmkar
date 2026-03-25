# Quick Task 260325-qw2: Make not-mine/ignored clearer to users and display company names for source/destination Jiras across the app - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Task Boundary

Make not-mine/ignored clearer to users and display company names for source/destination Jiras across the app. Two sub-goals: (1) improve UX clarity of the "Not Mine" / ignore flow so it's self-explanatory on first sight, (2) fetch Jira project names and display them as identifiers for source/destination connections throughout the app.

</domain>

<decisions>
## Implementation Decisions

### "Not Mine" Onboarding UX
- Rename labels to be clearer: "Not for me" -> "Dismiss" and "Not Mine" tab -> "Dismissed"
- Add a dismissable info card at the top of the Dismissed tab explaining the flow (e.g. "Tickets you've dismissed appear here. You can restore them at any time.")
- Claude's discretion on exact copy, card styling, and whether to add subtle hints near the dismiss button

### Company Name Source
- Use the Jira project name from the already-selected source/target project
- These are already available via the project fetch APIs (fetch_server_projects / fetch_cloud_projects)
- Store the project name alongside the project key in the connection store

### Display Scope
- Claude's Discretion — choose the surfaces that make the most impact without over-cluttering

</decisions>

<specifics>
## Specific Ideas

- User likes the big buttons and general flow — don't change the layout, just improve clarity
- The "Restore" button on the Dismissed tab is already good
- Project names should replace or augment the generic "Source (Customer Jira)" / "Destination (Company Jira)" labels

</specifics>
