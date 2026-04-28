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
- ✓ Background ticket update detection with configurable auto-poll frequency (5m/15m/30m/1h/off) — v0.3.0
- ✓ Manual poll on demand via button or F5 — v0.3.0
- ✓ SQLite snapshot storage with SHA-256 hash-based change detection and field-level diff — v0.3.0
- ✓ OS-level desktop notifications for ticket changes (status, priority, comments, new tickets) — v0.3.0
- ✓ Configurable notification preferences with per-event toggles — v0.3.0
- ✓ Change diff view with blue dot indicators and field-level diff table — v0.3.0
- ✓ Enhanced watch configuration with email domain search and bulk user add — v0.3.0
- ✓ Field discovery engine: source v2 + target v3 schema discovery with paginated createmeta, FieldSchemaType discriminated union (Rust+TS), SHA-256 schema_hash, field_schema_cache table in mapping.db, 5 Tauri commands (discover/probe/prewarm/refresh), probe banner + ConnectionCard status pill — v0.4.0 Phase 17 (DISC-01, DISC-02, DISC-03, DISC-04)
- ✓ v2→v3 translation layer: typed gap variants, batch user resolution (TRAN-01/06), ADF post-processor (TRAN-02/05), version/component name→id resolvers (TRAN-03/04), two-phase pipeline — v0.4.0 Phase 18
- ✓ Mapping persistence: `field_mapping` + `mapping_meta` SQLite tables in `mapping.db`, 5 seeded defaults (description/labels/priority/assignee/reporter), CRUD methods + 3 Tauri commands (get/set/delete_field_mapping) — v0.4.0 Phase 19 (MAP-01, MAP-02)
- ✓ Renderer registry: 17 Jira field type renderers (String/TextArea/Url/Date/DateTime/Number/Checkbox/Radio/UnsupportedType + User/MultiUser/Group/SingleSelect/MultiSelect/Labels/Component/Version/Priority), VirtualizedCombobox (cmdk + TanStack Virtual, useFlushSync:false for React 19), DynamicTargetForm stateless shell, 7 fieldRenderer.* i18n keys — v0.4.0 Phase 20 (CTRL-01..08)
- ✓ Mapping Editor Settings UI: Settings → Copying → Field Mapping section with MappingRow auto-save, DriftWarning, SuggestionsPanel heuristics (3-tier: exact-id / normalized-name / synonym set), FieldMappingSection orchestrator, Refresh schema + Last refreshed timestamp, 29 i18n keys (EN+SK), 70 tests — v0.4.0 Phase 21 (DISC-05, MAP-03, MAP-04, MAP-05, EDIT-01, EDIT-02, EDIT-03)
- ✓ Copy Preview override panel: IssueTypeChooser (defaults to source-name match), per-copy in-memory overrides, computeGapFields + GapsSection with required-field gating, always-visible person picker with email pre-fill (initialQueriesByFieldId), Copy button disabled until all required fields resolved — v0.4.0 Phase 22 (PERS-01..04, OVRD-01..06) — VERIFICATION.md deferred
- ✓ copy_ticket_v2: mapping-aware copy command replacing copy_ticket — CopyContext seam, 5 extracted helpers, mapping load + UserResolver + apply_mapping + per-field audit with credential redaction, parameterized target project key (zero MYPROJ literals), full-pipeline integration test with ACME project key — v0.4.0 Phase 23 (CUTV-01, CUTV-02, CUTV-03, CUTV-04)

### Active

- [ ] Excel export capability (scope TBD) — tracked as EXPRT-01
- [ ] CopyResultModal step label i18n coverage (raw strings for some steps) — tracked as CONI-01
- [ ] Taskbar/dock badge count showing unread change count — tracked as BADGE-01
- [ ] In-app notification history panel — tracked as NHIST-01
- [ ] Phase 22 VERIFICATION.md — formal verification of PERS-01..04, OVRD-01..06 (code confirmed wired; human verification deferred)

### Out of Scope

- Two-way sync — complexity not justified, one-time copy with origin tracking sufficient
- OAuth/SSO authentication — PATs are the access method for both systems
- Mobile app — desktop-only for this workflow
- Offline mode — real-time Jira API access is core to the workflow
- Bulk copy (select all) — defeats review workflow purpose, copy is ticket-by-ticket

## Context

Shipped v0.4.0 with ~35,744 LOC (22,718 TypeScript + 13,026 Rust).
Tech stack: Tauri 2.10, React 19, TypeScript 6, Vite 8, Zustand, shadcn/ui, i18next, Rust (axum, keyring, rusqlite, reqwest-middleware, htmltoadf, tauri-plugin-notification). Added: cmdk, @tanstack/react-virtual, sonner.
682+ frontend tests (Vitest), 221+ Rust tests.
Local pre-commit hook replaces GitHub Actions CI (lint + type-check + test + clippy + fmt).
Auto-update via Tauri updater plugin publishing to Mimo01/pmkar-releases.
Mapping engine fully operational: field discovery → SQLite persistence → renderer registry → copy preview → copy_ticket_v2 pipeline.

## Constraints

- **Security**: Credentials stored in OS keychain only — never in plaintext, config files, or environment variables
- **Auditability**: Every REST call logged with timestamp, endpoint, method, status code, and response body
- **Testability**: Full mock Jira server that simulates both cloud and self-hosted APIs
- **API compatibility**: Must handle differences between Jira Server REST API and Jira Cloud REST API
- **Cross-platform**: Must build and run on macOS, Windows, and Linux

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Configurable field mapping (v0.4.0) | Hardcoded fields don't survive real-world Jira diversity; custom fields and per-customer schemas need user control | ✓ Good — v0.4.0 |
| Global mapping scope (one mapping for app) | Simpler than per-project-pair or per-issue-type; combined with per-copy override gives flexibility without config explosion | ✓ Good — v0.4.0 |
| Person picker always visible with email-match pre-fill | Avoids silent assignment failures; user sees outcome before commit | ✓ Good — v0.4.0 |
| Block copy on unmapped required target fields | Prevents Jira Cloud rejection mid-pipeline; explicit better than auto-default | ✓ Good — v0.4.0 |
| Target issue type chosen at copy time | Source/target type semantics differ across Jiras; auto-match too brittle | ✓ Good — v0.4.0 |
| CopyContext seam for v2 pipeline | Clean boundary for helper extraction; enables testing helpers independently | ✓ Good — v0.4.0 |
| Hash-based audit redaction by default | PII protection on by default; verbose mode opt-in for debugging | ✓ Good — v0.4.0 |
| db-per-concern for mapping.db | Follows established pattern (triage.db / snapshot.db / audit.db); avoids cross-domain schema coupling | ✓ Good — v0.4.0 |
| Tauri over Electron | Lighter footprint, Rust backend for security, native feel | ✓ Good — v0.1.0 |
| OS keychain for credentials | Most secure option, native to each platform | ✓ Good — v0.1.0 |
| One-time copy with origin tracking | Full sync too complex, origin links sufficient | ✓ Good — v0.1.0 |
| Mock server from day one | No test PATs available, dev independence | ✓ Good — v0.1.0 |
| shadcn/ui + Lucide for UI | Consistent design system, accessible by default | ✓ Good — v0.1.0 |
| i18next for internationalization | Runtime switching, persistent preference via SQLite | ✓ Good — v0.1.0 |
| Public releases repo for binaries | Keep source private, publish to Mimo01/pmkar-releases | ✓ Good — v0.1.0 |
| Tauri updater plugin for auto-updates | Native mechanism with signed artifacts | ✓ Good — v0.1.0 |
| Excel export deferred | Core ticket workflow is priority, export scope TBD | — Pending |
| Rust-side polling (tokio loop) | Continues when webview is backgrounded; setInterval would throttle | ✓ Good — v0.3.0 |
| SQLite snapshots + SHA-256 hash | Fast change detection without full field comparison on every poll | ✓ Good — v0.3.0 |
| tauri-plugin-notification for OS notifications | Native notifications without Electron-style workarounds | ✓ Good — v0.3.0 |
| Quiet hours removed | User requested removal during Phase 14 — simplifies notification UX | ✓ Good — v0.3.0 |
| Re-fetch path for blue dots (not direct changedKeys) | Simpler wiring; ~1-3s cosmetic delay acceptable vs. dual state path | ⚠️ Revisit |
| Local pre-commit hook replaces GitHub Actions CI | No public CI needed for private repo; faster feedback loop | ✓ Good — v0.3.0 |

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
*Last updated: 2026-04-29 after v0.4.0 milestone*
