# Phase 2: Connection Setup - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Setup wizard UI for dual-connection configuration (customer Jira Server + company Jira Cloud). Users configure credentials through a guided multi-step wizard, validate connections against the mock server, and receive meaningful feedback on failures. Credentials persist via OS keychain. Fetching tickets, copying, and triage are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Wizard flow
- Multi-step wizard: Step 1 (Customer Jira Server) -> Step 2 (Company Jira Cloud) -> Step 3 (Summary)
- "Test Connection" is required before proceeding to the next step — "Next" button disabled until test succeeds
- Step 3 shows a summary card with both connections, green checkmarks, base URLs, and a "Done" button
- Wizard shows on first launch only — after that, user accesses settings manually
- Progress indicator with step dots at top (Customer -> Company -> Done)

### Validation & error handling
- Connection test result appears inline below the "Test Connection" button (not toast or modal)
- Success shows: authenticated username and Jira version (e.g., "Connected as john.doe — Jira Server v8.20.0")
- Error messages are specific and actionable per HTTP status:
  - 401 → "Authentication failed — check your PAT is valid"
  - 403 → "PAT lacks required permissions"
  - 429 → "Rate limited — try again in X seconds"
  - 5xx → "Server error — try again later"
  - Network error → "Cannot reach server — check URL"
- During test: button shows spinner and becomes disabled, form fields locked until test completes

### Post-setup access
- Dedicated Settings/Connections page accessible from a gear icon in the app header
- Each connection shown as a card with: green/red status dot, base URL, "Last tested: X ago", server version from last test, and an [Edit] button
- Editing a connection requires manual re-test (same flow as initial setup — not auto-test on save)

### Form fields & labels
- Connection labels: "Source (Customer Jira)" and "Destination (Company Jira)" — makes data flow direction clear
- PAT/token fields: masked by default (password input) with eye icon toggle to reveal/hide
- Inline help link below each secret field: "Where do I find this?" linking to Jira documentation
- Client-side URL validation: must start with https://, trailing slashes stripped, inline error for malformed URLs
- Customer Jira Server fields: Base URL, Personal Access Token
- Company Jira Cloud fields: Base URL, Email, API Token

### Claude's Discretion
- Exact Tailwind styling, spacing, and typography
- Step transition animations (if any)
- Form layout details (label placement, field widths)
- Error boundary behavior within the wizard
- How "Where do I find this?" links are implemented (tooltip vs external link)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, key decisions (Tauri, OS keychain, PAT-based auth for both systems)
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: CONN-01, CONN-02, CONN-04, CONN-05, CONN-06
- `.planning/ROADMAP.md` — Phase 2 success criteria (4 criteria that must be TRUE)

### Prior phase context
- `.planning/phases/01-foundation/01-CONTEXT.md` — Phase 1 decisions: React + TypeScript, Tailwind CSS, Zustand, feature-based organization, Tauri IPC commands

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/commands.rs`: `store_credential`, `get_credential`, `delete_credential` Tauri commands — ready to use for keychain operations
- `src-tauri/src/commands.rs`: `ping_mock_servers` — pattern for testing connections (can be adapted for real validation)
- `src/components/ui/AppShell.tsx` — minimal app wrapper (header/gear icon can be added here)
- `src/components/ui/ErrorBoundary.tsx` — existing error boundary for wrapping wizard
- `src/components/ui/StatusBadge.tsx` — may be reusable for connection status indicators

### Established Patterns
- Tauri IPC: commands defined in `src-tauri/src/commands.rs`, invoked from frontend via `@tauri-apps/api`
- Feature-based organization: `src/features/connections/` directory exists (empty, ready for wizard components)
- Tailwind CSS for all styling
- Zustand for state management

### Integration Points
- Wizard lives in `src/features/connections/` — feature-based folder structure
- Settings page needs a route/navigation from AppShell header (gear icon)
- Credential storage uses existing Tauri commands (`store_credential`, `get_credential`)
- Connection validation calls go through Rust backend (HTTP client with audit middleware already set up)
- Mock servers on `:8080` (Server v2) and `:8081` (Cloud v3) for testing during development

</code_context>

<specifics>
## Specific Ideas

- Labels "Source (Customer Jira)" and "Destination (Company Jira)" to reinforce the one-way data flow direction
- Success message shows authenticated username and server version — confirms user is connected to the right instance
- Wizard is a one-time experience; settings page is the persistent access point

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-connection-setup*
*Context gathered: 2026-03-20*
