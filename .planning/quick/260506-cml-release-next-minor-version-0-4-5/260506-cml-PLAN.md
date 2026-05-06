---
phase: quick-260506-cml
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - src-tauri/tauri.conf.json
  - src-tauri/Cargo.toml
  - CHANGELOG.md
autonomous: false
requirements: [RELEASE-0.4.5]

must_haves:
  truths:
    - "Version 0.4.5 is consistent across package.json, tauri.conf.json, and Cargo.toml"
    - "CHANGELOG.md has a [0.4.5] section with entries describing changes since 0.4.4"
    - "A git commit chore: bump version to 0.4.5 exists and tag v0.4.5 is created"
    - "Tag v0.4.5 is pushed to origin and GitHub Actions build is triggered"
  artifacts:
    - path: "package.json"
      provides: "version field = 0.4.5"
      contains: '"version": "0.4.5"'
    - path: "src-tauri/tauri.conf.json"
      provides: "version field = 0.4.5"
      contains: '"version": "0.4.5"'
    - path: "src-tauri/Cargo.toml"
      provides: "version field = 0.4.5"
      contains: 'version = "0.4.5"'
    - path: "CHANGELOG.md"
      provides: "[0.4.5] section"
      contains: "## [0.4.5]"
  key_links:
    - from: "scripts/bump-version.mjs"
      to: "package.json + src-tauri/tauri.conf.json + src-tauri/Cargo.toml + CHANGELOG.md"
      via: "node scripts/bump-version.mjs 0.4.5"
      pattern: "0\\.4\\.5"
---

<objective>
Release pmkar v0.4.5 by bumping the version across all three manifest files, updating the CHANGELOG, committing, tagging, and pushing to trigger the GitHub Actions cross-platform build.

Purpose: Ship the changes landed since v0.4.4 (Phase 26 batch ticket fetching and related post-milestone hotfixes) as a tagged release.
Output: Git tag v0.4.5 pushed to origin; GitHub Actions build triggered; updated manifests committed.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- Current versions: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml all at 0.4.4 -->
<!-- Release tooling: scripts/release.sh handles the full lifecycle — bump + commit + tag + push -->
<!-- CHANGELOG.md: [0.4.4] section exists at line 2; no [Unreleased] header present -->
<!-- bump-version.mjs: updates all three manifests and appends a new CHANGELOG section -->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write CHANGELOG entries for 0.4.5</name>
  <files>CHANGELOG.md</files>
  <action>
    Insert a new `## [0.4.5]` section at the very top of CHANGELOG.md (above the existing `## [0.4.4]` line).

    The section should document changes since 0.4.4 — specifically the Phase 26 batch ticket fetching work and the post-milestone fixes included after v0.4.4 shipped. Write the entries based on git log since the v0.4.4 tag:

    ```
    git log v0.4.4..HEAD --oneline
    ```

    Use the commit messages to draft the changelog entries. Group them under:
    - `### Added` — new features (batch ticket fetching per watched user)
    - `### Fixed` — bug fixes and code review remediations (WR-01, WR-02, WR-03 from phase 26)

    Keep each entry concise (one line). Do NOT include internal planner/docs commits.

    Format:
    ```
    ## [0.4.5]

    ### Added

    - Batch ticket fetching per watched user (Phase 26) — parallel fetch across all watched users with per-user error isolation

    ### Fixed

    - WR-01 prevent all-batches-failure from clearing existing tickets in state
    - WR-02 translate mine batch label in per-user error warning
    - WR-03 guard poll-complete listener with isLoading check to prevent stale events
    ```

    Adjust entries to match what `git log v0.4.4..HEAD --oneline` actually shows.
  </action>
  <verify>grep -c '## \[0\.4\.5\]' CHANGELOG.md</verify>
  <done>CHANGELOG.md has a [0.4.5] section above [0.4.4] with at least one entry</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>CHANGELOG.md [0.4.5] section drafted from git log since v0.4.4</what-built>
  <how-to-verify>
    1. Open CHANGELOG.md and review the [0.4.5] section at the top.
    2. Confirm entries are accurate and nothing important is missing.
    3. If entries need adjustment, edit CHANGELOG.md directly before approving.
    4. The version bump script will use this section as-is — it does not overwrite existing content.
  </how-to-verify>
  <resume-signal>Type "approved" to proceed with the version bump and release, or describe corrections needed.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Bump version and release</name>
  <files>package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml</files>
  <action>
    Run the release script from the project root. The script handles: version bump across all manifests, git commit, annotated tag creation, push to origin, and push of the tag (triggering GitHub Actions).

    Note: bump-version.mjs also writes a new CHANGELOG section. Since Task 1 already wrote the [0.4.5] section manually, check if bump-version.mjs would duplicate it. If bump-version.mjs prepends another [0.4.5] block, remove the duplicate before committing (keep the manually written one from Task 1).

    Run:
    ```
    cd /Users/mimo/Documents/Projects/pmkar && ./scripts/release.sh 0.4.5
    ```

    If release.sh exits non-zero, read the error and resolve before retrying. Common issues:
    - Uncommitted changes → commit or stash first
    - Tag already exists → already released, nothing to do
  </action>
  <verify>git tag --list "v0.4.5" | grep -q "v0.4.5" && echo "tag exists"</verify>
  <done>
    - All three manifests show version 0.4.5
    - Git tag v0.4.5 exists locally and is pushed to origin
    - GitHub Actions build triggered (visible at the repo actions URL printed by the script)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local shell → git push | Tag push triggers GitHub Actions; no credential exposure in this plan |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rel-01 | Tampering | CHANGELOG.md | accept | Manual review checkpoint before version bump; low-value target |
| T-rel-02 | Repudiation | git tag v0.4.5 | accept | Annotated tag created by release.sh with commit author identity; git history is the audit trail |
</threat_model>

<verification>
After Task 2 completes:

```bash
# Confirm all manifests at 0.4.5
grep '"version"' /Users/mimo/Documents/Projects/pmkar/package.json
grep '"version"' /Users/mimo/Documents/Projects/pmkar/src-tauri/tauri.conf.json
grep '^version' /Users/mimo/Documents/Projects/pmkar/src-tauri/Cargo.toml

# Confirm tag exists
git tag --list "v0.4.5"

# Confirm CHANGELOG has [0.4.5] section
grep '## \[0\.4\.5\]' /Users/mimo/Documents/Projects/pmkar/CHANGELOG.md
```
</verification>

<success_criteria>
- package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml all contain version 0.4.5
- CHANGELOG.md [0.4.5] section present with accurate entries
- Git commit "chore: bump version to 0.4.5" exists
- Annotated tag v0.4.5 pushed to origin
- GitHub Actions cross-platform build triggered
</success_criteria>

<output>
After completion, create `.planning/quick/260506-cml-release-next-minor-version-0-4-5/260506-cml-SUMMARY.md`
</output>
