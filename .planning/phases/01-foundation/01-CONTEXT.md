# Phase 1: Foundation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Tauri scaffold, OS keychain credential store, mock Jira server (both Server v2 and Cloud v3 API shapes), and security architecture (credential redaction, error boundaries). This phase delivers the infrastructure every subsequent phase builds on. No UI workflows — just the shell, security plumbing, mock server, and audit logging.

</domain>

<decisions>
## Implementation Decisions

### Frontend framework & styling
- React with TypeScript for the Tauri frontend
- Tailwind CSS for styling (utility-first, no component library initially)
- Zustand for state management (lightweight, works well with Tauri IPC)
- npm as package manager (available on system, no extra tooling needed)

### Mock Jira server design
- Embedded in the Rust backend (actix-web or axum), starts with the app in dev mode
- Separate ports: Server v2 on :8080, Cloud v3 on :8081 — mirrors real-world two-host setup
- Full read-write from the start — includes create/update/upload endpoints, not just read
- Realistic fixture data: 10-15 tickets with varied fields, comments, attachment metadata, sub-tasks, and linked issues

### Project structure
- Standard Tauri layout: src-tauri/ for Rust, src/ for React frontend
- Rust backend: module-per-concern (keychain.rs, mock_server.rs, audit.rs, jira_client.rs, commands.rs)
- Frontend: feature-based organization (src/features/connections/, src/features/tickets/, etc.) with shared UI in src/components/ui/
- npm as package manager

### Audit log storage & format
- SQLite database for structured, queryable audit log storage
- Standard entry fields: timestamp, HTTP method, URL, status code, request headers (redacted), response status, response body (truncated at 10KB)
- Logs persist across app sessions with manual "clear logs" option
- Credential redaction at the HTTP client layer — Authorization headers replaced with [REDACTED] before the log entry is created, credentials never touch the audit system

### Claude's Discretion
- Specific Tauri version and plugin choices
- Vite configuration details
- SQLite schema design for audit logs
- Mock server framework choice (actix-web vs axum)
- Error boundary implementation pattern
- Test framework selection (Rust and frontend)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements are fully captured in decisions above and in:

### Project-level
- `.planning/PROJECT.md` — Vision, constraints, key decisions (Tauri, OS keychain, one-time copy model)
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: TEST-01, TEST-02, TEST-03, CONN-03, AUDIT-01, AUDIT-03
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 criteria that must be TRUE)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — this phase establishes the patterns all subsequent phases follow

### Integration Points
- Tauri IPC commands will be the bridge between Rust backend and React frontend
- Mock server endpoints must match real Jira API shapes exactly so the adapter layer works transparently
- SQLite audit database will be read by the Phase 6 in-app audit viewer

</code_context>

<specifics>
## Specific Ideas

- Mock server on separate ports (8080/8081) to mirror the real two-host architecture
- Full CRUD mock from day one to avoid revisiting mock server in later phases
- Credential redaction happens at the earliest possible point (HTTP client layer) as a security-by-design choice

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-20*
