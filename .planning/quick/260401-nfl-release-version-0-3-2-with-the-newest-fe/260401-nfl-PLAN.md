---
phase: quick
plan: 260401-nfl
type: execute
wave: 1
depends_on: []
files_modified: [Cargo.lock, src/App.tsx, src/features/tickets/CopyPreviewPage.tsx, CHANGELOG.md, package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml]
autonomous: false
requirements: [release-0.3.2]
must_haves:
  truths:
    - "All pending changes are committed to main"
    - "Version 0.3.2 is tagged and released with all artifacts"
    - "Tauri updater manifest (latest.json) points to v0.3.2"
  artifacts:
    - path: "CHANGELOG.md"
      provides: "Updated changelog with v0.3.2 entries"
      contains: "0.3.2"
  key_links:
    - from: "scripts/release.sh"
      to: "Mimo01/pmkar-releases"
      via: "GitHub API"
      pattern: "releases/tag/v0.3.2"
---

<objective>
Release pmkar v0.3.2 with all fixes since v0.3.1.

Purpose: Ship the latest bug fixes (watched users storage, target project loading, domain user pagination, pub_date handling) to users via a new release.
Output: GitHub release on Mimo01/pmkar-releases with macOS (and optionally Linux) artifacts, updater manifest, and updated README.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Commits since v0.3.1 (the changes being released):
- fix: store watched users as structured objects with name, email, and JQL identifier
- fix: load target project at startup and add project selector to copy preview
- fix: paginate domain user search to return all results
- fix: treat pub_date parse errors as up-to-date instead of showing error
- fix: ensure pub_date is never empty in CI latest.json builder

Current version in all config files: 0.3.1
Target version: 0.3.2

Uncommitted changes (must be committed first):
- Cargo.lock (2 lines changed)
- src/App.tsx (5 additions, 1 deletion)
- src/features/tickets/CopyPreviewPage.tsx (11 lines changed, net -2)
- .planning/debug/watched-users-display.md (untracked, do NOT commit)

Release script: scripts/release.sh <version>
- Requires clean working tree
- Bumps version across package.json, tauri.conf.json, Cargo.toml
- Regenerates CHANGELOG.md via git-cliff
- Builds macOS universal + optional Linux Docker
- Creates GitHub release on Mimo01/pmkar-releases
- Uploads artifacts + latest.json updater manifest
- Pushes tag + commits to origin
</context>

<tasks>

<task type="auto">
  <name>Task 1: Commit pending changes</name>
  <files>Cargo.lock, src/App.tsx, src/features/tickets/CopyPreviewPage.tsx</files>
  <action>
    Review the uncommitted changes in Cargo.lock, src/App.tsx, and src/features/tickets/CopyPreviewPage.tsx with `git diff` to understand what they contain.

    Stage and commit ONLY the three tracked modified files (Cargo.lock, src/App.tsx, src/features/tickets/CopyPreviewPage.tsx). Do NOT stage the untracked .planning/debug/ file.

    Use a commit message that describes the changes accurately based on the diff content.

    After committing, verify with `git status` that only the untracked .planning/debug/ file remains and the working tree is otherwise clean.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && git diff-index --quiet HEAD -- && echo "Working tree clean"</automated>
  </verify>
  <done>All tracked changes committed, working tree clean except for untracked .planning/ files</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Run release script</name>
  <what-built>All changes are committed and the working tree is clean, ready for release.</what-built>
  <how-to-verify>
    Run the release script from the project root:

    ```bash
    cd /Users/mimo/Desktop/pmkar
    ./scripts/release.sh 0.3.2
    ```

    The script will:
    1. Pre-flight check (token, signing key, clean tree)
    2. Bump version to 0.3.2 across all files
    3. Build macOS universal binary (+ Linux if Docker available)
    4. Create GitHub release on Mimo01/pmkar-releases
    5. Upload all artifacts + latest.json
    6. Push tag v0.3.2 and commits to origin

    Verify the script completes successfully with the summary showing:
    - Release URL: https://github.com/Mimo01/pmkar-releases/releases/tag/v0.3.2
    - macOS artifacts uploaded (DMG, app.tar.gz, sig)
    - latest.json uploaded

    NOTE: This is a checkpoint:human-action because the release script requires the Tauri signing key and GitHub token from your keychain, which Claude cannot access. The script auto-detects these from macOS Keychain and ~/.tauri/pmkar.key.
  </how-to-verify>
  <resume-signal>Confirm "released" when the script completes successfully, or describe any errors</resume-signal>
</task>

</tasks>

<verification>
- `git tag --list 'v0.3.2'` shows the tag exists
- Release visible at https://github.com/Mimo01/pmkar-releases/releases/tag/v0.3.2
- latest.json in the release points to v0.3.2 artifacts
</verification>

<success_criteria>
- v0.3.2 release published on Mimo01/pmkar-releases with macOS artifacts
- Tauri updater manifest (latest.json) serves v0.3.2 to existing users
- All fix commits since v0.3.1 included in the release
</success_criteria>

<output>
After completion, create `.planning/quick/260401-nfl-release-version-0-3-2-with-the-newest-fe/260401-nfl-SUMMARY.md`
</output>
