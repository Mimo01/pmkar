---
phase: 11-add-deployment-auto-updates-and-release-management
verified: 2026-03-25T09:15:00Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "Launch the app with `npm run tauri dev` and navigate to Settings -> About"
    expected: "Sidebar shows an 'About' group after the Appearance group; clicking it shows current version (0.1.0), 'Last checked: Never', and a 'Check for updates' button"
    why_human: "Visual layout, contrast, and sidebar group rendering require eyes-on verification"
  - test: "Click 'Check for updates' in the About section"
    expected: "Brief loading spinner appears, then either an error (expected in dev — no published releases) or 'You're on the latest version'. The UI does not freeze or blank out."
    why_human: "Tauri plugin interaction and silent error-swallowing require runtime behavior verification"
  - test: "Toggle to dark mode (Theme section), then return to About"
    expected: "Version label, last-checked text, and button have sufficient contrast in dark theme; badge and icon colors are correct"
    why_human: "Dark mode contrast requires visual inspection"
  - test: "Switch to Slovak in the Language section, then return to About"
    expected: "All strings in the About section appear in Slovak with full diacritics (e.g., 'Skontrolovať aktualizácie', 'Nikdy')"
    why_human: "i18n rendering and diacritics correctness requires visual inspection"
  - test: "Review `.github/workflows/release.yml` and confirm the three matrix platforms"
    expected: "macOS universal (`--target universal-apple-darwin`), `ubuntu-22.04`, and `windows-latest` are all present; `tauri-apps/tauri-action@v0` is the artifact-upload step"
    why_human: "Workflow correctness cannot be run without triggering CI; structure review is manual"
  - test: "Test the version bump script: `node scripts/bump-version.mjs 0.2.0` then `node scripts/bump-version.mjs 0.1.0`"
    expected: "First run updates all three files and prints 'Done. Run: git add ...' instructions. Second run restores 0.1.0. No file corruption."
    why_human: "File mutation on real project files should be confirmed by the user before first release"
---

# Phase 11: Add Deployment, Auto-Updates, and Release Management — Verification Report

**Phase Goal:** Cross-platform binary distribution with auto-update — tag-triggered CI builds macOS universal, Windows, and Linux binaries, publishes to a public releases repo, and the app checks for updates on launch with a blocking modal for user notification
**Verified:** 2026-03-25T09:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | tauri-plugin-updater and tauri-plugin-process Rust crates are declared as dependencies | VERIFIED | `src-tauri/Cargo.toml` line 41-42: under `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` |
| 2 | Frontend @tauri-apps/plugin-updater and @tauri-apps/plugin-process npm packages are installed | VERIFIED | `package.json` lines 27-28: both packages present with exact versions |
| 3 | Updater and process plugins are registered in the Tauri setup closure | VERIFIED | `src-tauri/src/main.rs` lines 13-18: `#[cfg(desktop)]` block calls `tauri_plugin_updater::Builder::new().build()` and `tauri_plugin_process::init()` |
| 4 | Capabilities file grants updater and process permissions to the main window | VERIFIED | `src-tauri/capabilities/main.json` has all 6 permissions including `updater:allow-check`, `updater:allow-download-and-install`, `process:allow-restart` |
| 5 | tauri.conf.json has createUpdaterArtifacts: true and plugins.updater section with placeholder pubkey | VERIFIED | Lines 27 and 37-44: `createUpdaterArtifacts: true` and `plugins.updater` with endpoint and placeholder pubkey |
| 6 | A git tag push triggers a multi-platform build that produces macOS universal, Windows, and Linux binaries | VERIFIED | `.github/workflows/release.yml` triggers on `push: tags: [v*]`; matrix includes `macos-latest` with `--target universal-apple-darwin`, `ubuntu-22.04`, `windows-latest` |
| 7 | Built binaries and updater manifest are published to the public releases repo | VERIFIED | `tauri-apps/tauri-action@v0` uses `owner: AurelianSpowormo, repo: pmkar-releases` with `RELEASES_REPO_PAT`; `createUpdaterArtifacts: true` generates `latest.json` |
| 8 | Changelog is auto-generated from conventional commits | VERIFIED | `cliff.toml` has `conventional_commits = true` with parsers for feat, fix, refactor, perf, test, docs, chore, ci; used via `orhun/git-cliff-action@v4` in the create-release job |
| 9 | A version bump script keeps package.json, tauri.conf.json, and Cargo.toml in sync | VERIFIED | `scripts/bump-version.mjs` reads and writes all 3 files; validated semver input; prints git tag instructions |
| 10 | App checks for updates silently on launch without blocking the UI | VERIFIED | `useUpdateCheck` hook uses `useRef(hasChecked)` to prevent double-run; errors are swallowed silently per D-04; called at top of `App.tsx` before routing |
| 11 | When an update is available, a blocking modal appears with changelog and Update/Later buttons | VERIFIED | `UpdateModal.tsx` uses `onInteractOutside={(e) => e.preventDefault()}`; `onEscapeKeyDown` prevented during active states; rendered in all 5 App.tsx routing branches |
| 12 | Settings page has an About section showing current version and a manual Check for updates button | VERIFIED | `SettingsPage.tsx` has `'about'` in `ActiveSection` union, About group in sidebar nav, `case 'about'` in `renderContent()` rendering `<AboutSection />`; version from `getVersion()` |
| 13 | All update UI strings are translated in both English and Slovak | VERIFIED | `en.json` and `sk.json` each contain 20 update keys (3 settings.*, 7 about.*, 10 update.modal.*); Slovak uses full diacritics |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/capabilities/main.json` | Tauri v2 ACL permissions for updater and process plugins | VERIFIED | Exists, contains `updater:allow-check`, all 6 required permissions |
| `src-tauri/Cargo.toml` | Rust plugin dependencies | VERIFIED | `tauri-plugin-updater = "2.10"` and `tauri-plugin-process = "2.3"` under desktop cfg gate |
| `src-tauri/tauri.conf.json` | Updater configuration with endpoint and pubkey placeholder | VERIFIED | `createUpdaterArtifacts: true`, `plugins.updater` section with endpoint and placeholder |
| `.github/workflows/release.yml` | Tag-triggered multi-platform release workflow | VERIFIED | All 3 matrix platforms, correct Actions, cross-repo PAT |
| `cliff.toml` | git-cliff configuration for changelog generation | VERIFIED | `[changelog]` section, `conventional_commits = true`, 8 commit type parsers |
| `scripts/bump-version.mjs` | Version synchronization script for 3 files | VERIFIED | Updates package.json, tauri.conf.json, Cargo.toml; validates semver; exits 1 on error |
| `src/features/update/updateStore.ts` | Zustand store for update state machine | VERIFIED | Exports `useUpdateStore`; 7-state union type; 9 transition actions |
| `src/features/update/AboutSection.tsx` | About/Updates settings section component | VERIFIED | Exports `AboutSection`; renders version, lastChecked, check button with all status states |
| `src/features/update/UpdateModal.tsx` | Blocking update dialog with progress | VERIFIED | Exports `UpdateModal`; `onInteractOutside` blocks; progress bar; changelog scrollarea |
| `src/features/update/useUpdateCheck.ts` | Hook for silent launch check | VERIFIED | Exports `useUpdateCheck`; `useRef` prevents double-run; errors silently swallowed |
| `src/features/update/__tests__/updateStore.test.ts` | Store unit tests | VERIFIED | 27 tests covering all 9 state transitions |
| `src/features/update/__tests__/AboutSection.test.tsx` | Component tests | VERIFIED | 5 tests covering render, button click, status states |
| `src/features/update/__tests__/UpdateModal.test.tsx` | Component tests | VERIFIED | 6 tests covering open state, changelog, buttons, progress, null body |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src-tauri/src/main.rs` | `tauri_plugin_updater` | `#[cfg(desktop)]` plugin registration | WIRED | Line 16: `tauri_plugin_updater::Builder::new().build()` |
| `src-tauri/capabilities/main.json` | `src-tauri/tauri.conf.json` | Permissions grant matching plugin config | WIRED | `updater:allow-check` in capabilities matches `plugins.updater` in conf |
| `.github/workflows/release.yml` | `tauri-apps/tauri-action@v0` | GitHub Action step | WIRED | Line 83: `uses: tauri-apps/tauri-action@v0` |
| `.github/workflows/release.yml` | `secrets.RELEASES_REPO_PAT` | `env GITHUB_TOKEN` | WIRED | Lines 38 and 85: PAT used for both release creation and artifact upload |
| `scripts/bump-version.mjs` | `package.json, tauri.conf.json, src-tauri/Cargo.toml` | `fs` read/write | WIRED | All 3 files updated via explicit path resolution |
| `src/features/update/useUpdateCheck.ts` | `@tauri-apps/plugin-updater` | `import { check }` | WIRED | Line 1: `import { check } from '@tauri-apps/plugin-updater'`; called in `doCheck()` |
| `src/features/update/UpdateModal.tsx` | `src/features/update/updateStore.ts` | Zustand store subscription | WIRED | Lines 32-35: subscribes to `status`, `updateInfo`, `progress`, `errorMessage` |
| `src/features/connections/SettingsPage.tsx` | `src/features/update/AboutSection.tsx` | Nav item + section render | WIRED | Line 11 import; line 539-543 `case 'about'`; line 615 `NavItem section="about"` |
| `src/App.tsx` | `src/features/update/useUpdateCheck.ts` | Hook call in App component | WIRED | Line 35: `useUpdateCheck()` called before routing |
| `src/App.tsx` | `src/features/update/UpdateModal.tsx` | Conditional render on all routing branches | WIRED | Lines 114, 131, 147, 158, 186: `<UpdateModal open={showUpdateModal} />` in all 5 branches |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `AboutSection.tsx` | `appVersion` | `@tauri-apps/api/app getVersion()` — reads from Tauri bundle manifest | Yes — Tauri returns actual bundle version from `tauri.conf.json` | FLOWING |
| `AboutSection.tsx` | `status`, `lastCheckedAt` | `useUpdateStore` — populated by `check()` from `@tauri-apps/plugin-updater` | Yes — updater plugin queries remote endpoint | FLOWING |
| `UpdateModal.tsx` | `updateInfo`, `progress` | `useUpdateStore` — `rawUpdate.downloadAndInstall()` fires progress events | Yes — download events feed real byte counts | FLOWING |
| `useUpdateCheck.ts` | update object | `@tauri-apps/plugin-updater check()` — queries `plugins.updater.endpoints` | Yes — reads `latest.json` from releases repo endpoint | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| bump-version script: no-arg usage message | `node scripts/bump-version.mjs` | Printed: `Usage: node scripts/bump-version.mjs <new-version>` | PASS |
| bump-version script: invalid version exits non-zero | `node scripts/bump-version.mjs abc` | Printed error and exits 1 | PASS |
| Update store tests: all 38 pass | `npx vitest run src/features/update/` | 3 test files, 38 tests — all passed in 2.98s | PASS |
| i18n key count: en.json | `grep -c "about\.\|update\.modal\."` | 20 keys (3 settings.*, 7 about.*, 10 update.modal.*) | PASS |
| i18n key count: sk.json | `grep -c "about\.\|update\.modal\."` | 20 matching keys with full Slovak diacritics | PASS |
| Workflow matrix completeness | File read | All 3 platforms present: `macos-latest`, `ubuntu-22.04`, `windows-latest` | PASS |

### Requirements Coverage

D-xx identifiers are phase-specific locked decisions defined in `11-CONTEXT.md`, not entries in `.planning/REQUIREMENTS.md`. This is consistent with the pattern established in Phase 10 where REQUIREMENTS.md tracks user-facing feature requirements only; deployment architecture decisions are internal to their phase. All D-01 through D-11 requirements are cross-referenced below against their source definitions.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| D-01 | 11-02 | Publish releases to separate public GitHub repo | SATISFIED | `release.yml`: `owner: AurelianSpowormo, repo: pmkar-releases`; updater endpoint points to same repo |
| D-02 | 11-02 | macOS universal `.dmg`, Windows `.msi`, Linux `.deb` + `.AppImage` | SATISFIED | Workflow matrix: `macos-latest` with `--target universal-apple-darwin`, `ubuntu-22.04`, `windows-latest`; `tauri-action` produces all bundle types |
| D-03 | 11-01 | Use `tauri-plugin-updater` as auto-update mechanism | SATISFIED | Cargo.toml dependency + npm package + plugin registration in `main.rs` |
| D-04 | 11-03 | Silent non-blocking update check on launch | SATISFIED | `useUpdateCheck` hook: errors swallowed silently, `useRef` prevents double-run, no blocking call |
| D-05 | 11-03 | Blocking modal with changelog and Update/Later buttons when update found | SATISFIED | `UpdateModal.tsx`: `onInteractOutside={(e) => e.preventDefault()}`, escape blocked during download/install, both buttons present |
| D-06 | 11-03 | About/Updates section in Settings with version and manual check button | SATISFIED | `SettingsPage.tsx` has `'about'` section; `AboutSection.tsx` shows version, lastChecked, check button |
| D-07 | 11-02 | Releases triggered by git tag push | SATISFIED | `release.yml` trigger: `push: tags: ['v*']` |
| D-08 | 11-02 | Workflow generates Tauri updater JSON manifest alongside binaries | SATISFIED | `createUpdaterArtifacts: true` in `tauri.conf.json`; `tauri-action@v0` produces `latest.json` automatically |
| D-09 | 11-01 | Skip Apple notarization — structured to add later via secrets | SATISFIED | No notarization steps in workflow; signing only via `TAURI_SIGNING_PRIVATE_KEY` for updater (not Apple) |
| D-10 | 11-01 | Skip Windows code signing — structured to add later via secrets | SATISFIED | No Windows signing steps; comment in plan explicitly notes "add later via secrets" |
| D-11 | 11-01 | Linux packages do not require code signing | SATISFIED | No signing steps for Linux in workflow; Linux builds run as bare `tauri-action` |

**Orphaned requirements check:** REQUIREMENTS.md traceability table does not map any entries to Phase 11. D-01 through D-11 are defined exclusively in `11-CONTEXT.md` as locked implementation decisions — this is correct and intentional per the project's requirement architecture.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src-tauri/tauri.conf.json` | 39 | `"pubkey": "PLACEHOLDER_GENERATE_WITH_tauri_signer_generate"` | Info | Intentional placeholder per Plan 02 `user_setup` section — user must run `npx tauri signer generate` before first release. Does not affect app functionality until release artifacts are generated. |

No blockers or warnings. The placeholder pubkey is the only flagged pattern and it is intentional by design.

### Human Verification Required

#### 1. About Section Visual Appearance

**Test:** Run `npm run tauri dev`, navigate to Settings (gear icon), click "About" in the sidebar.
**Expected:** Sidebar shows an "About" group after the Appearance group. The section renders the current version (0.1.0), a "Last checked: Never" label, and a "Check for updates" button with correct sizing and spacing.
**Why human:** Visual layout, font sizing, group separator rendering, and contrast require eyes-on review.

#### 2. Update Check Runtime Behavior

**Test:** Click "Check for updates" in the About section.
**Expected:** A brief loading spinner appears inside the button (aria-busy state), then either a soft error message ("Could not check for updates...") since no published releases exist in dev, or "You're on the latest version". The rest of the app remains fully interactive during the check.
**Why human:** Tauri plugin invocation, silent error handling, and non-blocking behavior require runtime execution to verify.

#### 3. Dark Mode Contrast

**Test:** Switch to dark mode via the Theme section, then navigate back to About.
**Expected:** Version label, last-checked text, error messages (if shown), and the check button all have sufficient contrast against the dark background. Badge and icon colors are distinguishable.
**Why human:** Contrast ratios and visual readability require manual inspection.

#### 4. Slovak i18n Rendering

**Test:** Switch to Slovak via the Language section, then navigate to About.
**Expected:** All About section strings appear in Slovak with full diacritics — e.g., "Skontrolovať aktualizácie", "Nikdy", "Verzia". Update modal title shows "Dostupná aktualizácia" when simulated.
**Why human:** Correct character rendering and diacritics display require visual confirmation.

#### 5. Release Workflow Structure Review

**Test:** Open `.github/workflows/release.yml` and review the two-job structure.
**Expected:** `create-release` job generates changelog with `orhun/git-cliff-action@v4` and creates the GitHub Release on `AurelianSpowormo/pmkar-releases`. `build-tauri` job matrix has all 3 platforms with correct targets. `RELEASES_REPO_PAT`, `TAURI_SIGNING_PRIVATE_KEY`, and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are referenced but not hardcoded.
**Why human:** Workflow correctness requires domain knowledge about GitHub Actions syntax and the intended release architecture; cannot be validated without triggering CI.

#### 6. Version Bump Script End-to-End Test

**Test:** Run `node scripts/bump-version.mjs 0.2.0` then `node scripts/bump-version.mjs 0.1.0`.
**Expected:** First run prints version updates for all 3 files and the git tag instructions. Second run restores 0.1.0. Files are not corrupted. JSON formatting is preserved in `package.json` and `tauri.conf.json`.
**Why human:** File mutation should be user-confirmed before first release; the test involves modifying real project files.

### Gaps Summary

No gaps. All 13 observable truths are verified. All artifacts exist at all four verification levels (exists, substantive, wired, data-flowing). All 11 D-xx requirements are satisfied. The only flagged item is the intentional placeholder pubkey in `tauri.conf.json`, which is a documented pre-release user setup step, not a defect.

Six items are routed to human verification because they require visual inspection or runtime Tauri execution that cannot be validated programmatically.

---

_Verified: 2026-03-25T09:15:00Z_
_Verifier: Claude (gsd-verifier)_
