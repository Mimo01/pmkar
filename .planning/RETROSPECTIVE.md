# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 11 | 45 | Baseline established — mock-first, phase-gated, Zustand-centric |

### Cumulative Quality

| Milestone | Tests | Coverage | LOC |
|-----------|-------|----------|-----|
| v1.0 | 389 + 28 Rust | 80.11% | 16,284 |

### Top Lessons (Verified Across Milestones)

1. Mock-first development enables rapid parallel progress but requires discipline on parameterizing config values
2. Phase verification gates catch real gaps — COPY-05 sub-task creation was missing until verification surfaced it
