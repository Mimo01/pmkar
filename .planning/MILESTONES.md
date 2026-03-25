# Milestones

## v1.0 MVP (Shipped: 2026-03-25)

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
- 19 tech debt items documented in `.planning/milestones/v1.0-MILESTONE-AUDIT.md`

### Archives

- [Roadmap](milestones/v1.0-ROADMAP.md)
- [Requirements](milestones/v1.0-REQUIREMENTS.md)
- [Audit](milestones/v1.0-MILESTONE-AUDIT.md)

---
