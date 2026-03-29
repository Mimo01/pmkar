---
phase: quick-260329-nha
plan: 01
subsystem: ci-cd
tags: [git-hooks, release, tauri, local-ci, github-actions-removal]
dependency_graph:
  requires: [scripts/bump-version.mjs]
  provides: [scripts/release.sh, scripts/inject-version.cjs, .githooks/pre-commit]
  affects: [release-workflow, code-quality-gates]
tech_stack:
  added: [inject-version.cjs (version injection), release.sh (local release lifecycle)]
  patterns: [pre-commit-as-ci, local-release-script, credential-auto-detect]
key_files:
  created:
    - scripts/release.sh
    - scripts/inject-version.cjs
  modified:
    - .githooks/pre-commit
  deleted:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
decisions:
  - pre-commit hook is single source of truth for code quality (no CI fallback)
  - release.sh handles commit+tag explicitly since bump-version.mjs does not
  - Windows build is experimental placeholder (Docker + cargo-xwin not yet available)
  - Signing key path ~/.tauri/pmkar.key (not taskflow.key)
metrics:
  duration: 8min
  completed_date: "2026-03-29"
  tasks: 2
  files_changed: 5
---

# Quick Task 260329-nha: Replace GitHub Actions with Local Processes — Summary

**One-liner:** Pre-commit hook now runs all 6 CI checks (fmt, lint, tsc, clippy, tests) with timing; release.sh implements phases A-I for macOS universal builds + GitHub release creation on Mimo01/pmkar-releases; both GitHub Actions workflows deleted.

## Tasks Completed

### Task 1: Enhance pre-commit hook and delete CI workflow

**Commit:** `5490b20`

Rewrote `.githooks/pre-commit` to run all 6 quality checks in fail-fast order, replacing `ci.yml` entirely:

1. `cargo fmt --check` — Rust formatting
2. `npm run lint` — Biome lint + format
3. `npx tsc --noEmit` — TypeScript typecheck (was missing)
4. `cargo clippy -- -D warnings` — Rust linter
5. `npm run test` — Vitest frontend tests (was missing)
6. `cd src-tauri && cargo test` — Rust unit tests (was missing)

Per-step timing printed (using `date +%s` before/after each check) plus total elapsed time. Added header comment documenting that this replaces ci.yml and is the single source of truth.

Deleted `.github/workflows/ci.yml`.

### Task 2: Create release.sh and inject-version.cjs, delete release workflow

**Commit:** `a4d6b34`

Created `scripts/release.sh` (Tasker's release.sh adapted for pmkar):

- **Phase A:** semver validation, uncommitted changes check, credential auto-detect (env var → macOS Keychain for token; env var → `~/.tauri/pmkar.key` for signing key)
- **Phase B:** `node scripts/bump-version.mjs $VERSION` → `git add -A && git commit --no-verify` → annotated tag via `npx git-cliff`
- **Phase C:** macOS universal build (`npx tauri build --target universal-apple-darwin`); Linux Docker build (graceful skip if Docker absent); Windows placeholder (skipped — experimental)
- **Phase D:** POST to `https://api.github.com/repos/Mimo01/pmkar-releases/releases` with python3 JSON escaping
- **Phase E:** `upload_asset()` helper uploads macOS dmg + .app.tar.gz + .sig; Linux artifacts if built
- **Phase F:** Python3 inline generates `latest.json` Tauri updater manifest with darwin-universal/darwin-x86_64/darwin-aarch64 platforms; uploads to release assets
- **Phase G:** Updates README.md in pmkar-releases via GitHub Contents API (base64-encoded, SHA-aware PUT)
- **Phase H:** `git push origin main && git push origin "v$VERSION"`
- **Phase I:** Summary with release URL, artifact list, platforms not built

Created `scripts/inject-version.cjs` (adapted from Tasker's):
- Reads version from `git describe --tags --match "v[0-9]*" --abbrev=0`, fallback `0.0.0-dev`
- Writes version into `src-tauri/tauri.conf.json`, `package.json`, `src-tauri/Cargo.toml`
- Outputs `APP_VERSION`, `APP_COMMIT_SHA`, `APP_BUILD_DATE` for `eval` consumption

Deleted `.github/workflows/release.yml`. The `.github/workflows/` directory no longer exists.

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `--no-verify` on version bump commit in Phase B | Code was already validated; hook would re-run all tests on a formatting-only commit |
| `#!/usr/bin/env bash` on release.sh (not `#!/bin/sh`) | Needs bash-specific features (associative arrays, `[[ ]]`, `set -euo pipefail`); pre-commit hook uses `#!/bin/sh` as specified |
| `REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"` | pmkar is at repo root — no extra parent traversal needed (unlike Tasker which has taskflow/ subdirectory) |
| `git checkout -- src-tauri/Cargo.lock` included in restore | Per research pitfall 2: cargo build updates Cargo.lock, would leave dirty state after build |

## Known Stubs

None — no placeholder data or TODO stubs in the created files.

## Self-Check: PASSED

Files exist:
- `scripts/release.sh` — FOUND, executable
- `scripts/inject-version.cjs` — FOUND
- `.githooks/pre-commit` — FOUND, contains tsc/npm test/cargo test

Files deleted:
- `.github/workflows/ci.yml` — CONFIRMED ABSENT
- `.github/workflows/release.yml` — CONFIRMED ABSENT
- `.github/workflows/` directory — CONFIRMED ABSENT

Commits exist:
- `5490b20` — FOUND (pre-commit hook + ci.yml deletion)
- `a4d6b34` — FOUND (release.sh + inject-version.cjs + release.yml deletion)
