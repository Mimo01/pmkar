# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.1.0 — MVP

**Shipped:** 2026-03-25
**Phases:** 11 | **Plans:** 45 | **Tasks:** 84

### What Was Built
- Cross-platform Jira bridge: discover, review, and copy tickets between self-hosted Server and Cloud Jira
- Full copy fidelity: core fields, ADF translation, attachments, comments, work logs, sub-tasks, linked issues
- 3-tab triage workflow with persistent state (New / Ignored / Linked)
- Bilingual UI (EN/SK) with runtime switching
- Linear-inspired UI redesign with shadcn/ui and WCAG AA accessibility
- Production pipeline: CI, auto-update, cross-platform binary distribution

### What Worked
- Mock server from day one enabled parallel development without real Jira credentials
- Phase-by-phase progression with verification gates caught gaps early (COPY-05 sub-task gap caught and closed)
- Zustand store pattern (established in Phase 2) scaled cleanly through all 11 phases
- Wave 0 test scaffolding (test stubs before implementation) improved coverage discipline
- Quick tasks (`/gsd:quick`) handled ad-hoc requests without disrupting phase flow

### What Was Inefficient
- ROADMAP.md and REQUIREMENTS.md checkbox drift — checkboxes for FETCH-05/07/08/09 never updated despite implementation being complete
- Phase 8/9/10 requirements added to ROADMAP.md but never to REQUIREMENTS.md traceability table
- Phase 3 marked "Not started" in progress table despite all 5 plans complete
- Hardcoded `MYPROJ` project key survived through Phases 4-5 without being parameterized — will break against real Jira Cloud
- Biome lint violations in test files accumulated during Phase 10 and weren't fully resolved

### Patterns Established
- Tauri command → Zustand store → React component pattern for all features
- SQLite for persistent state (triage, audit, language preference, app config)
- shadcn/ui + Lucide icons as the component/icon system
- Conventional commits with `feat(phase)/fix(phase)/docs(phase)` prefixes
- VERIFICATION.md per phase with requirement cross-reference

### Key Lessons
1. **Checkbox drift is real** — automated traceability updates should happen at plan completion, not deferred to milestone audit
2. **Hardcoded values in mock-first development** persist longer than expected — parameterize config values from the start even when only mock exists
3. **11 phases in 6 days is aggressive** — the speed came at the cost of documentation consistency and some tech debt
4. **Quick tasks are valuable** but their changes (icon redesign, external Jira links) should be reflected back into phase documentation

### Cost Observations
- Model mix: primarily opus for planning/execution, sonnet for verification agents
- Sessions: ~15-20 across 6 days
- Notable: parallel agent execution (research, planning, verification) significantly reduced wall-clock time per phase

---

## Milestone: v0.3.0 — Notifications & Change Tracking

**Shipped:** 2026-03-29
**Phases:** 5 | **Plans:** 10 | **Tasks:** 10

### What Was Built
- SQLite snapshot storage with SHA-256 hash-based change detection and field-level diff engine
- Rust-side background polling engine (tokio loop) with configurable frequency and manual trigger
- OS-level desktop notifications via tauri-plugin-notification with per-event preferences
- Change diff view with blue dot indicators on ticket cards and field-level diff table
- Enhanced watch configuration with email domain search and bulk user add

### What Worked
- Milestone audit (`/gsd:audit-milestone`) before completion caught documentation drift (NOTIF checkbox/traceability table stale) — fixed before archiving
- 2 plans per phase kept scope tight and execution fast (3 days for 5 phases)
- Rust-side polling architecture decision was correct — continues when webview is backgrounded
- Phase dependency graph (12 → 13 → 14, 13 → 15, 13 → 16) enabled parallel execution of phases 14/15/16

### What Was Inefficient
- REQUIREMENTS.md traceability table for NOTIF-01–NOTIF-07 drifted to stale "Pending" status despite being satisfied — same checkbox drift pattern from v0.1.0
- Phase 13 summary one-liners were malformed (bug fix descriptions rather than feature summaries) — required manual cleanup in MILESTONES.md
- Nyquist validation not completed for any of the 5 phases — VALIDATION.md files exist in draft but none were finalized
- Blue dot implementation chose re-fetch path over direct changedKeys propagation — creates ~1-3s cosmetic delay

### Patterns Established
- SnapshotDb follows TriageDb/AuditDb pattern for SQLite persistence consistency
- watch channel (tokio::sync::watch) for controlling background loops from frontend commands
- tauri-plugin-notification for OS-level notifications with permission request flow
- Zustand slice pattern for unseen changes state management

### Key Lessons
1. **Checkbox drift is a systemic issue** — happened again in v0.3.0 despite being identified in v0.1.0 retro. Need automated enforcement, not manual discipline.
2. **Summary one-liner quality matters** — malformed one-liners cascade into MILESTONES.md entry. Verify summary quality at plan completion.
3. **Nyquist validation should happen per-phase, not deferred** — deferring to milestone end means all 5 phases are in draft simultaneously.
4. **Parallel phase execution works well** when dependency graph allows — phases 14/15/16 ran in parallel off phase 13.

### Cost Observations
- Model mix: primarily opus for execution, sonnet for verification/research agents
- Sessions: ~5-8 across 3 days
- Notable: 10 plans in 3 days (vs 45 plans in 6 days for v0.1.0) — improved velocity from established patterns

---

## Milestone: v0.4.0 — Configurable Field Mapping

**Shipped:** 2026-04-29
**Phases:** 7 (17-23) | **Plans:** 28

### What Was Built

- Field discovery engine — source v2 + target v3 schema discovery with paginated createmeta, FieldSchemaType discriminated union, SHA-256 schema hash, connection-time probe banner and status pill
- Pure Rust v2→v3 translation pipeline — batch user resolution (no N×M calls), version/component name→id lookups, wiki→ADF with post-processor gap-fills, two-phase apply_mapping
- Mapping persistence in `mapping.db` — separate SQLite DB per concern, 5 seeded defaults, CRUD Tauri commands
- Renderer registry — 17 field type renderers including PriorityRenderer, VirtualizedCombobox with TanStack Virtual (cmdk + useFlushSync:false for React 19), DynamicTargetForm stateless shell
- Mapping Editor in Settings — auto-save rows, drift warnings, 3-tier heuristic suggestions (exact-id / normalized-name / synonym), schema refresh button, 29 i18n keys (EN+SK)
- Copy Preview override panel — IssueTypeChooser (source-name default), per-copy in-memory overrides, computeGapFields + GapsSection, always-visible person picker with email pre-fill, Copy button disabled until all required fields resolved
- `copy_ticket_v2` cutover — CopyContext seam, 5 extracted pipeline helpers, audit logging with credential redaction, parameterized target project key (INT-02 debt resolved)

### What Worked

- Quick tasks (`/gsd:quick`) handled high-frequency post-phase bug fixes without disrupting the milestone plan — copy-mandatory-field-warning, duplicate-field-mapping, field-mapping-prefill, priority-renderer were all handled cleanly
- Debug sessions (`/gsd:debug`) resolved the UNIQUE INDEX / empty-sentinel bug (B-01) systematically with evidence-gathering before coding
- Milestone audit before close (`/gsd:audit-milestone`) surfaced the missing Phase 22 VERIFICATION.md and allowed making a deliberate defer decision rather than discovering it retroactively
- db-per-concern pattern scaled correctly — mapping.db added without friction alongside triage.db / snapshot.db / audit.db
- Wave-based parallel execution within phases (Wave 1 ∥ Wave 2 after scaffold) continued to be effective

### What Was Inefficient

- REQUIREMENTS.md checkbox drift happened again for the third milestone in a row — 34/41 requirements were never ticked off despite all phases being complete
- Phase 22 VERIFICATION.md was never produced — integration checker confirmed wiring but formal verification was deferred, surfacing only at milestone audit
- B-05 (user prefill excluded from PREFILLABLE_KINDS) slipped through Phase 22 and required a dedicated quick-task fix after the milestone was nominally complete
- B-01 (UNIQUE INDEX blocking gap resolution) was a correctness bug that also slipped through Phase 22 — both B-01 and B-05 point to insufficient integration testing for Phase 22 before calling it complete

### Patterns Established

- `computeGapFields` pure function pattern — field validation logic fully decoupled from UI components
- `initialQueriesByFieldId` threading pattern — pre-fill data flows from store to DynamicTargetForm without component coupling
- `CopyContext` seam — clean boundary between orchestration (copy_ticket_v2) and helpers (attachment/comment/worklog/subtask/link)
- Credential pattern sanitizer (Bearer/Basic/JWT/AWS/Slack regexes) as a utility — reusable across audit log contexts

### Key Lessons

1. **Checkbox drift is confirmed systemic** — three milestones now. The retro has named it each time; it needs to be fixed with tooling (automated traceability update at phase completion), not discipline.
2. **Integration phases need integration tests before SUMMARY** — Phase 22 shipped with B-01 and B-05 undetected. An integration test exercising the full copy preview flow (person picker + required gating + override) before writing 22-04-SUMMARY.md would have caught both.
3. **VERIFICATION.md should be mandatory for integration phases** — discovery phases and persistence phases can defer; integration phases that wire multiple subsystems together are the highest-value verification targets.
4. **Quick tasks are underrated** — 6 quick tasks during/after the milestone handled real user-visible issues rapidly without derailing phase planning.

### Cost Observations

- Model mix: primarily sonnet for execution, opus for planning and architecture decisions
- Sessions: ~12-15 across 3 days (2026-04-26 → 2026-04-29)
- Notable: 270 commits in 3 days for a 28-plan milestone — highest velocity yet; wave-based parallel plans and established patterns drove efficiency

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.1.0 | 11 | 45 | Baseline established — mock-first, phase-gated, Zustand-centric |
| v0.3.0 | 5 | 10 | Parallel phase execution, milestone audit before completion, Rust-side background loops |
| v0.4.0 | 7 | 28 | Quick tasks for post-phase bugs, debug sessions for systematic investigation, wave-based parallel within phases |

### Cumulative Quality

| Milestone | Tests | Coverage | LOC |
|-----------|-------|----------|-----|
| v0.1.0 | 389 + 28 Rust | 80.11% | 16,284 |
| v0.3.0 | 528 + 75 Rust | — | 23,250 |
| v0.4.0 | 682+ frontend + 221+ Rust | — | ~35,744 |

### Top Lessons (Verified Across Milestones)

1. **Checkbox/traceability drift is systemic** — happened in all three milestones (v0.1.0, v0.3.0, v0.4.0). Manual updates are insufficient; needs automation at phase completion.
2. **Integration phases are the highest-risk phases** — v0.4.0 Phase 22 shipped two bugs (B-01, B-05) undetected. Integration phases need integration tests before marking complete.
3. **VERIFICATION.md matters most for integration phases** — they wire subsystems; informal wiring confirmation is not enough.
4. Mock-first development enables rapid parallel progress but requires discipline on parameterizing config values
5. Phase verification gates catch real gaps — milestone audits before completion are worth the time investment
6. Quick tasks (`/gsd:quick`) + debug sessions (`/gsd:debug`) are production-quality tools, not workarounds — embrace them for post-phase bugs instead of backlogging
