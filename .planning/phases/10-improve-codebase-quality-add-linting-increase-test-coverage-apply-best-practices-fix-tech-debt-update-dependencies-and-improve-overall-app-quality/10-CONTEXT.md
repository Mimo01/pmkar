# Phase 10: Improve Codebase Quality - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add linting, increase test coverage, apply best practices, fix tech debt, update dependencies, and improve overall app quality. No new features — this phase improves the existing codebase without changing user-facing behavior.

</domain>

<decisions>
## Implementation Decisions

### Linter & Formatter
- **D-01:** Use Biome as the single linting + formatting tool for the frontend (replaces need for ESLint + Prettier combo)
- **D-02:** Strict rules from day one — enable recommended + strict rulesets, all violations are errors (no warnings), all must be fixed before merging
- **D-03:** Add Rust clippy (pedantic) and rustfmt configuration for the backend — matches frontend quality bar

### Test Coverage
- **D-04:** Target 80% line coverage for the frontend codebase
- **D-05:** Add vitest coverage (v8/istanbul) with enforced minimum thresholds — `npm test` fails if coverage drops below target
- **D-06:** Prioritize all untested areas: Zustand stores (ticketStore, copyStore, connectionStore, languageStore), utility functions (lib/, test-utils/), page components (TicketDetailPage, SettingsPage sections), and Rust backend (Tauri commands, triage_db, copy pipeline)

### Tech Debt & Best Practices
- **D-07:** Eliminate all `any` type usage across the ~9 files that use it — replace with proper types or `unknown`
- **D-08:** Clean sweep of dead code — remove deprecated TicketTable component, unused imports, dead utility functions
- **D-09:** Set up GitHub Actions CI pipeline: lint + test + type-check on every push/PR

### Dependency Updates
- **D-10:** Update all dependencies to latest compatible versions (major + minor + patch), fix any breaking changes as part of this phase
- **D-11:** Update both npm dependencies and Rust crates

### Claude's Discretion
- Dependency management tooling (Renovate, Dependabot, or manual) — choose what fits best for a personal-use Tauri app
- Specific Biome rule customizations beyond the strict preset
- Coverage provider choice (v8 vs istanbul)
- CI workflow specifics (matrix builds, caching strategy)
- Order of test coverage work across the four priority areas

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Project config files (read for current state)
- `package.json` — Current npm dependencies, scripts, devDependencies
- `tsconfig.json` — TypeScript compiler options (already strict mode)
- `src-tauri/Cargo.toml` — Rust dependencies and features
- `vite.config.ts` — Vite build configuration
- `vitest.config.ts` — Current test configuration (if exists, otherwise in vite.config.ts)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/test-setup.ts` — Existing test setup with jsdom and testing-library
- `src/test-utils/` — Existing test utilities (mock providers, render helpers)
- `@testing-library/react` + `@testing-library/jest-dom` — Already installed and configured
- `vitest` v4.1 — Already configured with `test` and `test:watch` scripts

### Established Patterns
- TypeScript strict mode already enabled (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- Component tests use `@testing-library/react` with `render` + `screen` + `fireEvent`
- Zustand stores follow consistent patterns (connectionStore, ticketStore, copyStore, languageStore)
- Tauri mock via `@tauri-apps/api/core` mock in test-setup

### Integration Points
- 14 existing test files must continue passing after Biome introduction
- `npm run build` pipeline (`tsc && vite build`) — linting should integrate before or alongside
- `npm run test` — coverage thresholds integrate here
- GitHub Actions will need Tauri build dependencies for Rust test execution

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-improve-codebase-quality-add-linting-increase-test-coverage-apply-best-practices-fix-tech-debt-update-dependencies-and-improve-overall-app-quality*
*Context gathered: 2026-03-24*
