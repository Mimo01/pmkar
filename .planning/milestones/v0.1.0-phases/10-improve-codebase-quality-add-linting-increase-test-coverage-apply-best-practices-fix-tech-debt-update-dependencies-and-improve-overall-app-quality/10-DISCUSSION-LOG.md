# Phase 10: Improve Codebase Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 10-improve-codebase-quality-add-linting-increase-test-coverage-apply-best-practices-fix-tech-debt-update-dependencies-and-improve-overall-app-quality
**Areas discussed:** Linter & formatter, Test coverage strategy, Tech debt & best practices, Dependency updates

---

## Linter & Formatter

### Frontend tool choice

| Option | Description | Selected |
|--------|-------------|----------|
| Biome (Recommended) | Single tool for both linting + formatting. Fast (Rust-based), minimal config. | ✓ |
| ESLint + Prettier | Industry standard combo. Huge plugin ecosystem, more config files. | |
| OxLint + Prettier | Very fast Rust-based linter + Prettier. Newer, smaller ecosystem. | |

**User's choice:** Biome

### Strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Strict from day one | Enable recommended + strict rules. All violations are errors. | ✓ |
| Gradual adoption | Start with recommended, existing violations as warnings. | |
| Recommended only | Default recommended ruleset, no custom strictness. | |

**User's choice:** Strict from day one

### Rust quality tooling

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, both (Recommended) | Clippy pedantic + rustfmt config. | ✓ |
| Clippy only | Clippy config but leave formatting to defaults. | |
| Skip Rust tooling | Focus on frontend only. | |

**User's choice:** Yes, both

---

## Test Coverage Strategy

### Coverage target

| Option | Description | Selected |
|--------|-------------|----------|
| 80% line coverage (Recommended) | Solid target, covers happy paths + key error paths. | ✓ |
| 60% line coverage | Pragmatic minimum, focus on critical paths. | |
| 90%+ line coverage | High bar, requires significant mocking effort. | |

**User's choice:** 80% line coverage

### Priority areas (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Store logic (Zustand) | ticketStore, copyStore, connectionStore, languageStore | ✓ |
| Utility functions | lib/ and test-utils/ — pure functions, highest ROI | ✓ |
| Page components | TicketDetailPage, SettingsPage sections | ✓ |
| Rust backend | Tauri commands, triage_db, copy pipeline | ✓ |

**User's choice:** All four areas selected

### Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with threshold (Recommended) | Add vitest coverage, enforce minimums in `npm test`. | ✓ |
| Report only | Coverage for visibility, no blocking. | |
| Skip for now | Focus on writing tests, measure later. | |

**User's choice:** Yes, with threshold

---

## Tech Debt & Best Practices

### `any` type usage

| Option | Description | Selected |
|--------|-------------|----------|
| Eliminate all `any` (Recommended) | Replace every `any` with proper types or `unknown`. | ✓ |
| Reduce to essential | Fix obvious cases, allow where genuinely complex. | |
| Leave as-is | TypeScript strict mode is already on. | |

**User's choice:** Eliminate all `any`

### Dead code removal

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, clean sweep (Recommended) | Remove deprecated TicketTable, unused imports, dead utils. | ✓ |
| Mark only | Add @deprecated annotations, keep for reference. | |
| Skip | Not worth the risk. | |

**User's choice:** Clean sweep

### CI pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions (Recommended) | Lint + test + type-check on push/PR. | ✓ |
| Pre-commit hooks only | Husky/lint-staged, no cloud CI. | |
| Both CI + hooks | Belt and suspenders. | |

**User's choice:** GitHub Actions

---

## Dependency Updates

### Update scope

| Option | Description | Selected |
|--------|-------------|----------|
| All updates (Recommended) | Major + minor + patch. Fix breaking changes in this phase. | ✓ |
| Minor + patch only | Conservative, non-breaking only. | |
| Security patches only | Minimal risk, vulnerabilities only. | |

**User's choice:** All updates

### Ongoing management

| Option | Description | Selected |
|--------|-------------|----------|
| Renovate/Dependabot (Recommended) | Automated PRs for updates. | |
| Manual `npm outdated` | Periodic manual checks. | |
| Skip | One-time update is enough. | |

**User's choice:** "You decide" — deferred to Claude's discretion

---

## Claude's Discretion

- Dependency management tooling choice
- Biome rule customizations beyond strict preset
- Coverage provider (v8 vs istanbul)
- CI workflow specifics
- Test priority ordering

## Deferred Ideas

None — discussion stayed within phase scope.
