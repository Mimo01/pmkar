# Phase 10: Improve Codebase Quality - Research

**Researched:** 2026-03-24
**Domain:** TypeScript/React linting (Biome), Vitest coverage, Rust Clippy/rustfmt, dependency updates (npm + Cargo), GitHub Actions CI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use Biome as the single linting + formatting tool for the frontend (replaces ESLint + Prettier)
- **D-02:** Strict rules from day one — enable recommended + strict rulesets, all violations are errors (no warnings), all must be fixed before merging
- **D-03:** Add Rust clippy (pedantic) and rustfmt configuration for the backend — matches frontend quality bar
- **D-04:** Target 80% line coverage for the frontend codebase
- **D-05:** Add vitest coverage (v8/istanbul) with enforced minimum thresholds — `npm test` fails if coverage drops below target
- **D-06:** Prioritize all untested areas: Zustand stores (ticketStore, copyStore, connectionStore, languageStore), utility functions (lib/, test-utils/), page components (TicketDetailPage, SettingsPage sections), and Rust backend (Tauri commands, triage_db, copy pipeline)
- **D-07:** Eliminate all `any` type usage — replace with proper types or `unknown`
- **D-08:** Clean sweep of dead code — remove deprecated TicketTable component, unused imports, dead utility functions
- **D-09:** Set up GitHub Actions CI pipeline: lint + test + type-check on every push/PR
- **D-10:** Update all dependencies to latest compatible versions (major + minor + patch), fix any breaking changes
- **D-11:** Update both npm dependencies and Rust crates

### Claude's Discretion

- Dependency management tooling (Renovate, Dependabot, or manual) — choose what fits best for a personal-use Tauri app
- Specific Biome rule customizations beyond the strict preset
- Coverage provider choice (v8 vs istanbul)
- CI workflow specifics (matrix builds, caching strategy)
- Order of test coverage work across the four priority areas

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 10 is a quality-hardening phase with no new features. The codebase enters the phase in good shape: 14 test files, 114 passing tests, TypeScript strict mode already enabled, and Zustand store testing patterns already established. The main work streams are (1) adding Biome and Clippy/rustfmt configuration, (2) raising frontend test coverage to 80% by writing tests for untested stores and utility functions, (3) cleaning up dead code and suppressed-type suppressions in test files, (4) upgrading dependencies including two major bumps (Vite 6→8, TypeScript 5→6), and (5) wiring a GitHub Actions CI workflow.

The largest planning risk is the Vite 8 upgrade. Vite 8 (released 2026-03-12) switches its bundler from Rollup to Rolldown. The key breaking change for this project is `build.rollupOptions` renaming to `build.rolldownOptions` — but the current `vite.config.ts` has no `build.rollupOptions`, so the config impact may be minimal. TypeScript 6.0 (released 2026-03-23) also has breaking changes but the project already meets all its requirements (no ES5 target, no `moduleResolution: classic`, no `esModuleInterop: false`).

Rust crates are already on current versions — `cargo update` will resolve minor/patch bumps within Cargo.toml semver ranges. No major Rust crate updates are required.

**Primary recommendation:** Sequence as: (1) Biome setup + fix violations, (2) Clippy/rustfmt setup + fix violations, (3) Dead code removal (TicketTable), (4) Coverage tooling + write store/utility tests, (5) Dependency upgrades, (6) CI workflow. This order avoids fighting lint errors in code that will be deleted or changed by upgrades.

---

## Standard Stack

### Core (new additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @biomejs/biome | 2.4.8 (pin with -E) | Lint + format (replaces ESLint + Prettier) | Single-tool alternative; 2.4 is current stable with 24 nursery rules promoted |
| @vitest/coverage-v8 | 4.1.1 | Native V8 coverage provider | Matches vitest version; no instrumentation overhead; accurate since vitest 3.2 |
| clippy | bundled with rustup | Rust linting | Built into toolchain; pedantic group already available |
| rustfmt | bundled with rustup | Rust formatting | Built into toolchain; rustfmt.toml for customization |

**Confirmed installed:** `rustup component list --installed` confirms `clippy-x86_64-apple-darwin` and `rustfmt-x86_64-apple-darwin` are present.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-istanbul | 4.1.1 | Istanbul coverage alternative | Only if v8 provider has issues — v8 is preferred |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @biomejs/biome | ESLint + Prettier | Two tools, more config; Biome is locked by D-01 |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul has instrumentation overhead; v8 is faster and equally accurate since vitest 3.2 |

**Installation:**
```bash
npm install -D -E @biomejs/biome
npm install -D @vitest/coverage-v8
npx @biomejs/biome init
```

**Version verification (confirmed 2026-03-24):**
- `@biomejs/biome`: 2.4.8
- `@vitest/coverage-v8`: 4.1.1
- `@vitest/coverage-istanbul`: 4.1.1

---

## Architecture Patterns

### Biome Configuration (biome.json)

Biome 2.x uses `biome.json` at project root. The strict pattern sets all rule groups to `"error"` severity. The `"recommended": true` global flag enables the standard ruleset; individual groups override with `"error"` to ensure no warnings exist.

```jsonc
// Source: https://biomejs.dev/reference/configuration/
{
  "$schema": "https://biomejs.dev/schemas/2.4.8/schema.json",
  "files": {
    "includes": ["src/**", "*.ts", "*.tsx", "*.js", "*.json"],
    "ignore": ["node_modules", "dist", "target", "src-tauri"]
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "recommended": true, "all": false },
      "suspicious": { "recommended": true, "all": false },
      "style": { "recommended": true, "all": false },
      "performance": { "recommended": true, "all": false },
      "security": { "recommended": true, "all": false },
      "a11y": { "recommended": true, "all": false },
      "complexity": { "recommended": true, "all": false }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "trailingNewline": true
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "semicolons": "always",
      "arrowParentheses": "always",
      "trailingCommas": "all"
    },
    "jsxRuntime": "transparent"
  },
  "json": {
    "formatter": { "indentWidth": 2 }
  }
}
```

**Key note:** `jsxRuntime: "transparent"` tells Biome not to flag missing React imports (the project uses `react-jsx` transform). Adjust quote style to match current codebase conventions before enforcing — running `biome format --write` first auto-formats, then Biome check becomes clean.

**npm scripts to add:**
```json
"lint": "biome check src/",
"lint:fix": "biome check --write src/",
"format": "biome format --write src/"
```

### Vitest Coverage Configuration

Coverage configuration belongs in `vitest.config.ts` (already separated from `vite.config.ts` in this project). Add the `coverage` block to the existing `test` section:

```typescript
// Source: https://vitest.dev/guide/coverage + https://vitest.dev/config/#coverage-thresholds
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
  globals: true,
  include: ['src/**/*.test.{ts,tsx}'],
  coverage: {
    provider: 'v8',
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
      'src/test-setup.ts',
      'src/test-utils/**',
      'src/main.tsx',
      '**/*.test.{ts,tsx}',
      '**/__tests__/**',
    ],
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    reporter: ['text', 'lcov'],
  },
},
```

**Threshold behavior:** When `thresholds` is set, `vitest run --coverage` exits non-zero if any threshold is not met. The `npm test` script stays as `vitest run` — add a separate `npm run test:coverage` script: `vitest run --coverage`. This way regular `npm test` stays fast; CI uses `npm run test:coverage`.

**npm scripts to add:**
```json
"test:coverage": "vitest run --coverage"
```

### Rust Clippy and rustfmt Configuration

Clippy pedantic configuration via `Cargo.toml` `[lints]` section (Rust 1.73+, project uses 1.94):

```toml
# Add to src-tauri/Cargo.toml
[lints.clippy]
pedantic = "warn"
# Allow pedantic lints that generate false positives for Tauri projects:
module_name_repetitions = "allow"
must_use_candidate = "allow"
missing_errors_doc = "allow"
missing_panics_doc = "allow"
```

rustfmt configuration via `rustfmt.toml` at `src-tauri/` root:

```toml
edition = "2021"
max_width = 100
use_small_heuristics = "Default"
imports_granularity = "Crate"
group_imports = "StdExternalCrate"
```

**CI commands:**
```bash
cargo clippy -- -D warnings          # treat warnings as errors in CI
cargo fmt --check                    # non-zero exit if formatting needed
cargo test                           # run Rust unit tests
```

### Zustand Store Testing Pattern

The project already has an established pattern in `src/i18n/__tests__/languageStore.test.ts`. Use this pattern for all remaining stores — no `__mocks__/zustand.ts` needed:

```typescript
// Pattern established in languageStore.test.ts — replicate for other stores
import { vi, describe, it, expect, beforeEach } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { useTicketStore } from '../ticketStore';

const mockInvoke = vi.mocked(invoke);

describe('ticketStore', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    // Reset store to initial state using setState
    useTicketStore.setState({ tickets: [], selectedKey: null, loading: false, error: null });
  });

  it('initial state is empty', () => {
    expect(useTicketStore.getState().tickets).toEqual([]);
  });
  // ...
});
```

**Key insight:** `store.setState(initialState)` in `beforeEach` is the correct Zustand + Vitest reset pattern — no mock factory needed because the stores are real modules that expose `setState`.

### GitHub Actions CI Workflow

The CI workflow should run on every push and PR to `main`. It only needs frontend + Rust CI steps — NOT a full Tauri build (no artifact upload, no OS matrix). This keeps CI fast.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test:coverage

  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt
      - uses: swatinem/rust-cache@v2
        with:
          workspaces: '. -> target'
      - name: Install Linux deps (for Tauri compilation)
        run: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
      - run: cargo fmt --check
        working-directory: src-tauri
      - run: cargo clippy -- -D warnings
        working-directory: src-tauri
      - run: cargo test
        working-directory: src-tauri
```

**Note on Rust tests:** The Rust backend currently has zero test files (no `#[cfg(test)]` blocks found). D-06 includes Rust backend coverage. The CI `cargo test` step will succeed with zero tests initially and gain tests incrementally during this phase.

### Dependency Update Strategy

For a personal-use Tauri app, **manual updates** are recommended over Renovate/Dependabot — fewer moving parts, no bot PRs on a solo project. Update once per phase as a batch.

**npm — major version jumps to validate:**

| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| vite | 6.4.1 | 8.0.2 | MEDIUM — Rolldown bundler, rename `rollupOptions` → `rolldownOptions` in config. This project's vite.config.ts has no `build.rollupOptions` so impact is likely minimal. |
| @vitejs/plugin-react | 4.7.0 | 6.0.1 | LOW-MEDIUM — Requires vite ^8; optional babel/compiler peer deps |
| typescript | 5.9.3 | 6.0.2 | LOW — This project is already compatible: uses `moduleResolution: bundler` (not `classic`), no `esModuleInterop: false`, target is ES2020 (not ES5) |
| lucide-react | 1.0.1 | 1.6.0 | LOW — minor version; icon API stable |
| @vitest/ui | 4.1.0 | 4.1.1 | TRIVIAL |
| i18next | 25.10.5 | 25.10.9 | TRIVIAL — patch |
| jsdom | 29.0.0 | 29.0.1 | TRIVIAL — patch |
| react-i18next | 16.6.2 | 16.6.6 | TRIVIAL — patch |
| vitest | 4.1.0 | 4.1.1 | TRIVIAL — patch |

**Vite 8 key breaking change for this project:** `build.rollupOptions` → `build.rolldownOptions` rename. Current `vite.config.ts` has no such key, so the migration may be zero-change. Must verify after upgrade.

**TypeScript 6 key impact for this project:** None expected — project uses `moduleResolution: bundler`, does not set `esModuleInterop: false`, uses ES2020 target. The `skipLibCheck: true` in tsconfig also reduces exposure to type definition changes.

**Rust crates:** All crates are already on current versions per `cargo search`. Running `cargo update` within existing semver ranges should resolve any patch updates. No major Rust crate upgrades are required.

### Anti-Patterns to Avoid

- **Running `biome check` before `biome format --write`:** The formatter will report violations that it can auto-fix. Always run format first, then check for actual lint errors.
- **Setting all Biome rules to `all: true`:** This enables experimental nursery rules prone to false positives. Use `recommended: true` per group.
- **Using `vitest run` for coverage in `npm test`:** Coverage adds ~30s overhead. Keep `npm test` fast with `vitest run` only; use `npm run test:coverage` for CI and threshold enforcement.
- **Trying to test Tauri commands directly in unit tests:** Tauri commands use `tauri::State` injection which cannot be instantiated in unit tests. Test the business logic functions they call (e.g., `TriageDb` methods) rather than the command handlers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JS/TS linting + formatting | Custom ESLint config | `@biomejs/biome` | Single binary, fast, handles both; locked by D-01 |
| Coverage thresholds | Custom threshold script | `vitest --coverage` with `thresholds` config | Built into vitest; non-zero exit on fail |
| Import ordering | Manual sorting | Biome's `organizeImports` (included in `biome check`) | Automatic; consistent |
| Rust lint enforcement | Custom CI script | `cargo clippy -- -D warnings` | Standard Rust community pattern |
| Rust formatting check | Custom diff | `cargo fmt --check` | Built into rustfmt; non-zero exit on unformatted code |

**Key insight:** The entire quality toolchain is already available — this phase is configuration + violation-fixing, not tooling construction.

---

## Common Pitfalls

### Pitfall 1: Biome Conflicts with Existing TypeScript Strict Mode
**What goes wrong:** Biome's `noExplicitAny` rule flags the `as any` usages in test files and `test-setup.ts`. These currently have `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments which Biome does not understand.
**Why it happens:** ESLint disable comments are not Biome suppress comments. Biome uses `// biome-ignore lint/suspicious/noExplicitAny: <reason>` syntax.
**How to avoid:** When fixing D-07, either (a) replace `as any` with proper types, or (b) convert eslint-disable comments to biome-ignore comments where suppression is genuinely needed.
**Warning signs:** `biome check` reports violations on test-setup.ts and IgnoredTicketsPage.test.tsx immediately after setup.

### Pitfall 2: Vite 8 Rolldown Breaking vitest.config.ts
**What goes wrong:** After upgrading to Vite 8, some internal Vite APIs used by vitest could behave differently with Rolldown as the bundler.
**Why it happens:** Vite 8 switches from Rollup to Rolldown for dependency optimization. Vitest 4.1.1 explicitly lists `vite: '^6.0.0 || ^7.0.0 || ^8.0.0'` in peerDependencies — it is compatible — but the test environment uses jsdom separately from the build bundler.
**How to avoid:** Upgrade vite + @vitejs/plugin-react together. Run full test suite after upgrade before declaring done.
**Warning signs:** Tests fail after Vite upgrade with import or transform errors.

### Pitfall 3: Rust Tests Fail in CI Due to Missing Tauri Runtime
**What goes wrong:** Cargo tests that attempt to start a Tauri app or use `tauri::test` context fail in headless CI.
**Why it happens:** Tauri's full runtime requires a display/GUI. The mock-server feature (which this project uses for dev) is compiled out in `--release` mode via feature flag.
**How to avoid:** Write Rust unit tests targeting `TriageDb`, `AuditDb`, and pure logic functions only — not full `tauri::command` handlers. The `mock-server` feature is a compile-time flag, not a test flag.
**Warning signs:** `cargo test` in CI crashes with "no display server" or WebView errors.

### Pitfall 4: Coverage Threshold Blocks CI Before Tests Are Written
**What goes wrong:** Adding 80% coverage threshold before writing the new tests causes `npm run test:coverage` to immediately fail in CI.
**Why it happens:** Threshold is enforced on first run. Current coverage is likely below 80%.
**How to avoid:** Add coverage tooling and thresholds in the same plan wave that adds the tests. Do not commit threshold enforcement before the tests that satisfy it exist. Alternatively, start with a lower threshold (e.g., 60%) and ratchet up to 80% as tests are added.
**Warning signs:** `npm run test:coverage` exits non-zero immediately after adding `thresholds` config.

### Pitfall 5: TypeScript 6 `moduleResolution` Warning
**What goes wrong:** TypeScript 6 emits warnings about `baseUrl` being deprecated without `paths` or `rootDirs`. The current `tsconfig.json` uses `baseUrl: "."` with `paths`.
**Why it happens:** TypeScript 6 is stricter about deprecated config combinations.
**How to avoid:** Verify `tsc --noEmit` produces no errors/warnings after upgrade. The existing config has `paths` which preserves `baseUrl` validity.
**Warning signs:** `tsc` fails or warns after TypeScript 6 upgrade.

---

## Code Examples

### Biome Check Command (CI)
```bash
# Source: https://biomejs.dev/guides/getting-started/
npx @biomejs/biome check --reporter=github src/
# github reporter outputs GitHub-compatible annotations
```

### Vitest Coverage with Threshold Enforcement
```typescript
// Source: https://vitest.dev/guide/coverage
// In vitest.config.ts - thresholds fail the run if not met
coverage: {
  provider: 'v8',
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 75,
    statements: 80,
  },
},
```

### Clippy Pedantic in Cargo.toml (Rust 1.73+)
```toml
# Source: https://doc.rust-lang.org/clippy/configuration.html
[lints.clippy]
pedantic = "warn"
module_name_repetitions = "allow"
must_use_candidate = "allow"
```

### TicketTable Dead Code Removal Checklist
```
Files to delete:
  src/features/tickets/TicketTable.tsx  (marked DEPRECATED in file header)

Files to check for TicketTable imports (may already be removed):
  src/App.tsx
  src/features/tickets/TicketListPage.tsx
```

### Store Reset in Test beforeEach
```typescript
// Pattern from languageStore.test.ts — use for all new store tests
beforeEach(() => {
  mockInvoke.mockReset();
  useTicketStore.setState({ /* initial state shape */ });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint + Prettier | Biome 2.x | 2023 (Biome 1.0) | Single tool, 10-20x faster, no config conflicts |
| Rollup (Vite bundler) | Rolldown (Rust-based) | Vite 8, 2026-03-12 | 10-30x faster builds; `rollupOptions` renamed |
| TypeScript 5.x | TypeScript 6.0 | 2026-03-23 | Temporal API, stricter module resolution |
| `[lints]` in Cargo.toml only available Rust 1.73+ | Standard pattern now | Rust 1.73 (2023) | Per-workspace lint configuration without `.cargo/config.toml` |

**Deprecated/outdated:**
- `build.rollupOptions` in vite.config.ts: renamed to `build.rolldownOptions` in Vite 8 (only matters if field is used — this project does not use it)
- `transformWithEsbuild` in Vite plugins: replaced by `transformWithOxc` in Vite 8 (not used in this project)
- ESLint disable comments (`// eslint-disable-next-line`): not recognized by Biome — must convert to `// biome-ignore` syntax

---

## Open Questions

1. **Actual frontend coverage baseline**
   - What we know: 14 test files, 114 tests covering components and one store
   - What's unclear: Current line coverage percentage (not yet measured with provider)
   - Recommendation: Run `npm run test:coverage` after adding `@vitest/coverage-v8` to establish baseline before writing new tests

2. **`any` usage in production source files**
   - What we know: Grep found zero `any` in non-test source files — the D-07 mention of "~9 files" may refer to test files using `eslint-disable-next-line @typescript-eslint/no-explicit-any`
   - What's unclear: Whether Biome's `noExplicitAny` will flag test file suppressions
   - Recommendation: Run Biome after setup to get the actual violation count; `biome-ignore` annotations are the fix for legitimate suppression in test files

3. **Rust test coverage toolchain**
   - What we know: Zero `#[cfg(test)]` blocks exist in Rust source; `cargo-tarpaulin` or LLVM coverage would be needed for Rust coverage reporting
   - What's unclear: Whether D-06 implies a Rust coverage percentage target or just "add tests"
   - Recommendation: Add Rust unit tests to `triage_db.rs` and `audit.rs` (pure logic, no Tauri runtime needed); skip Rust coverage percentage enforcement in Phase 10 (would require additional tooling)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm scripts, Biome | ✓ | 25.8.1 | — |
| npm | Package installation | ✓ | 11.11.0 | — |
| cargo | Rust build + test | ✓ | 1.94.0 | — |
| rustc | Rust compilation | ✓ | 1.94.0 | — |
| clippy | Rust linting (D-03) | ✓ | bundled 1.94.0 | — |
| rustfmt | Rust formatting (D-03) | ✓ | bundled 1.94.0 | — |
| GitHub Actions | CI pipeline (D-09) | ✓ | N/A (cloud) | — |
| cargo-outdated | Check crate freshness | ✗ | — | Manual `cargo search` per crate |

**Missing dependencies with no fallback:** None — all required tools are present.

**Missing dependencies with fallback:** `cargo-outdated` is not installed. Workaround: check crate versions manually via `cargo search` or crates.io. This is acceptable for a one-time update.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists, root-level) |
| Quick run command | `npm test` (vitest run) |
| Full suite + coverage | `npm run test:coverage` (vitest run --coverage) |

### Phase Requirements → Test Map

This phase adds testing infrastructure and tests. The "requirements" are the decisions themselves:

| Decision | Behavior | Test Type | Automated Command | Notes |
|----------|----------|-----------|-------------------|-------|
| D-01/D-02 | Biome check exits 0 | smoke | `npm run lint` | Lint passes = green |
| D-03 | Clippy + rustfmt exit 0 | smoke | `cargo clippy -- -D warnings && cargo fmt --check` | In src-tauri dir |
| D-04/D-05 | Coverage >= 80% lines | coverage | `npm run test:coverage` | Threshold enforcement |
| D-06 | New store/util/Rust tests exist and pass | unit | `npm test` | Tests added in this phase |
| D-07 | Zero `noExplicitAny` violations | smoke | `npm run lint` | Biome catches it |
| D-08 | TicketTable.tsx deleted, no broken imports | smoke | `npx tsc --noEmit` | Build must succeed |
| D-09 | CI workflow runs green | integration | GitHub Actions push | Manual verification |
| D-10/D-11 | Upgraded deps, tests still pass | regression | `npm test` | All 114+ tests green |

### Sampling Rate

- **Per task commit:** `npm test` (fast, ~5s)
- **Per wave merge:** `npm run test:coverage && cargo clippy -- -D warnings && cargo fmt --check`
- **Phase gate:** All of the above green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `@vitest/coverage-v8` not yet installed — install before adding `coverage` config
- [ ] `@biomejs/biome` not yet installed — install with `-E` (exact version pin) before adding `lint` script
- [ ] `vitest.config.ts` needs `coverage` block added
- [ ] `biome.json` does not yet exist — `npx @biomejs/biome init` generates scaffold
- [ ] `.github/workflows/ci.yml` does not exist — create in this phase
- [ ] `src-tauri/rustfmt.toml` does not exist — create in this phase

---

## Sources

### Primary (HIGH confidence)

- Biome docs: https://biomejs.dev/guides/getting-started/ — installation, init, CI commands
- Biome config reference: https://biomejs.dev/reference/configuration/ — biome.json structure, rule groups
- Vitest coverage guide: https://vitest.dev/guide/coverage — v8 vs istanbul, threshold config
- Tauri GitHub Actions: https://v2.tauri.app/distribute/pipelines/github/ — Linux system deps, rust-toolchain action, Tauri CI pattern
- Clippy docs: https://doc.rust-lang.org/clippy/configuration.html — Cargo.toml `[lints.clippy]` syntax
- Zustand testing: existing `src/i18n/__tests__/languageStore.test.ts` — established project pattern
- npm registry (verified 2026-03-24): all versions in Standard Stack table confirmed current

### Secondary (MEDIUM confidence)

- Vite 8 migration guide: https://vite.dev/guide/migration — breaking changes (Rolldown, config renames)
- TypeScript 6.0 release: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/ — breaking changes assessment
- Vite 8 announcement: https://vite.dev/blog/announcing-vite8 — bundler change context

### Tertiary (LOW confidence)

- WebSearch: Zustand `__mocks__` pattern for Vitest — not needed for this project (confirmed by reading existing store test pattern)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions confirmed from npm registry on research date
- Architecture: HIGH — Biome config from official docs; vitest coverage from official docs; store testing from existing project code
- Pitfalls: MEDIUM-HIGH — Biome/ESLint comment incompatibility is documented; Vite 8 risk is from official migration guide; other pitfalls from project code inspection
- Dependency upgrade risks: MEDIUM — verified peer dep compatibility for all major bumps; runtime behavior requires actual test run to confirm

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (Vite and TypeScript are actively releasing; re-verify if planning takes more than 2 weeks)
