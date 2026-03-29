---
phase: quick-260329-nha
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .githooks/pre-commit
  - scripts/release.sh
  - scripts/inject-version.cjs
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
autonomous: true
requirements: [NHA-01, NHA-02, NHA-03]

must_haves:
  truths:
    - "Pre-commit hook runs all quality checks (lint, fmt, clippy, typecheck, tests) and blocks on failure"
    - "release.sh builds macOS universal binary, creates GitHub release on Mimo01/pmkar-releases, uploads artifacts + latest.json"
    - "No GitHub Actions workflows exist — ci.yml and release.yml are deleted"
  artifacts:
    - path: ".githooks/pre-commit"
      provides: "Complete pre-commit hook replacing CI"
      contains: "tsc --noEmit"
    - path: "scripts/release.sh"
      provides: "Full local release script (phases A-I)"
      contains: "Mimo01/pmkar-releases"
    - path: "scripts/inject-version.cjs"
      provides: "Build-time version + env var injection"
      contains: "APP_VERSION"
  key_links:
    - from: "scripts/release.sh"
      to: "scripts/bump-version.mjs"
      via: "node scripts/bump-version.mjs call in Phase B"
      pattern: "node scripts/bump-version\\.mjs"
    - from: "scripts/release.sh"
      to: "scripts/inject-version.cjs"
      via: "eval $(node scripts/inject-version.cjs) in Phase C"
      pattern: "inject-version\\.cjs"
    - from: "scripts/release.sh"
      to: "Mimo01/pmkar-releases"
      via: "GitHub API for release creation + artifact upload"
      pattern: "Mimo01/pmkar-releases"
---

<objective>
Replace GitHub Actions CI and release workflows with local processes: an enhanced pre-commit hook for all quality checks, and a release.sh script (modeled after Tasker's) for building + publishing releases.

Purpose: Eliminate CI runtime costs; all quality gates run locally before commit, all releases built on developer machine.
Output: Enhanced pre-commit hook, release.sh, inject-version.cjs; deleted ci.yml and release.yml.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260329-nha-replace-github-actions-with-local-proces/260329-nha-CONTEXT.md
@.planning/quick/260329-nha-replace-github-actions-with-local-proces/260329-nha-RESEARCH.md

Reference implementations (read during planning, key details inlined below):
- ~/Desktop/Tasker/taskflow/scripts/release.sh — phases A-I release lifecycle
- ~/Desktop/Tasker/taskflow/scripts/inject-version.cjs — version injection

<interfaces>
<!-- Existing pmkar scripts/bump-version.mjs behavior -->
<!-- IMPORTANT: Unlike Tasker's, pmkar's bump-version.mjs does NOT commit/tag/push -->
<!-- It only updates: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, CHANGELOG.md -->
<!-- release.sh must handle commit + tag + push itself -->

From scripts/bump-version.mjs:
- Input: node scripts/bump-version.mjs <X.Y.Z>
- Updates: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml versions
- Regenerates: CHANGELOG.md via git-cliff
- Does NOT: commit, tag, or push

Tauri conf (src-tauri/tauri.conf.json):
- productName: "pmkar"
- version: "0.2.4"
- createUpdaterArtifacts: true (generates .sig files)

Artifact naming (Tauri 2 with productName "pmkar"):
- macOS: pmkar_${VERSION}_universal.dmg, pmkar.app.tar.gz, pmkar.app.tar.gz.sig
- Linux: pmkar_${VERSION}_amd64.AppImage, pmkar_${VERSION}_amd64.AppImage.tar.gz, pmkar_${VERSION}_amd64.AppImage.tar.gz.sig, pmkar_${VERSION}_amd64.deb
- Windows: pmkar_${VERSION}_x64-setup.exe, pmkar_${VERSION}_x64-setup.nsis.zip, etc.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enhance pre-commit hook and delete CI workflow</name>
  <files>.githooks/pre-commit, .github/workflows/ci.yml</files>
  <action>
Rewrite `.githooks/pre-commit` to run ALL quality checks that ci.yml currently runs, in fail-fast order (cheapest first). Delete `.github/workflows/ci.yml`.

The enhanced pre-commit hook must run these checks in order:
1. `cargo fmt --check` (~1s, fastest formatting check)
2. `npm run lint` (~2s, Biome lint)
3. `npx tsc --noEmit` (~5-10s, TypeScript typecheck — MISSING from current hook)
4. `cargo clippy -- -D warnings` (~15-30s cached)
5. `npm run test` (~10-20s, vitest — 389 tests — MISSING from current hook)
6. `cargo test` run from `src-tauri/` directory (~5-15s cached — MISSING from current hook)

Implementation details:
- Use `#!/bin/sh` (not bash — git hooks should be POSIX)
- Each step: run command, check exit code, print failure message with fix suggestion, exit 1
- Print timing for each step (use shell `date +%s` before/after each check, print elapsed)
- Print total elapsed time at the end
- Add a header comment documenting that this replaces ci.yml (per user decision: hooks are single source of truth)
- For `cargo test`, use `cd src-tauri && cargo test` since Cargo workspace is at root but tests are in src-tauri
- Keep existing check order pattern but add the three missing checks after the existing ones

Delete `.github/workflows/ci.yml` — per locked decision, no CI fallback.
  </action>
  <verify>
    <automated>test -f .githooks/pre-commit && grep -q "tsc --noEmit" .githooks/pre-commit && grep -q "npm run test" .githooks/pre-commit && grep -q "cargo test" .githooks/pre-commit && ! test -f .github/workflows/ci.yml && echo "PASS"</automated>
  </verify>
  <done>Pre-commit hook runs all 6 checks (fmt, lint, typecheck, clippy, frontend tests, rust tests). ci.yml deleted.</done>
</task>

<task type="auto">
  <name>Task 2: Create release.sh and inject-version.cjs, delete release workflow</name>
  <files>scripts/release.sh, scripts/inject-version.cjs, .github/workflows/release.yml</files>
  <action>
Create `scripts/release.sh` modeled after Tasker's release.sh (~/Desktop/Tasker/taskflow/scripts/release.sh) with pmkar-specific adaptations. Create `scripts/inject-version.cjs` adapted from Tasker's. Delete `.github/workflows/release.yml`.

**scripts/release.sh** — Full local release lifecycle, phases A-I:

Phase A (Pre-flight):
- Validate semver format (bare X.Y.Z, no v prefix)
- Check for uncommitted changes: `git diff-index --quiet HEAD --`
- Auto-detect RELEASES_REPO_TOKEN: 1) env var, 2) macOS Keychain via `git credential-osxkeychain`
- Auto-detect TAURI_SIGNING_PRIVATE_KEY: 1) env var, 2) `~/.tauri/pmkar.key` file (NOT taskflow.key)
- Export TAURI_SIGNING_PRIVATE_KEY_PASSWORD (default empty string)
- Set AUTH_HEADER and RELEASES_API="https://api.github.com/repos/Mimo01/pmkar-releases"

Phase B (Version bump):
- Call `node scripts/bump-version.mjs $VERSION`
- CRITICAL: pmkar's bump-version.mjs does NOT commit/tag/push (unlike Tasker's)
- After bump: `git add -A && git commit --no-verify -m "chore: bump version to $VERSION"`
- Generate tag body: `npx git-cliff --config cliff.toml --latest --strip header`
- Create annotated tag: `git tag -a "v$VERSION" -m "Release v$VERSION" -m "$TAG_BODY"`
- Note: --no-verify on commit to skip pre-commit hook during release (the code was already checked)

Phase C (Local builds):
- macOS native universal build:
  - `cd` to repo root (pmkar is at root, not a subdirectory like Tasker)
  - `eval "$(node scripts/inject-version.cjs)"` for env vars
  - `npm run build` (Vite frontend build)
  - `npx tauri build --target universal-apple-darwin`
  - Restore injected files: `git checkout -- src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml src-tauri/Cargo.lock`
  - Verify artifacts exist: dmg, .app.tar.gz, .app.tar.gz.sig
  - MACOS_BUNDLE_DIR="src-tauri/target/universal-apple-darwin/release/bundle"
- Linux Docker build (graceful skip if Docker not available):
  - Same pattern as Tasker but with pmkar paths (repo root, not taskflow/ subdirectory)
  - Docker image: ubuntu:22.04 with webkit2gtk, node, rust installed inside
  - Mount repo root as /workspace, workdir /workspace
  - Verify AppImage.tar.gz, AppImage.tar.gz.sig, deb artifacts
- Windows Docker+cargo-xwin (experimental, graceful skip if Docker not available):
  - Include as a placeholder section with skip message: "Windows cross-compilation is experimental. Skipping."
  - Do NOT implement the actual Docker build yet — just the skip logic

Phase D (Create GitHub release):
- Extract tag annotation body from the tag just created
- POST to Mimo01/pmkar-releases releases API
- Use python3 for JSON escaping (same pattern as Tasker)
- Release name: "pmkar v$VERSION"

Phase E (Upload artifacts):
- upload_asset() helper function (same as Tasker)
- Upload macOS: dmg, .app.tar.gz, .app.tar.gz.sig
- Upload Linux (if built): AppImage.tar.gz, AppImage.tar.gz.sig, deb

Phase F (Generate latest.json):
- Python3 inline script generating Tauri updater manifest
- Platforms: darwin-universal, darwin-x86_64, darwin-aarch64 (all point to same macOS bundle)
- Linux platform: linux-x86_64 (if built)
- Upload latest.json to release assets

Phase G (Update README):
- Same pattern as Tasker: read current SHA via Contents API, PUT updated README
- Download links for macOS (dmg), Linux (AppImage.tar.gz, deb) if built
- Note Windows not available

Phase H (Push):
- `git push origin main`
- `git push origin "v$VERSION"`

Phase I (Summary):
- Print release URL, artifacts uploaded, platforms not built

Key differences from Tasker to get right:
1. SCRIPT_DIR and REPO_ROOT: pmkar is at repo root, so `REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"` — no extra parent traversal
2. All paths relative to REPO_ROOT (no taskflow/ subdirectory)
3. Commit + tag done in Phase B (Tasker's bump-version handles this, pmkar's doesn't)
4. Artifact names use lowercase "pmkar" (not "Taskflow" with capital T)
5. Key file: ~/.tauri/pmkar.key (not taskflow.key)
6. git checkout restores root-level files (not taskflow/ prefixed)

**scripts/inject-version.cjs** — Adapted from Tasker's inject-version.cjs:
- Read version from `git describe --tags --match "v[0-9]*" --abbrev=0`, fallback "0.0.0-dev"
- Write version to src-tauri/tauri.conf.json, package.json, src-tauri/Cargo.toml (same as Tasker's)
- Output env vars to stdout: APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE
- Paths are relative to __dirname (scripts/ dir), so ../src-tauri/tauri.conf.json etc.

Delete `.github/workflows/release.yml` — per locked decision.

Make release.sh executable: `chmod +x scripts/release.sh`
  </action>
  <verify>
    <automated>test -x scripts/release.sh && test -f scripts/inject-version.cjs && grep -q "Mimo01/pmkar-releases" scripts/release.sh && grep -q "pmkar.key" scripts/release.sh && grep -q "bump-version.mjs" scripts/release.sh && grep -q "inject-version.cjs" scripts/release.sh && grep -q "APP_VERSION" scripts/inject-version.cjs && ! test -f .github/workflows/release.yml && echo "PASS"</automated>
  </verify>
  <done>release.sh implements phases A-I with pmkar-specific paths and credential detection. inject-version.cjs exports version env vars. release.yml deleted. No GitHub Actions workflows remain.</done>
</task>

</tasks>

<verification>
- `.githooks/pre-commit` contains all 6 checks: fmt, lint, typecheck, clippy, npm test, cargo test
- `scripts/release.sh` is executable and contains all 9 phases (A-I)
- `scripts/release.sh` references Mimo01/pmkar-releases (not taskflow-releases)
- `scripts/release.sh` references ~/.tauri/pmkar.key (not taskflow.key)
- `scripts/release.sh` handles commit + tag in Phase B (compensating for bump-version.mjs not doing it)
- `scripts/inject-version.cjs` reads git tag and outputs APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE
- `.github/workflows/ci.yml` does not exist
- `.github/workflows/release.yml` does not exist
- `ls .github/workflows/` returns empty or directory does not exist
</verification>

<success_criteria>
- All CI checks moved to pre-commit hook (6 checks, fail-fast order)
- release.sh is a working local release script with credential auto-detection
- inject-version.cjs provides build-time version injection
- Both GitHub Actions workflows deleted
- Zero GitHub Actions runtime for this project going forward
</success_criteria>

<output>
After completion, create `.planning/quick/260329-nha-replace-github-actions-with-local-proces/260329-nha-SUMMARY.md`
</output>
