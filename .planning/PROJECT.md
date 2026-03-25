# Pmkar

## What This Is

Pmkar is a cross-platform desktop app (Tauri 2.10 / React 19 / Rust) that bridges two Jira systems — a customer's legacy self-hosted Jira Server and the user's company's Jira Cloud. It discovers relevant tickets, presents them for review with full detail, and copies them with maximum fidelity (attachments, comments, work logs, sub-tasks) to the company's Jira. Bilingual (EN/SK), accessible (WCAG AA), with auto-update.

## Core Value

Surface relevant tickets from the customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## Requirements

### Validated

- ✓ Secure credential storage via OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service) — v1.0
- ✓ All REST API calls logged with full request/response for audit, with credential redaction — v1.0
- ✓ Mock Jira server (Server v2 + Cloud v3) for development and testing without real PATs — v1.0
- ✓ Setup wizard for configuring two Jira connections with test/validation feedback — v1.0
- ✓ Fetch candidate tickets from customer Jira (assigned, mentioned, watched users) with configurable JQL — v1.0
- ✓ Full ticket detail view: summary, description, status, priority, assignee, reporter, labels, components, fix versions, comments, work log, attachments, sub-tasks, linked issues, change history — v1.0
- ✓ Copy ticket core fields with wiki markup → ADF translation and diff preview — v1.0
- ✓ Copy binary attachments, comment threads with attribution, work log entries, sub-tasks as child issues — v1.0
- ✓ Origin tracking via remote link back to source ticket — v1.0
- ✓ Triage workflow: ignore/restore tickets, persistent state across sessions — v1.0
- ✓ In-app audit log viewer with expandable REST API call details — v1.0
- ✓ UI available in English and Slovak, switchable at runtime with persistent preference — v1.0
- ✓ Modern UI with shadcn/ui, Lucide icons, card-based layouts, Linear-inspired aesthetic — v1.0
- ✓ WCAG AA accessibility: dark mode contrast 4.5:1+, keyboard navigation, ARIA semantics, live regions — v1.0
- ✓ Cross-platform binary distribution with tag-triggered CI (macOS, Windows, Linux) — v1.0
- ✓ Auto-update via Tauri updater plugin with blocking modal — v1.0
- ✓ Changelog generation from conventional commits and version sync tooling — v1.0
- ✓ Biome + clippy pedantic linting, 80% test coverage with threshold enforcement — v1.0
- ✓ GitHub Actions CI (lint + type-check + test + clippy + fmt) — v1.0

### Active

- [ ] Excel export capability (scope TBD)
- [ ] Configurable cloud project key (currently hardcoded as MYPROJ)
- [ ] CopyResultModal step label i18n coverage (raw strings for some steps)

### Out of Scope

- Two-way sync — complexity not justified, one-time copy with origin tracking sufficient
- Real-time notifications — batch review workflow, not a monitoring dashboard
- OAuth/SSO authentication — PATs are the access method for both systems
- Mobile app — desktop-only for this workflow
- Offline mode — real-time Jira API access is core to the workflow
- Bulk copy (select all) — defeats review workflow purpose, copy is ticket-by-ticket

## Context

Shipped v1.0 with 16,284 LOC (11,711 TypeScript + 4,573 Rust).
Tech stack: Tauri 2.10, React 19, TypeScript 6, Vite 8, Zustand, shadcn/ui, i18next, Rust (axum, keyring, rusqlite, reqwest-middleware, htmltoadf).
389 frontend tests (Vitest), 28 Rust tests, 80.11% line coverage.
GitHub Actions CI with parallel frontend + Rust jobs.
Auto-update via Tauri updater plugin publishing to Mimo01/pmkar-releases.

## Constraints

- **Security**: Credentials stored in OS keychain only — never in plaintext, config files, or environment variables
- **Auditability**: Every REST call logged with timestamp, endpoint, method, status code, and response body
- **Testability**: Full mock Jira server that simulates both cloud and self-hosted APIs
- **API compatibility**: Must handle differences between Jira Server REST API and Jira Cloud REST API
- **Cross-platform**: Must build and run on macOS, Windows, and Linux

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri over Electron | Lighter footprint, Rust backend for security, native feel | ✓ Good — v1.0 |
| OS keychain for credentials | Most secure option, native to each platform | ✓ Good — v1.0 |
| One-time copy with origin tracking | Full sync too complex, origin links sufficient | ✓ Good — v1.0 |
| Mock server from day one | No test PATs available, dev independence | ✓ Good — v1.0 |
| shadcn/ui + Lucide for UI | Consistent design system, accessible by default | ✓ Good — v1.0 |
| i18next for internationalization | Runtime switching, persistent preference via SQLite | ✓ Good — v1.0 |
| Public releases repo for binaries | Keep source private, publish to Mimo01/pmkar-releases | ✓ Good — v1.0 |
| Tauri updater plugin for auto-updates | Native mechanism with signed artifacts | ✓ Good — v1.0 |
| Excel export deferred | Core ticket workflow is priority, export scope TBD | — Pending |

---
*Last updated: 2026-03-25 after v1.0 milestone*
