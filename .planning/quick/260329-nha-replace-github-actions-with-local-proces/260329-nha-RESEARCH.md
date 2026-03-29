# Quick Task 260329-nha: Replace GitHub Actions with Local Processes - Research

**Researched:** 2026-03-29
**Domain:** CI/CD migration, cross-platform Tauri builds, git hooks
**Confidence:** HIGH (macOS/Linux), LOW (Windows cross-compile)

## Summary

Pmkar currently has two GitHub Actions workflows: ci.yml (lint, fmt, clippy, typecheck, tests) and release.yml (build + publish to Mimo01/pmkar-releases). The goal is to replace both with local processes: an enhanced pre-commit hook for CI and a release.sh script modeled after Tasker's.

Tasker's release.sh is an excellent reference and can be adapted almost directly. The key differences: pmkar is at repo root (not a subdirectory), pmkar's bump-version.mjs does NOT commit/tag/push (Tasker's does), and pmkar needs its own signing key file (~/.tauri/pmkar.key).

**Primary recommendation:** Adapt Tasker's release.sh phases A-I with pmkar-specific paths. Extend existing pre-commit hook to add typecheck and tests. Create inject-version.cjs adapted from Tasker. Mark Windows cross-compilation as experimental/future since Docker is not currently installed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Move ALL checks to local git hooks. Delete ci.yml entirely.
- No CI fallback -- hooks are the single source of truth for code quality.
- Create a local scripts/release.sh modeled after Tasker's release.sh
- Builds macOS natively (universal-apple-darwin), Linux via Docker, Windows via Docker + cargo-xwin
- Creates GitHub release on Mimo01/pmkar-releases via API
- Uploads artifacts, generates latest.json, updates README
- Delete release.yml entirely
- All checks run on pre-commit (lint, fmt, clippy, typecheck, tests)
- No pre-push hook -- catch everything at commit time

### Claude's Discretion
- Credential detection approach (env vars vs keychain, following Tasker pattern)
- inject-version.cjs creation (adapt from Tasker if pmkar doesn't have one)
- Docker image choice for Windows cross-compilation
- latest.json updater manifest generation
</user_constraints>

## Key Findings

### 1. Pre-commit Hook: Current vs Required

**Current hook** (.githooks/pre-commit) runs: biome lint, cargo fmt --check, cargo clippy.
**Missing:** TypeScript typecheck (`npx tsc --noEmit`), frontend tests (`npm run test`), Rust tests (`cargo test`).

**Performance concern:** Running all checks on every commit will be slow. Approximate times:
- biome lint: ~2s
- cargo fmt --check: ~1s
- cargo clippy: ~15-30s (cached), ~60s+ (cold)
- tsc --noEmit: ~5-10s
- npm run test (vitest): ~10-20s (389 tests)
- cargo test: ~5-15s (44 tests, cached)

Total: ~40-80s per commit (cached). This is acceptable since the user explicitly chose pre-commit over pre-push.

**Recommendation:** Run checks in this order (fail-fast, cheapest first):
1. cargo fmt --check (fastest, catches formatting)
2. biome lint (fast)
3. tsc --noEmit (medium)
4. cargo clippy -- -D warnings (medium-slow)
5. npm run test (medium)
6. cargo test (medium, working-directory: src-tauri)

### 2. Release.sh Adaptation from Tasker

Tasker's release.sh has phases A-I. Pmkar adaptation notes:

| Phase | Tasker | Pmkar Adaptation |
|-------|--------|-----------------|
| A: Pre-flight | Checks uncommitted, auto-detects token + key | Same pattern; key path: ~/.tauri/pmkar.key (not taskflow.key) |
| B: Version bump | Calls bump-version.mjs (which commits+tags+pushes) | **Different:** pmkar's bump-version.mjs only updates files + changelog. Release.sh must handle commit+tag itself. |
| C: Local builds | macOS native + Linux Docker | Same. Windows Docker+cargo-xwin is new. |
| D: Create release | API to Mimo01/taskflow-releases | Change to Mimo01/pmkar-releases |
| E: Upload artifacts | curl uploads | Same pattern, different artifact names (pmkar vs Taskflow) |
| F: latest.json | Python script generates updater manifest | Same pattern, adapt names |
| G: Update README | Contents API | Same pattern |
| H: Push | Push main + tag | Same, but must also do the commit+tag that Tasker's bump-version.mjs handles |
| I: Summary | Print results | Same |

**Critical difference:** Pmkar's bump-version.mjs only writes files and regenerates CHANGELOG.md. It does NOT commit, tag, or push. The release.sh must:
1. Call `node scripts/bump-version.mjs $VERSION`
2. `git add -A && git commit -m "chore: bump version to $VERSION"`
3. Generate tag body with git-cliff
4. `git tag -a v$VERSION` with annotation
5. Push after builds complete (Phase H)

### 3. inject-version.cjs -- Needed for Pmkar

Pmkar does NOT have an inject-version.cjs. Tasker's inject-version.cjs:
- Reads version from git tag
- Writes it into tauri.conf.json, package.json, Cargo.toml
- Outputs env vars (APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE)

**Purpose in release flow:** During build (Phase C), inject-version.cjs ensures the built binary reflects the tagged version. After build, `git checkout` restores the files to avoid dirty state.

Pmkar needs this because:
- bump-version.mjs updates files permanently (for the commit)
- But the build happens AFTER commit, so files already have correct version
- However, inject-version.cjs also sets env vars consumed by `eval $(node scripts/inject-version.cjs)`

**Recommendation:** Create a simpler inject-version.cjs for pmkar. Since bump-version.mjs already sets the version in all three files before the commit, inject-version.cjs only needs to output the env vars (APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE) for potential use in the build step. The file writing is already handled.

Actually, looking more carefully at Tasker's flow: inject-version.cjs is called INSIDE the Docker container too (line 159 of release.sh). In Docker, git tags may not be available, so inject-version.cjs reads from git describe. Since pmkar's bump-version.mjs already wrote the correct version to the files BEFORE the Docker build, and Docker mounts the repo, the files will already have the right version. So inject-version.cjs may not be strictly necessary -- but creating it for consistency and env var export is low cost.

### 4. Windows Cross-Compilation via cargo-xwin

**Status: Experimental, Docker not installed.**

Docker is NOT currently available on this machine (`command not found: docker`). This means:
- Linux builds will be skipped (same as Tasker's graceful fallback)
- Windows builds via Docker+cargo-xwin are not possible until Docker is installed

**Technical approach (for when Docker is available):**
- cargo-xwin cross-compiles Rust to `x86_64-pc-windows-msvc` using LLVM and Windows SDK headers
- Tauri supports `--runner cargo-xwin --target x86_64-pc-windows-msvc`
- Install cargo-xwin inside Docker: `cargo install --locked cargo-xwin`
- Docker image: Ubuntu 22.04 (same as Linux build, add cargo-xwin + LLVM)

**Known pitfalls:**
- WebView2 bootstrapper is bundled by the NSIS/WiX installer, not compiled -- cross-compile only handles the Rust binary
- Tauri's NSIS installer generation may not work from Linux/macOS Docker (needs verification)
- cargo-xwin downloads Windows SDK (~1GB first time); set XWIN_CACHE_DIR to persist across builds

**Recommendation:** Include Windows build phase in release.sh with same graceful skip pattern as Linux (if Docker not available, warn and skip). Mark as experimental in the script header.

### 5. Tauri-Specific Release Considerations

**Signing:** Tauri updater requires signed artifacts. Key stored at ~/.tauri/pmkar.key (needs to be created -- currently only taskflow.key exists).

**Updater manifest (latest.json):** Endpoint configured in tauri.conf.json points to `https://github.com/Mimo01/pmkar-releases/releases/latest/download/latest.json`. The release.sh must generate and upload this file with platform-specific signatures and URLs.

**Artifact naming:** Tauri 2 produces (from tauri.conf.json productName "pmkar"):
- macOS: `pmkar_${VERSION}_universal.dmg`, `pmkar.app.tar.gz`, `pmkar.app.tar.gz.sig`
- Linux: `pmkar_${VERSION}_amd64.AppImage`, `pmkar_${VERSION}_amd64.deb`, etc.
- Windows: `pmkar_${VERSION}_x64-setup.exe`, `pmkar_${VERSION}_x64-setup.nsis.zip`, etc.

**createUpdaterArtifacts: true** in tauri.conf.json means Tauri automatically generates .sig files alongside the update bundles.

### 6. Credential Auto-Detection Pattern

Follow Tasker's pattern exactly:
1. `RELEASES_REPO_TOKEN`: env var first, then macOS Keychain via `git credential-osxkeychain`
2. `TAURI_SIGNING_PRIVATE_KEY`: env var first, then `~/.tauri/pmkar.key` file
3. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: env var (empty string default)

**Action needed:** Generate pmkar signing keypair: `npx tauri signer generate -w ~/.tauri/pmkar.key`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build, scripts | Yes | v25.8.2 | -- |
| Cargo/Rust | Backend build | Yes | 1.94.0 | -- |
| git-cliff | Changelog generation | Yes | 2.12.0 | -- |
| Docker | Linux/Windows builds | No | -- | Skip with warning |
| cargo-xwin | Windows cross-compile | No | -- | Skip with warning |
| macOS universal targets | macOS build | Yes | Both installed | -- |
| Tauri CLI | Build command | Yes | via npx | -- |
| python3 | JSON manipulation in release.sh | Yes (macOS built-in) | -- | -- |

**Missing dependencies with no fallback:** None (all missing deps have graceful skip).

**Missing dependencies with fallback:**
- Docker: Linux and Windows builds skip with warning message, macOS build proceeds.

## Common Pitfalls

### Pitfall 1: bump-version.mjs Does Not Commit
**What goes wrong:** Assuming bump-version.mjs handles git operations like Tasker's version.
**Why it happens:** Pmkar's script only updates files + CHANGELOG. Tasker's also commits, tags, pushes.
**How to avoid:** Release.sh must handle commit + tag + push explicitly after calling bump-version.mjs.

### Pitfall 2: Cargo.lock Dirty After Build
**What goes wrong:** `cargo build` updates Cargo.lock, leaving dirty state after inject-version or build.
**Why it happens:** Building with updated version in Cargo.toml regenerates Cargo.lock.
**How to avoid:** After build, `git checkout -- src-tauri/Cargo.lock` (or include Cargo.lock in the version bump commit).

### Pitfall 3: Pre-commit Hook Bypass
**What goes wrong:** Users (or automation) commit with `--no-verify`, bypassing all checks.
**Why it happens:** No CI fallback means zero safety net.
**How to avoid:** Accept this as a conscious tradeoff. Document that `--no-verify` skips all quality checks. Consider adding a disclaimer in the hook output.

### Pitfall 4: Signing Key Not Generated
**What goes wrong:** Release.sh fails because ~/.tauri/pmkar.key does not exist.
**Why it happens:** Only taskflow.key exists currently.
**How to avoid:** First task must generate the pmkar signing keypair before first release.

## Integration Points

### Files to Create
- `scripts/release.sh` -- main release script (adapt from Tasker)
- `scripts/inject-version.cjs` -- version injection for builds (adapt from Tasker)

### Files to Modify
- `.githooks/pre-commit` -- add typecheck, frontend tests, Rust tests
- `scripts/bump-version.mjs` -- no changes needed (release.sh wraps it)

### Files to Delete
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

## Sources

### Primary (HIGH confidence)
- Tasker release.sh at ~/Desktop/Tasker/taskflow/scripts/release.sh -- direct reference implementation
- Tasker inject-version.cjs and bump-version.mjs -- direct reference
- Existing pmkar workflows and hook -- current state analysis

### Secondary (MEDIUM confidence)
- [Tauri v2 Windows Installer docs](https://v2.tauri.app/distribute/windows-installer/) -- cross-compile support
- [Tauri cross-compilation discussion #11256](https://github.com/tauri-apps/tauri/discussions/11256) -- cargo-xwin usage
- [Tauri cross-compilation discussion #9650](https://github.com/tauri-apps/tauri/discussions/9650) -- macOS to Windows feasibility

### Tertiary (LOW confidence)
- Windows cross-compilation via Docker+cargo-xwin for Tauri 2 -- limited real-world reports, NSIS installer generation from non-Windows unclear
