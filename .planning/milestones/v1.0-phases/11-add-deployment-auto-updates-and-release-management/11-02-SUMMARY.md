---
phase: 11-add-deployment-auto-updates-and-release-management
plan: 02
subsystem: infra
tags: [github-actions, tauri, tauri-action, git-cliff, release-workflow, semver, cicd]

# Dependency graph
requires:
  - phase: 10-improve-codebase-quality-add-linting-increase-test-coverage-apply-best-practices-fix-tech-debt-update-dependencies-and-improve-overall-app-quality
    provides: CI workflow pattern (.github/workflows/ci.yml) that release.yml mirrors for Node/Rust toolchain setup
provides:
  - Tag-triggered multi-platform release workflow (.github/workflows/release.yml)
  - git-cliff changelog config (cliff.toml) for conventional commit parsing
  - Version bump script (scripts/bump-version.mjs) for 3-file version sync
affects:
  - phase 11-03 (updater plugin integration — depends on release workflow generating latest.json)
  - phase 11-04 (update UI — depends on updater infrastructure from 11-03)

# Tech tracking
tech-stack:
  added:
    - tauri-apps/tauri-action@v0 (GitHub Action for multi-platform Tauri builds)
    - orhun/git-cliff-action@v4 (changelog generation from conventional commits)
    - softprops/action-gh-release@v2 (GitHub Release creation with cross-repo PAT)
    - git-cliff (cliff.toml config at repo root)
  patterns:
    - Two-job release pattern: create-release job generates changelog + creates GitHub Release; build-tauri matrix jobs upload artifacts
    - Cross-repo PAT pattern: RELEASES_REPO_PAT replaces github.token for publishing to public releases repo
    - Version sync script: ESM Node script with JSON parse/stringify for JSON files and regex for TOML

key-files:
  created:
    - .github/workflows/release.yml
    - cliff.toml
    - scripts/bump-version.mjs
  modified: []

key-decisions:
  - "Two-job structure (create-release + build-tauri matrix): changelog generated once in create-release, passed to build jobs via outputs — avoids race condition if each build leg tried to create/update the release"
  - "orhun/git-cliff-action@v4 in create-release job (not per-platform): changelog only needs to run once on ubuntu; other platforms upload artifacts only"
  - "scripts/bump-version.mjs uses JSON.parse/JSON.stringify for .json files (preserves field order, 2-space indent) and regex for Cargo.toml [package] section only"

patterns-established:
  - "Release pattern: git tag v1.0.0 -> push tag -> release.yml builds all platforms -> publishes to AurelianSpowormo/pmkar-releases"
  - "Version sync: always run node scripts/bump-version.mjs <version> before tagging to keep package.json + tauri.conf.json + Cargo.toml in sync"
  - "Conventional commits map to cliff.toml groups: feat->Features, fix->Bug Fixes, refactor->Refactoring, etc."

requirements-completed: [D-01, D-02, D-07, D-08]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 11 Plan 02: Release Workflow and Version Tooling Summary

**Tag-triggered GitHub Actions release workflow publishing macOS universal, Windows, and Linux Tauri binaries to a public releases repo, with git-cliff changelog generation and a 3-file version sync script.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-25T07:02:57Z
- **Completed:** 2026-03-25T07:04:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `.github/workflows/release.yml` with a two-job structure: `create-release` (changelog + GitHub Release) + `build-tauri` matrix (macOS universal, Ubuntu, Windows) — all publishing to `AurelianSpowormo/pmkar-releases` via cross-repo PAT
- Created `cliff.toml` with conventional commit parsers for all commit types in use (feat, fix, refactor, perf, test, docs, chore, ci)
- Created `scripts/bump-version.mjs` that atomically updates `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` to the same semver version, preventing the version mismatch pitfall

## Task Commits

1. **Task 1: Create release workflow and changelog config** - `70609d4` (feat)
2. **Task 2: Create version bump script** - `b8dbb96` (feat)

## Files Created/Modified

- `.github/workflows/release.yml` — Tag-triggered release workflow; `create-release` job + 3-platform `build-tauri` matrix
- `cliff.toml` — git-cliff config at repo root; parses conventional commits into grouped changelog sections
- `scripts/bump-version.mjs` — Node ESM script; validates semver, updates 3 files, prints git tag instructions

## Decisions Made

- **Two-job structure vs single matrix job:** Changelog must run once. If git-cliff ran per platform, the first job would create the release with changelog body; subsequent jobs would potentially overwrite it with empty body. Separating into `create-release` (runs once on ubuntu) + `build-tauri` (matrix, uploads artifacts) eliminates this race.
- **`softprops/action-gh-release@v2` for release creation, `tauri-apps/tauri-action@v0` for artifact upload:** The tauri-action can both create and upload, but having a dedicated release creation step makes the changelog output (`needs.create-release.outputs.changelog`) available to the matrix jobs cleanly.
- **Changelog body via `needs.create-release.outputs.changelog`:** Passed to each `build-tauri` matrix job via job outputs so the release body is set by the artifact-uploading step (not a separate update).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before the first release, the following GitHub Secrets must be configured on the **private source repo**:

| Secret | Source |
|--------|--------|
| `RELEASES_REPO_PAT` | GitHub Settings -> Developer settings -> Personal access tokens -> `contents: write` on `AurelianSpowormo/pmkar-releases` |
| `TAURI_SIGNING_PRIVATE_KEY` | Run `npx tauri signer generate -w ~/.tauri/pmkar.key` locally; paste file contents |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password set during key generation (can be empty string) |

Also required before first release:
- Create the public releases repo: GitHub -> New repository -> `pmkar-releases`, visibility: public
- Add the generated public key to `tauri.conf.json` under `plugins.updater.pubkey` (Plan 11-01 task)

## Known Stubs

None — this plan creates workflow infrastructure only, no UI or data rendering involved.

## Next Phase Readiness

- Release workflow is complete and ready to fire on `git tag v*` once GitHub Secrets are configured
- `cliff.toml` will parse all existing conventional commits in the repository
- Version bump script ready for use: `node scripts/bump-version.mjs 1.0.0`
- Plan 11-03 can proceed to integrate `tauri-plugin-updater` — it depends on the release workflow generating `latest.json` (which `tauri-action` does automatically with `createUpdaterArtifacts: true` in tauri.conf.json)

---
*Phase: 11-add-deployment-auto-updates-and-release-management*
*Completed: 2026-03-25*
