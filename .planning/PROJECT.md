# Pmkar

## What This Is

Pmkar is a cross-platform desktop app (Tauri 2.10 / React 19 / Rust) that bridges two Jira systems — a customer's legacy self-hosted Jira Server and the user's company's Jira Cloud. It discovers relevant tickets, presents them for review with full detail, and copies them with maximum fidelity (attachments, comments, work logs, sub-tasks) to the company's Jira. Bilingual (EN/SK), accessible (WCAG AA), with auto-update.

## Core Value

Surface relevant tickets from the customer's Jira and copy them with maximum fidelity to my company's Jira — no manual re-entry, no lost detail.

## Requirements

### Validated

- ✓ Secure credential storage via OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service) — v0.1.0
- ✓ All REST API calls logged with full request/response for audit, with credential redaction — v0.1.0
- ✓ Mock Jira server (Server v2 + Cloud v3) for development and testing without real PATs — v0.1.0
- ✓ Setup wizard for configuring two Jira connections with test/validation feedback — v0.1.0
- ✓ Fetch candidate tickets from customer Jira (assigned, mentioned, watched users) with configurable JQL — v0.1.0
- ✓ Full ticket detail view: summary, description, status, priority, assignee, reporter, labels, components, fix versions, comments, work log, attachments, sub-tasks, linked issues, change history — v0.1.0
- ✓ Copy ticket core fields with wiki markup → ADF translation and diff preview — v0.1.0
- ✓ Copy binary attachments, comment threads with attribution, work log entries, sub-tasks as child issues — v0.1.0
- ✓ Origin tracking via remote link back to source ticket — v0.1.0
- ✓ Triage workflow: ignore/restore tickets, persistent state across sessions — v0.1.0
- ✓ In-app audit log viewer with expandable REST API call details — v0.1.0
- ✓ UI available in English and Slovak, switchable at runtime with persistent preference — v0.1.0
- ✓ Modern UI with shadcn/ui, Lucide icons, card-based layouts, Linear-inspired aesthetic — v0.1.0
- ✓ WCAG AA accessibility: dark mode contrast 4.5:1+, keyboard navigation, ARIA semantics, live regions — v0.1.0
- ✓ Cross-platform binary distribution with tag-triggered CI (macOS, Windows, Linux) — v0.1.0
- ✓ Auto-update via Tauri updater plugin with blocking modal — v0.1.0
- ✓ Changelog generation from conventional commits and version sync tooling — v0.1.0
- ✓ Biome + clippy pedantic linting, 80% test coverage with threshold enforcement — v0.1.0
- ✓ GitHub Actions CI (lint + type-check + test + clippy + fmt) — v0.1.0

### Active

- [ ] OS-level notifications for ticket changes (native desktop notifications via Tauri)
- [ ] Configurable notification preferences (choose which events trigger notifications)
- [ ] Enhanced watch configuration — watch by specific users or by selector (e.g., email domain)
- [~] Background ticket update detection with configurable auto-poll frequency (snapshot foundation delivered in Phase 12)
- [ ] Manual poll on demand — user can trigger a refresh anytime
- [~] Change diff view — see what changed on a ticket since last fetch (field-level diff engine delivered in Phase 12)
- [ ] Excel export capability (scope TBD)
- [ ] Configurable cloud project key (currently hardcoded as MYPROJ)
- [ ] CopyResultModal step label i18n coverage (raw strings for some steps)

## Current Milestone: v0.3.0 Notifications & Change Tracking

**Goal:** Detect ticket changes after initial fetch, notify users via OS-level notifications, and let them configure what they watch, get notified about, and how often to poll.

**Target features:**
- OS-level notifications for ticket changes
- Configurable notification preferences in settings
- Enhanced watch configuration (by user or by selector like email domain)
- Background ticket update detection with configurable auto-poll frequency
- Manual poll on demand
- Change diff view showing what changed on a ticket

### Out of Scope

- Two-way sync — complexity not justified, one-time copy with origin tracking sufficient
- OAuth/SSO authentication — PATs are the access method for both systems
- Mobile app — desktop-only for this workflow
- Offline mode — real-time Jira API access is core to the workflow
- Bulk copy (select all) — defeats review workflow purpose, copy is ticket-by-ticket

## Context

Shipped v0.1.0 with 16,284 LOC (11,711 TypeScript + 4,573 Rust).
Tech stack: Tauri 2.10, React 19, TypeScript 6, Vite 8, Zustand, shadcn/ui, i18next, Rust (axum, keyring, rusqlite, reqwest-middleware, htmltoadf).
389 frontend tests (Vitest), 44 Rust tests, 80.11% line coverage.
Phase 12 complete — SnapshotDb data layer and Tauri integration for change tracking.
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
| Tauri over Electron | Lighter footprint, Rust backend for security, native feel | ✓ Good — v0.1.0 |
| OS keychain for credentials | Most secure option, native to each platform | ✓ Good — v0.1.0 |
| One-time copy with origin tracking | Full sync too complex, origin links sufficient | ✓ Good — v0.1.0 |
| Mock server from day one | No test PATs available, dev independence | ✓ Good — v0.1.0 |
| shadcn/ui + Lucide for UI | Consistent design system, accessible by default | ✓ Good — v0.1.0 |
| i18next for internationalization | Runtime switching, persistent preference via SQLite | ✓ Good — v0.1.0 |
| Public releases repo for binaries | Keep source private, publish to Mimo01/pmkar-releases | ✓ Good — v0.1.0 |
| Tauri updater plugin for auto-updates | Native mechanism with signed artifacts | ✓ Good — v0.1.0 |
| Excel export deferred | Core ticket workflow is priority, export scope TBD | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after Phase 16 (enhanced-watch-configuration) completion*
