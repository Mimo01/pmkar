# Quick Task 260329-nha: Replace GitHub Actions with local processes - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Task Boundary

Replace GitHub Actions CI and release workflows with local processes (git hooks + release script), modeled after ~/Desktop/Tasker's approach. Goal: zero GitHub Actions runtime.

</domain>

<decisions>
## Implementation Decisions

### CI Checks
- Move ALL checks to local git hooks. Delete ci.yml entirely.
- No CI fallback — hooks are the single source of truth for code quality.

### Release Process
- Create a local `scripts/release.sh` modeled after Tasker's release.sh
- Builds macOS natively (universal-apple-darwin), Linux via Docker, Windows via Docker + cargo-xwin
- Creates GitHub release on Mimo01/pmkar-releases via API
- Uploads artifacts, generates latest.json, updates README
- Delete release.yml entirely

### Hook Timing
- All checks run on pre-commit (lint, fmt, clippy, typecheck, tests)
- No pre-push hook — catch everything at commit time

### Platform Coverage
- macOS: native universal build (aarch64 + x86_64)
- Linux: Docker-based x86_64 build (Ubuntu 22.04)
- Windows: Docker + cargo-xwin cross-compilation (experimental)

### Claude's Discretion
- Credential detection approach (env vars vs keychain, following Tasker pattern)
- inject-version.cjs creation (adapt from Tasker if pmkar doesn't have one)
- Docker image choice for Windows cross-compilation
- latest.json updater manifest generation

</decisions>

<specifics>
## Specific Ideas

- Model release.sh closely after ~/Desktop/Tasker/taskflow/scripts/release.sh phases (A-I)
- Reuse credential auto-detection pattern (env var → macOS Keychain for token, ~/.tauri/pmkar.key for signing key)
- Pre-commit hook already exists at .githooks/pre-commit — extend it with typecheck + tests
- bump-version.mjs already exists at scripts/bump-version.mjs — integrate into release flow
- Tasker's inject-version.cjs pattern for build-time version injection

</specifics>

<canonical_refs>
## Canonical References

- ~/Desktop/Tasker/taskflow/scripts/release.sh — reference implementation for local release
- ~/Desktop/Tasker/taskflow/scripts/bump-version.mjs — reference for version bump + changelog + tag + push
- ~/Desktop/Tasker/taskflow/scripts/inject-version.cjs — reference for build-time version injection

</canonical_refs>
