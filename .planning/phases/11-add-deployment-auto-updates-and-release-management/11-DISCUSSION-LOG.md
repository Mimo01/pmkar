# Phase 11: Add deployment, auto-updates, and release management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 11-add-deployment-auto-updates-and-release-management
**Areas discussed:** Distribution channel, Auto-update behavior, Release workflow, Code signing

---

## Distribution Channel

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Releases | Attach platform binaries to GitHub Releases. Free, integrates with Tauri updater. | |
| Private/internal sharing | Build locally or in CI, share binaries directly. No public hosting. | |
| You decide | Claude picks the most practical approach | |

**User's choice:** GitHub Releases
**Notes:** Private source repo — releases auto-hosted on a separate public GitHub repo so updater can access without auth tokens.

### Repo Access

| Option | Description | Selected |
|--------|-------------|----------|
| Private repo | Only collaborators see releases, updater needs auth | |
| Public repo | Anyone can download releases | |

**User's choice:** Private repo with releases on separate public repo
**Notes:** User specified the dual-repo approach explicitly.

### Platform Binaries

| Option | Description | Selected |
|--------|-------------|----------|
| macOS (.dmg) | Universal binary (Intel + Apple Silicon) | ✓ |
| Windows (.msi) | Standard Windows installer | ✓ |
| Linux (.deb + .AppImage) | .deb for Debian/Ubuntu, .AppImage for universal | ✓ |

**User's choice:** All three platforms selected

### macOS Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Universal binary | Single .dmg for both Intel and Apple Silicon | ✓ |
| Separate builds | Two .dmg files (x64 + aarch64) | |

**User's choice:** Universal binary

---

## Auto-Update Behavior

### Update Check

| Option | Description | Selected |
|--------|-------------|----------|
| Check on app launch | Silent check at startup, non-blocking notification | ✓ |
| Manual check only | User clicks 'Check for updates' in settings | |
| Silent auto-update | Download and install in background | |

**User's choice:** Check on app launch

### Update UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | Non-blocking banner with 'Update now' button | |
| Modal dialog | Blocking dialog with changelog and Update/Later buttons | ✓ |
| You decide | Claude picks based on existing app design | |

**User's choice:** Modal dialog

### Manual Check in Settings

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add to Settings | About/Updates section with version info and check button | ✓ |
| No, launch-only is enough | Only automatic check on startup | |

**User's choice:** Yes, add to Settings

---

## Release Workflow

### Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Git tag push | Push v1.0.0 tag → CI builds + publishes to public repo | ✓ |
| Manual workflow dispatch | Click 'Run workflow' in GitHub Actions | |
| Both | Tag push for normal, manual for hotfixes | |

**User's choice:** Git tag push

### Changelog

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generate from conventional commits | Parse feat/fix/docs commits since last tag | |
| Manual release notes | Write by hand | |
| You decide | Claude picks based on existing convention | ✓ |

**User's choice:** You decide

---

## Code Signing

### Apple (macOS)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, I have a Developer account | Configure notarization in workflow | |
| No, skip for now | Gatekeeper warning, right-click to bypass | ✓ |
| I'll get one before release | Set up workflow structure, add certs later | |

**User's choice:** Skip for now

### Windows

| Option | Description | Selected |
|--------|-------------|----------|
| Skip for now | SmartScreen warning, add signing later | ✓ |
| I have a signing certificate | Configure signtool in workflow | |

**User's choice:** Skip for now

---

## Claude's Discretion

- Changelog generation approach
- Updater manifest format details
- Version bumping mechanism
- Release workflow structure (jobs, caching)

## Deferred Ideas

None
