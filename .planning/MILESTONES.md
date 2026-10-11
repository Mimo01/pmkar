# Milestones

## v0.4.8 Mapping Refinements & Static Values (Shipped: 2026-05-20)

**Phases:** 4 (24-27) | **Plans:** 9 | **Quick tasks:** ~70
**Timeline:** 22 days (2026-04-29 → 2026-05-20), released incrementally as v0.4.1 → v0.4.8
**Codebase:** ~47,800 LOC (29,427 TypeScript + 18,409 Rust) | 234 commits | 835 frontend + 271 Rust tests
**Git range:** 1fedada → 606cca0 (125 files, +11,343 / −2,271 excluding .planning)

**Delivered:** Post-v0.4.0 hardening of the field mapping engine. Copy-time audit rows show resolved values. Description and user fields are resolved when the copy preview opens. Ticket fetching runs one batch per watched user. A new `static` transformer kind fills target-only Cloud fields with a constant.

**Key accomplishments:**

1. Copy-time audit resolution — `copy_ticket_v2` writes per-field `copied/skipped/failed` rows after the override merge; a blue `copied` badge appears in Field Transformations
2. Preview-time resolution — new `resolve_description_to_adf` + `resolve_users_preview` commands; description ADF and user picks are visible and editable before Copy
3. Per-user batched ticket fetch — sequential JQL per watched user with progress counter and partial-failure warning; no more single oversized call
4. Static value mapping — `static_value` column, schema-aware `apply_mapping` static branch (scalar/option/array), `StaticValueWidget` + `StaticMappingRow` UI, 11 EN+SK keys
5. ~70 quick tasks — `user_name` transformer, priority renderer, dynamic source field listing, audit log redesign, JQL presets (mine/all/watched), richer mock data, loading UX, eager priority prefetch for static mapping

### Known Gaps

Known deferred items at close: 3 (see STATE.md Deferred Items)
- Phase 25: VERIFICATION human_needed; HUMAN-UAT 3 scenarios pending (description prose rendering, picker pre-fill, E2E copy)
- Phase 24 VERIFICATION.md still reads gaps_found, but the gap was fixed in 5fb7594; it was never re-verified
- Debug sessions `knowledge-base`, `user-mapping-not-resolved` left open

---

## v0.4.0 Configurable Field Mapping (Shipped: 2026-04-29)

**Phases:** 7 (17-23) | **Plans:** 28
**Timeline:** 3 days (2026-04-26 → 2026-04-29)
**Codebase:** ~35,744 LOC (22,718 TypeScript + 13,026 Rust) | 270 commits
**Git range:** 1397502 → 3c32d8e

**Delivered:** Full user-configurable field mapping engine bridging Jira Server v2 → Cloud v3 — field discovery with paginated createmeta, pure Rust translation pipeline (user/version/component/ADF), SQLite mapping persistence with seeded defaults, renderer registry covering 17 field types with virtualized pickers, mapping editor UI in Settings, copy preview override panel with issue-type chooser and required-field gating, and copy_ticket_v2 pipeline cutover with audit logging.

**Key accomplishments:**

1. Field discovery engine — source v2 + target v3 schema discovery with paginated createmeta, custom field type detection, connection-time probe banner and status pill
2. Pure Rust v2→v3 translation pipeline — batch user resolution (no N×M calls), version/component name→id lookups, wiki→ADF with post-processor gap-fills, two-phase apply_mapping
3. Mapping persistence in `mapping.db` with 5 seeded defaults (description/labels/priority/assignee/reporter) and CRUD Tauri commands
4. Renderer registry with 17 Jira field types, VirtualizedCombobox (cmdk + TanStack Virtual), DynamicTargetForm stateless shell
5. Mapping Editor in Settings — auto-save rows, drift warnings, heuristic name-match suggestions (3-tier), schema refresh button, 29 i18n keys (EN+SK)
6. Copy Preview override panel — issue-type chooser, per-copy in-memory overrides, required-field gating (copy blocked until all required fields resolved), always-visible person picker with email pre-fill
7. `copy_ticket_v2` cutover — CopyContext seam, 5 extracted pipeline helpers, audit logging with credential redaction, parameterized target project key (INT-02 debt resolved)

### Known Gaps

Phase 22 VERIFICATION.md deferred at milestone close (code confirmed wired by integration checker):
- PERS-01..04, OVRD-01..06: 10 requirements — all code paths verified by integration checker; formal VERIFICATION.md not produced

Tech debt items acknowledged:
- DISC-04: 3 human verification items pending (probe banner visual, status pill, per-session dismiss/restart)
- TRAN-05: wiki ADF links/blockquotes/hard-breaks coverage — human spot-check recommended
- CTRL-08: VirtualizedCombobox 500+ item performance — human browser observation deferred

Known deferred items at close: 1 open debug session file (resolved), 0 unresolved items (see STATE.md Deferred Items)

### Archives

- [Roadmap](milestones/v0.4.0-ROADMAP.md)
- [Requirements](milestones/v0.4.0-REQUIREMENTS.md)
- [Audit](milestones/v0.4.0-MILESTONE-AUDIT.md)

---

## v0.3.0 Notifications & Change Tracking (Shipped: 2026-03-29)

**Phases:** 5 | **Plans:** 10 | **Tasks:** 10
**Timeline:** 10 days (2026-03-19 → 2026-03-29)
**Codebase:** 23,250 LOC (16,048 TypeScript + 7,202 Rust) | 91 commits
**Git range:** 1df1a29 → 8ed9bdc

**Delivered:** Ticket change tracking pipeline — background polling detects field-level changes via SQLite snapshots, sends OS-level desktop notifications with configurable per-event preferences, and surfaces diffs in a dedicated change view with visual indicators.

**Key accomplishments:**

1. SQLite snapshot storage with SHA-256 hash-based change detection, volatile field stripping, and watermark query
2. Rust-side background polling engine (tokio loop) with configurable frequency (5m/15m/30m/1h/off) and manual trigger
3. OS-level notification dispatch with body formatting, event filtering, and per-event toggle preferences
4. Change diff view — blue dot indicators on ticket cards, field-level diff table, auto-switch to Changes tab
5. Enhanced watch configuration with email domain search, bulk user add, and Jira Cloud privacy warning

### Known Gaps

Per milestone audit (tech_debt status):

- MC-01: Blue dots appear via re-fetch path (~1-3s delay) rather than directly from changedKeys payload (cosmetic)
- Nyquist validation not completed for phases 12-16 (VALIDATION.md files exist in draft)

### Archives

- [Roadmap](milestones/v0.3.0-ROADMAP.md)
- [Requirements](milestones/v0.3.0-REQUIREMENTS.md)
- [Audit](milestones/v0.3.0-MILESTONE-AUDIT.md)

---

## v0.1.0 MVP (Shipped: 2026-03-25)

**Phases:** 11 | **Plans:** 45 | **Tasks:** 84
**Timeline:** 6 days (2026-03-19 → 2026-03-25)
**Codebase:** 16,284 LOC (11,711 TypeScript + 4,573 Rust) | 328 commits
**Git range:** initial commit → e433d75

**Delivered:** Cross-platform Jira bridge desktop app — discovers tickets from a customer's self-hosted Jira and copies them with full fidelity (attachments, comments, work logs, sub-tasks) to the company's cloud Jira, with bilingual UI, accessibility, and auto-update.

**Key accomplishments:**

1. Tauri 2.10 + React 19 desktop app with OS keychain credential security and dual mock Jira servers
2. End-to-end copy pipeline: core fields with ADF translation, binary attachments, comments, work logs, sub-tasks, and origin tracking
3. 3-tab triage workflow (New / Ignored / Linked) with persistent state and in-app audit log viewer
4. Bilingual UI (English + Slovak) with runtime language switching and persistent preference
5. Linear-inspired UI redesign with shadcn/ui, Lucide icons, card-based layouts, and full-page detail view
6. WCAG AA accessibility: 4.5:1+ contrast, keyboard navigation, ARIA semantics, live regions
7. Production infrastructure: Biome + clippy linting, 80% test coverage (389 tests), GitHub Actions CI, auto-update system

### Known Gaps

Per milestone audit (tech_debt status):

- INT-02: Hardcoded `MYPROJ` cloud project key — copy fails against real Jira Cloud with different project key
- INT-01: `CopyResultModal` step label mismatch (cosmetic)
- INT-03: Attachment upload HTTP calls bypass audit middleware
- 19 tech debt items documented in `.planning/milestones/v0.1.0-MILESTONE-AUDIT.md`

### Archives

- [Roadmap](milestones/v0.1.0-ROADMAP.md)
- [Requirements](milestones/v0.1.0-REQUIREMENTS.md)
- [Audit](milestones/v0.1.0-MILESTONE-AUDIT.md)

---
