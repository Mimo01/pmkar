# Phase 11: Add Deployment, Auto-Updates, and Release Management - Research

**Researched:** 2026-03-25
**Domain:** Tauri v2 distribution, tauri-plugin-updater, GitHub Actions multi-platform CI, changelog generation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Publish releases to a separate **public GitHub repo** (not the private source repo) so binaries and the Tauri updater manifest are publicly accessible without auth tokens
- **D-02:** Attach platform binaries to GitHub Releases: macOS `.dmg` (universal binary — Intel + Apple Silicon), Windows `.msi`, Linux `.deb` + `.AppImage`
- **D-03:** Use `tauri-plugin-updater` with the public GitHub repo as the update endpoint
- **D-04:** Check for updates automatically on app launch (silent check, non-blocking)
- **D-05:** When an update is found, show a **modal dialog** with changelog and "Update" / "Later" buttons — blocking to ensure user sees the update
- **D-06:** Add an "About / Updates" section in Settings with current version info and a "Check for updates" button for manual checks
- **D-07:** Releases triggered by **git tag push** (e.g., `v0.1.0.0`) on the private source repo — CI builds all platforms, then publishes to the public releases repo
- **D-08:** Workflow generates the Tauri updater JSON manifest alongside binaries
- **D-09:** Skip Apple notarization for now — macOS users see Gatekeeper "unidentified developer" warning. Workflow structured so notarization can be added later via secrets.
- **D-10:** Skip Windows code signing for now — SmartScreen warning on first run. Add signing cert via secrets later.
- **D-11:** Linux packages do not require code signing

### Claude's Discretion
- Changelog generation approach (auto-generate from conventional commits is recommended given existing commit convention)
- Updater manifest format and hosting details within the public repo
- Exact version bumping mechanism (manual tag vs automated)
- Release workflow structure (single workflow or separate build + publish jobs)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase wires together three distinct concerns: (1) a multi-platform GitHub Actions release workflow that builds Tauri binaries for all target platforms and publishes them to a separate public GitHub repo, (2) integration of `tauri-plugin-updater` for in-app auto-updates with the public repo as the endpoint, and (3) two new UI surfaces — an "About / Updates" settings section and a blocking update modal.

The Tauri toolchain has mature, first-party support for all of this. The `tauri-apps/tauri-action@v0` GitHub Action handles multi-platform builds, artifact upload, and `latest.json` manifest generation in a single step. `tauri-plugin-updater` v2.10.0 is pinned at the same version as the rest of the Tauri 2.10 ecosystem already in use. The primary non-obvious work items are: (a) signing key generation and GitHub secrets configuration (mandatory — updater signatures cannot be disabled), (b) cross-repo PAT setup for publishing from the private source repo to the public releases repo, (c) macOS universal binary build via `--target universal-apple-darwin`, and (d) capabilities file creation (Tauri v2 security model requires explicit permission grants for updater commands).

**Primary recommendation:** Use `tauri-apps/tauri-action@v0` with a tag-triggered workflow matrix (macOS universal, Linux x86_64, Windows x86_64), cross-repo PAT for the public repo, `git-cliff` for changelog generation from conventional commits, and `tauri-plugin-updater` + `tauri-plugin-process` for the in-app update flow.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri-plugin-updater` (Rust) | 2.10.0 | In-app update checking, download, install | First-party Tauri plugin, version-locked to 2.10 ecosystem |
| `@tauri-apps/plugin-updater` (JS) | 2.10.0 | TypeScript bindings for updater plugin | Required companion to Rust plugin |
| `tauri-plugin-process` (Rust) | 2.3.1 | `app.restart()` after update installs | Required for post-install relaunch |
| `@tauri-apps/plugin-process` (JS) | 2.3.1 | TypeScript `relaunch()` binding | Required companion to Rust plugin |
| `tauri-apps/tauri-action@v0` | v0 (latest) | GitHub Actions multi-platform build + release | Official Tauri action; handles artifacts, latest.json, cross-repo publish |
| `git-cliff` | latest | Changelog generation from conventional commits | Rust-native, cliff.toml customizable, CI-friendly |

**Version verification (npm registry, 2026-03-25):**
- `@tauri-apps/plugin-updater`: 2.10.0 (published ~1 month ago)
- `@tauri-apps/plugin-process`: 2.3.1 (published recently)
- Both match the project's existing `@tauri-apps/api: 2.10.1` and `tauri: 2.10` — version alignment is intentional

**Installation:**
```bash
# Frontend
npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process

# Rust (add to src-tauri/Cargo.toml)
# tauri-plugin-updater = "2.10"
# tauri-plugin-process = "2.3"
```

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `actions/checkout@v4` | v4 | Clone repo in CI | All CI jobs |
| `dtolnay/rust-toolchain@stable` | stable | Install Rust in CI | All Rust build jobs |
| `swatinem/rust-cache@v2` | v2 | Cache Rust build artifacts | All Rust build jobs |
| `actions/setup-node@v4` | v4 | Install Node in CI | Frontend build steps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `git-cliff` | `conventional-changelog` npm package | git-cliff is Rust-native (no Node dep), faster, simpler TOML config |
| Single `tauri-action` job | Separate build + upload jobs | tauri-action handles matrix correctly; splitting adds complexity for no gain |
| `universal-apple-darwin` (single DMG) | Separate arm + x86_64 DMGs | Universal doubles file size but D-02 specifies "universal binary" — use this |

---

## Architecture Patterns

### Release Workflow Architecture

The release workflow is a single `release.yml` that triggers on version tags. It uses a build matrix (5 jobs in parallel), then a final step publishes all artifacts to the public releases repo.

```
.github/workflows/
├── ci.yml          # Existing: lint + test (unchanged)
└── release.yml     # New: build + publish on tag push
```

**Key pattern:** `tauri-apps/tauri-action@v0` accepts `owner` and `repo` inputs for cross-repo publishing. The `GITHUB_TOKEN` must be replaced with a PAT (`secrets.RELEASES_REPO_PAT`) that has `contents: write` permission on the public releases repo.

### Pattern 1: Multi-Platform Build Matrix

**What:** Five parallel build jobs, each targeting one platform/arch combination. All upload artifacts to the same GitHub Release on the public repo using a shared release ID.

**When to use:** Required for building platform-native binaries (cannot cross-compile Tauri to other OSes).

```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/
strategy:
  fail-fast: false
  matrix:
    include:
      - platform: macos-latest
        args: '--target universal-apple-darwin'
        rust-targets: 'aarch64-apple-darwin,x86_64-apple-darwin'
      - platform: ubuntu-22.04
        args: ''
      - platform: windows-latest
        args: ''
```

**macOS note:** Use `--target universal-apple-darwin` with both Rust targets installed. This produces a single `.dmg` containing both arm64 and x86_64 binaries. The platform key in `latest.json` will be `darwin-universal` (or individual arch keys — see pitfall below).

### Pattern 2: Cross-Repo Publishing with PAT

**What:** The `tauri-action` `owner`/`repo` inputs redirect artifact uploads to the public releases repo.

**When to use:** D-01 mandates a separate public repo for binary distribution.

```yaml
# Source: tauri-action README + tauri.by.simon.hyll.nu
- uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.RELEASES_REPO_PAT }}
  with:
    owner: your-org
    repo: pmkar-releases
    tagName: v__VERSION__
    releaseName: 'pmkar v__VERSION__'
    releaseBody: ${{ steps.changelog.outputs.content }}
    releaseDraft: false
    args: ${{ matrix.args }}
```

**PAT requirement:** The `GITHUB_TOKEN` env var here must be a PAT with `contents: write` on the PUBLIC repo. The automatic `github.token` only has access to the current (private) repo.

### Pattern 3: Updater Plugin Registration (Rust)

**What:** Plugin registered in `setup()` closure, desktop-only gated with `#[cfg(desktop)]`.

**When to use:** The project's `main.rs` uses `setup()` — register updater plugin there.

```rust
// Source: tauri-plugin-updater README
.setup(|app| {
    #[cfg(desktop)]
    app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
    app.handle().plugin(tauri_plugin_process::init())?;
    // ... existing setup code
    Ok(())
})
```

**IMPORTANT:** The existing `main.rs` does not use `.plugin()` calls — only `invoke_handler`. The updater and process plugins use the new Tauri v2 plugin system and must be registered with `.plugin()` or in `setup()`.

### Pattern 4: Capabilities File (Tauri v2 Security Model)

**What:** Tauri v2 blocks all plugin commands by default. A capabilities JSON file must grant explicit permissions.

**When to use:** Required — without this, `check()` from the frontend will silently fail or throw a permission error.

```json
// src-tauri/capabilities/main.json (new file)
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "updater:default",
    "updater:allow-check",
    "updater:allow-download-and-install",
    "process:default",
    "process:allow-restart"
  ]
}
```

**Note:** The project currently has no `capabilities/` directory. Wave 0 must create it. Without it, all existing commands continue working (they use `invoke_handler`, a separate mechanism), but new plugin commands for updater/process will fail.

### Pattern 5: TypeScript Update Flow

**What:** Silent background check on app launch; blocking modal on update found.

**When to use:** D-04 (silent launch check) + D-05 (blocking modal).

```typescript
// Source: @tauri-apps/plugin-updater official docs
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// On app launch (non-blocking, fire-and-forget)
async function checkForUpdates() {
  try {
    const update = await check();
    if (update) {
      // Populate Zustand store -> triggers blocking modal
      useUpdateStore.getState().setUpdateAvailable(update);
    }
  } catch (e) {
    // Silently ignore on launch check — D-04 specifies non-blocking
    console.warn('Update check failed:', e);
  }
}

// In modal: download + install with progress
async function installUpdate(update: Update) {
  let downloaded = 0;
  let contentLength: number | undefined;
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') contentLength = event.data.contentLength;
    if (event.event === 'Progress') {
      downloaded += event.data.chunkLength;
      const pct = contentLength ? (downloaded / contentLength) * 100 : 0;
      useUpdateStore.getState().setProgress(pct);
    }
  });
  await relaunch();
}
```

### Pattern 6: tauri.conf.json Updater Configuration

**What:** Must add `createUpdaterArtifacts: true` to bundle config and a `plugins.updater` section.

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": ["..."]
  },
  "plugins": {
    "updater": {
      "pubkey": "INSERT_PUBKEY_HERE",
      "endpoints": [
        "https://github.com/YOUR_ORG/pmkar-releases/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**`createUpdaterArtifacts: true`** instructs the bundler to generate:
- Linux: `.AppImage.sig`
- macOS: `.app.tar.gz` + `.app.tar.gz.sig`
- Windows: `.nsis.zip.sig` or `.msi.zip.sig`

### Pattern 7: Signing Key Generation and CI Secrets

**What:** Mandatory — Tauri updater requires signatures. Keys generated locally, private key stored as CI secret, public key embedded in `tauri.conf.json`.

```bash
# Generate keypair (run once, store output securely)
npm run tauri signer generate -- -w ~/.tauri/pmkar.key

# Output:
# Public key: dW50cnVzdGVkIGNvbW1lbnQ6...  <- paste into tauri.conf.json
# Private key saved to: ~/.tauri/pmkar.key
```

**GitHub secrets required:**
| Secret Name | Value |
|------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Content of `~/.tauri/pmkar.key` (the private key file contents) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password set during generation (empty string if none) |
| `RELEASES_REPO_PAT` | Personal Access Token with `contents: write` on public releases repo |

**In workflow:**
```yaml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
  GITHUB_TOKEN: ${{ secrets.RELEASES_REPO_PAT }}
```

### Pattern 8: Changelog Generation with git-cliff

**What:** Auto-generate changelog from conventional commits for the `releaseBody`.

```yaml
# In release workflow, before tauri-action step
- name: Generate changelog
  id: changelog
  uses: orhun/git-cliff-action@v4
  with:
    config: cliff.toml
    args: --latest --strip header
  env:
    OUTPUT: CHANGELOG.md
    GITHUB_REPO: ${{ github.repository }}
```

**cliff.toml** must be added to repo root. Parses `feat:`, `fix:`, `chore:` etc. from existing commit convention.

### Anti-Patterns to Avoid

- **Storing private key as file in repo:** Never commit `~/.tauri/pmkar.key` — it invalidates all future update trust
- **Using `GITHUB_TOKEN` for cross-repo publish:** The auto-issued token only has access to the current repo; will get 403 errors on the public repo
- **Forgetting `createUpdaterArtifacts: true`:** The `.sig` files won't be generated; updater will reject the download
- **Missing capabilities file:** Updater check will fail silently or throw `"Not allowed"` at runtime
- **Version drift:** `package.json`, `tauri.conf.json`, and `src-tauri/Cargo.toml` must all be at the same version before tagging — tauri-action reads `tauri.conf.json`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-platform binary builds | Custom Docker build matrix | `tauri-apps/tauri-action@v0` | Handles Rust toolchain, platform deps, bundler, artifact upload, latest.json in one step |
| Update manifest (latest.json) | Custom JSON generation script | `tauri-apps/tauri-action@v0` with `uploadUpdaterJson: true` (default) | Action generates the correct format with all platform signatures |
| Signature verification | Custom crypto | `tauri-plugin-updater` | Updater signatures are mandatory and cryptographically enforced |
| Changelog from commits | Custom git log parser | `git-cliff` | Parses conventional commits, supports templates, proven in production |
| App restart after update | `process::exit(0)` + relaunch tricks | `@tauri-apps/plugin-process` `relaunch()` | Platform-correct restart behavior, handles update finalization properly |

**Key insight:** The Tauri ecosystem provides purpose-built solutions for every piece of this phase. The risk of hand-rolling is producing update artifacts that fail signature verification or producing a CI matrix that doesn't cover all platform subtleties.

---

## Common Pitfalls

### Pitfall 1: Universal Binary vs Separate Arch DMGs in latest.json
**What goes wrong:** The `latest.json` manifest uses platform keys like `darwin-x86_64` and `darwin-aarch64`. When building `universal-apple-darwin`, the key in the manifest must match what the running app reports as its target — the universal binary reports as the arch it's currently running on. This can cause "no update found" if keys don't match.
**Why it happens:** The tauri-action generates the manifest based on the build target; universal binary is a special case.
**How to avoid:** Use `--target universal-apple-darwin`. The generated manifest will have a `darwin-universal` key (or the action may generate separate keys). Test on both an M-series and Intel Mac before finalizing.
**Warning signs:** macOS users report "already up to date" when an update exists.

### Pitfall 2: Private Key Loss is Irreversible
**What goes wrong:** If `TAURI_SIGNING_PRIVATE_KEY` is lost, all future updates are blocked — existing users cannot receive updates because their installed app has the old public key embedded.
**Why it happens:** The public key is compiled into `tauri.conf.json` and distributed with the binary. It can only be changed by releasing a new version that users can't auto-update to.
**How to avoid:** Store the private key in a password manager AND as a GitHub secret. Document its location in a team wiki.
**Warning signs:** Signing step fails in CI; updater rejects new builds.

### Pitfall 3: Version Mismatch Between package.json / tauri.conf.json / Cargo.toml
**What goes wrong:** tauri-action reads the version from `tauri.conf.json`. If package.json or Cargo.toml are out of sync, builds succeed but artifact naming is inconsistent and `latest.json` contains the wrong version.
**Why it happens:** Three files must be bumped manually before tagging.
**How to avoid:** Use a version bump script (or `npm version` + manual sync) as part of the release checklist. Consider a pre-release hook that validates version consistency.
**Warning signs:** Existing users' apps check against `latest.json` but versions already match even after a real new release.

### Pitfall 4: PAT Permissions for Cross-Repo Publishing
**What goes wrong:** `tauri-action` returns "Resource not accessible by integration" when `GITHUB_TOKEN` is the auto-issued `github.token` and `owner`/`repo` point to a different repository.
**Why it happens:** `github.token` is scoped to the current repository only.
**How to avoid:** Create a PAT (classic or fine-grained) with `contents: write` on the public releases repo. Store as `RELEASES_REPO_PAT`. Use it in the `GITHUB_TOKEN` env var when calling tauri-action.
**Warning signs:** CI passes build steps but fails at the release upload step with a 403.

### Pitfall 5: Missing Capabilities File (Tauri v2 Security Model)
**What goes wrong:** Frontend calls `check()` from `@tauri-apps/plugin-updater` and gets a permissions error or silent failure. The app builds and runs but update checking does nothing.
**Why it happens:** Tauri v2's ACL (Access Control Layer) blocks all plugin commands by default. The project currently has no `capabilities/` directory.
**How to avoid:** Create `src-tauri/capabilities/main.json` with `updater:allow-check`, `updater:allow-download-and-install`, and `process:allow-restart` permissions as Wave 0 task.
**Warning signs:** No error shown (silent) or console shows `IPC message rejected` / `CommandForbidden`.

### Pitfall 6: `createUpdaterArtifacts` Not Set
**What goes wrong:** The updater check succeeds (finds a new version) but download fails because the `.app.tar.gz.sig` / `.nsis.zip.sig` files weren't generated and uploaded.
**Why it happens:** `createUpdaterArtifacts` defaults to `false` in `tauri.conf.json`.
**How to avoid:** Set `"createUpdaterArtifacts": true` in `bundle` config before first release build.
**Warning signs:** Update modal shows but download step immediately fails.

### Pitfall 7: macOS Gatekeeper "App Is Damaged" (Without Notarization)
**What goes wrong:** Without notarization (D-09 defers this), macOS Ventura+ may show "App is damaged and can't be opened" rather than "unidentified developer" for apps downloaded from the internet.
**Why it happens:** Gatekeeper quarantine attribute + missing notarization ticket.
**How to avoid:** Users must right-click > Open to bypass on first launch. Document this clearly in the release notes. The **auto-updater bypasses this** for subsequent updates because it installs via the updater mechanism, not via browser download. The issue only affects the initial `.dmg` install.
**Warning signs:** Support requests about "app is damaged" on macOS.

---

## Code Examples

### Complete tauri.conf.json Changes
```json
// Source: https://v2.tauri.app/plugin/updater/
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "pmkar",
  "version": "0.1.0",
  "identifier": "com.pmkar.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{ "title": "pmkar", "width": 1024, "height": 768 }],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico", "icons/icon.png"]
  },
  "plugins": {
    "updater": {
      "pubkey": "INSERT_GENERATED_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://github.com/YOUR_ORG/pmkar-releases/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### Cargo.toml Additions (platform-gated)
```toml
# Source: tauri-plugin-updater README (desktop-only platform gate)
[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]
tauri-plugin-updater = "2.10"
tauri-plugin-process = "2.3"
```

### main.rs Plugin Registration
```rust
// Source: tauri-plugin-updater README
// Add to existing setup() closure in main.rs
.setup(move |app| {
    #[cfg(desktop)]
    {
        app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
        app.handle().plugin(tauri_plugin_process::init())?;
    }
    // ... existing AuditDb, TriageDb, fixtures setup unchanged
    Ok(())
})
```

### Release Workflow Skeleton (release.yml)
```yaml
# Source: https://v2.tauri.app/distribute/pipelines/github/ + tauri-action README
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish-tauri:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: '--target universal-apple-darwin'
            rust-targets: 'aarch64-apple-darwin,x86_64-apple-darwin'
          - platform: ubuntu-22.04
            args: ''
            rust-targets: ''
          - platform: windows-latest
            args: ''
            rust-targets: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # needed for git-cliff

      - name: Install Linux system dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.rust-targets }}

      - uses: swatinem/rust-cache@v2
        with:
          workspaces: '. -> target'

      - run: npm ci

      - name: Generate changelog (run once, any platform)
        if: matrix.platform == 'ubuntu-22.04'
        id: changelog
        uses: orhun/git-cliff-action@v4
        with:
          config: cliff.toml
          args: --latest --strip header

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.RELEASES_REPO_PAT }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          owner: YOUR_ORG
          repo: pmkar-releases
          tagName: ${{ github.ref_name }}
          releaseName: 'pmkar ${{ github.ref_name }}'
          releaseBody: ${{ steps.changelog.outputs.content || 'See release assets for download.' }}
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}
```

**Note:** The `releaseBody` step output is only available on `ubuntu-22.04` matrix leg. The other legs don't set `releaseBody` and the action merges uploads into the same release. This is expected behavior — tauri-action creates the release on first job and subsequent jobs upload to the same release ID.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri v1 updater (built-in, no plugin) | `tauri-plugin-updater` (separate plugin) | Tauri v2.0 | Must install plugin explicitly; plugin system separates concerns |
| `TAURI_PRIVATE_KEY` / `TAURI_KEY_PASSWORD` env vars | `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Tauri v2 | Old v1 env var names will not work |
| Tauri v1 `tauri.conf.json` updater section at root | `plugins.updater` section in Tauri v2 config | Tauri v2 | Configuration location changed |
| No capabilities system | `src-tauri/capabilities/*.json` required | Tauri v2 | All plugin commands need explicit permission grants |
| `tauri-action` produces per-arch macOS binaries | `universal-apple-darwin` target produces single DMG | Tauri v2 (user choice) | Decision D-02 specifies universal binary |

**Deprecated/outdated:**
- `tauri update` CLI command (v1): replaced by plugin
- Updater `dialog: true` option in tauri.conf.json (v1): custom UI is now the only option in v2 — the built-in dialog was removed
- `TAURI_PRIVATE_KEY` env var name: renamed to `TAURI_SIGNING_PRIVATE_KEY`

---

## Open Questions

1. **Universal binary platform key in latest.json**
   - What we know: `--target universal-apple-darwin` builds a universal binary; tauri-action generates `latest.json`
   - What's unclear: Whether the generated `latest.json` uses `darwin-universal`, `darwin-x86_64`, `darwin-aarch64`, or both arch keys for a universal build
   - Recommendation: Build a test release before wiring up the updater endpoint. Inspect the generated `latest.json` to confirm the key format, then ensure the updater endpoint resolves it correctly. If both arch keys are needed, the manifest will handle routing automatically.

2. **Changelog in multi-leg matrix**
   - What we know: git-cliff runs on one platform leg; the release body is set by that leg; other legs upload artifacts only
   - What's unclear: Whether tauri-action `releaseBody` on a non-first leg overwrites the existing body
   - Recommendation: Set `releaseBody` only on the Ubuntu leg (via `if: matrix.platform == 'ubuntu-22.04'`). Use empty string or omit `releaseBody` on other legs. Alternatively, generate changelog in a separate pre-build job that all legs depend on.

3. **Version bump workflow**
   - What we know: Discretionary (Claude's). Three files must stay synchronized: `package.json`, `tauri.conf.json`, `src-tauri/Cargo.toml`.
   - What's unclear: Manual process vs a helper script
   - Recommendation: Add a `scripts/bump-version.js` Node script that takes a semver argument and updates all three files atomically. Developer runs it, commits, tags, pushes tag.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | ✓ | lts (via CI setup-node) | — |
| Rust stable | Tauri binary build | ✓ | stable (via CI dtolnay) | — |
| npm | Frontend deps | ✓ | bundled with Node | — |
| GitHub Actions macOS runner | macOS build | ✓ | macos-latest | — |
| GitHub Actions ubuntu runner | Linux build | ✓ | ubuntu-22.04 | — |
| GitHub Actions windows runner | Windows build | ✓ | windows-latest | — |
| Personal Access Token (cross-repo) | Release publish | needs setup | — | Cannot publish without it |
| `TAURI_SIGNING_PRIVATE_KEY` | Updater artifacts | needs generation | — | Cannot sign without it |

**Missing dependencies with no fallback:**
- `RELEASES_REPO_PAT`: Must be created and stored in GitHub Secrets before running release workflow
- `TAURI_SIGNING_PRIVATE_KEY`: Must be generated via `npm run tauri signer generate` and stored in GitHub Secrets

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs (TBD per phase description). Behavioral coverage:

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| Update store state transitions (idle/checking/available/error) | Unit | `npm run test -- src/store/update` | New store file |
| About/Updates section renders correct state per store | Unit | `npm run test -- src/features/update` | New feature dir |
| Update modal shows changelog and progress bar | Unit (RTL) | `npm run test -- src/features/update` | shadcn Dialog + Radix mocked |
| "Later" button closes modal | Unit (RTL) | same | Radix mock |
| "Check for updates" button sets checking state | Unit (RTL) | same | Tauri invoke mocked |
| Tauri release workflow builds all platforms | Manual / CI | `git push origin v*` tag | Not automatable in unit tests |
| latest.json contains correct platform keys | Manual (post-release) | inspect downloaded manifest | One-time verification |
| Updater plugin registered correctly | Manual (build test) | `npm run tauri build` | Verifies no compile errors |

### Wave 0 Gaps
- [ ] `src/store/update/updateStore.ts` — new Zustand store for update state
- [ ] `src/store/update/updateStore.test.ts` — unit tests for store transitions
- [ ] `src/features/update/` — new feature directory
- [ ] `src-tauri/capabilities/main.json` — new capabilities file (not a test, but a Wave 0 structural requirement)
- [ ] `cliff.toml` — git-cliff config at repo root

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist in this project — no additional directives.

**Inferred constraints from existing project decisions (STATE.md):**

| Constraint | Source | Implication |
|-----------|--------|-------------|
| Tauri invoke pattern for commands | All phases | Updater uses plugin system (`.plugin()`), not invoke — different registration path |
| Zustand stores for all state | Phase 08 pattern | Update state (checking/available/downloading/progress) belongs in a dedicated Zustand store |
| i18n all strings in en.json + sk.json | Phase 07 | All update UI strings must have keys in both locale files — see UI-SPEC copywriting contract |
| shadcn Dialog for modals | Phase 08 | Update modal must use shadcn Dialog with `onInteractOutside={(e) => e.preventDefault()}` to enforce blocking (D-05) |
| Feature-flag mock-server | Phase 01 | `mock-server` feature is the default — updater must not interfere; disable update check in dev/mock mode |
| No `GITHUB_TOKEN` write perms enabled by default | Phase 10 CI | Current CI uses read-only token; release workflow needs explicit `permissions: contents: write` |

---

## Sources

### Primary (HIGH confidence)
- `https://v2.tauri.app/plugin/updater/` — Official Tauri v2 updater plugin docs (config, manifest format, TypeScript API)
- `https://v2.tauri.app/distribute/pipelines/github/` — Official GitHub Actions workflow for Tauri v2 multi-platform builds
- `https://github.com/tauri-apps/tauri-action` — Official tauri-action README (inputs, cross-repo, matrix)
- `npm view @tauri-apps/plugin-updater` — Verified version 2.10.0 (2026-03-25)
- `npm view @tauri-apps/plugin-process` — Verified version 2.3.1 (2026-03-25)
- `cargo search tauri-plugin-updater` — Verified version 2.10.0 (2026-03-25)

### Secondary (MEDIUM confidence)
- `https://thatgurjot.com/til/tauri-auto-updater/` — Capabilities JSON permission identifiers (verified against official Tauri security model)
- `https://tauri.by.simon.hyll.nu/distributing/github_releases/` — Cross-repo PAT pattern (consistent with tauri-action official README)
- `https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-github-actions-and-release-automation-part-22-2ef7` — Complete secrets list for signing (11 secrets documented; this phase uses only the 2 updater secrets + PAT since D-09/D-10 defer platform code signing)

### Tertiary (LOW confidence)
- `https://github.com/tauri-apps/tauri/discussions/9419` — Universal binary build behavior (community discussion, not official docs)
- `https://github.com/orhun/git-cliff` — git-cliff for changelog generation (widely used but not Tauri-specific)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from npm/cargo registries, official Tauri docs confirm plugin names
- Architecture patterns: HIGH — workflow pattern from official Tauri docs; capabilities pattern from multiple cross-verified sources
- Pitfalls: HIGH for signing/capabilities/version-sync (official docs explicit); MEDIUM for universal binary manifest key format (community discussion, untested)
- Open questions: flagged as LOW confidence per guidance

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (Tauri 2.x patch releases may update plugin versions; check npm before implementing)
