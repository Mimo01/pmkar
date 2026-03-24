# Pmkar

## What This Is

Pmkar is a cross-platform desktop app (Tauri) that bridges two Jira systems — a customer's legacy self-hosted Jira and the user's company's cloud Jira. It automates the process of discovering relevant tickets from the customer's system and selectively copying them in full detail to the company's Jira, replacing a manual workflow that's tedious and error-prone.

## Core Value

Surface relevant tickets from the customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## Requirements

### Validated

- [x] Secure credential storage via OS keychain — Validated in Phase 1: Foundation
- [x] All REST API calls logged with full request/response for audit and verification — Validated in Phase 1: Foundation
- [x] Mock Jira server for development and testing without real PATs — Validated in Phase 1: Foundation
- [x] Setup wizard for configuring two Jira connections (cloud + self-hosted) via REST API with Personal Access Tokens — Validated in Phase 2: Connection Setup
- [x] Copy ticket core fields (summary, description, status, priority, labels) with ADF translation and diff preview — Validated in Phase 4: Copy Core Fields
- [x] Track origin — remote link back to source ticket, copiedKey in triage state — Validated in Phase 4: Copy Core Fields
- [x] Full mirror copy: attachments, comments, work log, sub-tasks, linked issues — Validated in Phase 5: Copy Attachments and Comments
- [x] Ignored tickets filtered from candidate list, reviewable in dedicated page with restore — Validated in Phase 6: Triage and Audit
- [x] In-app audit log viewer with expandable REST API call details — Validated in Phase 6: Triage and Audit
- [x] UI available in English and Slovak, switchable at runtime with persistent preference — Validated in Phase 7: Internationalization
- [x] Modern, consistent UI with shadcn/ui components, Lucide icons, card-based layouts, and Linear-inspired aesthetic — Validated in Phase 8: UI Redesign
- [x] WCAG AA accessibility: dark mode contrast 4.5:1+, keyboard navigation, form labels, ARIA semantics, color-independent indicators, live regions — Validated in Phase 9: Accessibility

### Active
- [ ] Fetch candidate tickets from customer Jira (assigned to me, mentioned, watched users)
- [ ] Configure watched users beyond just myself
- [ ] Present candidate tickets in full detail (links, images, assignees, work log, history, comments, attachments, sub-tasks)
- [ ] Two actions per ticket: "Ignore" (move to ignored list) or "Copy to my Jira"
- [ ] Secure credential storage via OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service)
- [ ] Mock Jira server for development and testing without real PATs
- [ ] Excel export capability (scope to be defined in later milestones)
- [ ] Extensible architecture for future additions

### Out of Scope

- Two-way sync between Jira systems — complexity not justified, one-time copy with origin tracking is sufficient
- Real-time notifications — batch review workflow, not a monitoring dashboard
- OAuth/SSO authentication — PATs are the access method for both systems
- Mobile app — desktop-only for this workflow
- Video/rich media embedding — links and images yes, but not a full Jira renderer

## Context

- Customer Jira: Self-hosted (older version), accessed via REST API + PAT
- Company Jira: Cloud (new), accessed via REST API + PAT
- Two different Jira API versions may need to be handled (Server vs Cloud REST API differences)
- Small batch workflow: 5-20 tickets per review session, daily cadence
- Cross-platform requirement: macOS, Windows, Linux
- Tauri for desktop shell — Rust backend handles credential security and API calls, web frontend for UI
- No test PATs available — must have mock server layer from day one
- Watched users: same copy workflow applies to their tickets too (review + optionally copy)

## Constraints

- **Security**: Credentials stored in OS keychain only — never in plaintext, config files, or environment variables
- **Auditability**: Every REST call logged with timestamp, endpoint, method, status code, and response body
- **Testability**: Full mock Jira server that simulates both cloud and self-hosted APIs — development must not require real credentials
- **API compatibility**: Must handle differences between Jira Server REST API and Jira Cloud REST API
- **Cross-platform**: Must build and run on macOS, Windows, and Linux

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri over Electron | Lighter footprint, Rust backend for security, native feel | ✓ Validated Phase 1 |
| OS keychain for credentials | Most secure option, native to each platform | ✓ Validated Phase 1 |
| One-time copy with origin tracking | Full sync too complex, but need to know where tickets came from | ✓ Validated Phase 4 |
| Mock server for testing | No test PATs available, need development independence | ✓ Validated Phase 1 |
| Excel export deferred to later milestone | Core ticket workflow is priority, export scope TBD | — Pending |

---
*Last updated: 2026-03-24 — Phase 9 (Accessibility) complete*
