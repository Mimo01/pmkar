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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v0.1.0 | 11 | 45 | Baseline established — mock-first, phase-gated, Zustand-centric |
| v0.3.0 | 5 | 10 | Parallel phase execution, milestone audit before completion, Rust-side background loops |

### Cumulative Quality

| Milestone | Tests | Coverage | LOC |
|-----------|-------|----------|-----|
| v0.1.0 | 389 + 28 Rust | 80.11% | 16,284 |
| v0.3.0 | 528 + 75 Rust | — | 23,250 |

### Top Lessons (Verified Across Milestones)

1. **Checkbox/traceability drift is systemic** — happened in both v0.1.0 and v0.3.0. Manual updates are insufficient; needs automation.
2. Mock-first development enables rapid parallel progress but requires discipline on parameterizing config values
3. Phase verification gates catch real gaps — milestone audits before completion are worth the time investment
4. Parallel phase execution (when dependency graph allows) significantly improves velocity
