# Phase 11: Add deployment, auto-updates, and release management - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build, distribute, and auto-update the Tauri desktop app across macOS, Windows, and Linux. Includes: GitHub Actions release workflow, Tauri updater plugin integration, update UI in the app, and platform-specific packaging. Does not include app store submissions, paid code signing certificates, or new application features.

</domain>

<decisions>
## Implementation Decisions

### Distribution Channel
- **D-01:** Publish releases to a separate **public GitHub repo** (not the private source repo) so binaries and the Tauri updater manifest are publicly accessible without auth tokens
- **D-02:** Attach platform binaries to GitHub Releases: macOS `.dmg` (universal binary — Intel + Apple Silicon), Windows `.msi`, Linux `.deb` + `.AppImage`

### Auto-Update Behavior
- **D-03:** Use `tauri-plugin-updater` with the public GitHub repo as the update endpoint
- **D-04:** Check for updates automatically on app launch (silent check, non-blocking)
- **D-05:** When an update is found, show a **modal dialog** with changelog and "Update" / "Later" buttons — blocking to ensure user sees the update
- **D-06:** Add an "About / Updates" section in Settings with current version info and a "Check for updates" button for manual checks

### Release Workflow
- **D-07:** Releases triggered by **git tag push** (e.g., `v1.0.0`) on the private source repo — CI builds all platforms, then publishes to the public releases repo
- **D-08:** Workflow generates the Tauri updater JSON manifest alongside binaries

### Code Signing
- **D-09:** Skip Apple notarization for now — macOS users will see Gatekeeper "unidentified developer" warning (right-click > Open to bypass). Workflow should be structured so notarization can be added later via GitHub secrets.
- **D-10:** Skip Windows code signing for now — SmartScreen warning on first run. Same approach: add signing cert via secrets later.
- **D-11:** Linux packages do not require code signing

### Claude's Discretion
- Changelog generation approach (auto-generate from conventional commits is recommended given existing commit convention)
- Updater manifest format and hosting details within the public repo
- Exact version bumping mechanism (manual tag vs automated)
- Release workflow structure (single workflow or separate build + publish jobs)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tauri Configuration
- `src-tauri/tauri.conf.json` — Current bundle config, app identifier, version
- `src-tauri/Cargo.toml` — Rust dependencies, current Tauri version (2.10), feature flags

### Existing CI
- `.github/workflows/ci.yml` — Current CI workflow (lint/test only, no builds) — release workflow extends this

### Project Config
- `package.json` — Frontend version, build scripts, Tauri CLI version
- `.planning/PROJECT.md` — Cross-platform constraint (macOS, Windows, Linux)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ci.yml` GitHub Actions workflow — can be extended or used as reference for release workflow structure
- Settings page with sidebar nav — "About / Updates" section slots in naturally
- i18n infrastructure — update dialog strings need English + Slovak translations
- Modal dialog pattern (shadcn Dialog + Radix) — reuse for update dialog

### Established Patterns
- Tauri 2.x plugin system — `tauri-plugin-updater` follows the same pattern as existing plugins
- Zustand stores — update state (checking, available, downloading, installing) fits the existing store pattern
- `@tauri-apps/api` v2 for frontend Tauri commands

### Integration Points
- `src-tauri/tauri.conf.json` — needs updater plugin config and endpoints
- `src-tauri/Cargo.toml` — needs `tauri-plugin-updater` dependency
- Settings page — new "About / Updates" section
- App startup — update check hook
- `src-tauri/src/lib.rs` — plugin registration

</code_context>

<specifics>
## Specific Ideas

- Private source repo with releases on a separate public GitHub repo — keeps source private while allowing the Tauri updater to access the public GitHub Releases API without authentication
- Modal dialog for update notification (not a toast) — user confirmed they want the blocking dialog pattern to ensure visibility

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-add-deployment-auto-updates-and-release-management*
*Context gathered: 2026-03-25*
