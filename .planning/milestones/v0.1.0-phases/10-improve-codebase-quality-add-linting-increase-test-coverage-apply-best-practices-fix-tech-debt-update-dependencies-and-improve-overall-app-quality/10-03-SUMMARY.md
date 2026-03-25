---
phase: 10-improve-codebase-quality
plan: "03"
subsystem: infra
tags: [vite, typescript, vitest, rust, cargo, dependencies]

requires:
  - phase: 10-01
    provides: Biome linting and TypeScript strict mode baseline established
  - phase: 10-02
    provides: Rust test coverage baseline (9 tests)

provides:
  - Vite 8, TypeScript 6, @vitejs/plugin-react 6 all working in production build
  - All 114 frontend tests passing with latest vitest 4.1.1
  - Rust crates patched to latest within semver ranges via cargo update
  - vite-env.d.ts ambient declaration for Vite client types
  - TypeScript 6 compatibility fixes: allowArbitraryExtensions, ignoreDeprecations, crypto polyfill rewrite

affects: [all phases using frontend build, all phases using Rust build]

tech-stack:
  added: []
  patterns:
    - "vite-env.d.ts provides Vite client types for CSS side-effect imports in TS6"
    - "ignoreDeprecations: '6.0' allows baseUrl to be used during TS5->TS6 migration"
    - "allowArbitraryExtensions: true enables non-TS side-effect imports in TS6"

key-files:
  created:
    - src/vite-env.d.ts
  modified:
    - package.json
    - package-lock.json
    - tsconfig.json
    - src/test-setup.ts
    - Cargo.lock

key-decisions:
  - "Used --legacy-peer-deps for vitest/i18next peer conflict with TS6 (i18next peer expects TS ^5, runtime not affected)"
  - "Added ignoreDeprecations 6.0 + allowArbitraryExtensions to tsconfig instead of removing baseUrl (removing it caused TS2882 and TS2591 errors)"
  - "Rewrote test-setup.ts crypto polyfill to use globalThis.crypto directly instead of require() which is not valid in TS6 ESM context"
  - "Added @testing-library/dom explicitly after vitest upgrade removed it as transitive dependency"

requirements-completed: [D-10, D-11]

duration: 25min
completed: 2026-03-24
---

# Phase 10 Plan 03: Dependency Updates Summary

**Vite 6->8, TypeScript 5->6, plugin-react 4->6 all upgraded with TS6 compatibility fixes; all 114 tests and cargo build pass**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-24T22:06Z
- **Completed:** 2026-03-24T22:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Vite upgraded from 6.4.1 to 8.0.2 (uses rolldown internally, no config changes needed)
- TypeScript upgraded from 5.7.3 to 6.0.2 with three compatibility fixes applied
- @vitejs/plugin-react upgraded from 4.x to 6.0.1
- vitest and @vitest/ui upgraded from 4.1.0 to 4.1.1
- All 114 frontend tests passing after resolving @testing-library/dom peer dep gap
- Rust crates patched via cargo update (rustls-webpki, serde_spanned, tao, tinyvec, toml_*, unicode-segmentation)
- cargo build, cargo test (9 tests), cargo clippy all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Update npm dependencies (major + minor + patch)** - `98eb3a0` (feat)
2. **Task 2: Update Rust crates and verify build** - `2c4bbcb` (chore)

## Files Created/Modified
- `package.json` - Upgraded vite, typescript, @vitejs/plugin-react, vitest, and other packages
- `package-lock.json` - Updated lock file with new dependency tree
- `tsconfig.json` - Added ignoreDeprecations, allowArbitraryExtensions for TS6 compatibility
- `src/vite-env.d.ts` - New file: Vite client ambient declarations (fixes TS2882 CSS import error)
- `src/test-setup.ts` - Replaced `require('node:crypto')` with `globalThis.crypto` (fixes TS2591 in TS6 ESM)
- `Cargo.lock` - Updated Rust lock file with patch-level crate bumps

## Decisions Made
- Used `--legacy-peer-deps` for vitest and testing-library installs due to i18next peer conflict with TypeScript ^5 (i18next only uses TypeScript for dev/type generation, runtime not affected)
- Chose `ignoreDeprecations: "6.0"` over removing `baseUrl` — removing baseUrl caused cascade of new TS6 errors in main.tsx and test-setup.ts
- Added explicit `@testing-library/dom` dependency since vitest upgrade removed it as a transitive dep from @testing-library/react

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript 6 side-effect CSS import error (TS2882)**
- **Found during:** Task 1 (TypeScript 6 upgrade)
- **Issue:** TypeScript 6 introduced TS2882 requiring explicit type declarations for side-effect imports of non-TS files (e.g., `import './index.css'`)
- **Fix:** Created `src/vite-env.d.ts` with `/// <reference types="vite/client" />` which provides ambient CSS module declarations; added `allowArbitraryExtensions: true` to tsconfig
- **Files modified:** src/vite-env.d.ts (created), tsconfig.json
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 98eb3a0 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript 6 require() error in test-setup.ts (TS2591)**
- **Found during:** Task 1 (TypeScript 6 upgrade)
- **Issue:** TypeScript 6 in ESM module context no longer implicitly includes `require` — the old crypto polyfill used `require('node:crypto')`
- **Fix:** Replaced with `globalThis.crypto` (available in Node 19+/jsdom 16+) which is already available without any require/import
- **Files modified:** src/test-setup.ts
- **Verification:** All 114 tests pass with new polyfill
- **Committed in:** 98eb3a0 (Task 1 commit)

**3. [Rule 3 - Blocking] Explicitly installed missing @testing-library/dom**
- **Found during:** Task 1 (vitest upgrade)
- **Issue:** After upgrading vitest to 4.1.1, 12 out of 14 test files failed with "Cannot find module '@testing-library/dom'" — vitest upgrade changed the dependency tree and removed the transitive dep
- **Fix:** `npm install -D @testing-library/dom@latest --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Verification:** All 114 tests pass
- **Committed in:** 98eb3a0 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 TS6 breaking change bugs, 1 blocking missing dep)
**Impact on plan:** All fixes were direct consequences of the planned major version upgrades. No scope creep.

## Issues Encountered
- i18next has a peerOptional dependency on `typescript@"^5"` which conflicts with TypeScript 6. Resolved with `--legacy-peer-deps` since i18next only uses TypeScript for type generation, not runtime.

## Known Stubs
None.

## Next Phase Readiness
- All dependency upgrades complete — build, test, and lint pipelines healthy
- Vite 8 (rolldown) is slightly slower in plugin-timings for @tailwindcss/vite but overall build is faster
- TypeScript 6 deprecation of `baseUrl` is tracked — full migration (removing baseUrl) deferred to a future plan as it requires fixing cascade of other TS6 issues

---
*Phase: 10-improve-codebase-quality*
*Completed: 2026-03-24*

## Self-Check: PASSED

All files verified present, all task commits confirmed in git log.
